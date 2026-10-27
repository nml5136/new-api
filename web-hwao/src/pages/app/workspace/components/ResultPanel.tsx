import { Button, EmptyState } from "@/components/base/ui";
import { cx, money, recordStatusMeta, billingStatusMeta } from "@/lib/format";
import type { QualityCheck, UsageRecord } from "@/lib/types";

interface Props {
  record?: UsageRecord;
  output: string;
  running: boolean;
  stage: number;
  estimated: number;
  copied: boolean;
  feedback: "up" | "down" | null;
  onCopy: () => void;
  onDownload: () => void;
  onFeedback: (value: "up" | "down") => void;
  onRegenerate: () => void;
  onOpenDetail: () => void;
  onRestoreSource: () => void;
  onResolve: (outcome: "completed" | "failed") => void;
  onNewTask: () => void;
}

const checkLabel: Record<string, { icon: string; tone: string }> = {
  pass: { icon: "ri-checkbox-circle-fill", tone: "text-success" },
  fail: { icon: "ri-close-circle-fill", tone: "text-danger" },
  unverified: { icon: "ri-question-line", tone: "text-warning" },
  pending: { icon: "ri-time-line", tone: "text-foreground-400" },
};

export default function ResultPanel({
  record,
  output,
  running,
  stage,
  estimated,
  copied,
  feedback,
  onCopy,
  onDownload,
  onFeedback,
  onRegenerate,
  onOpenDetail,
  onRestoreSource,
  onResolve,
  onNewTask,
}: Props) {
  if (!record && !running && !output) {
    return (
      <EmptyState
        icon="ri-sparkling-2-line"
        title="还没有结果"
        description="填好输入后点击生成。任务会先做预算校验，再确定模型，结果、检查、费用与调用记录会同时产生。"
        action={
          <button type="button" onClick={onNewTask} className="cursor-pointer text-xs text-primary-600 hover:text-primary-700">
            查看可用场景
            <i className="ri-arrow-right-line ml-1" />
          </button>
        }
      />
    );
  }

  const statusMeta = record ? recordStatusMeta[record.status] ?? recordStatusMeta.completed : null;
  const billingMeta = record ? billingStatusMeta[record.billing] ?? billingStatusMeta.settled : null;
  const unknown = record?.status === "unknown";
  const settled = record?.billing === "settled";
  const stages = ["检查预算", "确定模型", "生成内容", settled ? "结算完成" : "结算中"];
  const checks: QualityCheck[] = record?.checks ?? [];
  const failed = checks.some((c) => c.status === "fail");

  return (
    <div className="overflow-hidden rounded-2xl border border-background-200 bg-background-50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-background-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-foreground-950">{record?.title ?? "正在生成"}</p>
            {statusMeta ? (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">{statusMeta.label}</span>
            ) : null}
            {billingMeta ? (
              <span className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] text-foreground-600">{billingMeta.label}</span>
            ) : null}
            {!running && checks.length > 0 ? (
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  failed ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
                )}
              >
                {failed ? "质量未通过" : "质量检查通过"}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-foreground-500">
            <span className="flex items-center gap-1"><i className="ri-stack-line" />实际模型：{record?.model ?? "—"}</span>
            <span className="flex items-center gap-1"><i className="ri-route-line" />会话保持</span>
            {record && settled ? (
              <span className="tnum">{record.tokensIn.toLocaleString()} 输入 / {record.tokensOut.toLocaleString()} 输出 Token</span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] text-foreground-500">{settled ? "本次净费用" : "预估费用"}</p>
          <p className="tnum font-heading text-lg font-semibold text-foreground-950">
            {record?.cost === null ? "待核对" : money(record?.cost ?? estimated)}
          </p>
          <p className="text-[9.5px] text-foreground-400">{settled ? "已从企业余额扣除" : "预扣中，结算后以实际用量为准"}</p>
        </div>
      </div>

      {running || record ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-background-100 bg-background-100/50 px-4 py-2">
          {stages.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className={cx(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[8px]",
                  i < stage || (i === 3 && settled)
                    ? "bg-success-soft text-success"
                    : i === stage
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-200 text-foreground-500",
                )}
              >
                {i < stage || (i === 3 && settled) ? <i className="ri-check-line" /> : i + 1}
              </span>
              <span className={cx("text-[10px]", i <= stage ? "text-foreground-800" : "text-foreground-400")}>{label}</span>
              {i < stages.length - 1 ? <i className="ri-arrow-right-s-line text-[10px] text-foreground-300" /> : null}
            </div>
          ))}
          {!running && stage >= 3 ? (
            <button type="button" onClick={onOpenDetail} className="ml-auto cursor-pointer text-[10px] text-primary-600 hover:text-primary-700">
              查看路由与计费记录
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="p-4">
        {unknown ? (
          <div className="rounded-xl border border-warning bg-warning-soft/60 p-4">
            <div className="flex items-start gap-2.5">
              <i className="ri-time-line mt-0.5 text-sm text-warning" />
              <div>
                <p className="text-xs font-medium text-foreground-950">正在核对执行与费用</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">
                  该请求已提交但未收到完整回执，费用暂不计入余额。为避免重复扣费，核对完成前不会重新执行。
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Button size="sm" onClick={() => onResolve("completed")}>查询状态（确认完成）</Button>
                  <Button size="sm" variant="outline" onClick={() => onResolve("failed")}>查询状态（失败并释放）</Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-[170px] rounded-xl border border-background-100 bg-background-50 p-3.5">
              {output ? (
                <pre className="whitespace-pre-wrap font-sans text-xs leading-[1.9] text-foreground-800">
                  {output}
                  {running ? <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-primary-500 align-middle" /> : null}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="ri-loader-4-line mb-2 animate-spin text-lg text-primary-500" />
                  <p className="text-[11px] text-foreground-500">正在生成内容，请稍候…</p>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-background-100 bg-background-100/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-foreground-700">
                  <i className="ri-shield-check-line" />
                  质量检查
                </p>
                <span className="rounded bg-background-50 px-1.5 py-0.5 text-[9px] text-foreground-400">
                  {running ? "生成完成后逐项检查" : "示例检查结果 · 非真实自动验真"}
                </span>
              </div>
              {running ? (
                <p className="mt-2 text-[10px] leading-relaxed text-foreground-500">
                  生成过程中不对本次输出判定通过。事实一致性、禁用词、长度与格式将在输出结束后分别给出结论。
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {checks.map((check) => {
                    const meta = checkLabel[check.status] ?? checkLabel.pending;
                    return (
                      <li key={check.key} className="flex items-start gap-2">
                        <i className={cx(meta.icon, meta.tone, "mt-0.5 text-[11px]")} />
                        <div className="min-w-0">
                          <p className="text-[10.5px] text-foreground-800">
                            {check.label}
                            <span className={cx("ml-1.5 text-[9.5px]", meta.tone)}>
                              {check.status === "pass" ? "通过" : check.status === "fail" ? "未通过" : check.status === "unverified" ? "未验证" : "待确认"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[9.5px] leading-relaxed text-foreground-500">{check.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {record?.status === "interrupted" ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-warning bg-warning-soft/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10.5px] leading-relaxed text-foreground-700">
                  输出已中断，已发生用量按实际结算 {record.cost === null ? "（待核对）" : money(record.cost)}。
                </p>
                <button type="button" onClick={onOpenDetail} className="cursor-pointer text-[10.5px] font-medium text-primary-700 hover:text-primary-800">
                  查看明细或申请费用核验
                </button>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-background-100 pt-3">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[11px] text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
              >
                <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
                {copied ? "已复制" : "复制"}
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[11px] text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
              >
                <i className="ri-download-2-line" />
                下载文本
              </button>
              <button
                type="button"
                onClick={onRestoreSource}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[11px] text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
              >
                <i className="ri-history-line" />
                载入原始输入
              </button>
              <button
                type="button"
                onClick={() => onFeedback("up")}
                aria-label="结果满意"
                className={cx(
                  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                  feedback === "up" ? "border-success bg-success-soft text-success" : "border-background-300 text-foreground-600 hover:text-foreground-900",
                )}
              >
                <i className="ri-thumb-up-line" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback("down")}
                aria-label="结果不满意"
                className={cx(
                  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                  feedback === "down" ? "border-warning bg-warning-soft text-warning" : "border-background-300 text-foreground-600 hover:text-foreground-900",
                )}
              >
                <i className="ri-thumb-down-line" />
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={onRegenerate}>
                  <i className="ri-refresh-line" />
                  重新生成
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenDetail}>
                  调用详情
                  <i className="ri-arrow-right-line" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[9.5px] text-foreground-400">重新生成会作为新任务计费；停止生成时已发生用量仍可能计费。</p>
          </>
        )}
      </div>
    </div>
  );
}