import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, PageHeader, ProgressBar, Tabs } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { cx, money, recordStatusMeta, sceneLabel, tokens } from "@/lib/format";
import { commerceSample, extractSample, summarySample } from "@/mocks/outputs";

const sceneIcons: Record<string, string> = {
  "commerce-copy": "ri-quill-pen-line",
  "office-summary": "ri-file-text-line",
  "info-extract": "ri-braces-line",
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const { monthSpend, monthBudget, reserved, balance, records, tasks, projects, currentProjectId, singleCap, saveDraft, scenes } = useDemo();
  const [scene, setScene] = useState("commerce-copy");
  const [prompt, setPrompt] = useState("");
  const [range, setRange] = useState<"7" | "30">("7");

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? projects[0];
  const usage = monthBudget ? Math.round((monthSpend / monthBudget) * 100) : 0;
  const remaining = monthBudget - monthSpend - reserved;
  // 趋势按最近调用记录的场景与费用聚合，单位元
  const data = trendFrom(records, range === "7" ? 7 : 30);

  const sampleForScene = () =>
    scene === "commerce-copy" ? commerceSample : scene === "office-summary" ? summarySample : extractSample;

  const start = () => {
    const material = prompt.trim() || sampleForScene();
    const sceneId = scene as "commerce-copy" | "office-summary" | "info-extract";
    const title =
      sceneId === "commerce-copy"
        ? "保温杯详情页文案"
        : sceneId === "office-summary"
          ? "客户反馈周报摘要"
          : "采购合同字段提取";
    const draftId = saveDraft({ scene: sceneId, title, prompt: material, preference: "balanced" });
    navigate(`/app/workspace?scene=${sceneId}&draft=${draftId}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="总览"
        title="上午好，林晨"
        description={`2026 年 10 月 26 日 · 当前项目：${currentProject?.name ?? "默认项目"} · 今天可以从一个具体任务开始。`}
        actions={
          <>
            <Link
              to="/docs"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-background-300 bg-background-50 px-3 text-xs text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
            >
              <i className="ri-code-s-slash-line" />
              查看接入示例
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground-950">今天想完成什么</h2>
              <p className="mt-1 text-xs text-foreground-600">选一个场景，把材料贴进来，平台负责选模型与校验预算。</p>
            </div>
            <span className="rounded-full bg-background-100 px-2.5 py-1 text-[10px] text-foreground-500">一期三个场景</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {scenes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScene(item.id)}
                className={cx(
                  "flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition-all",
                  scene === item.id
                    ? "border-primary-300 bg-primary-50/60 shadow-[0_0_0_1px_oklch(var(--primary-300))]"
                    : "border-background-200 bg-background-50 hover:border-background-300",
                )}
              >
                <span className={cx("mb-2 flex h-7 w-7 items-center justify-center rounded-lg", scene === item.id ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500")}>
                  <i className={cx(sceneIcons[item.id], "text-[13px]")} />
                </span>
                <span className="text-[13px] font-medium text-foreground-950">{item.name}</span>
                <span className="mt-0.5 text-[10.5px] leading-relaxed text-foreground-500">{item.tagline}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-background-200 bg-background-50">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={scene === "commerce-copy" ? "粘贴商品事实：名称、容量、材质、卖点、渠道与禁用词…" : scene === "office-summary" ? "粘贴需要压缩的长文或会议记录…" : "粘贴需要提取字段的原始文本…"}
              className="w-full resize-none rounded-xl bg-transparent px-3.5 py-3 text-xs leading-relaxed text-foreground-900 placeholder:text-foreground-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-background-100 px-3 py-2">
              <button
                type="button"
                onClick={() => setPrompt(sampleForScene())}
                className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-primary-600 hover:bg-primary-50"
              >
                <i className="ri-magic-line" />
                填入示例
              </button>
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] text-foreground-400 sm:inline">单次上限 {money(singleCap)}</span>
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary-500 px-3 text-[11px] font-medium text-background-50 transition-colors hover:bg-primary-600"
                >
                  {scene === "commerce-copy" ? "生成文案" : scene === "office-summary" ? "生成摘要" : "提取信息"}
                  <i className="ri-arrow-right-line" />
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-foreground-400">
            提交前会先做预算与余额校验，未通过时不会发起生成。
          </p>
        </Card>

        <Card className="flex flex-col p-5 xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-foreground-500">本月消费</p>
              <p className="tnum mt-1 font-heading text-[30px] font-semibold leading-none text-foreground-950">{money(monthSpend)}</p>
              <p className="mt-1.5 text-[11px] text-foreground-500">企业预算 {money(monthBudget)}</p>
            </div>
            <Link to="/app/billing" className="flex h-8 w-8 items-center justify-center rounded-lg bg-background-100 text-foreground-500 hover:text-foreground-900" aria-label="前往账单">
              <i className="ri-arrow-right-up-line" />
            </Link>
          </div>

          <div className="mt-4">
            <ProgressBar value={usage} tone={usage >= 95 ? "danger" : usage >= 80 ? "warning" : "primary"} />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-foreground-500">已使用 {usage}%</span>
              <span className={cx("font-medium", usage >= 80 ? "text-warning" : "text-foreground-800")}>剩余 {money(Math.max(0, remaining))}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-background-100 pt-3">
            <div>
              <p className="text-[10px] text-foreground-500">在途预留</p>
              <p className="tnum mt-0.5 text-xs font-medium text-foreground-900">{money(reserved)}</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-500">可用余额</p>
              <p className="tnum mt-0.5 text-xs font-medium text-foreground-900">{money(balance)}</p>
            </div>
          </div>
          <Link to="/app/budgets" className="mt-3 flex items-center gap-1 text-[11px] text-primary-600 hover:text-primary-700">
            管理预算与项目分配
            <i className="ri-arrow-right-line" />
          </Link>
        </Card>

        <Card className="p-5 xl:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground-950">消费趋势</h2>
              <p className="mt-0.5 text-[11px] text-foreground-500">按场景拆分 · 单位：元</p>
            </div>
            <Tabs items={[{ id: "7", label: "近 7 天" }, { id: "30", label: "近 30 天" }]} value={range} onChange={setRange} />
          </div>
          <div className="h-[214px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCommerce" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--primary-500))" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="oklch(var(--primary-500))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gOffice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--accent-500))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(var(--accent-500))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gExtract" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(var(--secondary-400))" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="oklch(var(--secondary-400))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--background-200))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(var(--foreground-500))" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid oklch(var(--background-200))",
                    fontSize: 11,
                    background: "oklch(var(--background-50))",
                    color: "oklch(var(--foreground-900))",
                  }}
                  formatter={(value: number, name: string) => [money(Number(value)), name === "commerce" ? "电商文案" : name === "office" ? "办公摘要" : "结构化提取"]}
                />
                <Area type="monotone" dataKey="commerce" stackId="1" stroke="oklch(var(--primary-500))" strokeWidth={1.6} fill="url(#gCommerce)" />
                <Area type="monotone" dataKey="office" stackId="1" stroke="oklch(var(--accent-600))" strokeWidth={1.6} fill="url(#gOffice)" />
                <Area type="monotone" dataKey="extract" stackId="1" stroke="oklch(var(--secondary-400))" strokeWidth={1.6} fill="url(#gExtract)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-foreground-500">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary-500" />电商文案</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent-500" />办公摘要</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-secondary-400" />结构化提取</span>
            <span className="ml-auto text-foreground-400">示例输入</span>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground-950">最近任务</h2>
            <Link to="/app/requests" className="text-[11px] text-primary-600 hover:text-primary-700">全部记录</Link>
          </div>
          <div className="space-y-1">
            {records.slice(0, 5).map((record) => {
              const meta = recordStatusMeta[record.status] ?? recordStatusMeta.completed;
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => navigate(`/app/workspace?task=${record.id}&scene=${record.scene}`)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 text-left transition-colors hover:bg-background-100"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
                    <i className={cx(sceneIcons[record.scene], "text-[13px]")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-medium text-foreground-900">{record.title}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-foreground-500">
                      <span>{record.time}</span>
                      <span className="text-background-300">·</span>
                      <span>{record.model}</span>
                      <span className="text-background-300">·</span>
                      <span className="tnum">{record.cost === null ? "费用待核对" : money(record.cost)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {tasks.length === 0 ? <p className="py-6 text-center text-xs text-foreground-500">还没有任务，从上方开始第一个。</p> : null}
        </Card>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-foreground-600">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" />可用模型 3 个</span>
          <span className="flex items-center gap-1.5"><i className="ri-time-line text-foreground-400" />最近成功请求 {records.find((r) => r.status === "completed")?.time ?? "—"}</span>
          <span className="flex items-center gap-1.5"><i className="ri-error-warning-line text-warning" />需要处理的账单问题 1 条</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-foreground-400">
          <span>健康状态仅表示当前可知状态</span>
          <span className="rounded bg-background-100 px-1.5 py-0.5">示例</span>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-foreground-400">
        当前会话由 {sceneLabel(scene)} 场景承载；最近一次任务使用 {tokens(12000)} 输入 Token 与 2,000 输出 Token，费用 {money(0.04)}（固定样例口径）。
      </p>
    </div>
  );
}
function trendFrom(records: { time: string; scene: string; cost: number | null }[], days: number) {
  const out: Record<string, { day: string; commerce: number; office: number; extract: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out[k] = { day: k, commerce: 0, office: 0, extract: 0 };
  }
  for (const r of records) {
    const k = r.time.slice(5, 10);
    if (!out[k]) continue;
    const key = r.scene === "commerce-copy" ? "commerce" : r.scene === "office-summary" ? "office" : r.scene === "info-extract" ? "extract" : null;
    if (key) out[k][key] = Math.round((out[k][key] + (r.cost || 0)) * 100) / 100;
  }
  return Object.values(out);
}
