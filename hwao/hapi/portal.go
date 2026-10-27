package hapi

import (
	"io"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ===================== 用户端接口（/platform/*，New API 登录态） =====================

// ok 成功响应 {success:true,data}（与 New API 前端约定一致）。
func ok(c *gin.Context, data any) { c.JSON(200, gin.H{"success": true, "message": "", "data": data}) }

// fail 业务错误也返回结构化错误码，便于前端提示。
func fail(c *gin.Context, err error) { writeErr(c, err, "") }

func idParam(c *gin.Context) int64 { v, _ := strconv.ParseInt(c.Param("id"), 10, 64); return v }

// page 分页参数（p 从 1 开始，size 上限 100）。
func page(c *gin.Context, q *gorm.DB, out any) (int64, error) {
	p, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	if p < 1 {
		p = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	var total int64
	q.Count(&total)
	return total, q.Order("id desc").Offset((p - 1) * size).Limit(size).Find(out).Error
}

// actor 取当前登录用户的企业身份。
func actor(c *gin.Context) (*hservice.Actor, bool) {
	a, err := hservice.GetActor(c.GetInt("id"))
	if err != nil {
		fail(c, err)
		return nil, false
	}
	return a, true
}

func me(c *gin.Context) {
	a, err := hservice.GetActor(c.GetInt("id"))
	if err != nil {
		ok(c, gin.H{"user_id": c.GetInt("id"), "tenant": nil, "is_staff": c.GetInt("role") >= 10})
		return
	}
	ok(c, gin.H{"user_id": a.UserId, "tenant": a.Tenant, "role": a.Role, "is_staff": c.GetInt("role") >= 10,
		"balance_fen": hservice.QuotaToFen(hservice.WalletQuota(a.Tenant))})
}

func openTenant(c *gin.Context) {
	var req hservice.OpenTenantReq
	if c.ShouldBindJSON(&req) != nil {
		fail(c, hservice.ErrInvalid("参数错误"))
		return
	}
	t, err := hservice.OpenTenant(c.GetInt("id"), req)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, t)
}

func listProjects(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var ps []hmodel.Project
	hservice.DB().Where("tenant_id = ?", a.TenantId).Find(&ps)
	out := []hmodel.Project{}
	for _, p := range ps {
		if a.CanUseProject(p.Id) {
			out = append(out, p)
		}
	}
	ok(c, out)
}

func saveProject(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var p hmodel.Project
	if c.ShouldBindJSON(&p) != nil {
		fail(c, hservice.ErrInvalid("参数错误"))
		return
	}
	if id := idParam(c); id > 0 {
		p.Id = id
	}
	if err := hservice.SaveProject(a, &p); err != nil {
		fail(c, err)
		return
	}
	ok(c, p)
}

func setProjectMembers(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req struct {
		UserIds []int `json:"user_ids"`
	}
	c.ShouldBindJSON(&req)
	if err := hservice.SetProjectMembers(a, idParam(c), req.UserIds); err != nil {
		fail(c, err)
		return
	}
	ok(c, nil)
}

// addProjectMember 追加单个项目成员。
func addProjectMember(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req struct {
		UserId int `json:"user_id"`
	}
	c.ShouldBindJSON(&req)
	reply(c, nil, hservice.AddProjectMember(a, idParam(c), req.UserId))
}

func listMembers(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	type row struct {
		hmodel.Member
		Username string `json:"username"`
	}
	var rows []row
	hservice.DB().Table("hwao_member m").Select("m.*, u.username").Joins("left join users u on u.id = m.user_id").
		Where("m.tenant_id = ? AND m.status = 1", a.TenantId).Scan(&rows)
	ok(c, rows)
}

func addMember(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	c.ShouldBindJSON(&req)
	m, err := hservice.AddMember(a, req.Username, req.Role)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, m)
}

func removeMember(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	if err := hservice.RemoveMember(a, int(idParam(c))); err != nil {
		fail(c, err)
		return
	}
	ok(c, nil)
}

func listKeys(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	q := hservice.DB().Where("tenant_id = ? AND name <> ?", a.TenantId, hservice.WorkbenchKeyName)
	if !a.IsAdmin() {
		q = q.Where("owner_user_id = ?", a.UserId)
	}
	var ks []hmodel.PlatformKey
	q.Order("id desc").Find(&ks)
	ok(c, ks)
}

func createKey(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req hservice.CreateKeyReq
	c.ShouldBindJSON(&req)
	k, err := hservice.CreateKey(a, req)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, k) // 完整密钥只返回这一次
}

func keyAction(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	id := idParam(c)
	var err error
	var data any
	switch c.Param("action") {
	case "enable":
		err = hservice.SetKeyEnabled(a, id, true)
	case "disable":
		err = hservice.SetKeyEnabled(a, id, false)
	case "revoke":
		err = hservice.RevokeKey(a, id)
	case "rotate":
		grace, _ := strconv.ParseInt(c.DefaultQuery("grace", "86400"), 10, 64)
		data, err = hservice.RotateKey(a, id, grace)
	default:
		err = hservice.ErrInvalid("未知操作")
	}
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, data)
}

// listCatalog 用户可见的场景与可售模型（含当前公开价格）。
func listCatalog(c *gin.Context) {
	var ss []hmodel.Scene
	hservice.DB().Where("status = ?", hmodel.ScenePublished).Find(&ss)
	var ms []hmodel.CatalogModel
	hservice.DB().Where("status = ?", hmodel.ModelOnSale).Find(&ms)
	tid := int64(0)
	if a, err := hservice.GetActor(c.GetInt("id")); err == nil {
		tid = a.TenantId
	}
	models := []gin.H{}
	for _, m := range ms {
		models = append(models, gin.H{"model": m, "price": hservice.CurrentPrice(m.ModelName, tid, hservice.Now())})
	}
	scenes := []gin.H{}
	for _, s := range ss {
		_, v, _ := hservice.ActiveSceneVersion(s.SceneId, tid)
		item := gin.H{"scene": s}
		if v != nil {
			item["version"] = gin.H{"version": v.Version, "output_format": v.OutputFormat, "input_template": v.InputTemplate,
				"default_max_cost": v.DefaultMaxCost, "has_fallback": v.HasFallback, "scope": v.Scope}
		}
		scenes = append(scenes, item)
	}
	ok(c, gin.H{"scenes": scenes, "models": models})
}

// requestView 对客户隐藏渠道等内部字段。
func requestView(r *hmodel.Request, staff bool) gin.H {
	h := gin.H{"request_id": r.RequestId, "project_id": r.ProjectId, "source": r.Source, "scene_id": r.SceneId, "route_mode": r.RouteMode,
		"session_id": r.SessionId, "requested_model": r.RequestedModel, "actual_model": r.ActualModel, "policy_version": r.PolicyVersion,
		"route_reason": r.RouteReason, "is_stream": r.IsStream, "estimated_cost_fen": r.EstimatedCost, "net_cost_fen": r.NetCost,
		"prompt_tokens": r.PromptTokens, "completion_tokens": r.CompletionTokens, "status": r.Status, "billing_status": r.BillingStatus,
		"error_code": r.ErrorCode, "error_message": r.ErrorMessage, "fallback": r.Fallback, "fallback_reason": r.FallbackReason,
		"first_byte_ms": r.FirstByteMs, "latency_ms": r.LatencyMs, "created_at": r.CreatedAt, "finished_at": r.FinishedAt}
	if staff {
		var atts []hmodel.Attempt
		hservice.DB().Where("request_id = ?", r.RequestId).Find(&atts)
		h["attempts"] = atts
		h["purchase_cost_fen"] = r.PurchaseCost
		h["newapi_quota"] = r.NewapiQuota
		h["tenant_id"] = r.TenantId
	}
	return h
}

// getRequest GET /platform/requests/:id —— 平台密钥（Bearer hwk-）或登录用户均可查询本企业请求。
func getRequest(c *gin.Context) {
	rid := c.Param("id")
	var r hmodel.Request
	if hservice.DB().Where("request_id = ?", rid).First(&r).Error != nil {
		fail(c, hservice.ErrInvalid("请求不存在"))
		return
	}
	if auth := c.GetHeader("Authorization"); strings.HasPrefix(auth, "Bearer "+hservice.PlatformKeyPrefix) {
		k, err := hservice.AuthKey(strings.TrimPrefix(auth, "Bearer "), c.ClientIP())
		if err != nil || k.TenantId != r.TenantId {
			fail(c, hservice.ErrForbidden("无权查看该请求"))
			return
		}
		ok(c, requestView(&r, false))
		return
	}
	userAuthThen(c, func() {
		if c.GetInt("role") >= 10 {
			ok(c, requestView(&r, true))
			return
		}
		a, okk := actor(c)
		if !okk {
			return
		}
		if a.TenantId != r.TenantId || (!a.IsAdmin() && !a.CanFinance() && r.UserId != a.UserId && !a.CanUseProject(r.ProjectId)) {
			fail(c, hservice.ErrForbidden("无权查看该请求"))
			return
		}
		ok(c, requestView(&r, false))
	})
}

func listRequests(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	q := hservice.DB().Model(&hmodel.Request{}).Where("tenant_id = ?", a.TenantId)
	if !a.IsAdmin() && !a.CanFinance() {
		q = q.Where("user_id = ? OR key_id IN (?)", a.UserId, hservice.DB().Model(&hmodel.PlatformKey{}).Select("id").Where("owner_user_id = ?", a.UserId))
	}
	for _, f := range []string{"project_id", "scene_id", "status", "billing_status", "route_mode", "actual_model", "request_id", "session_id"} {
		if v := c.Query(f); v != "" {
			q = q.Where(f+" = ?", v)
		}
	}
	if v := c.Query("from"); v != "" {
		q = q.Where("created_at >= ?", v)
	}
	if v := c.Query("to"); v != "" {
		q = q.Where("created_at <= ?", v)
	}
	var rs []hmodel.Request
	total, _ := page(c, q, &rs)
	items := []gin.H{}
	for i := range rs {
		items = append(items, requestView(&rs[i], false))
	}
	ok(c, gin.H{"items": items, "total": total})
}

// workbenchChat 网页工作台调用：与 API 走同一链路与计费，使用项目工作台服务密钥。
func workbenchChat(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	pid, _ := strconv.ParseInt(c.Query("project_id"), 10, 64)
	if pid == 0 || !a.CanUseProject(pid) {
		fail(c, hservice.ErrForbidden("无权使用该项目"))
		return
	}
	if a.Tenant.Status != hmodel.TenantStatusEnabled {
		fail(c, hservice.ErrForbidden("企业未启用"))
		return
	}
	var p hmodel.Project
	hservice.DB().First(&p, pid)
	body, _ := io.ReadAll(c.Request.Body)
	opt := ChatOptions{Source: "web", UserId: a.UserId, RouteMode: c.GetHeader("X-Route-Mode"), SessionId: c.GetHeader("X-Session-Id"),
		IdemKey: c.GetHeader("Idempotency-Key")}
	if v := c.GetHeader("X-Max-Cost-CNY"); v != "" {
		f, _ := strconv.ParseFloat(v, 64)
		opt.MaxCostFen = maxCostFen(f)
	}
	RunChat(c, nil, a.Tenant, &p, opt, body)
}

func listSessions(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var ss []hmodel.Session
	hservice.DB().Where("tenant_id = ? AND user_id = ? AND deleted = ?", a.TenantId, a.UserId, false).Order("updated_at desc").Limit(100).Find(&ss)
	ok(c, ss)
}

func sessionMessages(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var s hmodel.Session
	if hservice.DB().Where("session_id = ? AND tenant_id = ? AND user_id = ?", c.Param("sid"), a.TenantId, a.UserId).First(&s).Error != nil {
		fail(c, hservice.ErrInvalid("会话不存在"))
		return
	}
	if c.Request.Method == "DELETE" {
		// 删除对话正文不删除请求与账务记录
		hservice.DB().Model(&s).Update("deleted", true)
		hservice.DB().Where("session_id = ?", s.SessionId).Delete(&hmodel.SessionMessage{})
		ok(c, nil)
		return
	}
	var ms []hmodel.SessionMessage
	hservice.DB().Where("session_id = ?", s.SessionId).Order("id").Find(&ms)
	ok(c, gin.H{"session": s, "messages": ms})
}

// budgets 预算概览：企业与各项目的日/月已用、占用与上限。
func budgets(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	d, m := hservice.Periods()
	get := func(scope, period string) hmodel.BudgetCounter {
		var bc hmodel.BudgetCounter
		hservice.DB().Where("scope = ? AND period = ?", scope, period).First(&bc)
		return bc
	}
	t := a.Tenant
	out := gin.H{"tenant": gin.H{"daily_budget": t.DailyBudget, "monthly_budget": t.MonthlyBudget, "max_concurrency": t.MaxConcurrency,
		"alert_thresholds": t.AlertThresholds, "day": get("t:"+strconv.FormatInt(t.Id, 10), d), "month": get("t:"+strconv.FormatInt(t.Id, 10), m)}}
	var ps []hmodel.Project
	hservice.DB().Where("tenant_id = ?", t.Id).Find(&ps)
	items := []gin.H{}
	for _, p := range ps {
		s := "p:" + strconv.FormatInt(p.Id, 10)
		items = append(items, gin.H{"project": p, "day": get(s, d), "month": get(s, m)})
	}
	out["projects"] = items
	ok(c, out)
}

func saveTenantBudget(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	if !a.IsAdmin() {
		fail(c, hservice.ErrForbidden("仅管理员可设置预算"))
		return
	}
	var req struct {
		DailyBudget     int64  `json:"daily_budget"`
		MonthlyBudget   int64  `json:"monthly_budget"`
		MaxConcurrency  int    `json:"max_concurrency"`
		AlertThresholds string `json:"alert_thresholds"`
	}
	c.ShouldBindJSON(&req)
	hservice.DB().Model(a.Tenant).Updates(map[string]any{"daily_budget": req.DailyBudget, "monthly_budget": req.MonthlyBudget,
		"max_concurrency": req.MaxConcurrency, "alert_thresholds": req.AlertThresholds})
	hservice.Audit(a.UserId, a.TenantId, "budget.tenant", "", "", c.ClientIP())
	ok(c, nil)
}

func billingOverview(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	if !a.CanFinance() {
		fail(c, hservice.ErrForbidden("无财务权限"))
		return
	}
	var orders []hmodel.RechargeOrder
	hservice.DB().Where("tenant_id = ?", a.TenantId).Order("id desc").Limit(100).Find(&orders)
	var ledger []hmodel.LedgerEntry
	hservice.DB().Where("tenant_id = ?", a.TenantId).Order("id desc").Limit(100).Find(&ledger)
	var refunds []hmodel.Refund
	hservice.DB().Where("tenant_id = ?", a.TenantId).Order("id desc").Limit(100).Find(&refunds)
	var monthCost int64
	_, m := hservice.Periods()
	var bc hmodel.BudgetCounter
	if hservice.DB().Where("scope = ? AND period = ?", "t:"+strconv.FormatInt(a.TenantId, 10), m).First(&bc).Error == nil {
		monthCost = bc.Used
	}
	ok(c, gin.H{"balance_fen": hservice.QuotaToFen(hservice.WalletQuota(a.Tenant)), "month_cost_fen": monthCost,
		"orders": orders, "ledger": ledger, "refunds": refunds})
}

func applyRefund(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req struct {
		OrderNo string `json:"order_no"`
		Amount  int64  `json:"amount"`
		Reason  string `json:"reason"`
	}
	c.ShouldBindJSON(&req)
	r, err := hservice.ApplyRefund(a, req.OrderNo, req.Amount, req.Reason)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, r)
}

func submitFeedback(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var f hmodel.Feedback
	c.ShouldBindJSON(&f)
	var r hmodel.Request
	if hservice.DB().Where("request_id = ? AND tenant_id = ?", f.RequestId, a.TenantId).First(&r).Error != nil {
		fail(c, hservice.ErrInvalid("请求不存在"))
		return
	}
	f.Id, f.TenantId, f.UserId, f.SceneId = 0, a.TenantId, a.UserId, r.SceneId
	hservice.DB().Create(&f)
	ok(c, f)
}

// overview 用户端首页统计：今日/本月调用量、费用、成功率与按场景分布。
func overview(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	ok(c, statsFor(a.TenantId, hservice.Now()-30*86400))
}

// statsFor 汇总统计（tenantId=0 表示全平台）。
func statsFor(tenantId int64, since int64) gin.H {
	q := func() *gorm.DB {
		d := hservice.DB().Model(&hmodel.Request{}).Where("created_at >= ?", since)
		if tenantId > 0 {
			d = d.Where("tenant_id = ?", tenantId)
		}
		return d
	}
	var total, okCnt, fb int64
	var cost, purchase int64
	q().Count(&total)
	q().Where("status = ?", hmodel.ReqSucceeded).Count(&okCnt)
	q().Where("fallback = ?", true).Count(&fb)
	q().Select("COALESCE(SUM(net_cost),0)").Scan(&cost)
	q().Select("COALESCE(SUM(purchase_cost),0)").Scan(&purchase)
	type grp struct {
		Key   string `json:"key"`
		Count int64  `json:"count"`
		Cost  int64  `json:"cost"`
	}
	var byScene, byModel, byDay []grp
	q().Select("scene_id as `key`, count(*) as count, COALESCE(SUM(net_cost),0) as cost").Group("scene_id").Scan(&byScene)
	q().Select("actual_model as `key`, count(*) as count, COALESCE(SUM(net_cost),0) as cost").Group("actual_model").Scan(&byModel)
	q().Select("FROM_UNIXTIME(created_at, '%Y-%m-%d') as `key`, count(*) as count, COALESCE(SUM(net_cost),0) as cost").Group("`key`").Order("`key`").Scan(&byDay)
	return gin.H{"total": total, "succeeded": okCnt, "fallback": fb, "cost_fen": cost, "purchase_fen": purchase,
		"by_scene": byScene, "by_model": byModel, "by_day": byDay}
}

// applyRecharge 企业财务/管理员提交对公转账充值申请（待入账），运营核对银行流水后在运营端确认入账。
// 前端不接触任何支付密钥；在线支付渠道接入前仅支持此线下流程。
func applyRecharge(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	if !a.CanFinance() {
		fail(c, hservice.ErrForbidden("无财务权限"))
		return
	}
	var req struct {
		Amount int64  `json:"amount"` // 分
		Remark string `json:"remark"`
	}
	c.ShouldBindJSON(&req)
	o, err := hservice.CreateRecharge(a.UserId, a.TenantId, req.Amount, "pay", "bank", "", req.Remark)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, o)
}
