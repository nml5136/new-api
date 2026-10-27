import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "@/components/feature/Logo";
import { cx } from "@/lib/format";

const navLinks = [
  { to: "/#capabilities", label: "产品能力", section: "capabilities" },
  { to: "/#scenes", label: "场景", section: "scenes" },
  { to: "/pricing", label: "价格" },
  { to: "/docs", label: "开发文档" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.replace("#", ""));
    if (target) {
      window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [hash, pathname]);

  useEffect(() => {
    if (pathname !== "/") {
      setActiveSection("");
      return;
    }
    const onScroll = () => {
      const probe = window.scrollY + 120;
      const capabilities = document.getElementById("capabilities");
      const scenesEl = document.getElementById("scenes");
      if (scenesEl && probe >= scenesEl.offsetTop) {
        setActiveSection("scenes");
      } else if (capabilities && probe >= capabilities.offsetTop) {
        setActiveSection("capabilities");
      } else {
        setActiveSection("");
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background-50">
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled ? "border-b border-background-50/10 bg-background-950/90 backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-[72px] w-full items-center gap-6 px-4 md:px-8">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = link.section
                ? pathname === "/" && activeSection === link.section
                : pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(
                    "rounded-full px-3.5 py-2 text-[13px] transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-background-50/10 text-background-50"
                      : "text-background-50/65 hover:bg-background-50/10 hover:text-background-50",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-[13px] text-background-50/75 transition-colors hover:text-background-50 whitespace-nowrap"
            >
              登录
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-background-50 px-4 py-2.5 text-[13px] font-medium text-background-950 transition-colors hover:bg-background-100 whitespace-nowrap"
            >
              开始体验
              <i className="ri-arrow-right-line text-sm" />
            </Link>
          </div>
          <button
            type="button"
            aria-label="打开菜单"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-background-50/80 hover:bg-background-50/10 md:hidden"
          >
            <i className={cx(open ? "ri-close-line" : "ri-menu-line", "text-xl")} />
          </button>
        </div>
        {open ? (
          <div className="border-t border-background-50/10 bg-background-950/98 px-4 pb-5 pt-3 md:hidden">
            <nav className="flex flex-col">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="border-b border-background-50/5 py-3 text-sm text-background-50/80"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/login"
                className="rounded-xl border border-background-50/20 py-2.5 text-center text-sm text-background-50"
              >
                登录
              </Link>
              <Link
                to="/login"
                className="rounded-xl bg-background-50 py-2.5 text-center text-sm font-medium text-background-950"
              >
                开始体验
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      <footer className="border-t border-background-50/10 bg-background-950 px-4 pb-8 pt-14 md:px-8">
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="flex flex-col gap-10 border-b border-background-50/10 pb-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-4 text-xs leading-relaxed text-background-50/50">
                本页面为产品流程演示原型，所有模型、密钥、金额与支付均为演示数据，不代表已完成的真实部署与联调。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-background-50/35">产品</p>
                <div className="flex flex-col gap-2 text-xs text-background-50/65">
                  <Link to="/#capabilities" className="hover:text-background-50">能力说明</Link>
                  <Link to="/#scenes" className="hover:text-background-50">一期场景</Link>
                  <Link to="/pricing" className="hover:text-background-50">计费与价格</Link>
                  <Link to="/docs" className="hover:text-background-50">开发接入</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-background-50/35">工作台</p>
                <div className="flex flex-col gap-2 text-xs text-background-50/65">
                  <Link to="/app/overview" className="hover:text-background-50">客户总览</Link>
                  <Link to="/app/scenes" className="hover:text-background-50">场景中心</Link>
                  <Link to="/app/billing" className="hover:text-background-50">账单与充值</Link>
                  <Link to="/ops/overview" className="hover:text-background-50">运营演示</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-background-50/35">支持</p>
                <div className="flex flex-col gap-2 text-xs text-background-50/65">
                  <Link to="/activate" className="hover:text-background-50">邀请与企业开通</Link>
                  <Link to="/login" className="hover:text-background-50">登录演示账号</Link>
                  <Link to="/pricing" className="hover:text-background-50">费用与退款规则</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 text-[11px] text-background-50/40 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Hwao Router · 原型演示，不构成服务承诺</p>
            <div className="flex flex-wrap items-center gap-4">
              <span>服务条款</span>
              <span>隐私说明</span>
              <span>必要署名与许可</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}