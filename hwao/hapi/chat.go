package hapi

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/gin-gonic/gin"
)

// ===================== 网页自由对话（/platform/chats/*） =====================
// 发送消息与 API 共用 RunChat 链路（路由、预算占用、项目权限、按 New API 日志结算），
// 服务端使用项目工作台内部密钥回环调用，浏览器只持有登录态，不接触任何内部令牌或上游密钥。

const (
	ctxChatErr     = "hwao_chat_err"
	ctxChatContent = "hwao_chat_content"
	ctxChatOutcome = "hwao_chat_outcome"
)

// ChatRetentionDays 网页对话正文保留天数（HWAO_CHAT_RETENTION_DAYS，默认 180）。
func ChatRetentionDays() int {
	if n, err := strconv.Atoi(os.Getenv("HWAO_CHAT_RETENTION_DAYS")); err == nil && n > 0 {
		return n
	}
	return 180
}

// PurgeExpiredChats 删除超过保留期的对话正文（调用与账务记录不受影响）。
func PurgeExpiredChats() {
	before := hservice.Now() - int64(ChatRetentionDays())*86400
	hservice.DB().Where("created_at < ?", before).Delete(&hmodel.ConversationMessage{})
}

func loadConv(c *gin.Context, a *hservice.Actor) (*hmodel.Conversation, bool) {
	var cv hmodel.Conversation
	if hservice.DB().Where("conv_id = ? AND tenant_id = ? AND user_id = ? AND deleted = ?", c.Param("cid"), a.TenantId, a.UserId, false).First(&cv).Error != nil {
		fail(c, hservice.ErrInvalid("对话不存在或已删除"))
		return nil, false
	}
	return &cv, true
}

// normalizeRoute 校验模型与路由模式组合：fixed=具体模型或 auto；scene=scene:SCxx；session=二者皆可，首轮确定后保持。
func normalizeRoute(model, mode string) (string, string, error) {
	model = strings.TrimSpace(model)
	if model == "" {
		model = "auto"
	}
	if mode == "" {
		mode = hservice.RouteFixed
		if strings.HasPrefix(model, "scene:") {
			mode = hservice.RouteScene
		}
	}
	switch mode {
	case hservice.RouteFixed:
		if strings.HasPrefix(model, "scene:") {
			return "", "", hservice.ErrInvalid("固定模型模式不能选择场景")
		}
	case hservice.RouteScene:
		if !strings.HasPrefix(model, "scene:") {
			return "", "", hservice.ErrInvalid("场景路由需要选择场景")
		}
	case hservice.RouteSession:
	default:
		return "", "", hservice.ErrInvalid("路由模式仅支持 fixed/scene/session")
	}
	return model, mode, nil
}

func listChats(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var cs []hmodel.Conversation
	q := hservice.DB().Where("tenant_id = ? AND user_id = ? AND deleted = ?", a.TenantId, a.UserId, false)
	if pid := c.Query("project_id"); pid != "" {
		q = q.Where("project_id = ?", pid)
	}
	q.Order("updated_at desc").Limit(200).Find(&cs)
	ok(c, gin.H{"items": cs, "retention_days": ChatRetentionDays()})
}

type createChatReq struct {
	ProjectId int64  `json:"project_id"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	RouteMode string `json:"route_mode"`
	// Seed 从场景任务“继续对话”时带入的首轮问答（不重新调用、不重复计费）
	Seed []struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		RequestId string `json:"request_id"`
	} `json:"seed"`
}

func createChat(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	var r createChatReq
	if c.ShouldBindJSON(&r) != nil || r.ProjectId == 0 {
		fail(c, hservice.ErrInvalid("参数错误：需要 project_id"))
		return
	}
	if !a.CanUseProject(r.ProjectId) {
		fail(c, hservice.ErrForbidden("无权使用该项目"))
		return
	}
	model, mode, err := normalizeRoute(r.Model, r.RouteMode)
	if err != nil {
		fail(c, err)
		return
	}
	title := strings.TrimSpace(r.Title)
	if title == "" {
		title = "新对话"
	}
	cv := &hmodel.Conversation{ConvId: hservice.NewBizNo("cv"), TenantId: a.TenantId, ProjectId: r.ProjectId, UserId: a.UserId,
		Title: cut(title, 60), Model: model, RouteMode: mode}
	if err := hservice.DB().Create(cv).Error; err != nil {
		fail(c, hservice.ErrNoResource("创建对话失败"))
		return
	}
	for _, m := range r.Seed {
		if (m.Role == "user" || m.Role == "assistant") && strings.TrimSpace(m.Content) != "" {
			// 带入的请求号须属于本企业，避免引用他人账务记录
			rid := ""
			if m.RequestId != "" {
				var cnt int64
				hservice.DB().Model(&hmodel.Request{}).Where("request_id = ? AND tenant_id = ?", m.RequestId, a.TenantId).Count(&cnt)
				if cnt > 0 {
					rid = m.RequestId
				}
			}
			hservice.DB().Create(&hmodel.ConversationMessage{ConvId: cv.ConvId, Role: m.Role, Content: m.Content, RequestId: rid, Status: hmodel.ReqSucceeded})
		}
	}
	ok(c, cv)
}

type updateChatReq struct {
	Title     *string `json:"title"`
	Model     *string `json:"model"`
	RouteMode *string `json:"route_mode"`
}

func updateChat(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	cv, okk := loadConv(c, a)
	if !okk {
		return
	}
	var r updateChatReq
	if c.ShouldBindJSON(&r) != nil {
		fail(c, hservice.ErrInvalid("参数错误"))
		return
	}
	up := map[string]any{}
	if r.Title != nil {
		t := strings.TrimSpace(*r.Title)
		if t == "" {
			fail(c, hservice.ErrInvalid("标题不能为空"))
			return
		}
		up["title"] = cut(t, 60)
	}
	if r.Model != nil || r.RouteMode != nil {
		m, md := cv.Model, cv.RouteMode
		if r.Model != nil {
			m = *r.Model
		}
		if r.RouteMode != nil {
			md = *r.RouteMode
		}
		model, mode, err := normalizeRoute(m, md)
		if err != nil {
			fail(c, err)
			return
		}
		up["model"], up["route_mode"] = model, mode
		if model != cv.Model || mode != cv.RouteMode {
			up["session_id"] = "" // 切换模型或模式后重新建立会话
		}
	}
	if len(up) > 0 {
		hservice.DB().Model(cv).Updates(up)
	}
	hservice.DB().First(cv, cv.Id)
	ok(c, cv)
}

// deleteChat 删除对话：仅删除正文与会话历史，hwao_request 与账务记录保留（FR21）。
func deleteChat(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	cv, okk := loadConv(c, a)
	if !okk {
		return
	}
	hservice.DB().Model(cv).Update("deleted", true)
	hservice.DB().Where("conv_id = ?", cv.ConvId).Delete(&hmodel.ConversationMessage{})
	if cv.SessionId != "" {
		hservice.DB().Model(&hmodel.Session{}).Where("session_id = ? AND tenant_id = ?", cv.SessionId, a.TenantId).Update("deleted", true)
		hservice.DB().Where("session_id = ?", cv.SessionId).Delete(&hmodel.SessionMessage{})
	}
	ok(c, nil)
}

// messageView 合并调用记录中的实际模型、Token、费用与兜底说明（不含渠道等内部信息）。
func messageViews(ms []hmodel.ConversationMessage) []gin.H {
	ids := []string{}
	for _, m := range ms {
		if m.RequestId != "" {
			ids = append(ids, m.RequestId)
		}
	}
	reqs := map[string]hmodel.Request{}
	if len(ids) > 0 {
		var rs []hmodel.Request
		hservice.DB().Where("request_id IN ?", ids).Find(&rs)
		for _, r := range rs {
			reqs[r.RequestId] = r
		}
	}
	out := []gin.H{}
	for _, m := range ms {
		v := gin.H{"id": m.Id, "role": m.Role, "content": m.Content, "request_id": m.RequestId, "status": m.Status,
			"error_code": m.ErrorCode, "error_message": m.ErrorMessage, "created_at": m.CreatedAt}
		if r, okk := reqs[m.RequestId]; okk && m.Role == "assistant" {
			v["meta"] = gin.H{"actual_model": r.ActualModel, "requested_model": r.RequestedModel, "route_mode": r.RouteMode,
				"scene_id": r.SceneId, "prompt_tokens": r.PromptTokens, "completion_tokens": r.CompletionTokens,
				"net_cost_fen": r.NetCost, "estimated_cost_fen": r.EstimatedCost, "billing_status": r.BillingStatus,
				"fallback": r.Fallback, "fallback_reason": r.FallbackReason, "latency_ms": r.LatencyMs, "first_byte_ms": r.FirstByteMs,
				"session_id": r.SessionId, "status": r.Status}
		}
		out = append(out, v)
	}
	return out
}

func chatMessages(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	cv, okk := loadConv(c, a)
	if !okk {
		return
	}
	var ms []hmodel.ConversationMessage
	hservice.DB().Where("conv_id = ?", cv.ConvId).Order("id").Find(&ms)
	ok(c, gin.H{"conversation": cv, "messages": messageViews(ms), "retention_days": ChatRetentionDays()})
}

// pickAutoModel 自动选择：项目白名单内、在售、有可用资源的模型，按质量降序、输出价升序。
func pickAutoModel(t *hmodel.Tenant, p *hmodel.Project) string {
	var ms []hmodel.CatalogModel
	hservice.DB().Where("status = ?", hmodel.ModelOnSale).Find(&ms)
	type cand struct {
		name    string
		quality int
		price   int64
	}
	cs := []cand{}
	for _, m := range ms {
		if p.ModelWhitelist != "" && !hservice.InList(p.ModelWhitelist, m.ModelName) {
			continue
		}
		if hservice.ChannelCount(m.ModelName) == 0 {
			continue
		}
		pv := hservice.CurrentPrice(m.ModelName, t.Id, hservice.Now())
		if pv == nil {
			continue
		}
		cs = append(cs, cand{m.ModelName, m.QualityLevel, int64(pv.OutputPrice)})
	}
	sort.SliceStable(cs, func(i, j int) bool {
		if cs[i].quality != cs[j].quality {
			return cs[i].quality > cs[j].quality
		}
		return cs[i].price < cs[j].price
	})
	if len(cs) == 0 {
		return ""
	}
	return cs[0].name
}

type sendReq struct {
	Content    string `json:"content"`
	Regenerate bool   `json:"regenerate"` // 重新生成最后一条回复（会再次计费）
	Trim       bool   `json:"trim"`       // 上下文超限时裁剪较早消息后重试
}

type chatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

const chatMaxTokens = 2048 // 网页对话单次输出上限

// sendChat POST /platform/chats/:cid/messages —— 流式（SSE）发送；结束后追加 event: hwao 元数据事件。
func sendChat(c *gin.Context) {
	a, okk := actor(c)
	if !okk {
		return
	}
	cv, okk := loadConv(c, a)
	if !okk {
		return
	}
	if !a.CanUseProject(cv.ProjectId) {
		fail(c, hservice.ErrForbidden("无权使用该项目"))
		return
	}
	if a.Tenant.Status != hmodel.TenantStatusEnabled {
		fail(c, hservice.ErrForbidden("企业未启用"))
		return
	}
	var p hmodel.Project
	if hservice.DB().First(&p, cv.ProjectId).Error != nil || p.Status != 1 {
		fail(c, hservice.ErrForbidden("项目已停用"))
		return
	}
	var r sendReq
	if c.ShouldBindJSON(&r) != nil {
		fail(c, hservice.ErrInvalid("参数错误"))
		return
	}
	var hist []hmodel.ConversationMessage
	hservice.DB().Where("conv_id = ?", cv.ConvId).Order("id").Find(&hist)
	if r.Regenerate {
		// 删除最后一条回复正文（其调用与账务记录保留），基于最后一条用户消息重新生成
		if n := len(hist); n > 0 && hist[n-1].Role == "assistant" {
			hservice.DB().Delete(&hist[n-1])
			hist = hist[:n-1]
		}
		if len(hist) == 0 || hist[len(hist)-1].Role != "user" {
			fail(c, hservice.ErrInvalid("没有可重新生成的消息"))
			return
		}
	} else {
		txt := strings.TrimSpace(r.Content)
		if txt == "" {
			fail(c, hservice.ErrInvalid("消息不能为空"))
			return
		}
		if utf8.RuneCountInString(txt) > 32000 {
			fail(c, hservice.ErrInvalid("单条消息过长（上限 32000 字）"))
			return
		}
		um := hmodel.ConversationMessage{ConvId: cv.ConvId, Role: "user", Content: txt, Status: hmodel.ReqSucceeded}
		hservice.DB().Create(&um)
		hist = append(hist, um)
		if cv.Title == "新对话" {
			hservice.DB().Model(cv).Update("title", cut(plainTitle(txt), 30))
		}
	}
	// 组装多轮上下文：失败的回复不进入上下文
	msgs := []chatMsg{}
	for _, m := range hist {
		if m.Role == "assistant" && (m.Status == hmodel.ReqFailed || m.Content == "") {
			continue
		}
		msgs = append(msgs, chatMsg{m.Role, m.Content})
	}
	// 解析模型
	model, mode := cv.Model, cv.RouteMode
	if model == "auto" {
		if model = pickAutoModel(a.Tenant, &p); model == "" {
			saveChatError(cv, "", "no_resource", "当前没有可用模型，请稍后重试或联系管理员")
			fail(c, hservice.ErrNoResource("当前没有可用模型，请稍后重试或联系管理员"))
			return
		}
	}
	if mode == hservice.RouteSession && cv.SessionId != "" {
		var s hmodel.Session
		if hservice.DB().Where("session_id = ?", cv.SessionId).First(&s).Error == nil && s.ModelName != "" {
			model = s.ModelName // 会话模式沿用首轮确定的模型
			if s.SceneId != "" {
				model = "scene:" + s.SceneId
			}
		}
	}
	// 上下文长度检查（FR10）：超限默认拒绝并提示，用户确认后裁剪较早消息
	if limit := contextLimit(model); limit > 0 {
		for estTokens(msgs)+chatMaxTokens > limit {
			if !r.Trim || len(msgs) <= 1 {
				e := &hservice.BizError{Status: 400, Code: "context_length_exceeded",
					Message: fmt.Sprintf("对话上下文约 %d Token，超过模型上限 %d（含回复预留 %d）。可裁剪较早消息后继续，或新建对话。", estTokens(msgs), limit, chatMaxTokens)}
				fail(c, e)
				return
			}
			msgs = msgs[1:]
			for len(msgs) > 1 && msgs[0].Role != "user" {
				msgs = msgs[1:]
			}
		}
	}
	body, _ := json.Marshal(map[string]any{"model": model, "stream": true, "max_tokens": chatMaxTokens, "messages": msgs})
	opt := ChatOptions{Source: "web", UserId: a.UserId, RouteMode: mode, SessionId: cv.SessionId,
		IdemKey: "chat-" + hservice.NewBizNo("ik")}
	if mode == hservice.RouteSession && strings.HasPrefix(model, "scene:") {
		opt.RouteMode = hservice.RouteSession
	}
	RunChat(c, nil, a.Tenant, &p, opt, body)

	// ---- 持久化回复与元数据 ----
	rid := c.Writer.Header().Get("X-Request-Id")
	if sid := c.Writer.Header().Get("X-Session-Id"); sid != "" && mode == hservice.RouteSession && sid != cv.SessionId {
		hservice.DB().Model(cv).Update("session_id", sid)
	}
	hservice.DB().Model(cv).Update("updated_at", hservice.Now())
	if v, has := c.Get(ctxChatOutcome); has {
		content, _ := c.Get(ctxChatContent)
		am := hmodel.ConversationMessage{ConvId: cv.ConvId, Role: "assistant", Content: fmt.Sprint(content), RequestId: rid, Status: fmt.Sprint(v)}
		hservice.DB().Create(&am)
		if c.Request.Context().Err() == nil {
			meta, _ := json.Marshal(gin.H{"message": messageViews([]hmodel.ConversationMessage{am})[0], "session_id": c.Writer.Header().Get("X-Session-Id")})
			c.Writer.Write([]byte("event: hwao\ndata: " + string(meta) + "\n\n"))
			c.Writer.Flush()
		}
		return
	}
	if e, has := c.Get(ctxChatErr); has {
		b := e.(*hservice.BizError)
		saveChatError(cv, rid, b.Code, b.Message)
	}
}

func saveChatError(cv *hmodel.Conversation, rid, code, msg string) {
	hservice.DB().Create(&hmodel.ConversationMessage{ConvId: cv.ConvId, Role: "assistant", RequestId: rid, Status: hmodel.ReqFailed,
		ErrorCode: code, ErrorMessage: cut(msg, 200)})
}

// contextLimit 估算可用上下文：固定模型取其上下文长度；场景取候选中的最大值。
func contextLimit(model string) int {
	if strings.HasPrefix(model, "scene:") {
		var v hmodel.SceneVersion
		if hservice.DB().Where("scene_id = ? AND status = ?", strings.TrimPrefix(model, "scene:"), "published").Order("version desc").First(&v).Error != nil {
			return 0
		}
		best := 0
		for _, n := range hservice.SplitList(v.Candidates) {
			if l := contextLimit(n); l > best {
				best = l
			}
		}
		return best
	}
	var m hmodel.CatalogModel
	if hservice.DB().Where("model_name = ?", model).First(&m).Error != nil {
		return 0
	}
	return m.ContextLength
}

// estTokens 与网关预估口径一致（约 3 字节 / Token）。
func estTokens(ms []chatMsg) int {
	b, _ := json.Marshal(ms)
	return len(b)/3 + 16
}

func cut(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

var (
	mdFence  = regexp.MustCompile("(?s)```.*?(```|$)")
	mdLink   = regexp.MustCompile(`!?\[([^\]]*)\]\([^)]*\)`)
	mdSyntax = regexp.MustCompile("[*_`~>#]+|^\\s*([-+]|\\d+\\.)\\s+")
	mdSpace  = regexp.MustCompile(`\s+`)
)

// plainTitle 由首条消息生成标题：去除 Markdown 语法与多余空白。
func plainTitle(s string) string {
	s = mdFence.ReplaceAllString(s, " ")
	s = mdLink.ReplaceAllString(s, "$1")
	s = mdSyntax.ReplaceAllString(s, "")
	s = strings.TrimSpace(mdSpace.ReplaceAllString(s, " "))
	if s == "" {
		return "新对话"
	}
	return s
}
