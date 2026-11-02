package hapi

import (
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/gin-gonic/gin"
)

// payOptions 前端账单页读取企业可用的充值方式（不含任何密钥）。
func payOptions(c *gin.Context) {
	ms := []gin.H{}
	if hservice.OnlinePayEnabled() {
		for _, k := range []string{"wxpay", "alipay"} {
			ms = append(ms, gin.H{"type": k, "name": hservice.OnlinePayMethods[k]})
		}
	}
	ok(c, gin.H{"online": len(ms) > 0, "methods": ms, "ttl_seconds": hservice.OnlineOrderTTL})
}

// onlineRecharge 企业管理员/财务发起微信/支付宝在线充值；返回易支付网关地址与签名表单，由前端提交跳转收银台。
func onlineRecharge(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var req struct {
		Amount int64  `json:"amount"` // 分
		Method string `json:"method"` // wxpay / alipay
	}
	c.ShouldBindJSON(&req)
	o, uri, params, err := hservice.CreateOnlineRecharge(a, req.Amount, req.Method, c.ClientIP())
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, gin.H{"order": o, "url": uri, "params": params})
}

// epayNotify 企业在线充值的易支付异步回调（独立于 New API 个人充值回调）；应答纯文本 success / fail。
func epayNotify(c *gin.Context) {
	_ = c.Request.ParseForm()
	params := map[string]string{}
	for k, v := range c.Request.Form { // 同时兼容 GET 查询参数与 POST 表单
		if len(v) > 0 {
			params[k] = v[0]
		}
	}
	if len(params) == 0 || hservice.HandleEpayNotify(params, c.ClientIP()) != nil {
		c.String(200, "fail")
		return
	}
	c.String(200, "success")
}
