// 运营端数据适配：调用 /platform/ops/* 并转换为原型页面使用的展示结构。
// 所有金额以分返回，这里统一换算为元；不涉及任何凭证。
import { useCallback, useEffect, useState } from "react";
import { api, get, ts2str } from "@/lib/api";

const yuan = (f?: number) => `¥${((f || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");

const tenantStatus: Record<string, string> = { pending: "待创建", configuring: "开通中", enabled: "已启用", failed: "开通失败", disabled: "已暂停" };
const modelStatus: Record<string, string> = { pending: "待核验", testing: "测试中", on_sale: "健康", paused: "暂停销售", offline: "已下线" };
const sceneStatus: Record<string, string> = { draft: "草稿", evaluated: "评测通过", published: "已发布", disabled: "已停用" };
const alertLevel: Record<string, string> = { critical: "严重", warn: "警告", info: "提示" };
const alertStatus: Record<string, string> = { open: "待处理", handling: "处理中", resolved: "已恢复" };
const diffKind: Record<string, string> = { pay_vs_newapi: "支付对账", newapi_vs_platform: "消费对账", upstream_vs_platform: "上游采购" };
const diffStatus: Record<string, string> = { open: "待核对", resolved: "已处理", ignored: "已忽略" };
const orderStatus: Record<string, string> = { unpaid: "待到账", confirming: "确认中", crediting: "入账中", credited: "已入账", closed: "已关闭", abnormal: "异常待核对" };
const refundStatus: Record<string, string> = { pending: "待审核", locked: "额度锁定", external: "外部退款中", done: "已完成", failed: "已失败", unknown: "结果待确认", rejected: "已驳回" };

export interface OpsRaw {
  overview: any;
  tenants: any[];
  invites: any[];
  models: any[];
  prices: any[];
  scenes: any[];
  finance: { orders: any[]; refunds: any[]; diffs: any[] };
  alerts: any[];
  audit: any[];
}

const empty: OpsRaw = { overview: {}, tenants: [], invites: [], models: [], prices: [], scenes: [], finance: { orders: [], refunds: [], diffs: [] }, alerts: [], audit: [] };

// useOps 一次性加载运营端数据；act 执行写操作后自动刷新
export function useOps() {
  const [raw, setRaw] = useState<OpsRaw>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, d: T) => p.catch((e: Error) => { setError(e.message); return d; });
    const [overview, tenants, invites, models, prices, scenes, finance, alerts, audit] = await Promise.all([
      safe(get("/platform/ops/overview"), {}),
      safe(get("/platform/ops/tenants?size=200"), { items: [] }),
      safe(get("/platform/ops/invites?size=100"), { items: [] }),
      safe(get("/platform/ops/models"), []),
      safe(get("/platform/ops/prices?size=200"), { items: [] }),
      safe(get("/platform/ops/scenes"), []),
      safe(get("/platform/ops/finance"), { orders: [], refunds: [], diffs: [] }),
      safe(get("/platform/ops/alerts?size=100"), { items: [] }),
      safe(get("/platform/ops/audit?size=100"), { items: [] }),
    ]);
    setRaw({
      overview: overview || {}, tenants: tenants?.items || [], invites: invites?.items || [], models: models || [],
      prices: prices?.items || [], scenes: scenes || [], finance: { orders: finance?.orders || [], refunds: finance?.refunds || [], diffs: finance?.diffs || [] },
      alerts: alerts?.items || [], audit: audit?.items || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const act = useCallback(async (method: string, path: string, body?: unknown, okMsg = "操作已完成") => {
    try {
      const r = await api(method, `/platform/ops${path}`, body ?? {});
      setNotice(okMsg);
      setError("");
      await reload();
      return r;
    } catch (e) {
      setError((e as Error).message);
      setNotice("");
      return undefined;
    }
  }, [reload]);

  const ov = raw.overview || {};
  const tenantName = (id: number) => raw.tenants.find((t) => t.tenant.id === id)?.tenant.name || (id ? `企业 #${id}` : "平台");
  const priceOf = (name: string) => raw.prices.filter((p) => p.model_name === name && p.tenant_id === 0).sort((a, b) => b.version - a.version)[0];

  const opsMetrics = [
    { label: "近 30 天服务收入", value: yuan(ov.cost_fen), delta: `${ov.total || 0} 次调用`, note: "已结算口径" },
    { label: "预估采购成本", value: yuan(ov.purchase_fen), delta: `${ov.pending_settle || 0} 笔待核对`, note: "预估" },
    { label: "贡献毛利", value: yuan((ov.cost_fen || 0) - (ov.purchase_fen || 0)), delta: pct((ov.cost_fen || 0) - (ov.purchase_fen || 0), ov.cost_fen || 0), note: "收入-采购" },
    { label: "业务成功率", value: pct(ov.succeeded || 0, ov.total || 0), delta: `${ov.tenants || 0} 家企业`, note: `${ov.open_alerts || 0} 个未恢复告警` },
  ];
  const trend = (ov.by_day || []).map((d: any) => ({ label: String(d.key).slice(5), value: (d.cost || 0) / 100, count: d.count }));

  const opsQueue = [
    ...raw.finance.orders.filter((o) => ["unpaid", "confirming", "abnormal"].includes(o.status)).slice(0, 5).map((o) => ({
      id: `o-${o.order_no}`, title: `充值待确认到账 · ${orderStatus[o.status] || o.status}`, meta: `${tenantName(o.tenant_id)} · ${o.order_no} · ${yuan(o.amount)}`, tone: "warning", action: "进入财务", to: "/ops/finance",
    })),
    ...raw.finance.refunds.filter((r) => ["pending", "locked", "external", "unknown"].includes(r.status)).slice(0, 5).map((r) => ({
      id: `r-${r.refund_no}`, title: `退款${refundStatus[r.status] || r.status}`, meta: `${tenantName(r.tenant_id)} · ${r.refund_no} · ${yuan(r.amount)}`, tone: "primary", action: "进入审核", to: "/ops/finance",
    })),
    ...raw.alerts.filter((a) => a.status !== "resolved").slice(0, 5).map((a) => ({
      id: `a-${a.id}`, title: a.message, meta: `${alertLevel[a.level] || a.level} · ${a.scope || a.kind}`, tone: a.level === "critical" ? "danger" : "warning", action: "查看告警", to: "/ops/audit",
    })),
  ];

  const opsChannels = raw.models.map((m) => {
    const md = m.model;
    const expiring = md.license_expire_at && md.license_expire_at - Date.now() / 1000 < 7 * 86400;
    return {
      id: String(md.id), name: md.display_name || md.model_name, group: md.model_name,
      status: expiring ? "授权到期" : modelStatus[md.status] || md.status,
      latency: md.avg_latency_ms ? `${(md.avg_latency_ms / 1000).toFixed(1)}s` : "—",
      errorRate: `${m.channels || 0} 个渠道`,
      note: `质量 ${md.quality_level} · 稳定性 ${md.stability} · 上下文 ${md.context_length}${md.license_expire_at ? ` · 授权至 ${ts2str(md.license_expire_at).slice(0, 10)}` : ""}`,
      raw: md,
    };
  });
  const opsModels = raw.models.map((m) => ({ ...m.model, channels: m.channels, price: m.price }));
  const opsSyncLogs = raw.audit.filter((a) => /model|sync|price/.test(a.action)).slice(0, 6).map((a) => ({
    time: ts2str(a.created_at), action: a.action, result: "成功", detail: `${a.target} ${a.detail || ""}`,
  }));

  const opsStrategies = raw.scenes.map((s) => {
    const cur = s.versions.find((v: any) => v.id === s.scene.current_version_id);
    const latest = s.versions[0];
    const ev = s.evals[0];
    return {
      id: s.scene.scene_id, scene: s.scene.name,
      version: latest ? `v${latest.version}${latest.id !== cur?.id ? ` ${sceneStatus[latest.status] || latest.status}` : ""}` : "—",
      published: cur ? ts2str(cur.created_at).slice(0, 10) : "—",
      gate: latest ? `质量等级 ≥ ${latest.min_quality} · 上限 ${yuan(latest.default_max_cost)}` : "—",
      candidates: (latest?.candidates || "").split(",").filter(Boolean),
      status: sceneStatus[s.scene.status] || s.scene.status,
      lastEval: ev ? `${ts2str(ev.created_at).slice(5, 10)} ${ev.model_name} 合格率 ${(ev.pass_rate * 100).toFixed(1)}%` : "暂无评测",
      raw: s,
    };
  });

  const allEvals = raw.scenes.flatMap((s) => s.evals.map((e: any) => ({ ...e, sceneName: s.scene.name })));
  const opsEvaluations = allEvals.map((e) => ({
    id: String(e.id), name: `${e.sceneName} · ${e.model_name}${e.remark ? ` · ${e.remark}` : ""}`, samples: e.sample_size,
    pass: `${(e.pass_rate * 100).toFixed(1)}%`, cost: yuan(e.cost_per_qualified), duration: ts2str(e.created_at).slice(5, 16),
    status: e.is_baseline ? "基线" : "已完成",
  }));
  const opsEvalRows = allEvals.map((e) => {
    const sc = raw.scenes.find((s) => s.scene.scene_id === e.scene_id);
    const gate = sc?.versions[0]?.min_quality || 0;
    const md = raw.models.find((m) => m.model.model_name === e.model_name)?.model;
    return {
      model: `${e.model_name}（${e.sceneName}）`, pass: `${(e.pass_rate * 100).toFixed(1)}%`, cost: yuan(e.cost_per_qualified),
      latency: md?.avg_latency_ms ? `${(md.avg_latency_ms / 1000).toFixed(1)}s` : "—",
      verdict: md && md.quality_level >= gate ? "满足门槛" : "质量不足",
    };
  });

  const opsCustomers = raw.tenants.map((t) => ({
    id: String(t.tenant.id), name: t.tenant.name, status: tenantStatus[t.tenant.status] || t.tenant.status,
    scope: t.tenant.fail_reason || "全部可售模型", spend: yuan(t.balance_fen),
    quota: t.tenant.monthly_budget ? `月预算 ${yuan(t.tenant.monthly_budget)}` : "未设预算",
    last: ts2str(t.tenant.updated_at), raw: t.tenant,
  }));

  const opsPriceVersions = raw.prices.map((p) => ({
    id: String(p.id), model: `${p.model_name} v${p.version}`,
    purchase: `${yuan(p.cost_input_price)} / ${yuan(p.cost_output_price)}`, retail: `${yuan(p.input_price)} / ${yuan(p.output_price)}`,
    scope: p.tenant_id ? tenantName(p.tenant_id) : "全部企业", tax: p.tax_included ? "含税" : "不含税",
    effective: `${ts2str(p.effective_at)} 生效`,
    status: p.sync_status === "failed" ? "同步失败" : priceOf(p.model_name)?.id === p.id && p.effective_at <= Date.now() / 1000 ? "生效中" : p.effective_at > Date.now() / 1000 ? "待生效" : "历史",
    raw: p,
  }));

  const opsFinanceDiffs = raw.finance.diffs.map((d) => ({
    id: String(d.id), type: diffKind[d.kind] || d.kind, subject: d.ref_no || d.diff_key, platform: yuan(d.expected), external: yuan(d.actual),
    diff: d.detail || yuan(d.actual - d.expected), status: diffStatus[d.status] || d.status, raw: d,
  }));
  const opsOrders = raw.finance.orders.map((o) => ({ ...o, tenantName: tenantName(o.tenant_id), statusText: orderStatus[o.status] || o.status }));
  const opsRefunds = raw.finance.refunds.map((r) => ({ ...r, tenantName: tenantName(r.tenant_id), statusText: refundStatus[r.status] || r.status }));

  const opsAlerts = raw.alerts.map((a) => ({
    id: String(a.id), level: alertLevel[a.level] || a.level, title: a.message, impact: `${a.scope || ""} ${a.tenant_id ? tenantName(a.tenant_id) : ""}`.trim() || a.kind,
    time: ts2str(a.created_at), owner: a.owner ? `用户 #${a.owner}` : "未分派", status: alertStatus[a.status] || a.status, raw: a,
  }));
  const opsAudits = raw.audit.map((a) => ({
    id: String(a.id), time: ts2str(a.created_at), actor: a.user_id ? `用户 #${a.user_id}` : "系统", action: a.action, target: a.target, detail: a.detail,
  }));

  return {
    raw, loading, error, notice, setNotice, setError, reload, act, yuan, tenantName,
    opsMetrics, trend, opsQueue, opsChannels, opsModels, opsSyncLogs, opsStrategies, opsEvaluations, opsEvalRows,
    opsCustomers, opsPriceVersions, opsFinanceDiffs, opsOrders, opsRefunds, opsAlerts, opsAudits,
  };
}
