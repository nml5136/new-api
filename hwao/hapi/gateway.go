// Package hapi 平台对外 HTTP 层：调用网关（/v1/*）、用户端与运营端接口（/platform/*）。
package hapi

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// internalSecret 回环调用内部密钥（进程内随机生成，不出现在任何响应与日志中）。
var internalSecret = hservice.RandToken(24)

const (
	hdrInternal = "X-Hwao-Internal"
	hdrAttempt  = "X-Hwao-Attempt-Id"
)

// httpClient 回环调用客户端（流式不设整体超时，由首包/空闲超时控制）。
var httpClient = &http.Client{Timeout: 0}

func init() {
	// 仅当内部密钥匹配时，才允许把 New API 的 request_id 覆盖为平台 attempt_id
	middleware.RequestIdOverride = func(c *gin.Context) string {
		if c.GetHeader(hdrInternal) == internalSecret && c.Request.RemoteAddr != "" {
			id := c.GetHeader(hdrAttempt)
			c.Request.Header.Del(hdrInternal)
			return id
		}
		c.Request.Header.Del(hdrAttempt)
		return ""
	}
}

func loopbackBase() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(*common.Port)
	}
	return "http://127.0.0.1:" + port
}

// writeErr 统一错误体 {code,message,request_id,retryable}（FR23）。
func writeErr(c *gin.Context, err error, requestId string) {
	b := hservice.AsBiz(err)
	if requestId != "" {
		c.Header("X-Request-Id", requestId)
	}
	c.AbortWithStatusJSON(b.Status, gin.H{"code": b.Code, "message": b.Message, "request_id": requestId, "retryable": b.Retryable,
		"error": gin.H{"code": b.Code, "message": b.Message, "type": "hwao_error"}}) // 兼容 OpenAI SDK 的 error 字段
}

// Gateway 全局中间件：拦截使用平台密钥（hwk-）的 OpenAI 兼容调用；其它请求原样交给 New API。
func Gateway() gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer "+hservice.PlatformKeyPrefix) {
			c.Next()
			return
		}
		raw := strings.TrimPrefix(auth, "Bearer ")
		switch {
		case c.Request.Method == http.MethodGet && strings.HasPrefix(c.Request.URL.Path, "/platform/requests/"):
			c.Next() // 结果查询由平台路由按平台密钥鉴权
		case c.Request.Method == http.MethodPost && c.Request.URL.Path == "/v1/chat/completions":
			chatCompletions(c, raw)
		case c.Request.Method == http.MethodGet && c.Request.URL.Path == "/v1/models":
			listModels(c, raw)
		default:
			writeErr(c, hservice.ErrInvalid("平台密钥一期仅支持 /v1/chat/completions 与 /v1/models"), "")
		}
		c.Abort()
	}
}

// authContext 鉴权并加载租户、项目。
func authContext(raw, ip string) (*hmodel.PlatformKey, *hmodel.Tenant, *hmodel.Project, error) {
	k, err := hservice.AuthKey(raw, ip)
	if err != nil {
		return nil, nil, nil, err
	}
	var t hmodel.Tenant
	var p hmodel.Project
	if hservice.DB().First(&t, k.TenantId).Error != nil || t.Status != hmodel.TenantStatusEnabled {
		return nil, nil, nil, hservice.ErrForbidden("企业未启用或已停用")
	}
	if hservice.DB().First(&p, k.ProjectId).Error != nil || p.Status != 1 {
		return nil, nil, nil, hservice.ErrForbidden("项目已停用")
	}
	hservice.DB().Model(k).Update("last_used_at", hservice.Now())
	return k, &t, &p, nil
}

// listModels 返回项目可用的可售模型与已开通场景（scene:SCxx）。
func listModels(c *gin.Context, raw string) {
	_, _, p, err := authContext(raw, c.ClientIP())
	if err != nil {
		writeErr(c, err, "")
		return
	}
	var ms []hmodel.CatalogModel
	hservice.DB().Where("status = ?", hmodel.ModelOnSale).Find(&ms)
	data := []gin.H{}
	for _, m := range ms {
		if p.ModelWhitelist == "" || hservice.InList(p.ModelWhitelist, m.ModelName) {
			data = append(data, gin.H{"id": m.ModelName, "object": "model", "owned_by": m.Vendor, "context_length": m.ContextLength})
		}
	}
	var ss []hmodel.Scene
	hservice.DB().Where("status = ?", hmodel.ScenePublished).Find(&ss)
	for _, s := range ss {
		if p.SceneWhitelist == "" || hservice.InList(p.SceneWhitelist, s.SceneId) {
			data = append(data, gin.H{"id": "scene:" + s.SceneId, "object": "model", "owned_by": "hwao-scene", "name": s.Name})
		}
	}
	c.JSON(200, gin.H{"object": "list", "data": data})
}

// chatBody 只解析路由所需字段，其余字段原样透传。
type chatBody struct {
	Model          string            `json:"model"`
	Messages       []json.RawMessage `json:"messages"`
	Stream         bool              `json:"stream"`
	MaxTokens      int               `json:"max_tokens"`
	MaxCompletion  int               `json:"max_completion_tokens"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format"`
}

// ChatOptions 网页工作台与 API 共用的调用参数。
type ChatOptions struct {
	Source     string // api / web
	UserId     int
	RouteMode  string
	SessionId  string
	MaxCostFen int64
	IdemKey    string
	ClientReq  string // 客户端 X-Request-Id（仅记录）
}

func chatCompletions(c *gin.Context, raw string) {
	k, t, p, err := authContext(raw, c.ClientIP())
	if err != nil {
		writeErr(c, err, "")
		return
	}
	opt := ChatOptions{Source: "api", RouteMode: c.GetHeader("X-Route-Mode"), SessionId: c.GetHeader("X-Session-Id"),
		IdemKey: c.GetHeader("Idempotency-Key"), ClientReq: c.GetHeader("X-Request-Id")}
	if v := c.GetHeader("X-Max-Cost-CNY"); v != "" {
		f, e := strconv.ParseFloat(v, 64)
		if e != nil || f <= 0 {
			writeErr(c, hservice.ErrInvalid("X-Max-Cost-CNY 无效"), "")
			return
		}
		// 向下取整到分，且至少 1 分：上限只能比客户声明的更严，避免舍入成 0 被当作“未设置”
		opt.MaxCostFen = int64(f * 100)
		if opt.MaxCostFen < 1 {
			opt.MaxCostFen = 1
		}
	}
	body, _ := io.ReadAll(c.Request.Body)
	RunChat(c, k, t, p, opt, body)
}

// RunChat 执行一次平台调用：幂等 → 路由 → 预估与预算占用 → 回环调用 New API → 按日志结算。
func RunChat(c *gin.Context, k *hmodel.PlatformKey, t *hmodel.Tenant, p *hmodel.Project, opt ChatOptions, body []byte) {
	requestId := hservice.NewBizNo("req")
	c.Header("X-Request-Id", requestId)
	var cb chatBody
	if err := json.Unmarshal(body, &cb); err != nil || len(cb.Messages) == 0 {
		writeErr(c, hservice.ErrInvalid("请求体无效：需要 model 与 messages"), requestId)
		return
	}
	// ---- 幂等（FR10）----
	var idem *hmodel.Idempotency
	if opt.IdemKey != "" {
		var replay bool
		var err error
		idem, replay, err = beginIdempotency(c, t.Id, opt.IdemKey, body, requestId)
		if err != nil {
			writeErr(c, err, requestId)
			return
		}
		if replay {
			return
		}
	}
	fail := func(err error, status string) {
		if idem != nil {
			hservice.DB().Delete(idem) // 入口拒绝不占用幂等键，允许修正后重试
		}
		b := hservice.AsBiz(err)
		hservice.DB().Create(&hmodel.Request{RequestId: requestId, TenantId: t.Id, ProjectId: p.Id, KeyId: keyId(k), UserId: opt.UserId,
			Source: opt.Source, RequestedModel: cb.Model, Status: status, BillingStatus: hmodel.BillNone, ErrorCode: b.Code,
			ErrorMessage: b.Message, IdempotencyKey: opt.IdemKey, FinishedAt: hservice.Now()})
		writeErr(c, err, requestId)
	}
	// ---- 路由模式 ----
	mode := opt.RouteMode
	sceneId := ""
	if strings.HasPrefix(cb.Model, "scene:") {
		sceneId = strings.TrimPrefix(cb.Model, "scene:")
	}
	if mode == "" {
		if sceneId != "" {
			mode = hservice.RouteScene
		} else if opt.SessionId != "" {
			mode = hservice.RouteSession
		} else {
			mode = hservice.RouteFixed
		}
	}
	if mode != hservice.RouteFixed && mode != hservice.RouteScene && mode != hservice.RouteSession {
		fail(hservice.ErrInvalid("X-Route-Mode 仅支持 fixed/scene/session"), hmodel.ReqRejected)
		return
	}
	if mode == hservice.RouteFixed && sceneId != "" {
		fail(hservice.ErrInvalid("固定模型模式下 model 不能是场景"), hmodel.ReqRejected)
		return
	}
	// ---- 会话 ----
	var sess *hmodel.Session
	if mode == hservice.RouteSession {
		if opt.SessionId != "" {
			var s hmodel.Session
			if hservice.DB().Where("session_id = ? AND tenant_id = ?", opt.SessionId, t.Id).First(&s).Error != nil || s.Deleted {
				fail(hservice.ErrInvalid("会话不存在"), hmodel.ReqRejected)
				return
			}
			if s.ProjectId != p.Id {
				fail(hservice.ErrForbidden("会话不属于当前项目"), hmodel.ReqRejected)
				return
			}
			sess = &s
		} else {
			sess = &hmodel.Session{SessionId: hservice.NewBizNo("ses"), TenantId: t.Id, ProjectId: p.Id, UserId: opt.UserId, SceneId: sceneId, Source: opt.Source}
		}
		if sceneId == "" && sess.SceneId == "" && sess.ModelName == "" && cb.Model != "" {
			sess.ModelName = cb.Model // 会话首轮直接指定模型
		}
	}
	maxTokens := cb.MaxTokens
	if cb.MaxCompletion > 0 {
		maxTokens = cb.MaxCompletion
	}
	in := &hservice.RouteInput{Tenant: t, Project: p, Mode: mode, Model: cb.Model, SceneId: sceneId, Session: sess,
		PromptTokens: len(body)/3 + 16, MaxTokens: maxTokens, NeedStream: cb.Stream,
		NeedJson: cb.ResponseFormat != nil && cb.ResponseFormat.Type != "" && cb.ResponseFormat.Type != "text"}
	if in.MaxTokens == 0 && mode == hservice.RouteFixed {
		in.MaxTokens = 1024
	}
	rr, err := hservice.Route(in)
	if err != nil {
		fail(err, hmodel.ReqRejected)
		return
	}
	first := rr.Candidates[0]
	// ---- 费用上限与预算（FR09/FR19）----
	maxCost := opt.MaxCostFen
	if maxCost == 0 {
		maxCost = p.MaxCostPerCall
	}
	if maxCost == 0 && rr.SceneVersion != nil {
		maxCost = rr.SceneVersion.DefaultMaxCost
	}
	est := first.Est
	if maxCost > 0 && est > maxCost {
		fail(&hservice.BizError{Status: 402, Code: "max_cost_exceeded", Message: fmt.Sprintf("预估费用 %.2f 元超过单次上限 %.2f 元", float64(est)/100, float64(maxCost)/100)}, hmodel.ReqRejected)
		return
	}
	if hservice.QuotaToFen(hservice.WalletQuota(t)) < est {
		fail(hservice.ErrQuota("企业余额不足"), hmodel.ReqRejected)
		return
	}
	resv, err := hservice.Reserve(requestId, hservice.LimitsFor(t, p, k, sess), est)
	if err != nil {
		fail(err, hmodel.ReqRejected)
		return
	}
	if sess != nil && sess.Id == 0 {
		sess.SceneVersionId = versionId(rr)
		hservice.DB().Create(sess)
		c.Header("X-Session-Id", sess.SessionId)
	}
	req := &hmodel.Request{RequestId: requestId, TenantId: t.Id, ProjectId: p.Id, KeyId: keyId(k), UserId: opt.UserId, Source: opt.Source,
		SceneId: rr.SceneId, SceneVersionId: versionId(rr), RouteMode: mode, Preference: p.Preference, SessionId: sessId(sess),
		RequestedModel: cb.Model, ActualModel: first.Model.ModelName, PriceVersionId: first.Price.Id, PolicyVersion: rr.PolicyVersion,
		RouteReason: rr.Reason(), IsStream: cb.Stream, MaxCost: maxCost, EstimatedCost: est, ReservedAmount: est,
		Status: hmodel.ReqExecuting, BillingStatus: hmodel.BillPending, IdempotencyKey: opt.IdemKey}
	if err := hservice.DB().Create(req).Error; err != nil {
		hservice.Settle(resv.ReserveNo, 0)
		writeErr(c, hservice.ErrNoResource("请求记录失败"), requestId)
		return
	}
	if idem != nil {
		hservice.DB().Model(idem).Update("status", "executing")
	}
	internalKey, err := hservice.Decrypt(keyEnc(k, t, p))
	if err != nil {
		finishFailed(req, resv, "internal_error", "内部令牌不可用", idem)
		writeErr(c, hservice.ErrNoResource("内部令牌不可用"), requestId)
		return
	}
	c.Header("X-Hwao-Route-Mode", mode)
	start := time.Now()
	// ---- 执行：同一场景内按候选顺序兜底，只在尚未向客户端输出任何内容时切换 ----
	allowFallback := rr.SceneVersion != nil && rr.SceneVersion.HasFallback && mode != hservice.RouteFixed
	var lastErr string
	for i, cand := range rr.Candidates {
		if i > 0 && !allowFallback {
			break
		}
		if i > 0 && sess != nil && sess.ModelName != "" && !sess.AllowSwitch {
			break
		}
		out := buildUpstreamBody(body, cand.Model.ModelName, rr.SceneVersion)
		att := &hmodel.Attempt{AttemptId: fmt.Sprintf("%s-a%d", requestId, i+1), RequestId: requestId, ModelName: cand.Model.ModelName, Status: "executing"}
		hservice.DB().Create(att)
		hreq, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, loopbackBase()+"/v1/chat/completions", bytes.NewReader(out))
		hreq.Header.Set("Content-Type", "application/json")
		hreq.Header.Set("Authorization", "Bearer sk-"+internalKey)
		hreq.Header.Set(hdrInternal, internalSecret)
		hreq.Header.Set(hdrAttempt, att.AttemptId)
		resp, err := httpClient.Do(hreq)
		if err != nil {
			lastErr = "上游调用失败"
			hservice.DB().Model(att).Updates(map[string]any{"status": "failed", "error_message": lastErr, "finished_at": hservice.Now()})
			if c.Request.Context().Err() != nil {
				break
			}
			continue
		}
		retryable := resp.StatusCode == 429 || resp.StatusCode >= 500
		if resp.StatusCode != 200 && retryable && i+1 < len(rr.Candidates) && allowFallback {
			msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			resp.Body.Close()
			hservice.DB().Model(att).Updates(map[string]any{"status": "failed", "http_status": resp.StatusCode, "error_message": safeMsg(msg), "finished_at": hservice.Now()})
			lastErr = safeMsg(msg)
			req.Fallback, req.FallbackReason = true, fmt.Sprintf("%s 失败(%d)，切换候选", cand.Model.ModelName, resp.StatusCode)
			continue
		}
		// 已确定使用该候选，开始向客户端输出
		req.ActualModel, req.PriceVersionId = cand.Model.ModelName, cand.Price.Id
		c.Header("X-Hwao-Model", cand.Model.ModelName)
		content, outcome := relayResponse(c, resp, start, req)
		resp.Body.Close()
		hservice.DB().Model(att).Updates(map[string]any{"status": outcome, "http_status": resp.StatusCode, "finished_at": hservice.Now()})
		req.Status = outcome
		if outcome != hmodel.ReqSucceeded && resp.StatusCode != 200 {
			req.ErrorCode, req.ErrorMessage = fmt.Sprint(resp.StatusCode), "上游返回错误"
		}
		if sess != nil {
			if sess.ModelName == "" || sess.ModelName != cand.Model.ModelName {
				hservice.DB().Model(sess).Updates(map[string]any{"model_name": cand.Model.ModelName, "capability_version": cand.Model.CapabilityVersion})
			}
			saveSessionMessages(sess.SessionId, requestId, cb.Messages, content, cand.Model.ModelName)
		}
		if idem != nil && !cb.Stream && outcome == hmodel.ReqSucceeded {
			hservice.DB().Model(idem).Updates(map[string]any{"status": "done", "http_status": resp.StatusCode, "response": content})
		} else if idem != nil {
			hservice.DB().Model(idem).Update("status", "done")
		}
		req.LatencyMs = int(time.Since(start).Milliseconds())
		req.FinishedAt = hservice.Now()
		hservice.DB().Save(req)
		go SettleRequest(requestId, resv.ReserveNo, 10)
		return
	}
	finishFailed(req, resv, "no_resource", "所有候选资源均不可用："+lastErr, idem)
	if !c.Writer.Written() {
		writeErr(c, hservice.ErrNoResource("当前无可用资源，请稍后重试"), requestId)
	}
}

// relayResponse 把 New API 响应透传给客户端；流式逐块刷新，同时累积正文用于会话记录。
func relayResponse(c *gin.Context, resp *http.Response, start time.Time, req *hmodel.Request) (string, string) {
	for _, h := range []string{"Content-Type", "Cache-Control"} {
		if v := resp.Header.Get(h); v != "" {
			c.Header(h, v)
		}
	}
	c.Status(resp.StatusCode)
	if !strings.Contains(resp.Header.Get("Content-Type"), "event-stream") {
		b, _ := io.ReadAll(resp.Body)
		req.FirstByteMs = int(time.Since(start).Milliseconds())
		c.Writer.Write(b)
		if resp.StatusCode != 200 {
			return "", hmodel.ReqFailed
		}
		var r struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		json.Unmarshal(b, &r)
		if len(r.Choices) > 0 && req.SessionId != "" {
			return r.Choices[0].Message.Content, hmodel.ReqSucceeded
		}
		return string(b), hmodel.ReqSucceeded
	}
	var sb strings.Builder
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
	done := false
	firstSeen := false
	for sc.Scan() {
		line := sc.Bytes()
		if !firstSeen {
			req.FirstByteMs = int(time.Since(start).Milliseconds())
			firstSeen = true
		}
		if _, err := c.Writer.Write(append(line, '\n')); err != nil {
			return sb.String(), hmodel.ReqCancelled // 客户端断开
		}
		c.Writer.Flush()
		if bytes.HasPrefix(line, []byte("data: ")) {
			data := bytes.TrimPrefix(line, []byte("data: "))
			if string(data) == "[DONE]" {
				done = true
				continue
			}
			var ch struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if json.Unmarshal(data, &ch) == nil && len(ch.Choices) > 0 {
				sb.WriteString(ch.Choices[0].Delta.Content)
			}
		}
	}
	if c.Request.Context().Err() != nil {
		return sb.String(), hmodel.ReqCancelled
	}
	if !done {
		return sb.String(), hmodel.ReqInterrupted // 已输出部分内容按实际计费
	}
	return sb.String(), hmodel.ReqSucceeded
}

// buildUpstreamBody 替换模型名，并在场景模式下注入场景系统提示。
func buildUpstreamBody(body []byte, modelName string, v *hmodel.SceneVersion) []byte {
	var m map[string]any
	json.Unmarshal(body, &m)
	m["model"] = modelName
	if v != nil && v.SystemPrompt != "" {
		if msgs, ok := m["messages"].([]any); ok {
			m["messages"] = append([]any{map[string]any{"role": "system", "content": v.SystemPrompt}}, msgs...)
		}
	}
	if s, _ := m["stream"].(bool); s {
		m["stream_options"] = map[string]any{"include_usage": true}
	}
	out, _ := json.Marshal(m)
	return out
}

// SettleRequest 结算：以 New API 消费日志（request_id = attempt_id）为唯一扣费事实源，
// 换算为分后结算预算占用；日志暂未落库则保持“待核对”，由对账任务补偿，绝不重放请求。
func SettleRequest(requestId, reserveNo string, tries int) {
	for i := 0; i < tries; i++ {
		if trySettle(requestId, reserveNo) {
			return
		}
		time.Sleep(500 * time.Millisecond)
	}
}

func trySettle(requestId, reserveNo string) bool {
	var req hmodel.Request
	if hservice.DB().Where("request_id = ?", requestId).First(&req).Error != nil || req.BillingStatus != hmodel.BillPending {
		return true
	}
	var atts []hmodel.Attempt
	hservice.DB().Where("request_id = ?", requestId).Find(&atts)
	quota, prompt, completion, found := 0, 0, 0, false
	for _, a := range atts {
		var logs []model.Log
		model.LOG_DB.Where("request_id = ? AND type = ?", a.AttemptId, model.LogTypeConsume).Find(&logs)
		for _, l := range logs {
			found = true
			quota += l.Quota
			prompt += l.PromptTokens
			completion += l.CompletionTokens
			hservice.DB().Model(&a).Updates(map[string]any{"newapi_log_id": l.Id, "quota": l.Quota, "channel_id": l.ChannelId})
		}
	}
	executedOnly := req.Status == hmodel.ReqFailed || req.Status == hmodel.ReqCancelled
	if !found && !executedOnly {
		return false
	}
	fen := hservice.QuotaToFen(quota)
	err := hservice.DB().Transaction(func(tx *gorm.DB) error {
		var r hmodel.Request
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("request_id = ?", requestId).First(&r).Error; err != nil || r.BillingStatus != hmodel.BillPending {
			return err
		}
		st := hmodel.BillSettled
		if quota == 0 {
			st = hmodel.BillNone
		}
		purchase := int64(0)
		var pv hmodel.PriceVersion
		if tx.First(&pv, r.PriceVersionId).Error == nil {
			purchase = int64(float64(prompt)*float64(pv.CostInputPrice)/1e6 + float64(completion)*float64(pv.CostOutputPrice)/1e6)
		}
		if r.KeyId > 0 && fen > 0 {
			tx.Model(&hmodel.PlatformKey{}).Where("id = ?", r.KeyId).Update("used_amount", gorm.Expr("used_amount + ?", fen))
		}
		return tx.Model(&r).Updates(map[string]any{"billing_status": st, "newapi_quota": quota, "net_cost": fen, "purchase_cost": purchase,
			"prompt_tokens": prompt, "completion_tokens": completion}).Error
	})
	if err != nil {
		return false
	}
	hservice.Settle(reserveNo, fen)
	return true
}

func finishFailed(req *hmodel.Request, resv *hmodel.Reservation, code, msg string, idem *hmodel.Idempotency) {
	hservice.DB().Model(req).Updates(map[string]any{"status": hmodel.ReqFailed, "error_code": code, "error_message": msg, "finished_at": hservice.Now()})
	if idem != nil {
		hservice.DB().Delete(idem)
	}
	go SettleRequest(req.RequestId, resv.ReserveNo, 6) // 失败请求若 New API 实际扣费仍按日志结算
}

// beginIdempotency 幂等登记：同键同内容返回原结果；同键不同内容返回 409；处理中返回 409 可重试。
func beginIdempotency(c *gin.Context, tenantId int64, key string, body []byte, requestId string) (*hmodel.Idempotency, bool, error) {
	hash := hservice.Digest(string(body))
	rec := &hmodel.Idempotency{TenantId: tenantId, Api: "chat.completions", IdemKey: key, RequestHash: hash, RequestId: requestId,
		Status: "received", ExpiresAt: hservice.Now() + 86400}
	// MySQL 下 ON DUPLICATE KEY 的影响行数不可靠，统一按唯一键回读，以 request_id 判断是否本次登记成功
	hservice.DB().Clauses(clause.OnConflict{DoNothing: true}).Create(rec)
	var old hmodel.Idempotency
	if hservice.DB().Where("tenant_id = ? AND api = ? AND idem_key = ?", tenantId, rec.Api, key).First(&old).Error != nil {
		return nil, false, hservice.ErrNoResource("幂等登记失败")
	}
	if old.RequestId == requestId {
		return &old, false, nil
	}
	if old.RequestHash != hash {
		return nil, false, hservice.ErrConflict("同一 Idempotency-Key 的请求内容不一致")
	}
	if old.Status == "done" && old.Response != "" {
		c.Header("X-Request-Id", old.RequestId)
		c.Header("X-Idempotent-Replay", "true")
		c.Data(old.HttpStatus, "application/json", []byte(old.Response))
		return nil, true, nil
	}
	e := hservice.ErrConflict("相同请求正在处理或结果待确认，请用原 request_id 查询：" + old.RequestId)
	e.Retryable = old.Status != "done"
	return nil, false, e
}

func saveSessionMessages(sessionId, requestId string, msgs []json.RawMessage, reply, modelName string) {
	if len(msgs) > 0 {
		var last struct {
			Role    string `json:"role"`
			Content any    `json:"content"`
		}
		json.Unmarshal(msgs[len(msgs)-1], &last)
		txt, _ := last.Content.(string)
		if txt == "" {
			b, _ := json.Marshal(last.Content)
			txt = string(b)
		}
		hservice.DB().Create(&hmodel.SessionMessage{SessionId: sessionId, RequestId: requestId, Role: "user", Content: txt})
	}
	hservice.DB().Create(&hmodel.SessionMessage{SessionId: sessionId, RequestId: requestId, Role: "assistant", Content: reply, ModelName: modelName})
}

// safeMsg 截断上游错误信息，避免把渠道、凭证等内部细节返回给客户。
func safeMsg(b []byte) string {
	var e struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	json.Unmarshal(b, &e)
	m := e.Error.Message
	if len(m) > 200 {
		m = m[:200]
	}
	return m
}

func keyId(k *hmodel.PlatformKey) int64 {
	if k == nil {
		return 0
	}
	return k.Id
}

func sessId(s *hmodel.Session) string {
	if s == nil {
		return ""
	}
	return s.SessionId
}

func versionId(r *hservice.RouteResult) int64 {
	if r.SceneVersion == nil {
		return 0
	}
	return r.SceneVersion.Id
}

// keyEnc 取内部令牌密文；网页工作台无平台密钥时使用项目的工作台服务密钥。
func keyEnc(k *hmodel.PlatformKey, t *hmodel.Tenant, p *hmodel.Project) string {
	if k != nil {
		return k.InternalKeyEnc
	}
	wk, err := hservice.WorkbenchKey(t, p)
	if err != nil {
		return ""
	}
	return wk.InternalKeyEnc
}
