// 平台数据中心：原型的演示状态已替换为真实接口（/platform/*）。
// 保留原有导出名（DemoProvider/useDemo）以便页面最小改动；所有金额后端以“分”存储，此处换算为“元”。
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { scenes as sceneCopy } from "@/mocks/demo";
import {
  ApiError, del, fen2yuan, get, getUser, post, put, raw, sceneFromApi, sceneToApi, ts2str, yuan2fen, type SessionUser,
} from "@/lib/api";
import type {
  ApiKey, Draft, ExecFailure, ExecInput, ExecSuccess, Member, ModelInfo, Order, Project, RecordStatus, RefundRequest,
  Scene, SceneId, Task, UsageRecord,
} from "@/lib/types";

const DRAFT_KEY = "hwao-drafts-v1"; // 草稿仅保存在本机

export interface MeInfo {
  user_id: number;
  tenant: any | null;
  role?: string;
  is_staff: boolean;
  balance_fen?: number;
}

interface StoreState {
  user: SessionUser | null;
  me: MeInfo | null;
  loading: boolean;
  error: string;
  balance: number;
  reserved: number;
  monthBudget: number;
  monthSpend: number;
  singleCap: number;
  currentProjectId: string;
  projects: Project[];
  keys: ApiKey[];
  records: UsageRecord[];
  tasks: Task[];
  orders: Order[];
  refunds: RefundRequest[];
  members: Member[];
  drafts: Record<string, Draft>;
  models: ModelInfo[];
  scenes: Scene[];
  rawProjects: any[];
  overview: any | null;
}

const empty: StoreState = {
  user: null, me: null, loading: true, error: "",
  balance: 0, reserved: 0, monthBudget: 0, monthSpend: 0, singleCap: 1,
  currentProjectId: "", projects: [], keys: [], records: [], tasks: [], orders: [], refunds: [], members: [],
  drafts: {}, models: [], scenes: [], rawProjects: [], overview: null,
};

const roleName: Record<string, Member["role"]> = { tenant_admin: "企业管理员", tenant_member: "使用成员", tenant_finance: "财务成员" };
const roleCode: Record<string, string> = { 企业管理员: "tenant_admin", 使用成员: "tenant_member", 财务成员: "tenant_finance" };

const keyStatus = (s: number): ApiKey["status"] => (s === 1 || s === 4 ? "active" : s === 2 ? "disabled" : "revoked");

const recStatus = (s: string): RecordStatus =>
  s === "succeeded" ? "completed" : s === "executing" || s === "pending" ? "streaming" : s === "interrupted" ? "interrupted" : s === "unknown" ? "unknown" : "failed";

const billStatus = (s: string): UsageRecord["billing"] =>
  s === "settled" ? "settled" : s === "released" || s === "none" ? "released" : s === "reserved" ? "reserved" : "pending";

const orderStatus = (s: string): Order["status"] => (s === "credited" ? "paid" : s === "closed" || s === "abnormal" ? "failed" : "pending");

const refundStatus = (s: string): RefundRequest["status"] =>
  s === "pending" || s === "applied" ? "reviewing" : s === "locked" ? "locked" : s === "external" || s === "unknown" ? "refunding" : s === "done" ? "done" : "pending";

export const mapRecord = (r: any): UsageRecord => ({
  id: r.request_id,
  time: ts2str(r.created_at),
  projectId: String(r.project_id),
  scene: sceneFromApi(r.scene_id || "") as SceneId,
  model: r.actual_model || r.requested_model || "—",
  status: recStatus(r.status),
  billing: billStatus(r.billing_status),
  tokensIn: r.prompt_tokens || 0,
  tokensOut: r.completion_tokens || 0,
  cost: r.billing_status === "settled" ? fen2yuan(r.net_cost_fen) : r.status === "unknown" ? null : fen2yuan(r.estimated_cost_fen),
  duration: r.latency_ms ? `${(r.latency_ms / 1000).toFixed(1)}s` : "—",
  title: `${r.scene_id || r.requested_model} · ${r.route_mode}${r.is_stream ? " · 流式" : ""}`,
  attempts: (r.attempts || []).map((a: any) => ({
    channel: `渠道 #${a.channel_id} · ${a.model_name}`,
    result: a.status === "succeeded" ? "success" : a.http_status === 429 ? "rate_limited" : "timeout",
    latency: a.finished_at && a.created_at ? `${a.finished_at - a.created_at}s` : "—",
  })),
  notes: [r.policy_version && `策略 ${r.policy_version}`, r.fallback && `已兜底：${r.fallback_reason}`, r.error_message].filter(Boolean).join("；"),
});

const mapModel = (m: any): ModelInfo => {
  const md = m.model, pr = m.price || {};
  return {
    id: md.model_name,
    name: md.display_name || md.model_name,
    version: md.model_name,
    scenes: [],
    tags: [md.support_json && "结构化输出", md.support_stream && "流式"].filter(Boolean) as string[],
    context: md.context_length ? `${Math.round(md.context_length / 1000)}K` : "—",
    structured: !!md.support_json,
    priceIn: fen2yuan(pr.input_price),
    priceOut: fen2yuan(pr.output_price),
    status: md.status === "on_sale" ? "available" : md.status === "restricted" ? "restricted" : "unavailable",
    latency: md.avg_latency_ms ? `${(md.avg_latency_ms / 1000).toFixed(1)}s` : "—",
    note: `价格版本 v${pr.version ?? "—"}${pr.tax_included ? " · 含税" : ""}`,
    channel: md.vendor || "New API",
    quality: (md.quality_level || 0) * 20,
  };
};

interface Ctx extends StoreState {
  reload: () => Promise<void>;
  setUserState: (u: SessionUser | null) => void;
  setCurrentProject: (id: string) => void;
  saveDraft: (p: Omit<Draft, "id">) => string;
  removeDraft: (id: string) => void;
  executeTask: (input: ExecInput) => Promise<ExecSuccess | ExecFailure>;
  finalizeRecord: (id: string) => void;
  interruptRecord: (id: string) => void;
  resolveRecord: (id: string, outcome?: "completed" | "failed") => Promise<void>;
  updateBudget: (p: { monthBudget?: number; singleCap?: number }) => Promise<void>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  createProject: (p: { name: string; description: string; budget: number }) => Promise<Project>;
  createKey: (p: { name: string; projectId: string; limit: number; expiresAt: string }) => Promise<{ key: ApiKey; plain: string }>;
  setKeyStatus: (id: string, status: ApiKey["status"]) => Promise<void>;
  rotateKey: (id: string) => Promise<string>;
  createRecharge: (amount: number) => Promise<string>;
  settleOrder: (id: string) => Promise<void>;
  failOrder: (id: string) => void;
  createRefund: (p: { type: RefundRequest["type"]; recordId: string; amount: number; reason: string }) => Promise<string>;
  advanceRefund: (id: string) => Promise<void>;
  inviteMember: (p: { email: string; role: Member["role"]; projects: string[] }) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
}

const C = createContext<Ctx | null>(null);

const loadDrafts = (): Record<string, Draft> => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<StoreState>(() => ({ ...empty, user: getUser(), drafts: loadDrafts() }));

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(s.drafts));
    } catch {
      /* 忽略 */
    }
  }, [s.drafts]);

  const reload = useCallback(async () => {
    const user = getUser();
    if (!user) {
      setS((p) => ({ ...p, user: null, me: null, loading: false }));
      return;
    }
    try {
      const me = await get<MeInfo>("/platform/me");
      const catalog = await get<any>("/platform/catalog").catch(() => ({ models: [], scenes: [] }));
      const models = (catalog.models || []).map(mapModel);
      const pubScenes: string[] = (catalog.scenes || []).map((x: any) => x.scene.scene_id);
      const scenes = (sceneCopy as unknown as Scene[]).map((sc) => {
        const api = (catalog.scenes || []).find((x: any) => x.scene.scene_id === sceneToApi[sc.id]);
        return api ? { ...sc, name: api.scene.name || sc.name } : sc;
      });
      // 场景模型候选：已发布场景对所有可售模型开放（具体候选由服务端策略决定）
      models.forEach((m: ModelInfo) => (m.scenes = pubScenes.map((x) => sceneFromApi(x))));
      if (!me.tenant) {
        setS((p) => ({ ...p, user, me, models, scenes, loading: false, error: "" }));
        return;
      }
      const [projects, keys, reqs, budgets, billing, members, overview] = await Promise.all([
        get<any[]>("/platform/projects"),
        get<any[]>("/platform/keys"),
        get<any>("/platform/requests?size=100"),
        get<any>("/platform/budgets").catch(() => null),
        get<any>("/platform/billing").catch(() => null),
        get<any[]>("/platform/members").catch(() => []),
        get<any>("/platform/overview").catch(() => null),
      ]);
      const bp = (budgets?.projects || []) as any[];
      const projs: Project[] = projects.map((p) => {
        const b = bp.find((x) => x.project.id === p.id);
        return {
          id: String(p.id),
          name: p.name,
          description: [p.is_default && "默认项目", `路由：${p.default_route_mode}`, `偏好：${p.preference}`].filter(Boolean).join(" · "),
          owner: "",
          scenes: p.scene_whitelist ? p.scene_whitelist.split(",").map(sceneFromApi) : pubScenes.map(sceneFromApi),
          monthlyBudget: fen2yuan(p.monthly_budget),
          spent: fen2yuan(b?.month?.used || 0),
          status: p.status === 1 ? "active" : "paused",
          keys: keys.filter((k) => k.project_id === p.id && k.status !== 3).length,
        };
      });
      const records = (reqs?.items || []).map(mapRecord);
      const t = budgets?.tenant || {};
      setS((p) => {
        const cur = projs.find((x) => x.id === p.currentProjectId) ? p.currentProjectId : projs[0]?.id || "";
        const rp = projects.find((x) => String(x.id) === cur);
        return {
          ...p, user, me, models, scenes, loading: false, error: "", overview, rawProjects: projects,
          balance: fen2yuan(me.balance_fen), reserved: fen2yuan((t.month?.reserved || 0) + (t.month?.inflight || 0)),
          monthBudget: fen2yuan(me.tenant.monthly_budget), monthSpend: fen2yuan(t.month?.used || 0),
          singleCap: rp?.max_cost_per_call ? fen2yuan(rp.max_cost_per_call) : 1,
          currentProjectId: cur, projects: projs,
          keys: keys.map((k) => ({
            id: String(k.id), name: k.name, projectId: String(k.project_id), masked: `${k.prefix}••••••••`,
            status: keyStatus(k.status), createdAt: ts2str(k.created_at).slice(0, 10),
            expiresAt: k.expires_at ? ts2str(k.expires_at).slice(0, 10) : "长期", limit: fen2yuan(k.quota_limit),
          })),
          records,
          tasks: records.slice(0, 10).map((r: UsageRecord) => ({ id: r.id, title: r.title, scene: r.scene, model: r.model, createdAt: r.time, status: r.status, cost: r.cost, recordId: r.id })),
          orders: (billing?.orders || []).map((o: any) => ({
            id: o.order_no, amount: fen2yuan(o.amount), status: orderStatus(o.status), createdAt: ts2str(o.created_at),
            channel: o.pay_channel === "bank" ? "对公转账" : o.pay_channel || o.kind, note: o.remark || o.status,
          })),
          refunds: (billing?.refunds || []).map((r: any) => ({
            id: r.refund_no, type: r.kind === "recharge_refund" ? "unused" : "verify", recordId: r.order_no || r.request_id || "",
            amount: fen2yuan(r.amount), reason: r.reason, status: refundStatus(r.status), createdAt: ts2str(r.created_at),
          })),
          members: (members || []).map((m: any) => ({
            id: String(m.user_id), name: m.username || `用户${m.user_id}`, email: m.username || "", role: roleName[m.role] || "使用成员",
            projects: [], lastActive: ts2str(m.created_at), status: "active",
          })),
        };
      });
    } catch (e) {
      const err = e as ApiError;
      setS((p) => ({ ...p, loading: false, error: err.message, user: err.status === 401 ? null : p.user }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setUserState = useCallback((u: SessionUser | null) => {
    setS((p) => ({ ...p, user: u, loading: !!u }));
    if (u) reload();
  }, [reload]);

  const setCurrentProject = useCallback((id: string) => {
    setS((p) => {
      const rp = p.rawProjects.find((x) => String(x.id) === id);
      return { ...p, currentProjectId: id, singleCap: rp?.max_cost_per_call ? fen2yuan(rp.max_cost_per_call) : 1 };
    });
  }, []);

  const saveDraft = useCallback((payload: Omit<Draft, "id">) => {
    const id = `draft_${Date.now()}`;
    setS((p) => ({ ...p, drafts: { ...p.drafts, [id]: { ...payload, id } } }));
    return id;
  }, []);

  const removeDraft = useCallback((id: string) => {
    setS((p) => {
      const d = { ...p.drafts };
      delete d[id];
      return { ...p, drafts: d };
    });
  }, []);

  // executeTask 通过工作台接口发起真实调用（服务端使用工作台内部密钥，浏览器不接触任何密钥）
  const executeTask = useCallback(async (input: ExecInput): Promise<ExecSuccess | ExecFailure> => {
    const sc = sceneToApi[input.scene] || input.scene;
    try {
      const { res, data } = await raw(
        "POST",
        `/platform/chat/completions?project_id=${encodeURIComponent(input.projectId)}`,
        { model: `scene:${sc}`, stream: false, messages: [{ role: "user", content: `${input.title}\n\n${input.prompt}` }] },
        { "X-Max-Cost-CNY": String(s.singleCap || 1), "Idempotency-Key": `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      );
      const rid = res.headers.get("X-Request-Id") || data?.id || "";
      const output: string = data?.choices?.[0]?.message?.content ?? "";
      let rec: UsageRecord;
      try {
        rec = mapRecord(await get<any>(`/platform/requests/${rid}`));
      } catch {
        rec = {
          id: rid, time: ts2str(Date.now() / 1000), projectId: input.projectId, scene: input.scene, model: data?.model || "—",
          status: "completed", billing: "pending", tokensIn: data?.usage?.prompt_tokens || 0, tokensOut: data?.usage?.completion_tokens || 0,
          cost: null, duration: "—", title: input.title, attempts: [], notes: "费用结算中",
        };
      }
      rec = { ...rec, title: input.title, prompt: input.prompt, output, checks: [] };
      setS((p) => ({
        ...p,
        records: [rec, ...p.records.filter((r) => r.id !== rec.id)],
        tasks: [{ id: rec.id, title: input.title, scene: input.scene, model: rec.model, createdAt: rec.time, status: rec.status, cost: rec.cost, recordId: rec.id }, ...p.tasks],
      }));
      const model = s.models.find((m) => m.id === rec.model) || ({ name: rec.model, id: rec.model } as ModelInfo);
      setTimeout(reload, 1500); // 结算为异步，稍后刷新余额与费用
      return { ok: true, record: rec, output, model, estimated: rec.cost ?? 0 };
    } catch (e) {
      const err = e as ApiError;
      const reason = /balance|quota|余额/.test(err.code + err.message) ? "balance" : "budget";
      return { ok: false, reason, message: `${err.message}${err.requestId ? `（请求号 ${err.requestId}）` : ""}` };
    }
  }, [s.singleCap, s.models, reload]);

  const finalizeRecord = useCallback(() => void reload(), [reload]);
  const interruptRecord = useCallback(() => void reload(), [reload]);

  // resolveRecord 查询服务端最新状态（结果未知由后台对账任务确认，前端不直接改状态）
  const resolveRecord = useCallback(async (id: string) => {
    const r = mapRecord(await get<any>(`/platform/requests/${id}`));
    setS((p) => ({ ...p, records: p.records.map((x) => (x.id === id ? { ...x, ...r, title: x.title, output: x.output, prompt: x.prompt } : x)) }));
  }, []);

  const updateProjectRaw = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const cur = s.rawProjects.find((x) => String(x.id) === id);
    if (!cur) return;
    await put(`/platform/projects/${id}`, { ...cur, ...patch });
  }, [s.rawProjects]);

  const updateBudget = useCallback(async (p: { monthBudget?: number; singleCap?: number }) => {
    if (p.monthBudget !== undefined && s.me?.tenant) {
      const t = s.me.tenant;
      await put("/platform/budgets/tenant", { daily_budget: t.daily_budget, monthly_budget: yuan2fen(p.monthBudget), max_concurrency: t.max_concurrency, alert_thresholds: t.alert_thresholds });
    }
    if (p.singleCap !== undefined && s.currentProjectId) {
      setS((x) => ({ ...x, singleCap: p.singleCap! }));
      await updateProjectRaw(s.currentProjectId, { max_cost_per_call: yuan2fen(p.singleCap) });
    }
    await reload();
  }, [s.me, s.currentProjectId, updateProjectRaw, reload]);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const m: Record<string, unknown> = {};
    if (patch.monthlyBudget !== undefined) m.monthly_budget = yuan2fen(patch.monthlyBudget);
    if (patch.status) m.status = patch.status === "active" ? 1 : 2;
    if (patch.name) m.name = patch.name;
    await updateProjectRaw(id, m);
    await reload();
  }, [updateProjectRaw, reload]);

  const createProject = useCallback(async (p: { name: string; description: string; budget: number }) => {
    const r = await post<any>("/platform/projects", { name: p.name, monthly_budget: yuan2fen(p.budget), preference: "balanced", default_route_mode: "scene" });
    await reload();
    setS((x) => ({ ...x, currentProjectId: String(r.id) }));
    return { id: String(r.id), name: r.name, description: p.description, owner: "", scenes: [], monthlyBudget: p.budget, spent: 0, status: "active", keys: 0 } as Project;
  }, [reload]);

  const createKey = useCallback(async (p: { name: string; projectId: string; limit: number; expiresAt: string }) => {
    const exp = p.expiresAt && /^\d{4}-\d{2}-\d{2}/.test(p.expiresAt) ? Math.floor(new Date(`${p.expiresAt}T23:59:59`).getTime() / 1000) : 0;
    const r = await post<any>("/platform/keys", { name: p.name, project_id: Number(p.projectId), quota_limit: yuan2fen(p.limit), expires_at: exp });
    await reload();
    const k = r.info;
    return {
      plain: r.key as string,
      key: { id: String(k.id), name: k.name, projectId: String(k.project_id), masked: `${k.prefix}••••••••`, status: "active", createdAt: ts2str(k.created_at).slice(0, 10), expiresAt: p.expiresAt, limit: p.limit } as ApiKey,
    };
  }, [reload]);

  const setKeyStatus = useCallback(async (id: string, st: ApiKey["status"]) => {
    await post(`/platform/keys/${id}/${st === "active" ? "enable" : st === "disabled" ? "disable" : "revoke"}`);
    await reload();
  }, [reload]);

  const rotateKey = useCallback(async (id: string) => {
    const r = await post<any>(`/platform/keys/${id}/rotate`);
    await reload();
    return (r?.key as string) || "";
  }, [reload]);

  const createRecharge = useCallback(async (amount: number) => {
    const o = await post<any>("/platform/recharges", { amount: yuan2fen(amount), remark: "企业提交对公转账充值申请" });
    await reload();
    return o.order_no as string;
  }, [reload]);

  const settleOrder = useCallback(async () => {
    await reload(); // 入账由运营核对到账后确认，这里仅刷新进度
  }, [reload]);
  const failOrder = useCallback(() => void reload(), [reload]);

  const createRefund = useCallback(async (p: { type: RefundRequest["type"]; recordId: string; amount: number; reason: string }) => {
    if (p.type === "unused") {
      const r = await post<any>("/platform/refunds", { order_no: p.recordId, amount: yuan2fen(p.amount), reason: p.reason });
      await reload();
      return r.refund_no as string;
    }
    // 费用核验：提交反馈工单，由运营核对后通过“补偿”入账
    await post("/platform/feedback", { request_id: p.recordId, correct: false, reject_reason: "price", comment: `费用核验申请 ¥${p.amount}：${p.reason}` });
    await reload();
    return p.recordId;
  }, [reload]);

  const advanceRefund = useCallback(async () => {
    await reload(); // 退款审核由运营/财务处理，这里仅刷新
  }, [reload]);

  const inviteMember = useCallback(async (p: { email: string; role: Member["role"]; projects: string[] }) => {
    const m = await post<any>("/platform/members", { username: p.email, role: roleCode[p.role] || "tenant_member" });
    // p.projects 为项目名称；逐个追加，不覆盖项目已有成员
    for (const name of p.projects) {
      const pj = s.projects.find((x) => x.name === name);
      if (pj) await post(`/platform/projects/${pj.id}/members`, { user_id: m.user_id });
    }
    await reload();
  }, [s.projects, reload]);

  const removeMember = useCallback(async (id: string) => {
    await del(`/platform/members/${id}`);
    await reload();
  }, [reload]);

  const value = useMemo<Ctx>(() => ({
    ...s, reload, setUserState, setCurrentProject, saveDraft, removeDraft, executeTask, finalizeRecord, interruptRecord, resolveRecord,
    updateBudget, updateProject, createProject, createKey, setKeyStatus, rotateKey, createRecharge, settleOrder, failOrder,
    createRefund, advanceRefund, inviteMember, removeMember,
  }), [s, reload, setUserState, setCurrentProject, saveDraft, removeDraft, executeTask, finalizeRecord, interruptRecord, resolveRecord,
    updateBudget, updateProject, createProject, createKey, setKeyStatus, rotateKey, createRecharge, settleOrder, failOrder,
    createRefund, advanceRefund, inviteMember, removeMember]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDemo() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}
