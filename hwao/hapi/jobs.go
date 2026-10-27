package hapi

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
)

// ===================== 后台任务 =====================

// RecoverOnStart 启动恢复：重启前仍在执行的请求标记为“结果待确认”，只按日志核对，绝不重新发送。
func RecoverOnStart() {
	hservice.DB().Model(&hmodel.Request{}).Where("status IN ?", []string{hmodel.ReqExecuting, hmodel.ReqReceived}).
		Updates(map[string]any{"status": hmodel.ReqUnknown})
	hservice.DB().Model(&hmodel.Idempotency{}).Where("status IN ?", []string{"received", "executing"}).Update("status", "done")
}

// ReconPendingRequests 补偿结算：对待核对超过 1 分钟的请求按 New API 日志再结算；超过 1 小时仍无日志的告警。
func ReconPendingRequests() int {
	var rs []hmodel.Request
	hservice.DB().Where("billing_status = ? AND created_at < ?", hmodel.BillPending, hservice.Now()-60).Limit(500).Find(&rs)
	n := 0
	for _, r := range rs {
		var resv hmodel.Reservation
		hservice.DB().Where("request_id = ?", r.RequestId).First(&resv)
		if trySettle(r.RequestId, resv.ReserveNo) {
			n++
			continue
		}
		if r.CreatedAt < hservice.Now()-3600 {
			hservice.RaiseAlert("unknown_settle", "warning", r.TenantId, "settle:"+r.RequestId, r.RequestId, "请求超过 1 小时仍无法确认结算结果")
		}
	}
	return n
}

// StartJobs 启动周期任务（单实例部署；多实例需加分布式锁，见待确认问题）。
func StartJobs() {
	RecoverOnStart()
	go loop(30*time.Second, func() {
		hservice.ExpireRotatingKeys()
		hservice.SyncDuePrices()
		hservice.CheckBudgetAlerts()
		ReconPendingRequests()
	})
	go loop(10*time.Minute, func() {
		hservice.BlockExpiredModels()
		hservice.DB().Where("expires_at < ?", hservice.Now()).Delete(&hmodel.Idempotency{}) // 幂等记录保留 24 小时
	})
	go loop(time.Hour, func() { hservice.RunWalletRecon() })
}

func loop(d time.Duration, fn func()) {
	for {
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysLog("hwao job panic")
				}
			}()
			fn()
		}()
		time.Sleep(d)
	}
}
