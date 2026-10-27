import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "@/components/feature/PublicLayout";
import { Badge, Button, Notice } from "@/components/base/ui";
import { models, scenes } from "@/mocks/demo";
import { cx, money } from "@/lib/format";

const filters = [
  { id: "all", label: "全部场景" },
  { id: "commerce-copy", label: "电商文案" },
  { id: "office-summary", label: "办公摘要" },
  { id: "info-extract", label: "结构化提取" },
];

export default function PricingPage() {
  const [filter, setFilter] = useState("all");
  const [inK, setInK] = useState(12);
  const [outK, setOutK] = useState(2);

  const rows = useMemo(
    () => models.filter((m) => filter === "all" || m.scenes.includes(filter as never)),
    [filter],
  );

  const estimates = useMemo(
    () =>
      models
        .filter((m) => m.status === "available")
        .map((m) => ({ ...m, total: (inK / 1000) * m.priceIn + (outK / 1000) * m.priceOut })),
    [inK, outK],
  );

  const cheapest = estimates.reduce((a, b) => (a.total < b.total ? a : b), estimates[0]);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-background-950 pb-16 pt-[112px] text-background-50 md:pb-20 md:pt-[132px]">
        <div className="pointer-events-none absolute inset-0 hero-glow opacity-70" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 md:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-background-50/15 bg-background-50/5 px-3 py-1.5 text-[11px] text-background-50/70">
                计费说明
              </span>
              <h1 className="mt-4 font-heading text-3xl font-semibold leading-tight sm:text-[42px]">
                按实际调用计费，
                <br />
                一个企业统一钱包
              </h1>
              <p className="mt-4 max-w-[480px] text-sm leading-relaxed text-background-50/60">
                输入与输出分别计价，费用以人民币净额展示。项目预算是消费限制，资金来自企业统一钱包——不存在第二个钱包，也不需要单独"购买 Token"。
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-background-50/45">
                <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500" />按调用结算，不设起步套餐</span>
                <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500" />失败请求释放预扣额度</span>
                <span className="flex items-center gap-1.5"><i className="ri-check-line text-accent-500" />充值与消费同一份余额</span>
              </div>
            </div>

            <div className="rounded-2xl border border-background-50/12 bg-background-900/60 p-5 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-medium text-background-50/80">用量估算器</p>
                <span className="rounded-full bg-background-50/10 px-2 py-0.5 text-[10px] text-background-50/50">演示估算</span>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-background-50/55">
                    <span>输入用量</span>
                    <span className="tnum text-background-50/85">{inK.toLocaleString()} 千 Token</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={200}
                    step={1}
                    value={inK}
                    onChange={(e) => setInK(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-background-50/15"
                    style={{ accentColor: "oklch(var(--accent-500))" }}
                    aria-label="输入用量"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-background-50/55">
                    <span>输出用量</span>
                    <span className="tnum text-background-50/85">{outK.toLocaleString()} 千 Token</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    step={1}
                    value={outK}
                    onChange={(e) => setOutK(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-background-50/15"
                    style={{ accentColor: "oklch(var(--accent-500))" }}
                    aria-label="输出用量"
                  />
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t border-background-50/10 pt-4">
                {estimates.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-background-50/60">{m.name}</span>
                    <span className={cx("tnum", m.id === cheapest.id ? "text-accent-400" : "text-background-50/80")}>
                      {money(m.total, 3)}
                      {m.id === cheapest.id ? " · 最低" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-background-50/35">
                估算仅含输入与输出费用，不含可能适用的缓存项；最终以实际用量与结算记录为准。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-12 md:px-8 md:py-16">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold text-foreground-950 md:text-2xl">模型价格表</h2>
            <p className="mt-1.5 text-xs text-foreground-600">价格为演示数值，实际费用按实际用量结算。</p>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 self-start rounded-full bg-background-100 p-1">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cx(
                  "cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-600 hover:text-foreground-900",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-background-200 bg-background-50">
          <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.9fr] gap-4 border-b border-background-200 bg-background-100/60 px-5 py-3 text-[11px] font-medium text-foreground-500 md:grid">
            <span>模型</span>
            <span>适用场景</span>
            <span>输入 / 百万 Token</span>
            <span>输出 / 百万 Token</span>
            <span>状态</span>
          </div>
          <div className="divide-y divide-background-100">
            {rows.map((m) => (
              <div key={m.id} className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[1.4fr_1.2fr_1fr_0.9fr_0.9fr] md:items-center md:gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground-950">{m.name}</p>
                  <p className="mt-0.5 text-[11px] text-foreground-500">{m.context} 上下文 · {m.version}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.scenes.map((s) => (
                    <span key={s} className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] text-foreground-600">
                      {scenes.find((sc) => sc.id === s)?.name ?? s}
                    </span>
                  ))}
                </div>
                <span className="tnum text-xs text-foreground-800 md:text-[13px]">{money(m.priceIn)}</span>
                <span className="tnum text-xs text-foreground-800 md:text-[13px]">{money(m.priceOut)}</span>
                <div>
                  {m.status === "available" ? (
                    <Badge tone="success">可用</Badge>
                  ) : m.status === "restricted" ? (
                    <Badge tone="warning">权限未覆盖</Badge>
                  ) : (
                    <Badge tone="neutral">待验证</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-background-200 bg-background-50 p-5">
            <h3 className="text-sm font-semibold text-foreground-950">预估与最终用量</h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground-600">
              任务开始前展示预估费用与硬上限，最终按实际输入输出结算。估算器数值为演示，不构成报价。
            </p>
          </div>
          <div className="rounded-xl border border-background-200 bg-background-50 p-5">
            <h3 className="text-sm font-semibold text-foreground-950">中断与失败</h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground-600">
              已发生用量的中断按实际结算；执行失败释放预扣，不产生净费用；结果未知时费用进入待核对，不显示为零。
            </p>
          </div>
          <div className="rounded-xl border border-background-200 bg-background-50 p-5">
            <h3 className="text-sm font-semibold text-foreground-950">缓存与调整</h3>
            <p className="mt-2 text-xs leading-relaxed text-foreground-600">
              如上游存在缓存计价，会在费用分项中单独列出。冲正与补偿记录关联原请求，不删除原始消费记录。
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-background-200 bg-background-100/60 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground-950">包月订阅与预留额度</h3>
              <Badge tone="neutral">规划中</Badge>
            </div>
            <p className="mt-1.5 max-w-[560px] text-xs leading-relaxed text-foreground-600">
              后续将提供按月订阅与预留额度。一期仍按实际调用计费。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary-500 px-5 text-xs font-medium text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
            >
              开通使用
            </Link>
            <Link
              to="/docs"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-background-300 bg-background-50 px-5 text-xs text-foreground-800 transition-colors hover:border-primary-300 whitespace-nowrap"
            >
              查看接入文档
            </Link>
          </div>
        </div>

        <Notice className="mt-6" tone="warning" icon="ri-flask-line">
          本页所有价格、用量与费用均为演示数据。原型不与任何真实支付渠道或模型服务交互。
        </Notice>
      </section>
    </PublicLayout>
  );
}