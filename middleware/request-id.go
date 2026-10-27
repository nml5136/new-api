package middleware

import (
	"context"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// RequestIdOverride [HWAO] 平台网关回环调用时由 hwao 注入：校验内部密钥后返回 attempt_id，
// 使 New API 消费日志的 request_id 与平台尝试记录一一对应（结算事实源）。返回空串则沿用默认生成。
var RequestIdOverride func(c *gin.Context) string

func RequestId() func(c *gin.Context) {
	return func(c *gin.Context) {
		id := ""
		if RequestIdOverride != nil {
			id = RequestIdOverride(c)
		}
		if id == "" {
			id = common.NewRequestId()
		}
		c.Set(common.RequestIdKey, id)
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, id)
		c.Request = c.Request.WithContext(ctx)
		c.Header(common.RequestIdKey, id)
		c.Next()
	}
}
