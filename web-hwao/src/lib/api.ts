// hwao router 前端接口封装：使用 New API 登录会话（HttpOnly Cookie）+ New-Api-User 头。
// 浏览器中不保存任何管理员凭据、内部令牌或上游密钥；平台密钥明文仅在创建时展示一次。

const USER_KEY = "hwao-user"; // 仅保存用户 id / 用户名 / 角色等非敏感信息

export interface SessionUser {
  id: number;
  username: string;
  display_name?: string;
  role: number; // New API 角色：>=10 为平台管理员
}

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;
  retryable?: boolean;
  constructor(status: number, code: string, message: string, requestId?: string, retryable?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

export const getUser = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
};

const setUser = (u: SessionUser | null) => {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(USER_KEY);
};

// 访问令牌只保存在内存中（不落 localStorage）；刷新令牌由服务端以 HttpOnly Cookie 下发。
// 页面刷新后通过 /api/user/auth/refresh 用 Cookie 换取新的访问令牌。
let accessToken = "";
let accessExpiresAt = 0;
const SID_KEY = "hwao.sid";
let refreshing: Promise<boolean> | null = null;

const applyBundle = (b: any) => {
  accessToken = b?.access_token || "";
  accessExpiresAt = b?.access_expires_at || 0;
  if (b?.session?.sid) sessionStorage.setItem(SID_KEY, b.session.sid);
};

export async function refreshAuth(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const sid = sessionStorage.getItem(SID_KEY);
        const res = await fetch("/api/user/auth/refresh", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", ...(sid ? { "X-Auth-Session": sid } : {}) },
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.success) return false;
        applyBundle(d.data);
        const u = d.data?.user;
        if (u) setUser({ id: u.id, username: u.username, display_name: u.display_name, role: u.role });
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

const headers = (extra?: Record<string, string>): Record<string, string> => {
  const h: Record<string, string> = { "Content-Type": "application/json", ...(extra ?? {}) };
  const u = getUser();
  if (u) h["New-Api-User"] = String(u.id);
  if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
  return h;
};

// raw 发起请求并统一解析 New API {success,message,data} 与平台 {code,message,request_id,retryable} 两种格式
export async function raw(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<{ res: Response; data: any }> {
  const isAuth = path.startsWith("/api/user/login") || path.startsWith("/api/user/auth/");
  // 访问令牌缺失或即将过期时先刷新
  if (!isAuth && getUser() && (!accessToken || (accessExpiresAt && accessExpiresAt * 1000 < Date.now() + 15000))) await refreshAuth();
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: headers(extra),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (res.status === 401 && !isAuth) {
    if (getUser() && (await refreshAuth())) return raw(method, path, body, extra);
    setUser(null);
    accessToken = "";
  }
  if (!res.ok || (data && data.success === false)) {
    const code = data?.code || data?.error?.code || String(res.status);
    const msg = data?.message || data?.error?.message || `请求失败（${res.status}）`;
    throw new ApiError(res.status, code, msg, data?.request_id || res.headers.get("X-Request-Id") || undefined, data?.retryable);
  }
  return { res, data };
}

export async function api<T = any>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  const { data } = await raw(method, path, body, extra);
  return (data && "data" in data ? data.data : data) as T;
}

export const get = <T = any>(p: string) => api<T>("GET", p);
export const post = <T = any>(p: string, b?: unknown) => api<T>("POST", p, b ?? {});
export const put = <T = any>(p: string, b?: unknown) => api<T>("PUT", p, b ?? {});
export const del = <T = any>(p: string) => api<T>("DELETE", p);

// login 走 New API 原生登录接口：返回访问令牌（仅存内存）并写入刷新 Cookie
export async function login(username: string, password: string): Promise<SessionUser> {
  const b = await api<any>("POST", "/api/user/login", { username, password });
  if (b?.require_2fa) throw new ApiError(400, "2fa_required", "该账号开启了两步验证，请在 New API 控制台完成登录");
  applyBundle(b);
  const u = (b?.user ?? b) as SessionUser;
  const su: SessionUser = { id: u.id, username: u.username, display_name: u.display_name, role: u.role };
  setUser(su);
  return su;
}

export async function register(username: string, password: string, email?: string) {
  return api("POST", "/api/user/register", { username, password, password2: password, email });
}

export async function logout() {
  try {
    await api("POST", "/api/user/auth/logout");
  } finally {
    setUser(null);
    accessToken = "";
    sessionStorage.removeItem(SID_KEY);
  }
}

// 金额换算：后端统一以“分”存储
export const fen2yuan = (f: number | null | undefined) => (f == null ? 0 : f / 100);
export const yuan2fen = (y: number) => Math.round(y * 100);
export const ts2str = (t?: number) => {
  if (!t) return "—";
  const d = new Date(t * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 场景 ID 映射：原型使用语义 ID，后端使用 SC01–SC03
export const sceneToApi: Record<string, string> = { "commerce-copy": "SC01", "office-summary": "SC02", "info-extract": "SC03" };
export const sceneFromApi = (id: string) =>
  (Object.entries(sceneToApi).find(([, v]) => v === id)?.[0] ?? id) as any;

// streamFetch 发起需要登录态的流式请求（SSE）；与 raw 一致使用内存访问令牌，不暴露任何内部令牌。
export async function streamFetch(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  if (getUser() && (!accessToken || (accessExpiresAt && accessExpiresAt * 1000 < Date.now() + 15000))) await refreshAuth();
  const go = () => fetch(path, { method: "POST", credentials: "same-origin", headers: headers({ Accept: "text/event-stream" }), body: JSON.stringify(body), signal });
  let res = await go();
  if (res.status === 401 && getUser() && (await refreshAuth())) res = await go();
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new ApiError(res.status, d?.code || d?.error?.code || String(res.status), d?.message || d?.error?.message || `请求失败（${res.status}）`, d?.request_id || res.headers.get("X-Request-Id") || undefined, d?.retryable);
  }
  return res;
}
