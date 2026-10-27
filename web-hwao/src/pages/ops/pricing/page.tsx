// 运营端 · 价格管理：价格版本列表（搜索/筛选/分页）、新建价格版本（采购价、零售价、缓存价、
// 含税、客户合同价、生效时间、调价理由）、影响预览，以及向 New API 倍率的同步与回读重试（FR16/FR24）。
import { useCallback, useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Notice, PageHeader, Select, Textarea } from "@/components/base/ui";
import { DataTable, FilterSelect, Pager, RowBtn, SectionTitle, Toggle, Toolbar, f2y, localToTs, tsToLocal, useTable, y2f, type Column } from "@/components/ops/kit";
import { useOps } from "@/lib/ops-data";
import { ts2str } from "@/lib/api";
import { cx, money } from "@/lib/format";

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral" | "primary"> = { 生效中: "success", 待生效: "primary", 同步失败: "danger", 历史: "neutral" };

export default function OpsPricingPage() {
  const { opsPriceVersions, opsModels, raw, act, notice, error, yuan, tenantName } = useOps();
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [model, setModel] = useState("");
  const filter = useCallback((v: any) => (!status || v.status === status) && (!model || v.raw.model_name === model) && (!scope || (scope === "public" ? !v.raw.tenant_id : String(v.raw.tenant_id) === scope)), [status, scope, model]);
  const text = useCallback((v: any) => `${v.model} ${v.scope} ${v.raw.reason || ""}`, []);
  const t = useTable(opsPriceVersions, text, 10, filter);
  const [form, setForm] = useState<any | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [base, setBase] = useState<any>(null);
  const [inK, setInK] = useState("12");
  const [outK, setOutK] = useState("2");

  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  // 由某个现有版本（或空白）打开新版本表单；金额以元编辑
  const open = (p?: any) => {
    setErrs({});
    setBase(p || null);
    setForm({
      model_name: p?.model_name || opsModels[0]?.model_name || "", tenant_id: p?.tenant_id || 0, tax_included: p ? p.tax_included : true,
      cost_input_price: f2y(p?.cost_input_price), cost_output_price: f2y(p?.cost_output_price), input_price: f2y(p?.input_price), output_price: f2y(p?.output_price),
      cache_read_price: f2y(p?.cache_read_price), cache_write_price: f2y(p?.cache_write_price), effective_at: "", reason: "",
    });
  };
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.model_name) e.model_name = "请选择模型";
    for (const k of ["cost_input_price", "cost_output_price", "input_price", "output_price", "cache_read_price", "cache_write_price"]) if (Number(form[k]) < 0 || Number.isNaN(Number(form[k]))) e[k] = "须为非负数";
    if (!(Number(form.input_price) > 0) || !(Number(form.output_price) > 0)) e.input_price = "零售价须大于 0";
    if (Number(form.input_price) < Number(form.cost_input_price) || Number(form.output_price) < Number(form.cost_output_price)) e.margin = "零售价低于采购价，将亏损销售";
    if (form.effective_at && localToTs(form.effective_at) < Date.now() / 1000 - 60) e.effective_at = "生效时间不能早于现在";
    if (form.reason.trim().length < 4) e.reason = "请填写调价理由（至少 4 个字）";
    setErrs(e);
    return Object.keys(e).filter((k) => k !== "margin").length === 0;
  };
  const submit = async () => {
    if (!validate()) return;
    const body = {
      model_name: form.model_name, tenant_id: Number(form.tenant_id) || 0, tax_included: form.tax_included,
      cost_input_price: y2f(form.cost_input_price), cost_output_price: y2f(form.cost_output_price), input_price: y2f(form.input_price), output_price: y2f(form.output_price),
      cache_read_price: y2f(form.cache_read_price), cache_write_price: y2f(form.cache_write_price), effective_at: localToTs(form.effective_at), reason: form.reason,
    };
    const r = await act("POST", "/prices", body, "价格新版本已发布并同步 New API 倍率，仅影响生效后的新请求");
    if (r !== undefined) setForm(null);
  };

  // 影响预览：按示例用量估算单次费用与毛利
  const per = (tokK: number, yuanPerM: number) => (tokK * 1000 / 1e6) * yuanPerM;
  const preview = form ? (() => {
    const i = Number(inK) || 0, o = Number(outK) || 0;
    const before = base ? per(i, base.input_price / 100) + per(o, base.output_price / 100) : 0;
    const after = per(i, Number(form.input_price) || 0) + per(o, Number(form.output_price) || 0);
    const cost = per(i, Number(form.cost_input_price) || 0) + per(o, Number(form.cost_output_price) || 0);
    return { before, after, cost, margin: after ? ((after - cost) / after) * 100 : 0 };
  })() : null;

  const cols: Column<any>[] = [
    { key: "m", title: "模型 / 版本", width: "1.4fr", render: (v) => <div><p className="font-medium text-foreground-950">{v.raw.model_name}</p><p className="text-[10px] text-foreground-500">v{v.raw.version} · {v.tax}</p></div> },
    { key: "s", title: "适用范围", width: "0.9fr", render: (v) => <Badge tone={v.raw.tenant_id ? "accent" : "neutral"}>{v.raw.tenant_id ? `合同价 · ${v.scope}` : "公开零售"}</Badge> },
    { key: "p", title: "采购价 入/出", width: "1fr", render: (v) => <span className="tnum text-[10.5px] text-foreground-600">{v.purchase}</span> },
    { key: "r", title: "零售价 入/出", width: "1fr", render: (v) => <span className="tnum text-[10.5px] font-medium text-foreground-900">{v.retail}</span> },
    { key: "c", title: "缓存 读/写", width: "0.9fr", render: (v) => <span className="tnum text-[10.5px] text-foreground-600">{yuan(v.raw.cache_read_price)} / {yuan(v.raw.cache_write_price)}</span> },
    { key: "e", title: "生效时间", width: "1fr", render: (v) => <span className="text-[10.5px] text-foreground-600">{ts2str(v.raw.effective_at).slice(0, 16)}</span> },
    { key: "st", title: "状态 / 同步", width: "1fr", render: (v) => (
      <div className="flex flex-wrap gap-1"><Badge tone={statusTone[v.status] || "neutral"}>{v.status}</Badge>
        <Badge tone={v.raw.sync_status === "ok" ? "success" : v.raw.sync_status === "failed" ? "danger" : "warning"}>{v.raw.sync_status === "ok" ? "已回读" : v.raw.sync_status === "failed" ? "同步失败" : "待同步"}</Badge></div>
    ) },
    { key: "op", title: "操作", width: "1.2fr", align: "right", render: (v) => (
      <>
        <RowBtn onClick={() => open(v.raw)}>基于此调价</RowBtn>
        <RowBtn title="重新写入 New API 倍率并回读核对" onClick={() => void act("POST", `/prices/${v.raw.id}/resync`, {}, `${v.raw.model_name} v${v.raw.version} 已重新同步并回读一致`)}>重新同步</RowBtn>
      </>
    ) },
  ];

  const failed = opsPriceVersions.filter((v) => v.raw.sync_status === "failed").length;

  return (
    <div>
      <PageHeader
        eyebrow="价格管理"
        title="价格版本、同步与回读"
        description="每次调价生成新版本（采购价、零售价、缓存价、生效时间与理由），发布后写入 New API 倍率并回读核对；已开始的请求按原价格快照结算。"
        actions={<Button onClick={() => open()}><i className="ri-add-line" />新建价格版本</Button>}
      />
      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}
      {failed ? <Notice tone="warning" icon="ri-error-warning-line" className="mb-3">{failed} 个价格版本同步 New API 失败，可在列表中“重新同步”。</Notice> : null}

      <Card className="overflow-hidden">
        <Toolbar
          q={t.q}
          setQ={t.setQ}
          placeholder="搜索模型、客户、调价理由"
          filters={<>
            <FilterSelect label="模型" value={model} onChange={setModel} options={Array.from(new Set(opsPriceVersions.map((v) => v.raw.model_name))).map((m) => [m, m])} />
            <FilterSelect label="范围" value={scope} onChange={setScope} options={[["public", "公开零售"], ...raw.tenants.map((x: any) => [String(x.tenant.id), x.tenant.name] as [string, string])]} />
            <FilterSelect label="状态" value={status} onChange={setStatus} options={[["生效中", "生效中"], ["待生效", "待生效"], ["同步失败", "同步失败"], ["历史", "历史"]]} />
          </>}
        />
        <DataTable columns={cols} rows={t.paged} rowKey={(v) => v.id} empty="没有匹配的价格版本" />
        <Pager page={t.page} pages={t.pages} total={t.total} setPage={t.setPage} />
      </Card>
      <p className="mt-2 text-[10px] text-foreground-400">单位：元 / 百万 Token。客户合同价优先于公开零售价。</p>

      <Drawer
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={base ? `调价 · ${base.model_name}（基于 v${base.version}）` : "新建价格版本"}
        subtitle="保存即发布新版本：到达生效时间后作用于新请求，并同步 New API 倍率"
        width="sm:max-w-[620px]"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setForm(null)}>取消</Button><Button onClick={() => void submit()}>发布价格版本</Button></div>}
      >
        {form ? (
          <div className="space-y-4">
            <SectionTitle>适用范围</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="模型 *" error={errs.model_name}>
                <Select value={form.model_name} onChange={(e) => set("model_name", e.target.value)}>
                  {opsModels.map((m: any) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
                </Select>
              </Field>
              <Field label="价格类型">
                <Select value={form.tenant_id} onChange={(e) => set("tenant_id", Number(e.target.value))}>
                  <option value={0}>公开零售价</option>
                  {raw.tenants.map((x: any) => <option key={x.tenant.id} value={x.tenant.id}>客户合同价 · {x.tenant.name}</option>)}
                </Select>
              </Field>
            </div>
            <SectionTitle>采购价（元 / 百万 Token）</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="输入" error={errs.cost_input_price}><Input type="number" step="0.01" value={form.cost_input_price} onChange={(e) => set("cost_input_price", e.target.value)} /></Field>
              <Field label="输出" error={errs.cost_output_price}><Input type="number" step="0.01" value={form.cost_output_price} onChange={(e) => set("cost_output_price", e.target.value)} /></Field>
            </div>
            <SectionTitle>零售价（元 / 百万 Token）</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="输入 *" error={errs.input_price}><Input type="number" step="0.01" value={form.input_price} onChange={(e) => set("input_price", e.target.value)} /></Field>
              <Field label="输出 *" error={errs.output_price}><Input type="number" step="0.01" value={form.output_price} onChange={(e) => set("output_price", e.target.value)} /></Field>
              <Field label="缓存命中" error={errs.cache_read_price}><Input type="number" step="0.01" value={form.cache_read_price} onChange={(e) => set("cache_read_price", e.target.value)} /></Field>
              <Field label="缓存写入" error={errs.cache_write_price}><Input type="number" step="0.01" value={form.cache_write_price} onChange={(e) => set("cache_write_price", e.target.value)} /></Field>
            </div>
            <Toggle label="价格含税" checked={form.tax_included} onChange={(v) => set("tax_included", v)} />
            <SectionTitle>生效与理由</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="生效时间" hint="留空立即生效" error={errs.effective_at}><Input type="datetime-local" value={form.effective_at} min={tsToLocal(Math.floor(Date.now() / 1000))} onChange={(e) => set("effective_at", e.target.value)} /></Field>
              <Field label="调价理由 *" error={errs.reason} className="sm:col-span-2"><Textarea rows={2} className="min-h-[60px]!" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="如：上游采购价下调，同步调整零售价" /></Field>
            </div>
            {preview ? (
              <div className="rounded-xl border border-background-200 bg-background-100/50 p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground-600">
                  <span>影响预览：单次输入</span>
                  <Input className="h-8! w-16! text-xs" value={inK} onChange={(e) => setInK(e.target.value)} />
                  <span>K / 输出</span>
                  <Input className="h-8! w-16! text-xs" value={outK} onChange={(e) => setOutK(e.target.value)} />
                  <span>K Token</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {[["原价", base ? money(preview.before) : "—"], ["新价", money(preview.after)], ["毛利率", `${preview.margin.toFixed(1)}%`]].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-background-50 p-2"><p className="text-[10px] text-foreground-500">{l}</p><p className={cx("tnum mt-0.5 text-sm font-semibold", l === "毛利率" && preview.margin < 0 ? "text-danger" : "text-foreground-900")}>{v}</p></div>
                  ))}
                </div>
                {errs.margin ? <p className="mt-2 text-[10.5px] text-warning">{errs.margin}</p> : null}
              </div>
            ) : null}
            {form.tenant_id ? <p className="text-[10.5px] text-foreground-500">合同价仅对 {tenantName(form.tenant_id)} 生效，New API 倍率仍以公开零售价为准。</p> : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
