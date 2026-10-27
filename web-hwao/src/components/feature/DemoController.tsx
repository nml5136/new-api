import { useNavigate } from "react-router-dom";
import { logout } from "@/lib/api";
import { useDemo } from "@/lib/demo-store";

// 原型中的“演示场景切换器”已移除，此处改为当前账号与退出登录
export default function DemoController() {
  const { user, setUserState } = useDemo();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={async () => {
        await logout().catch(() => null);
        setUserState(null);
        navigate("/login");
      }}
      className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs text-foreground-600 hover:bg-background-100"
      title="退出登录"
    >
      <i className="ri-logout-box-r-line text-sm" />
      <span className="hidden sm:inline">{user?.display_name || user?.username || ""}</span>
    </button>
  );
}
