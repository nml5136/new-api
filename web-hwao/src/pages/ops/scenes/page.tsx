// 运营端 · 场景策略：场景新建/编辑/克隆/删除，版本草稿的新建与编辑（输入模板、输出格式、质量门槛、
// 候选模型及顺序、默认费用上限、偏好），状态流转 草稿→评测通过→已发布→已停用，
// 通过版本指针发布与回滚，并支持按企业小范围放量（FR05/FR25）。
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Modal, Notice, PageHeader, Select, Textarea } from "@/components/base/ui";
import { DataTable, FilterSelect, RowBtn, SectionTitle, Toggle, useConfirm, useTable, f2y, y2f, type Column } from "@/components/ops/kit";
import { useOps } from "@/lib/ops-data";
import { ts2str } from "@/lib/api";
import { cx } from "@/lib/format";

const vStatus: Record<string, [string, "neutral" | "primary" | "success" | "danger"]> = {
  draft: ["草稿", "neutral"], evaluated: ["评测通过", "primary"], published: ["已发布", "success"], disabled: ["已停用", "danger"],
};
const prefName: Record<string, string> = { economy: "经济", balanced: "均衡", quality: "质量优先" };

const emptyVersion = {
  id: 0, scope: "", system_prompt: "", input_template: "", output_format: "text", min_quality: 3, min_context: 0, candidates: "",
  default_max_cost: 50, default_max_tokens: 2048, has_fallback: true, preference: "balanced", change_reason: "",
};

export default function OpsScenesPage() {
  const { raw, opsModels, act, error, notice, yuan, tenantName } = useOps();
  const scenes: any[] = raw.scenes;
  const [sel, setSel] = useState("");
  const [status, setStatus] = useState("");
  const text = useCallback((s: any) => `${s.scene.scene_id} ${s.scene.name}`, []);
  const filter = useCallback((s: any) => !status || s.scene.status === status, [status]);
  const t = useTable(scenes, text, 50, filter);
  const confirm = useConfirm();
  const cur = scenes.find((s) => s.scene.scene_id === sel) || scenes[0];
  useEffect(() => { if (!sel && scenes.length) setSel(scenes[0].scene.scene_id); }, [scenes, sel]);

  // 场景信息（新建/编辑/克隆共用）
  const [sceneForm, setSceneForm] = useState<any | null>(null);
  const [sceneErr, setSceneErr] = useState("");
  // 版本草稿表单
  const [vForm, setVForm] = useState<any | null>(null);
  const [vErrs, setVErrs] = useState<Record<string, string>>({});
  const [pick, setPick] = useState("");
  // 发布与放量
  const [publishV, setPublishV] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [rollV, setRollV] = useState<any | null>(null);
  const [rollT, setRollT] = useState<string[]>([]);

  const saveScene = async () => {
    const f = sceneForm;
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(f.scene_id)) return setSceneErr("场景 ID 为 2-32 位字母、数字、- 或 _");
    if (!f.name.trim()) return setSceneErr("场景名称必填");
    let r;
    if (f.mode === "edit") r = await act("PUT", `/scenes/${f.scene_id}`, { name: f.name, description: f.description }, "场景信息已更新");
    else if (f.mode === "clone") r = await act("POST", `/scenes/${f.from}/clone`, { new_scene_id: f.scene_id, name: f.name, version_id: f.version_id || 0 }, `已克隆为 ${f.scene_id}（v1 草稿）`);
    else r = await act("POST", "/scenes/versions", { scene_id: f.scene_id, name: f.name, description: f.description, version: { ...emptyVersion, candidates: opsModels.filter((m: any) => m.status === "on_sale").slice(0, 1).map((m: any) => m.model_name).join(","), change_reason: "新建场景" } }, `场景 ${f.scene_id} 已创建（v1 草稿）`);
    if (r !== undefined) { if (f.mode !== "edit") setSel(f.scene_id); setSceneForm(null); }
  };

  const vset = (k: string, v: unknown) => setVForm((f: any) => ({ ...f, [k]: v }));
  const cands: string[] = vForm ? vForm.candidates.split(",").filter(Boolean) : [];
  const setCands = (l: string[]) => vset("candidates", l.join(","));
  const move = (i: number, d: number) => { const l = [...cands]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setCands(l); };
  const modelOf = (n: string) => opsModels.find((m: any) => m.model_name === n);

  const openVersion = (v?: any, asNew = false) => {
    setVErrs({});
    setPick("");
    const base = v ? { ...emptyVersion, ...v } : { ...emptyVersion };
    setVForm({ ...base, id: asNew ? 0 : base.id, preference: base.preference || "balanced", max_cost_yuan: f2y(base.default_max_cost), change_reason: asNew ? "" : base.change_reason });
  };
  const saveVersion = async () => {
    const f = vForm, e: Record<string, string> = {};
    if (!cands.length) e.candidates = "至少选择一个候选模型";
    if (f.min_quality < 0 || f.min_quality > 5) e.min_quality = "范围 0-5";
    if (Number(f.max_cost_yuan) < 0 || Number.isNaN(Number(f.max_cost_yuan))) e.max_cost = "须为非负数";
    if (f.default_max_tokens < 0) e.max_tokens = "不能为负";
    if (f.output_format === "json" && cands.some((n) => modelOf(n) && !modelOf(n).support_json)) e.candidates = "JSON 输出要求候选模型支持结构化输出";
    if (!f.id && f.change_reason.trim().length < 2) e.change_reason = "请填写变更说明";
    setVErrs(e);
    if (Object.keys(e).length) return;
    const { max_cost_yuan, ...rest } = f;
    const body = { ...rest, default_max_cost: y2f(max_cost_yuan), min_quality: Number(f.min_quality), min_context: Number(f.min_context), default_max_tokens: Number(f.default_max_tokens) };
    const r = f.id
      ? await act("PUT", `/scene-versions/${f.id}`, body, "草稿已更新")
      : await act("POST", "/scenes/versions", { scene_id: cur.scene.scene_id, version: { ...body, id: 0 } }, "已保存为新草稿版本");
    if (r !== undefined) setVForm(null);
  };

  const sceneTone = (s: string) => vStatus[s]?.[1] || "neutral";
  const pointer = (id: number) => cur?.versions.find((v: any) => v.id === id);
  const currentV = cur ? pointer(cur.scene.current_version_id) : null;
  const prevV = cur ? pointer(cur.scene.prev_version_id) : null;

  const vcols: Column<any>[] = [
    { key: "v", title: "版本", width: "0.7fr", render: (v) => (
      <div>
        <p className="font-semibold text-foreground-950">v{v.version}</p>
        {v.id === cur?.scene.current_version_id ? <p className="text-[10px] text-success">当前指针</p> : v.id === cur?.scene.prev_version_id ? <p className="text-[10px] text-foreground-400">上一版本</p> : null}
      </div>
    ) },
    { key: "s", title: "状态", width: "0.7fr", render: (v) => <Badge tone={vStatus[v.status]?.[1] || "neutral"}>{vStatus[v.status]?.[0] || v.status}</Badge> },
    { key: "c", title: "候选顺序", width: "1.6fr", render: (v) => <p className="line-clamp-2 font-mono-ui text-[10px] text-foreground-700">{(v.candidates || "").split(",").filter(Boolean).map((n: string, i: number) => `${i + 1}.${n}`).join("  ")}</p> },
    { key: "g", title: "门槛 / 上限 / 偏好", width: "1.2fr", render: (v) => <span className="text-[10.5px] text-foreground-700">质量≥{v.min_quality} · {yuan(v.default_max_cost)} · {prefName[v.preference] || "均衡"} · {v.output_format === "json" ? "JSON" : "文本"}</span> },
    { key: "r", title: "放量", width: "0.9fr", render: (v) => <span className="text-[10.5px] text-foreground-600">{v.rollout_tenants ? v.rollout_tenants.split(",").map((x: string) => tenantName(Number(x))).join("、") : "全量"}</span> },
    { key: "t", title: "创建 / 说明", width: "1.1fr", render: (v) => <div className="text-[10px] text-foreground-500"><p>{ts2str(v.created_at).slice(0, 16)}</p><p className="truncate">{v.change_reason || "—"}</p></div> },
    { key: "op", title: "操作", width: "2fr", align: "right", render: (v) => (
      <>
        {v.status === "draft" ? <RowBtn onClick={() => openVersion(v)}>编辑</RowBtn> : null}
        <RowBtn onClick={() => openVersion(v, true)}>复制为草稿</RowBtn>
        {v.status === "draft" ? <RowBtn onClick={() => void act("POST", `/scenes/${v.id}/evaluated`, {}, `v${v.version} 已标记评测通过`)}>评测通过</RowBtn> : null}
        {v.status === "evaluated" || (v.status === "published" && v.id !== cur?.scene.current_version_id) ? <RowBtn onClick={() => { setReason(""); setPublishV(v); }}>发布</RowBtn> : null}
        <RowBtn onClick={() => { setRollT((v.rollout_tenants || "").split(",").filter(Boolean)); setRollV(v); }}>放量</RowBtn>
      </>
    ) },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="场景与路由策略"
        title="场景、版本与发布"
        description="场景版本包含输入模板、输出约束、候选模型及顺序、质量底线、费用上限与偏好。草稿须评测通过才能发布；发布与回滚只切换版本指针，仅影响新请求。"
        actions={<Button onClick={() => { setSceneErr(""); setSceneForm({ mode: "new", scene_id: "", name: "", description: "" }); }}><i className="ri-add-line" />新建场景</Button>}
      />
      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="space-y-2 border-b border-background-200 p-3">
            <Input value={t.q} onChange={(e) => t.setQ(e.target.value)} placeholder="搜索场景 ID / 名称" className="h-9! text-xs" />
            <FilterSelect label="状态" value={status} onChange={setStatus} options={Object.entries(vStatus).map(([k, v]) => [k, v[0]])} />
          </div>
          <div className="max-h-[560px] space-y-1 overflow-y-auto p-2">
            {t.paged.map((s: any) => (
              <button key={s.scene.scene_id} type="button" onClick={() => setSel(s.scene.scene_id)}
                className={cx("w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-colors", cur?.scene.scene_id === s.scene.scene_id ? "bg-primary-50" : "hover:bg-background-100")}>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium text-foreground-900">{s.scene.name}</span>
                  <Badge tone={sceneTone(s.scene.status)}>{vStatus[s.scene.status]?.[0] || s.scene.status}</Badge>
                </div>
                <p className="mt-0.5 font-mono-ui text-[10px] text-foreground-500">{s.scene.scene_id} · {s.versions.length} 个版本</p>
              </button>
            ))}
            {t.total === 0 ? <p className="px-2 py-4 text-center text-[11px] text-foreground-500">没有匹配的场景</p> : null}
          </div>
        </Card>

        {cur ? (
          <div className="min-w-0 space-y-4">
            <Card className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground-950">{cur.scene.name}</h2>
                    <Badge tone={sceneTone(cur.scene.status)}>{vStatus[cur.scene.status]?.[0] || cur.scene.status}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono-ui text-[11px] text-foreground-500">{cur.scene.scene_id}</p>
                  <p className="mt-1 text-xs text-foreground-600">{cur.scene.description || "暂无描述"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setSceneErr(""); setSceneForm({ mode: "edit", scene_id: cur.scene.scene_id, name: cur.scene.name, description: cur.scene.description }); }}><i className="ri-edit-line" />编辑</Button>
                  <Button size="sm" variant="outline" onClick={() => { setSceneErr(""); setSceneForm({ mode: "clone", from: cur.scene.scene_id, scene_id: `${cur.scene.scene_id}-COPY`, name: `${cur.scene.name}（副本）`, version_id: cur.versions[0]?.id || 0 }); }}><i className="ri-file-copy-line" />克隆</Button>
                  <Button size="sm" onClick={() => openVersion(cur.versions[0], true)}><i className="ri-add-line" />新建版本</Button>
                  {cur.scene.status === "published" ? (
                    <Button size="sm" variant="outline" disabled={!prevV} onClick={() => confirm.ask({ title: "回滚到上一版本？", body: `版本指针将从 v${currentV?.version} 切回 v${prevV?.version}，仅影响之后的新请求。`, confirmText: "回滚", run: () => void act("POST", `/scenes/${cur.scene.scene_id}/rollback`, {}, "已回滚到上一版本") })}><i className="ri-history-line" />回滚</Button>
                  ) : null}
                  {cur.scene.status === "published" ? (
                    <Button size="sm" variant="danger" onClick={() => confirm.ask({ title: `停用场景 ${cur.scene.name}？`, body: "停用后拒绝新任务，已开始任务与历史账单不受影响。", danger: true, confirmText: "停用", run: () => void act("POST", `/scenes/${cur.scene.scene_id}/disable`, {}, "场景已停用") })}>停用</Button>
                  ) : cur.scene.status === "disabled" ? (
                    <Button size="sm" onClick={() => void act("POST", `/scenes/${cur.scene.scene_id}/enable`, {}, "场景已恢复")}>启用</Button>
                  ) : null}
                  {!cur.scene.current_version_id ? (
                    <Button size="sm" variant="danger" onClick={() => confirm.ask({ title: `删除场景 ${cur.scene.scene_id}？`, body: "该场景从未发布，将删除场景及全部草稿版本。", danger: true, confirmText: "删除", run: () => { void act("DELETE", `/scenes/${cur.scene.scene_id}`, undefined, "场景已删除"); setSel(""); } })}>删除</Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  ["当前发布", currentV ? `v${currentV.version}` : "未发布"],
                  ["上一版本", prevV ? `v${prevV.version}` : "—"],
                  ["当前放量", currentV ? (currentV.rollout_tenants ? `${currentV.rollout_tenants.split(",").length} 家企业` : "全量") : "—"],
                  ["最近评测", cur.evals[0] ? `${cur.evals[0].model_name} ${(cur.evals[0].pass_rate * 100).toFixed(0)}%` : "暂无"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-background-100/60 p-2.5"><p className="text-[10px] text-foreground-500">{l}</p><p className="mt-0.5 text-xs font-medium text-foreground-900">{v}</p></div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-950">版本</p>
                <span className="text-[10.5px] text-foreground-500">草稿 → 评测通过 → 已发布；已发布版本不可修改，可复制为新草稿</span>
              </div>
              <DataTable columns={vcols} rows={cur.versions} rowKey={(v) => v.id} empty="暂无版本" />
            </Card>
          </div>
        ) : <Card className="p-6 text-center text-xs text-foreground-500">暂无场景，点击右上角新建。</Card>}
      </div>

      {/* 场景信息：新建 / 编辑 / 克隆 */}
      <Modal
        open={Boolean(sceneForm)}
        onClose={() => setSceneForm(null)}
        title={sceneForm?.mode === "edit" ? "编辑场景" : sceneForm?.mode === "clone" ? `克隆场景 ${sceneForm?.from}` : "新建场景"}
        description={sceneForm?.mode === "clone" ? "以所选版本为蓝本创建新场景的 v1 草稿。" : sceneForm?.mode === "new" ? "创建后生成 v1 草稿，可继续完善版本配置。" : undefined}
        footer={<><Button variant="outline" onClick={() => setSceneForm(null)}>取消</Button><Button onClick={() => void saveScene()}>保存</Button></>}
      >
        {sceneForm ? (
          <div className="space-y-3">
            <Field label="场景 ID *" hint="创建后不可修改"><Input value={sceneForm.scene_id} disabled={sceneForm.mode === "edit"} onChange={(e) => { setSceneForm({ ...sceneForm, scene_id: e.target.value.toUpperCase() }); setSceneErr(""); }} placeholder="如 SC04" /></Field>
            <Field label="场景名称 *"><Input value={sceneForm.name} onChange={(e) => { setSceneForm({ ...sceneForm, name: e.target.value }); setSceneErr(""); }} /></Field>
            {sceneForm.mode === "clone" ? (
              <Field label="蓝本版本">
                <Select value={sceneForm.version_id} onChange={(e) => setSceneForm({ ...sceneForm, version_id: Number(e.target.value) })}>
                  {cur?.versions.map((v: any) => <option key={v.id} value={v.id}>v{v.version} · {vStatus[v.status]?.[0]}</option>)}
                </Select>
              </Field>
            ) : <Field label="描述"><Textarea rows={2} className="min-h-[60px]!" value={sceneForm.description} onChange={(e) => setSceneForm({ ...sceneForm, description: e.target.value })} /></Field>}
            {sceneErr ? <p className="text-[11px] text-danger">{sceneErr}</p> : null}
          </div>
        ) : null}
      </Modal>

      {/* 版本草稿 */}
      <Drawer
        open={Boolean(vForm)}
        onClose={() => setVForm(null)}
        title={vForm?.id ? `编辑草稿 v${vForm.version}` : `新建版本 · ${cur?.scene.name || ""}`}
        subtitle="保存为草稿；评测通过后才能发布"
        width="sm:max-w-[680px]"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setVForm(null)}>取消</Button><Button onClick={() => void saveVersion()}>保存草稿</Button></div>}
      >
        {vForm ? (
          <div className="space-y-4">
            <SectionTitle>输入与输出</SectionTitle>
            <Field label="适用范围" hint="说明适用的业务、语言或内容类型"><Input value={vForm.scope} onChange={(e) => vset("scope", e.target.value)} /></Field>
            <Field label="输入模板" hint="字段说明或 JSON 模板"><Textarea rows={3} className="min-h-[72px]! font-mono-ui text-xs" value={vForm.input_template} onChange={(e) => vset("input_template", e.target.value)} /></Field>
            <Field label="场景系统提示"><Textarea rows={3} className="min-h-[72px]!" value={vForm.system_prompt} onChange={(e) => vset("system_prompt", e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="输出格式"><Select value={vForm.output_format} onChange={(e) => vset("output_format", e.target.value)}><option value="text">文本</option><option value="json">JSON 结构化</option></Select></Field>
              <Field label="默认偏好"><Select value={vForm.preference} onChange={(e) => vset("preference", e.target.value)}><option value="economy">经济</option><option value="balanced">均衡</option><option value="quality">质量优先</option></Select></Field>
              <Field label="默认最大输出 Token" error={vErrs.max_tokens}><Input type="number" value={vForm.default_max_tokens} onChange={(e) => vset("default_max_tokens", Number(e.target.value))} /></Field>
            </div>
            <SectionTitle>质量与成本</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="质量底线（0-5）" error={vErrs.min_quality}><Input type="number" min={0} max={5} value={vForm.min_quality} onChange={(e) => vset("min_quality", Number(e.target.value))} /></Field>
              <Field label="最低上下文"><Input type="number" value={vForm.min_context} onChange={(e) => vset("min_context", Number(e.target.value))} /></Field>
              <Field label="默认单次费用上限（元）" error={vErrs.max_cost}><Input type="number" step="0.01" value={vForm.max_cost_yuan} onChange={(e) => vset("max_cost_yuan", e.target.value)} /></Field>
            </div>
            <Toggle label="候选全部不可用时允许兜底" checked={vForm.has_fallback} onChange={(v) => vset("has_fallback", v)} />
            <SectionTitle>允许模型与候选顺序</SectionTitle>
            {vErrs.candidates ? <p className="text-[11px] text-danger">{vErrs.candidates}</p> : null}
            <div className="space-y-1.5">
              {cands.map((n, i) => {
                const m = modelOf(n);
                const bad = !m || m.status !== "on_sale" || m.quality_level < vForm.min_quality;
                return (
                  <div key={n} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2", bad ? "border-warning/50 bg-warning-soft/40" : "border-background-200")}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono-ui text-xs text-foreground-900">{n}</p>
                      <p className="text-[10px] text-foreground-500">{m ? `质量 ${m.quality_level} · ${m.status === "on_sale" ? "可售" : "不可售"}${m.support_json ? " · JSON" : ""}` : "目录中不存在"}{bad ? " · 当前不满足门槛，路由时将跳过" : ""}</p>
                    </div>
                    <RowBtn disabled={i === 0} onClick={() => move(i, -1)}><i className="ri-arrow-up-line" /></RowBtn>
                    <RowBtn disabled={i === cands.length - 1} onClick={() => move(i, 1)}><i className="ri-arrow-down-line" /></RowBtn>
                    <RowBtn danger onClick={() => setCands(cands.filter((x) => x !== n))}><i className="ri-close-line" /></RowBtn>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} className="w-auto! flex-1">
                <option value="">选择要加入的模型…</option>
                {opsModels.filter((m: any) => !cands.includes(m.model_name)).map((m: any) => <option key={m.id} value={m.model_name}>{m.model_name}（质量 {m.quality_level}{m.status === "on_sale" ? "" : "，不可售"}）</option>)}
              </Select>
              <Button variant="outline" disabled={!pick} onClick={() => { setCands([...cands, pick]); setPick(""); }}>加入</Button>
            </div>
            <Field label={vForm.id ? "变更说明" : "变更说明 *"} error={vErrs.change_reason}><Input value={vForm.change_reason} onChange={(e) => vset("change_reason", e.target.value)} placeholder="本版本改了什么" /></Field>
          </div>
        ) : null}
      </Drawer>

      {/* 发布 */}
      <Modal
        open={Boolean(publishV)}
        onClose={() => setPublishV(null)}
        title={`发布 v${publishV?.version}`}
        description="切换版本指针到该版本；上一发布版本保留为回滚目标。服务端会校验至少一个候选满足质量底线且可售。"
        footer={<><Button variant="outline" onClick={() => setPublishV(null)}>取消</Button><Button disabled={reason.trim().length < 2} onClick={async () => {
          const v = publishV; setPublishV(null);
          await act("POST", `/scenes/${v.id}/publish?reason=${encodeURIComponent(reason)}`, {}, `v${v.version} 已发布`);
        }}>确认发布</Button></>}
      >
        {publishV?.rollout_tenants ? <Notice tone="primary" className="mb-3">此版本设置了小范围放量，仅 {publishV.rollout_tenants.split(",").map((x: string) => tenantName(Number(x))).join("、")} 使用；其他企业继续使用上一发布版本。</Notice> : null}
        <Field label="发布说明 *"><Textarea rows={2} className="min-h-[60px]!" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="写入审计记录" /></Field>
      </Modal>

      {/* 放量 */}
      <Modal
        open={Boolean(rollV)}
        onClose={() => setRollV(null)}
        title={`v${rollV?.version} 放量范围`}
        description="不勾选任何企业即为全量；勾选后该版本发布时只对所选企业生效（金丝雀）。"
        footer={<><Button variant="outline" onClick={() => setRollV(null)}>取消</Button><Button onClick={async () => {
          const v = rollV; setRollV(null);
          await act("PUT", `/scene-versions/${v.id}/rollout`, { tenants: rollT.join(",") }, rollT.length ? `v${v.version} 已限定 ${rollT.length} 家企业放量` : `v${v.version} 已设为全量`);
        }}>保存</Button></>}
      >
        <div className="space-y-1.5">
          {raw.tenants.map((x: any) => {
            const id = String(x.tenant.id);
            return (
              <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-background-200 px-3 py-2 text-xs">
                <input type="checkbox" checked={rollT.includes(id)} onChange={(e) => setRollT(e.target.checked ? [...rollT, id] : rollT.filter((y) => y !== id))} />
                <span className="flex-1 text-foreground-900">{x.tenant.name}</span>
                <span className="font-mono-ui text-[10px] text-foreground-400">#{id}</span>
              </label>
            );
          })}
        </div>
      </Modal>
      {confirm.node}
    </div>
  );
}
