import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Drawer, EmptyState, Modal, PageHeader, Select } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { cx, money } from "@/lib/format";
import type { ModelInfo } from "@/lib/types";

const statusMeta: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  available: { label: "可用", tone: "success" },
  restricted: { label: "权限未覆盖", tone: "warning" },
  pending: { label: "待验证", tone: "neutral" },
  unavailable: { label: "暂不可用", tone: "danger" },
};

export default function ModelsPage() {
  const { models, scenes } = useDemo();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [scene, setScene] = useState("all");
  const [ctx, setCtx] = useState("all");
  const [structured, setStructured] = useState("all");
  const [price, setPrice] = useState("all");
  const [compare, setCompare] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const all: ModelInfo[] = models;
  const detail = all.find((m) => m.id === detailId);

  const list = useMemo(
    () =>
      all.filter((m) => {
        if (query && !m.name.includes(query) && !m.tags.some((t) => t.includes(query))) return false;
        if (scene !== "all" && !m.scenes.includes(scene as never)) return false;
        if (ctx === "small" && !(m.context === "32K" || m.context === "64K")) return false;
        if (ctx === "large" && !(m.context === "128K" || m.context === "256K" || m.context === "512K")) return false;
        if (structured === "yes" && !m.structured) return false;
        if (price === "low" && m.priceIn >= 1.5) return false;
        if (price === "mid" && (m.priceIn < 1.5 || m.priceIn > 3)) return false;
        if (price === "high" && m.priceIn <= 3) return false;
        return true;
      }),
    [all, query, scene, ctx, structured, price],
  );

  const toggleCompare = (id: string) => {
    setCompare((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : prev.length >= 3 ? prev : [...prev, id]));
  };

  const compared = all.filter((m) => compare.includes(m.id));

  return (
    <div className={cx("pb-4", compare.length > 0 ? "pb-24" : "")}>
      <PageHeader
        eyebrow="模型目录"
        title="先看能做什么，再看多少钱"
        description="客户只看到业务能力与零售价格。采购价、上游账号和内部渠道编号不在客户侧展示。"
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-background-200 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索模型名称或能力标签"
              className="h-9 w-full rounded-lg border border-background-300 bg-background-50 pl-8 pr-3 text-xs text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select className="h-9 text-[11px]" value={scene} onChange={(e) => setScene(e.target.value)} aria-label="场景筛选">
              <option value="all">全部场景</option>
              {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select className="h-9 text-[11px]" value={ctx} onChange={(e) => setCtx(e.target.value)} aria-label="上下文筛选">
              <option value="all">任意上下文</option>
              <option value="small">≤ 64K</option>
              <option value="large">≥ 128K</option>
            </Select>
            <Select className="h-9 text-[11px]" value={structured} onChange={(e) => setStructured(e.target.value)} aria-label="结构化输出筛选">
              <option value="all">结构化任意</option>
              <option value="yes">支持结构化输出</option>
            </Select>
            <Select className="h-9 text-[11px]" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="价格筛选">
              <option value="all">任意价格</option>
              <option value="low">低于 ¥1.5</option>
              <option value="mid">¥1.5 – ¥3</option>
              <option value="high">高于 ¥3</option>
            </Select>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="ri-stack-line"
              title="没有符合条件的模型"
              description="当前筛选条件过窄。清空部分条件后再试，或直接进入场景中心由平台推荐。"
              action={<Button size="sm" variant="outline" onClick={() => { setQuery(""); setScene("all"); setCtx("all"); setStructured("all"); setPrice("all"); }}>重置筛选</Button>}
            />
          </div>
        ) : (
          <div className="divide-y divide-background-100">
            {list.map((model) => {
              const meta = statusMeta[model.status] ?? statusMeta.available;
              return (
                <div key={model.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-background-100/40 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={compare.includes(model.id)}
                      onChange={() => toggleCompare(model.id)}
                      disabled={model.status === "pending"}
                      aria-label={`对比 ${model.name}`}
                      className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      style={{ accentColor: "oklch(var(--primary-500))" }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground-950">{model.name}</p>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="text-[9.5px] text-foreground-400">{model.version}</span>
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-foreground-600">{model.note}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {model.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-background-100 px-2 py-0.5 text-[9.5px] text-foreground-600">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-6 text-[10px] text-foreground-500 lg:pl-0">
                    <span className="flex items-center gap-1"><i className="ri-file-copy-2-line" />{model.context}</span>
                    <span className="flex items-center gap-1"><i className="ri-time-line" />{model.latency}</span>
                    <span className="tnum">输入 {money(model.priceIn)} / 输出 {money(model.priceOut)}</span>
                  </div>

                  <div className="flex items-center gap-2 pl-6 lg:pl-0">
                    <Button size="sm" variant="outline" onClick={() => setDetailId(model.id)}>查看详情</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="mt-3 text-[10px] leading-relaxed text-foreground-400">
        未验证的模型不能通过"立即使用"进入收费任务。授权未覆盖的模型会显示权限说明，而非仅以颜色区分。
      </p>

      {compare.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-background-200 bg-background-50/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex w-full max-w-shell flex-wrap items-center gap-3">
            <span className="text-[11px] text-foreground-600">已选 {compare.length} / 3</span>
            <div className="flex flex-wrap gap-1.5">
              {compared.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] text-primary-700">
                  {m.name}
                  <button type="button" onClick={() => toggleCompare(m.id)} aria-label="移除" className="cursor-pointer text-primary-500 hover:text-primary-700">
                    <i className="ri-close-line" />
                  </button>
                </span>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setCompare([])} className="cursor-pointer text-[10.5px] text-foreground-500 hover:text-foreground-800">清空</button>
              <Button size="sm" onClick={() => setCompareOpen(true)}>对比所选模型</Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="模型对比"
        description="仅比较已验证的能力与零售价格，不展示无法验证的匹配百分比。"
        width="max-w-2xl"
      >
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[520px] text-left text-[11px]">
            <thead>
              <tr className="border-b border-background-200 text-[10px] text-foreground-500">
                <th className="py-2 pr-3 font-medium">能力</th>
                {compared.map((m) => <th key={m.id} className="px-3 py-2 font-medium text-foreground-900">{m.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-background-100 text-foreground-700">
              <tr><td className="py-2 pr-3 text-foreground-500">适用场景</td>{compared.map((m) => <td key={m.id} className="px-3 py-2">{m.scenes.map((s) => scenes.find((x) => x.id === s)?.name).join("、")}</td>)}</tr>
              <tr><td className="py-2 pr-3 text-foreground-500">上下文</td>{compared.map((m) => <td key={m.id} className="px-3 py-2">{m.context}</td>)}</tr>
              <tr><td className="py-2 pr-3 text-foreground-500">结构化输出</td>{compared.map((m) => <td key={m.id} className="px-3 py-2">{m.structured ? "支持" : "不保证"}</td>)}</tr>
              <tr><td className="py-2 pr-3 text-foreground-500">输入价格</td>{compared.map((m) => <td key={m.id} className="tnum px-3 py-2">{money(m.priceIn)}</td>)}</tr>
              <tr><td className="py-2 pr-3 text-foreground-500">输出价格</td>{compared.map((m) => <td key={m.id} className="tnum px-3 py-2">{money(m.priceOut)}</td>)}</tr>
              <tr><td className="py-2 pr-3 text-foreground-500">状态</td>{compared.map((m) => <td key={m.id} className="px-3 py-2">{statusMeta[m.status]?.label ?? "—"}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] leading-relaxed text-foreground-400">
          对比仅包含客户可见能力。质量分来自平台离线评测，仅供参考。
        </p>
      </Modal>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name ?? ""}
        subtitle={detail ? `${detail.version} · ${detail.channel}` : ""}
        footer={
          detail ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                disabled={detail.status !== "available"}
                onClick={() => navigate(`/app/workspace?scene=${detail.scenes[0]}`)}
              >
                用此模型创建任务
              </Button>
              <Button onClick={() => { setDetailId(null); navigate("/app/scenes"); }}>进入场景中心</Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusMeta[detail.status]?.tone ?? "neutral"}>{statusMeta[detail.status]?.label ?? "—"}</Badge>
              {detail.tags.map((tag) => <span key={tag} className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] text-foreground-600">{tag}</span>)}
            </div>
            <p className="text-[11px] leading-relaxed text-foreground-600">{detail.note}</p>

            <div className="rounded-xl border border-background-200 p-3.5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-400">已验证能力</p>
              <div className="space-y-1.5 text-[10.5px] text-foreground-700">
                <p className="flex items-center gap-1.5"><i className="ri-check-line text-success" />上下文 {detail.context}</p>
                <p className="flex items-center gap-1.5"><i className={cx("ri-check-line", detail.structured ? "text-success" : "text-foreground-400")} />{detail.structured ? "结构化输出稳定" : "结构化输出需复核"}</p>
                <p className="flex items-center gap-1.5"><i className="ri-check-line text-success" />适用场景：{detail.scenes.map((s) => scenes.find((x) => x.id === s)?.name).join("、")}</p>
              </div>
            </div>

            <div className="rounded-xl border border-background-200 p-3.5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-400">价格项（客户零售价）</p>
              <div className="space-y-1.5 text-[10.5px] text-foreground-700">
                <div className="flex justify-between"><span>输入</span><span className="tnum">{money(detail.priceIn)} / 百万 Token</span></div>
                <div className="flex justify-between"><span>输出</span><span className="tnum">{money(detail.priceOut)} / 百万 Token</span></div>
                <div className="flex justify-between text-foreground-500"><span>更新时间</span><span>2026-10-01</span></div>
              </div>
            </div>

            {detail.status !== "available" ? (
              <div className="rounded-xl border border-warning bg-warning-soft/60 p-3 text-[10.5px] leading-relaxed text-foreground-700">
                {detail.status === "pending" ? "该模型尚未完成评测，不能进入收费任务。" : detail.status === "restricted" ? "当前企业授权未覆盖该模型，需运营开通后使用。" : "该模型当前暂不可用。"}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}