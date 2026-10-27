package hservice

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ===================== 模型与资源管理（FR24） =====================

// ChannelCount 查询 New API 中可承载该模型的已启用渠道数（渠道凭证由 New API 保管）。
func ChannelCount(modelName string) int64 {
	var cnt int64
	model.DB.Model(&model.Ability{}).Where("model = ? AND enabled = ?", modelName, true).Distinct("channel_id").Count(&cnt)
	return cnt
}

// SaveModel 运营新增/修改模型目录项。状态切换为“可售”前须回读校验 New API 渠道与价格。
func SaveModel(operator int, m *hmodel.CatalogModel) error {
	if m.ModelName == "" {
		return ErrInvalid("模型名不能为空")
	}
	if m.Status == "" {
		m.Status = hmodel.ModelPending
	}
	if m.Status == hmodel.ModelOnSale {
		if err := checkSellable(m); err != nil {
			return err
		}
	}
	if m.Id > 0 {
		var old hmodel.CatalogModel
		if DB().First(&old, m.Id).Error == nil && (old.ContextLength != m.ContextLength || old.SupportJson != m.SupportJson || old.MaxOutput != m.MaxOutput) {
			m.CapabilityVersion = old.CapabilityVersion + 1 // 能力变化升级能力版本
		}
	}
	if err := DB().Save(m).Error; err != nil {
		return err
	}
	Audit(operator, 0, "model.save", m.ModelName, m.Status, "")
	refreshAllProjectTokens()
	return nil
}

// checkSellable 可售前置条件：New API 有可用渠道、授权未过期、价格可核实。
func checkSellable(m *hmodel.CatalogModel) error {
	if ChannelCount(m.ModelName) == 0 {
		return ErrInvalid("New API 中没有该模型的可用渠道，不能标记可售")
	}
	if m.LicenseExpireAt > 0 && m.LicenseExpireAt < Now() {
		return ErrInvalid("模型授权已过期")
	}
	if CurrentPrice(m.ModelName, 0, Now()) == nil {
		return ErrInvalid("模型尚无生效价格，不能标记可售")
	}
	return nil
}

// refreshAllProjectTokens 模型目录变化后刷新所有项目内部令牌的模型范围。
func refreshAllProjectTokens() {
	var ids []int64
	DB().Model(&hmodel.Project{}).Pluck("id", &ids)
	for _, id := range ids {
		RefreshProjectTokenLimits(id)
	}
}

// BlockExpiredModels 后台任务：授权到期的可售模型自动暂停新流量并告警。
func BlockExpiredModels() {
	var ms []hmodel.CatalogModel
	DB().Where("status = ? AND license_expire_at > 0 AND license_expire_at < ?", hmodel.ModelOnSale, Now()).Find(&ms)
	for _, m := range ms {
		DB().Model(&m).Update("status", hmodel.ModelPaused)
		RaiseAlert("license", "critical", 0, "license:"+m.ModelName, m.ModelName, "模型授权已到期，已暂停新流量")
	}
	if len(ms) > 0 {
		refreshAllProjectTokens()
	}
}

// ===================== 价格版本（FR16） =====================

// CurrentPrice 取某时刻对某租户生效的价格：合同价优先于公开零售价。
func CurrentPrice(modelName string, tenantId int64, at int64) *hmodel.PriceVersion {
	var p hmodel.PriceVersion
	q := DB().Where("model_name = ? AND effective_at <= ?", modelName, at)
	if tenantId > 0 && q.Session(&gorm.Session{}).Where("tenant_id = ?", tenantId).Order("effective_at desc, id desc").First(&p).Error == nil {
		return &p
	}
	if DB().Where("model_name = ? AND effective_at <= ? AND tenant_id = 0", modelName, at).Order("effective_at desc, id desc").First(&p).Error == nil {
		return &p
	}
	return nil
}

// PublishPrice 新建价格版本；仅作用于生效时间之后接收的新请求。
// 生效时把公开零售价同步为 New API 的模型倍率（New API 是实际扣费方），并回读校验。
func PublishPrice(operator int, p *hmodel.PriceVersion) error {
	if p.ModelName == "" || p.InputPrice <= 0 {
		return ErrInvalid("模型与输入价格必填")
	}
	var maxVer int
	DB().Model(&hmodel.PriceVersion{}).Where("model_name = ? AND tenant_id = ?", p.ModelName, p.TenantId).Select("COALESCE(MAX(version),0)").Scan(&maxVer)
	p.Version = maxVer + 1
	p.Id = 0
	p.CreatedBy = operator
	if p.EffectiveAt <= 0 {
		p.EffectiveAt = Now()
	}
	p.SyncStatus = "pending"
	if err := DB().Create(p).Error; err != nil {
		return err
	}
	Audit(operator, p.TenantId, "price.publish", p.ModelName, fmt.Sprintf("v%d in=%d out=%d eff=%d", p.Version, p.InputPrice, p.OutputPrice, p.EffectiveAt), "")
	if p.EffectiveAt <= Now() {
		return SyncPriceToNewAPI(p)
	}
	return nil
}

// SyncDuePrices 后台任务：到达生效时间的价格版本同步到 New API。
func SyncDuePrices() {
	var ps []hmodel.PriceVersion
	DB().Where("sync_status = ? AND effective_at <= ?", "pending", Now()).Find(&ps)
	for i := range ps {
		_ = SyncPriceToNewAPI(&ps[i])
	}
}

// SyncPriceToNewAPI 将“分/百万Token”零售价换算为 New API 倍率：
// ModelRatio 1 = $0.002/1K = $2/1M；补全倍率 = 输出价/输入价；缓存倍率 = 缓存命中价/输入价。
// 合同价（tenant_id>0）无法用全局倍率表达，仅记录为平台快照，标记 platform_only。
func SyncPriceToNewAPI(p *hmodel.PriceVersion) error {
	if p.TenantId > 0 {
		DB().Model(p).Update("sync_status", "platform_only")
		return nil
	}
	usdPerM := float64(p.InputPrice) / 100 / usdCny
	ratio := math.Round(usdPerM/2*1e6) / 1e6
	comp := 1.0
	if p.OutputPrice > 0 {
		comp = math.Round(float64(p.OutputPrice)/float64(p.InputPrice)*1e6) / 1e6
	}
	mr := ratio_setting.GetModelRatioCopy()
	cr := ratio_setting.GetCompletionRatioCopy()
	mr[p.ModelName] = ratio
	cr[p.ModelName] = comp
	b1, _ := json.Marshal(mr)
	b2, _ := json.Marshal(cr)
	err1 := model.UpdateOption("ModelRatio", string(b1))
	err2 := model.UpdateOption("CompletionRatio", string(b2))
	if p.CacheReadPrice > 0 {
		cache := ratio_setting.GetCacheRatioCopy()
		cache[p.ModelName] = math.Round(float64(p.CacheReadPrice)/float64(p.InputPrice)*1e6) / 1e6
		b3, _ := json.Marshal(cache)
		_ = model.UpdateOption("CacheRatio", string(b3))
	}
	// 回读校验：同步失败不得标记为已发布
	got, ok, _ := ratio_setting.GetModelRatio(p.ModelName)
	if err1 != nil || err2 != nil || !ok || math.Abs(got-ratio) > 1e-9 {
		DB().Model(p).Update("sync_status", "failed")
		RaiseAlert("price_sync", "critical", 0, fmt.Sprintf("price_sync:%d", p.Id), p.ModelName, "价格同步 New API 失败，新流量价格不可确认")
		return ErrNoResource("价格同步 New API 失败")
	}
	DB().Model(p).Update("sync_status", "ok")
	return nil
}

// ===================== 场景与策略发布（FR05/FR25） =====================

// SaveSceneVersion 新建场景草稿版本（不影响已发布版本）。
func SaveSceneVersion(operator int, sceneId, name, desc string, v *hmodel.SceneVersion) error {
	return DB().Transaction(func(tx *gorm.DB) error {
		var s hmodel.Scene
		if tx.Where("scene_id = ?", sceneId).First(&s).Error != nil {
			s = hmodel.Scene{SceneId: sceneId, Name: name, Description: desc, Status: hmodel.SceneDraft}
			if err := tx.Create(&s).Error; err != nil {
				return err
			}
		} else if name != "" {
			tx.Model(&s).Updates(map[string]any{"name": name, "description": desc})
		}
		var maxVer int
		tx.Model(&hmodel.SceneVersion{}).Where("scene_id = ?", sceneId).Select("COALESCE(MAX(version),0)").Scan(&maxVer)
		v.Id, v.SceneId, v.Version, v.Status, v.CreatedBy = 0, sceneId, maxVer+1, hmodel.SceneDraft, operator
		return tx.Create(v).Error
	})
}

// MarkEvaluated 评测通过：须有评测结果记录。
func MarkEvaluated(operator int, versionId int64) error {
	var v hmodel.SceneVersion
	if DB().First(&v, versionId).Error != nil {
		return ErrInvalid("版本不存在")
	}
	var cnt int64
	DB().Model(&hmodel.EvalResult{}).Where("scene_id = ?", v.SceneId).Count(&cnt)
	if cnt == 0 {
		return ErrInvalid("尚无评测结果，不能标记评测通过")
	}
	Audit(operator, 0, "scene.evaluated", v.SceneId, fmt.Sprint(v.Version), "")
	return DB().Model(&v).Update("status", hmodel.SceneEvaluated).Error
}

// PublishScene 发布：验证至少一个可用模型、兜底资源，再切换版本指针；旧版本保留。
func PublishScene(operator int, versionId int64, reason string) error {
	var v hmodel.SceneVersion
	if DB().First(&v, versionId).Error != nil {
		return ErrInvalid("版本不存在")
	}
	if v.Status != hmodel.SceneEvaluated && v.Status != hmodel.ScenePublished {
		return ErrInvalid("仅评测通过的版本可发布")
	}
	usable := 0
	channels := int64(0)
	for _, mn := range SplitList(v.Candidates) {
		var m hmodel.CatalogModel
		if DB().Where("model_name = ? AND status = ?", mn, hmodel.ModelOnSale).First(&m).Error == nil && m.QualityLevel >= v.MinQuality {
			usable++
			channels += ChannelCount(mn)
		}
	}
	if usable == 0 {
		return ErrInvalid("没有满足质量门槛的可售模型，不能发布")
	}
	if v.HasFallback && usable < 2 && channels < 2 {
		return ErrInvalid("场景宣称具备兜底，但没有备用资源")
	}
	return DB().Transaction(func(tx *gorm.DB) error {
		var s hmodel.Scene
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("scene_id = ?", v.SceneId).First(&s).Error; err != nil {
			return err
		}
		prev := s.CurrentVersionId
		if prev == v.Id {
			prev = s.PrevVersionId
		}
		tx.Model(&v).Updates(map[string]any{"status": hmodel.ScenePublished, "change_reason": reason})
		Audit(operator, 0, "scene.publish", v.SceneId, fmt.Sprintf("v%d %s", v.Version, reason), "")
		return tx.Model(&s).Updates(map[string]any{"current_version_id": v.Id, "prev_version_id": prev, "status": hmodel.ScenePublished}).Error
	})
}

// RollbackScene 恢复上一版本（只切换指针，历史请求仍绑定原版本）。
func RollbackScene(operator int, sceneId string) error {
	var s hmodel.Scene
	if DB().Where("scene_id = ?", sceneId).First(&s).Error != nil || s.PrevVersionId == 0 {
		return ErrInvalid("没有可恢复的上一版本")
	}
	Audit(operator, 0, "scene.rollback", sceneId, fmt.Sprintf("%d->%d", s.CurrentVersionId, s.PrevVersionId), "")
	return DB().Model(&s).Updates(map[string]any{"current_version_id": s.PrevVersionId, "prev_version_id": s.CurrentVersionId}).Error
}

// SetSceneStatus 停用/启用场景：停用后拒绝新任务，不删除历史账单与审计依据。
func SetSceneStatus(operator int, sceneId, status string) error {
	if status != hmodel.SceneDisabled && status != hmodel.ScenePublished {
		return ErrInvalid("状态无效")
	}
	Audit(operator, 0, "scene.status", sceneId, status, "")
	return DB().Model(&hmodel.Scene{}).Where("scene_id = ?", sceneId).Update("status", status).Error
}

// ActiveSceneVersion 返回租户可见的已发布场景版本（支持按租户小范围放量）。
func ActiveSceneVersion(sceneId string, tenantId int64) (*hmodel.Scene, *hmodel.SceneVersion, error) {
	var s hmodel.Scene
	if DB().Where("scene_id = ?", sceneId).First(&s).Error != nil {
		return nil, nil, ErrInvalid("场景不存在")
	}
	if s.Status != hmodel.ScenePublished || s.CurrentVersionId == 0 {
		return nil, nil, ErrNoResource("场景未发布或已停用")
	}
	var v hmodel.SceneVersion
	if DB().First(&v, s.CurrentVersionId).Error != nil {
		return nil, nil, ErrNoResource("场景策略不可用")
	}
	// 小范围放量：不在放量名单的租户继续使用上一版本
	if v.RolloutTenants != "" && !InList(v.RolloutTenants, fmt.Sprint(tenantId)) && s.PrevVersionId > 0 {
		DB().First(&v, s.PrevVersionId)
	}
	return &s, &v, nil
}
