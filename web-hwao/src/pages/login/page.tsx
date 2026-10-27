import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/feature/Logo";
import { Button, Input } from "@/components/base/ui";
import { cx } from "@/lib/format";
import { login } from "@/lib/api";
import { useDemo } from "@/lib/demo-store";

const flow = [
  { label: "生成商品文案", icon: "ri-quill-pen-line" },
  { label: "质量校验", icon: "ri-shield-check-line" },
  { label: "示例模型 A", icon: "ri-stack-line" },
  { label: "任务结果", icon: "ri-file-text-line" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUserState } = useDemo();
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("请输入用户名或邮箱。");
      return;
    }
    setLoading(true);
    // 调用 New API 登录接口，服务端写入会话 Cookie；密码不在本地保存
    login(email.trim(), password)
      .then((u) => {
        setUserState(u);
        const next = new URLSearchParams(window.location.search).get("next");
        navigate(next && next.startsWith("/") ? next : u.role >= 10 ? "/ops/overview" : "/app/overview");
      })
      .catch((err: Error) => setError(err.message || "登录失败"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background-50 lg:grid-cols-[1.12fr_1fr]">
      <div className="relative hidden overflow-hidden bg-background-950 px-10 py-9 text-background-50 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 hero-glow" />
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-25" />
        <div className="relative z-10">
          <Logo />
        </div>
        <div className="relative z-10 my-auto max-w-[420px]">
          <h1 className="font-heading text-[38px] font-semibold leading-tight">把模型选择，交给场景</h1>
          <p className="mt-3 text-sm leading-relaxed text-background-50/55">
            你只需要描述要完成的任务。平台完成场景校验、候选推荐、预算检查与会话保持，把结果与费用一并留下。
          </p>

          <div className="mt-9 rounded-2xl border border-background-50/12 bg-background-900/50 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between text-[10px] text-background-50/40">
              <span>任务路由演示</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-accent-500" />预算内</span>
            </div>
            <div className="space-y-2">
              {flow.map((item, i) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-background-50/8 text-background-50/60">
                    <i className={cx(item.icon, "text-[11px]")} />
                  </span>
                  <span className="text-[11px] text-background-50/75">{item.label}</span>
                  {i < flow.length - 1 ? <i className="ri-arrow-down-line ml-auto text-[10px] text-background-50/25" /> : null}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-background-50/10 pt-3 text-[10px] text-background-50/35">
              <span>实际模型：示例模型 A · 会话保持</span>
              <span className="tnum text-accent-400">¥0.04</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-warning bg-warning-soft px-3 py-2 text-[10px] text-warning">
            <i className="ri-flask-line" />
            使用 New API 平台账号登录；首次使用请通过邀请码开通企业。
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between text-[10px] text-background-50/30">
          <span>© 2026 Hwao Router · 企业 AI 调用平台</span>
          <Link to="/" className="hover:text-background-50/60">返回首页</Link>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-background-200 px-5 py-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500 text-background-50">
              <i className="ri-route-line text-[13px]" />
            </span>
            <span className="font-heading text-sm font-semibold text-foreground-950">Hwao Router</span>
          </Link>
          <span className="rounded-full bg-warning-soft px-2 py-1 text-[10px] text-warning">hwao router</span>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-5 py-10">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">企业登录</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground-950">进入你的工作区</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground-600">
              使用平台账号登录。平台管理员登录后进入运营端。
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-foreground-700">用户名 / 邮箱</label>
              <div className="relative">
                <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
                <Input
                  id="login-email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  placeholder="name@company.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-foreground-700">密码</label>
              <div className="relative">
                <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
                <Input
                  id="login-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-9"
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "隐藏密码" : "显示密码"}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-foreground-400 hover:bg-background-100 hover:text-foreground-700"
                >
                  <i className={cx(show ? "ri-eye-off-line" : "ri-eye-line", "text-sm")} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded-sm border-background-300"
                  style={{ accentColor: "oklch(var(--primary-500))" }}
                />
                记住登录
              </label>
              <Link to="/reset-password" className="text-[11px] text-primary-600 hover:text-primary-700">忘记密码？</Link>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-danger bg-danger-soft px-3 py-2.5 text-[11px] leading-relaxed text-danger">
                <i className="ri-error-warning-line mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  正在登录
                </>
              ) : (
                <>
                  登录
                  <i className="ri-arrow-right-line" />
                </>
              )}
            </Button>


          </form>

          <div className="mt-8 border-t border-background-200 pt-4 text-[11px] leading-relaxed text-foreground-500">
            <p>
              还没有账号？<Link to="/sign-up" className="text-primary-600 hover:text-primary-700">注册</Link>；已有账号但没有企业空间？<Link to="/activate" className="text-primary-600 hover:text-primary-700">使用邀请开通</Link>
            </p>
            <p className="mt-2 text-[10px] text-foreground-400">
              登录遇到问题可联系企业管理员或平台运营。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}