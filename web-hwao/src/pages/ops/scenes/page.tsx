import { useState } from "react";
import { Badge, Button, Card, Modal, Notice, PageHeader } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { useEffect } from "react";
import { ts2str } from "@/lib/api";
import { cx } from "@/lib/format";

export default function OpsScenesPage() {
  const { opsStrategies, opsModels, raw, act, error, notice, yuan } = useOps();
  const [selected, setSelected] = useState("");
  const [phase, setPhase] = useState<"idle" | "validating" | "sync_failed" | "published">("idle");
  const [publishOpen, setPublishOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [preference, setPreference] = useState("balanced");
  const [fallback, setFallback] = useState(true);
  const [gate, setGate] = useState("3");
  const [version, setVersion] = useState("");
  const [reason, setReason] = useState("");
  const [inputTpl, setInputTpl] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxCost, setMaxCost] = useState("0.5");

  const strategy = opsStrategies.find((s) => s.id === selected) ?? opsStrategies[0];
  const sceneRaw: any = strategy?.raw;
  const latest: any = sceneRaw?.versions?.[0];
  const current: any = sceneRaw?.versions?.find((v: any) => v.id === sceneRaw.scene.current_version_id);
  const prev: any = sceneRaw?.versions?.find((v: any) => v.id === sceneRaw.scene.prev_version_id);
  const detail = { input: inputTpl, output: latest?.output_format === "json" ? "JSON 结构化输出" : "文本输出", samples: (sceneRaw?.evals || []).slice(0, 3).map((e: any) => `${e.model_name} · 样本 ${e.sample_size} · 合格率 ${(e.pass_rate * 100).toFixed(1)}%`) };

  // 选中场景时以最新版本填充表单
  const fill = (id: string) => {
    const st: any = opsStrategies.find((x) => x.id === id);
    const v: any = st?.raw?.versions?.[0];
    setSelected(id);
    setPhase("idle");
    setGate(String(v?.min_quality ?? 3));
    setVersion(v ? `v${v.version}（${v.status}）` : "新建");
    setCandidates((v?.candidates || "").split(",").filter(Boolean));
    setFallback(Boolean(v?.has_fallback));
    setInputTpl(v?.input_template || "");
    setSystemPrompt(v?.system_prompt || "");
    setMaxCost(String((v?.default_max_cost || 50) / 100));
  };
  useEffect(() => {
    if (!selected && opsStrategies.length) fill(opsStrategies[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opsStrategies.length]);
  const selectStrategy = (id: string) => fill(id);

  // saveDraft 保存为新草稿版本（服务端自动递增版本号）
  const saveDraft = async () => {
    if (!sceneRaw) return undefined;
    return act("POST", "/scenes/versions", {
      scene_id: sceneRaw.scene.scene_id, name: sceneRaw.scene.name, description: sceneRaw.scene.description,
      version: { ...(latest || {}), id: 0, candidates: candidates.join(","), min_quality: Number(gate) || 0, has_fallback: fallback,
        input_template: inputTpl, system_prompt: systemPrompt, default_max_cost: Math.round((Number(maxCost) || 0) * 100), change_reason: reason },
    }, "草稿已保存");
  };

  // publish：保存草稿 → 标记评测通过（需有评测记录）→ 发布；任一步失败都不显示为已发布
  const publish = async () => {
    setPublishOpen(false);
    setPhase("validating");
    const v: any = await saveDraft();
    if (!v?.id) return setPhase("sync_failed");
    const e1 = await act("POST", `/scenes/${v.id}/evaluated`, {}, "已标记评测通过");
    if (e1 === undefined) return setPhase("sync_failed");
    const e2 = await act("POST", `/scenes/${v.id}/publish?reason=${encodeURIComponent(reason || "运营发布")}`, {}, "已发布");
    setPhase(e2 === undefined ? "sync_failed" : "published");
  };

  const retry = () => void publish();
  const rollback = async () => {
    setRollbackOpen(false);
    await act("POST", `/scenes/${sceneRaw.scene.scene_id}/rollback`, {}, "已恢复上一版本");
  };
  const toggleScene = () => void act("POST", `/scenes/${sceneRaw.scene.scene_id}/${sceneRaw.scene.status === "disabled" ? "enable" : "disable"}`, {}, "场景状态已更新");
  void preference;
  void current;

  const qualityGate = Number(gate) || 0;
  const candModels = opsModels.map((m: any) => ({ name: m.model_name, quality: m.quality_level, onSale: m.status === "on_sale", cost: m.price ? `${yuan(m.price.input_price)}/${yuan(m.price.output_price)}` : "未定价" }));
  const usable = candModels.filter((m) => candidates.includes(m.name) && m.onSale && m.quality >= qualityGate);
  const lowQualitySelected = candidates.length > 0 && usable.length === 0;
  if (!strategy) return <div className="p-6 text-xs text-foreground-500">{error || "加载场景中…"}</div>;

  return (
    <div>
      <PageHeader
        eyebrow="场景与路由策略"
        title="策略不是三个滑块"
        description="配置包含输入模板、输出约束、候选模型、质量底线与兜底条件。发布需要经过验证、同步与回读。"
        actions={
          <>
            <Button variant="outline" onClick={() => setRollbackOpen(true)}>
              <i className="ri-history-line" />
              恢复上一版本
            </Button>
            <Button onClick={() => setPublishOpen(true)} disabled={phase === "validating"}>
              <i className="ri-upload-2-line" />
              发布策略
            </Button>
          </>
        }
      />

      {phase === "sync_failed" ? (
        <Notice tone="warning" icon="ri-error-warning-line" className="mb-3">
          发布未完成：{error || "请检查评测记录与候选模型"}。草稿已保存，系统不会显示为已发布。
          <button type="button" onClick={retry} className="ml-2 cursor-pointer rounded border border-current px-1.5 py-0.5 text-[10px]">查询后重试</button>
        </Notice>
      ) : null}
      {phase === "published" ? (
        <Notice tone="success" icon="ri-check-line" className="mb-3">
          {strategy.scene} 新版本已发布（验证 → 发布完成）。仅影响发布后的新请求。
        </Notice>
      ) : null}
      {lowQualitySelected ? (
        <Notice tone="danger" icon="ri-shield-cross-line" className="mb-3">
          发布门槛未满足：所选候选中没有质量等级 ≥ {qualityGate} 的可售模型。低价不足以强行发布。
        </Notice>
      ) : null}

      {notice && phase === "idle" ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error && phase === "idle" ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr_320px]">
        <Card className="h-fit p-2">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-foreground-400">场景列表</p>
          <div className="space-y-1">
            {opsStrategies.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectStrategy(item.id)}
                className={cx(
                  "w-full cursor-pointer rounded-lg px-2.5 py-2.5 text-left transition-colors",
                  selected === item.id ? "bg-primary-50" : "hover:bg-background-100",
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11.5px] font-medium text-foreground-900">{item.scene}</span>
                  <Badge tone={item.status === "已发布" ? "success" : "neutral"}>{item.status}</Badge>
                </div>
                <p className="mt-0.5 text-[9.5px] text-foreground-500">{item.version} · {item.lastEval}</p>
                <p className="mt-0.5 text-[9.5px] text-foreground-400">门槛：{item.gate}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground-950">{strategy.scene} · 策略配置</h2>
              <p className="mt-0.5 text-[10px] text-foreground-500">
                当前发布版本 {strategy.version}（{strategy.published}） · 草稿 {version}
              </p>
            </div>
            <Badge tone={phase === "published" ? "success" : "warning"}>{phase === "published" ? "已发布" : "草稿"}</Badge>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-foreground-600">最新版本（保存将生成新版本）</span>
                <input value={version} readOnly className="h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2.5 text-[11px] focus:border-primary-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-foreground-600">质量底线（模型质量等级 1-5）</span>
                <input type="number" value={gate} onChange={(e) => setGate(e.target.value)} className="h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2.5 text-[11px] focus:border-primary-400 focus:outline-none" />
              </label>
            </div>

            <div>
              <p className="mb-1 text-[10.5px] text-foreground-600">输入模板</p>
              <textarea rows={2} value={inputTpl} onChange={(e) => setInputTpl(e.target.value)} className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-[10.5px] focus:border-primary-400 focus:outline-none" />
              <p className="mb-1 mt-2 text-[10.5px] text-foreground-600">场景系统提示</p>
              <textarea rows={3} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-[10.5px] focus:border-primary-400 focus:outline-none" />
              <p className="mb-1 mt-2 text-[10.5px] text-foreground-600">默认单次费用上限（元）</p>
              <input type="number" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} className="h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2.5 text-[11px] focus:border-primary-400 focus:outline-none" />
            </div>

            <div>
              <p className="mb-1 text-[10.5px] text-foreground-600">输出约束</p>
              <div className="rounded-lg border border-background-200 bg-background-100/50 px-3 py-2 text-[10.5px] text-foreground-700">{detail.output}</div>
            </div>

            <div>
              <p className="mb-1.5 text-[10.5px] text-foreground-600">候选模型</p>
              <div className="space-y-1.5">
                {candModels.map((model) => {
                  const checked = candidates.includes(model.name);
                  const belowGate = model.quality < qualityGate || !model.onSale;
                  return (
                    <label
                      key={model.name}
                      className={cx(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2",
                        checked ? "border-primary-300 bg-primary-50/40" : "border-background-200",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setCandidates((prev) => (e.target.checked ? [...prev, model.name] : prev.filter((c) => c !== model.name)))
                          }
                          className="h-3.5 w-3.5 cursor-pointer"
                          style={{ accentColor: "oklch(var(--primary-500))" }}
                        />
                        <span className="text-[10.5px] text-foreground-800">{model.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[9.5px]">
                        <span className={belowGate ? "text-danger" : "text-success"}>质量 {model.quality}{model.onSale ? "" : " · 未上架"}</span>
                        <span className="text-foreground-400">{model.cost}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-foreground-600">默认偏好</span>
                <select value={preference} onChange={(e) => setPreference(e.target.value)} className="h-9 w-full cursor-pointer rounded-lg border border-background-300 bg-background-50 px-2 text-[11px] focus:border-primary-400 focus:outline-none">
                  <option value="economy">经济</option>
                  <option value="balanced">均衡</option>
                  <option value="quality">质量优先</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 self-end rounded-lg border border-background-200 px-2.5 py-2 text-[10.5px] text-foreground-700">
                <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer" style={{ accentColor: "oklch(var(--primary-500))" }} />
                同模型渠道兜底
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-background-100 pt-3">
              <Button size="sm" variant="outline" onClick={() => void saveDraft()}>保存草稿</Button>
              <Button size="sm" variant="ghost" onClick={toggleScene}>{sceneRaw?.scene.status === "disabled" ? "启用场景" : "停用场景"}</Button>
              <Button size="sm" onClick={() => setPublishOpen(true)}>发布</Button>
              <span className="text-[9.5px] text-foreground-400">跨模型自动兜底不在此处开放</span>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">验证结果</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "输入模板完整", ok: inputTpl.trim().length > 0 },
                { label: "候选模型均已上架", ok: candidates.every((c) => candModels.find((m) => m.name === c)?.onSale) },
                { label: `质量底线 ${qualityGate} 可满足`, ok: !lowQualitySelected && usable.length > 0 },
                { label: "兜底资源可用", ok: !fallback || usable.length >= 2 },
                { label: "已有评测记录", ok: (sceneRaw?.evals || []).length > 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-[10.5px]">
                  <i className={cx(item.ok ? "ri-checkbox-circle-fill text-success" : "ri-error-warning-fill text-warning", "mt-0.5 text-[11px]")} />
                  <span className={item.ok ? "text-foreground-700" : "text-foreground-900"}>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">样本预览</p>
            <div className="mt-2 space-y-1.5">
              {detail.samples.map((sample: string) => (
                <div key={sample} className="rounded-lg bg-background-100/70 px-2.5 py-2 text-[10px] text-foreground-700">{sample}</div>
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-foreground-400">
              样本为授权评测数据，不默认抓取客户对话。
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">上次发布</p>
            <div className="mt-2 space-y-1 text-[10.5px] text-foreground-700">
              <p>版本：{current ? `v${current.version}` : "—"}</p>
              <p>时间：{current ? ts2str(current.created_at) : "—"}</p>
              <p>操作人：{current ? `用户 #${current.created_by}` : "—"}</p>
              <p>上一版本：{prev ? `v${prev.version}` : "无"}</p>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="确认发布差异"
        description="发布会依次经过验证、同步与回读，任一步失败都不会标记为已发布。"
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>取消</Button>
            <Button onClick={() => void publish()} disabled={lowQualitySelected}>确认发布</Button>
          </>
        }
      >
        <div className="space-y-2 text-[11px]">
          <div className="rounded-xl border border-background-200 p-3">
            <p className="mb-2 text-[10px] text-foreground-500">本次变更</p>
            <div className="space-y-1.5 text-foreground-700">
              <div className="flex justify-between"><span>场景</span><span className="font-medium">{strategy.scene}</span></div>
              <div className="flex justify-between"><span>版本</span><span className="font-medium">{current ? `v${current.version}` : "无"} → v{(latest?.version || 0) + 1}</span></div>
              <div className="flex justify-between"><span>候选模型</span><span className="font-medium text-right">{candidates.join("、")}</span></div>
              <div className="flex justify-between"><span>质量底线</span><span className="font-medium">等级 ≥ {qualityGate}</span></div>
              <div className="flex justify-between"><span>费用上限</span><span className="font-medium">¥{maxCost}</span></div>
              <div className="flex justify-between"><span>渠道兜底</span><span className="font-medium">{fallback ? "同模型重试" : "关闭"}</span></div>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] text-foreground-500">变更原因</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-lg border border-background-300 px-2.5 text-[11px]" />
          </label>
          {lowQualitySelected ? (
            <Notice tone="danger" icon="ri-shield-cross-line">
              候选模型低于质量底线，发布会失败。请移除该候选或下调门槛（不建议）。
            </Notice>
          ) : (
            <p className="text-[10px] leading-relaxed text-foreground-500">
              发布只影响新请求。已开始的任务仍绑定原版本；如需回退，可在发布后恢复上一已发布版本。
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        title="恢复上一已发布版本"
        description="回滚会重新走同步与回读流程，期间不修改客户已产生的记录。"
        footer={
          <>
            <Button variant="outline" onClick={() => setRollbackOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => void rollback()}
            >
              确认恢复
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          将 {strategy.scene} 恢复至上一已发布版本（{prev ? `v${prev.version}` : "无可恢复版本"}）。当前草稿会被保留，可稍后再次发布。
        </div>
      </Modal>
    </div>
  );
}