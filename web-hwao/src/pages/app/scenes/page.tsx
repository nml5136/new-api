import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, PageHeader } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { commerceOutput, extractJson, extractRows, summaryOutput } from "@/mocks/outputs";
import { cx } from "@/lib/format";

const icons: Record<string, string> = {
  "commerce-copy": "ri-quill-pen-line",
  "office-summary": "ri-file-text-line",
  "info-extract": "ri-braces-line",
};

export default function ScenesPage() {
  const { scenes } = useDemo();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("commerce-copy");

  const list = scenes.filter((s) => !query || s.name.includes(query) || s.tagline.includes(query));
  const current = scenes.find((s) => s.id === active) ?? scenes[0];

  return (
    <div>
      <PageHeader
        eyebrow="场景中心"
        title="从一个明确的场景开始"
        description="一期只有三个高质量场景。每个场景都带输入模板、输出形式与质量检查点，不需要先研究模型。"
        actions={
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索场景或任务"
              className="h-9 w-full rounded-lg border border-background-300 bg-background-50 pl-8 pr-3 text-xs text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none sm:w-[220px]"
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {list.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => setActive(scene.id)}
              className={cx(
                "flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                active === scene.id
                  ? "border-primary-300 bg-primary-50/50"
                  : "border-background-200 bg-background-50 hover:border-background-300",
              )}
            >
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active === scene.id ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500")}>
                <i className={cx(icons[scene.id], "text-base")} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground-950">{scene.name}</span>
                  <Badge tone={active === scene.id ? "primary" : "neutral"}>{scene.recommend === "quality" ? "质量优先" : "均衡"}</Badge>
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-foreground-600">{scene.tagline}</span>
              </span>
            </button>
          ))}
          {list.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-xs text-foreground-600">没有匹配的场景。</p>
              <button type="button" onClick={() => setQuery("")} className="mt-2 cursor-pointer text-xs text-primary-600">清空搜索</button>
            </Card>
          ) : null}

          <Card className="p-4">
            <p className="text-[11px] font-medium text-foreground-900">场景之外的能力</p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-foreground-500">
              行业 Agent、渠道分佣与自动任务变更识别属于后续规划，不在一期可用菜单中。
            </p>
          </Card>
        </div>

        <Card className="min-w-0 overflow-hidden">
          <div className="border-b border-background-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground-950">{current.name}</h2>
                  <Badge tone="primary">一期可用</Badge>
                </div>
                <p className="mt-1.5 max-w-[560px] text-xs leading-relaxed text-foreground-600">{current.fit}</p>
              </div>
              <Button onClick={() => navigate(`/app/workspace?scene=${current.id}`)}>
                {current.action}
                <i className="ri-arrow-right-line" />
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-background-100/70 p-3">
                <p className="text-[10px] text-foreground-500">输出形式</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-800">{current.output}</p>
              </div>
              <div className="rounded-lg bg-background-100/70 p-3">
                <p className="text-[10px] text-foreground-500">必要输入</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-800">{current.inputs.join(" · ")}</p>
              </div>
              <div className="rounded-lg bg-background-100/70 p-3">
                <p className="text-[10px] text-foreground-500">质量检查点</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-800">{current.checks[0]}</p>
              </div>
            </div>
          </div>

          <div className="bg-background-100/40 p-4 md:p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium text-foreground-700">真实可读的示例预览</p>
              <span className="text-[10px] text-foreground-400">示例输出 · 非本次生成</span>
            </div>

            {current.id === "commerce-copy" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { name: "详情页", text: commerceOutput.split("详情段落：")[0] },
                  { name: "社媒短文案", text: "一杯从早热到晚。92℃ 进水，12 小时后还有 58℃。单手弹盖，通勤路上不洒不漏。" },
                  { name: "卖点清单", text: "· 316 不锈钢内胆\n· 24 小时保温 ≥58℃\n· 单手弹盖\n· 宽杯口易清洗\n· 268g 轻量" },
                ].map((variant) => (
                  <div key={variant.name} className="rounded-xl border border-background-200 bg-background-50 p-3.5">
                    <p className="mb-2 text-[10px] font-medium text-primary-600">{variant.name}</p>
                    <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground-700">{variant.text}</pre>
                  </div>
                ))}
              </div>
            ) : null}

            {current.id === "office-summary" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-background-200 bg-background-50 p-3.5">
                  <p className="mb-2 text-[10px] font-medium text-foreground-500">原文（节选）</p>
                  <p className="text-[11px] leading-relaxed text-foreground-600">
                    9 月华东区客户反馈汇总：本月共收到 214 条反馈，交付时效相关问题 78 条，占比 36%。出库延迟主要集中在苏州与杭州仓，平均延迟 1.6 天…
                  </p>
                </div>
                <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3.5">
                  <p className="mb-2 text-[10px] font-medium text-primary-700">摘要与行动项</p>
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-foreground-800">{summaryOutput}</pre>
                </div>
              </div>
            ) : null}

            {current.id === "info-extract" ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-background-200 bg-background-50">
                  <div className="grid grid-cols-[1.1fr_1.6fr_0.7fr] gap-2 border-b border-background-200 bg-background-100/60 px-3 py-2 text-[10px] font-medium text-foreground-500">
                    <span>字段</span>
                    <span>提取值</span>
                    <span>类型</span>
                  </div>
                  <div className="divide-y divide-background-100">
                    {extractRows.map((row) => (
                      <div key={row.field} className="grid grid-cols-[1.1fr_1.6fr_0.7fr] items-start gap-2 px-3 py-1.5 text-[10.5px]">
                        <span className="font-mono-ui text-foreground-600">{row.field}</span>
                        <span className={cx("truncate", row.value === null ? "text-foreground-400" : "text-foreground-900")}>{row.value ?? "null"}</span>
                        <span className="text-foreground-400">{row.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-primary-200 bg-primary-50/40">
                  <p className="border-b border-primary-200/60 px-3 py-2 text-[10px] font-medium text-primary-700">JSON 视图</p>
                  <pre className="overflow-x-auto p-3 font-mono-ui text-[10.5px] leading-[1.8] text-foreground-800 scroll-thin">{extractJson}</pre>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {current.checks.map((check) => (
                <span key={check} className="inline-flex items-center gap-1 rounded-full border border-background-200 bg-background-50 px-2 py-1 text-[10px] text-foreground-600">
                  <i className="ri-check-line text-accent-600" />
                  {check}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-background-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10.5px] text-foreground-500">
              推荐偏好：{current.recommend === "quality" ? "质量优先" : "均衡"} · 默认单次上限 ¥0.10 · 同模型多渠道兜底已启用
            </p>
            <Button variant="outline" size="sm" onClick={() => navigate(`/app/workspace?scene=${current.id}`)}>
              打开任务工作区
              <i className="ri-arrow-right-line" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}