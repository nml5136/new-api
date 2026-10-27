import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Logo from "@/components/feature/Logo";
import { useDemo } from "@/lib/demo-store";
import { cx, money } from "@/lib/format";

const groups = [
  {
    title: "工作",
    items: [
      { to: "/app/overview", label: "总览", icon: "ri-dashboard-line" },
      { to: "/app/scenes", label: "场景中心", icon: "ri-layout-grid-line" },
      { to: "/app/workspace", label: "任务与会话", icon: "ri-sparkling-2-line" },
      { to: "/app/models", label: "模型目录", icon: "ri-stack-line" },
    ],
  },
  {
    title: "开发与管理",
    items: [
      { to: "/app/projects", label: "项目", icon: "ri-folder-3-line" },
      { to: "/app/keys", label: "API Key", icon: "ri-key-2-line" },
      { to: "/app/budgets", label: "预算", icon: "ri-wallet-3-line" },
      { to: "/app/requests", label: "调用记录", icon: "ri-file-list-3-line" },
    ],
  },
  {
    title: "财务与组织",
    items: [
      { to: "/app/billing", label: "账单充值", icon: "ri-bank-card-line" },
      { to: "/app/refunds", label: "退款开票", icon: "ri-arrow-go-back-line" },
      { to: "/app/members", label: "成员权限", icon: "ri-team-line" },
    ],
  },
];

const searchTargets = [
  { label: "开始电商文案任务", to: "/app/workspace", icon: "ri-quill-pen-line", hint: "任务" },
  { label: "场景中心", to: "/app/scenes", icon: "ri-layout-grid-line", hint: "页面" },
  { label: "调用记录", to: "/app/requests", icon: "ri-file-list-3-line", hint: "页面" },
  { label: "账单与充值", to: "/app/billing", icon: "ri-bank-card-line", hint: "页面" },
  { label: "企业预算", to: "/app/budgets", icon: "ri-wallet-3-line", hint: "页面" },
  { label: "创建 API Key", to: "/app/keys", icon: "ri-key-2-line", hint: "操作" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { balance, monthSpend, monthBudget, projects, currentProjectId, setCurrentProject, records, user, me, refunds } = useDemo();
  // 通知中心：由真实调用记录、预算与退款数据计算，无事项时显示空状态
  const pendingRecs = records.filter((r) => r.status === "unknown" || r.status === "interrupted");
  const budgetPct = monthBudget ? Math.round((monthSpend / monthBudget) * 100) : 0;
  const openRefunds = refunds.filter((r) => r.status !== "done");
  const notices = [
    pendingRecs.length ? { to: "/app/requests", title: `${pendingRecs.length} 条调用结果待确认`, sub: pendingRecs[0].id } : null,
    monthBudget && budgetPct >= 70 ? { to: "/app/budgets", title: `本月预算使用 ${budgetPct}%`, sub: `剩余 ${money(monthBudget - monthSpend)}` } : null,
    openRefunds.length ? { to: "/app/refunds", title: `${openRefunds.length} 笔退款处理中`, sub: openRefunds[0].id } : null,
  ].filter(Boolean) as { to: string; title: string; sub: string }[];
  const uname = user?.display_name || user?.username || "未登录";
  const roleLabel = ({ tenant_admin: "企业管理员", tenant_member: "使用成员", tenant_finance: "财务成员" } as Record<string, string>)[me?.role || ""] || "成员";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const noticeRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setNoticeOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (noticeRef.current && !noticeRef.current.contains(e.target as Node)) setNoticeOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? projects[0];
  const results = useMemo(
    () => searchTargets.filter((item) => (query ? item.label.includes(query) : true)),
    [query],
  );
  const recent = records.slice(0, 3);

  const sidebar = (
    <div className="flex h-full flex-col bg-background-950">
      <div className={cx("flex h-16 items-center border-b border-background-50/10", collapsed ? "justify-center px-2" : "px-4")}>
        {collapsed ? <Logo tone="light" compact /> : <Logo tone="light" />}
      </div>

      <div className="px-3 pt-4">
        <Link
          to="/app/workspace"
          className={cx(
            "flex items-center rounded-xl bg-primary-500 text-background-50 transition-colors hover:bg-primary-600",
            collapsed ? "h-10 justify-center" : "h-10 gap-2 px-3",
          )}
          title="新建任务"
        >
          <i className="ri-add-line text-base" />
          {collapsed ? null : <span className="text-[13px] font-medium whitespace-nowrap">新建任务</span>}
        </Link>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2 pb-4 scroll-thin">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-background-50/10" />
            ) : (
              <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.16em] text-background-50/30">{group.title}</p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    cx(
                      "group flex items-center rounded-lg transition-colors",
                      collapsed ? "h-9 justify-center" : "h-9 gap-2.5 px-2.5",
                      isActive
                        ? "bg-background-50/10 text-background-50"
                        : "text-background-50/55 hover:bg-background-50/5 hover:text-background-50/85",
                    )
                  }
                >
                  <i className={cx(item.icon, "text-[15px]")} />
                  {collapsed ? null : <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-background-50/10 px-2 py-3">
        <Link
          to="/app/settings"
          className={cx(
            "flex items-center rounded-lg text-background-50/55 transition-colors hover:bg-background-50/5 hover:text-background-50/85",
            collapsed ? "h-9 justify-center" : "h-9 gap-2.5 px-2.5",
          )}
        >
          <i className="ri-settings-3-line text-[15px]" />
          {collapsed ? null : <span className="text-[13px]">设置</span>}
        </Link>
        <Link to="/app/billing" className={cx("mt-1 block rounded-xl bg-background-50/5 p-2.5 transition-colors hover:bg-background-50/10", collapsed ? "hidden" : "")}>
          <p className="text-[10px] text-background-50/40">企业可用余额</p>
          <p className="tnum mt-1 font-heading text-sm font-semibold text-background-50">{money(balance)}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-background-50/10">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${Math.min(100, (monthSpend / monthBudget) * 100)}%` }}
            />
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mt-2 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[11px] text-background-50/40 transition-colors hover:bg-background-50/5 hover:text-background-50/70"
        >
          <i className={cx(collapsed ? "ri-contract-left-line" : "ri-contract-right-line", "text-sm")} />
          {collapsed ? null : "收起侧栏"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background-100">
      <aside
        className={cx(
          "sticky top-0 hidden h-screen shrink-0 border-r border-background-50/5 transition-all duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-[224px]",
        )}
      >
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label="关闭导航" className="absolute inset-0 bg-background-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full w-[232px] animate-rise">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-background-200 bg-background-50/92 backdrop-blur-md">
          <div className="flex h-16 w-full items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              aria-label="打开导航"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100 lg:hidden"
            >
              <i className="ri-menu-line text-lg" />
            </button>

            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 text-[11px] font-semibold text-foreground-700">星</span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-medium text-foreground-900">{me?.tenant?.name || "未开通企业"}</p>
                <p className="text-[10px] text-foreground-500">{roleLabel} · {uname}</p>
              </div>
            </div>

            <div className="mx-1 hidden h-6 w-px bg-background-200 md:block" />

            <div className="relative min-w-0">
              <select
                value={currentProject?.id}
                onChange={(e) => setCurrentProject(e.target.value)}
                aria-label="选择项目"
                className="h-9 max-w-[180px] cursor-pointer appearance-none rounded-lg border border-background-200 bg-background-50 pl-2.5 pr-7 text-xs font-medium text-foreground-800 hover:border-background-300 focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-background-200 bg-background-50 px-2.5 text-xs text-foreground-500 transition-colors hover:border-background-300 md:w-[260px]"
            >
              <i className="ri-search-line text-sm" />
              <span className="hidden sm:inline">搜索场景、项目或记录</span>
              <span className="ml-auto hidden rounded border border-background-200 px-1.5 py-0.5 text-[10px] text-foreground-400 md:inline">⌘K</span>
            </button>

            <div className="ml-auto flex items-center gap-1.5 md:ml-0">
              <div ref={noticeRef} className="relative">
                <button
                  type="button"
                  aria-label="通知"
                  onClick={() => setNoticeOpen((v) => !v)}
                  className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-foreground-600 hover:bg-background-100"
                >
                  <i className="ri-notification-3-line text-base" />
                  {notices.length ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning" /> : null}
                </button>
                {noticeOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-lift">
                    <p className="border-b border-background-100 px-3.5 py-2.5 text-xs font-medium text-foreground-900">需要处理</p>
                    <div className="divide-y divide-background-100">
                      {notices.length === 0 ? <p className="px-3.5 py-4 text-[11px] text-foreground-400">暂无待处理事项</p> : null}
                      {notices.map((n) => (
                        <Link key={n.to} to={n.to} className="block px-3.5 py-2.5 hover:bg-background-100">
                          <p className="text-xs text-foreground-900">{n.title}</p>
                          <p className="mt-0.5 text-[11px] text-foreground-500">{n.sub}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  aria-label="账户菜单"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary-800 text-[11px] font-medium text-background-50"
                >
                  林
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-[210px] overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-lift">
                    <div className="border-b border-background-100 px-3.5 py-2.5">
                      <p className="text-xs font-medium text-foreground-900">{uname}</p>
                      <p className="text-[11px] text-foreground-500">{user?.username}</p>
                    </div>
                    <Link to="/app/settings" className="block px-3.5 py-2 text-xs text-foreground-700 hover:bg-background-100">企业设置</Link>
                    <Link to="/app/members" className="block px-3.5 py-2 text-xs text-foreground-700 hover:bg-background-100">成员与权限</Link>
                    {(user?.role ?? 0) >= 10 ? <Link to="/ops/overview" className="block px-3.5 py-2 text-xs text-foreground-700 hover:bg-background-100">进入运营后台</Link> : null}
                    <Link to="/" className="block border-t border-background-100 px-3.5 py-2 text-xs text-foreground-500 hover:bg-background-100">返回公共站点</Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-shell">{children}</div>
        </main>
      </div>

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background-950/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-background-200 bg-background-50 shadow-lift animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-background-100 px-4">
              <i className="ri-search-line text-foreground-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索场景、项目或记录…"
                className="h-12 w-full bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none"
              />
              <button type="button" onClick={() => setPaletteOpen(false)} className="cursor-pointer text-[11px] text-foreground-400">ESC</button>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2 scroll-thin">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-foreground-500">没有匹配的入口，换个关键词试试。</p>
              ) : (
                results.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      navigate(item.to);
                      setPaletteOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-background-100"
                  >
                    <i className={cx(item.icon, "text-base text-foreground-500")} />
                    <span className="text-xs text-foreground-900">{item.label}</span>
                    <span className="ml-auto text-[10px] text-foreground-400">{item.hint}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-background-100 px-4 py-2 text-[10px] text-foreground-400">
              快速跳转 · 最近任务：{recent[0]?.title ?? "暂无"}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}