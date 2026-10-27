import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "@/components/feature/PublicLayout";
import { Badge, Notice } from "@/components/base/ui";
import { docsNav } from "@/mocks/ops";
import { cx } from "@/lib/format";

const samples = {
  scene: `curl https://api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer demo_hr_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "X-Route-Mode: scene" \\
  -H "X-Max-Cost-CNY: 0.10" \\
  -d '{
    "model": "scene:commerce-copy",
    "messages": [{ "role": "user", "content": "商品事实…" }]
  }'`,
  fixed: `{
  "model": "demo-model-a",
  "messages": [{ "role": "user", "content": "把下面文字压缩成要点…" }],
  "scene": "office-summary"
}`,
  session: `curl https://api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer demo_hr_xxxxxxxx" \\
  -H "X-Session-Id: ses_demo_001" \\
  -d '{
    "model": "scene:office-summary",
    "messages": [{ "role": "user", "content": "继续补充行动项" }]
  }'`,
  cost: `curl https://api.example.com/v1/usage/req_20261026_0842 \\
  -H "Authorization: Bearer demo_hr_xxxxxxxx"`,
};

const headers = [
  { name: "X-Route-Mode", desc: "scene 表示按场景选型；fixed 表示指定模型。", example: "scene" },
  { name: "X-Session-Id", desc: "同一会话保持实际模型，避免中途被替换。", example: "ses_demo_001" },
  { name: "X-Max-Cost-CNY", desc: "本次调用的费用硬上限，超出时拒绝执行。", example: "0.10" },
  { name: "Idempotency-Key", desc: "相同键的重复请求不会产生第二次计费。", example: "idem_9f2a…" },
  { name: "X-Request-Id", desc: "返回给平台侧用于关联请求与费用记录。", example: "req_20261026_0842" },
];

export default function DocsPage() {
  const [tab, setTab] = useState<keyof typeof samples>("scene");
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState("quickstart");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(samples[tab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-background-950 pb-12 pt-[108px] text-background-50 md:pt-[124px]">
        <div className="pointer-events-none absolute inset-0 hero-glow opacity-50" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 md:px-8">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-background-50/40">
            <Link to="/" className="hover:text-background-50/70">首页</Link>
            <i className="ri-arrow-right-s-line" />
            <span className="text-background-50/70">开发接入</span>
          </div>
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-[40px]">开发接入文档</h1>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-background-50/55">
            用兼容的对话接口接入平台。示例域名为占位地址，示例密钥不可用于真实调用。
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1240px] px-4 py-10 md:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[188px_1fr_320px]">
          <aside className="hidden lg:block">
            <div className="sticky top-[92px]">
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-foreground-400">文档目录</p>
              <div className="flex flex-col gap-0.5">
                {docsNav.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setActive(item.id)}
                    className={cx(
                      "rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                      active === item.id ? "bg-primary-50 font-medium text-primary-700" : "text-foreground-600 hover:bg-background-100",
                    )}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </aside>

          <article className="min-w-0 space-y-9">
            <section id="quickstart">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">快速接入</h2>
              <ol className="mt-4 space-y-3">
                {[
                  { title: "创建项目", body: "在项目中设置允许场景、默认路由与月预算。项目预算是消费限制，资金来自企业钱包。" },
                  { title: "创建平台密钥", body: "密钥仅展示一次完整值，之后只保留掩码。可按场景、模型与 IP 白名单限制。" },
                  { title: "选择场景", body: "使用 scene:<场景标识> 作为 model，或直接指定固定模型。" },
                  { title: "发送请求", body: "沿用 /v1/chat/completions，平台在服务端完成候选与预算校验。" },
                  { title: "查询费用", body: "通过请求号查询净费用、预扣、释放与冲正记录。" },
                ].map((item, i) => (
                  <li key={item.title} className="flex gap-3 rounded-xl border border-background-200 bg-background-50 p-4">
                    <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-semibold text-primary-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-foreground-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground-600">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section id="auth">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">认证与密钥</h2>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">
                使用 <code className="rounded bg-background-100 px-1 py-0.5 font-mono-ui text-[11px]">Authorization: Bearer &lt;平台密钥&gt;</code> 认证。
                平台不接受上游厂商密钥，也不要求你填写任何 New API 管理员凭证。
              </p>
              <Notice className="mt-3" tone="warning" icon="ri-shield-keyhole-line">
                不要把密钥写入前端代码或浏览器存储。演示密钥以 demo_hr_ 开头，无法用于真实调用。
              </Notice>
            </section>

            <section id="scene">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">按场景调用</h2>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">
                <code className="rounded bg-background-100 px-1 py-0.5 font-mono-ui text-[11px]">model: "scene:commerce-copy"</code> 是平台扩展，
                New API 原生不识别场景名。请求进入平台适配层后，才会映射为具体模型。
              </p>
              <div className="mt-3 overflow-hidden rounded-xl border border-background-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background-100/70 text-[11px] text-foreground-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">场景标识</th>
                      <th className="px-3 py-2 font-medium">适用任务</th>
                      <th className="px-3 py-2 font-medium">默认偏好</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-100 text-foreground-700">
                    <tr><td className="px-3 py-2 font-mono-ui text-[11px]">scene:commerce-copy</td><td className="px-3 py-2">商品文案生成</td><td className="px-3 py-2">均衡</td></tr>
                    <tr><td className="px-3 py-2 font-mono-ui text-[11px]">scene:office-summary</td><td className="px-3 py-2">长文摘要与行动项</td><td className="px-3 py-2">均衡</td></tr>
                    <tr><td className="px-3 py-2 font-mono-ui text-[11px]">scene:info-extract</td><td className="px-3 py-2">字段结构化提取</td><td className="px-3 py-2">质量优先</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section id="headers">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">平台请求头</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-background-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background-100/70 text-[11px] text-foreground-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">请求头</th>
                      <th className="px-3 py-2 font-medium">说明</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">示例</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-100 text-foreground-700">
                    {headers.map((h) => (
                      <tr key={h.name}>
                        <td className="px-3 py-2 font-mono-ui text-[11px] whitespace-nowrap">{h.name}</td>
                        <td className="px-3 py-2 leading-relaxed">{h.desc}</td>
                        <td className="hidden px-3 py-2 font-mono-ui text-[10px] text-foreground-500 sm:table-cell">{h.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="session">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">会话保持</h2>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">
                相同 X-Session-Id 的请求保持同一实际模型。若主通道故障，只会切换服务通道并提示"模型未变化"，不会自动换成另一个模型。
                跨模型自动兜底默认关闭，协议中也没有隐式开启方式。
              </p>
            </section>

            <section id="billing">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">费用查询</h2>
              <p className="mt-2 text-xs leading-relaxed text-foreground-600">
                净费用为输入、输出与适用缓存项之和。预扣在请求开始时发生，释放或冲正以追加记录体现，不删除原始消费记录。
              </p>
            </section>

            <section id="errors">
              <h2 className="font-heading text-xl font-semibold text-foreground-950">错误与重试</h2>
              <div className="mt-3 space-y-2">
                {[
                  { code: "budget_exceeded", desc: "预算不足，调整上限或预算后再新建任务。", tone: "warning" as const },
                  { code: "insufficient_balance", desc: "钱包余额不足，引导充值，不与预算不足混用文案。", tone: "warning" as const },
                  { code: "model_unavailable", desc: "候选模型不可用或授权未覆盖，返回可用候选列表。", tone: "neutral" as const },
                  { code: "result_pending", desc: "执行结果与费用待核对，不提供直接重试。", tone: "neutral" as const },
                ].map((err) => (
                  <div key={err.code} className="flex flex-col gap-1 rounded-lg border border-background-200 bg-background-50 p-3 sm:flex-row sm:items-center sm:gap-3">
                    <Badge tone={err.tone}>{err.code}</Badge>
                    <span className="text-[11px] leading-relaxed text-foreground-600">{err.desc}</span>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="lg:sticky lg:top-[92px] lg:self-start">
            <div className="overflow-hidden rounded-xl border border-background-200 bg-background-950">
              <div className="flex items-center gap-1 border-b border-background-50/10 px-3 py-2">
                {([
                  { id: "scene", label: "场景" },
                  { id: "fixed", label: "固定" },
                  { id: "session", label: "会话" },
                  { id: "cost", label: "费用" },
                ] as const).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cx(
                      "cursor-pointer rounded-md px-2 py-1 text-[10px] transition-colors whitespace-nowrap",
                      tab === item.id ? "bg-background-50/10 text-background-50" : "text-background-50/40 hover:text-background-50/70",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <pre className="max-h-[360px] overflow-auto p-3 font-mono-ui text-[10.5px] leading-[1.85] text-background-50/70 scroll-thin">
{samples[tab]}
              </pre>
              <div className="flex items-center justify-between border-t border-background-50/10 px-3 py-2">
                <span className="text-[10px] text-background-50/30">示例域名与密钥均为占位</span>
                <button
                  type="button"
                  onClick={copy}
                  className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] text-background-50/55 transition-colors hover:bg-background-50/10 hover:text-background-50"
                >
                  <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-background-200 bg-background-50 p-4">
              <p className="text-xs font-medium text-foreground-900">需要完整的调用闭环？</p>
              <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">
                进入演示工作台创建项目与密钥，可直接体验接入示例的复制与停用流程。
              </p>
              <Link
                to="/app/keys"
                className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 text-[11px] font-medium text-background-50 hover:bg-primary-600"
              >
                打开 API Key 页面
                <i className="ri-arrow-right-line" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}