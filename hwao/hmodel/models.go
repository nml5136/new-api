// Package hmodel 定义 hwao router 平台场景服务层的全部数据对象。
// 设计原则：平台维护租户/项目/场景/策略/业务请求等“业务事实”，
// New API 是额度与实际扣费的唯一事实源（FR15/FR28），本包不保存任何钱包余额。
package hmodel

// ===================== 租户与权限（FR01/FR02） =====================

// 租户开通状态（FR01）
const (
	TenantStatusPending     = "pending"     // 待创建
	TenantStatusConfiguring = "configuring" // 配置中
	TenantStatusEnabled     = "enabled"     // 已启用
	TenantStatusFailed      = "failed"      // 配置失败
	TenantStatusDisabled    = "disabled"    // 已停用
)

// Tenant 企业租户；与 New API 计费用户（钱包）一对一映射。
type Tenant struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	Name            string `json:"name" gorm:"type:varchar(128);not null"`
	ProvisionNo     string `json:"provision_no" gorm:"type:varchar(64);uniqueIndex"` // 开通业务号，重试时先按此号查询已有结果，防止重复建钱包
	Status          string `json:"status" gorm:"type:varchar(16);index"`
	NewapiUserId    int    `json:"newapi_user_id" gorm:"index"` // 唯一计费钱包
	FailReason      string `json:"fail_reason" gorm:"type:varchar(255)"`
	AgreedTermsAt   int64  `json:"agreed_terms_at"`                                          // 同意服务/计费/数据规则时间
	DailyBudget     int64  `json:"daily_budget"`                                             // 企业日预算（分，0=不限）
	MonthlyBudget   int64  `json:"monthly_budget"`                                           // 企业月预算（分，0=不限）
	MaxConcurrency  int    `json:"max_concurrency" gorm:"default:10"`                        // 企业并发上限
	AlertThresholds string `json:"alert_thresholds" gorm:"type:varchar(64);default:'80,95'"` // 预算预警阈值（百分比）
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Tenant) TableName() string { return "hwao_tenant" }

// 企业内角色（FR 角色与权限）
const (
	RoleTenantAdmin   = "tenant_admin"   // 企业管理员
	RoleTenantMember  = "tenant_member"  // 企业使用成员
	RoleTenantFinance = "tenant_finance" // 财务成员
)

// Member 企业成员：New API 登录用户与企业的绑定关系。
type Member struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	TenantId  int64  `json:"tenant_id" gorm:"uniqueIndex:uk_member,priority:1;index"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex:uk_member,priority:2;index"` // New API users.id（登录账号）
	Role      string `json:"role" gorm:"type:varchar(32)"`
	Status    int    `json:"status" gorm:"default:1"` // 1 正常 2 已移除
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (Member) TableName() string { return "hwao_member" }

// 平台侧角色（运营/平台财务/超级管理员），超级管理员沿用 New API root。
const (
	StaffOps     = "platform_ops"     // 平台运营
	StaffFinance = "platform_finance" // 平台财务
)

// Staff 平台员工角色授权（New API 管理员默认视为平台运营+财务，可在此细分）。
type Staff struct {
	Id     int64  `json:"id" gorm:"primaryKey"`
	UserId int    `json:"user_id" gorm:"uniqueIndex:uk_staff,priority:1"`
	Role   string `json:"role" gorm:"type:varchar(32);uniqueIndex:uk_staff,priority:2"`
}

func (Staff) TableName() string { return "hwao_staff" }

// Invite 企业开通邀请码（管理员通过邀请注册，FR01）。
type Invite struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	Code      string `json:"code" gorm:"type:varchar(32);uniqueIndex"`
	Remark    string `json:"remark" gorm:"type:varchar(255)"`
	UsedBy    int    `json:"used_by"`
	TenantId  int64  `json:"tenant_id"`
	ExpiresAt int64  `json:"expires_at"`
	CreatedBy int    `json:"created_by"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (Invite) TableName() string { return "hwao_invite" }

// Project 项目：钱包之下的使用限制，不产生独立可充值余额。
type Project struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	TenantId                int64  `json:"tenant_id" gorm:"index"`
	Name                    string `json:"name" gorm:"type:varchar(128)"`
	IsDefault               bool   `json:"is_default"`
	SceneWhitelist          string `json:"scene_whitelist" gorm:"type:text"` // 场景白名单，逗号分隔；空=全部已发布场景
	ModelWhitelist          string `json:"model_whitelist" gorm:"type:text"` // 模型白名单，逗号分隔；空=全部可售模型
	DailyBudget             int64  `json:"daily_budget"`                     // 日预算（分）
	MonthlyBudget           int64  `json:"monthly_budget"`                   // 月预算（分）
	MaxCostPerCall          int64  `json:"max_cost_per_call"`                // 单次费用上限（分，0=按场景默认）
	MaxConcurrency          int    `json:"max_concurrency" gorm:"default:5"`
	DefaultRouteMode        string `json:"default_route_mode" gorm:"type:varchar(16);default:'scene'"` // fixed/scene/session
	Preference              string `json:"preference" gorm:"type:varchar(16);default:'balanced'"`      // economy/balanced/quality
	AllowCrossModelFallback bool   `json:"allow_cross_model_fallback"`                                 // 跨模型兜底预授权（一期默认关闭）
	Status                  int    `json:"status" gorm:"default:1"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt               int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Project) TableName() string { return "hwao_project" }

// ProjectMember 项目成员授权。
type ProjectMember struct {
	Id        int64 `json:"id" gorm:"primaryKey"`
	ProjectId int64 `json:"project_id" gorm:"uniqueIndex:uk_pm,priority:1"`
	UserId    int   `json:"user_id" gorm:"uniqueIndex:uk_pm,priority:2"`
}

func (ProjectMember) TableName() string { return "hwao_project_member" }

// ===================== 密钥（FR03） =====================

// PlatformKey 平台密钥：只保存 SHA-256 摘要，完整值仅创建时展示一次；
// 映射到该租户在 New API 的受限内部令牌（加密保存）。
const (
	KeyStatusActive   = 1 // 启用
	KeyStatusDisabled = 2 // 停用
	KeyStatusRevoked  = 3 // 已撤销
	KeyStatusRotating = 4 // 轮换过渡中（旧钥在 GraceUntil 前仍可用）
)

type PlatformKey struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	TenantId        int64  `json:"tenant_id" gorm:"index"`
	ProjectId       int64  `json:"project_id" gorm:"index"`
	OwnerUserId     int    `json:"owner_user_id" gorm:"index"` // 0 表示企业级服务密钥（不随人员离职继承）
	Name            string `json:"name" gorm:"type:varchar(64)"`
	Prefix          string `json:"prefix" gorm:"type:varchar(16)"`     // 展示用前缀
	Digest          string `json:"-" gorm:"type:char(64);uniqueIndex"` // 校验摘要
	InternalTokenId int    `json:"-" gorm:"index"`                     // New API tokens.id
	InternalKeyEnc  string `json:"-" gorm:"type:text"`                 // 内部令牌（AES-GCM 加密）
	Status          int    `json:"status" gorm:"default:1"`
	ExpiresAt       int64  `json:"expires_at"`                         // 0 永不过期
	GraceUntil      int64  `json:"grace_until"`                        // 轮换过渡截止
	QuotaLimit      int64  `json:"quota_limit"`                        // 调用额度上限（分，0=不限）
	UsedAmount      int64  `json:"used_amount"`                        // 已用（分）
	AllowIps        string `json:"allow_ips" gorm:"type:varchar(512)"` // 来源限制
	LastUsedAt      int64  `json:"last_used_at"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (PlatformKey) TableName() string { return "hwao_platform_key" }

// ===================== 模型目录与价格（FR16/FR24） =====================

// 模型资源状态
const (
	ModelPending = "pending" // 待核验
	ModelTesting = "testing" // 测试中
	ModelOnSale  = "on_sale" // 可售
	ModelPaused  = "paused"  // 暂停
	ModelOffline = "offline" // 已下线
)

// CatalogModel 平台模型能力目录（业务许可与能力），渠道凭证由 New API 保管。
type CatalogModel struct {
	Id                int64  `json:"id" gorm:"primaryKey"`
	ModelName         string `json:"model_name" gorm:"type:varchar(128);uniqueIndex"` // 与 New API 渠道模型名一致的具体模型
	Vendor            string `json:"vendor" gorm:"type:varchar(64)"`
	SupplierId        int64  `json:"supplier_id" gorm:"index"` // 所属供应商（hwao_supplier），0=未关联
	DisplayName       string `json:"display_name" gorm:"type:varchar(128)"`
	ContextLength     int    `json:"context_length"`
	MaxOutput         int    `json:"max_output"`
	SupportJson       bool   `json:"support_json"`   // 结构化输出
	SupportStream     bool   `json:"support_stream"` // 流式
	QualityLevel      int    `json:"quality_level"`  // 质量等级 1-5（离线评测）
	AvgLatencyMs      int    `json:"avg_latency_ms"`
	Stability         int    `json:"stability"`                             // 稳定性评分 0-100
	LicenseFile       string `json:"license_file" gorm:"type:varchar(255)"` // 授权文件
	LicenseExpireAt   int64  `json:"license_expire_at"`
	Status            string `json:"status" gorm:"type:varchar(16);index"`
	CapabilityVersion int    `json:"capability_version" gorm:"default:1"`
	CreatedAt         int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (CatalogModel) TableName() string { return "hwao_model" }

// Supplier 模型供应商：合同与联系人信息；模型通过 SupplierId 关联。
type Supplier struct {
	Id               int64  `json:"id" gorm:"primaryKey"`
	Name             string `json:"name" gorm:"type:varchar(64);uniqueIndex"`
	Contact          string `json:"contact" gorm:"type:varchar(128)"`    // 联系人/联系方式
	ContractNo       string `json:"contract_no" gorm:"type:varchar(64)"` // 采购合同号
	ContractExpireAt int64  `json:"contract_expire_at"`                  // 合同到期时间
	Status           string `json:"status" gorm:"type:varchar(16)"`      // active/paused
	Remark           string `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Supplier) TableName() string { return "hwao_supplier" }

// PriceVersion 价格版本：每次调价新增一行，生效后仅作用于新请求（快照）。
// 单价单位：分 / 百万 Token（人民币，含税标识见 TaxIncluded）。
type PriceVersion struct {
	Id              int64  `json:"id" gorm:"primaryKey"`
	ModelName       string `json:"model_name" gorm:"type:varchar(128);index"`
	Version         int    `json:"version"`
	InputPrice      int64  `json:"input_price"`       // 零售：输入
	OutputPrice     int64  `json:"output_price"`      // 零售：输出
	CacheReadPrice  int64  `json:"cache_read_price"`  // 零售：缓存命中
	CacheWritePrice int64  `json:"cache_write_price"` // 零售：缓存写入
	CostInputPrice  int64  `json:"cost_input_price"`  // 采购：输入
	CostOutputPrice int64  `json:"cost_output_price"` // 采购：输出
	TaxIncluded     bool   `json:"tax_included" gorm:"default:true"`
	TenantId        int64  `json:"tenant_id"` // 0=公开零售价，>0=客户合同价
	EffectiveAt     int64  `json:"effective_at" gorm:"index"`
	SyncStatus      string `json:"sync_status" gorm:"type:varchar(16)"` // 同步 New API 倍率结果：pending/ok/failed
	Reason          string `json:"reason" gorm:"type:varchar(255)"`
	CreatedBy       int    `json:"created_by"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (PriceVersion) TableName() string { return "hwao_price_version" }

// ===================== 场景与策略（FR05/FR25） =====================

// 场景版本状态
const (
	SceneDraft     = "draft"     // 草稿
	SceneEvaluated = "evaluated" // 评测通过
	ScenePublished = "published" // 已发布
	SceneDisabled  = "disabled"  // 已停用
)

// Scene 场景主表，CurrentVersionId 为“版本指针”，发布/回滚只切换指针。
type Scene struct {
	Id               int64  `json:"id" gorm:"primaryKey"`
	SceneId          string `json:"scene_id" gorm:"type:varchar(32);uniqueIndex"` // 如 SC01
	Name             string `json:"name" gorm:"type:varchar(64)"`
	Description      string `json:"description" gorm:"type:text"`
	Status           string `json:"status" gorm:"type:varchar(16)"`
	CurrentVersionId int64  `json:"current_version_id"`
	PrevVersionId    int64  `json:"prev_version_id"` // 便于恢复上一版本
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt        int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Scene) TableName() string { return "hwao_scene" }

// SceneVersion 场景版本：输入模板、输出格式、质量门槛、候选模型及顺序、默认费用上限。
type SceneVersion struct {
	Id               int64  `json:"id" gorm:"primaryKey"`
	SceneId          string `json:"scene_id" gorm:"type:varchar(32);index"`
	Version          int    `json:"version"`
	Scope            string `json:"scope" gorm:"type:varchar(255)"`        // 适用范围
	SystemPrompt     string `json:"system_prompt" gorm:"type:text"`        // 场景系统提示
	InputTemplate    string `json:"input_template" gorm:"type:text"`       // 输入模板（JSON 字段说明）
	OutputFormat     string `json:"output_format" gorm:"type:varchar(16)"` // text/json
	MinQuality       int    `json:"min_quality"`                           // 质量门槛（模型质量等级下限）
	MinContext       int    `json:"min_context"`                           // 最低上下文
	Candidates       string `json:"candidates" gorm:"type:text"`           // 候选模型，按顺序逗号分隔
	DefaultMaxCost   int64  `json:"default_max_cost"`                      // 默认单次费用上限（分）
	DefaultMaxTokens int    `json:"default_max_tokens"`
	HasFallback      bool   `json:"has_fallback"` // 宣称具备兜底
	Status           string `json:"status" gorm:"type:varchar(16)"`
	ChangeReason     string `json:"change_reason" gorm:"type:varchar(255)"`
	RolloutTenants   string `json:"rollout_tenants" gorm:"type:text"`   // 小范围放量租户（逗号分隔，空=全量）
	Preference       string `json:"preference" gorm:"type:varchar(16)"` // 默认偏好 economy/balanced/quality（项目/请求未指定时生效）
	CreatedBy        int    `json:"created_by"`
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (SceneVersion) TableName() string { return "hwao_scene_version" }

// ===================== 会话（FR10） =====================

type Session struct {
	Id                int64  `json:"id" gorm:"primaryKey"`
	SessionId         string `json:"session_id" gorm:"type:varchar(64);uniqueIndex"`
	TenantId          int64  `json:"tenant_id" gorm:"index"`
	ProjectId         int64  `json:"project_id" gorm:"index"`
	UserId            int    `json:"user_id" gorm:"index"`
	SceneId           string `json:"scene_id" gorm:"type:varchar(32)"`
	SceneVersionId    int64  `json:"scene_version_id"`
	ModelName         string `json:"model_name" gorm:"type:varchar(128)"` // 首轮确定后持久化
	CapabilityVersion int    `json:"capability_version"`
	Budget            int64  `json:"budget"`       // 会话预算（分）
	AllowSwitch       bool   `json:"allow_switch"` // 预授权故障切换
	Title             string `json:"title" gorm:"type:varchar(128)"`
	Source            string `json:"source" gorm:"type:varchar(8)"` // web/api
	Deleted           bool   `json:"deleted"`                       // 删除对话正文不删除账务
	CreatedAt         int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Session) TableName() string { return "hwao_session" }

// SessionMessage 网页会话历史正文（API 默认不保存）。
type SessionMessage struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	SessionId string `json:"session_id" gorm:"type:varchar(64);index"`
	RequestId string `json:"request_id" gorm:"type:varchar(64)"`
	Role      string `json:"role" gorm:"type:varchar(16)"`
	Content   string `json:"content" gorm:"type:mediumtext"`
	ModelName string `json:"model_name" gorm:"type:varchar(128)"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (SessionMessage) TableName() string { return "hwao_session_message" }

// ===================== 业务请求、尝试、预算、幂等（FR11/12/14/17） =====================

// 业务请求结果状态
const (
	ReqReceived    = "received"    // 已接收（幂等与预算已持久化）
	ReqExecuting   = "executing"   // 执行中
	ReqSucceeded   = "succeeded"   // 成功
	ReqFailed      = "failed"      // 明确失败
	ReqInterrupted = "interrupted" // 流式中断
	ReqCancelled   = "cancelled"   // 客户取消
	ReqUnknown     = "unknown"     // 结果待确认（超时/重启）
	ReqRejected    = "rejected"    // 入口拒绝（未触发上游）
)

// 计费状态
const (
	BillNone    = "none"    // 未产生费用
	BillPending = "pending" // 待核对
	BillSettled = "settled" // 已结算
	BillWaived  = "waived"  // 平台承担/免单
)

// Request 业务请求：一请求多尝试，对外只算净结果。
type Request struct {
	Id               int64  `json:"id" gorm:"primaryKey"`
	RequestId        string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	TenantId         int64  `json:"tenant_id" gorm:"index"`
	ProjectId        int64  `json:"project_id" gorm:"index"`
	KeyId            int64  `json:"key_id" gorm:"index"`
	UserId           int    `json:"user_id"`
	Source           string `json:"source" gorm:"type:varchar(8)"` // api/web
	SceneId          string `json:"scene_id" gorm:"type:varchar(32);index"`
	SceneVersionId   int64  `json:"scene_version_id"`
	RouteMode        string `json:"route_mode" gorm:"type:varchar(16)"`
	Preference       string `json:"preference" gorm:"type:varchar(16)"`
	SessionId        string `json:"session_id" gorm:"type:varchar(64);index"`
	RequestedModel   string `json:"requested_model" gorm:"type:varchar(128)"`
	ActualModel      string `json:"actual_model" gorm:"type:varchar(128);index"`
	PriceVersionId   int64  `json:"price_version_id"` // 价格快照
	PolicyVersion    string `json:"policy_version" gorm:"type:varchar(32)"`
	RouteReason      string `json:"route_reason" gorm:"type:text"` // 候选排除原因等可解释记录（JSON）
	IsStream         bool   `json:"is_stream"`
	MaxCost          int64  `json:"max_cost"`        // 单次硬上限（分）
	EstimatedCost    int64  `json:"estimated_cost"`  // 预估费用（分）
	ReservedAmount   int64  `json:"reserved_amount"` // 预算占用（分）
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	CacheTokens      int    `json:"cache_tokens"`
	NewapiQuota      int    `json:"newapi_quota"`  // New API 实际扣除额度（事实源）
	NetCost          int64  `json:"net_cost"`      // 客户净费用（分，由额度换算）
	PurchaseCost     int64  `json:"purchase_cost"` // 采购成本预估（分）
	Status           string `json:"status" gorm:"type:varchar(16);index"`
	BillingStatus    string `json:"billing_status" gorm:"type:varchar(16);index"`
	ErrorCode        string `json:"error_code" gorm:"type:varchar(64)"`
	ErrorMessage     string `json:"error_message" gorm:"type:varchar(512)"`
	Fallback         bool   `json:"fallback"`
	FallbackReason   string `json:"fallback_reason" gorm:"type:varchar(255)"`
	FirstByteMs      int    `json:"first_byte_ms"`
	LatencyMs        int    `json:"latency_ms"`
	IdempotencyKey   string `json:"idempotency_key" gorm:"type:varchar(128)"`
	SettleRetries    int    `json:"settle_retries"`
	CreatedAt        int64  `json:"created_at" gorm:"autoCreateTime;index"`
	FinishedAt       int64  `json:"finished_at"`
}

func (Request) TableName() string { return "hwao_request" }

// Attempt 每次实际上游尝试；attempt_id 即 New API 日志的 request_id，用于精确关联消费记录。
type Attempt struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	AttemptId    string `json:"attempt_id" gorm:"type:varchar(64);uniqueIndex"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64);index"`
	ModelName    string `json:"model_name" gorm:"type:varchar(128)"`
	ChannelId    int    `json:"channel_id"` // 仅授权平台人员可见
	HttpStatus   int    `json:"http_status"`
	Status       string `json:"status" gorm:"type:varchar(16)"`
	NewapiLogId  int    `json:"newapi_log_id"`
	Quota        int    `json:"quota"`
	ErrorMessage string `json:"error_message" gorm:"type:varchar(512)"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime"`
	FinishedAt   int64  `json:"finished_at"`
}

func (Attempt) TableName() string { return "hwao_attempt" }

// BudgetCounter 预算计数器：按 (范围, 周期) 原子累加“已用+在途占用”。
// Scope 形如 tenant:1 / project:3；Period 形如 D20261027 / M202610。
type BudgetCounter struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	Scope        string `json:"scope" gorm:"type:varchar(32);uniqueIndex:uk_budget,priority:1"`
	Period       string `json:"period" gorm:"type:varchar(16);uniqueIndex:uk_budget,priority:2"`
	Used         int64  `json:"used"`          // 已结算（分）
	Reserved     int64  `json:"reserved"`      // 在途占用（分）
	Inflight     int    `json:"inflight"`      // 在途并发数（仅日计数器维护）
	AlertedLevel int    `json:"alerted_level"` // 已触发的最高预警阈值
}

func (BudgetCounter) TableName() string { return "hwao_budget_counter" }

// Reservation 预算占用记录（非钱包扣款），保存占用编号以便释放差额。
type Reservation struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	ReserveNo string `json:"reserve_no" gorm:"type:varchar(64);uniqueIndex"`
	RequestId string `json:"request_id" gorm:"type:varchar(64);index"`
	Scopes    string `json:"scopes" gorm:"type:varchar(255)"` // 占用的计数器 scope|period 列表
	Amount    int64  `json:"amount"`
	Status    string `json:"status" gorm:"type:varchar(16)"` // held/settled/released
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (Reservation) TableName() string { return "hwao_reservation" }

// Idempotency 幂等记录：按 租户+接口+Idempotency-Key 去重，默认保留 24 小时。
type Idempotency struct {
	Id          int64  `json:"id" gorm:"primaryKey"`
	TenantId    int64  `json:"tenant_id" gorm:"uniqueIndex:uk_idem,priority:1"`
	Api         string `json:"api" gorm:"type:varchar(64);uniqueIndex:uk_idem,priority:2"`
	IdemKey     string `json:"idem_key" gorm:"type:varchar(128);uniqueIndex:uk_idem,priority:3"`
	RequestHash string `json:"request_hash" gorm:"type:char(64)"`
	RequestId   string `json:"request_id" gorm:"type:varchar(64)"`
	Status      string `json:"status" gorm:"type:varchar(16)"`
	HttpStatus  int    `json:"http_status"`
	Response    string `json:"-" gorm:"type:mediumtext"` // 非流式结果缓存
	ExpiresAt   int64  `json:"expires_at" gorm:"index"`
}

func (Idempotency) TableName() string { return "hwao_idempotency" }

// ===================== 评测与反馈（FR08） =====================

type Feedback struct {
	Id            int64  `json:"id" gorm:"primaryKey"`
	RequestId     string `json:"request_id" gorm:"type:varchar(64);index"`
	TenantId      int64  `json:"tenant_id" gorm:"index"`
	UserId        int    `json:"user_id"`
	SceneId       string `json:"scene_id" gorm:"type:varchar(32);index"`
	Satisfaction  int    `json:"satisfaction"`                          // 满意度 1-5
	Correct       *bool  `json:"correct"`                               // 任务正确性（合格）
	SwitchWilling *bool  `json:"switch_willing"`                        // 切换意愿
	RejectReason  string `json:"reject_reason" gorm:"type:varchar(16)"` // price/style/continuity/latency/other
	Comment       string `json:"comment" gorm:"type:varchar(512)"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (Feedback) TableName() string { return "hwao_feedback" }

// EvalResult 离线评测结果（固定评测集）。
type EvalResult struct {
	Id               int64   `json:"id" gorm:"primaryKey"`
	SceneId          string  `json:"scene_id" gorm:"type:varchar(32);index"`
	ModelName        string  `json:"model_name" gorm:"type:varchar(128)"`
	SampleSize       int     `json:"sample_size"`
	PassRate         float64 `json:"pass_rate"`
	CostPerQualified int64   `json:"cost_per_qualified"` // 每个合格结果成本（分）
	IsBaseline       bool    `json:"is_baseline"`
	Remark           string  `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt        int64   `json:"created_at" gorm:"autoCreateTime"`
}

func (EvalResult) TableName() string { return "hwao_eval_result" }

// ===================== 充值、退款、对账（FR18-20） =====================

// 充值订单状态
const (
	OrderUnpaid     = "unpaid"     // 待支付
	OrderConfirming = "confirming" // 支付确认中
	OrderCrediting  = "crediting"  // 入账中
	OrderCredited   = "credited"   // 已入账
	OrderClosed     = "closed"     // 已关闭
	OrderAbnormal   = "abnormal"   // 异常待核对
)

// RechargeOrder 充值订单（本平台为唯一入账服务；同一订单仅入账一次）。
type RechargeOrder struct {
	Id             int64  `json:"id" gorm:"primaryKey"`
	OrderNo        string `json:"order_no" gorm:"type:varchar(64);uniqueIndex"` // 商户订单号
	TenantId       int64  `json:"tenant_id" gorm:"index"`
	Amount         int64  `json:"amount"`                       // 支付金额（分）
	Quota          int    `json:"quota"`                        // 入账额度
	Kind           string `json:"kind" gorm:"type:varchar(16)"` // pay 支付 / grant 审批发放（赠送不计收入）
	PayChannel     string `json:"pay_channel" gorm:"type:varchar(32)"`
	TradeNo        string `json:"trade_no" gorm:"type:varchar(128);index"` // 第三方交易号
	Status         string `json:"status" gorm:"type:varchar(16);index"`
	Voucher        string `json:"voucher" gorm:"type:varchar(255)"` // 发放凭证
	ApprovedBy     int    `json:"approved_by"`
	CreatedBy      int    `json:"created_by"`
	CreditedAt     int64  `json:"credited_at"`
	RefundedAmount int64  `json:"refunded_amount"`
	Remark         string `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (RechargeOrder) TableName() string { return "hwao_recharge_order" }

// 退款状态
const (
	RefundPending  = "pending"  // 待审核
	RefundLocked   = "locked"   // 额度锁定
	RefundExternal = "external" // 外部退款中
	RefundDone     = "done"     // 已完成
	RefundFailed   = "failed"   // 已失败
	RefundUnknown  = "unknown"  // 结果待确认
	RefundRejected = "rejected" // 审核驳回
)

// Refund 退款/补偿单：类型区分未使用充值款退回与调用费用补偿。
type Refund struct {
	Id         int64  `json:"id" gorm:"primaryKey"`
	RefundNo   string `json:"refund_no" gorm:"type:varchar(64);uniqueIndex"` // 唯一冲正号
	TenantId   int64  `json:"tenant_id" gorm:"index"`
	Kind       string `json:"kind" gorm:"type:varchar(16)"` // recharge_refund 未使用充值退回 / compensation 调用补偿
	OrderNo    string `json:"order_no" gorm:"type:varchar(64);index"`
	RequestId  string `json:"request_id" gorm:"type:varchar(64)"` // 补偿依据的原消费记录
	Amount     int64  `json:"amount"`
	Quota      int    `json:"quota"`
	Reason     string `json:"reason" gorm:"type:varchar(255)"`
	Status     string `json:"status" gorm:"type:varchar(16);index"`
	ExternalNo string `json:"external_no" gorm:"type:varchar(128)"` // 外部退款交易号
	ApplyBy    int    `json:"apply_by"`
	ReviewBy   int    `json:"review_by"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Refund) TableName() string { return "hwao_refund" }

// LedgerEntry 平台侧额度变动投影（可重建），每条带唯一业务号，防止重复入账/扣回。
type LedgerEntry struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	BizNo     string `json:"biz_no" gorm:"type:varchar(96);uniqueIndex"` // 如 credit:ORDERNO / lock:REFUNDNO
	TenantId  int64  `json:"tenant_id" gorm:"index"`
	Kind      string `json:"kind" gorm:"type:varchar(16)"` // credit/grant/lock/unlock/compensate/consume
	Quota     int    `json:"quota"`                        // 正为增加，负为扣减
	Amount    int64  `json:"amount"`                       // 对应人民币（分）
	Remark    string `json:"remark" gorm:"type:varchar(255)"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func (LedgerEntry) TableName() string { return "hwao_ledger" }

// ReconDiff 对账差异（不平记录进入工单，禁止重复补单）。
type ReconDiff struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	BatchNo   string `json:"batch_no" gorm:"type:varchar(32);index"`
	Kind      string `json:"kind" gorm:"type:varchar(32)"` // pay_vs_newapi / newapi_vs_platform / upstream_vs_platform
	RefNo     string `json:"ref_no" gorm:"type:varchar(96);uniqueIndex:uk_diff,priority:2"`
	DiffKey   string `json:"diff_key" gorm:"type:varchar(32);uniqueIndex:uk_diff,priority:1"`
	Expected  int64  `json:"expected"`
	Actual    int64  `json:"actual"`
	Detail    string `json:"detail" gorm:"type:varchar(512)"`
	Status    string `json:"status" gorm:"type:varchar(16)"` // open/resolved/ignored
	Handler   int    `json:"handler"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
}

func (ReconDiff) TableName() string { return "hwao_recon_diff" }

// SyncCursor 消费同步游标。
type SyncCursor struct {
	Name      string `json:"name" gorm:"primaryKey;type:varchar(32)"`
	Position  int64  `json:"position"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (SyncCursor) TableName() string { return "hwao_sync_cursor" }

// Invoice 开票申请（一期人工处理）。
type Invoice struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	TenantId  int64  `json:"tenant_id" gorm:"index"`
	Title     string `json:"title" gorm:"type:varchar(128)"`
	TaxNo     string `json:"tax_no" gorm:"type:varchar(64)"`
	Amount    int64  `json:"amount"`
	Status    string `json:"status" gorm:"type:varchar(16)"` // applied/processing/issued/rejected
	Delivery  string `json:"delivery" gorm:"type:varchar(255)"`
	ApplyBy   int    `json:"apply_by"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Invoice) TableName() string { return "hwao_invoice" }

// ===================== 告警与审计（FR26/FR30/FR31） =====================

type Alert struct {
	Id         int64  `json:"id" gorm:"primaryKey"`
	Kind       string `json:"kind" gorm:"type:varchar(32);index"` // budget/balance/unknown_settle/refund_fail/recon/channel_fail/margin
	Level      string `json:"level" gorm:"type:varchar(8)"`       // info/warn/critical
	TenantId   int64  `json:"tenant_id" gorm:"index"`
	DedupKey   string `json:"dedup_key" gorm:"type:varchar(128);uniqueIndex"`
	Scope      string `json:"scope" gorm:"type:varchar(255)"` // 影响范围
	Message    string `json:"message" gorm:"type:varchar(512)"`
	Owner      int    `json:"owner"`                               // 责任人
	Status     string `json:"status" gorm:"type:varchar(16)"`      // open/handling/resolved
	Resolution string `json:"resolution" gorm:"type:varchar(512)"` // 恢复记录
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime;index"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Alert) TableName() string { return "hwao_alert" }

// AuditLog 敏感操作审计：密钥轮换、调价、额度调整、退款审批、授权变更等。
type AuditLog struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"index"`
	TenantId  int64  `json:"tenant_id" gorm:"index"`
	Action    string `json:"action" gorm:"type:varchar(64);index"`
	Target    string `json:"target" gorm:"type:varchar(128)"`
	Detail    string `json:"detail" gorm:"type:text"`
	Ip        string `json:"ip" gorm:"type:varchar(64)"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func (AuditLog) TableName() string { return "hwao_audit_log" }

// Ticket 客服工单：记录退款、补偿、重新生成及责任归属。
type Ticket struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	TenantId  int64  `json:"tenant_id" gorm:"index"`
	RequestId string `json:"request_id" gorm:"type:varchar(64)"`
	OrderNo   string `json:"order_no" gorm:"type:varchar(64)"`
	Subject   string `json:"subject" gorm:"type:varchar(255)"`
	Action    string `json:"action" gorm:"type:varchar(32)"`    // refund/compensate/regenerate/none
	Liability string `json:"liability" gorm:"type:varchar(32)"` // platform/upstream/customer
	Status    string `json:"status" gorm:"type:varchar(16)"`
	Note      string `json:"note" gorm:"type:text"`
	Handler   int    `json:"handler"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Ticket) TableName() string { return "hwao_ticket" }

// ===================== 网页自由对话（工作台“对话”） =====================

// Conversation 网页对话：绑定企业、项目与用户；删除仅删除正文，调用与账务记录保留（FR21）。
type Conversation struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	ConvId    string `json:"conv_id" gorm:"type:varchar(64);uniqueIndex"`
	TenantId  int64  `json:"tenant_id" gorm:"index"`
	ProjectId int64  `json:"project_id" gorm:"index"`
	UserId    int    `json:"user_id" gorm:"index"`
	Title     string `json:"title" gorm:"type:varchar(128)"`
	Model     string `json:"model" gorm:"type:varchar(128)"`     // 具体模型名 / scene:SCxx / auto
	RouteMode string `json:"route_mode" gorm:"type:varchar(16)"` // fixed / scene / session
	SessionId string `json:"session_id" gorm:"type:varchar(64)"` // 会话路由模式下持久化的 X-Session-Id
	Deleted   bool   `json:"deleted" gorm:"index"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Conversation) TableName() string { return "hwao_conversation" }

// ConversationMessage 网页对话消息正文；费用、Token 以 request_id 关联 hwao_request 实时读取。
type ConversationMessage struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	ConvId       string `json:"conv_id" gorm:"type:varchar(64);index"`
	Role         string `json:"role" gorm:"type:varchar(16)"` // user / assistant
	Content      string `json:"content" gorm:"type:mediumtext"`
	RequestId    string `json:"request_id" gorm:"type:varchar(64)"`
	Status       string `json:"status" gorm:"type:varchar(16)"` // succeeded / cancelled / interrupted / failed
	ErrorCode    string `json:"error_code" gorm:"type:varchar(64)"`
	ErrorMessage string `json:"error_message" gorm:"type:varchar(512)"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func (ConversationMessage) TableName() string { return "hwao_conversation_message" }

// AllModels 返回需要 AutoMigrate 的全部模型（与 sql/mysql/hwao_router.sql 保持同步）。
func AllModels() []any {
	return []any{
		&Tenant{}, &Member{}, &Staff{}, &Invite{}, &Project{}, &ProjectMember{},
		&PlatformKey{}, &CatalogModel{}, &PriceVersion{}, &Scene{}, &SceneVersion{},
		&Session{}, &SessionMessage{}, &Request{}, &Attempt{}, &BudgetCounter{},
		&Reservation{}, &Idempotency{}, &Feedback{}, &EvalResult{}, &RechargeOrder{},
		&Refund{}, &LedgerEntry{}, &ReconDiff{}, &SyncCursor{}, &Invoice{}, &Alert{},
		&AuditLog{}, &Ticket{}, &Conversation{}, &ConversationMessage{}, &Supplier{},
	}
}
