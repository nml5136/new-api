package hservice

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/hwao/hmodel"
)

// ===================== 路由决策（FR06/FR07/FR08/FR15） =====================

// 路由模式
const (
	RouteFixed   = "fixed"   // 固定模型
	RouteScene   = "scene"   // 场景路由
	RouteSession = "session" // 会话路由（首轮确定后保持）
)

// RouteInput 路由入参。
type RouteInput struct {
	Tenant       *hmodel.Tenant
	Project      *hmodel.Project
	Mode         string
	Model        string // 固定模型模式下的模型名，或场景模式下的场景 ID（scene:SC01 / SC01）
	SceneId      string
	Preference   string
	Session      *hmodel.Session
	PromptTokens int  // 估算输入 Token
	MaxTokens    int  // 输出上限
	NeedJson     bool // 需要结构化输出
	NeedStream   bool
}

// Candidate 候选模型及其价格快照。
type Candidate struct {
	Model *hmodel.CatalogModel
	Price *hmodel.PriceVersion
	Est   int64 // 预估费用（分）
}

// RouteResult 路由结果，含可解释的排除原因。
type RouteResult struct {
	Mode          string
	SceneId       string
	SceneVersion  *hmodel.SceneVersion
	Candidates    []Candidate       // 按优先级排序；第一个为首选，其余为同模型策略内的兜底
	Excluded      map[string]string // 模型 -> 排除原因
	PolicyVersion string
}

// Reason 序列化可解释记录（不含渠道与凭证信息）。
func (r *RouteResult) Reason() string {
	names := []string{}
	for _, c := range r.Candidates {
		names = append(names, c.Model.ModelName)
	}
	b, _ := json.Marshal(map[string]any{"mode": r.Mode, "scene": r.SceneId, "policy": r.PolicyVersion, "candidates": names, "excluded": r.Excluded})
	return string(b)
}

// EstimateCost 预估费用（分，向上取整）：输入 Token × 输入价 + 输出上限 × 输出价。
func EstimateCost(p *hmodel.PriceVersion, promptTokens, maxTokens int) int64 {
	if p == nil {
		return 0
	}
	v := float64(promptTokens)*float64(p.InputPrice)/1e6 + float64(maxTokens)*float64(p.OutputPrice)/1e6
	n := int64(v)
	if float64(n) < v {
		n++
	}
	return n
}

// evaluate 对单个模型做准入检查，返回候选或排除原因。
func evaluate(in *RouteInput, name string, minQuality, minContext int) (*Candidate, string) {
	var m hmodel.CatalogModel
	if DB().Where("model_name = ?", name).First(&m).Error != nil {
		return nil, "模型不在平台目录"
	}
	if m.Status != hmodel.ModelOnSale {
		return nil, "模型非可售状态"
	}
	if m.LicenseExpireAt > 0 && m.LicenseExpireAt < Now() {
		return nil, "授权已过期"
	}
	if in.Project.ModelWhitelist != "" && !InList(in.Project.ModelWhitelist, name) {
		return nil, "不在项目模型白名单"
	}
	if m.QualityLevel < minQuality {
		return nil, "低于场景质量门槛"
	}
	need := minContext
	if c := in.PromptTokens + in.MaxTokens; c > need {
		need = c
	}
	if m.ContextLength > 0 && need > m.ContextLength {
		return nil, "上下文长度不足"
	}
	if in.NeedJson && !m.SupportJson {
		return nil, "不支持结构化输出"
	}
	if in.NeedStream && !m.SupportStream {
		return nil, "不支持流式"
	}
	if ChannelCount(name) == 0 {
		return nil, "无可用资源"
	}
	p := CurrentPrice(name, in.Tenant.Id, Now())
	if p == nil {
		return nil, "价格不可确认"
	}
	return &Candidate{Model: &m, Price: p, Est: EstimateCost(p, in.PromptTokens, in.MaxTokens)}, ""
}

// Route 执行路由。所有模式都不会把请求发给未授权、不可售或超预算的模型。
func Route(in *RouteInput) (*RouteResult, error) {
	res := &RouteResult{Mode: in.Mode, Excluded: map[string]string{}}
	// 会话模式：已有会话沿用首轮模型
	if in.Mode == RouteSession && in.Session != nil && in.Session.ModelName != "" {
		c, why := evaluate(in, in.Session.ModelName, 0, 0)
		if c == nil {
			if !in.Session.AllowSwitch {
				return nil, ErrNoResource("会话模型当前不可用（" + why + "），且未授权切换")
			}
			res.Excluded[in.Session.ModelName] = why
		} else {
			if c.Model.CapabilityVersion != in.Session.CapabilityVersion && in.Session.CapabilityVersion > 0 && !in.Session.AllowSwitch {
				return nil, ErrNoResource("会话模型能力已变化，请新建会话")
			}
			res.Candidates = []Candidate{*c}
			res.SceneId = in.Session.SceneId
			return res, nil
		}
		if in.SceneId == "" {
			in.SceneId = in.Session.SceneId
		}
	}
	if in.Mode == RouteFixed {
		c, why := evaluate(in, in.Model, 0, 0)
		if c == nil {
			if why == "不在项目模型白名单" {
				return nil, ErrForbidden("模型未授权：" + in.Model)
			}
			return nil, ErrNoResource("模型不可用：" + why)
		}
		res.Candidates = []Candidate{*c}
		return res, nil
	}
	// 场景模式（会话首轮同样走场景策略）
	if in.SceneId == "" {
		return nil, ErrInvalid("场景路由需指定场景（model 传 scene:SC01）")
	}
	if in.Project.SceneWhitelist != "" && !InList(in.Project.SceneWhitelist, in.SceneId) {
		return nil, ErrForbidden("项目未开通该场景")
	}
	_, v, err := ActiveSceneVersion(in.SceneId, in.Tenant.Id)
	if err != nil {
		return nil, err
	}
	res.SceneId, res.SceneVersion, res.PolicyVersion = in.SceneId, v, fmt.Sprintf("%s@v%d", v.SceneId, v.Version)
	if in.MaxTokens == 0 {
		in.MaxTokens = v.DefaultMaxTokens
	}
	if v.OutputFormat == "json" {
		in.NeedJson = true
	}
	for _, name := range SplitList(v.Candidates) {
		c, why := evaluate(in, name, v.MinQuality, v.MinContext)
		if c == nil {
			res.Excluded[name] = why
			continue
		}
		res.Candidates = append(res.Candidates, *c)
	}
	if len(res.Candidates) == 0 {
		return nil, ErrNoResource("场景当前无满足质量门槛的可用模型")
	}
	// 偏好：经济优先按预估费用，质量优先按质量等级；均衡保持策略顺序
	pref := in.Preference
	if pref == "" {
		pref = in.Project.Preference
	}
	switch pref {
	case "economy":
		sort.SliceStable(res.Candidates, func(i, j int) bool { return res.Candidates[i].Est < res.Candidates[j].Est })
	case "quality":
		sort.SliceStable(res.Candidates, func(i, j int) bool {
			return res.Candidates[i].Model.QualityLevel > res.Candidates[j].Model.QualityLevel
		})
	}
	return res, nil
}
