package hservice

import (
	"fmt"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ===================== 充值、退款、补偿与对账（FR11/FR12/FR17/FR18） =====================
// 原则：New API 用户钱包额度是唯一扣费事实源；平台每一次额度变动都写唯一业务号的流水，
// 依靠唯一索引保证回调重复、人工重试都只入账一次。

// 订单/退款状态
const (
	OrderPending  = "pending"  // 待支付/待审批
	OrderCredited = "credited" // 已入账
	OrderClosed   = "closed"   // 已关闭
	RefundApplied = "applied"  // 已申请
	RefundLocked  = "locked"   // 已锁定额度（等待外部退款）
	RefundDone    = "done"     // 已完成
	RefundFailed  = "failed"   // 失败（额度已解锁）
	RefundReject  = "rejected" // 驳回
)

// CreateRecharge 新建充值订单：pay 为线下/第三方支付待确认；grant 为审批发放（不计收入）。
func CreateRecharge(operator int, tenantId int64, amountFen int64, kind, payChannel, voucher, remark string) (*hmodel.RechargeOrder, error) {
	if amountFen <= 0 {
		return nil, ErrInvalid("金额必须大于 0")
	}
	if kind != "pay" && kind != "grant" {
		return nil, ErrInvalid("类型仅支持 pay/grant")
	}
	if kind == "grant" && voucher == "" {
		return nil, ErrInvalid("发放额度必须提供审批凭证")
	}
	o := &hmodel.RechargeOrder{OrderNo: NewBizNo("RC"), TenantId: tenantId, Amount: amountFen, Quota: FenToQuota(amountFen),
		Kind: kind, PayChannel: payChannel, Voucher: voucher, Remark: remark, Status: OrderPending, CreatedBy: operator}
	if err := DB().Create(o).Error; err != nil {
		return nil, err
	}
	Audit(operator, tenantId, "recharge.create", o.OrderNo, fmt.Sprintf("%s %d", kind, amountFen), "")
	return o, nil
}

// ConfirmRecharge 确认入账：支付单需第三方交易号且金额一致；发放单需另一名人员审批（双人复核）。
// 重复调用（回调重放）返回原结果，不重复加额度。
func ConfirmRecharge(operator int, orderNo, tradeNo string, paidFen int64) (*hmodel.RechargeOrder, error) {
	var o hmodel.RechargeOrder
	if DB().Where("order_no = ?", orderNo).First(&o).Error != nil {
		return nil, ErrInvalid("订单不存在")
	}
	if o.Status == OrderCredited {
		return &o, nil
	}
	if o.Status != OrderPending {
		return nil, ErrInvalid("订单状态不可入账")
	}
	if o.Kind == "pay" {
		if tradeNo == "" || paidFen != o.Amount {
			return nil, ErrInvalid("交易号缺失或金额不一致")
		}
		var dup int64
		DB().Model(&hmodel.RechargeOrder{}).Where("trade_no = ? AND id <> ?", tradeNo, o.Id).Count(&dup)
		if dup > 0 {
			return nil, ErrConflict("第三方交易号已被其它订单使用")
		}
	} else if operator == o.CreatedBy {
		return nil, ErrForbidden("发放额度需由另一名人员审批")
	}
	var t hmodel.Tenant
	if DB().First(&t, o.TenantId).Error != nil || t.NewapiUserId == 0 {
		return nil, ErrInvalid("企业钱包未就绪")
	}
	kind := "credit"
	if o.Kind == "grant" {
		kind = "grant"
	}
	if err := applyWallet(t.Id, t.NewapiUserId, "credit:"+o.OrderNo, kind, o.Quota, o.Amount, o.Remark); err != nil {
		return nil, err
	}
	DB().Model(&o).Updates(map[string]any{"status": OrderCredited, "trade_no": tradeNo, "approved_by": operator, "credited_at": Now()})
	Audit(operator, o.TenantId, "recharge.credit", o.OrderNo, fmt.Sprint(o.Amount), "")
	DB().First(&o, o.Id)
	return &o, nil
}

// applyWallet 带唯一业务号的钱包变动：先写流水占号（重复则视为已处理），再改 New API 额度；改额度失败回滚流水。
func applyWallet(tenantId int64, userId int, bizNo, kind string, quota int, amount int64, remark string) error {
	le := &hmodel.LedgerEntry{BizNo: bizNo, TenantId: tenantId, Kind: kind, Quota: quota, Amount: amount, Remark: remark}
	res := DB().Clauses(clause.OnConflict{DoNothing: true}).Create(le)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return nil // 已处理
	}
	var err error
	if quota >= 0 {
		err = model.IncreaseUserQuota(userId, quota, true)
	} else {
		var ok bool
		ok, err = model.TryReserveUserQuota(userId, -quota)
		if err == nil && !ok {
			err = ErrQuota("钱包可用余额不足")
		}
	}
	if err != nil {
		DB().Delete(le)
		RaiseAlert("wallet", "critical", tenantId, "wallet:"+bizNo, bizNo, "钱包额度变动失败："+err.Error())
		return err
	}
	return nil
}

// ApplyRefund 企业财务/管理员申请退回未使用充值（只退支付单，赠送额度不可退现）。
func ApplyRefund(a *Actor, orderNo string, amountFen int64, reason string) (*hmodel.Refund, error) {
	if !a.CanFinance() {
		return nil, ErrForbidden("无财务权限")
	}
	var o hmodel.RechargeOrder
	if DB().Where("order_no = ? AND tenant_id = ?", orderNo, a.TenantId).First(&o).Error != nil || o.Status != OrderCredited || o.Kind != "pay" {
		return nil, ErrInvalid("仅已入账的支付订单可退款")
	}
	if amountFen <= 0 || amountFen > o.Amount-o.RefundedAmount {
		return nil, ErrInvalid("退款金额超过可退金额")
	}
	if QuotaToFen(WalletQuota(a.Tenant)) < amountFen {
		return nil, ErrQuota("钱包可用余额不足以退款")
	}
	r := &hmodel.Refund{RefundNo: NewBizNo("RF"), TenantId: a.TenantId, Kind: "recharge_refund", OrderNo: orderNo, Amount: amountFen,
		Quota: FenToQuota(amountFen), Reason: reason, Status: RefundApplied, ApplyBy: a.UserId}
	if err := DB().Create(r).Error; err != nil {
		return nil, err
	}
	Audit(a.UserId, a.TenantId, "refund.apply", r.RefundNo, fmt.Sprint(amountFen), "")
	return r, nil
}

// ApplyCompensation 运营/财务对异常调用发起补偿（冲正），需另一人审核后入账。
func ApplyCompensation(operator int, requestId string, amountFen int64, reason string) (*hmodel.Refund, error) {
	var req hmodel.Request
	if DB().Where("request_id = ?", requestId).First(&req).Error != nil {
		return nil, ErrInvalid("原调用记录不存在")
	}
	var done int64
	DB().Model(&hmodel.Refund{}).Where("request_id = ? AND status IN ?", requestId, []string{RefundApplied, RefundDone}).Select("COALESCE(SUM(amount),0)").Scan(&done)
	if amountFen <= 0 || done+amountFen > req.NetCost {
		return nil, ErrInvalid("补偿金额超过该调用实际费用")
	}
	r := &hmodel.Refund{RefundNo: NewBizNo("CP"), TenantId: req.TenantId, Kind: "compensation", RequestId: requestId, Amount: amountFen,
		Quota: FenToQuota(amountFen), Reason: reason, Status: RefundApplied, ApplyBy: operator}
	if err := DB().Create(r).Error; err != nil {
		return nil, err
	}
	Audit(operator, req.TenantId, "compensation.apply", r.RefundNo, requestId, "")
	return r, nil
}

// ReviewRefund 平台财务审核：通过后退款先锁定额度；补偿直接入账。
func ReviewRefund(operator int, refundNo string, approve bool, remark string) (*hmodel.Refund, error) {
	var r hmodel.Refund
	if DB().Where("refund_no = ?", refundNo).First(&r).Error != nil {
		return nil, ErrInvalid("退款单不存在")
	}
	if r.Status != RefundApplied {
		return &r, nil
	}
	if r.ApplyBy == operator {
		return nil, ErrForbidden("申请人不能审核自己的申请")
	}
	var t hmodel.Tenant
	DB().First(&t, r.TenantId)
	if !approve {
		DB().Model(&r).Updates(map[string]any{"status": RefundReject, "review_by": operator})
		Audit(operator, r.TenantId, "refund.reject", r.RefundNo, remark, "")
		return &r, nil
	}
	if r.Kind == "compensation" {
		if err := applyWallet(t.Id, t.NewapiUserId, "compensate:"+r.RefundNo, "compensate", r.Quota, r.Amount, r.Reason); err != nil {
			return nil, err
		}
		DB().Model(&r).Updates(map[string]any{"status": RefundDone, "review_by": operator})
	} else {
		if err := applyWallet(t.Id, t.NewapiUserId, "lock:"+r.RefundNo, "lock", -r.Quota, -r.Amount, r.Reason); err != nil {
			return nil, err
		}
		DB().Model(&r).Updates(map[string]any{"status": RefundLocked, "review_by": operator})
	}
	Audit(operator, r.TenantId, "refund.approve", r.RefundNo, remark, "")
	DB().First(&r, r.Id)
	return &r, nil
}

// FinishRefund 外部退款结果回写：成功则完成并累加订单已退金额；失败则解锁额度并告警。
func FinishRefund(operator int, refundNo, externalNo string, success bool) (*hmodel.Refund, error) {
	var r hmodel.Refund
	if DB().Where("refund_no = ?", refundNo).First(&r).Error != nil {
		return nil, ErrInvalid("退款单不存在")
	}
	if r.Status != RefundLocked {
		return &r, nil
	}
	if success {
		err := DB().Transaction(func(tx *gorm.DB) error {
			res := tx.Model(&r).Where("status = ?", RefundLocked).Updates(map[string]any{"status": RefundDone, "external_no": externalNo})
			if res.RowsAffected == 0 {
				return nil
			}
			return tx.Model(&hmodel.RechargeOrder{}).Where("order_no = ?", r.OrderNo).Update("refunded_amount", gorm.Expr("refunded_amount + ?", r.Amount)).Error
		})
		if err != nil {
			return nil, err
		}
	} else {
		var t hmodel.Tenant
		DB().First(&t, r.TenantId)
		if err := applyWallet(t.Id, t.NewapiUserId, "unlock:"+r.RefundNo, "unlock", r.Quota, r.Amount, "退款失败解锁"); err != nil {
			return nil, err
		}
		DB().Model(&r).Update("status", RefundFailed)
		RaiseAlert("refund_fail", "warning", r.TenantId, "refund:"+r.RefundNo, r.RefundNo, "外部退款失败，额度已解锁")
	}
	Audit(operator, r.TenantId, "refund.finish", r.RefundNo, fmt.Sprintf("success=%v", success), "")
	DB().First(&r, r.Id)
	return &r, nil
}

// RunWalletRecon 钱包对账：期望余额 = 平台流水合计 − New API 消费日志合计；与 New API 实际余额比对。
// 差异只记录待处理，不自动改账。
func RunWalletRecon() string {
	batch := NewBizNo("RB")
	var ts []hmodel.Tenant
	DB().Where("newapi_user_id > 0").Find(&ts)
	for _, t := range ts {
		var ledger int64
		DB().Model(&hmodel.LedgerEntry{}).Where("tenant_id = ?", t.Id).Select("COALESCE(SUM(quota),0)").Scan(&ledger)
		var consumed int64
		model.LOG_DB.Model(&model.Log{}).Where("user_id = ? AND type = ?", t.NewapiUserId, model.LogTypeConsume).Select("COALESCE(SUM(quota),0)").Scan(&consumed)
		actual, _ := model.GetUserQuota(t.NewapiUserId, true)
		expected := ledger - consumed
		if expected != int64(actual) {
			d := hmodel.ReconDiff{BatchNo: batch, Kind: "wallet", RefNo: fmt.Sprintf("tenant:%d", t.Id), DiffKey: batch,
				Expected: QuotaToFen(int(expected)), Actual: QuotaToFen(actual), Status: "open",
				Detail: fmt.Sprintf("流水额度 %d − 消费 %d ≠ 钱包 %d", ledger, consumed, actual)}
			DB().Create(&d)
			RaiseAlert("recon", "warning", t.Id, "recon:wallet:"+batch+fmt.Sprint(t.Id), d.RefNo, "钱包余额对账存在差异")
		}
	}
	return batch
}
