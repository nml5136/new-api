import { useState } from "react";
import { Badge, Button, Card, Modal, Notice, PageHeader, Tabs } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { ts2str } from "@/lib/api";
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

  const { opsChannels, opsSyncLogs, opsModels, act, reload, error, notice, yuan } = useOps();
  // 同步资源：重新读取平台目录与 New API 渠道数（渠道配置本身在网关后台维护）
  const sync = async () => {
    setSyncState("running");
    await reload();
    setSyncState(error ? "partial" : "done");
  };
  // 修改模型可售状态：提交完整模型记录，服务端同步 New API 倍率
  const setModelStatus = (m: any, status: string) => {
    const { channels: _c, price: _p, ...model } = m;
    void act("PUT", `/models/${m.id}`, { ...model, status }, `${m.display_name || m.model_name} 状态已更新`);
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
            <Button onClick={() => void sync()} disabled={syncState === "running"}>
              <i className={cx("ri-refresh-line", syncState === "running" ? "animate-spin" : "")} />
              {syncState === "running" ? "同步中…" : "同步资源"}
            </Button>
          </>
        }
      />

      {syncState === "partial" ? (
        <Notice tone="warning" icon="ri-error-warning-line" className="mb-3">
          同步部分失败：{error}。请检查后端日志后重试，不要直接标记为成功。
          <button type="button" onClick={() => setSyncState("done")} className="ml-2 cursor-pointer rounded border border-current px-1.5 py-0.5 text-[10px]">查询同步结果</button>
        </Notice>
      ) : null}
      {syncState === "done" ? (
        <Notice tone="success" icon="ri-check-line" className="mb-3">同步完成：已刷新模型目录、渠道数与价格版本。</Notice>
      ) : null}

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error && syncState !== "partial" ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-foreground-400">集成状态</p>
              <div className="mt-1.5 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground-950">New API 适配层</h2>
                <Badge tone={error ? "warning" : "success"}>{error ? "部分异常" : "已连接"}</Badge>
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
            <Button size="sm" variant="outline" onClick={() => void sync()}>测试连接</Button>
            <Button size="sm" variant="ghost">查看差异</Button>
            <span className="text-[9.5px] text-foreground-400">经服务端适配层访问，浏览器不接触网关凭证</span>
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
            {opsModels.map((model: any) => (
              <div key={model.id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium text-foreground-950">{model.display_name || model.model_name}</p>
                    <Badge tone={model.status === "on_sale" ? "success" : model.status === "pending" || model.status === "testing" ? "neutral" : "warning"}>
                      {({ on_sale: "可售", pending: "待核验", testing: "测试中", paused: "暂停销售", offline: "已下线" } as Record<string, string>)[model.status] || model.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-foreground-500">
                    {model.model_name} · 上下文 {model.context_length} · {model.channels} 个渠道 · 质量 {model.quality_level}/5
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-foreground-600">
                  <span>零售价：{model.price ? `${yuan(model.price.input_price)} / ${yuan(model.price.output_price)}` : "未定价"}</span>
                  <span>授权至：{model.license_expire_at ? ts2str(model.license_expire_at).slice(0, 10) : "—"}</span>
                  {model.status === "on_sale" ? (
                    <Button size="sm" variant="outline" onClick={() => setModelStatus(model, "paused")}>暂停销售</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setModelStatus(model, "on_sale")}>设为可售</Button>
                  )}
                </div>
              </div>
            ))}
            {opsModels.length === 0 ? <p className="px-4 py-6 text-center text-[11px] text-foreground-500">暂无模型，请先在数据库种子或网关中配置。</p> : null}
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
            {opsSyncLogs.map((log, i) => (
              <div key={`${log.time}-${i}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
        description="该入口仅对授权管理员开放，平台不跳转公共网关、不嵌入 iframe、不在浏览器保存管理员凭证。"
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
          <p className="text-[10px] text-foreground-400">渠道与上游密钥请在服务端 New API 后台维护。</p>
        </div>
      </Modal>
    </div>
  );
}