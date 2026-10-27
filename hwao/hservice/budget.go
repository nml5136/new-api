package hservice

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ===================== 预算与并发（FR09/FR19） =====================
// 计数器 scope：t:<租户> / p:<项目> / k:<密钥> / s:<会话>；period：d:YYYYMMDD / m:YYYYMM / all。
// 所有检查与占用在同一事务内加行锁完成，避免并发超卖。

// BudgetLimit 一条预算约束。
type BudgetLimit struct {
	Scope  string
	Period string
	Limit  int64 // 分，0 = 不限额（仍维护计数）
	MaxCon int   // 并发上限，0 = 不限
	Label  string
}

// Periods 当前日/月周期键（北京时间）。
func Periods() (string, string) {
	t := time.Now().In(time.FixedZone("CST", 8*3600))
	return "d:" + t.Format("20060102"), "m:" + t.Format("200601")
}

// LimitsFor 汇总一次调用涉及的全部预算约束。
func LimitsFor(t *hmodel.Tenant, p *hmodel.Project, k *hmodel.PlatformKey, sess *hmodel.Session) []BudgetLimit {
	d, m := Periods()
	ls := []BudgetLimit{
		{fmt.Sprintf("t:%d", t.Id), d, t.DailyBudget, t.MaxConcurrency, "企业日预算"},
		{fmt.Sprintf("t:%d", t.Id), m, t.MonthlyBudget, 0, "企业月预算"},
		{fmt.Sprintf("p:%d", p.Id), d, p.DailyBudget, p.MaxConcurrency, "项目日预算"},
		{fmt.Sprintf("p:%d", p.Id), m, p.MonthlyBudget, 0, "项目月预算"},
	}
	if k != nil && k.QuotaLimit > 0 {
		ls = append(ls, BudgetLimit{fmt.Sprintf("k:%d", k.Id), "all", k.QuotaLimit, 0, "密钥额度"})
	}
	if sess != nil && sess.Budget > 0 {
		ls = append(ls, BudgetLimit{"s:" + sess.SessionId, "all", sess.Budget, 0, "会话预算"})
	}
	return ls
}

// Reserve 原子占用预算与并发名额；任一约束不足即整体拒绝（402/429）。
func Reserve(requestId string, limits []BudgetLimit, amount int64) (*hmodel.Reservation, error) {
	r := &hmodel.Reservation{ReserveNo: NewBizNo("RSV"), RequestId: requestId, Amount: amount, Status: "held"}
	err := DB().Transaction(func(tx *gorm.DB) error {
		var keys []string
		for _, l := range limits {
			c, err := lockCounter(tx, l.Scope, l.Period)
			if err != nil {
				return err
			}
			if l.Limit > 0 && c.Used+c.Reserved+amount > l.Limit {
				return ErrQuota(l.Label + "不足")
			}
			if l.MaxCon > 0 && c.Inflight >= l.MaxCon {
				return ErrRate("并发已达上限")
			}
			inc := 0
			if l.MaxCon > 0 || strings.HasPrefix(l.Period, "d:") {
				inc = 1
			}
			if err := tx.Model(c).Updates(map[string]any{"reserved": gorm.Expr("reserved + ?", amount), "inflight": gorm.Expr("inflight + ?", inc)}).Error; err != nil {
				return err
			}
			keys = append(keys, fmt.Sprintf("%s|%s|%d", l.Scope, l.Period, inc))
		}
		r.Scopes = strings.Join(keys, ",")
		return tx.Create(r).Error
	})
	if err != nil {
		return nil, err
	}
	return r, nil
}

// lockCounter 取计数器行并加锁，不存在则创建（并发创建冲突时忽略后重读）。
func lockCounter(tx *gorm.DB, scope, period string) (*hmodel.BudgetCounter, error) {
	tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&hmodel.BudgetCounter{Scope: scope, Period: period})
	var c hmodel.BudgetCounter
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("scope = ? AND period = ?", scope, period).First(&c).Error
	return &c, err
}

// Settle 结算：释放占用，按实际费用计入已用；仅处理一次（held→settled/released）。
func Settle(reserveNo string, actual int64) error {
	return DB().Transaction(func(tx *gorm.DB) error {
		var r hmodel.Reservation
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("reserve_no = ?", reserveNo).First(&r).Error; err != nil {
			return err
		}
		if r.Status != "held" {
			return nil // 已处理，保证幂等
		}
		for _, k := range SplitList(r.Scopes) {
			parts := strings.Split(k, "|")
			if len(parts) != 3 {
				continue
			}
			inc := 0
			fmt.Sscan(parts[2], &inc)
			tx.Model(&hmodel.BudgetCounter{}).Where("scope = ? AND period = ?", parts[0], parts[1]).Updates(map[string]any{
				"reserved": gorm.Expr("GREATEST(reserved - ?, 0)", r.Amount),
				"used":     gorm.Expr("used + ?", actual),
				"inflight": gorm.Expr("GREATEST(inflight - ?, 0)", inc),
			})
		}
		st := "settled"
		if actual == 0 {
			st = "released"
		}
		return tx.Model(&r).Update("status", st).Error
	})
}

// CheckBudgetAlerts 后台任务：按阈值触发预算预警（每阈值每周期只告警一次）。
func CheckBudgetAlerts() {
	d, m := Periods()
	var ts []hmodel.Tenant
	DB().Where("status = ?", hmodel.TenantStatusEnabled).Find(&ts)
	for _, t := range ts {
		check := func(period string, limit int64, label string) {
			if limit <= 0 {
				return
			}
			var c hmodel.BudgetCounter
			if DB().Where("scope = ? AND period = ?", fmt.Sprintf("t:%d", t.Id), period).First(&c).Error != nil {
				return
			}
			pct := int((c.Used + c.Reserved) * 100 / limit)
			for _, th := range SplitList(t.AlertThresholds) {
				lv := 0
				fmt.Sscan(th, &lv)
				if lv > 0 && pct >= lv && c.AlertedLevel < lv {
					DB().Model(&c).Update("alerted_level", lv)
					RaiseAlert("budget", "warning", t.Id, fmt.Sprintf("budget:%d:%s:%d", t.Id, period, lv), label, fmt.Sprintf("%s已使用 %d%%", label, pct))
				}
			}
		}
		check(d, t.DailyBudget, "企业日预算")
		check(m, t.MonthlyBudget, "企业月预算")
	}
}
