import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Drawer, EmptyState, PageHeader, Select } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { billingStatusMeta, cx, money, recordStatusMeta, sceneLabel, tokens } from "@/lib/format";
import type { UsageRecord } from "@/lib/types";

const tabs = [
  { id: "overview", label: "概览" },
  { id: "route", label: "路由" },
  { id: "cost", label: "用量费用" },
  { id: "events", label: "事件" },
] as const;

export default function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const { records, projects, resolveRecord, models } = useDemo();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [scene, setScene] = useState("all");
  const [status, setStatus] = useState("all");
  const [billing, setBilling] = useState("all");
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [page, setPage] = useState(1);
  const [showBody, setShowBody] = useState(false);

  const focusId = params.get("focus");
  const focused = records.find((r) => r.id === focusId);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (query && !r.id.includes(query) && !r.title.includes(query)) return false;
        if (project !== "all" && r.projectId !== project) return false;
        if (scene !== "all" && r.scene !== scene) return false;
        if (status !== "all" && r.status !== status) return false;
        if (billing !== "all" && r.billing !== billing) return false;
        return true;
      }),
    [records, query, project, scene, status, billing],
  );

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "—";
  const close = () => {
    params.delete("focus");
    setParams(params, { replace: true });
    setTab("overview");
    setShowBody(false);
  };

  const exportCsv = () => {
    const header = ["时间", "请求号", "项目", "场景", "实际模型", "结果", "计费", "输入Token", "输出Token", "费用", "耗时"];
    const rows = filtered.map((r) => [
      r.time,
      r.id,
      projectName(r.projectId),
      sceneLabel(r.scene),
      r.model,
      recordStatusMeta[r.status]?.label ?? r.status,
      billingStatusMeta[r.billing]?.label ?? r.billing,
      r.tokensIn,
      r.tokensOut,
      r.cost === null ? "待核对" : r.cost.toFixed(2),
      r.duration,
    ]);
    const csv = [header, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "调用记录.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQuery("");
    setProject("all");
    setScene("all");
    setStatus("all");
    setBilling("all");
    setPage(1);
  };

  const costDetail = (record: UsageRecord) => {
    const model = models.find((m) => m.name === record.model);
    const priceIn = model?.priceIn ?? 2;
    const priceOut = model?.priceOut ?? 8;
    return {
      priceIn,
      priceOut,
      inputCost: (record.tokensIn / 1_000_000) * priceIn,
      outputCost: (record.tokensOut / 1_000_000) * priceOut,
    };
  };

  return (
    <div>
      <PageHeader
        eyebrow="调用记录"
        title="每一次调用都可追溯"
        description="结果状态与计费状态分别展示。结果未知时费用显示为待核对，不会被当作零费用。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <i className="ri-download-2-line" />
              导出当前范围
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-background-200 p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="输入请求号或任务名称"
              className="h-9 w-full rounded-lg border border-background-300 bg-background-50 pl-8 pr-3 text-xs text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-hidden"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select className="h-9 text-[11px]" value={project} onChange={(e) => { setProject(e.target.value); setPage(1); }} aria-label="项目筛选">
              <option value="all">全部项目</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select className="h-9 text-[11px]" value={scene} onChange={(e) => { setScene(e.target.value); setPage(1); }} aria-label="场景筛选">
              <option value="all">全部场景</option>
              <option value="commerce-copy">电商文案</option>
              <option value="office-summary">办公摘要</option>
              <option value="info-extract">结构化提取</option>
            </Select>
            <Select className="h-9 text-[11px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="结果筛选">
              <option value="all">全部结果</option>
              <option value="completed">已完成</option>
              <option value="streaming">生成中</option>
              <option value="interrupted">部分输出后中断</option>
              <option value="unknown">结果待确认</option>
              <option value="failed">执行失败</option>
            </Select>
            <Select className="h-9 text-[11px]" value={billing} onChange={(e) => { setBilling(e.target.value); setPage(1); }} aria-label="计费筛选">
              <option value="all">全部计费</option>
              <option value="settled">已结算</option>
              <option value="reserved">预扣中</option>
              <option value="pending">待核对</option>
              <option value="released">已释放</option>
            </Select>
          </div>
          <button type="button" onClick={clearFilters} className="cursor-pointer whitespace-nowrap px-2 text-[11px] text-foreground-500 hover:text-foreground-900">
            清空
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon="ri-file-search-line"
              title="没有符合条件的记录"
              description="当前筛选条件下没有调用记录。可以清空筛选，或换个请求号再试。"
              action={<Button size="sm" variant="outline" onClick={clearFilters}>清空筛选条件</Button>}
            />
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[1.5fr_1.1fr_0.8fr_0.9fr_0.9fr_0.7fr] gap-3 border-b border-background-100 bg-background-100/50 px-4 py-2 text-[10px] font-medium text-foreground-500 md:grid">
              <span>时间 / 请求号</span>
              <span>任务与场景</span>
              <span>结果</span>
              <span>计费</span>
              <span>用量</span>
              <span className="text-right">费用</span>
            </div>
            <div className="divide-y divide-background-100">
              {visible.map((record) => {
                const sm = recordStatusMeta[record.status] ?? recordStatusMeta.completed;
                const bm = billingStatusMeta[record.billing] ?? billingStatusMeta.settled;
                return (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => setParams({ focus: record.id })}
                    className={cx(
                      "grid w-full cursor-pointer grid-cols-1 gap-2 px-4 py-3 text-left transition-colors hover:bg-background-100/70 md:grid-cols-[1.5fr_1.1fr_0.8fr_0.9fr_0.9fr_0.7fr] md:items-center md:gap-3",
                      focusId === record.id ? "bg-primary-50/50" : "",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="tnum text-[11px] text-foreground-800">{record.time}</p>
                      <p className="truncate font-mono-ui text-[10px] text-foreground-400">{record.id}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-medium text-foreground-900">{record.title}</p>
                      <p className="mt-0.5 text-[10px] text-foreground-500">{sceneLabel(record.scene)} · {record.model}</p>
                    </div>
                    <div><Badge tone={sm.tone}>{sm.label}</Badge></div>
                    <div><Badge tone={bm.tone}>{bm.label}</Badge></div>
                    <div className="tnum text-[10px] text-foreground-600">
                      {tokens(record.tokensIn)} / {tokens(record.tokensOut)}
                      <p className="text-[9.5px] text-foreground-400">{record.duration}</p>
                    </div>
                    <div className="tnum text-left text-[11px] font-medium text-foreground-900 md:text-right">
                      {record.cost === null ? <span className="text-warning">待核对</span> : money(record.cost)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col items-center justify-between gap-2 border-t border-background-200 px-4 py-2.5 sm:flex-row">
              <p className="text-[10px] text-foreground-500">共 {filtered.length} 条记录 · 当前第 {Math.min(page, pageCount)} / {pageCount} 页</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 disabled:cursor-not-allowed disabled:text-foreground-300"
                  aria-label="上一页"
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                <span className="tnum text-[10px] text-foreground-600">{Math.min(page, pageCount)}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-background-300 text-foreground-600 disabled:cursor-not-allowed disabled:text-foreground-300"
                  aria-label="下一页"
                >
                  <i className="ri-arrow-right-s-line" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Drawer
        open={Boolean(focused)}
        onClose={close}
        title={focused?.title ?? "请求详情"}
        subtitle={focused ? `${focused.id} · ${sceneLabel(focused.scene)}` : ""}
        width="sm:max-w-[620px]"
        footer={
          focused ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {focused.billing === "pending" ? (
                <>
                  <Button size="sm" onClick={() => resolveRecord(focused.id, "completed")}>查询状态（确认完成）</Button>
                  <Button size="sm" variant="outline" onClick={() => resolveRecord(focused.id, "failed")}>查询状态（失败释放）</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={close}>关闭</Button>
              )}
            </div>
          ) : null
        }
      >
        {focused ? (
          <div>
            <div className="flex flex-wrap gap-1 rounded-full bg-background-100 p-1">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cx(
                    "cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                    tab === item.id ? "bg-background-50 text-foreground-950 shadow-xs" : "text-foreground-600 hover:text-foreground-900",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {tab === "overview" ? (
                <div className="space-y-1">
                  <Row label="请求号" value={<span className="font-mono-ui text-[10.5px]">{focused.id}</span>} />
                  <Row label="任务" value={focused.title} />
                  <Row label="时间" value={focused.time} />
                  <Row label="项目" value={projectName(focused.projectId)} />
                  <Row label="场景 / 版本" value={`${sceneLabel(focused.scene)}`} />
                  <Row label="实际模型" value={focused.model} />
                  <Row label="结果状态" value={<Badge tone={(recordStatusMeta[focused.status] ?? recordStatusMeta.completed).tone}>{(recordStatusMeta[focused.status] ?? recordStatusMeta.completed).label}</Badge>} />
                  <Row label="计费状态" value={<Badge tone={(billingStatusMeta[focused.billing] ?? billingStatusMeta.settled).tone}>{(billingStatusMeta[focused.billing] ?? billingStatusMeta.settled).label}</Badge>} />
                  <div className="mt-3 rounded-lg bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
                    <p className="mb-1.5 flex items-center gap-1 font-medium text-foreground-800"><i className="ri-lock-line" />正文访问说明</p>
                    普通日志不默认展示提示词与回答。财务角色无法通过此入口读取正文。存在网页历史且有权限时，可单独查看任务内容。
                    <button
                      type="button"
                      onClick={() => setShowBody((v) => !v)}
                      className="mt-2 cursor-pointer rounded-md bg-background-50 px-2 py-1 text-[10px] text-primary-600 hover:bg-primary-50"
                    >
                      {showBody ? "收起任务内容" : "查看任务内容（有权限时）"}
                    </button>
                    {showBody ? (
                      <div className="mt-2 rounded-md border border-background-200 bg-background-50 p-2 text-[10px] leading-relaxed text-foreground-600">
                        {focused.output ? (
                          <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap font-sans text-[10.5px] scroll-thin">{focused.output}</pre>
                        ) : (
                          <p>该记录未保存正文，仅保留用量、费用与状态。</p>
                        )}
                        <Link to={`/app/workspace?task=${focused.id}&scene=${focused.scene}`} className="mt-2 inline-flex items-center gap-1 text-primary-600 hover:text-primary-700">
                          在任务画布中打开
                          <i className="ri-arrow-right-line" />
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {tab === "route" ? (
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-400">场景 → 模型 → 通道 → 结果</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-foreground-700">
                    <span className="rounded-md bg-background-100 px-2 py-1">{sceneLabel(focused.scene)}</span>
                    <i className="ri-arrow-right-s-line text-foreground-400" />
                    <span className="rounded-md bg-primary-50 px-2 py-1 text-primary-700">{focused.model}</span>
                    <i className="ri-arrow-right-s-line text-foreground-400" />
                    <span className="rounded-md bg-background-100 px-2 py-1">{focused.attempts[focused.attempts.length - 1]?.channel ?? "—"}</span>
                    <i className="ri-arrow-right-s-line text-foreground-400" />
                    <span className="rounded-md bg-background-100 px-2 py-1">{(recordStatusMeta[focused.status] ?? recordStatusMeta.completed).label}</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {focused.attempts.map((attempt, i) => (
                      <div key={`${attempt.channel}-${i}`} className="flex items-start gap-2.5 rounded-lg border border-background-200 p-3">
                        <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px]", attempt.result === "success" ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                          <i className={attempt.result === "success" ? "ri-check-line" : "ri-error-warning-line"} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-foreground-900">通道 {i + 1}：{attempt.channel}</p>
                          <p className="mt-0.5 text-[10px] text-foreground-500">
                            {attempt.result === "success" ? "成功返回" : attempt.result === "rate_limited" ? "限流，未产生客户费用" : "超时"} · {attempt.latency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1.5 rounded-lg bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
                    <p><span className="text-foreground-900">选择理由：</span>能力符合、质量检查通过、预估费用在单次上限与剩余预算内。</p>
                                        <p><span className="text-foreground-900">模型是否变化：</span>未发生变化。渠道重试不等于模型升级。</p>
                    <p className="text-foreground-400">查看任务正文需要相应权限，访问会被记录。</p>
                  </div>
                </div>
              ) : null}

              {tab === "cost" ? (
                <div>
                  <div className="rounded-xl border border-background-200 p-4">
                    <div className="flex items-end justify-between">
                      <p className="text-[11px] text-foreground-500">最终净费用</p>
                      <p className="tnum font-heading text-xl font-semibold text-foreground-950">
                        {focused.cost === null ? <span className="text-warning">待核对</span> : money(focused.cost)}
                      </p>
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-background-100 pt-3 text-[10.5px]">
                      <div className="flex justify-between text-foreground-600">
                        <span>输入 {tokens(focused.tokensIn)} Token × {money(costDetail(focused).priceIn)} / 百万</span>
                        <span className="tnum">{money(costDetail(focused).inputCost, 4)}</span>
                      </div>
                      <div className="flex justify-between text-foreground-600">
                        <span>输出 {tokens(focused.tokensOut)} Token × {money(costDetail(focused).priceOut)} / 百万</span>
                        <span className="tnum">{money(costDetail(focused).outputCost, 4)}</span>
                      </div>
                      <div className="flex justify-between border-t border-background-100 pt-1.5 font-medium text-foreground-900">
                        <span>计费状态</span>
                        <span>{(billingStatusMeta[focused.billing] ?? billingStatusMeta.settled).label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-background-100/70 p-3 text-[10px] leading-relaxed text-foreground-600">
                    预扣在请求开始时发生；释放与冲正以追加记录体现，不改写原始消费记录。多次通道尝试不会产生两笔客户订单。
                  </div>
                  {focused.cost === null ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => resolveRecord(focused.id, "completed")}>查询状态并结算</Button>
                      <Button size="sm" variant="outline" onClick={() => resolveRecord(focused.id, "failed")}>查询状态并释放</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "events" ? (
                <ol className="relative space-y-3 border-l border-background-200 pl-4">
                  {[
                    { t: focused.time, label: "接收请求", desc: "平台接收任务并关联项目与会话。" },
                    { t: focused.time, label: "预算校验", desc: "校验企业预算、单次上限与钱包余额。" },
                    { t: focused.time, label: "调用与执行", desc: `${focused.attempts.length} 次通道尝试，实际模型 ${focused.model}。` },
                    { t: focused.time, label: "结算与核对", desc: focused.billing === "pending" ? "回执缺失，进入待核对，不计入余额。" : "净费用已结算，写入调用记录与账务。" },
                  ].map((event, i) => (
                    <li key={event.label} className="relative">
                      <span className="absolute left-[-21px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-background-50 bg-primary-400" />
                      <p className="text-[11px] font-medium text-foreground-900">{event.label}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-500">{event.desc}</p>
                      <p className="mt-0.5 text-[9.5px] text-foreground-400">{event.t}</p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-background-100 py-2.5 last:border-0">
      <span className="shrink-0 text-[10.5px] text-foreground-500">{label}</span>
      <span className="min-w-0 text-right text-[11px] font-medium text-foreground-900">{value}</span>
    </div>
  );
}