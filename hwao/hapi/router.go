package hapi

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/hwao/hmodel"
	"github.com/QuantumNous/new-api/hwao/hservice"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

// Migrate 建表（GORM AutoMigrate；DDL 与 sql/mysql/hwao_router.sql 保持一致）并写入种子数据。
func Migrate() error {
	if err := hservice.DB().AutoMigrate(hmodel.AllModels()...); err != nil {
		return err
	}
	hservice.SeedDefaults()
	return nil
}

// userAuthThen 在已注册的路由中按需执行 New API 登录鉴权。
func userAuthThen(c *gin.Context, fn func()) {
	middleware.UserAuth()(c)
	if !c.IsAborted() {
		fn()
	}
}

// SetRouter 注册平台路由；须在 New API 路由之前调用，以便网关中间件先于 relay 生效。
func SetRouter(r *gin.Engine) {
	r.Use(Gateway())
	r.GET("/platform/requests/:id", getRequest) // 平台密钥或登录态

	u := r.Group("/platform", middleware.UserAuth())
	u.GET("/me", me)
	u.POST("/tenant/open", openTenant)
	u.GET("/catalog", listCatalog)
	u.GET("/overview", overview)
	u.GET("/projects", listProjects)
	u.POST("/projects", saveProject)
	u.PUT("/projects/:id", saveProject)
	u.PUT("/projects/:id/members", setProjectMembers)
	u.POST("/projects/:id/members", addProjectMember)
	u.GET("/members", listMembers)
	u.POST("/members", addMember)
	u.DELETE("/members/:id", removeMember)
	u.GET("/keys", listKeys)
	u.POST("/keys", createKey)
	u.POST("/keys/:id/:action", keyAction)
	u.GET("/requests", listRequests)
	u.POST("/chat/completions", workbenchChat)
	u.GET("/sessions", listSessions)
	u.GET("/sessions/:sid", sessionMessages)
	u.DELETE("/sessions/:sid", sessionMessages)
	u.GET("/budgets", budgets)
	u.PUT("/budgets/tenant", saveTenantBudget)
	u.GET("/billing", billingOverview)
	u.POST("/refunds", applyRefund)
	u.POST("/recharges", applyRecharge)
	u.POST("/feedback", submitFeedback)

	o := r.Group("/platform/ops", middleware.AdminAuth())
	o.GET("/overview", opsOverview)
	o.GET("/invites", opsListInvites)
	o.POST("/invites", opsCreateInvite)
	o.GET("/tenants", opsListTenants)
	o.POST("/tenants/:id/:action", opsTenantAction)
	o.GET("/models", opsListModels)
	o.POST("/models", opsSaveModel)
	o.PUT("/models/:id", opsSaveModel)
	o.GET("/prices", opsListPrices)
	o.POST("/prices", opsPublishPrice)
	o.GET("/scenes", opsListScenes)
	o.POST("/scenes/versions", opsSaveSceneVersion)
	o.POST("/scenes/:id/:action", opsSceneAction) // evaluated/publish 传版本 id；rollback/disable/enable 传场景 ID
	o.POST("/evals", opsAddEval)
	o.GET("/requests", opsRequests)
	o.GET("/finance", opsFinance)
	o.POST("/recharges", opsRecharge)
	o.POST("/recharges/:no/confirm", opsConfirmRecharge)
	o.POST("/compensations", opsCompensate)
	o.POST("/refunds/:no/:action", opsRefundAction)
	o.POST("/recon/run", opsRunRecon)
	o.POST("/recon/diffs/:id", opsResolveDiff)
	o.GET("/alerts", opsAlerts)
	o.PUT("/alerts/:id", opsAlertUpdate)
	o.GET("/audit", opsAudit)

	serveWeb(r)
}

// serveWeb 若设置 HWAO_WEB_DIR，则在 /app、/ops 及公开页下托管 web-hwao 构建产物（不改动 New API 内嵌前端）。
func serveWeb(r *gin.Engine) {
	dir := os.Getenv("HWAO_WEB_DIR")
	if dir == "" {
		return
	}
	r.Static("/hwao-assets", filepath.Join(dir, "hwao-assets"))
	index := filepath.Join(dir, "index.html")
	h := func(c *gin.Context) { c.File(index) }
	paths := []string{"/app", "/app/*any", "/ops", "/ops/*any", "/hwao", "/hwao/*any"}
	// HWAO_WEB_ROOT=true 时由平台前端接管首页与公开页（/、/login 等），New API 自带控制台仍可通过 /console 访问
	if os.Getenv("HWAO_WEB_ROOT") == "true" {
		paths = append(paths, "/", "/login", "/pricing", "/docs", "/activate", "/reset-password", "/sign-up", "/register")
	}
	for _, p := range paths {
		r.GET(p, h)
	}
	common.SysLog("hwao web served from " + strings.TrimSpace(dir))
}
