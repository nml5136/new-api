// 运营端 · 模型资源与集成：模型目录、New API 渠道、供应商的完整增删改查。
// 渠道操作全部经服务端适配层（/platform/ops/channels）调用 New API 既有管理逻辑；
// 上游密钥只写不读，浏览器不接触管理员凭证。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Modal, Notice, PageHeader, Select, Tabs, Textarea } from "@/components/base/ui";
import { DataTable, FilterSelect, Pager, RowBtn, SectionTitle, Toggle, Toolbar, localToTs, tsToLocal, useConfirm, useTable, type Column } from "@/components/ops/kit";
import { useOps } from "@/lib/ops-data";
import { api, get, ts2str } from "@/lib/api";
import { cx } from "@/lib/format";

const modelStatus: Record<string, [string, "success" | "neutral" | "warning" | "danger" | "primary"]> = {
  pending: ["待核验", "neutral"], testing: ["测试中", "primary"], on_sale: ["可售", "success"], paused: ["暂停", "warning"], offline: ["已下线", "danger"],
};

type Tab = "models" | "channels" | "suppliers" | "logs";

export default function OpsResourcesPage() {
  const [tab, setTab] = useState<Tab>("models");
  const { opsModels, opsSyncLogs, raw, act, reload, error, notice, setError, setNotice, yuan } = useOps();
  const suppliers: any[] = raw.suppliers || [];
  const confirm = useConfirm();

  const onSaleNoChannel = opsModels.filter((m: any) => m.status === "on_sale" && !m.channels).length;
  const expiring = opsModels.filter((m: any) => m.license_expire_at && m.license_expire_at - Date.now() / 1000 < 30 * 86400);

  return (
    <div>
      <PageHeader
        eyebrow="模型资源与集成"
        title="供应商、模型与上游渠道"
        description="在这里维护供应商与模型目录、可售状态与授权，并通过服务端适配层管理 New API 渠道。上游密钥只写不读。"
        actions={<Button variant="outline" onClick={() => void reload()}><i className="ri-refresh-line" />刷新</Button>}
      />
      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["模型目录", `${opsModels.length} 个`, `${opsModels.filter((m: any) => m.status === "on_sale").length} 个可售`],
          ["供应商", `${suppliers.length} 家`, `${suppliers.filter((s) => s.supplier.status === "active").length} 家合作中`],
          ["在售无渠道", `${onSaleNoChannel} 个`, onSaleNoChannel ? "需补充渠道" : "全部有渠道"],
          ["授权 30 天内到期", `${expiring.length} 个`, expiring.map((m: any) => m.model_name).slice(0, 2).join("、") || "无"],
        ].map(([label, value, sub]) => (
          <Card key={label} className="p-4">
            <p className="text-[10.5px] text-foreground-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground-950">{value}</p>
            <p className="mt-0.5 truncate text-[10.5px] text-foreground-500">{sub}</p>
          </Card>
        ))}
      </div>

      <Tabs
        items={[
          { id: "models", label: "模型目录", count: opsModels.length },
          { id: "channels", label: "New API 渠道" },
          { id: "suppliers", label: "供应商", count: suppliers.length },
          { id: "logs", label: "变更记录" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mt-3">
        {tab === "models" ? <ModelsTab models={opsModels} suppliers={suppliers} act={act} yuan={yuan} confirm={confirm.ask} /> : null}
        {tab === "channels" ? <ChannelsTab models={opsModels} confirm={confirm.ask} onDone={(m) => { setNotice(m); setError(""); void reload(); }} onError={(m) => { setError(m); setNotice(""); }} /> : null}
        {tab === "suppliers" ? <SuppliersTab suppliers={suppliers} act={act} confirm={confirm.ask} /> : null}
        {tab === "logs" ? (
          <Card className="divide-y divide-background-100">
            {opsSyncLogs.length === 0 ? <p className="px-4 py-6 text-center text-xs text-foreground-500">暂无记录</p> : null}
            {opsSyncLogs.map((log, i) => (
              <div key={`${log.time}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11.5px] font-medium text-foreground-900">{log.action}</p>
                  <p className="mt-0.5 text-[10.5px] text-foreground-500">{log.detail}</p>
                </div>
                <span className="shrink-0 text-[10px] text-foreground-400">{log.time}</span>
              </div>
            ))}
          </Card>
        ) : null}
      </div>
      {confirm.node}
    </div>
  );
}

type Act = (method: string, path: string, body?: unknown, okMsg?: string) => Promise<any>;
type Ask = (s: { title: string; body: React.ReactNode; danger?: boolean; confirmText?: string; run: () => void }) => void;

// ===================== 模型目录 =====================

const emptyModel = {
  id: 0, model_name: "", display_name: "", supplier_id: 0, vendor: "", context_length: 8192, max_output: 4096, support_json: false, support_stream: true,
  quality_level: 3, avg_latency_ms: 0, stability: 90, license_file: "", license_expire_at: 0, status: "pending",
};

function ModelsTab({ models, suppliers, act, yuan, confirm }: { models: any[]; suppliers: any[]; act: Act; yuan: (f?: number) => string; confirm: Ask }) {
  const [status, setStatus] = useState("");
  const [vendor, setVendor] = useState("");
  const filter = useCallback((m: any) => (!status || m.status === status) && (!vendor || m.vendor === vendor), [status, vendor]);
  const text = useCallback((m: any) => `${m.model_name} ${m.display_name} ${m.vendor}`, []);
  const t = useTable(models, text, 10, filter);
  const [form, setForm] = useState<any | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const vendors = Array.from(new Set(models.map((m) => m.vendor).filter(Boolean))) as string[];

  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.model_name.trim()) e.model_name = "必填，需与 New API 渠道中的模型名一致";
    if (!(form.context_length > 0)) e.context_length = "需大于 0";
    if (form.max_output < 0) e.max_output = "不能为负";
    if (form.quality_level < 1 || form.quality_level > 5) e.quality_level = "范围 1-5";
    if (form.stability < 0 || form.stability > 100) e.stability = "范围 0-100";
    if (form.status === "on_sale" && form.license_expire_at && form.license_expire_at < Date.now() / 1000) e.license_expire_at = "授权已过期，不能设为可售";
    setErrs(e);
    return Object.keys(e).length === 0;
  };
  const save = async () => {
    if (!validate()) return;
    const { channels: _c, price: _p, ...body } = form;
    const r = await act(form.id ? "PUT" : "POST", form.id ? `/models/${form.id}` : "/models", body, form.id ? "模型已更新" : "模型已创建");
    if (r !== undefined) setForm(null);
  };
  const quickStatus = (m: any, st: string) => {
    const { channels: _c, price: _p, ...body } = m;
    void act("PUT", `/models/${m.id}`, { ...body, status: st }, `${m.model_name} 已设为${modelStatus[st][0]}`);
  };

  const cols: Column<any>[] = [
    { key: "name", title: "模型", width: "1.6fr", render: (m) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground-950">{m.display_name || m.model_name}</p>
        <p className="truncate font-mono-ui text-[10px] text-foreground-500">{m.model_name}</p>
      </div>
    ) },
    { key: "vendor", title: "供应商", width: "0.9fr", render: (m) => <span className="text-foreground-700">{m.vendor || "—"}</span> },
    { key: "cap", title: "能力", width: "1.3fr", render: (m) => (
      <div className="flex flex-wrap gap-1 text-[10px]">
        <Badge>{m.context_length >= 1000 ? `${Math.round(m.context_length / 1000)}K` : m.context_length} 上下文</Badge>
        {m.support_json ? <Badge tone="primary">结构化</Badge> : null}
        {m.support_stream ? <Badge tone="primary">流式</Badge> : null}
        <Badge tone="accent">质量 {m.quality_level}</Badge>
      </div>
    ) },
    { key: "ch", title: "渠道", width: "0.5fr", render: (m) => <span className={cx("tnum", m.channels ? "text-foreground-800" : "text-warning")}>{m.channels || 0}</span> },
    { key: "price", title: "零售价（元/百万）", width: "1fr", render: (m) => <span className="tnum text-[10.5px] text-foreground-700">{m.price ? `${yuan(m.price.input_price)} / ${yuan(m.price.output_price)}` : <span className="text-warning">未定价</span>}</span> },
    { key: "lic", title: "授权到期", width: "0.8fr", render: (m) => <span className={cx("text-[10.5px]", m.license_expire_at && m.license_expire_at < Date.now() / 1000 + 30 * 86400 ? "text-warning" : "text-foreground-600")}>{m.license_expire_at ? ts2str(m.license_expire_at).slice(0, 10) : "—"}</span> },
    { key: "st", title: "状态", width: "0.6fr", render: (m) => <Badge tone={modelStatus[m.status]?.[1] || "neutral"}>{modelStatus[m.status]?.[0] || m.status}</Badge> },
    { key: "op", title: "操作", width: "1.5fr", align: "right", render: (m) => (
      <>
        <RowBtn onClick={() => { setErrs({}); setForm({ ...emptyModel, ...m }); }}><i className="ri-edit-line" />编辑</RowBtn>
        {m.status === "on_sale" ? <RowBtn onClick={() => quickStatus(m, "paused")}>暂停</RowBtn> : <RowBtn onClick={() => quickStatus(m, "on_sale")}>上架</RowBtn>}
        {m.status !== "offline" ? (
          <RowBtn danger onClick={() => confirm({ title: `下线 ${m.model_name}？`, body: "下线后新请求不再路由到该模型，已开始的任务不受影响。", danger: true, confirmText: "下线", run: () => quickStatus(m, "offline") })}>下线</RowBtn>
        ) : (
          <RowBtn danger onClick={() => confirm({ title: `删除 ${m.model_name}？`, body: "仅删除平台目录记录，New API 渠道与历史账单不受影响；被场景引用时会被拒绝。", danger: true, confirmText: "删除", run: () => void act("DELETE", `/models/${m.id}`, undefined, "模型已删除") })}>删除</RowBtn>
        )}
      </>
    ) },
  ];

  return (
    <Card className="overflow-hidden">
      <Toolbar
        q={t.q}
        setQ={t.setQ}
        placeholder="搜索模型名、展示名、供应商"
        filters={<>
          <FilterSelect label="状态" value={status} onChange={setStatus} options={Object.entries(modelStatus).map(([k, v]) => [k, v[0]])} />
          <FilterSelect label="供应商" value={vendor} onChange={setVendor} options={vendors.map((v) => [v, v])} />
        </>}
        actions={<Button size="sm" onClick={() => { setErrs({}); setForm({ ...emptyModel }); }}><i className="ri-add-line" />新建模型</Button>}
      />
      <DataTable columns={cols} rows={t.paged} rowKey={(m) => m.id} empty="没有匹配的模型" />
      <Pager page={t.page} pages={t.pages} total={t.total} setPage={t.setPage} />

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? `编辑模型 · ${form.model_name}` : "新建模型"}
        subtitle={form?.id ? `能力版本 v${form.capability_version || 1} · 上下文/结构化/最大输出变化会自动升级能力版本` : "设为可售需：New API 有可用渠道、授权未过期、已有价格"}
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>取消</Button><Button onClick={() => void save()}>保存</Button></div>}
      >
        {form ? (
          <div className="space-y-4">
            <SectionTitle>基本信息</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="模型名 *" hint="与渠道模型名一致" error={errs.model_name}>
                <Input value={form.model_name} disabled={Boolean(form.id)} onChange={(e) => set("model_name", e.target.value)} placeholder="如 deepseek-chat" />
              </Field>
              <Field label="展示名称"><Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} /></Field>
              <Field label="供应商" hint={suppliers.length ? "" : "可先在“供应商”页新建"}>
                <Select value={form.supplier_id || 0} onChange={(e) => { const id = Number(e.target.value); set("supplier_id", id); if (id) set("vendor", suppliers.find((s) => s.supplier.id === id)?.supplier.name || ""); }}>
                  <option value={0}>未关联（手填厂商）</option>
                  {suppliers.map((s) => <option key={s.supplier.id} value={s.supplier.id}>{s.supplier.name}</option>)}
                </Select>
              </Field>
              <Field label="厂商标识"><Input value={form.vendor} disabled={Boolean(form.supplier_id)} onChange={(e) => set("vendor", e.target.value)} /></Field>
            </div>
            <SectionTitle>能力</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="上下文长度 *" error={errs.context_length}><Input type="number" value={form.context_length} onChange={(e) => set("context_length", Number(e.target.value))} /></Field>
              <Field label="最大输出" error={errs.max_output}><Input type="number" value={form.max_output} onChange={(e) => set("max_output", Number(e.target.value))} /></Field>
              <Field label="质量等级 1-5" error={errs.quality_level}><Input type="number" min={1} max={5} value={form.quality_level} onChange={(e) => set("quality_level", Number(e.target.value))} /></Field>
              <Field label="平均延迟 ms"><Input type="number" value={form.avg_latency_ms} onChange={(e) => set("avg_latency_ms", Number(e.target.value))} /></Field>
              <Field label="稳定性 0-100" error={errs.stability}><Input type="number" value={form.stability} onChange={(e) => set("stability", Number(e.target.value))} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Toggle label="支持结构化输出（JSON）" checked={form.support_json} onChange={(v) => set("support_json", v)} />
              <Toggle label="支持流式输出" checked={form.support_stream} onChange={(v) => set("support_stream", v)} />
            </div>
            <SectionTitle>授权与状态</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="授权文件" hint="文件编号或存档路径"><Input value={form.license_file} onChange={(e) => set("license_file", e.target.value)} placeholder="如 LIC-2026-001.pdf" /></Field>
              <Field label="授权到期" error={errs.license_expire_at}><Input type="datetime-local" value={tsToLocal(form.license_expire_at)} onChange={(e) => set("license_expire_at", localToTs(e.target.value))} /></Field>
              <Field label="状态">
                <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {Object.entries(modelStatus).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                </Select>
              </Field>
            </div>
            <Notice tone="neutral">待核验 → 测试中 → 可售 → 暂停 / 已下线。设为可售时服务端会核对渠道、授权与价格，不满足时拒绝保存。</Notice>
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}

// ===================== New API 渠道 =====================

const emptyChannel = { id: 0, name: "", type: 1, base_url: "", key: "", models: "", model_mapping: "", group: "default", priority: 0, weight: 0, auto_ban: 1, test_model: "", tag: "", remark: "" };

function ChannelsTab({ models, confirm, onDone, onError }: { models: any[]; confirm: Ask; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ types: any[]; groups: string[]; retry_times: number }>({ types: [], groups: ["default"], retry_times: 0 });
  const [form, setForm] = useState<any | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Record<number, { ok: boolean; text: string }>>({});
  const [retryOpen, setRetryOpen] = useState(false);
  const [retry, setRetry] = useState("0");
  const size = 10;
  // 回调放入 ref，避免父组件每次渲染生成新函数导致重复加载
  const errRef = useRef(onError);
  errRef.current = onError;

  // 服务端分页加载渠道（不含密钥）
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d: any = await get(`/platform/ops/channels?p=${page}&size=${size}&keyword=${encodeURIComponent(kw)}&status=${status}`);
      setRows(d.items || []);
      setTotal(d.total || 0);
    } catch (e) { errRef.current((e as Error).message); }
    setLoading(false);
  }, [page, kw, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { get("/platform/ops/channels/meta").then((m: any) => { setMeta(m); setRetry(String(m.retry_times)); }).catch(() => undefined); }, []);
  useEffect(() => { const h = setTimeout(() => { setKw(q); setPage(1); }, 300); return () => clearTimeout(h); }, [q]);

  const call = async (method: string, path: string, body: unknown, ok: string) => {
    try { await api(method, `/platform/ops/channels${path}`, body ?? {}); onDone(ok); await load(); return true; } catch (e) { onError((e as Error).message); return false; }
  };
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  const typeName = (id: number) => meta.types.find((t) => t.id === id)?.name || `类型 ${id}`;
  const defaultBase = meta.types.find((t) => t.id === form?.type)?.base_url || "";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "必填";
    if (!form.models.trim()) e.models = "至少一个模型";
    if (!form.id && !form.key.trim()) e.key = "新建渠道须填写密钥";
    if (form.base_url && !/^https?:\/\//.test(form.base_url)) e.base_url = "须以 http:// 或 https:// 开头";
    if (form.model_mapping.trim()) { try { const m = JSON.parse(form.model_mapping); if (typeof m !== "object" || Array.isArray(m)) throw new Error(); } catch { e.model_mapping = "须为 JSON 对象，如 {\"对外名\":\"上游名\"}"; } }
    if (form.weight < 0) e.weight = "不能为负";
    setErrs(e);
    return Object.keys(e).length === 0;
  };
  const save = async () => {
    if (!validate()) return;
    const body = { ...form, priority: Number(form.priority) || 0, weight: Number(form.weight) || 0, type: Number(form.type) };
    const ok = await call(form.id ? "PUT" : "POST", form.id ? `/${form.id}` : "", body, form.id ? "渠道已更新" : "渠道已创建");
    if (ok) setForm(null);
  };
  const test = async (r: any) => {
    setBusy((b) => ({ ...b, [r.id]: "test" }));
    try {
      const d: any = await api("POST", `/platform/ops/channels/${r.id}/test${r.test_model ? "" : `?model=${encodeURIComponent((r.models || "").split(",")[0])}`}`, {});
      setResult((x) => ({ ...x, [r.id]: { ok: true, text: `连通 · ${Number(d.time || 0).toFixed(2)}s` } }));
    } catch (e) { setResult((x) => ({ ...x, [r.id]: { ok: false, text: (e as Error).message.slice(0, 60) } })); }
    setBusy((b) => ({ ...b, [r.id]: "" }));
    void load();
  };
  const balance = async (r: any) => {
    setBusy((b) => ({ ...b, [r.id]: "bal" }));
    try {
      const d: any = await api("POST", `/platform/ops/channels/${r.id}/balance`, {});
      setResult((x) => ({ ...x, [r.id]: { ok: true, text: `余额 $${Number(d.balance || 0).toFixed(2)}` } }));
    } catch (e) { setResult((x) => ({ ...x, [r.id]: { ok: false, text: `余额查询失败：${(e as Error).message.slice(0, 40)}` } })); }
    setBusy((b) => ({ ...b, [r.id]: "" }));
    void load();
  };
  const addModel = (name: string) => {
    const list = form.models.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (!list.includes(name)) set("models", [...list, name].join(","));
  };
  const pages = Math.max(1, Math.ceil(total / size));

  const cols: Column<any>[] = [
    { key: "name", title: "渠道", width: "1.3fr", render: (r) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground-950">{r.name} <span className="font-mono-ui text-[10px] text-foreground-400">#{r.id}</span></p>
        <p className="truncate text-[10px] text-foreground-500">{r.type_name || typeName(r.type)} · {r.base_url || "默认地址"}</p>
      </div>
    ) },
    { key: "models", title: "模型", width: "1.3fr", render: (r) => <p className="line-clamp-2 break-all font-mono-ui text-[10px] text-foreground-700">{r.models}</p> },
    { key: "group", title: "分组", width: "0.6fr", render: (r) => <span className="text-[10.5px]">{r.group}</span> },
    { key: "pw", title: "优先级/权重", width: "0.7fr", render: (r) => <span className="tnum text-[10.5px]">{r.priority} / {r.weight}</span> },
    { key: "key", title: "密钥", width: "0.55fr", render: (r) => r.key_set ? <Badge tone="success">已配置</Badge> : <Badge tone="danger">缺失</Badge> },
    { key: "health", title: "测试 / 余额", width: "1.1fr", render: (r) => (
      <div className="text-[10px] leading-relaxed">
        {result[r.id] ? <p className={result[r.id].ok ? "text-success" : "text-danger"}>{result[r.id].text}</p> : null}
        <p className="text-foreground-500">{r.test_time ? `${ts2str(r.test_time).slice(5, 16)} · ${r.response_time}ms` : "未测试"}{r.balance_updated_time ? ` · $${Number(r.balance).toFixed(2)}` : ""}</p>
      </div>
    ) },
    { key: "st", title: "状态", width: "0.55fr", render: (r) => <Badge tone={r.status === 1 ? "success" : r.status === 3 ? "danger" : "warning"}>{r.status === 1 ? "启用" : r.status === 3 ? "自动禁用" : "已停用"}</Badge> },
    { key: "op", title: "操作", width: "2.1fr", align: "right", render: (r) => (
      <>
        <RowBtn disabled={Boolean(busy[r.id])} onClick={() => void test(r)}>{busy[r.id] === "test" ? "测试中…" : "测试"}</RowBtn>
        <RowBtn disabled={Boolean(busy[r.id])} onClick={() => void balance(r)}>{busy[r.id] === "bal" ? "查询中…" : "余额"}</RowBtn>
        <RowBtn onClick={() => { setErrs({}); setForm({ ...emptyChannel, ...r, key: "" }); }}>编辑</RowBtn>
        {r.status === 1 ? (
          <RowBtn onClick={() => confirm({ title: `停用渠道 ${r.name}？`, body: "停用后网关不再向该渠道转发新请求。", confirmText: "停用", danger: true, run: () => void call("POST", `/${r.id}/status`, { enabled: false }, "渠道已停用") })}>停用</RowBtn>
        ) : (
          <RowBtn onClick={() => void call("POST", `/${r.id}/status`, { enabled: true }, "渠道已启用")}>启用</RowBtn>
        )}
        <RowBtn danger onClick={() => confirm({ title: `删除渠道 ${r.name}？`, body: "将同时删除该渠道的能力映射，操作不可恢复。依赖它的可售模型可能变为无渠道。", danger: true, confirmText: "删除", run: () => void call("DELETE", `/${r.id}`, undefined, "渠道已删除") })}>删除</RowBtn>
      </>
    ) },
  ];

  return (
    <Card className="overflow-hidden">
      <Toolbar
        q={q}
        setQ={setQ}
        placeholder="搜索名称、模型、标签、地址"
        filters={<FilterSelect label="状态" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[["enabled", "启用"], ["disabled", "停用/自动禁用"]]} />}
        actions={<>
          <Button size="sm" variant="outline" onClick={() => setRetryOpen(true)}><i className="ri-repeat-line" />失败重试 {meta.retry_times} 次</Button>
          <Button size="sm" onClick={() => { setErrs({}); setForm({ ...emptyChannel }); }}><i className="ri-add-line" />新建渠道</Button>
        </>}
      />
      <div className={cx(loading ? "opacity-60" : "")}>
        <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} empty="没有匹配的渠道" />
      </div>
      <Pager page={page} pages={pages} total={total} setPage={setPage} />
      <p className="border-t border-background-200 px-4 py-2 text-[10px] text-foreground-400">
        <i className="ri-shield-keyhole-line" /> 经服务端适配层调用 New API 渠道管理；密钥只写不读，列表与接口均不回显。
      </p>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? `编辑渠道 · ${form.name}` : "新建 New API 渠道"}
        subtitle="保存后由 New API 更新能力映射与渠道缓存"
        width="sm:max-w-[640px]"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>取消</Button><Button onClick={() => void save()}>保存</Button></div>}
      >
        {form ? (
          <div className="space-y-4">
            <SectionTitle>连接</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="渠道名称 *" error={errs.name}><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="渠道类型 *">
                <Select value={form.type} onChange={(e) => set("type", Number(e.target.value))}>
                  {meta.types.filter((t) => t.id > 0).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Base URL" hint="留空使用类型默认地址" error={errs.base_url} className="sm:col-span-2">
                <Input value={form.base_url} onChange={(e) => set("base_url", e.target.value)} placeholder={defaultBase || "https://"} />
              </Field>
              <Field label={form.id ? "上游密钥（只写）" : "上游密钥 *"} hint={form.id ? (form.key_set ? "已配置，留空不修改" : "当前未配置") : "保存后不再显示"} error={errs.key} className="sm:col-span-2">
                <Input type="password" autoComplete="new-password" value={form.key} onChange={(e) => set("key", e.target.value)} placeholder={form.id ? "••••••••（留空保持不变）" : "sk-..."} />
              </Field>
            </div>
            <SectionTitle>模型</SectionTitle>
            <Field label="模型列表 *" hint="逗号分隔" error={errs.models}>
              <Textarea rows={2} className="!min-h-[64px] font-mono-ui text-xs" value={form.models} onChange={(e) => set("models", e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-1">
              {models.map((m: any) => (
                <button key={m.id} type="button" onClick={() => addModel(m.model_name)} className="cursor-pointer rounded-full border border-background-300 px-2 py-0.5 text-[10px] text-foreground-600 hover:border-primary-300 hover:text-primary-700">+ {m.model_name}</button>
              ))}
            </div>
            <Field label="模型映射" hint="JSON，可选" error={errs.model_mapping}>
              <Textarea rows={3} className="!min-h-[72px] font-mono-ui text-xs" value={form.model_mapping} onChange={(e) => set("model_mapping", e.target.value)} placeholder='{"对外模型名": "上游模型名"}' />
            </Field>
            <Field label="测试模型" hint="留空取模型列表第一个"><Input value={form.test_model} onChange={(e) => set("test_model", e.target.value)} /></Field>
            <SectionTitle>调度</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="分组">
                <Input list="ch-groups" value={form.group} onChange={(e) => set("group", e.target.value)} />
                <datalist id="ch-groups">{meta.groups.map((g) => <option key={g} value={g} />)}</datalist>
              </Field>
              <Field label="优先级" hint="越大越优先"><Input type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} /></Field>
              <Field label="权重" hint="同优先级内分流" error={errs.weight}><Input type="number" min={0} value={form.weight} onChange={(e) => set("weight", e.target.value)} /></Field>
              <Field label="标签"><Input value={form.tag} onChange={(e) => set("tag", e.target.value)} /></Field>
              <Field label="备注" className="sm:col-span-2"><Input value={form.remark} onChange={(e) => set("remark", e.target.value)} /></Field>
            </div>
            <Toggle label="失败时自动禁用（auto ban）" checked={form.auto_ban === 1} onChange={(v) => set("auto_ban", v ? 1 : 0)} />
            <Notice tone="neutral">失败重试次数为 New API 全局设置，可在列表右上角“失败重试”调整。</Notice>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={retryOpen}
        onClose={() => setRetryOpen(false)}
        title="失败重试次数"
        description="New API 全局设置：请求失败后切换其他渠道重试的次数（0-10）。"
        footer={<><Button variant="outline" onClick={() => setRetryOpen(false)}>取消</Button><Button disabled={!(Number(retry) >= 0 && Number(retry) <= 10)} onClick={async () => {
          try { const d: any = await api("PUT", "/platform/ops/channel-settings", { retry_times: Number(retry) }); setMeta((m) => ({ ...m, retry_times: d.retry_times })); onDone("重试次数已更新"); setRetryOpen(false); } catch (e) { onError((e as Error).message); }
        }}>保存</Button></>}
      >
        <Field label="重试次数" error={Number(retry) >= 0 && Number(retry) <= 10 ? "" : "范围 0-10"}><Input type="number" min={0} max={10} value={retry} onChange={(e) => setRetry(e.target.value)} /></Field>
      </Modal>
    </Card>
  );
}

// ===================== 供应商 =====================

const emptySupplier = { id: 0, name: "", contact: "", contract_no: "", contract_expire_at: 0, status: "active", remark: "" };

function SuppliersTab({ suppliers, act, confirm }: { suppliers: any[]; act: Act; confirm: Ask }) {
  const [status, setStatus] = useState("");
  const filter = useCallback((s: any) => !status || s.supplier.status === status, [status]);
  const text = useCallback((s: any) => `${s.supplier.name} ${s.supplier.contact} ${s.supplier.contract_no}`, []);
  const t = useTable(suppliers, text, 10, filter);
  const [form, setForm] = useState<any | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name.trim()) return setErr("供应商名称必填");
    const r = await act(form.id ? "PUT" : "POST", form.id ? `/suppliers/${form.id}` : "/suppliers", form, form.id ? "供应商已更新" : "供应商已创建");
    if (r !== undefined) setForm(null);
  };
  const cols: Column<any>[] = useMemo(() => [
    { key: "n", title: "供应商", width: "1.2fr", render: (s: any) => <span className="font-medium text-foreground-950">{s.supplier.name}</span> },
    { key: "c", title: "联系人", width: "1fr", render: (s: any) => <span className="text-foreground-700">{s.supplier.contact || "—"}</span> },
    { key: "ct", title: "合同", width: "1.2fr", render: (s: any) => (
      <span className="text-[10.5px] text-foreground-700">{s.supplier.contract_no || "—"}{s.supplier.contract_expire_at ? <span className={cx("ml-1", s.supplier.contract_expire_at < Date.now() / 1000 + 30 * 86400 ? "text-warning" : "text-foreground-500")}>至 {ts2str(s.supplier.contract_expire_at).slice(0, 10)}</span> : null}</span>
    ) },
    { key: "m", title: "关联模型", width: "0.6fr", render: (s: any) => <span className="tnum">{s.models}</span> },
    { key: "s", title: "状态", width: "0.6fr", render: (s: any) => <Badge tone={s.supplier.status === "active" ? "success" : "warning"}>{s.supplier.status === "active" ? "合作中" : "暂停"}</Badge> },
    { key: "op", title: "操作", width: "1fr", align: "right", render: (s: any) => (
      <>
        <RowBtn onClick={() => { setErr(""); setForm({ ...s.supplier }); }}>编辑</RowBtn>
        <RowBtn danger disabled={s.models > 0} title={s.models > 0 ? "仍有关联模型" : ""} onClick={() => confirm({ title: `删除供应商 ${s.supplier.name}？`, body: "仅删除供应商档案。", danger: true, confirmText: "删除", run: () => void act("DELETE", `/suppliers/${s.supplier.id}`, undefined, "供应商已删除") })}>删除</RowBtn>
      </>
    ) },
  ], [act, confirm]);
  return (
    <Card className="overflow-hidden">
      <Toolbar
        q={t.q}
        setQ={t.setQ}
        placeholder="搜索名称、联系人、合同号"
        filters={<FilterSelect label="状态" value={status} onChange={setStatus} options={[["active", "合作中"], ["paused", "暂停"]]} />}
        actions={<Button size="sm" onClick={() => { setErr(""); setForm({ ...emptySupplier }); }}><i className="ri-add-line" />新建供应商</Button>}
      />
      <DataTable columns={cols} rows={t.paged} rowKey={(s) => s.supplier.id} empty="还没有供应商" />
      <Pager page={t.page} pages={t.pages} total={t.total} setPage={t.setPage} />
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? "编辑供应商" : "新建供应商"}
        description="模型可关联供应商，供应商名称同步为模型厂商标识。"
        footer={<><Button variant="outline" onClick={() => setForm(null)}>取消</Button><Button onClick={() => void save()}>保存</Button></>}
      >
        {form ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="名称 *" error={err}><Input value={form.name} onChange={(e) => { set("name", e.target.value); setErr(""); }} /></Field>
            <Field label="联系人 / 方式"><Input value={form.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
            <Field label="采购合同号"><Input value={form.contract_no} onChange={(e) => set("contract_no", e.target.value)} /></Field>
            <Field label="合同到期"><Input type="datetime-local" value={tsToLocal(form.contract_expire_at)} onChange={(e) => set("contract_expire_at", localToTs(e.target.value))} /></Field>
            <Field label="状态"><Select value={form.status} onChange={(e) => set("status", e.target.value)}><option value="active">合作中</option><option value="paused">暂停</option></Select></Field>
            <Field label="备注"><Input value={form.remark} onChange={(e) => set("remark", e.target.value)} /></Field>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
