package hservice

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ===================== 企业开通（FR01） =====================

// CreateInvite 平台运营生成企业开通邀请码。
func CreateInvite(operator int, remark string, validDays int) (*hmodel.Invite, error) {
	if validDays <= 0 {
		validDays = 7
	}
	inv := &hmodel.Invite{Code: "INV" + RandToken(12), Remark: remark, ExpiresAt: Now() + int64(validDays)*86400, CreatedBy: operator}
	return inv, DB().Create(inv).Error
}

// OpenTenantReq 企业开通请求：邀请码 + 企业名 + 同意条款。
type OpenTenantReq struct {
	InviteCode  string `json:"invite_code"`
	Name        string `json:"name"`
	AgreeTerms  bool   `json:"agree_terms"`
	ProvisionNo string `json:"provision_no"` // 客户端可传，重试时复用以保证幂等
}

// OpenTenant 由已登录的 New API 用户凭邀请码创建企业、默认项目，并发起计费钱包开通。
// 同一开通业务号重复提交时返回已有结果，不重复建钱包。
func OpenTenant(userId int, req OpenTenantReq) (*hmodel.Tenant, error) {
	if !req.AgreeTerms {
		return nil, ErrInvalid("须同意服务、计费和数据规则后才能开通")
	}
	if req.Name == "" {
		return nil, ErrInvalid("企业名称不能为空")
	}
	if req.ProvisionNo == "" {
		req.ProvisionNo = "PV-" + req.InviteCode
	}
	// 先按开通业务号查询已有结果
	var exist hmodel.Tenant
	if DB().Where("provision_no = ?", req.ProvisionNo).First(&exist).Error == nil {
		if exist.Status != hmodel.TenantStatusEnabled {
			return ProvisionWallet(exist.Id)
		}
		return &exist, nil
	}
	var tenant hmodel.Tenant
	err := DB().Transaction(func(tx *gorm.DB) error {
		var inv hmodel.Invite
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("code = ?", req.InviteCode).First(&inv).Error; err != nil {
			return ErrInvalid("邀请码无效")
		}
		if inv.UsedBy != 0 || inv.ExpiresAt < Now() {
			return ErrInvalid("邀请码已使用或已过期")
		}
		var cnt int64
		tx.Model(&hmodel.Member{}).Where("user_id = ? AND status = 1", userId).Count(&cnt)
		if cnt > 0 {
			return ErrInvalid("当前账号已属于某个企业")
		}
		tenant = hmodel.Tenant{Name: req.Name, ProvisionNo: req.ProvisionNo, Status: hmodel.TenantStatusPending, AgreedTermsAt: Now()}
		if err := tx.Create(&tenant).Error; err != nil {
			return err
		}
		if err := tx.Create(&hmodel.Member{TenantId: tenant.Id, UserId: userId, Role: hmodel.RoleTenantAdmin, Status: 1}).Error; err != nil {
			return err
		}
		proj := hmodel.Project{TenantId: tenant.Id, Name: "默认项目", IsDefault: true, DefaultRouteMode: "scene", Preference: "balanced", MaxConcurrency: 5, Status: 1}
		if err := tx.Create(&proj).Error; err != nil {
			return err
		}
		if err := tx.Create(&hmodel.ProjectMember{ProjectId: proj.Id, UserId: userId}).Error; err != nil {
			return err
		}
		return tx.Model(&inv).Updates(map[string]any{"used_by": userId, "tenant_id": tenant.Id}).Error
	})
	if err != nil {
		return nil, err
	}
	Audit(userId, tenant.Id, "tenant.open", tenant.Name, req.ProvisionNo, "")
	return ProvisionWallet(tenant.Id)
}

// walletUsername 租户钱包用户名是确定性的，借 users.username 唯一约束防止并发重复建钱包。
func walletUsername(tenantId int64) string { return fmt.Sprintf("hwt_%d", tenantId) }

// ProvisionWallet 建立 tenant_id 与 New API 计费用户的一对一映射；可重复调用（先查后建）。
// 失败时标记“配置失败”，不会留下可用的公共共享账号。
func ProvisionWallet(tenantId int64) (*hmodel.Tenant, error) {
	var t hmodel.Tenant
	err := DB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&t, tenantId).Error; err != nil {
			return err
		}
		if t.NewapiUserId > 0 && t.Status == hmodel.TenantStatusEnabled {
			return nil
		}
		return tx.Model(&t).Update("status", hmodel.TenantStatusConfiguring).Error
	})
	if err != nil {
		return nil, err
	}
	if t.Status == hmodel.TenantStatusEnabled {
		return &t, nil
	}
	fail := func(reason string) (*hmodel.Tenant, error) {
		DB().Model(&t).Updates(map[string]any{"status": hmodel.TenantStatusFailed, "fail_reason": reason})
		t.Status = hmodel.TenantStatusFailed
		return &t, ErrNoResource("企业钱包开通失败：" + reason)
	}
	uname := walletUsername(t.Id)
	var u model.User
	if model.DB.Unscoped().Where("username = ?", uname).First(&u).Error != nil {
		// 计费用户：普通角色、随机密码（不用于登录），初始额度清零（赠送额度须走审批发放）
		u = model.User{Username: uname, Password: RandToken(24), DisplayName: "hwao租户" + fmt.Sprint(t.Id), Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", Remark: "hwao tenant wallet"}
		if err := u.Insert(0); err != nil {
			return fail("创建计费用户失败")
		}
		model.DB.Model(&model.User{}).Where("id = ?", u.Id).Update("quota", 0)
	}
	if err := DB().Model(&t).Updates(map[string]any{"newapi_user_id": u.Id, "status": hmodel.TenantStatusEnabled, "fail_reason": ""}).Error; err != nil {
		return fail("保存映射失败")
	}
	t.NewapiUserId = u.Id
	t.Status = hmodel.TenantStatusEnabled
	return &t, nil
}

// ===================== 身份上下文 =====================

// Actor 当前登录成员在企业中的身份。
type Actor struct {
	UserId   int
	TenantId int64
	Role     string
	Tenant   *hmodel.Tenant
}

// GetActor 根据 New API 登录用户找到所属企业和角色；所有租户查询以此为前置条件。
func GetActor(userId int) (*Actor, error) {
	var m hmodel.Member
	if err := DB().Where("user_id = ? AND status = 1", userId).First(&m).Error; err != nil {
		return nil, ErrForbidden("尚未加入企业")
	}
	var t hmodel.Tenant
	if err := DB().First(&t, m.TenantId).Error; err != nil {
		return nil, ErrForbidden("企业不存在")
	}
	return &Actor{UserId: userId, TenantId: m.TenantId, Role: m.Role, Tenant: &t}, nil
}

// IsAdmin 是否企业管理员。
func (a *Actor) IsAdmin() bool { return a.Role == hmodel.RoleTenantAdmin }

// CanFinance 是否可查看财务数据（管理员或财务成员）。
func (a *Actor) CanFinance() bool {
	return a.Role == hmodel.RoleTenantAdmin || a.Role == hmodel.RoleTenantFinance
}

// CanUseProject 成员是否被授权使用该项目（管理员默认可用全部项目）。
func (a *Actor) CanUseProject(projectId int64) bool {
	var p hmodel.Project
	if DB().Where("id = ? AND tenant_id = ?", projectId, a.TenantId).First(&p).Error != nil {
		return false
	}
	if a.IsAdmin() {
		return true
	}
	var cnt int64
	DB().Model(&hmodel.ProjectMember{}).Where("project_id = ? AND user_id = ?", projectId, a.UserId).Count(&cnt)
	return cnt > 0
}

// ===================== 成员与项目（FR02） =====================

// AddMember 企业管理员按用户名添加成员（被邀请人需先注册 New API 账号）。
func AddMember(a *Actor, username, role string) (*hmodel.Member, error) {
	if !a.IsAdmin() {
		return nil, ErrForbidden("仅企业管理员可管理成员")
	}
	if role != hmodel.RoleTenantAdmin && role != hmodel.RoleTenantMember && role != hmodel.RoleTenantFinance {
		return nil, ErrInvalid("角色无效")
	}
	var u model.User
	if err := model.DB.Where("username = ?", username).First(&u).Error; err != nil {
		return nil, ErrInvalid("用户不存在，请先注册")
	}
	var other int64
	DB().Model(&hmodel.Member{}).Where("user_id = ? AND status = 1 AND tenant_id <> ?", u.Id, a.TenantId).Count(&other)
	if other > 0 {
		return nil, ErrInvalid("该用户已属于其他企业")
	}
	m := hmodel.Member{TenantId: a.TenantId, UserId: u.Id}
	DB().Where(m).FirstOrInit(&m)
	m.Role, m.Status = role, 1
	if err := DB().Save(&m).Error; err != nil {
		return nil, err
	}
	Audit(a.UserId, a.TenantId, "member.add", username, role, "")
	return &m, nil
}

// RemoveMember 移除成员：撤销其项目授权、会话及个人密钥；企业级服务密钥不受影响。
func RemoveMember(a *Actor, memberUserId int) error {
	if !a.IsAdmin() {
		return ErrForbidden("仅企业管理员可管理成员")
	}
	if memberUserId == a.UserId {
		return ErrInvalid("不能移除自己")
	}
	return DB().Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&hmodel.Member{}).Where("tenant_id = ? AND user_id = ?", a.TenantId, memberUserId).Update("status", 2)
		if res.RowsAffected == 0 {
			return ErrInvalid("成员不存在")
		}
		var pids []int64
		tx.Model(&hmodel.Project{}).Where("tenant_id = ?", a.TenantId).Pluck("id", &pids)
		tx.Where("project_id IN ? AND user_id = ?", pids, memberUserId).Delete(&hmodel.ProjectMember{})
		var keys []hmodel.PlatformKey
		tx.Where("tenant_id = ? AND owner_user_id = ? AND status <> ?", a.TenantId, memberUserId, hmodel.KeyStatusRevoked).Find(&keys)
		for i := range keys {
			revokeKeyTx(tx, &keys[i])
		}
		tx.Model(&hmodel.Session{}).Where("tenant_id = ? AND user_id = ?", a.TenantId, memberUserId).Update("deleted", true)
		Audit(a.UserId, a.TenantId, "member.remove", fmt.Sprint(memberUserId), "", "")
		return nil
	})
}

// SaveProject 新建或修改项目（预算、白名单、默认路由策略等）。
func SaveProject(a *Actor, p *hmodel.Project) error {
	if !a.IsAdmin() {
		return ErrForbidden("仅企业管理员可管理项目")
	}
	if p.DefaultRouteMode != "" && p.DefaultRouteMode != "fixed" && p.DefaultRouteMode != "scene" && p.DefaultRouteMode != "session" {
		return ErrInvalid("默认路由模式无效")
	}
	p.TenantId = a.TenantId
	if p.Id > 0 {
		var old hmodel.Project
		if DB().Where("id = ? AND tenant_id = ?", p.Id, a.TenantId).First(&old).Error != nil {
			return ErrForbidden("项目不存在")
		}
		p.IsDefault, p.CreatedAt = old.IsDefault, old.CreatedAt
	} else {
		p.Status = 1
	}
	Audit(a.UserId, a.TenantId, "project.save", p.Name, fmt.Sprintf("daily=%d monthly=%d percall=%d", p.DailyBudget, p.MonthlyBudget, p.MaxCostPerCall), "")
	return DB().Save(p).Error
}

// SetProjectMembers 设置项目成员（必须是本企业成员）。
func SetProjectMembers(a *Actor, projectId int64, userIds []int) error {
	if !a.IsAdmin() {
		return ErrForbidden("仅企业管理员可管理项目")
	}
	if !a.CanUseProject(projectId) {
		return ErrForbidden("项目不存在")
	}
	return DB().Transaction(func(tx *gorm.DB) error {
		tx.Where("project_id = ?", projectId).Delete(&hmodel.ProjectMember{})
		for _, uid := range userIds {
			var cnt int64
			tx.Model(&hmodel.Member{}).Where("tenant_id = ? AND user_id = ? AND status = 1", a.TenantId, uid).Count(&cnt)
			if cnt == 0 {
				return ErrInvalid(fmt.Sprintf("用户 %d 不是本企业成员", uid))
			}
			if err := tx.Create(&hmodel.ProjectMember{ProjectId: projectId, UserId: uid}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// SetTenantStatus 平台运营停用/启用租户（停用后入口拒绝新请求）。
func SetTenantStatus(operator int, tenantId int64, status string) error {
	if status != hmodel.TenantStatusEnabled && status != hmodel.TenantStatusDisabled {
		return ErrInvalid("状态无效")
	}
	Audit(operator, tenantId, "tenant.status", fmt.Sprint(tenantId), status, "")
	return DB().Model(&hmodel.Tenant{}).Where("id = ?", tenantId).Update("status", status).Error
}

// WalletQuota 读取企业钱包余额（New API 为事实源）。
func WalletQuota(t *hmodel.Tenant) int {
	if t.NewapiUserId == 0 {
		return 0
	}
	q, err := model.GetUserQuota(t.NewapiUserId, true)
	if err != nil {
		return 0
	}
	return q
}
