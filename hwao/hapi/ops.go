package hapi

import (
	"strconv"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/gin-gonic/gin"
)

// ===================== 运营端接口（/platform/ops/*，New API 管理员） =====================
// 一期将 New API 管理员视为平台运营+财务；更细的岗位划分见 hwao_staff（待确认）。

func bind[T any](c *gin.Context) (*T, bool) {
	var v T
	if err := c.ShouldBindJSON(&v); err != nil {
		fail(c, hservice.ErrInvalid("参数错误："+err.Error()))
		return nil, false
	}
	return &v, true
}

func reply(c *gin.Context, data any, err error) {
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, data)
}

func opsOverview(c *gin.Context) {
	st := statsFor(0, hservice.Now()-30*86400)
	var tenants, openAlerts, pending int64
	hservice.DB().Model(&hmodel.Tenant{}).Count(&tenants)
	hservice.DB().Model(&hmodel.Alert{}).Where("status <> ?", "resolved").Count(&openAlerts)
	hservice.DB().Model(&hmodel.Request{}).Where("billing_status = ?", hmodel.BillPending).Count(&pending)
	st["tenants"], st["open_alerts"], st["pending_settle"] = tenants, openAlerts, pending
	ok(c, st)
}

func opsCreateInvite(c *gin.Context) {
	req, k := bind[struct {
		Remark    string `json:"remark"`
		ValidDays int    `json:"valid_days"`
	}](c)
	if !k {
		return
	}
	inv, err := hservice.CreateInvite(c.GetInt("id"), req.Remark, req.ValidDays)
	reply(c, inv, err)
}

func opsListInvites(c *gin.Context) {
	var is []hmodel.Invite
	total, _ := page(c, hservice.DB().Model(&hmodel.Invite{}), &is)
	ok(c, gin.H{"items": is, "total": total})
}

func opsListTenants(c *gin.Context) {
	q := hservice.DB().Model(&hmodel.Tenant{})
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	if v := c.Query("name"); v != "" {
		q = q.Where("name LIKE ?", "%"+v+"%")
	}
	var ts []hmodel.Tenant
	total, _ := page(c, q, &ts)
	items := []gin.H{}
	for i := range ts {
		items = append(items, gin.H{"tenant": ts[i], "balance_fen": hservice.QuotaToFen(hservice.WalletQuota(&ts[i]))})
	}
	ok(c, gin.H{"items": items, "total": total})
}

func opsTenantAction(c *gin.Context) {
	id := idParam(c)
	switch c.Param("action") {
	case "provision": // 钱包开通失败后人工重试（按开通业务号幂等）
		t, err := hservice.ProvisionWallet(id)
		reply(c, t, err)
	case "enable":
		reply(c, nil, hservice.SetTenantStatus(c.GetInt("id"), id, hmodel.TenantStatusEnabled))
	case "disable":
		reply(c, nil, hservice.SetTenantStatus(c.GetInt("id"), id, hmodel.TenantStatusDisabled))
	default:
		fail(c, hservice.ErrInvalid("未知操作"))
	}
}

func opsListModels(c *gin.Context) {
	var ms []hmodel.CatalogModel
	hservice.DB().Order("id").Find(&ms)
	items := []gin.H{}
	for _, m := range ms {
		items = append(items, gin.H{"model": m, "channels": hservice.ChannelCount(m.ModelName),
			"price": hservice.CurrentPrice(m.ModelName, 0, hservice.Now())})
	}
	ok(c, items)
}

func opsSaveModel(c *gin.Context) {
	m, k := bind[hmodel.CatalogModel](c)
	if !k {
		return
	}
	if id := idParam(c); id > 0 {
		m.Id = id
	}
	// 关联供应商时以供应商名称作为 vendor 展示
	if m.SupplierId > 0 {
		var s hmodel.Supplier
		if hservice.DB().First(&s, m.SupplierId).Error != nil {
			fail(c, hservice.ErrInvalid("供应商不存在"))
			return
		}
		m.Vendor = s.Name
	}
	reply(c, m, hservice.SaveModel(c.GetInt("id"), m))
}

func opsListPrices(c *gin.Context) {
	q := hservice.DB().Model(&hmodel.PriceVersion{})
	if v := c.Query("model_name"); v != "" {
		q = q.Where("model_name = ?", v)
	}
	var ps []hmodel.PriceVersion
	total, _ := page(c, q, &ps)
	ok(c, gin.H{"items": ps, "total": total})
}

func opsPublishPrice(c *gin.Context) {
	p, k := bind[hmodel.PriceVersion](c)
	if !k {
		return
	}
	reply(c, p, hservice.PublishPrice(c.GetInt("id"), p))
}

func opsListScenes(c *gin.Context) {
	var ss []hmodel.Scene
	hservice.DB().Order("scene_id").Find(&ss)
	items := []gin.H{}
	for _, s := range ss {
		var vs []hmodel.SceneVersion
		hservice.DB().Where("scene_id = ?", s.SceneId).Order("version desc").Find(&vs)
		var evals []hmodel.EvalResult
		hservice.DB().Where("scene_id = ?", s.SceneId).Order("id desc").Limit(20).Find(&evals)
		items = append(items, gin.H{"scene": s, "versions": vs, "evals": evals})
	}
	ok(c, items)
}

func opsSaveSceneVersion(c *gin.Context) {
	req, k := bind[struct {
		SceneId     string              `json:"scene_id"`
		Name        string              `json:"name"`
		Description string              `json:"description"`
		Version     hmodel.SceneVersion `json:"version"`
	}](c)
	if !k {
		return
	}
	if req.SceneId == "" || (req.Name == "" && !sceneExists(req.SceneId)) {
		fail(c, hservice.ErrInvalid("场景 ID 与名称必填"))
		return
	}
	if err := validateSceneVersion(&req.Version); err != nil {
		fail(c, err)
		return
	}
	reply(c, req.Version, hservice.SaveSceneVersion(c.GetInt("id"), req.SceneId, req.Name, req.Description, &req.Version))
}

func opsSceneAction(c *gin.Context) {
	op := c.GetInt("id")
	switch c.Param("action") {
	case "evaluated":
		reply(c, nil, hservice.MarkEvaluated(op, idParam(c)))
	case "publish":
		reply(c, nil, hservice.PublishScene(op, idParam(c), c.Query("reason")))
	case "rollback":
		reply(c, nil, hservice.RollbackScene(op, c.Param("id")))
	case "disable":
		reply(c, nil, hservice.SetSceneStatus(op, c.Param("id"), hmodel.SceneDisabled))
	case "enable":
		reply(c, nil, hservice.SetSceneStatus(op, c.Param("id"), hmodel.ScenePublished))
	default:
		fail(c, hservice.ErrInvalid("未知操作"))
	}
}

func opsAddEval(c *gin.Context) {
	e, k := bind[hmodel.EvalResult](c)
	if !k {
		return
	}
	e.Id = 0
	reply(c, e, hservice.DB().Create(e).Error)
}

func opsRecharge(c *gin.Context) {
	req, k := bind[struct {
		TenantId   int64  `json:"tenant_id"`
		Amount     int64  `json:"amount"`
		Kind       string `json:"kind"`
		PayChannel string `json:"pay_channel"`
		Voucher    string `json:"voucher"`
		Remark     string `json:"remark"`
	}](c)
	if !k {
		return
	}
	o, err := hservice.CreateRecharge(c.GetInt("id"), req.TenantId, req.Amount, req.Kind, req.PayChannel, req.Voucher, req.Remark)
	reply(c, o, err)
}

func opsConfirmRecharge(c *gin.Context) {
	req, k := bind[struct {
		TradeNo string `json:"trade_no"`
		Paid    int64  `json:"paid"`
	}](c)
	if !k {
		return
	}
	o, err := hservice.ConfirmRecharge(c.GetInt("id"), c.Param("no"), req.TradeNo, req.Paid)
	reply(c, o, err)
}

func opsFinance(c *gin.Context) {
	var orders []hmodel.RechargeOrder
	hservice.DB().Order("id desc").Limit(200).Find(&orders)
	var refunds []hmodel.Refund
	hservice.DB().Order("id desc").Limit(200).Find(&refunds)
	var diffs []hmodel.ReconDiff
	hservice.DB().Order("id desc").Limit(200).Find(&diffs)
	ok(c, gin.H{"orders": orders, "refunds": refunds, "diffs": diffs})
}

func opsCompensate(c *gin.Context) {
	req, k := bind[struct {
		RequestId string `json:"request_id"`
		Amount    int64  `json:"amount"`
		Reason    string `json:"reason"`
	}](c)
	if !k {
		return
	}
	r, err := hservice.ApplyCompensation(c.GetInt("id"), req.RequestId, req.Amount, req.Reason)
	reply(c, r, err)
}

func opsRefundAction(c *gin.Context) {
	no := c.Param("no")
	switch c.Param("action") {
	case "approve", "reject":
		r, err := hservice.ReviewRefund(c.GetInt("id"), no, c.Param("action") == "approve", c.Query("remark"))
		reply(c, r, err)
	case "success", "failed":
		r, err := hservice.FinishRefund(c.GetInt("id"), no, c.Query("external_no"), c.Param("action") == "success")
		reply(c, r, err)
	default:
		fail(c, hservice.ErrInvalid("未知操作"))
	}
}

func opsRunRecon(c *gin.Context) {
	ok(c, gin.H{"batch_no": hservice.RunWalletRecon(), "pending_settled": ReconPendingRequests()})
}

func opsResolveDiff(c *gin.Context) {
	hservice.DB().Model(&hmodel.ReconDiff{}).Where("id = ?", idParam(c)).Updates(map[string]any{"status": c.DefaultQuery("status", "resolved"), "handler": c.GetInt("id")})
	hservice.Audit(c.GetInt("id"), 0, "recon.resolve", strconv.FormatInt(idParam(c), 10), c.Query("status"), c.ClientIP())
	ok(c, nil)
}

func opsAlerts(c *gin.Context) {
	q := hservice.DB().Model(&hmodel.Alert{})
	if v := c.Query("status"); v != "" {
		q = q.Where("status = ?", v)
	}
	var as []hmodel.Alert
	total, _ := page(c, q, &as)
	ok(c, gin.H{"items": as, "total": total})
}

func opsAlertUpdate(c *gin.Context) {
	req, k := bind[struct {
		Status     string `json:"status"`
		Resolution string `json:"resolution"`
	}](c)
	if !k {
		return
	}
	hservice.DB().Model(&hmodel.Alert{}).Where("id = ?", idParam(c)).Updates(map[string]any{"status": req.Status, "resolution": req.Resolution, "owner": c.GetInt("id")})
	hservice.Audit(c.GetInt("id"), 0, "alert.update", strconv.FormatInt(idParam(c), 10), req.Status+" "+req.Resolution, c.ClientIP())
	ok(c, nil)
}

func opsAudit(c *gin.Context) {
	q := hservice.DB().Model(&hmodel.AuditLog{})
	for _, f := range []string{"action", "tenant_id", "user_id"} {
		if v := c.Query(f); v != "" {
			q = q.Where(f+" = ?", v)
		}
	}
	var ls []hmodel.AuditLog
	total, _ := page(c, q, &ls)
	ok(c, gin.H{"items": ls, "total": total})
}

func opsRequests(c *gin.Context) {
	q := hservice.DB().Model(&hmodel.Request{})
	for _, f := range []string{"tenant_id", "scene_id", "status", "billing_status", "actual_model", "request_id"} {
		if v := c.Query(f); v != "" {
			q = q.Where(f+" = ?", v)
		}
	}
	var rs []hmodel.Request
	total, _ := page(c, q, &rs)
	items := []gin.H{}
	for i := range rs {
		items = append(items, requestView(&rs[i], true))
	}
	ok(c, gin.H{"items": items, "total": total})
}

// sceneExists 判断场景是否已存在
func sceneExists(id string) bool {
	var n int64
	hservice.DB().Model(&hmodel.Scene{}).Where("scene_id = ?", id).Count(&n)
	return n > 0
}
