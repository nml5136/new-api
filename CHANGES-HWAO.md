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
