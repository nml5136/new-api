// 运营端通用表格与表单组件：搜索/筛选/分页表格、确认弹窗、行内操作按钮、表单校验辅助。
// 与 base/ui 设计系统保持一致（圆角、字号、色板），供资源、价格、场景、客户等页面复用。
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, Input, Modal } from "@/components/base/ui";
import { cx } from "@/lib/format";

// useTable 前端分页 + 关键字搜索；filter 为额外筛选条件
export function useTable<T>(rows: T[], text: (r: T) => string, pageSize = 10, filter?: (r: T) => boolean) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => (!filter || filter(r)) && (!kw || text(r).toLowerCase().includes(kw)));
  }, [rows, q, filter, text]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { q, setQ: (v: string) => { setQ(v); setPage(1); }, page, setPage, pages, paged, total: filtered.length };
}

export interface Column<T> {
  key: string;
  title: string;
  width?: string; // CSS grid 列宽，如 "1.2fr"
  align?: "right";
  render: (r: T) => ReactNode;
}

// Toolbar 表格上方：搜索框 + 筛选器 + 右侧操作
export function Toolbar({ q, setQ, placeholder = "搜索…", filters, actions }: { q: string; setQ: (v: string) => void; placeholder?: string; filters?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-background-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full md:w-64">
          <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="!h-9 pl-8 text-xs" />
        </div>
        {filters}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// FilterSelect 紧凑筛选下拉
export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: Array<[string, string]>; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 cursor-pointer rounded-xl border border-background-300 bg-background-50 px-3 pr-7 text-xs text-foreground-800 focus:border-primary-400 focus:outline-none"
    >
      <option value="">{label}：全部</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

// DataTable 栅格表格（桌面端多列，移动端堆叠）
export function DataTable<T>({ columns, rows, rowKey, empty = "暂无数据", onRowClick }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number; empty?: string; onRowClick?: (r: T) => void }) {
  const tpl = columns.map((c) => c.width || "1fr").join(" ");
  if (!rows.length) return <div className="p-4"><EmptyState title={empty} description="调整搜索或筛选条件，或新建一条记录。" /></div>;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10.5px] font-medium text-foreground-500" style={{ gridTemplateColumns: tpl }}>
          {columns.map((c) => <span key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.title}</span>)}
        </div>
        <div className="divide-y divide-background-100">
          {rows.map((r) => (
            <div
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx("grid items-center gap-3 px-4 py-2.5 text-[11.5px] text-foreground-800", onRowClick ? "cursor-pointer hover:bg-background-100/50" : "")}
              style={{ gridTemplateColumns: tpl }}
            >
              {columns.map((c) => <div key={c.key} className={cx("min-w-0", c.align === "right" ? "flex justify-end gap-1" : "")}>{c.render(r)}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Pager 分页条
export function Pager({ page, pages, total, setPage }: { page: number; pages: number; total: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between border-t border-background-200 px-4 py-2.5 text-[11px] text-foreground-500">
      <span>共 {total} 条</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="上一页"><i className="ri-arrow-left-s-line" /></button>
        <span className="tnum px-2">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg hover:bg-background-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="下一页"><i className="ri-arrow-right-s-line" /></button>
      </div>
    </div>
  );
}

// RowBtn 行内小按钮；danger 为危险操作
export function RowBtn({ children, onClick, danger, disabled, title }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cx(
        "inline-flex h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border px-2 text-[10.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "border-danger/40 text-danger hover:bg-danger-soft" : "border-background-300 text-foreground-700 hover:border-primary-300 hover:text-primary-700",
      )}
    >
      {children}
    </button>
  );
}

// ConfirmModal 二次确认（删除、停用等不可逆或影响线上流量的操作）
export function ConfirmModal({ open, title, body, confirmText = "确认", danger, onClose, onConfirm }: { open: boolean; title: string; body: ReactNode; confirmText?: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button variant={danger ? "danger" : "primary"} onClick={() => { onClose(); onConfirm(); }}>{confirmText}</Button></>}
    >
      <div className="text-xs leading-relaxed text-foreground-700">{body}</div>
    </Modal>
  );
}

// useConfirm 便捷管理确认弹窗状态
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: ReactNode; danger?: boolean; confirmText?: string; run: () => void } | null>(null);
  const node = (
    <ConfirmModal
      open={Boolean(state)}
      title={state?.title || ""}
      body={state?.body}
      danger={state?.danger}
      confirmText={state?.confirmText}
      onClose={() => setState(null)}
      onConfirm={() => state?.run()}
    />
  );
  return { ask: setState, node };
}

// SectionTitle 抽屉内分组标题
export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="mb-2 mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-foreground-400">{children}</p>;
}

// Toggle 开关
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-background-200 px-3 py-2.5 text-xs text-foreground-800">
      <span>{label}</span>
      <span className={cx("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-primary-500" : "bg-background-300")}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-background-50 shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </label>
  );
}

// 时间换算：Unix 秒 ⇄ datetime-local 输入值
export const tsToLocal = (t?: number) => {
  if (!t) return "";
  const d = new Date(t * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const localToTs = (s: string) => (s ? Math.floor(new Date(s).getTime() / 1000) : 0);

// 金额换算：分 ⇄ 元（字符串输入）
export const f2y = (f?: number) => ((f || 0) / 100).toString();
export const y2f = (y: string) => Math.round((Number(y) || 0) * 100);
