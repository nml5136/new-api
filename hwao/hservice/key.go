package hservice

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// ===================== 平台密钥管理（FR03） =====================

// PlatformKeyPrefix 平台密钥前缀，网关据此区分平台密钥与 New API 原生令牌。
const PlatformKeyPrefix = "hwk-"

// CreateKeyReq 创建密钥参数。
type CreateKeyReq struct {
	ProjectId  int64  `json:"project_id"`
	Name       string `json:"name"`
	ExpiresAt  int64  `json:"expires_at"`
	QuotaLimit int64  `json:"quota_limit"` // 调用额度（分）
	AllowIps   string `json:"allow_ips"`
	Service    bool   `json:"service"` // 企业级服务密钥（不归属个人）
}

// CreatedKey 创建结果：完整密钥只在此返回一次。
type CreatedKey struct {
	Key  string              `json:"key"`
	Info *hmodel.PlatformKey `json:"info"`
}

// projectModelLimits 内部令牌的模型限制：项目白名单 ∩ 可售模型，权限不大于平台密钥范围。
func projectModelLimits(p *hmodel.Project) string {
	var names []string
	DB().Model(&hmodel.CatalogModel{}).Where("status = ?", hmodel.ModelOnSale).Pluck("model_name", &names)
	var out []string
	for _, n := range names {
		if p.ModelWhitelist == "" || InList(p.ModelWhitelist, n) {
			out = append(out, n)
		}
	}
	return strings.Join(out, ",")
}

// CreateKey 创建平台密钥，并在 New API 中为该租户建立受限内部令牌。
func CreateKey(a *Actor, req CreateKeyReq) (*CreatedKey, error) {
	if a.Tenant.Status != hmodel.TenantStatusEnabled {
		return nil, ErrForbidden("企业未启用")
	}
	if req.Service && !a.IsAdmin() {
		return nil, ErrForbidden("仅管理员可创建企业级服务密钥")
	}
	if !a.CanUseProject(req.ProjectId) {
		return nil, ErrForbidden("无权使用该项目")
	}
	var p hmodel.Project
	DB().First(&p, req.ProjectId)
	return createKeyForProject(a.UserId, a.Tenant, &p, req)
}

func createKeyForProject(operator int, t *hmodel.Tenant, p *hmodel.Project, req CreateKeyReq) (*CreatedKey, error) {
	raw := PlatformKeyPrefix + RandToken(40)
	internal, err := common.GenerateKey()
	if err != nil {
		return nil, err
	}
	var allowIps *string
	if req.AllowIps != "" {
		s := strings.ReplaceAll(req.AllowIps, ",", "\n")
		allowIps = &s
	}
	limits := projectModelLimits(p)
	tok := model.Token{
		UserId: t.NewapiUserId, Key: internal, Status: common.TokenStatusEnabled,
		Name: fmt.Sprintf("hwao-p%d", p.Id), CreatedTime: Now(), AccessedTime: Now(), ExpiredTime: -1,
		UnlimitedQuota: true, // 钱包为唯一额度事实源，密钥额度由平台入口校验
		ModelLimitsEnabled: true, ModelLimits: limits, AllowIps: allowIps, Group: "",
	}
	if limits == "" {
		tok.ModelLimits = "__none__" // 无可用模型时令牌不可调用任何模型
	}
	if err := tok.Insert(); err != nil {
		return nil, err
	}
	enc, err := Encrypt(internal)
	if err != nil {
		return nil, err
	}
	owner := operator
	if req.Service {
		owner = 0
	}
	k := &hmodel.PlatformKey{
		TenantId: t.Id, ProjectId: p.Id, OwnerUserId: owner, Name: req.Name, Prefix: raw[:8],
		Digest: Digest(raw), InternalTokenId: tok.Id, InternalKeyEnc: enc, Status: hmodel.KeyStatusActive,
		ExpiresAt: req.ExpiresAt, QuotaLimit: req.QuotaLimit, AllowIps: req.AllowIps,
	}
	if err := DB().Create(k).Error; err != nil {
		return nil, err
	}
	Audit(operator, t.Id, "key.create", k.Prefix, fmt.Sprintf("project=%d", p.Id), "")
	return &CreatedKey{Key: raw, Info: k}, nil
}

// loadOwnKey 读取本企业的密钥；非管理员只能操作自己的密钥。
func loadOwnKey(a *Actor, id int64) (*hmodel.PlatformKey, error) {
	var k hmodel.PlatformKey
	if err := DB().Where("id = ? AND tenant_id = ?", id, a.TenantId).First(&k).Error; err != nil {
		return nil, ErrForbidden("密钥不存在")
	}
	if !a.IsAdmin() && k.OwnerUserId != a.UserId {
		return nil, ErrForbidden("无权操作该密钥")
	}
	return &k, nil
}

// SetKeyEnabled 停用/启用密钥（同步内部令牌状态）。
func SetKeyEnabled(a *Actor, id int64, enabled bool) error {
	k, err := loadOwnKey(a, id)
	if err != nil {
		return err
	}
	if k.Status == hmodel.KeyStatusRevoked {
		return ErrInvalid("已撤销的密钥不可恢复")
	}
	st, tst := hmodel.KeyStatusDisabled, common.TokenStatusDisabled
	if enabled {
		st, tst = hmodel.KeyStatusActive, common.TokenStatusEnabled
	}
	DB().Model(k).Update("status", st)
	setInternalTokenStatus(k.InternalTokenId, tst)
	Audit(a.UserId, a.TenantId, "key.status", k.Prefix, fmt.Sprint(st), "")
	return nil
}

// RevokeKey 撤销密钥：新请求立即拒绝；在途请求按既定规则结束。
func RevokeKey(a *Actor, id int64) error {
	k, err := loadOwnKey(a, id)
	if err != nil {
		return err
	}
	revokeKeyTx(DB(), k)
	Audit(a.UserId, a.TenantId, "key.revoke", k.Prefix, "", "")
	return nil
}

func revokeKeyTx(tx *gorm.DB, k *hmodel.PlatformKey) {
	tx.Model(k).Update("status", hmodel.KeyStatusRevoked)
	setInternalTokenStatus(k.InternalTokenId, common.TokenStatusDisabled)
}

// setInternalTokenStatus 更新 New API 内部令牌状态并清理其缓存。
func setInternalTokenStatus(tokenId int, status int) {
	model.DB.Model(&model.Token{}).Where("id = ?", tokenId).Update("status", status)
	var tok model.Token
	if model.DB.First(&tok, tokenId).Error == nil {
		_ = model.InvalidateUserTokensCache(tok.UserId)
	}
}

// RotateKey 轮换：生成新密钥，旧密钥进入过渡期（graceSeconds 内仍可用，到期由后台任务撤销）。
func RotateKey(a *Actor, id int64, graceSeconds int64) (*CreatedKey, error) {
	k, err := loadOwnKey(a, id)
	if err != nil {
		return nil, err
	}
	if k.Status != hmodel.KeyStatusActive {
		return nil, ErrInvalid("仅启用中的密钥可轮换")
	}
	var p hmodel.Project
	DB().First(&p, k.ProjectId)
	nk, err := createKeyForProject(a.UserId, a.Tenant, &p, CreateKeyReq{
		ProjectId: k.ProjectId, Name: k.Name, ExpiresAt: k.ExpiresAt, QuotaLimit: k.QuotaLimit, AllowIps: k.AllowIps, Service: k.OwnerUserId == 0,
	})
	if err != nil {
		return nil, err
	}
	if k.OwnerUserId != 0 {
		DB().Model(nk.Info).Update("owner_user_id", k.OwnerUserId)
	}
	if graceSeconds <= 0 {
		revokeKeyTx(DB(), k)
	} else {
		DB().Model(k).Updates(map[string]any{"status": hmodel.KeyStatusRotating, "grace_until": Now() + graceSeconds})
	}
	Audit(a.UserId, a.TenantId, "key.rotate", k.Prefix, "new="+nk.Info.Prefix, "")
	return nk, nil
}

// ExpireRotatingKeys 后台任务：过渡期结束的旧密钥自动撤销。
func ExpireRotatingKeys() {
	var keys []hmodel.PlatformKey
	DB().Where("status = ? AND grace_until < ?", hmodel.KeyStatusRotating, Now()).Find(&keys)
	for i := range keys {
		revokeKeyTx(DB(), &keys[i])
	}
}

// RefreshProjectTokenLimits 项目白名单或模型目录变化后，同步收紧/更新内部令牌模型范围。
func RefreshProjectTokenLimits(projectId int64) {
	var p hmodel.Project
	if DB().First(&p, projectId).Error != nil {
		return
	}
	limits := projectModelLimits(&p)
	if limits == "" {
		limits = "__none__"
	}
	var ids []int
	DB().Model(&hmodel.PlatformKey{}).Where("project_id = ? AND status <> ?", projectId, hmodel.KeyStatusRevoked).Pluck("internal_token_id", &ids)
	if len(ids) == 0 {
		return
	}
	model.DB.Model(&model.Token{}).Where("id IN ?", ids).Updates(map[string]any{"model_limits_enabled": true, "model_limits": limits})
	var t hmodel.Tenant
	if DB().First(&t, p.TenantId).Error == nil {
		_ = model.InvalidateUserTokensCache(t.NewapiUserId)
	}
}

// AuthKey 网关鉴权：按摘要查找平台密钥，校验状态、有效期、来源 IP 与额度。
func AuthKey(raw, clientIp string) (*hmodel.PlatformKey, error) {
	if !strings.HasPrefix(raw, PlatformKeyPrefix) {
		return nil, ErrUnauth("无效的平台密钥")
	}
	var k hmodel.PlatformKey
	if err := DB().Where("digest = ?", Digest(raw)).First(&k).Error; err != nil {
		return nil, ErrUnauth("无效的平台密钥")
	}
	switch {
	case k.Status == hmodel.KeyStatusActive:
	case k.Status == hmodel.KeyStatusRotating && k.GraceUntil > Now():
	default:
		return nil, ErrUnauth("密钥已停用或撤销")
	}
	if k.ExpiresAt > 0 && k.ExpiresAt < Now() {
		return nil, ErrUnauth("密钥已过期")
	}
	if k.AllowIps != "" && !InList(k.AllowIps, clientIp) {
		return nil, ErrForbidden("来源 IP 不在允许范围")
	}
	if k.QuotaLimit > 0 && k.UsedAmount >= k.QuotaLimit {
		return nil, ErrQuota("密钥调用额度已用尽")
	}
	return &k, nil
}

// WorkbenchKeyName 网页工作台专用的项目级服务密钥名（不对外展示完整密钥）。
const WorkbenchKeyName = "__workbench__"

// WorkbenchKey 取得（或创建）项目的网页工作台服务密钥，使网页调用与 API 调用走同一计费链路。
func WorkbenchKey(t *hmodel.Tenant, p *hmodel.Project) (*hmodel.PlatformKey, error) {
	var k hmodel.PlatformKey
	if DB().Where("project_id = ? AND name = ? AND owner_user_id = 0 AND status = ?", p.Id, WorkbenchKeyName, hmodel.KeyStatusActive).First(&k).Error == nil {
		return &k, nil
	}
	ck, err := createKeyForProject(0, t, p, CreateKeyReq{ProjectId: p.Id, Name: WorkbenchKeyName, Service: true})
	if err != nil {
		return nil, err
	}
	return ck.Info, nil
}
