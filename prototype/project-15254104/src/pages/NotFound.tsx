import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background-950 px-4 text-background-50">
      <div className="pointer-events-none absolute inset-0 hero-glow opacity-60" />
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-20" />
      <div className="relative z-10 w-full max-w-[420px] text-center">
        <p className="font-heading text-[72px] font-semibold leading-none tracking-tight text-background-50/20">404</p>
        <h1 className="mt-2 font-heading text-xl font-semibold">这个页面不在地图上</h1>
        <p className="mt-2 text-xs leading-relaxed text-background-50/50">
          路由不存在，或该入口尚未在当前原型阶段开放。你可以返回首页，或直接进入客户工作台。
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to="/" className="inline-flex h-10 items-center justify-center rounded-xl bg-background-50 px-5 text-xs font-medium text-background-950">
            返回首页
          </Link>
          <Link to="/app/overview" className="inline-flex h-10 items-center justify-center rounded-xl border border-background-50/20 px-5 text-xs text-background-50/80">
            进入工作台
          </Link>
        </div>
        <p className="mt-6 text-[10px] text-background-50/25">403 · 企业停用 · 系统维护等状态在本原型中以文案说明表达。</p>
      </div>
    </div>
  );
}