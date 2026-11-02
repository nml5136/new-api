# hwao router 对 New API 上游文件的改动记录

原则：业务代码全部位于 `hwao/`（新增目录），对上游文件仅做最小挂钩，便于后续合并上游版本。

| 文件 | 改动 | 目的 |
|---|---|---|
| `middleware/request-id.go` | 新增 `var RequestIdOverride func(c *gin.Context) string`，生成请求号前优先调用 | 网关回环调用时用平台尝试号（X-Hwao-Attempt-Id，须带进程内密钥）作为 New API 日志 request_id，以便按尝试精确结算 |
| `main.go` | import `hwao/hapi`；`InitLogDB` 后调用 `hwaoapi.Migrate()` + `hwaoapi.StartJobs()`；`router.SetRouter` 前调用 `hwaoapi.SetRouter(server)` | 平台建表/种子/后台任务；平台路由与 `hwk-` 平台密钥网关中间件先于 New API 路由生效 |

未改动：New API 自有表结构、relay、计费、前端（`web/`）。平台前端独立为 `web-hwao/`，可通过 `HWAO_WEB_DIR` 由后端托管。

## 2026-10-27 运营台接真实接口 & 鉴权适配
- web-hwao：评测/定价/财务/告警审计/成员/预算等页面接入 /platform 真实接口，移除“演示”文案与硬编码用户名。
- web-hwao/src/lib/api.ts：适配上游 scoped access token（Bearer，仅存内存），401 时用 HttpOnly 刷新 Cookie 调 /api/user/auth/refresh 重试，登出走 /api/user/auth/logout。
- hwao/hapi/ops.go：告警处置写审计；hwao/hapi/portal.go + hservice/tenant.go：新增项目成员追加接口。
- router（上游文件）：新增 POST /platform/projects/:id/members。

## 2026-10-27 设置页复用 New API 原生能力
- web-hwao/src/pages/app/settings/page.tsx：个人资料（PUT /api/user/self）、登录会话（/api/user/sessions*）、2FA/Passkey 状态读取接 New API 原生接口；修改密码、2FA、访问令牌、通知设置跳转 New API 原生页面（/security、/profile）；企业资料只读；无后端新增，无上游文件改动。

## 2026-10-27 注册入口
- web-hwao：新增 /sign-up（及 /register）注册页，调用 New API /api/user/register，注册后自动登录并跳转 /activate（携带 ?code=）；首页导航与登录页增加“注册”入口。
- hwao/hapi/router.go：HWAO_WEB_ROOT 模式下 /sign-up、/register 由平台前端接管（原先落到未构建的 New API 前端导致白屏）。

## 2026-10-27 清理前端遗留演示数据
- web-hwao：总览问候改为按当前用户显示名/用户名与实时日期、时段计算；可用模型、待处理调用按真实数据统计。
- 移除 DemoController（演示状态切换器）；顶栏通知改为按待处理调用、预算占用、退款工单实时生成，无数据显示空状态。
- 预算接收人、退款开票抬头、调用详情、模型更新时间、场景单次上限、运营资源健康/评测进度改用真实数据或空状态。
- 首页、定价、文档、重置密码页移除“演示环境/演示数据”等表述；首页示意保留并标注“示意”。无上游文件改动。
- 顶栏企业徽标、头像改为取企业名/当前用户显示名首字（原硬编码“星”“林”）。

## 2026-10-27 网页自由对话（/app/chat）
- 新增 hwao/hapi/chat.go：/platform/chats 增删改查、消息列表、流式发送（复用 RunChat 网关链路：登录态鉴权、项目权限与预算、路由/兜底、按日志结算；服务端回环使用工作台内部密钥，浏览器不接触任何令牌）。
- hwao/hapi/gateway.go：RunChat/writeErr 增加 c.Set 钩子，供对话持久化回复正文与错误。
- hwao/hapi/router.go、jobs.go：注册对话路由；每小时清理超过 HWAO_CHAT_RETENTION_DAYS（默认 180 天）的对话正文。
- hwao/hmodel/models.go、sql/mysql/hwao_router.sql：新增 hwao_conversation、hwao_conversation_message。删除对话仅删正文与会话历史，hwao_request 与账务记录保留（FR21）。
- 上下文超限（FR10）：发送前按网关同口径预估，超限返回 context_length_exceeded，用户确认后裁剪较早消息重试。
- web-hwao：新增 pages/app/chat（Markdown + 代码高亮、SSE 流式、停止/重新生成提示计费、模型/路由模式选择、每条回复的实际模型/Token/费用/兜底说明、响应式）；导航“工作”组首项“对话”、侧栏按钮改为“新对话”；工作台结果新增“继续对话”。新增依赖 react-markdown、remark-gfm、rehype-highlight、highlight.js（不渲染原始 HTML）。
- 测试桩：runtime/mock_upstream.py（仓库外）已支持 stream，仅用于联调，可删除并把渠道 1 指回真实上游。
- 未改动 New API 上游文件。
- 2026-10-27：对话标题去除 Markdown 语法（hwao/hapi/chat.go plainTitle；前端展示兼容历史标题）。

## 2026-10-27 运营后台补全（资源与集成 / 场景策略 / 各页增删改）
- hwao/hmodel/models.go：新增 Supplier（hwao_supplier）；CatalogModel 增加 supplier_id；SceneVersion 增加 preference。
- hwao/hservice/routing.go：请求与项目未指定偏好时使用场景版本默认偏好。
- hwao/hapi/ops.go：模型保存校验供应商；场景版本保存增加字段校验。
- hwao/hapi/ops_ext.go（新）：供应商 CRUD、模型删除、价格重新同步、场景编辑/克隆/删除、草稿编辑、租户放量、邀请码作废、企业编辑。
- hwao/hapi/ops_channel.go（新）：New API 渠道适配层（进程内调用 New API 渠道控制器；列表/新建/编辑/启停/删除/测试/余额/全局重试次数），密钥只写不读、响应递归剔除 key。
- hwao/hapi/router.go：注册以上路由（渠道路由沿用 New API 渠道权限点）。
- sql/mysql/hwao_router.sql：hwao_supplier 建表、supplier_id / preference 字段与升级语句。
- web-hwao/src/components/ops/kit.tsx（新）：表格搜索/筛选/分页、确认弹窗、开关等运营通用组件。
- web-hwao/src/lib/ops-data.ts：加载供应商。
- web-hwao/src/pages/ops/resources：模型目录 / New API 渠道 / 供应商 / 变更记录 四个标签页的完整增删改。
- web-hwao/src/pages/ops/pricing：价格版本表格与新建版本抽屉（采购/零售/缓存价、含税、合同价、生效时间、理由、影响预览）、重新同步。
- web-hwao/src/pages/ops/scenes：场景新建/编辑/克隆/删除、版本草稿抽屉（候选排序）、评测通过、发布、回滚、停用/启用、租户放量。
- web-hwao/src/pages/ops/customers：企业搜索/筛选/分页、编辑预算与并发、邀请码作废。
- web-hwao/src/pages/ops/finance：登记线下充值（待确认到账后入账）。

## 前端 Tailwind CSS v3 → v4 升级（仅 web-hwao，未触及 New API 上游文件）
- 依赖：tailwindcss 3.4.19 → 4.x，新增 `@tailwindcss/vite`，移除 `postcss`、`autoprefixer`；删除 `tailwind.config.ts`、`postcss.config.ts`。
- `vite.config.ts` 接入 `@tailwindcss/vite` 插件；`src/index.css` 改为 `@import 'tailwindcss'`，主题迁移到 `@theme`（oklch 色阶变量保留，透明度修饰符可用）。
- 兼容 v3 默认值：边框默认色 gray-200、placeholder 颜色 gray-400、按钮 cursor:pointer；`ring`→`ring-3`、`shadow`/`rounded`/`outline-none` 等类名由官方升级工具批量改写。
- 浏览器要求随 v4 提升至 Chrome 111 / Safari 16.4 / Firefox 128 及以上。

## 2026-11-02 开启个人充值 / 兑换码 / 订阅（复用 New API 原生支付）
- 无上游文件改动、无表结构变更；后端只改 hwao/hapi/router.go：HWAO_WEB_ROOT 模式下把 New API 支付跳回地址 /usage-logs、/wallet 302 到平台 /app/wallet（保留查询参数），避免落到未构建的 New API 前端白屏。
- web-hwao 新增 /app/wallet「个人充值」：个人余额、订阅剩余额度、扣费顺序（subscription_first 等，PUT /api/user/self）；易支付在线充值（/api/user/amount、/api/user/pay）、兑换码（/api/user/topup）、订阅购买（/api/subscription/epay/pay）、个人 sk- 令牌（密钥只在创建后弹窗显示一次）、充值记录。
- web-hwao 新增 /ops/payments「支付与订阅」：易支付网关/商户号/商户密钥（只写不读，留空不改）、单价、最低充值、档位、回调地址（PUT /api/option/）；合规声明确认（/api/option/payment_compliance）；兑换码生成/列表；订阅套餐增改与上下架；个人充值订单与人工补单（/api/user/topup/complete）。
- lib/newapi-pay.ts：额度 ↔ 人民币换算（quota / quota_per_unit × usd_exchange_rate）、易支付表单提交；lib/api.ts 新增 patch()。
- 个人额度（New API 用户 quota，供 /v1 + sk- 令牌）与企业钱包（租户映射用户 quota，供 hwk- 平台密钥与工作台）相互独立。
- 本地联调用模拟易支付网关 runtime/mock_epay.py（仓库外，密钥在 runtime/.epay.local，600 权限，不入库）。

## 2026-11-02 企业钱包在线充值（微信 / 支付宝，复用易支付）

- 工作台「账单与充值」：仅企业管理员 / 财务可选择金额与方式（微信支付、支付宝、对公转账）；在线方式跳转易支付收银台，返回后提示并刷新；普通成员按钮禁用并提示，后端返回 403。
- 后端：`POST /platform/recharges/online` 在 `hwao_recharge_order` 建单（kind=pay，pay_channel=`epay_wxpay`/`epay_alipay`，订单号 `EP…`）；`GET /platform/recharges/options` 返回可用方式。
- 独立回调 `GET|POST /platform/epay/notify`：验签失败拒绝并审计；校验渠道、金额（分）、订单号；`SELECT … FOR UPDATE` 行锁 + 账本唯一 biz_no 保证幂等；成功经 `applyWallet` 入账，写审计 `recharge.online.credit`，自动纳入钱包对账。
- 未支付订单 30 分钟过期（status=`expired`，后台任务每 30 秒扫描）；过期后到达的支付成功回调不自动入账，记 `recharge.online.late` 审计 + 严重告警，由运营核实后「手工补单」（审计 `recharge.manual`）。
- 运营「对账与退款」：新增企业充值订单表（渠道中文、交易号、状态、时间），在线卡单 / 过期单支持手工补单。
- 套餐卡片有效期与重置周期改为中文（个月 / 天 / 年；不重置 / 每天重置…）。
- 数据库：无表结构变更（复用 pay_channel、status 字段的新取值），无需升级脚本。
- 个人充值、线下对公充值行为不变。
