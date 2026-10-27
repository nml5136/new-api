import { useState } from "react";
import { Badge, Button, Card, Modal, Notice, PageHeader, Tabs } from "@/components/base/ui";
import { opsChannels, opsSyncLogs } from "@/mocks/ops";
import { models } from "@/mocks/demo";
import { cx } from "@/lib/format";

const tabs = [
  { id: "models", label: "模型资源" },
  { id: "channels", label: "上游通道" },
  { id: "logs", label: "同步记录" },
];

export default function OpsResourcesPage() {
  const [tab, setTab] = useState("models");
  const [advanced, setAdvanced] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "running" | "partial" | "done">("idle");

  const sync = () => {
    setSyncState("running");
    window.setTimeout(() => setSyncState("partial"), 1200);
  };

  return (
    <div>
      <PageHeader
        eyebrow="模型资源与集成"
        title="上游能力在这里被看见"
        description="业务场景、授权与可售状态在平台管理；上游密钥、多 Key 与底层适配由网关后台管理。"
        actions={
          <>
            <Button variant="outline" onClick={() => setAdvanced(true)}>
              <i className="ri-settings-5-line" />
              高级网关配置
            </Button>
            <Button onClick={sync} disabled={syncState === "running"}>
              <i className={cx("ri-refresh-line", syncState === "running" ? "animate-spin" : "")} />
              {syncState === "running" ? "同步中…" : "同步资源"}
            </Button>
          </>
        }
      />

      {syncState === "partial" ? (
        <Notice tone="warning" icon="ri-error-warning-line" className="mb-3">
          同步部分失败：渠道 C-1 回读超时，已保留上次可用快照。请查看同步报告后重试，不要直接标记为成功。
          <button type="button" onClick={() => setSyncState("done")} className="ml-2 cursor-pointer rounded border border-current px-1.5 py-0.5 text-[10px]">查询同步结果</button>
        </Notice>
      ) : null}
      {syncState === "done" ? (
        <Notice tone="success" icon="ri-check-line" className="mb-3">同步完成：新增 1 个候选模型，更新 3 个价格版本（演示）。</Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">集成状态</p>
              <div className="mt-1.5 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground-950">New API 适配层</h2>
                <Badge tone="warning">模拟连接</Badge>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-foreground-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              健康
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["锁定版本", "待联调确认"],
              ["上次同步", "09:20"],
              ["同步延迟", "约 40s"],
              ["待处理差异", "2 项"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-background-100/60 p-2.5">
                <p className="text-[9.5px] text-foreground-500">{label}</p>
                <p className="mt-0.5 text-[11px] font-medium text-foreground-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={sync}>测试连接</Button>
            <Button size="sm" variant="ghost">查看差异</Button>
            <span className="text-[9.5px] text-foreground-400">当前为模拟连接，版本待联调确认</span>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">资源健康</p>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-background-100/60 px-3 py-2">
              <span className="text-[10.5px] text-foreground-600">可售模型</span>
              <span className="text-[11px] font-medium text-foreground-900">3 个（另有 1 个待验证）</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-warning-soft/60 px-3 py-2">
              <span className="text-[10.5px] text-foreground-600">异常上游通道</span>
              <span className="text-[11px] font-medium text-warning">2 条</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-warning-soft/60 px-3 py-2">
              <span className="text-[10.5px] text-foreground-600">授权到期提醒</span>
              <span className="text-[11px] font-medium text-warning">C-1 授权 7 天后到期</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-background-100/60 px-3 py-2">
              <span className="text-[10.5px] text-foreground-600">价格待确认</span>
              <span className="text-[11px] font-medium text-foreground-900">1 个（示例模型 E）</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Tabs items={tabs} value={tab} onChange={setTab} />
        <span className="hidden text-[9.5px] text-foreground-400 sm:block">通道信息仅运营可见</span>
      </div>

      <Card className="mt-3 overflow-hidden">
        {tab === "models" ? (
          <div className="divide-y divide-background-100">
            {(models as unknown as Array<Record<string, string>>).map((model) => (
              <div key={model.id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium text-foreground-950">{model.name}</p>
                    <Badge tone={model.status === "available" ? "success" : model.status === "pending" ? "neutral" : "warning"}>
                      {model.status === "available" ? "可售" : model.status === "pending" ? "待验证" : "授权未覆盖"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-foreground-500">
                    {model.context} · {model.channel} · 分发许可：平台代售（演示）
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-foreground-600">
                  <span>价格状态：{model.status === "pending" ? "待确认" : "已生效"}</span>
                  <span>有效期：2027-03-31</span>
                  <Button size="sm" variant="ghost">查看资源</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "channels" ? (
          <div>
            <div className="hidden grid-cols-[1fr_1.2fr_0.7fr_0.6fr_0.6fr_1fr] gap-3 border-b border-background-100 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
              <span>通道</span>
              <span>关联模型</span>
              <span>状态</span>
              <span>平均延迟</span>
              <span>错误率</span>
              <span>说明</span>
            </div>
            <div className="divide-y divide-background-100">
              {opsChannels.map((channel) => (
                <div key={channel.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-[10.5px] md:grid-cols-[1fr_1.2fr_0.7fr_0.6fr_0.6fr_1fr] md:items-center md:gap-3">
                  <span className="font-mono-ui text-[10px] text-foreground-800">{channel.name}</span>
                  <span className="text-foreground-700">{channel.group}</span>
                  <span>
                    <Badge tone={channel.status === "健康" ? "success" : channel.status === "降权" ? "warning" : "neutral"}>{channel.status}</Badge>
                  </span>
                  <span className="tnum text-foreground-700">{channel.latency}</span>
                  <span className="tnum text-foreground-700">{channel.errorRate}</span>
                  <span className="text-[9.5px] leading-relaxed text-foreground-500">{channel.note}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "logs" ? (
          <div className="divide-y divide-background-100">
            {opsSyncLogs.map((log) => (
              <div key={log.time} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium text-foreground-900">{log.action} · <span className={log.result === "成功" ? "text-success" : "text-warning"}>{log.result}</span></p>
                  <p className="mt-0.5 text-[10px] text-foreground-500">{log.detail}</p>
                </div>
                <span className="shrink-0 text-[9.5px] text-foreground-400">{log.time}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <p className="mt-3 text-[9.5px] leading-relaxed text-foreground-400">
        范围说明：业务场景、授权与可售状态在平台管理；上游密钥、多 Key 与底层适配由网关后台管理。
      </p>

      <Modal
        open={advanced}
        onClose={() => setAdvanced(false)}
        title="高级网关配置"
        description="该入口仅对授权管理员开放，原型不跳转公共网关、不嵌入 iframe、不保存管理员凭证。"
        footer={<Button variant="outline" onClick={() => setAdvanced(false)}>关闭</Button>}
      >
        <div className="space-y-3 text-[11px] leading-relaxed text-foreground-600">
          <p>真实系统中，底层网关管理入口由后端签发一次性受保护链接，并记录访问审计。</p>
          <div className="rounded-xl bg-background-100/70 p-3">
            <p className="font-medium text-foreground-800">此页面不提供的内容</p>
            <ul className="mt-1.5 space-y-1 text-[10.5px]">
              <li>· 上游渠道密钥与管理员令牌输入框</li>
              <li>· 内嵌 New API 控制台</li>
              <li>· 浏览器直连管理接口的能力</li>
            </ul>
          </div>
          <p className="text-[10px] text-foreground-400">当前状态：模拟连接，版本待联调确认。</p>
        </div>
      </Modal>
    </div>
  );
}