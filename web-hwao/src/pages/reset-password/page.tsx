import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/feature/Logo";
import { Button, Input, Notice } from "@/components/base/ui";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("linchen@xinglan.cn");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("请输入有效的企业邮箱地址。");
      return;
    }
    setError("");
    setSent(true);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background-950 px-4 py-8">
      <div className="pointer-events-none absolute inset-0 hero-glow opacity-60" />
      <div className="relative z-10 flex items-center justify-between">
        <Logo />
        <Link to="/login" className="text-[11px] text-background-50/55 hover:text-background-50">返回登录</Link>
      </div>

      <div className="relative z-10 my-auto flex w-full justify-center py-10">
        <div className="w-full max-w-[420px] rounded-2xl border border-background-50/12 bg-background-900/70 p-6 backdrop-blur md:p-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300">
            <i className="ri-lock-password-line text-lg" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold text-background-50">重置登录密码</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-background-50/55">
            输入绑定的邮箱，我们会发送重置说明。
          </p>

          {sent ? (
            <div className="mt-5 space-y-4">
              <Notice tone="success" icon="ri-mail-check-line">
                已模拟发送重置说明到 {email}。如未收到，请检查企业邮箱或联系企业管理员。
              </Notice>
              <Button variant="light" className="w-full" onClick={() => setSent(false)}>
                重新发送
              </Button>
              <Link to="/login" className="block text-center text-[11px] text-background-50/45 hover:text-background-50/75">
                返回登录页
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-[11px] text-background-50/60">企业邮箱</label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-background-50/35" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-background-50/15 bg-background-50/5 pl-9 text-background-50 placeholder:text-background-50/30"
                    placeholder="name@company.com"
                  />
                </div>
              </div>
              {error ? <p className="text-[11px] text-danger">{error}</p> : null}
              <Button type="submit" className="w-full">
                发送重置说明
                <i className="ri-send-plane-line" />
              </Button>
              <p className="text-center text-[10px] text-background-50/30">
                出于安全考虑，我们不会在页面上确认该邮箱是否已注册。
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}