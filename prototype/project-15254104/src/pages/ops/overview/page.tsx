import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, PageHeader } from "@/components/base/ui";
import { opsMetrics, opsQueue } from "@/mocks/ops";
import { trendSeries } from "@/mocks/demo";
import { cx, money } from "@/lib/format";

const sceneUsage = [
  { scene: "电商文案", requests: 1284, spend: "¥2,146.20", quality: "92.5%", cost: "¥0.043", status: "已发布" },
  { scene: "办公摘要", requests: 642, spend: "¥1,208.60", quality: "88.1%", cost: "¥0.038", status: "已发布" },
  { scene: "结构化提取", requests: 218, spend: "¥931.60", quality: "95.0%", cost: "¥0.094", status: "草稿" },
];

export default function OpsOverviewPage() {
  const data = trendSeries.map((d) => ({
    day: d.day,
    revenue: Number(((d.commerce + d.office + d.extract) * 1.9).toFixed(1)),
    cost: Number(((d.commerce + d.office + d.extract) * 1.28).toFixed(1)),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="经营与运行总览"
        title="先看风险，再看收入"
        description="以下指标均为演示样例，采购成本为预估口径。"
        actions={
          <>
            <Link to="/ops/resources" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-background-300 bg-background-50 px-3 text-xs text-foreground-700 hover:border-primary-300">
              <i className="ri-refresh-line" />
              同步资源
            </Link>
            <Link to="/ops/finance" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-500 px-3 text-xs font-medium text-background-50 hover:bg-primary-600">
              处理差异
            </Link>
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-2 divide-background-100 lg:grid-cols-4 lg:divide-x">
          {opsMetrics.map((metric, i) => (
            <div key={metric.label} className={cx("p-4 md:p-5", i < 2 ? "border-b border-background-100 lg:border-b-0" : "")}>
              <div className="flex items-center justify-between">
                <p className="text-[10.5px] text-foreground-500">{metric.label}</p>
                <span className="rounded bg-background-100 px-1.5 py-0.5 text-[9px] text-foreground-400">{metric.note}</span>
              </div>
              <p className="tnum mt-1.5 font-heading text-xl font-semibold text-foreground-950 md:text-2xl">{metric.value}</p>
              <p className={cx("mt-1 text-[9.5px]", metric.delta.startsWith("+") ? "text-success" : "text-foreground-500")}>{metric.delta}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground-950">消费与成本趋势</h2>
              <p className="mt-0.5 text-[10.5px] text-foreground-500">近 7 天 · 单位：元 · 成本为预估</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-foreground-500">
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" />服务收入</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" />预估采购</span>
            </div>
          </div>
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--primary-500))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(var(--primary-500))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--accent-500))" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="oklch(var(--accent-500))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid oklch(var(--background-200))", fontSize: 11, background: "oklch(var(--background-50))" }}
                  formatter={(value: number, name: string) => [money(Number(value)), name === "revenue" ? "服务收入" : "预估采购"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="oklch(var(--primary-500))" strokeWidth={1.7} fill="url(#rev)" />
                <Area type="monotone" dataKey="cost" stroke="oklch(var(--accent-600))" strokeWidth={1.7} fill="url(#cost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[9.5px] text-foreground-400">收入与成本口径不同，差异需在对账页面核对后确认。</p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-950">待处理队列</h2>
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[9.5px] text-warning">{opsQueue.length} 项</span>
          </div>
          <div className="space-y-2">
            {opsQueue.map((item) => (
              <div key={item.id} className="rounded-xl border border-background-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-medium text-foreground-900">{item.title}</p>
                    <p className="mt-0.5 text-[9.5px] text-foreground-500">{item.meta}</p>
                  </div>
                  <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", item.tone === "danger" ? "bg-danger" : item.tone === "warning" ? "bg-warning" : "bg-primary-500")} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-foreground-400">演示队列</span>
                  <Link
                    to={item.id === "q4" ? "/ops/audit" : item.id === "q3" ? "/ops/finance" : item.id === "q2" ? "/ops/resources" : "/ops/finance"}
                    className="text-[10px] text-primary-600 hover:text-primary-700"
                  >
                    {item.action}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-background-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground-950">场景使用与质量概况</h2>
          <Link to="/ops/evaluations" className="text-[10.5px] text-primary-600 hover:text-primary-700">进入评测中心</Link>
        </div>
        <div className="hidden grid-cols-[1fr_0.7fr_0.8fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-background-100 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
          <span>场景</span>
          <span>近 7 天请求</span>
          <span>客户消费</span>
          <span>质量达标率</span>
          <span>合格结果成本</span>
          <span>状态</span>
        </div>
        <div className="divide-y divide-background-100">
          {sceneUsage.map((row) => (
            <div key={row.scene} className="grid grid-cols-1 gap-1 px-4 py-3 text-[10.5px] md:grid-cols-[1fr_0.7fr_0.8fr_0.7fr_0.7fr_0.6fr] md:items-center md:gap-3">
              <span className="text-[11.5px] font-medium text-foreground-900">{row.scene}</span>
              <span className="tnum text-foreground-700">{row.requests.toLocaleString()}</span>
              <span className="tnum text-foreground-700">{row.spend}</span>
              <span className="tnum text-foreground-700">{row.quality}</span>
              <span className="tnum text-foreground-700">{row.cost}</span>
              <span><Badge tone={row.status === "已发布" ? "success" : "neutral"}>{row.status}</Badge></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}