// 注册页：调用 New API 原生 /api/user/register 创建平台账号，成功后自动登录并跳转企业开通（携带邀请码）。
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Field, Input } from "@/components/base/ui";
import { ApiError, login, post } from "@/lib/api";

export default function SignUpPage() {
  const navigate = useNavigate();
  const qs = new URLSearchParams(window.location.search);
  const code = qs.get("code") || "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // 与 New API 校验保持一致：用户名 ≤20 位，密码 8–128 位
    if (!username.trim() || username.trim().length > 20) return setError("用户名为 1–20 个字符");
    if (password.length < 8) return setError("密码至少 8 位");
    if (password !== password2) return setError("两次输入的密码不一致");
    setLoading(true);
    try {
      await post("/api/user/register", { username: username.trim(), password });
      await login(username.trim(), password);
      navigate(code ? `/activate?code=${encodeURIComponent(code)}` : "/activate");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-50 px-4">
      <div className="w-full max-w-[380px]">
        <Link to="/" className="text-[11px] text-foreground-500 hover:text-foreground-800">← 返回首页</Link>
        <h1 className="mt-4 text-xl font-semibold text-foreground-950">注册平台账号</h1>
        <p className="mt-1 text-[11.5px] text-foreground-600">注册后可使用邀请码开通企业空间，或由企业管理员将你加入项目。</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="用户名"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="1–20 个字符" autoComplete="username" /></Field>
          <Field label="密码"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" autoComplete="new-password" /></Field>
          <Field label="确认密码"><Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" /></Field>
          {error ? <div className="rounded-xl border border-danger bg-danger-soft px-3 py-2.5 text-[11px] text-danger">{error}</div> : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? "正在注册…" : "注册并继续"}</Button>
        </form>
        <p className="mt-6 text-[11px] text-foreground-500">已有账号？<Link to={`/login${code ? `?next=${encodeURIComponent(`/activate?code=${code}`)}` : ""}`} className="text-primary-600">去登录</Link></p>
      </div>
    </div>
  );
}
