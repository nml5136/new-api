import { cx, money } from "@/lib/format";
import type { ModelInfo, Preference, UsageRecord } from "@/lib/types";

const prefLabel: Record<Preference, string> = { economy: "经济", balanced: "均衡", quality: "质量优先" };

interface Props {
  model: ModelInfo;
  preference: Preference;
  cap: number;
  estimated: number;
  remaining: number;
  record?: UsageRecord;
  running: boolean;
  onOpenExplain: () => void;
  onCandidates: () => void;
}

export default function RouteSummary({
  model,
  preference,
  cap,
  estimated,
  remaining,
  record,
  running,
  onOpenExplain,
  onCandidates,
}: Props) {
  const overCap = estimated > cap;
  const ratio = cap > 0 ? Math.min(100, (estimated / cap) * 100) : 0;
  const settled = record?.billing === "settled";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-background-200 bg-background-50 px-3.5 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <i className="ri-route-line text-[15px]" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground-900">
            {model.name}
            <span className="rounded bg-background-100 px-1.5 py-0.5 text-[9px] font-normal text-foreground-500">{prefLabel[preference]}</span>
          </p>
          <p className="mt-0.5 truncate text-[10px] text-foreground-500">
            能力符合 · 场景评测达标 · 预算可容纳
          </p>
        </div>
      </div>

      <div className="hidden h-8 w-px shrink-0 bg-background-200 lg:block" />

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-foreground-600">
        <span className="flex items-center gap-1">
          <i className="ri-stack-line text-foreground-400" />
          实际模型 <span className="font-medium text-foreground-900">{record?.model ?? model.name}</span>
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-shield-check-line text-foreground-400" />
          {record ? (running ? "生成完成后检查" : "检查结果见结果区") : "提交后检查本次输出"}
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-loop-right-line text-foreground-400" />
          同模型通道重试
        </span>
        <span className="hidden items-center gap-1 text-foreground-400 xl:flex">
          <i className="ri-forbid-line" />
          跨模型自动兜底未启用
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-[104px]">
          <div className="flex items-center justify-between gap-2 text-[9.5px] text-foreground-500">
            <span>{settled ? "已结算" : "预估费用"}</span>
            <span className={cx("tnum font-medium", overCap ? "text-warning" : "text-foreground-900")}>
              {record?.cost === null ? "待核对" : money(record?.cost ?? estimated, 3)}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-background-100">
            <div
              className={cx("h-full rounded-full transition-all duration-500", overCap ? "bg-warning" : "bg-primary-500")}
              style={{ width: `${Math.max(4, ratio)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9px] text-foreground-400">上限 {money(cap)} · 余 {money(Math.max(0, remaining))}</p>
        </div>
        <button
          type="button"
          onClick={onCandidates}
          className="hidden h-8 cursor-pointer items-center gap-1 rounded-lg border border-background-300 px-2.5 text-[10.5px] text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700 md:inline-flex"
        >
          候选
        </button>
        <button
          type="button"
          onClick={onOpenExplain}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-background-100 px-2.5 text-[10.5px] font-medium text-foreground-800 transition-colors hover:bg-background-200"
        >
          路由解释
          <i className="ri-arrow-right-s-line" />
        </button>
      </div>
    </div>
  );
}