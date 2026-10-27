import { ProgressBar } from "@/components/base/ui";
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
  switchNote: string;
  onCandidates: () => void;
  onSwitch: () => void;
  onCollapse: () => void;
}

export default function ModelPanel({ model, preference, cap, estimated, remaining, record, running, switchNote, onCandidates, onSwitch, onCollapse }: Props) {
  const overCap = estimated > cap;
  const attempts = record?.attempts ?? [];
  const channelSwitched = attempts.some((a) => a.result !== "success") && attempts.length > 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-background-800 bg-background-950 text-background-50">
      <div className="flex items-center justify-between border-b border-background-50/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <i className="ri-route-line text-accent-500" />
          <p className="text-[11px] font-medium text-background-50/85">路由解释</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="收起解释栏"
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-background-50/40 hover:bg-background-50/10 hover:text-background-50/80"
        >
          <i className="ri-contract-right-line text-xs" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-heading text-[15px] font-semibold">{model.name}</p>
            <p className="mt-0.5 text-[10px] text-background-50/40">{model.version}</p>
          </div>
          <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[9px] text-accent-400">{prefLabel[preference]}</span>
        </div>

        <div className="mt-3 space-y-2">
          {[
            { label: "能力符合", value: `${model.context} 上下文 · ${model.structured ? "支持结构化输出" : "长文生成"}` },
            { label: "场景评测达标", value: "对应场景的离线评测门槛已达标" },
            { label: "预算可容纳", value: `预估 ${money(estimated)} / 单次上限 ${money(cap)}` },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <i className="ri-checkbox-circle-fill mt-0.5 text-[11px] text-accent-500" />
              <div className="min-w-0">
                <p className="text-[10.5px] text-background-50/80">{item.label}</p>
                <p className="mt-0.5 text-[9.5px] leading-relaxed text-background-50/40">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-background-50/10 bg-background-50/5 p-3">
          <div className="flex items-center justify-between text-[10px] text-background-50/50">
            <span>费用边界</span>
            <span className={cx("tnum", overCap ? "text-warning" : "text-background-50/80")}>{money(estimated, 3)}</span>
          </div>
          <div className="mt-2">
            <ProgressBar value={cap > 0 ? Math.min(100, (estimated / cap) * 100) : 0} tone={overCap ? "warning" : "accent"} className="bg-background-50/10" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[9.5px] text-background-50/40">
            <span>硬上限 {money(cap)}</span>
            <span>剩余预算 {money(Math.max(0, remaining))}</span>
          </div>
          {overCap ? (
            <p className="mt-2 rounded bg-warning-soft px-2 py-1 text-[9.5px] leading-relaxed text-warning">预估超过单次上限，提交会被拒绝。</p>
          ) : null}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-background-50/10 pt-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-background-50/45">路由方式</span>
            <span className="text-background-50/80">{record ? "会话保持" : "场景选型"}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-background-50/45">实际模型</span>
            <span className="text-background-50/80">{record?.model ?? model.name}</span>
          </div>
          <div className="flex items-start justify-between gap-2 text-[10px]">
            <span className="text-background-50/45">容灾</span>
            <span className="text-right text-[9.5px] leading-relaxed text-background-50/70">
              同模型渠道重试已启用
              <br />
              <span className="text-background-50/35">跨模型切换未启用</span>
            </span>
          </div>
        </div>

        {channelSwitched ? (
          <div className="mt-3 rounded-lg border border-accent-500/25 bg-accent-500/10 px-2.5 py-2 text-[9.5px] leading-relaxed text-accent-300">
            已切换服务通道，实际模型未变化。仅产生一个最终净费用。
          </div>
        ) : null}

        {switchNote ? (
          <div className="mt-3 rounded-lg border border-primary-400/30 bg-primary-500/10 px-2.5 py-2 text-[9.5px] leading-relaxed text-primary-200">
            {switchNote}
          </div>
        ) : null}

        {running ? (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-background-50/5 px-2.5 py-2 text-[9.5px] text-background-50/50">
            <i className="ri-loader-4-line animate-spin text-accent-500" />
            正在生成，费用将在结算后确认
          </div>
        ) : null}

        <button
          type="button"
          onClick={onCandidates}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-background-50/15 py-2 text-[10px] text-background-50/70 transition-colors hover:bg-background-50/10"
        >
          <i className="ri-list-check-2" />
          查看候选模型
        </button>
        <button
          type="button"
          onClick={onSwitch}
          className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] text-background-50/40 transition-colors hover:bg-background-50/5 hover:text-background-50/70"
        >
          <i className="ri-arrow-left-right-line" />
          切换模型（新建会话）
        </button>
      </div>
      <div className="border-t border-background-50/10 px-4 py-2 text-[9px] leading-relaxed text-background-50/25">
        费用按实际用量结算，明细可在调用记录中查看。
      </div>
    </div>
  );
}