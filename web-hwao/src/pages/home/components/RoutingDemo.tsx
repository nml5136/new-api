import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";

type SceneKey = "copy" | "summary" | "extract";

const scenes: Record<
  SceneKey,
  { label: string; task: string; detail: string; cap: string; cost: string; result: string; preview: string[] }
> = {
  copy: {
    label: "商品文案",
    task: "生成商品文案",
    detail: "480ml 保温杯 · 详情页",
    cap: "¥0.10",
    cost: "¥0.04",
    result: "文案已生成",
    preview: ["标题：暖意 12 小时 · 通勤随手杯", "卖点：92℃ 热水，24 小时后仍有 58℃", "详情段落：316 不锈钢内胆，单手弹盖…"],
  },
  summary: {
    label: "办公摘要",
    task: "生成办公摘要",
    detail: "华东区反馈 · 9 月",
    cap: "¥0.10",
    cost: "¥0.05",
    result: "摘要已生成",
    preview: ["要点 1：214 条反馈，时效问题占 36%", "要点 2：苏州仓平均延迟 1.6 天", "行动项：仓储补货与延迟预警方案"],
  },
  extract: {
    label: "信息提取",
    task: "提取合同字段",
    detail: "采购合同 · 8 个字段",
    cap: "¥0.12",
    cost: "¥0.09",
    result: "字段已提取",
    preview: ["contract_no: XL-2026-0917", "amount: 186000.00 · CNY", "remark: null（原文未提及）"],
  },
};

const candidates = [
  { id: "a", name: "示例模型 A", tag: "128K · 已验证", note: "均衡生成，当前场景默认候选", selected: true },
  { id: "b", name: "示例模型 B", tag: "64K · 备选", note: "低成本候选，长文需人工复核", selected: false },
  { id: "c", name: "示例模型 C", tag: "256K · 备选", note: "质量优先，费用约为均衡候选两倍", selected: false },
];

const stageText = [
  { title: "接收任务", desc: "检查预算与单次上限" },
  { title: "匹配场景能力", desc: "比较候选模型的场景评测门槛" },
  { title: "选定执行模型", desc: "只点亮一条实际执行的路径" },
  { title: "New API 执行中", desc: "同模型通道执行与计量" },
  { title: "结果与费用返回", desc: "结果回传后完成结算" },
];

const PATH_TASK = "M 196 146 C 240 146 262 230 320 230";
const PATH_A = "M 320 230 C 370 190 382 72 438 60";
const PATH_B = "M 320 230 C 374 230 390 140 438 132";
const PATH_C = "M 320 230 C 374 236 390 214 438 206";
const PATH_EXEC = "M 320 230 C 320 268 306 276 306 300";
const PATH_RESULT = "M 452 328 C 466 328 464 336 472 336";

function Signal({ path, dur, delay, color }: { path: string; dur: number; delay: number; color: string }) {
  return (
    <circle r="2.6" fill={color} filter="url(#signalGlow)">
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

export default function RoutingDemo() {
  const [sceneKey, setSceneKey] = useState<SceneKey>("copy");
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [retryMode, setRetryMode] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scene = scenes[sceneKey];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setInView(entries[0]?.isIntersecting ?? true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !playing || hovering || !inView) return;
    const id = window.setInterval(() => {
      setElapsed((value) => (value >= 16800 ? 0 : value + 100));
    }, 100);
    return () => window.clearInterval(id);
  }, [reduced, playing, hovering, inView]);

  const stage = reduced ? 4 : elapsed < 3000 ? 0 : elapsed < 6000 ? 1 : elapsed < 9000 ? 2 : elapsed < 12000 ? 3 : 4;
  const progress = reduced ? 100 : Math.min(100, (elapsed / 16000) * 100);

  const pickScene = (key: SceneKey) => {
    setSceneKey(key);
    setElapsed(0);
    setPlaying(true);
    setInspect(null);
    setRetryMode(false);
  };

  const selected = candidates[0];

  return (
    <div
      ref={wrapRef}
      className="relative rounded-2xl border border-background-50/10 bg-background-950/40 p-3 sm:p-4"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-heading text-[13px] font-semibold text-background-50/90">每个任务，都有清晰的执行路径</p>
          <p className="mt-0.5 text-[10px] text-background-50/40">任务 → 场景选型 → 模型 → 网关执行 → 结果与费用</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-background-50/15 px-2 py-0.5 text-[9px] text-background-50/50">交互演示</span>
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            aria-label={playing ? "暂停演示" : "继续演示"}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-background-50/15 text-background-50/60 transition-colors hover:bg-background-50/10 hover:text-background-50"
          >
            <i className={cx(playing ? "ri-pause-mini-line" : "ri-play-mini-line", "text-[11px]")} />
          </button>
          <button
            type="button"
            onClick={() => {
              setElapsed(0);
              setPlaying(true);
              setRetryMode(false);
            }}
            aria-label="重新播放"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-background-50/15 text-background-50/60 transition-colors hover:bg-background-50/10 hover:text-background-50"
          >
            <i className="ri-restart-line text-[11px]" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(Object.keys(scenes) as SceneKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pickScene(key)}
            className={cx(
              "cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] transition-colors",
              sceneKey === key
                ? "bg-background-50 text-background-950"
                : "border border-background-50/15 text-background-50/55 hover:bg-background-50/10 hover:text-background-50/85",
            )}
          >
            {scenes[key].label}
          </button>
        ))}
      </div>

      {/* 桌面画布 */}
      <div className="relative hidden h-[400px] w-full lg:block">
        <svg viewBox="0 0 640 460" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="lineHot" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(var(--primary-400))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="oklch(var(--accent-400))" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="lineCold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(var(--background-50))" stopOpacity="0.16" />
              <stop offset="100%" stopColor="oklch(var(--background-50))" stopOpacity="0.07" />
            </linearGradient>
            <filter id="signalGlow" x="-200%" y="-200%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={PATH_TASK} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 1 ? "url(#lineHot)" : "url(#lineCold)"} strokeWidth="1.2" />
          <path d={PATH_A} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 2 ? "url(#lineHot)" : stage >= 1 ? "oklch(var(--primary-300) / 0.5)" : "url(#lineCold)"} strokeWidth={stage >= 2 ? 1.8 : 1} />
          <path d={PATH_B} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 2 ? "url(#lineCold)" : stage >= 1 ? "oklch(var(--primary-300) / 0.28)" : "url(#lineCold)"} strokeWidth="1" />
          <path d={PATH_C} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 2 ? "url(#lineCold)" : stage >= 1 ? "oklch(var(--primary-300) / 0.28)" : "url(#lineCold)"} strokeWidth="1" />
          <path d={PATH_EXEC} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 3 ? "url(#lineHot)" : "url(#lineCold)"} strokeWidth={stage >= 3 ? 1.6 : 1} />
          <path d={PATH_RESULT} fill="none" vectorEffect="non-scaling-stroke" stroke={stage >= 4 ? "url(#lineHot)" : "url(#lineCold)"} strokeWidth="1.2" />

          {(stage === 0 || stage === 1) && !reduced ? (
            <>
              <Signal path={PATH_TASK} dur={3} delay={0} color="oklch(var(--accent-400))" />
              <Signal path={PATH_TASK} dur={3} delay={1.1} color="oklch(var(--primary-300))" />
              <Signal path={PATH_TASK} dur={3} delay={2.1} color="oklch(var(--accent-300))" />
            </>
          ) : null}
          {stage === 2 && !reduced ? <Signal path={PATH_A} dur={2.4} delay={0} color="oklch(var(--accent-300))" /> : null}
          {stage === 3 && !reduced ? <Signal path={PATH_EXEC} dur={2.2} delay={0} color="oklch(var(--accent-300))" /> : null}
          {stage === 4 && !reduced ? <Signal path={PATH_RESULT} dur={2.6} delay={0} color="oklch(var(--accent-400))" /> : null}
        </svg>

        {/* 任务节点 */}
        <div
          className="absolute w-[27%] rounded-xl border px-3 py-2.5 transition-all duration-500"
          style={{
            left: "3%",
            top: "18%",
            borderColor: stage >= 1 ? "oklch(var(--accent-500) / 0.5)" : "oklch(var(--background-50) / 0.15)",
            background: "oklch(var(--background-900) / 0.86)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 text-background-50/45">
            <i className="ri-quill-pen-line text-[10px]" />
            <span className="text-[9px]">任务</span>
          </div>
          <p className="text-[11px] font-medium leading-snug text-background-50/90">{scene.task}</p>
          <p className="mt-0.5 text-[9.5px] text-background-50/45">{scene.detail}</p>
          <div className="mt-1.5 flex items-center gap-1 rounded-sm bg-background-50/5 px-1.5 py-0.5">
            <i className="ri-wallet-3-line text-[9px] text-accent-400" />
            <span className="text-[9px] text-background-50/55">单次上限 {scene.cap}</span>
          </div>
        </div>

        {/* 中心调度节点 */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full border border-primary-400/40 bg-background-900/90 shadow-[0_0_60px_-14px_oklch(var(--primary-500))]">
            <span
              className={cx(
                "pointer-events-none absolute inset-0 rounded-full border border-accent-400/40 transition-opacity duration-700",
                stage >= 1 ? "animate-soft-pulse opacity-100" : "opacity-0",
              )}
            />
            <span
              className={cx(
                "pointer-events-none absolute -inset-3 rounded-full border border-primary-400/20 transition-opacity duration-700",
                stage >= 2 ? "opacity-100" : "opacity-0",
              )}
            />
            <i className="ri-route-line mb-1 text-base text-primary-300" />
            <p className="font-heading text-[11.5px] font-semibold text-background-50">Hwao Router</p>
            <p className="mt-0.5 text-center text-[8.5px] leading-tight text-background-50/45">场景选型 · 预算校验</p>
            <span className="mt-1 rounded-full bg-background-50/8 px-1.5 py-0.5 text-[8px] text-accent-400">
              {stage >= 2 ? `已选 ${selected.name}` : stage >= 1 ? "比较候选中" : "待校验"}
            </span>
          </div>
        </div>

        {/* 候选模型 */}
        <div className="absolute right-[2%] top-[6%] w-[29%] space-y-2.5">
          {candidates.map((item) => {
            const isSelected = item.selected && stage >= 2;
            const dimmed = stage >= 2 && !item.selected;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setInspect(item.id)}
                onFocus={() => setInspect(item.id)}
                onClick={() => setInspect(item.id)}
                className={cx(
                  "w-full cursor-pointer rounded-xl border px-2.5 py-2 text-left transition-all duration-500 hover:-translate-y-0.5",
                  dimmed ? "opacity-45" : "opacity-100",
                )}
                style={{
                  borderColor: isSelected ? "oklch(var(--accent-500) / 0.6)" : "oklch(var(--background-50) / 0.13)",
                  background: isSelected ? "oklch(var(--primary-900) / 0.75)" : "oklch(var(--background-900) / 0.7)",
                  boxShadow: isSelected ? "0 0 28px -10px oklch(var(--accent-500))" : "none",
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10.5px] font-medium text-background-50/90">{item.name}</p>
                  {isSelected ? <span className="text-[8.5px] text-accent-400">已选</span> : null}
                </div>
                <p className="mt-0.5 text-[8.5px] text-background-50/40">{item.tag}</p>
                {isSelected ? (
                  <p className="mt-1 text-[8.5px] text-accent-300">预计 {scene.cost} / 上限 {scene.cap}</p>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 执行带 */}
        <div
          className="absolute rounded-xl border px-3 py-2 transition-all duration-500"
          style={{
            left: "3%",
            width: "67%",
            top: "65%",
            borderColor: stage >= 3 ? "oklch(var(--accent-500) / 0.4)" : "oklch(var(--background-50) / 0.1)",
            background: "oklch(var(--background-900) / 0.72)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[9.5px] text-background-50/70">
              <i className="ri-server-line text-accent-500" />
              New API 网关 · 通道执行与计量
            </p>
            <span className="text-[8.5px] text-background-50/35">{stage >= 3 ? "执行中" : "待执行"}</span>
          </div>
          {retryMode && stage >= 3 ? (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <div className="rounded-sm border border-warning/40 bg-warning-soft/20 px-1.5 py-1">
                <p className="text-[8.5px] text-warning">渠道 1 · 明确限流</p>
                <p className="text-[8px] text-background-50/35">未产生客户费用</p>
              </div>
              <div className="rounded-sm border border-accent-500/35 bg-accent-500/10 px-1.5 py-1">
                <p className="text-[8.5px] text-accent-300">渠道 2 · 成功</p>
                <p className="text-[8px] text-background-50/35">模型仍为 A，单一净费用</p>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 space-y-1">
              {scene.preview.map((line, i) => (
                <p
                  key={line}
                  className={cx(
                    "truncate rounded-sm bg-background-50/5 px-1.5 py-0.5 font-mono-ui text-[8.5px] transition-opacity duration-500",
                    stage >= 3 && (reduced || elapsed >= 9000 + i * 600) ? "text-background-50/60 opacity-100" : "text-background-50/20 opacity-60",
                  )}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 结果摘要 */}
        <div
          className={cx(
            "absolute right-[2%] w-[27%] rounded-xl border px-3 py-2.5 transition-all duration-700",
            stage >= 4 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0",
          )}
          style={{
            top: "63%",
            borderColor: "oklch(var(--accent-500) / 0.45)",
            background: "oklch(var(--primary-950) / 0.8)",
          }}
        >
          <p className="flex items-center gap-1 text-[10.5px] font-medium text-background-50">
            <i className="ri-checkbox-circle-fill text-[11px] text-accent-400" />
            {scene.result}
          </p>
          <p className="mt-1 text-[9px] text-background-50/55">已结算 {scene.cost}</p>
          <p className="mt-0.5 text-[8.5px] text-background-50/35">可查看任务与消费记录</p>
        </div>

        {/* 状态说明 */}
        <div className="absolute left-[3%] top-[3%] flex items-center gap-2">
          <span className={cx("h-1.5 w-1.5 rounded-full", stage >= 4 ? "bg-accent-500" : "animate-pulse bg-primary-400")} />
          <p className="text-[9.5px] text-background-50/55">
            {stageText[stage].title}
            <span className="ml-1.5 text-background-50/30">{stageText[stage].desc}</span>
          </p>
        </div>

        {inspect ? (
          <div className="absolute bottom-1 left-[3%] z-20 max-w-[300px] rounded-lg border border-background-50/15 bg-background-950/95 px-2.5 py-2">
            <p className="text-[9.5px] text-background-50/80">
              {candidates.find((c) => c.id === inspect)?.name}
              <span className="ml-1.5 text-background-50/40">{candidates.find((c) => c.id === inspect)?.tag}</span>
            </p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-background-50/45">{candidates.find((c) => c.id === inspect)?.note}</p>
          </div>
        ) : null}
      </div>

      {/* 手机纵向流程 */}
      <div className="space-y-1.5 lg:hidden">
        {[
          { icon: "ri-quill-pen-line", title: scene.task, desc: scene.detail, state: "已提交" },
          { icon: "ri-route-line", title: "场景选型 · 预算校验", desc: `能力匹配 · 场景评测达标 · 上限 ${scene.cap}`, state: stage >= 1 ? "通过" : "待校验" },
          { icon: "ri-stack-line", title: selected.name, desc: `预计 ${scene.cost} · 同模型通道重试`, state: stage >= 2 ? "已选" : "比较中" },
          { icon: "ri-server-line", title: "New API 网关", desc: retryMode ? "渠道 1 限流 → 渠道 2 成功" : "通道执行与计量", state: stage >= 3 ? "执行中" : "待执行" },
          { icon: "ri-checkbox-circle-line", title: scene.result, desc: `已结算 ${scene.cost}`, state: stage >= 4 ? "完成" : "等待" },
        ].map((item, i) => (
          <div
            key={item.title}
            className={cx(
              "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
              i === 2 && stage >= 2 ? "border-accent-500/40 bg-primary-950/50" : "border-background-50/10 bg-background-900/60",
            )}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background-50/8 text-background-50/60">
              <i className={cx(item.icon, "text-[11px]")} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] text-background-50/85">{item.title}</p>
              <p className="truncate text-[8.5px] text-background-50/40">{item.desc}</p>
            </div>
            <span className="shrink-0 text-[8.5px] text-accent-400">{item.state}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-background-50/10 pt-2">
        <button
          type="button"
          onClick={() => {
            setRetryMode((v) => !v);
            setElapsed(9000);
            setPlaying(true);
          }}
          className="inline-flex cursor-pointer items-center gap-1 text-[9.5px] text-background-50/45 transition-colors hover:text-background-50/80"
        >
          <i className="ri-loop-right-line" />
          {retryMode ? "返回主流程" : "查看通道重试"}
        </button>
        <p className="text-[9px] text-background-50/30">产品流程示意</p>
      </div>

      <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-background-50/10">
        <div className="h-full rounded-full bg-linear-to-r from-primary-400 to-accent-400 transition-[width] duration-100" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}