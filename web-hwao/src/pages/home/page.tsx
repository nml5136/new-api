import { Link } from "react-router-dom";
import PublicLayout from "@/components/feature/PublicLayout";
import { scenes } from "@/mocks/demo";
import RoutingDemo from "@/pages/home/components/RoutingDemo";
import TaskDemo from "@/pages/home/components/TaskDemo";

const values = [
  {
    no: "01",
    title: "选对模型，而不是选最贵的",
    body: "按场景质量底线筛选候选，再在预算内挑出合适的那一个。推荐理由可查看，不藏在一个开关后面。",
  },
  {
    no: "02",
    title: "预算可控，而不是事后惊讶",
    body: "企业总预算、项目分配与单次费用上限同时生效。接近阈值时提前预警，超出时停止新请求。",
  },
  {
    no: "03",
    title: "一个钱包，而不是两套账",
    body: "任务、API 调用与企业充值共用同一份余额。费用分项、预扣、释放与冲正都可追溯。",
  },
];

const steps = [
  { title: "场景", body: "选择电商文案、办公摘要或结构化提取，平台加载对应的输入模板与质量检查。" },
  { title: "能力校验", body: "校验上下文、结构化输出与授权范围，未验证模型不会进入收费任务。" },
  { title: "模型推荐", body: "在经济、均衡与质量优先之间给出候选，并说明理由与预估费用。" },
  { title: "任务结果", body: "流式生成，可停止、可重新生成；结果标注实际模型与任务状态。" },
  { title: "消费记录", body: "结算后同步余额、本月消费与调用记录；异常状态保留核对入口。" },
];

export default function Home() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-background-950 pt-[72px] text-background-50">
        <div className="pointer-events-none absolute inset-0 hero-glow" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background-950" />
        <div className="relative mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-10 px-4 pb-24 pt-10 md:px-8 lg:grid-cols-[52%_48%] lg:items-center lg:gap-6 lg:pt-14">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-background-50/15 bg-background-50/5 px-3 py-1.5 text-[11px] text-background-50/70">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
              场景驱动的 AI 工作入口
            </span>
            <h1 className="mt-5 font-heading text-[38px] font-semibold leading-[1.14] tracking-tight sm:text-[46px] lg:text-[54px]">
              从任务出发，
              <br />
              连接适合的{" "}
              <span className="relative inline-block">
                <span className="relative z-10">AI</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-primary-500/40" />
              </span>
            </h1>
            <p className="mt-5 max-w-[460px] text-sm leading-relaxed text-background-50/60">
              按场景选择模型，在清晰的预算内完成任务，统一管理调用与账单。你不需要先研究所有模型，只需要说清楚要做什么。
            </p>
            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Link
                to="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-background-50 px-6 text-sm font-medium text-background-950 transition-colors hover:bg-background-100 whitespace-nowrap"
              >
                开始一个任务
                <i className="ri-arrow-right-line" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-background-50/20 px-6 text-sm text-background-50/85 transition-colors hover:bg-background-50/10 whitespace-nowrap"
              >
                <i className="ri-code-s-slash-line" />
                查看接入方式
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-background-50/40">
              <span className="flex items-center gap-1.5"><i className="ri-shield-check-line" />按量计费 · 预算可控</span>
              <span className="flex items-center gap-1.5"><i className="ri-lock-2-line" />企业统一钱包</span>
              <span className="flex items-center gap-1.5"><i className="ri-shield-check-line" />一期三个场景</span>
            </div>
          </div>

          <div className="animate-rise lg:pl-4" style={{ animationDelay: "0.12s" }}>
            <RoutingDemo />
          </div>
        </div>
      </section>

      <div className="relative z-10 -mt-14 pb-14">
        <TaskDemo />
      </div>

      <section id="capabilities" className="mx-auto w-full max-w-[1240px] scroll-mt-[88px] px-4 py-12 md:px-8 md:py-16">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">为什么这样设计</p>
            <h2 className="mt-2 max-w-[520px] font-heading text-2xl font-semibold leading-snug text-foreground-950 md:text-[32px]">
              让 AI 能力先变得可解释，再变得可用
            </h2>
          </div>
          <p className="max-w-[340px] text-xs leading-relaxed text-foreground-600">
            平台负责场景、选型、会话与账务呈现；模型执行与通道选择在底层完成。你看到的每一次推荐，都能追溯到理由与费用。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {values.map((item, index) => (
            <div
              key={item.no}
              className={
                index === 1
                  ? "rounded-2xl border border-primary-200 bg-primary-50/60 p-6"
                  : "rounded-2xl border border-background-200 bg-background-50 p-6"
              }
            >
              <div className="flex items-baseline justify-between">
                <span className="font-heading text-[11px] font-semibold tracking-[0.2em] text-primary-600">{item.no}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background-100 text-foreground-500">
                  <i className={index === 0 ? "ri-compass-3-line" : index === 1 ? "ri-wallet-3-line" : "ri-bank-card-line"} />
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground-950">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-background-200 bg-background-100/70 py-14 md:py-16">
        <div className="mx-auto w-full max-w-[1240px] px-4 md:px-8">
          <div className="mb-9 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">可解释的任务路径</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground-950 md:text-[30px]">
                每一步都留下可查询的依据
              </h2>
            </div>
            <p className="max-w-[380px] text-xs leading-relaxed text-foreground-600">
              同模型渠道重试只更换服务通道，模型保持不变；跨模型自动兜底默认关闭，需完成授权与计费验证后才可能开放。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <div key={step.title} className="relative rounded-xl border border-background-200 bg-background-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="tnum flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-[10px] font-semibold text-background-50">
                    {i + 1}
                  </span>
                  <p className="text-[13px] font-medium text-foreground-950">{step.title}</p>
                </div>
                <p className="text-[11.5px] leading-relaxed text-foreground-600">{step.body}</p>
                {i < steps.length - 1 ? (
                  <i className="ri-arrow-right-s-line absolute -right-2 top-1/2 hidden -translate-y-1/2 text-foreground-300 lg:block" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="scenes" className="mx-auto w-full max-w-[1240px] scroll-mt-[88px] px-4 py-14 md:px-8 md:py-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary-600">一期场景</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold leading-snug text-foreground-950 md:text-[32px]">
              先做好三件事，
              <br />
              而不是几十个 Agent
            </h2>
            <p className="mt-3 max-w-[300px] text-xs leading-relaxed text-foreground-600">
              每个场景都有明确的输入、输出与质量检查点。行业 Agent 与渠道分佣属于后续规划，不在一期可用菜单中。
            </p>
            <Link
              to="/app/scenes"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              进入场景中心
              <i className="ri-arrow-right-line" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {scenes.map((scene) => (
              <Link
                key={scene.id}
                to={`/app/workspace?scene=${scene.id}`}
                className="group flex flex-col rounded-2xl border border-background-200 bg-background-50 p-5 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-soft"
              >
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <i
                    className={
                      scene.id === "commerce-copy"
                        ? "ri-quill-pen-line"
                        : scene.id === "office-summary"
                          ? "ri-file-text-line"
                          : "ri-braces-line"
                    }
                  />
                </span>
                <h3 className="text-sm font-semibold text-foreground-950">{scene.name}</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground-600">{scene.tagline}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {scene.checks.slice(0, 2).map((check) => (
                    <span key={check} className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] text-foreground-600">
                      {check}
                    </span>
                  ))}
                </div>
                <span className="mt-4 flex items-center gap-1 text-[11px] text-primary-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {scene.action}
                  <i className="ri-arrow-right-line" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 pb-16 md:px-8 md:pb-20">
        <div className="overflow-hidden rounded-2xl bg-background-950 p-6 md:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-500">开发者接入</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold leading-snug text-background-50 md:text-[30px]">
                用场景名调用，
                <br />
                让路由留在平台
              </h2>
              <p className="mt-3 max-w-[360px] text-xs leading-relaxed text-background-50/55">
                沿用兼容的对话接口，把 model 写成 <code className="rounded bg-background-50/10 px-1 py-0.5 font-mono-ui text-[11px] text-accent-400">scene:commerce-copy</code>，
                由平台完成候选与预算校验。场景识别是平台扩展，需要后端适配。
              </p>
              <div className="mt-5 space-y-2 text-[11px] text-background-50/55">
                <p className="flex items-center gap-2"><i className="ri-check-line text-accent-500" />平台域名占位，不暴露内部网关地址</p>
                <p className="flex items-center gap-2"><i className="ri-check-line text-accent-500" />支持固定模型、场景、会话三类调用</p>
                <p className="flex items-center gap-2"><i className="ri-check-line text-accent-500" />费用查询与幂等键避免重复计费</p>
              </div>
              <Link
                to="/docs"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-background-50/20 px-4 py-2.5 text-xs text-background-50/85 transition-colors hover:bg-background-50/10"
              >
                阅读开发文档
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-background-50/10 bg-[oklch(0.12_0.03_265)]">
              <div className="flex items-center gap-1.5 border-b border-background-50/10 px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-danger" />
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="ml-2 font-mono-ui text-[10px] text-background-50/35">POST /v1/chat/completions</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono-ui text-[11px] leading-[1.9] text-background-50/70 scroll-thin">
{`curl https://api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer $HWAO_API_KEY" \\
  -H "X-Route-Mode: scene" \\
  -H "X-Session-Id: ses_demo_01" \\
  -H "X-Max-Cost-CNY: 0.10" \\
  -d '{
    "model": "scene:commerce-copy",
    "messages": [
      { "role": "user", "content": "商品事实…" }
    ]
  }'`}
              </pre>
              <div className="flex items-center justify-between border-t border-background-50/10 px-4 py-2 text-[10px] text-background-50/35">
                <span>示例密钥不可用于真实调用</span>
                <span className="flex items-center gap-1"><i className="ri-file-copy-line" />复制示例</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-background-200 bg-background-100 py-16 md:py-20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[240px] w-[520px] -translate-x-1/2 rounded-full bg-primary-500/10 blur-[80px]" />
        <div className="relative mx-auto w-full max-w-[760px] px-4 text-center md:px-8">
          <h2 className="font-heading text-2xl font-semibold text-foreground-950 md:text-[34px]">从你的第一个场景开始</h2>
          <p className="mx-auto mt-3 max-w-[460px] text-sm leading-relaxed text-foreground-600">
            注册并使用邀请码开通企业空间，完成一次电商文案任务，然后在账单里看到同一笔费用。
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              to="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 text-sm font-medium text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
            >
              注册开通
              <i className="ri-arrow-right-line" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-background-300 bg-background-50 px-6 text-sm text-foreground-800 transition-colors hover:border-primary-300 whitespace-nowrap"
            >
              查看计费说明
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}