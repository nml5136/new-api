package hservice

import (
	"github.com/QuantumNous/new-api/common"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ===================== 企业钱包在线充值（易支付：微信 / 支付宝） =====================
// 复用 New API 已配置的易支付网关（PayAddress / EpayId / EpayKey），但订单、回调、入账全部走 hwao 侧：
// 订单写 hwao_recharge_order（kind=pay，pay_channel=epay_alipay / epay_wxpay），回调 /platform/epay/notify，
// 入账复用 applyWallet（唯一业务号流水 → 计入钱包对账）。与个人充值（/api/user/epay/notify）互不影响。

const (
	OrderExpired        = "expired" // 在线支付单超时未付
	OnlineOrderTTL      = 30 * 60   // 在线支付单有效期（秒）
	onlineChannelPrefix = "epay_"
)

// OnlinePayMethods 企业在线充值支持的支付方式（易支付 type → 中文名）。
var OnlinePayMethods = map[string]string{"alipay": "支付宝", "wxpay": "微信支付"}

// IsOnlineChannel 是否为在线支付渠道的订单。
func IsOnlineChannel(ch string) bool { return strings.HasPrefix(ch, onlineChannelPrefix) }

func epayClient() *epay.Client {
	if !operation_setting.IsPaymentComplianceConfirmed() || strings.TrimSpace(operation_setting.PayAddress) == "" ||
		strings.TrimSpace(operation_setting.EpayId) == "" || strings.TrimSpace(operation_setting.EpayKey) == "" {
		return nil
	}
	c, err := epay.NewClient(&epay.Config{PartnerID: operation_setting.EpayId, Key: operation_setting.EpayKey}, operation_setting.PayAddress)
	if err != nil {
		return nil
	}
	return c
}

// OnlinePayEnabled 运营是否已配置并启用易支付。
func OnlinePayEnabled() bool { return epayClient() != nil }

// CreateOnlineRecharge 企业管理员/财务发起在线充值：建 hwao 充值单并向易支付下单，返回网关地址与已签名表单参数。
func CreateOnlineRecharge(a *Actor, amountFen int64, method, ip string) (*hmodel.RechargeOrder, string, map[string]string, error) {
	if !a.CanFinance() {
		return nil, "", nil, ErrForbidden("仅企业管理员或财务可为企业充值")
	}
	if _, ok := OnlinePayMethods[method]; !ok {
		return nil, "", nil, ErrInvalid("不支持的支付方式")
	}
	if amountFen < 100 || amountFen > 100000000 {
		return nil, "", nil, ErrInvalid("单笔金额需在 1 元至 100 万元之间")
	}
	client := epayClient()
	if client == nil {
		return nil, "", nil, ErrInvalid("在线支付未开通，请使用对公转账")
	}
	o := &hmodel.RechargeOrder{OrderNo: NewBizNo("EP"), TenantId: a.TenantId, Amount: amountFen, Quota: FenToQuota(amountFen),
		Kind: "pay", PayChannel: onlineChannelPrefix + method, Status: OrderPending, CreatedBy: a.UserId, Remark: "在线充值·" + OnlinePayMethods[method]}
	if err := DB().Create(o).Error; err != nil {
		return nil, "", nil, err
	}
	notify, _ := url.Parse(strings.TrimRight(service.GetCallbackAddress(), "/") + "/platform/epay/notify")
	ret, _ := url.Parse(strings.TrimRight(system_setting.ServerAddress, "/") + "/app/billing?pay_return=" + o.OrderNo) // 易支付签名不允许参数值含 &，只用一个查询参数
	uri, params, err := client.Purchase(&epay.PurchaseArgs{Type: method, ServiceTradeNo: o.OrderNo, Name: "企业钱包充值 " + o.OrderNo,
		Money: fenToYuan(amountFen), Device: epay.PC, NotifyUrl: notify, ReturnUrl: ret})
	if err != nil {
		DB().Model(o).Update("status", OrderClosed)
		common.SysError("hwao 企业在线充值下单失败: " + err.Error())
		return nil, "", nil, ErrInvalid("支付下单失败，请稍后重试")
	}
	Audit(a.UserId, a.TenantId, "recharge.online.create", o.OrderNo, fmt.Sprintf("%s %d", o.PayChannel, amountFen), ip)
	return o, uri, params, nil
}

// HandleEpayNotify 处理易支付异步回调：验签 → 校验订单号/渠道/金额/状态 → 行锁幂等入账。返回 nil 表示应答 success。
func HandleEpayNotify(params map[string]string, ip string) error {
	client := epayClient()
	if client == nil {
		return ErrInvalid("在线支付未开通")
	}
	v, err := client.Verify(params)
	if err != nil || !v.VerifyStatus {
		Audit(0, 0, "recharge.online.badsign", params["out_trade_no"], "签名校验失败", ip)
		return ErrForbidden("签名错误")
	}
	if v.TradeStatus != epay.StatusTradeSuccess {
		return nil // 非成功通知：确认收到即可，不入账
	}
	paid, perr := yuanToFen(v.Money)
	return DB().Transaction(func(tx *gorm.DB) error {
		var o hmodel.RechargeOrder
		if tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("order_no = ?", v.ServiceTradeNo).First(&o).Error != nil {
			return ErrInvalid("订单不存在")
		}
		if o.Status == OrderCredited {
			return nil // 重复回调：已入账，直接应答成功
		}
		if !IsOnlineChannel(o.PayChannel) || o.PayChannel != onlineChannelPrefix+v.Type {
			Audit(0, o.TenantId, "recharge.online.reject", o.OrderNo, "支付渠道不一致："+v.Type, ip)
			return ErrInvalid("支付渠道不一致")
		}
		if perr != nil || paid != o.Amount {
			Audit(0, o.TenantId, "recharge.online.reject", o.OrderNo, "金额不一致："+v.Money, ip)
			RaiseAlert("payment", "critical", o.TenantId, "epay:money:"+o.OrderNo, o.OrderNo, "在线充值回调金额与订单不一致，未入账")
			return ErrInvalid("金额不一致")
		}
		if o.Status == OrderPending && Now()-o.CreatedAt > OnlineOrderTTL {
			tx.Model(&o).Update("status", OrderExpired)
			o.Status = OrderExpired
		}
		if o.Status != OrderPending {
			// 过期/关闭后才到账：不自动入账，告警由运营核实后在「对账与退款」手工补单（留审计）
			Audit(0, o.TenantId, "recharge.online.late", o.OrderNo, "订单状态 "+map[string]string{OrderExpired: "已过期", OrderClosed: "已关闭"}[o.Status]+"（"+o.Status+"）后收到支付成功回调，交易号 "+v.TradeNo, ip)
			RaiseAlert("payment", "critical", o.TenantId, "epay:late:"+o.OrderNo, o.OrderNo, "订单已过期/关闭后收到支付成功回调，请核实后手工补单")
			return ErrInvalid("订单已过期")
		}
		var dup int64
		tx.Model(&hmodel.RechargeOrder{}).Where("trade_no = ? AND id <> ?", v.TradeNo, o.Id).Count(&dup)
		if v.TradeNo == "" || dup > 0 {
			return ErrConflict("交易号缺失或已被其它订单使用")
		}
		var t hmodel.Tenant
		if tx.First(&t, o.TenantId).Error != nil || t.NewapiUserId == 0 {
			return ErrInvalid("企业钱包未就绪")
		}
		if err := applyWallet(t.Id, t.NewapiUserId, "credit:"+o.OrderNo, "credit", o.Quota, o.Amount, o.Remark); err != nil {
			return err
		}
		if err := tx.Model(&o).Updates(map[string]any{"status": OrderCredited, "trade_no": v.TradeNo, "credited_at": Now()}).Error; err != nil {
			return err
		}
		Audit(0, o.TenantId, "recharge.online.credit", o.OrderNo, fmt.Sprintf("%s %d 交易号 %s", o.PayChannel, o.Amount, v.TradeNo), ip)
		return nil
	})
}

// ExpireOnlineOrders 后台任务：在线支付单超过有效期未付标记为过期。
func ExpireOnlineOrders() {
	DB().Model(&hmodel.RechargeOrder{}).Where("status = ? AND pay_channel LIKE ? AND created_at < ?", OrderPending, onlineChannelPrefix+"%", Now()-OnlineOrderTTL).
		Update("status", OrderExpired)
}

func fenToYuan(f int64) string { return fmt.Sprintf("%d.%02d", f/100, f%100) }

func yuanToFen(s string) (int64, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0, err
	}
	return int64(math.Round(f * 100)), nil
}
