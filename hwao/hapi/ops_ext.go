package hapi

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/gin-gonic/gin"
)

// ===================== 运营端补充接口：供应商、模型删除、场景编辑/克隆/放量、邀请码撤销、企业编辑、价格重同步 =====================

// ---------- 供应商 ----------

func opsListSuppliers(c *gin.Context) {
	var ss []hmodel.Supplier
	hservice.DB().Order("id").Find(&ss)
	items := []gin.H{}
	for _, s := range ss {
		var n int64
		hservice.DB().Model(&hmodel.CatalogModel{}).Where("supplier_id = ?", s.Id).Count(&n)
		items = append(items, gin.H{"supplier": s, "models": n})
	}
	ok(c, items)
}

// opsSaveSupplier 新建（POST）或编辑（PUT /:id）供应商
func opsSaveSupplier(c *gin.Context) {
	s, k := bind[hmodel.Supplier](c)
	if !k {
		return
	}
	s.Name = strings.TrimSpace(s.Name)
	if s.Name == "" {
		fail(c, hservice.ErrInvalid("供应商名称必填"))
		return
	}
	if s.Status == "" {
		s.Status = "active"
	}
	if s.Status != "active" && s.Status != "paused" {
		fail(c, hservice.ErrInvalid("状态仅支持 active/paused"))
		return
	}
	var dup int64
	hservice.DB().Model(&hmodel.Supplier{}).Where("name = ? AND id <> ?", s.Name, idParam(c)).Count(&dup)
	if dup > 0 {
		fail(c, hservice.ErrInvalid("供应商名称已存在"))
		return
	}
	var err error
	if id := idParam(c); id > 0 {
		s.Id = id
		err = hservice.DB().Model(&hmodel.Supplier{Id: id}).Select("name", "contact", "contract_no", "contract_expire_at", "status", "remark").Updates(s).Error
		// 名称变更同步到已关联模型的 vendor 展示字段
		if err == nil {
			hservice.DB().Model(&hmodel.CatalogModel{}).Where("supplier_id = ?", id).Update("vendor", s.Name)
		}
	} else {
		err = hservice.DB().Create(s).Error
	}
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "supplier.save", s.Name, s.Status, c.ClientIP())
	}
	reply(c, s, err)
}

// opsDeleteSupplier 删除供应商：仍有关联模型时拒绝
func opsDeleteSupplier(c *gin.Context) {
	id := idParam(c)
	var n int64
	hservice.DB().Model(&hmodel.CatalogModel{}).Where("supplier_id = ?", id).Count(&n)
	if n > 0 {
		fail(c, hservice.ErrInvalid(fmt.Sprintf("仍有 %d 个模型关联该供应商，请先解除关联", n)))
		return
	}
	err := hservice.DB().Delete(&hmodel.Supplier{}, id).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "supplier.delete", fmt.Sprint(id), "", c.ClientIP())
	}
	reply(c, nil, err)
}

// ---------- 模型删除 ----------

// opsDeleteModel 仅允许删除“待核验/已下线”且未被任何未停用场景版本引用的模型；New API 渠道不受影响
func opsDeleteModel(c *gin.Context) {
	var m hmodel.CatalogModel
	if hservice.DB().First(&m, idParam(c)).Error != nil {
		fail(c, hservice.ErrInvalid("模型不存在"))
		return
	}
	if m.Status != "pending" && m.Status != "offline" {
		fail(c, hservice.ErrInvalid("仅“待核验/已下线”的模型可删除，请先下线"))
		return
	}
	var vs []hmodel.SceneVersion
	hservice.DB().Where("status <> ?", hmodel.SceneDisabled).Find(&vs)
	for _, v := range vs {
		if v.Candidates != "" && hservice.InList(v.Candidates, m.ModelName) {
			fail(c, hservice.ErrInvalid(fmt.Sprintf("场景 %s v%d 仍引用该模型", v.SceneId, v.Version)))
			return
		}
	}
	err := hservice.DB().Delete(&m).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "model.delete", m.ModelName, "", c.ClientIP())
	}
	reply(c, nil, err)
}

// ---------- 价格重同步 ----------

// opsResyncPrice 对同步失败的价格版本重新写入 New API 倍率并回读校验
func opsResyncPrice(c *gin.Context) {
	var p hmodel.PriceVersion
	if hservice.DB().First(&p, idParam(c)).Error != nil {
		fail(c, hservice.ErrInvalid("价格版本不存在"))
		return
	}
	err := hservice.SyncPriceToNewAPI(&p)
	hservice.DB().First(&p, p.Id)
	hservice.Audit(c.GetInt("id"), p.TenantId, "price.resync", p.ModelName, p.SyncStatus, c.ClientIP())
	reply(c, p, err)
}

// ---------- 场景 ----------

// opsUpdateScene 编辑场景名称与说明
func opsUpdateScene(c *gin.Context) {
	req, k := bind[struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}](c)
	if !k {
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		fail(c, hservice.ErrInvalid("场景名称必填"))
		return
	}
	res := hservice.DB().Model(&hmodel.Scene{}).Where("scene_id = ?", c.Param("id")).Updates(map[string]any{"name": req.Name, "description": req.Description})
	if res.RowsAffected == 0 && res.Error == nil {
		fail(c, hservice.ErrInvalid("场景不存在"))
		return
	}
	hservice.Audit(c.GetInt("id"), 0, "scene.update", c.Param("id"), req.Name, c.ClientIP())
	reply(c, nil, res.Error)
}

// opsUpdateSceneVersion 编辑草稿版本（已评测/已发布版本不可改，需另存新版本）
func opsUpdateSceneVersion(c *gin.Context) {
	in, k := bind[hmodel.SceneVersion](c)
	if !k {
		return
	}
	var v hmodel.SceneVersion
	if hservice.DB().First(&v, idParam(c)).Error != nil {
		fail(c, hservice.ErrInvalid("版本不存在"))
		return
	}
	if v.Status != hmodel.SceneDraft {
		fail(c, hservice.ErrInvalid("仅草稿版本可编辑；已评测/已发布版本请克隆为新版本"))
		return
	}
	if err := validateSceneVersion(in); err != nil {
		fail(c, err)
		return
	}
	err := hservice.DB().Model(&v).Select("scope", "system_prompt", "input_template", "output_format", "min_quality", "min_context",
		"candidates", "default_max_cost", "default_max_tokens", "has_fallback", "change_reason", "rollout_tenants", "preference").Updates(in).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "scene.version.update", v.SceneId, fmt.Sprint(v.Version), c.ClientIP())
	}
	reply(c, nil, err)
}

// validateSceneVersion 场景版本字段校验
func validateSceneVersion(v *hmodel.SceneVersion) error {
	if v.OutputFormat != "" && v.OutputFormat != "text" && v.OutputFormat != "json" {
		return hservice.ErrInvalid("输出格式仅支持 text/json")
	}
	if v.Preference != "" && v.Preference != "economy" && v.Preference != "balanced" && v.Preference != "quality" {
		return hservice.ErrInvalid("偏好仅支持 economy/balanced/quality")
	}
	if len(hservice.SplitList(v.Candidates)) == 0 {
		return hservice.ErrInvalid("至少选择一个候选模型")
	}
	if v.MinQuality < 0 || v.MinQuality > 5 || v.DefaultMaxCost < 0 || v.DefaultMaxTokens < 0 {
		return hservice.ErrInvalid("质量门槛 0-5，费用与 Token 上限不能为负")
	}
	return nil
}

// opsCloneScene 将某场景的指定版本（缺省为最新版本）克隆为新场景的 v1 草稿
func opsCloneScene(c *gin.Context) {
	req, k := bind[struct {
		NewSceneId string `json:"new_scene_id"`
		Name       string `json:"name"`
		VersionId  int64  `json:"version_id"`
	}](c)
	if !k {
		return
	}
	req.NewSceneId = strings.TrimSpace(req.NewSceneId)
	if req.NewSceneId == "" || req.Name == "" {
		fail(c, hservice.ErrInvalid("新场景 ID 与名称必填"))
		return
	}
	var n int64
	hservice.DB().Model(&hmodel.Scene{}).Where("scene_id = ?", req.NewSceneId).Count(&n)
	if n > 0 {
		fail(c, hservice.ErrInvalid("场景 ID 已存在"))
		return
	}
	var src hmodel.Scene
	if hservice.DB().Where("scene_id = ?", c.Param("id")).First(&src).Error != nil {
		fail(c, hservice.ErrInvalid("源场景不存在"))
		return
	}
	var v hmodel.SceneVersion
	q := hservice.DB().Where("scene_id = ?", src.SceneId)
	if req.VersionId > 0 {
		q = q.Where("id = ?", req.VersionId)
	}
	if q.Order("version desc").First(&v).Error != nil {
		fail(c, hservice.ErrInvalid("源场景没有可克隆的版本"))
		return
	}
	v.ChangeReason = fmt.Sprintf("克隆自 %s v%d", src.SceneId, v.Version)
	v.RolloutTenants = ""
	err := hservice.SaveSceneVersion(c.GetInt("id"), req.NewSceneId, req.Name, src.Description, &v)
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "scene.clone", req.NewSceneId, v.ChangeReason, c.ClientIP())
	}
	reply(c, v, err)
}

// opsSceneRollout 设置版本的小范围放量租户（空=全量）；已发布版本也可调整，用于灰度扩大/收回
func opsSceneRollout(c *gin.Context) {
	req, k := bind[struct {
		Tenants string `json:"tenants"`
	}](c)
	if !k {
		return
	}
	ids := []string{}
	for _, t := range hservice.SplitList(req.Tenants) {
		var n int64
		hservice.DB().Model(&hmodel.Tenant{}).Where("id = ?", t).Count(&n)
		if n == 0 {
			fail(c, hservice.ErrInvalid("企业 #"+t+" 不存在"))
			return
		}
		ids = append(ids, t)
	}
	var v hmodel.SceneVersion
	if hservice.DB().First(&v, idParam(c)).Error != nil {
		fail(c, hservice.ErrInvalid("版本不存在"))
		return
	}
	err := hservice.DB().Model(&v).Update("rollout_tenants", strings.Join(ids, ",")).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "scene.rollout", v.SceneId, fmt.Sprintf("v%d -> [%s]", v.Version, strings.Join(ids, ",")), c.ClientIP())
	}
	reply(c, nil, err)
}

// ---------- 邀请码撤销 ----------

// opsRevokeInvite 删除未使用的邀请码；已使用的保留以便追溯
func opsRevokeInvite(c *gin.Context) {
	var inv hmodel.Invite
	if hservice.DB().First(&inv, idParam(c)).Error != nil {
		fail(c, hservice.ErrInvalid("邀请码不存在"))
		return
	}
	if inv.UsedBy > 0 || inv.TenantId > 0 {
		fail(c, hservice.ErrInvalid("邀请码已被使用，不能撤销"))
		return
	}
	err := hservice.DB().Delete(&inv).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "invite.revoke", inv.Code, "", c.ClientIP())
	}
	reply(c, nil, err)
}

// ---------- 企业编辑 ----------

// opsUpdateTenant 编辑企业名称、预算、并发与预警阈值
func opsUpdateTenant(c *gin.Context) {
	req, k := bind[struct {
		Name            string `json:"name"`
		DailyBudget     int64  `json:"daily_budget"`
		MonthlyBudget   int64  `json:"monthly_budget"`
		MaxConcurrency  int    `json:"max_concurrency"`
		AlertThresholds string `json:"alert_thresholds"`
	}](c)
	if !k {
		return
	}
	if strings.TrimSpace(req.Name) == "" || req.DailyBudget < 0 || req.MonthlyBudget < 0 || req.MaxConcurrency < 1 {
		fail(c, hservice.ErrInvalid("企业名称必填，预算不能为负，并发至少为 1"))
		return
	}
	if req.AlertThresholds == "" {
		req.AlertThresholds = "80,95"
	}
	id := idParam(c)
	res := hservice.DB().Model(&hmodel.Tenant{}).Where("id = ?", id).Updates(map[string]any{
		"name": strings.TrimSpace(req.Name), "daily_budget": req.DailyBudget, "monthly_budget": req.MonthlyBudget,
		"max_concurrency": req.MaxConcurrency, "alert_thresholds": req.AlertThresholds,
	})
	if res.Error == nil && res.RowsAffected == 0 {
		var n int64
		hservice.DB().Model(&hmodel.Tenant{}).Where("id = ?", id).Count(&n)
		if n == 0 {
			fail(c, hservice.ErrInvalid("企业不存在"))
			return
		}
	}
	hservice.Audit(c.GetInt("id"), id, "tenant.update", req.Name, "", c.ClientIP())
	reply(c, nil, res.Error)
}

// opsDeleteScene 删除从未发布过的场景（含其版本与评测记录）；发布过的场景只能停用以保留追溯
func opsDeleteScene(c *gin.Context) {
	var s hmodel.Scene
	if hservice.DB().Where("scene_id = ?", c.Param("id")).First(&s).Error != nil {
		fail(c, hservice.ErrInvalid("场景不存在"))
		return
	}
	var n int64
	hservice.DB().Model(&hmodel.SceneVersion{}).Where("scene_id = ? AND status = ?", s.SceneId, hmodel.ScenePublished).Count(&n)
	if s.CurrentVersionId > 0 || n > 0 {
		fail(c, hservice.ErrInvalid("场景发布过，不能删除，请改为停用"))
		return
	}
	hservice.DB().Where("scene_id = ?", s.SceneId).Delete(&hmodel.SceneVersion{})
	hservice.DB().Where("scene_id = ?", s.SceneId).Delete(&hmodel.EvalResult{})
	err := hservice.DB().Delete(&s).Error
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "scene.delete", s.SceneId, s.Name, c.ClientIP())
	}
	reply(c, nil, err)
}
