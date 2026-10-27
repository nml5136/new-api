# Hwao Router · 场景驱动型 Token 智能聚合分销平台（高保真原型）

## 1. Project Description
面向中小企业与小型技术团队的 AI 模型聚合服务原型。客户从具体任务场景出发，平台推荐符合质量、预算与权限要求的模型，并提供连续会话、调用记录、预算与统一账单。采用"自建产品层 + New API 底座"的表达方式，客户只看到一套统一产品与一个企业钱包。
本阶段交付可点击跑通的中文高保真前端原型，不接入真实支付、真实模型服务或 New API 管理接口。

## 2. Page Structure
公共站点
- `/` 欢迎与产品介绍
- `/pricing` 计费说明与价格
- `/docs` 开发接入文档
- `/login` 登录
- `/activate` 邀请与企业开通
- `/reset-password` 重置密码

客户工作台
- `/app/overview` 总览
- `/app/scenes` 场景中心
- `/app/workspace` 任务与会话
- `/app/models` 模型目录
- `/app/projects` 项目
- `/app/keys` API Key
- `/app/budgets` 预算
- `/app/requests` 调用记录
- `/app/billing` 账单与充值
- `/app/refunds` 退款与开票
- `/app/members` 成员与权限
- `/app/settings` 企业与个人设置

运营后台
- `/ops/overview` 经营与运行总览
- `/ops/resources` 模型资源与集成
- `/ops/scenes` 场景与路由策略
- `/ops/evaluations` 评测中心
- `/ops/customers` 客户管理
- `/ops/pricing` 价格管理
- `/ops/finance` 对账与退款
- `/ops/audit` 告警与审计

## 3. Core Features
- [x] 三个一期场景（电商文案 / 办公摘要 / 结构化信息提取）的输入、生成、结果展示
- [x] 经济 / 均衡 / 质量优先偏好与可解释的模型推荐
- [x] 演示预算校验、费用结算、余额与本月消费同步
- [x] 同模型多渠道容灾、流式中断、结果未知等模拟状态
- [x] 项目、API Key（一次性明文展示）、预算分配
- [x] 调用记录筛选、请求详情抽屉（路由 / 费用 / 事件）
- [x] 模拟充值状态机、退款申请与进度
- [x] 成员角色与设置分区
- [x] 运营侧策略发布、评测对比、对账差异、告警审计
- [x] 演示数据统一状态仓库 + 重置演示数据
- [x] 响应式布局与减少动态效果支持

## 4. Data Model Design
本原型不连接数据库。使用前端统一演示状态仓库（localStorage 持久化假数据）：
- enterprise：余额、月预算、本月消费、在途预留、默认单次上限
- project：名称、描述、允许场景、月预算、已用、状态
- apiKey：名称、所属项目、掩码、状态、有效期
- record（调用记录）：请求号、场景、实际模型、结果状态、计费状态、用量、失败尝试、耗时
- task：标题、场景、模型、费用、关联请求
- order / refund：金额、状态、关联记录
- ops：策略版本、评测、渠道健康、对账差异、告警与审计（静态演示数据）

## 5. Backend / Third-party Integration Plan
- Database：暂不连接，使用统一演示数据 + 浏览器存储；后续如需真实账户体系再接入 Readdy Backend 或 SaaS Supabase。
- Payment：仅模拟支付状态机，不接真实支付渠道。
- New API / 模型服务：仅以前端说明与状态呈现，不发起真实请求。
- Email：不发送真实邮件，重置密码与开通均为模拟。

## 6. Development Phase Plan

### Phase 1: 视觉体系与公共入口
- Goal: 建立设计系统、路由骨架、公共站点视觉
- Deliverable: 欢迎页、登录页、定价页、开发文档、开通与重置密码

### Phase 2: 客户工作台核心闭环
- Goal: 统一演示状态与任务闭环
- Deliverable: 全局工作台框架、总览、场景中心、任务工作区、模型目录

### Phase 3: 开发与财务页面
- Goal: 项目、密钥、预算、调用记录、账单、退款、成员、设置

### Phase 4: 运营控制台
- Goal: 独立运营框架与策略、评测、财务、审计页面

### Phase 5: 全站打磨
- Goal: 状态补齐、响应式与动效收敛、构建校验