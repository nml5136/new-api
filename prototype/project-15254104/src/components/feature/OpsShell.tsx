import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { cx } from "@/lib/format";

const groups = [
  {
    title: "经营",
    items: [
      { to: "/ops/overview", label: "经营总览", icon: "ri-line-chart-line" },
      { to: "/ops/resources", label: "资源与集成", icon: "ri-server-line" },
      { to: "/ops/customers", label: "客户管理", icon: "ri-building-4-line" },
    ],
  },
  {
    title: "产品与质量",
    items: [
      { to: "/ops/scenes", label: "场景与策略", icon: "ri-node-tree" },
      { to: "/ops/evaluations", label: "评测中心", icon: "ri-test-tube-line" },
      { to: "/ops/pricing", label: "价格管理", icon: "ri-price-tag-3-line" },
    ],
  },
  {
    title: "财务与安全",
    items: [
      { to: "/ops/finance", label: "对账与退款", icon: "ri-scales-3-line" },
      { to: "/ops/audit", label: "告警与审计", icon: "ri-shield-check-line" },
    ],
  },
];

export default function OpsShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-background-950">
      <div className="flex h-16 flex-col justify-center border-b border-background-50/10 px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-background-50/20 bg-background-50/10 text-background-50">
            <i className="ri-route-line text-[13px]" />
          </span>
          <div className="leading-tight">
            <p className="font-heading text-[13px] font-semibold text-background-50">Hwao Router</p>
            <p className="text-[10px] text-accent-500">运营控制台</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-background-50/10 bg-background-50/5 px-2 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span className="text-[10px] text-background-50/60">演示环境 · 非生产</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 scroll-thin">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.16em] text-background-50/30">{group.title}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cx(
                      "flex h-9 items-center gap-2.5 rounded-lg px-2.5 transition-colors",
                      isActive
                        ? "bg-background-50/10 text-background-50"
                        : "text-background-50/55 hover:bg-background-50/5 hover:text-background-50/85",
                    )
                  }
                >
                  <i className={cx(item.icon, "text-[15px]")} />
                  <span className="text-[13px] whitespace-nowrap">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-background-50/10 p-3">
        <Link
          to="/app/overview"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-background-50/15 py-2 text-[11px] text-background-50/65 transition-colors hover:bg-background-50/10"
        >
          <i className="ri-arrow-left-line" />
          返回客户演示
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background-100">
      <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label="关闭导航" className="absolute inset-0 bg-background-950/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full w-[220px] animate-rise">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-background-200 bg-background-950">
          <div className="flex h-14 w-full items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              aria-label="打开导航"
              onClick={() => setOpen(true)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-background-50/70 hover:bg-background-50/10 lg:hidden"
            >
              <i className="ri-menu-line" />
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-background-50/15 px-2.5 py-1 text-[10px] text-background-50/65">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              演示环境
            </span>
            <span className="hidden text-[11px] text-background-50/40 md:inline">运营 · 陈屿</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 text-[11px] text-background-50/45 sm:flex">
                <i className="ri-links-line" />
                New API：模拟连接 · 待联调确认
              </span>
              <Link
                to="/app/overview"
                className="rounded-lg border border-background-50/20 px-2.5 py-1.5 text-[11px] text-background-50/75 transition-colors hover:bg-background-50/10 whitespace-nowrap"
              >
                切回客户视角
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-shell">{children}</div>
        </main>
      </div>
    </div>
  );
}