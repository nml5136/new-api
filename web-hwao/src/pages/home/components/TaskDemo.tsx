import { useState } from "react";
import { cx } from "@/lib/format";
import { commerceSample, summarySample, extractSample } from "@/mocks/outputs";

const tabs = [
  {
    id: "copy",
    label: "电商文案",
    inputTitle: "商品事实",
    input: commerceSample.split("\n").slice(0, 5).join("\n"),
    outputTitle: "生成结果（节选）",
    output:
      "「暖意 12 小时」316 不锈钢保温杯 · 通勤随手杯\n\n· 装入 92℃ 热水，24 小时后仍有 58℃ 以上。\n· 316 不锈钢内胆，杯盖为食品级 PP。\n· 单手弹盖，地铁上也能稳稳喝到。",
    model: "示例模型 A",
    checks: [
      { label: "商品事实一致", pass: true },
      { label: "禁用词零命中", pass: true },
      { label: "长度符合详情页", pass: true },
    ],
  },
  {
    id: "summary",
    label: "办公摘要",
    inputTitle: "原文（节选）",
    input: summarySample.slice(0, 130),
    outputTitle: "要点与行动项",
    output:
      "要点\n1. 9 月华东区反馈 214 条，时效问题 78 条，占比 36%。\n2. 苏州与杭州仓平均延迟 1.6 天。\n\n行动项\n· 仓储给出补货与预警方案（唐勉，10-30）\n· 评估批量导出需求（周岑）",
    model: "示例模型 A",
    checks: [
      { label: "未引入原文外信息", pass: true },
      { label: "关键数字保留", pass: true },
      { label: "行动项含负责人或时间", pass: true },
    ],
  },
  {
    id: "extract",
    label: "结构化提取",
    inputTitle: "原始文本",
    input: extractSample,
    outputTitle: "字段结果",
    output:
      "contract_no  XL-2026-0917\nbuyer       星澜科技（上海）有限公司\namount      186000.00\ncurrency    CNY\nsign_date   2026-09-17\nremark      null（原文未提及）",
    model: "示例模型 C",
    checks: [
      { label: "字段类型校验", pass: true },
      { label: "缺失字段标记 null", pass: true },
      { label: "未猜测原文缺失值", pass: true },
    ],
  },
];

export default function TaskDemo() {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <section className="relative mx-auto w-full max-w-[1240px] px-4 md:px-8">
      <div className="rounded-2xl border border-background-200 bg-background-50 p-5 shadow-lift md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground-950">一次任务，如何被路由</h2>
            <p className="mt-1 text-xs text-foreground-600">同一份任务说明，会选择不同的候选模型与费用边界。</p>
          </div>
          <div className="inline-flex items-center gap-1 self-start rounded-full bg-background-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cx(
                  "cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active === tab.id ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-600 hover:text-foreground-900",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <div className="min-w-0 rounded-xl border border-background-200 bg-background-50 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-foreground-500">
              <i className="ri-file-text-line" />
              {current.inputTitle}
            </p>
            <pre className="max-h-[190px] overflow-auto whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-foreground-800 scroll-thin">
              {current.input}
            </pre>
          </div>

          <div className="flex items-center justify-center px-1 py-1 lg:flex-col lg:px-0">
            <span className="hidden h-full w-px bg-gradient-to-b from-transparent via-primary-200 to-transparent lg:block" />
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-medium text-primary-700">
              <i className="ri-git-branch-line" />
              {current.model}
            </span>
            <span className="hidden h-full w-px bg-gradient-to-b from-primary-200 via-primary-200 to-transparent lg:block" />
          </div>

          <div className="min-w-0 rounded-xl border border-primary-200 bg-primary-50/40 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-primary-700">
              <i className="ri-sparkling-2-line" />
              {current.outputTitle}
            </p>
            <pre className="max-h-[190px] overflow-auto whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-foreground-800 scroll-thin">
              {current.output}
            </pre>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-background-100 pt-3 text-[11px] text-foreground-500">
          {current.checks.map((check) => (
            <span key={check.label} className="flex items-center gap-1.5">
              <i className="ri-checkbox-circle-fill text-accent-600" />
              {check.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><i className="ri-wallet-3-line text-accent-600" />预计费用 ¥0.04</span>
          <span className="ml-auto flex flex-wrap items-center gap-2 text-[10px] text-foreground-400">
            <span className="rounded bg-background-100 px-1.5 py-0.5">检查结果示例</span>
            演示样例 · 不代表真实输出
          </span>
        </div>
        <p className="mt-2 text-[10px] text-foreground-400">
          输出不新增输入未提供的商品事实；同模型通道重试只更换服务通道，跨模型自动兜底保持未启用。不通过样例可在工作区的演示控制器中切换查看。
        </p>
      </div>
    </section>
  );
}