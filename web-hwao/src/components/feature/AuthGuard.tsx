import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDemo } from "@/lib/demo-store";

// AuthGuard 登录与权限守卫：未登录跳转登录页；用户端要求已加入企业；运营端要求 New API 管理员角色（>=10）
export default function AuthGuard({ need, children }: { need: "tenant" | "staff"; children: ReactNode }) {
  const { user, me, loading, error } = useDemo();
  const { pathname } = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (loading || !me)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground-500">
        {error ? `加载失败：${error}` : "正在加载…"}
      </div>
    );
  if (need === "staff" && !(user.role >= 10 || me.is_staff))
    return <div className="flex min-h-screen items-center justify-center text-sm text-foreground-500">当前账号无运营端权限</div>;
  if (need === "tenant" && !me.tenant) return <Navigate to="/activate" replace />;
  return <>{children}</>;
}
