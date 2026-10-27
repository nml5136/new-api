import { useState } from "react";
import { Badge, Button, Card, Modal, Notice, PageHeader } from "@/components/base/ui";
import { opsStrategies } from "@/mocks/ops";
import { cx } from "@/lib/format";

const strategyDetail: Record<string, { input: string; output: string; gate: string; samples: string[] }> = {
  "st-copy": {
    input: "商品事实 / 渠道 / 语气 / 长度 / 禁用词",
    output: "标题 + 卖点短句 + 详情段落，长度受渠道约束",
    gate: "90",
    samples: ["秋季保温杯详情页", "双十一预热短文案", "家居活动页文案"],
  },
  "st-summary": {
    input: "原文 / 摘要长度 / 是否提取行动项",
    output: "要点列表 + 行动项（含负责人或时间）",
    gate: "88",
    samples: ["客户反馈周报", "产品评审纪要", "调研长文压缩"],
  },
  "st-extract": {
    input: "原始文本 / 字段定义 / 空值规则",
    output: "字段表格 + JSON，类型与必填校验",
    gate: "95",
    samples: ["采购合同", "订单信息", "销售线索"],
  },
};

export default function OpsScenesPage() {
  const [selected, setSelected] = useState(opsStrategies[0].id);
  const [phase, setPhase] = useState<"idle" | "validating" | "sync_failed" | "published">("idle");
  const [publishOpen, setPublishOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [candidates, setCandidates] = useState<string[]>(["示例模型 A", "示例模型 B"]);
  const [preference, setPreference] = useState("balanced");
  const [fallback, setFallback] = useState(true);
  const [gate, setGate] = useState(strategyDetail[opsStrategies[0].id].gate);
  const [version, setVersion] = useState("v1.4");

  const strategy = opsStrategies.find((s) => s.id === selected) ?? opsStrategies[0];
  const detail = strategyDetail[selected];

  const selectStrategy = (id: string) => {
    setSelected(id);
    setPhase("idle");
    setGate(strategyDetail[id].gate);
    setVersion(id === "st-extract" ? "v0.9-draft" : id === "st-summary" ? "v1.2" : "v1.4");
    setCandidates(id === "st-extract" ? ["示例模型 C", "示例模型 A"] : id === "st-summary" ? ["示例模型 A", "示例模型 E"] : ["示例模型 A", "示例模型 B"]);
    setPreference(id === "st-extract" ? "quality" : "balanced");
    setFallback(id !== "st-extract");
  };

  const publish = () => {
    setPublishOpen(false);
    setPhase("validating");
    window.setTimeout(() => setPhase("sync_failed"), 1400);
  };

  const retry = () => {
    setPhase("validating");
    window.setTimeout(() => setPhase("published"), 1200);
  };

  const qualityGate = Number(gate) || 0;
  const lowQualitySelected = selected === "st-copy" && candidates.includes("示例模型 B") && qualityGate > 85;

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
          同步失败：策略草稿已保存，但未确认发布。请查询同步结果后重试，系统不会显示为已发布。
          <button type="button" onClick={retry} className="ml-2 cursor-pointer rounded border border-current px-1.5 py-0.5 text-[10px]">查询后重试</button>
        </Notice>
      ) : null}
      {phase === "published" ? (
        <Notice tone="success" icon="ri-check-line" className="mb-3">
          {strategy.scene} 策略 {version} 已发布（验证 → 同步 → 回读完成）。仅影响发布后的新请求。
        </Notice>
      ) : null}
      {lowQualitySelected ? (
        <Notice tone="danger" icon="ri-shield-cross-line" className="mb-3">
          发布门槛未满足：示例模型 B 在电商文案样本上的质量达标率为 79.4%，低于当前质量底线 {qualityGate}%。低价不足以强行发布。
        </Notice>
      ) : null}

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
                <span className="mb-1 block text-[10.5px] text-foreground-600">草稿版本号</span>
                <input value={version} onChange={(e) => setVersion(e.target.value)} className="h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2.5 text-[11px] focus:border-primary-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] text-foreground-600">质量底线（达标率 %）</span>
                <input type="number" value={gate} onChange={(e) => setGate(e.target.value)} className="h-9 w-full rounded-lg border border-background-300 bg-background-50 px-2.5 text-[11px] focus:border-primary-400 focus:outline-none" />
              </label>
            </div>

            <div>
              <p className="mb-1 text-[10.5px] text-foreground-600">输入模板</p>
              <div className="rounded-lg border border-background-200 bg-background-100/50 px-3 py-2 text-[10.5px] text-foreground-700">{detail.input}</div>
            </div>

            <div>
              <p className="mb-1 text-[10.5px] text-foreground-600">输出约束</p>
              <div className="rounded-lg border border-background-200 bg-background-100/50 px-3 py-2 text-[10.5px] text-foreground-700">{detail.output}</div>
            </div>

            <div>
              <p className="mb-1.5 text-[10.5px] text-foreground-600">候选模型</p>
              <div className="space-y-1.5">
                {[
                  { name: "示例模型 A", quality: "92.5%", cost: "¥0.043" },
                  { name: "示例模型 B", quality: "79.4%", cost: "¥0.021" },
                  { name: "示例模型 C", quality: "96.0%", cost: "¥0.094" },
                ].map((model) => {
                  const checked = candidates.includes(model.name);
                  const belowGate = parseFloat(model.quality) < qualityGate;
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
                        <span className={belowGate ? "text-danger" : "text-success"}>{model.quality}</span>
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
              <Button size="sm" variant="outline" onClick={() => setPhase("idle")}>保存草稿</Button>
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
                { label: "输入模板完整", ok: true },
                { label: "候选模型均已授权", ok: true },
                { label: `质量底线 ${qualityGate}% 可满足`, ok: !lowQualitySelected },
                { label: "同模型渠道兜底可用", ok: fallback },
                { label: "价格版本已确认", ok: selected !== "st-extract" },
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
              {detail.samples.map((sample) => (
                <div key={sample} className="rounded-lg bg-background-100/70 px-2.5 py-2 text-[10px] text-foreground-700">{sample}</div>
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-foreground-400">
              样本为演示或授权数据，不默认抓取客户对话。
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">上次发布</p>
            <div className="mt-2 space-y-1 text-[10.5px] text-foreground-700">
              <p>版本：{strategy.version}</p>
              <p>时间：{strategy.published}</p>
              <p>操作人：运营 · 陈屿</p>
              <p>回读：成功</p>
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
            <Button onClick={publish} disabled={lowQualitySelected}>确认发布</Button>
          </>
        }
      >
        <div className="space-y-2 text-[11px]">
          <div className="rounded-xl border border-background-200 p-3">
            <p className="mb-2 text-[10px] text-foreground-500">本次变更</p>
            <div className="space-y-1.5 text-foreground-700">
              <div className="flex justify-between"><span>场景</span><span className="font-medium">{strategy.scene}</span></div>
              <div className="flex justify-between"><span>版本</span><span className="font-medium">{strategy.version} → {version}</span></div>
              <div className="flex justify-between"><span>候选模型</span><span className="font-medium text-right">{candidates.join("、")}</span></div>
              <div className="flex justify-between"><span>质量底线</span><span className="font-medium">{qualityGate}%</span></div>
              <div className="flex justify-between"><span>价格版本</span><span className="font-medium">2026-10-01 生效版本</span></div>
              <div className="flex justify-between"><span>渠道兜底</span><span className="font-medium">{fallback ? "同模型重试" : "关闭"}</span></div>
            </div>
          </div>
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
              onClick={() => {
                setRollbackOpen(false);
                setPhase("idle");
              }}
            >
              确认恢复
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          将 {strategy.scene} 恢复至上一已发布版本（{strategy.version}）。当前草稿会被保留，可稍后再次发布。
        </div>
      </Modal>
    </div>
  );
}