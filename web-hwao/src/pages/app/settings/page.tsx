// 企业与个人设置：一律复用 New API 原生能力（用户资料、会话、2FA/Passkey、密码、通知），不另建后端。
// New API 没有的能力（企业资料编辑、手机号、历史保存策略等）只读展示并标注，待产品决策。
import { useEffect, useState } from "react";
import { Badge, Button, Field, Input, Notice, PageHeader } from "@/components/base/ui";
import { ApiError, del, get, post, put, ts2str } from "@/lib/api";
import { cx } from "@/lib/format";

const sections = [
  { id: "company", label: "企业资料", icon: "ri-building-4-line" },
  { id: "profile", label: "个人资料", icon: "ri-user-3-line" },
  { id: "security", label: "安全", icon: "ri-shield-keyhole-line" },
  { id: "notify", label: "通知", icon: "ri-notification-3-line" },
  { id: "history", label: "历史与数据", icon: "ri-database-2-line" },
] as const;
type SectionId = (typeof sections)[number]["id"];

type SessionView = { sid: string; current: boolean; login_method: string; ip: string; user_agent: string; last_active_at: number };

// New API 原生控制台页面（同一登录会话，刷新 Cookie 共享）
const NATIVE = { profile: "/profile", security: "/security" };

function NativeLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a href={to} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline">
      {children} <i className="ri-external-link-line" />
    </a>
  );
}

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "操作失败，请稍后重试");

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>("company");
  const [notice, setNotice] = useState("");
  const [me, setMe] = useState<any>(null);
  const [self, setSelf] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [twoFA, setTwoFA] = useState<boolean | null>(null);
  const [passkey, setPasskey] = useState<boolean | null>(null);

  const save = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const loadSessions = () => get<SessionView[]>("/api/user/sessions").then((s) => setSessions(s || [])).catch(() => setSessions([]));

  useEffect(() => {
    get("/platform/me").then(setMe).catch(() => null);
    get("/api/user/self").then((u) => { setSelf(u); setDisplayName(u?.display_name || ""); }).catch(() => null);
    get<any>("/api/user/2fa/status").then((d) => setTwoFA(!!d?.enabled)).catch(() => setTwoFA(null));
    get<any>("/api/user/passkey").then((d) => setPasskey(!!d?.enabled)).catch(() => setPasskey(null));
    loadSessions();
  }, []);

  // 通知设置来自 New API 用户 setting（额度预警）
  const setting = (() => {
    try { return typeof self?.setting === "string" ? JSON.parse(self.setting || "{}") : self?.setting || {}; } catch { return {}; }
  })();

  return (
    <div>
      <PageHeader title="企业与个人设置" description="账号安全、会话与通知复用 New API 账号体系。" />
      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      <div className="flex flex-col gap-4 md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-40 md:flex-col">
          {sections.map((item) => (
            <button key={item.id} type="button" onClick={() => setSection(item.id)}
              className={cx("flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11.5px] transition-colors",
                section === item.id ? "bg-primary-50 text-primary-700" : "text-foreground-600 hover:bg-background-100")}>
              <i className={item.icon} />{item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1 rounded-xl border border-background-200 p-5">
          {section === "company" ? (
            <div className="max-w-[640px]">
              <h2 className="text-sm font-semibold text-foreground-950">企业资料</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="企业名称" hint="只读"><Input value={me?.tenant?.name || ""} readOnly className="bg-background-100" /></Field>
                <Field label="开通编号" hint="只读"><Input value={me?.tenant?.provision_no || ""} readOnly className="bg-background-100" /></Field>
                <Field label="我的角色" hint="只读"><Input value={me?.role || ""} readOnly className="bg-background-100" /></Field>
                <Field label="结算币种" hint="只读"><Input value="人民币 CNY" readOnly className="bg-background-100" /></Field>
              </div>
              <Notice tone="neutral" icon="ri-information-line" className="mt-4">企业资料由平台运营维护，如需修改请联系运营。</Notice>
            </div>
          ) : null}

          {section === "profile" ? (
            <div className="max-w-[640px]">
              <h2 className="text-sm font-semibold text-foreground-950">个人资料</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="平台用户名" hint="只读"><Input value={self?.username || ""} readOnly className="bg-background-100" /></Field>
                <Field label="显示名称"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></Field>
                <Field label="邮箱" hint="在 New API 个人中心绑定"><Input value={self?.email || "未绑定"} readOnly className="bg-background-100" /></Field>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={async () => {
                  try {
                    // 复用 New API PUT /api/user/self 更新显示名称
                    await put("/api/user/self", { username: self?.username, display_name: displayName.trim() });
                    save("个人资料已保存");
                  } catch (e) { save(errMsg(e)); }
                }}>保存资料</Button>
                <NativeLink to={NATIVE.profile}>邮箱 / 第三方账号绑定</NativeLink>
              </div>
            </div>
          ) : null}

          {section === "security" ? (
            <div className="max-w-[640px] space-y-3">
              <h2 className="text-sm font-semibold text-foreground-950">安全</h2>
              <div className="flex items-center justify-between rounded-xl border border-background-200 p-4">
                <div><p className="text-[11.5px] font-medium">登录密码</p><p className="text-[10px] text-foreground-500">修改需二次身份校验，在 New API 安全中心完成。</p></div>
                <NativeLink to={NATIVE.security}>修改密码</NativeLink>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-background-200 p-4">
                <div>
                  <p className="text-[11.5px] font-medium">两步验证（TOTP） / Passkey</p>
                  <p className="mt-1 flex gap-2 text-[10px]">
                    <Badge tone={twoFA ? "success" : "neutral"}>2FA {twoFA == null ? "—" : twoFA ? "已开启" : "未开启"}</Badge>
                    <Badge tone={passkey ? "success" : "neutral"}>Passkey {passkey == null ? "—" : passkey ? "已绑定" : "未绑定"}</Badge>
                  </p>
                </div>
                <NativeLink to={NATIVE.security}>去设置</NativeLink>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-background-200 p-4">
                <div><p className="text-[11.5px] font-medium">个人访问令牌</p><p className="text-[10px] text-foreground-500">用于调用 New API 管理接口；调用模型请使用“项目密钥”。</p></div>
                <NativeLink to={NATIVE.security}>管理</NativeLink>
              </div>
              <div className="rounded-xl border border-background-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11.5px] font-medium">登录会话</p>
                  <button type="button" className="cursor-pointer text-[10.5px] text-danger hover:underline" onClick={async () => {
                    try { await post("/api/user/sessions/revoke-others"); save("已撤销其他所有会话"); loadSessions(); } catch (e) { save(errMsg(e)); }
                  }}>撤销其他会话</button>
                </div>
                <div className="mt-2 divide-y divide-background-100">
                  {sessions.length === 0 ? <p className="py-2 text-[10.5px] text-foreground-400">暂无会话数据</p> : null}
                  {sessions.map((s) => (
                    <div key={s.sid} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] text-foreground-800">{s.user_agent || s.login_method}</p>
                        <p className="text-[9.5px] text-foreground-400">{s.ip} · {ts2str(s.last_active_at)}</p>
                      </div>
                      {s.current ? <Badge tone="success">当前</Badge> : (
                        <button type="button" className="cursor-pointer text-[10px] text-foreground-500 hover:text-danger" onClick={async () => {
                          try { await del(`/api/user/sessions/${encodeURIComponent(s.sid)}`); save("该会话已撤销"); loadSessions(); } catch (e) { save(errMsg(e)); }
                        }}>撤销</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Notice tone="neutral" icon="ri-lock-line">项目密钥的来源 IP 白名单在“密钥”页设置，网关与 New API 令牌（allow_ips）双重校验。</Notice>
            </div>
          ) : null}

          {section === "notify" ? (
            <div className="max-w-[640px]">
              <h2 className="text-sm font-semibold text-foreground-950">通知</h2>
              <p className="mt-1 text-[11px] text-foreground-600">通知复用 New API 的额度预警（邮件 / Webhook / Bark / Gotify），在 New API 个人中心配置。</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="额度预警"><Input readOnly className="bg-background-100" value={setting.quota_warning_enabled === false ? "未开启" : "已开启"} /></Field>
                <Field label="通知方式"><Input readOnly className="bg-background-100" value={setting.notify_type || "email"} /></Field>
              </div>
              <div className="mt-4"><NativeLink to={NATIVE.profile}>修改通知设置</NativeLink></div>
            </div>
          ) : null}

          {section === "history" ? (
            <div className="max-w-[640px]">
              <h2 className="text-sm font-semibold text-foreground-950">历史与数据</h2>
              <Notice tone="neutral" icon="ri-information-line" className="mt-3">
                调用记录保存策略按平台统一配置执行（New API 日志清理由运营在后台设置），一期暂不支持企业自定义保存天数或自助删除正文。
              </Notice>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
