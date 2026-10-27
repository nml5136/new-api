import { Link } from "react-router-dom";
import { cx } from "@/lib/format";

export default function Logo({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span
        className={cx(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border",
          tone === "light"
            ? "border-background-50/25 bg-background-50/10 text-background-50"
            : "border-primary-200 bg-primary-50 text-primary-600",
        )}
      >
        <span className="absolute inset-0 rounded-[10px] bg-primary-500/25 blur-[6px]" />
        <i className="ri-route-line relative text-[15px]" />
      </span>
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span
            className={cx(
              "font-heading text-[15px] font-semibold tracking-tight",
              tone === "light" ? "text-background-50" : "text-foreground-950",
            )}
          >
            Hwao Router
          </span>
          <span className={cx("mt-1 text-[10px]", tone === "light" ? "text-background-50/55" : "text-foreground-500")}>
            场景驱动的 AI 工作入口
          </span>
        </span>
      )}
    </Link>
  );
}