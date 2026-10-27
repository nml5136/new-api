import { useEffect, useRef, useState } from "react";
import { scenarioOptions, useDemo } from "@/lib/demo-store";
import { cx } from "@/lib/format";

export default function DemoController({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { scenario, setScenario, resetDemo } = useDemo();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = scenarioOptions.find((s) => s.id === scenario) ?? scenarioOptions[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors whitespace-nowrap",
          tone === "light"
            ? "border-warning bg-warning-soft text-warning"
            : "border-background-50/20 bg-background-50/5 text-background-50/75 hover:bg-background-50/10",
        )}
      >
        <i className="ri-flask-line text-sm" />
        <span className="hidden sm:inline">演示环境</span>
        <span className={cx("hidden md:inline", tone === "light" ? "text-warning" : "text-background-50/40")}>
          · {current.label}
        </span>
        <i className="ri-arrow-down-s-line text-sm" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[290px] overflow-hidden rounded-xl border border-background-200 bg-background-50 shadow-lift">
          <div className="border-b border-background-100 px-3.5 py-2.5">
            <p className="text-xs font-medium text-foreground-900">演示控制器</p>
            <p className="mt-0.5 text-[11px] text-foreground-500">切换场景状态，观察任务、费用与记录的变化</p>
          </div>
          <div className="max-h-[300px] overflow-y-auto py-1 scroll-thin">
            {scenarioOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setScenario(option.id);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full cursor-pointer items-start gap-2 px-3.5 py-2 text-left transition-colors hover:bg-background-100",
                  scenario === option.id ? "bg-primary-50/70" : "",
                )}
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {scenario === option.id ? (
                    <i className="ri-checkbox-circle-fill text-xs text-primary-600" />
                  ) : (
                    <i className="ri-circle-line text-[10px] text-foreground-400" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground-900">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-500">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-background-100 p-2">
            <button
              type="button"
              onClick={() => {
                resetDemo();
                setOpen(false);
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] text-foreground-600 transition-colors hover:bg-background-100"
            >
              <i className="ri-restart-line" />
              重置演示数据
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}