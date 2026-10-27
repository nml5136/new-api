package hapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ===================== 运营端 New API 渠道适配层 =====================
// 浏览器只与 /platform/ops/channels/* 交互；服务端在进程内调用 New API 既有渠道管理处理器
// （AddChannel/UpdateChannel/UpdateChannelStatus/DeleteChannel/TestChannel/UpdateChannelBalance），
// 沿用其校验、能力表维护、缓存刷新与审计逻辑。管理员凭证不出服务端；上游密钥只写不读，任何响应都会剔除 key 字段。

// captureWriter 截获 New API 处理器的输出，便于脱敏后再返回
type captureWriter struct {
	gin.ResponseWriter
	buf    bytes.Buffer
	status int
}

func (w *captureWriter) Write(b []byte) (int, error)       { return w.buf.Write(b) }
func (w *captureWriter) WriteString(s string) (int, error) { return w.buf.WriteString(s) }
func (w *captureWriter) WriteHeader(code int)              { w.status = code }
func (w *captureWriter) WriteHeaderNow()                   {}

// callNewAPI 以给定的请求体/路径参数/查询串在当前请求上下文中调用 New API 处理器，返回其 JSON 结果
func callNewAPI(c *gin.Context, h gin.HandlerFunc, body any, params gin.Params, query string) (map[string]any, error) {
	orig := c.Writer
	cw := &captureWriter{ResponseWriter: orig, status: http.StatusOK}
	c.Writer = cw
	if body != nil {
		b, _ := json.Marshal(body)
		c.Request.Body = io.NopCloser(bytes.NewReader(b))
		c.Request.ContentLength = int64(len(b))
		c.Request.Header.Set("Content-Type", "application/json")
	}
	c.Params = params
	c.Request.URL.RawQuery = query
	h(c)
	c.Writer = orig
	var out map[string]any
	if err := json.Unmarshal(cw.buf.Bytes(), &out); err != nil {
		return nil, fmt.Errorf("New API 返回无法解析（HTTP %d）", cw.status)
	}
	stripKeys(out)
	if s, _ := out["success"].(bool); !s {
		msg, _ := out["message"].(string)
		if msg == "" {
			msg = "New API 处理失败"
		}
		return out, hservice.ErrInvalid(msg)
	}
	return out, nil
}

// stripKeys 递归剔除 key 字段，确保上游密钥不会回显
func stripKeys(v any) {
	switch t := v.(type) {
	case map[string]any:
		delete(t, "key")
		for _, x := range t {
			stripKeys(x)
		}
	case []any:
		for _, x := range t {
			stripKeys(x)
		}
	}
}

// channelView 渠道展示结构（不含密钥，仅标识是否已配置）
func channelView(ch *model.Channel, keySet bool) gin.H {
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	var weight uint
	if ch.Weight != nil {
		weight = *ch.Weight
	}
	var priority int64
	if ch.Priority != nil {
		priority = *ch.Priority
	}
	autoBan := 1
	if ch.AutoBan != nil {
		autoBan = *ch.AutoBan
	}
	return gin.H{
		"id": ch.Id, "name": ch.Name, "type": ch.Type, "type_name": constant.GetChannelTypeName(ch.Type),
		"status": ch.Status, "base_url": str(ch.BaseURL), "models": ch.Models, "model_mapping": str(ch.ModelMapping),
		"group": ch.Group, "priority": priority, "weight": weight, "auto_ban": autoBan, "test_model": str(ch.TestModel),
		"tag": str(ch.Tag), "remark": str(ch.Remark), "balance": ch.Balance, "balance_updated_time": ch.BalanceUpdatedTime,
		"response_time": ch.ResponseTime, "test_time": ch.TestTime, "used_quota": ch.UsedQuota, "created_time": ch.CreatedTime,
		"key_set": keySet, "multi_key": ch.ChannelInfo.IsMultiKey,
	}
}

// opsListChannels 渠道列表：关键字（名称/模型/标签）、状态、分组筛选 + 分页；查询时显式排除 key 列
func opsListChannels(c *gin.Context) {
	q := model.DB.Model(&model.Channel{}).Omit("key")
	if v := strings.TrimSpace(c.Query("keyword")); v != "" {
		like := "%" + v + "%"
		q = q.Where("name LIKE ? OR models LIKE ? OR tag LIKE ? OR base_url LIKE ?", like, like, like, like)
	}
	if v := c.Query("status"); v != "" {
		if v == "disabled" {
			q = q.Where("status <> ?", common.ChannelStatusEnabled)
		} else {
			q = q.Where("status = ?", common.ChannelStatusEnabled)
		}
	}
	if v := c.Query("group"); v != "" {
		q = q.Where("("+"`group`"+" = ? OR "+"`group`"+" LIKE ? OR "+"`group`"+" LIKE ? OR "+"`group`"+" LIKE ?)", v, v+",%", "%,"+v, "%,"+v+",%")
	}
	if v := c.Query("type"); v != "" {
		q = q.Where("type = ?", v)
	}
	p, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "10"))
	if p < 1 {
		p = 1
	}
	if size < 1 || size > 100 {
		size = 10
	}
	var total int64
	q.Count(&total)
	var chs []*model.Channel
	if err := q.Order("priority desc, id desc").Offset((p - 1) * size).Limit(size).Find(&chs).Error; err != nil {
		fail(c, err)
		return
	}
	// 是否已配置密钥：单独按 id 判断 key 非空，不读取密钥内容
	keyed := map[int]bool{}
	if len(chs) > 0 {
		ids := make([]int, 0, len(chs))
		for _, ch := range chs {
			ids = append(ids, ch.Id)
		}
		var withKey []int
		model.DB.Model(&model.Channel{}).Where("id IN ? AND `key` <> ''", ids).Pluck("id", &withKey)
		for _, id := range withKey {
			keyed[id] = true
		}
	}
	items := make([]gin.H, 0, len(chs))
	for _, ch := range chs {
		items = append(items, channelView(ch, keyed[ch.Id]))
	}
	ok(c, gin.H{"items": items, "total": total, "p": p, "size": size})
}

// opsChannelMeta 渠道类型与默认地址、分组、全局重试次数，用于表单下拉
func opsChannelMeta(c *gin.Context) {
	types := []gin.H{}
	for id, name := range constant.ChannelTypeNames {
		base := ""
		if id >= 0 && id < len(constant.ChannelBaseURLs) {
			base = constant.ChannelBaseURLs[id]
		}
		types = append(types, gin.H{"id": id, "name": name, "base_url": base})
	}
	sort.Slice(types, func(i, j int) bool { return types[i]["id"].(int) < types[j]["id"].(int) })
	var groups []string
	model.DB.Model(&model.Channel{}).Distinct("`group`").Pluck("`group`", &groups)
	gs := map[string]bool{"default": true}
	for _, g := range groups {
		for _, x := range strings.Split(g, ",") {
			if x = strings.TrimSpace(x); x != "" {
				gs[x] = true
			}
		}
	}
	gl := []string{}
	for g := range gs {
		gl = append(gl, g)
	}
	sort.Strings(gl)
	ok(c, gin.H{"types": types, "groups": gl, "retry_times": common.RetryTimes})
}

// channelForm 渠道表单（key 只写：留空表示不修改）
type channelForm struct {
	Name         string `json:"name"`
	Type         int    `json:"type"`
	BaseURL      string `json:"base_url"`
	Key          string `json:"key"`
	Models       string `json:"models"`
	ModelMapping string `json:"model_mapping"`
	Group        string `json:"group"`
	Priority     int64  `json:"priority"`
	Weight       uint   `json:"weight"`
	AutoBan      int    `json:"auto_ban"`
	TestModel    string `json:"test_model"`
	Tag          string `json:"tag"`
	Remark       string `json:"remark"`
}

// toChannel 校验表单并转换为 New API 渠道结构
func (f *channelForm) toChannel() (*model.Channel, error) {
	f.Name, f.Models, f.Group = strings.TrimSpace(f.Name), strings.TrimSpace(f.Models), strings.TrimSpace(f.Group)
	if f.Name == "" || f.Models == "" {
		return nil, hservice.ErrInvalid("渠道名称与模型列表必填")
	}
	if _, ok := constant.ChannelTypeNames[f.Type]; !ok {
		return nil, hservice.ErrInvalid("未知渠道类型")
	}
	if f.ModelMapping != "" {
		var m map[string]string
		if json.Unmarshal([]byte(f.ModelMapping), &m) != nil {
			return nil, hservice.ErrInvalid("模型映射须为 JSON 对象，如 {\"对外名\":\"上游名\"}")
		}
	}
	if f.BaseURL != "" && !strings.HasPrefix(f.BaseURL, "http://") && !strings.HasPrefix(f.BaseURL, "https://") {
		return nil, hservice.ErrInvalid("Base URL 须以 http:// 或 https:// 开头")
	}
	if f.Group == "" {
		f.Group = "default"
	}
	if f.AutoBan != 0 {
		f.AutoBan = 1
	}
	return &model.Channel{
		Name: f.Name, Type: f.Type, BaseURL: &f.BaseURL, Key: strings.TrimSpace(f.Key), Models: f.Models,
		ModelMapping: &f.ModelMapping, Group: f.Group, Priority: &f.Priority, Weight: &f.Weight, AutoBan: &f.AutoBan,
		TestModel: &f.TestModel, Tag: &f.Tag, Remark: &f.Remark,
	}, nil
}

// opsCreateChannel 新建渠道（调用 New API AddChannel，单 Key 模式）
func opsCreateChannel(c *gin.Context) {
	f, k := bind[channelForm](c)
	if !k {
		return
	}
	ch, err := f.toChannel()
	if err == nil && ch.Key == "" {
		err = hservice.ErrInvalid("新建渠道须填写上游密钥")
	}
	if err != nil {
		fail(c, err)
		return
	}
	_, err = callNewAPI(c, controller.AddChannel, controller.AddChannelRequest{Mode: "single", Channel: ch}, nil, "")
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "channel.create", ch.Name, ch.Models, c.ClientIP())
	}
	reply(c, nil, err)
}

// opsUpdateChannel 编辑渠道（调用 New API UpdateChannel）；key 为空时不提交，保留原密钥
func opsUpdateChannel(c *gin.Context) {
	f, k := bind[channelForm](c)
	if !k {
		return
	}
	id := int(idParam(c))
	if _, err := model.GetChannelById(id, false); err != nil {
		fail(c, hservice.ErrInvalid("渠道不存在"))
		return
	}
	ch, err := f.toChannel()
	if err != nil {
		fail(c, err)
		return
	}
	ch.Id = id
	// 以 map 提交，key 为空时不出现该字段，避免覆盖
	b, _ := json.Marshal(ch)
	var body map[string]any
	_ = json.Unmarshal(b, &body)
	for _, f := range []string{"status", "channel_info", "balance", "used_quota", "created_time", "test_time", "response_time", "balance_updated_time"} {
		delete(body, f)
	}
	if ch.Key == "" {
		delete(body, "key")
	}
	_, err = callNewAPI(c, controller.UpdateChannel, body, nil, "")
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "channel.update", fmt.Sprint(id), map[bool]string{true: "密钥已更换", false: ""}[ch.Key != ""], c.ClientIP())
	}
	reply(c, nil, err)
}

// opsChannelStatus 启用/停用渠道（调用 New API UpdateChannelStatus，1=启用 2=手动停用）
func opsChannelStatus(c *gin.Context) {
	req, k := bind[struct {
		Enabled bool `json:"enabled"`
	}](c)
	if !k {
		return
	}
	st := common.ChannelStatusManuallyDisabled
	if req.Enabled {
		st = common.ChannelStatusEnabled
	}
	_, err := callNewAPI(c, controller.UpdateChannelStatus, gin.H{"status": st}, gin.Params{{Key: "id", Value: c.Param("id")}}, "")
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "channel.status", c.Param("id"), fmt.Sprint(st), c.ClientIP())
	}
	reply(c, nil, err)
}

// opsDeleteChannel 删除渠道（调用 New API DeleteChannel，同步删除能力表）
func opsDeleteChannel(c *gin.Context) {
	id := c.Param("id")
	_, err := callNewAPI(c, controller.DeleteChannel, nil, gin.Params{{Key: "id", Value: id}}, "")
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "channel.delete", id, "", c.ClientIP())
	}
	reply(c, nil, err)
}

// opsTestChannel 测试连通性（调用 New API TestChannel，可指定测试模型）
func opsTestChannel(c *gin.Context) {
	q := ""
	if m := c.Query("model"); m != "" {
		q = "model=" + m
	}
	out, err := callNewAPI(c, controller.TestChannel, nil, gin.Params{{Key: "id", Value: c.Param("id")}}, q)
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, gin.H{"time": out["time"], "message": out["message"]})
}

// opsChannelBalance 查询上游余额（调用 New API UpdateChannelBalance，仅部分渠道类型支持）
func opsChannelBalance(c *gin.Context) {
	out, err := callNewAPI(c, controller.UpdateChannelBalance, nil, gin.Params{{Key: "id", Value: c.Param("id")}}, "")
	if err != nil {
		fail(c, err)
		return
	}
	ok(c, gin.H{"balance": out["balance"]})
}

// opsChannelSettings 全局失败重试次数（New API RetryTimes 选项）
func opsChannelSettings(c *gin.Context) {
	req, k := bind[struct {
		RetryTimes int `json:"retry_times"`
	}](c)
	if !k {
		return
	}
	if req.RetryTimes < 0 || req.RetryTimes > 10 {
		fail(c, hservice.ErrInvalid("重试次数范围 0-10"))
		return
	}
	err := model.UpdateOption("RetryTimes", strconv.Itoa(req.RetryTimes))
	if err == nil {
		hservice.Audit(c.GetInt("id"), 0, "channel.retry_times", "RetryTimes", strconv.Itoa(req.RetryTimes), c.ClientIP())
	}
	reply(c, gin.H{"retry_times": common.RetryTimes}, err)
}
