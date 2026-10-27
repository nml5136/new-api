import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-background-50 hover:bg-primary-600 disabled:bg-primary-300 shadow-[0_10px_24px_-16px_oklch(var(--primary-600))]",
  secondary:
    "bg-secondary-100 text-foreground-900 hover:bg-secondary-200 disabled:text-foreground-400",
  ghost: "text-foreground-700 hover:bg-background-100",
  outline:
    "border border-background-300 text-foreground-800 hover:border-primary-300 hover:text-primary-600 bg-background-50",
  danger: "bg-danger-soft text-danger border border-danger hover:bg-danger-soft/70",
  light: "bg-background-50/10 text-background-50 border border-background-50/20 hover:bg-background-50/20",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-sm rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "bg-secondary-100 text-foreground-700",
  primary: "bg-primary-50 text-primary-700",
  accent: "bg-accent-50 text-accent-800",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-background-200 bg-background-50 shadow-soft", className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-foreground-700">
        {label}
        {hint ? <span className="font-normal text-foreground-500">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11px] text-danger">{error}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full box-border rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900 placeholder:text-foreground-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/15";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClass, "h-10", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controlClass, "h-10 cursor-pointer appearance-none bg-[right_0.75rem_center] pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlClass, "min-h-[120px] resize-y leading-relaxed", className)} {...rest} />;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" aria-label="关闭" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-background-50 p-6 shadow-lift animate-rise sm:rounded-2xl scroll-thin",
          width,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground-950">{title}</h3>
            {description ? <p className="mt-1 text-xs leading-relaxed text-foreground-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-background-100 hover:text-foreground-900"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "sm:max-w-[600px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background-950/40 backdrop-blur-sm">
      <button type="button" aria-label="关闭抽屉" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside
        aria-modal="true"
        role="dialog"
        className={cx(
          "relative z-10 flex h-full w-full flex-col bg-background-50 shadow-lift animate-rise",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-foreground-950">{title}</h3>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-foreground-600">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground-500 transition-colors hover:bg-background-100"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer ? <footer className="border-t border-background-200 px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function Copyable({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 bg-background-50 px-3 text-[11px] font-medium text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
    >
      <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
      {copied ? "已复制" : label}
    </button>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "accent" | "warning" | "danger" | "success";
  className?: string;
}) {
  const fill: Record<string, string> = {
    primary: "bg-primary-500",
    accent: "bg-accent-500",
    warning: "bg-warning",
    danger: "bg-danger",
    success: "bg-success",
  };
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-background-100", className)}>
      <div className={cx("h-full rounded-full transition-all duration-500", fill[tone])} style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("inline-flex flex-wrap items-center gap-1 rounded-full bg-background-100 p-1", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cx(
            "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            value === item.id
              ? "bg-background-50 text-foreground-950 shadow-sm"
              : "text-foreground-600 hover:text-foreground-900",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span className={cx("tnum text-[10px]", value === item.id ? "text-primary-600" : "text-foreground-400")}>
              {item.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold text-foreground-950 md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon = "ri-inbox-line",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-background-300 bg-background-50 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-background-100 text-foreground-500">
        <i className={cx(icon, "text-xl")} />
      </span>
      <p className="text-sm font-medium text-foreground-900">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-foreground-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "primary",
  icon = "ri-information-line",
  children,
  className,
}: {
  tone?: "primary" | "accent" | "warning" | "danger" | "success" | "neutral";
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  const map: Record<string, string> = {
    primary: "border-primary-200 bg-primary-50 text-primary-800",
    accent: "border-accent-200 bg-accent-50 text-accent-900",
    warning: "border-warning bg-warning-soft text-warning",
    danger: "border-danger bg-danger-soft text-danger",
    success: "border-success bg-success-soft text-success",
    neutral: "border-background-200 bg-background-100 text-foreground-700",
  };
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed", map[tone], className)}>
      <i className={cx(icon, "mt-0.5 text-sm")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DemoTag({ label = "演示环境" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning bg-warning-soft px-2.5 py-1 text-[11px] font-medium text-warning whitespace-nowrap">
      <i className="ri-flask-line" />
      {label}
    </span>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-background-100 py-2.5 last:border-0">
      <span className="text-xs text-foreground-600">{label}</span>
      <span className="text-right text-xs font-medium text-foreground-900">{children}</span>
    </div>
  );
}