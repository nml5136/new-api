// Package hservice 实现 hwao router 场景服务层的业务逻辑：
// 租户开通、密钥映射、场景路由、预算预留、幂等、网关编排、充值退款、对账、告警与审计。
package hservice

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// DB 平台业务表与 New API 共用主库（便于同库事务与对账）。
func DB() *gorm.DB { return model.DB }

// ===================== 统一错误（FR23） =====================

// BizError 机器可读错误：code + HTTP 状态 + 是否可重试。
type BizError struct {
	Status    int
	Code      string
	Message   string
	Retryable bool
}

func (e *BizError) Error() string { return e.Message }

// 常用错误构造：400/401/403/402/409/429/503/504
func ErrInvalid(msg string) *BizError {
	return &BizError{http.StatusBadRequest, "invalid_request", msg, false}
}
func ErrUnauth(msg string) *BizError {
	return &BizError{http.StatusUnauthorized, "unauthenticated", msg, false}
}
func ErrForbidden(msg string) *BizError {
	return &BizError{http.StatusForbidden, "permission_denied", msg, false}
}
func ErrQuota(msg string) *BizError {
	return &BizError{http.StatusPaymentRequired, "insufficient_quota", msg, false}
}
func ErrConflict(msg string) *BizError {
	return &BizError{http.StatusConflict, "idempotency_conflict", msg, false}
}
func ErrRate(msg string) *BizError {
	return &BizError{http.StatusTooManyRequests, "rate_limited", msg, true}
}
func ErrNoResource(msg string) *BizError {
	return &BizError{http.StatusServiceUnavailable, "no_resource", msg, true}
}
func ErrTimeout(msg string) *BizError {
	return &BizError{http.StatusGatewayTimeout, "timeout", msg, false}
}

// AsBiz 把任意错误转换为 BizError（未知错误按 503 不可用处理，且不泄露内部细节）。
func AsBiz(err error) *BizError {
	var be *BizError
	if errors.As(err, &be) {
		return be
	}
	common.SysError("hwao internal error: " + err.Error())
	return &BizError{http.StatusServiceUnavailable, "service_unavailable", "服务暂不可用，请稍后重试", true}
}

// ===================== 额度与人民币换算（FR15） =====================

// QuotaRateVersion 额度换算规则版本：分 = round_half_up(quota × 100 × USD/CNY汇率 ÷ QuotaPerUnit)。
// 规则固定、版本化；修改汇率须同时升级版本号。
const QuotaRateVersion = "Q1"

// usdCny 启动时固定汇率（来自 New API 设置或环境变量 HWAO_USD_CNY）。
var usdCny float64

// rate 返回固定汇率，首次调用时初始化（须在 New API 选项加载后调用）。
func rate() float64 {
	rateOnce.Do(initRate)
	return usdCny
}

var rateOnce sync.Once

func initRate() {
	usdCny = operation_setting.USDExchangeRate
	if v := os.Getenv("HWAO_USD_CNY"); v != "" {
		fmt.Sscanf(v, "%f", &usdCny)
	}
	if usdCny <= 0 {
		usdCny = 7.3
	}
}

// QuotaToFen New API 内部额度 → 人民币分。
func QuotaToFen(quota int) int64 {
	return int64(math.Floor(float64(quota)*100*rate()/common.QuotaPerUnit + 0.5))
}

// FenToQuota 人民币分 → New API 内部额度（向下取整，避免多发额度）。
func FenToQuota(fen int64) int {
	return int(math.Floor(float64(fen) * common.QuotaPerUnit / (100 * rate())))
}

// ===================== 安全工具 =====================

// Digest 计算平台密钥的 SHA-256 摘要（服务端只保存摘要）。
func Digest(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// secretKey 内部令牌加密密钥：优先 HWAO_SECRET，其次 New API 的 SESSION_SECRET。
func secretKey() []byte {
	s := os.Getenv("HWAO_SECRET")
	if s == "" {
		s = common.SessionSecret
	}
	h := sha256.Sum256([]byte("hwao:" + s))
	return h[:]
}

// Encrypt AES-GCM 加密内部令牌。
func Encrypt(plain string) (string, error) {
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(plain), nil)), nil
}

// Decrypt 解密内部令牌。
func Decrypt(enc string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("bad cipher")
	}
	out, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	return string(out), err
}

// RandToken 生成随机字符串（用于密钥、业务号）。
func RandToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)[:n]
}

// NewBizNo 生成带前缀的业务号，如 RQ20261027xxxx。
func NewBizNo(prefix string) string {
	return prefix + time.Now().Format("20060102150405") + RandToken(10)
}

// Now 秒级时间戳。
func Now() int64 { return time.Now().Unix() }

// SplitList 逗号分隔字符串 → 去空切片。
func SplitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// InList 判断白名单：空白名单表示不限制。
func InList(list string, v string) bool {
	items := SplitList(list)
	if len(items) == 0 {
		return true
	}
	for _, it := range items {
		if it == v {
			return true
		}
	}
	return false
}

// ===================== 审计与告警 =====================

// Audit 写敏感操作审计（不记录任何密钥明文）。
func Audit(userId int, tenantId int64, action, target, detail, ip string) {
	_ = DB().Create(&hmodel.AuditLog{UserId: userId, TenantId: tenantId, Action: action, Target: target, Detail: detail, Ip: ip}).Error
}

// RaiseAlert 按去重键产生告警；已存在的未关闭告警不重复创建。
func RaiseAlert(kind, level string, tenantId int64, dedupKey, scope, msg string) {
	a := hmodel.Alert{Kind: kind, Level: level, TenantId: tenantId, DedupKey: dedupKey, Scope: scope, Message: msg, Status: "open"}
	DB().Clauses(clause.OnConflict{DoNothing: true}).Create(&a)
}
