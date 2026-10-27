import { useState } from "react";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Tabs } from "@/components/base/ui";
import { useNavigate } from "react-router-dom";
import { useOps } from "@/lib/ops-data";
import { ts2str } from "@/lib/api";
import { cx } from "@/lib/format";

export default function OpsAuditPage() {
  const [tab, setTab] = useState("alerts");
  const { opsAlerts, opsAudits, act, notice, error } = useOps();
  const nav = useNavigate();
  const [selected, setSelected] = useState("");
  const [resolution, setResolution] = useState("");

  const alert = opsAlerts.find((a) => a.id === selected) ?? opsAlerts[0];
  const update = (status: string, msg: string) => void act("PUT", `/alerts/${alert!.id}`, { status, resolution: resolution || alert!.raw.resolution || "" }, msg);

  return (
    <div>
      <PageHeader
        eyebrow="告警与审计"
        title="每个动作都有影响说明"
        description="不提供批量删除或无确认的全站停机按钮。敏感操作会记录操作人、对象与原因。"
        actions={<Tabs items={[{ id: "alerts", label: "运行告警" }, { id: "audit", label: "操作审计" }]} value={tab} onChange={setTab} />}
      />

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      {tab === "alerts" && !alert ? (
        <Card className="p-6 text-center text-xs text-foreground-500">暂无告警。</Card>
      ) : tab === "alerts" && alert ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-background-200 px-4 py-2.5">
              <h2 className="text-[11.5px] font-semibold text-foreground-950">告警队列</h2>
            </div>
            <div className="divide-y divide-background-100">
              {opsAlerts.map((item) => {
                const state = item.status;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className={cx("w-full cursor-pointer px-4 py-3 text-left transition-colors", selected === item.id ? "bg-primary-50/50" : "hover:bg-background-100/60")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={item.level === "严重" ? "danger" : item.level === "警告" ? "warning" : "neutral"}>{item.level}</Badge>
                          <span className="truncate text-[11px] font-medium text-foreground-900">{item.title}</span>
                        </div>
                        <p className="mt-1 text-[9.5px] text-foreground-500">{item.time} · 责任人 {item.owner}</p>
                      </div>
                      <Badge tone={item.raw.status === "resolved" ? "success" : item.raw.status === "handling" ? "primary" : "warning"}>{state}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground-950">{alert.title}</h2>
                <p className="mt-0.5 text-[10px] text-foreground-500">#{alert.id} · {alert.raw.kind} · {alert.time}</p>
              </div>
              <Badge tone={alert.level === "严重" ? "danger" : alert.level === "警告" ? "warning" : "neutral"}>{alert.level}</Badge>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-xl bg-warning-soft/50 px-3 py-2.5">
                <p className="text-[9.5px] text-foreground-500">影响客户</p>
                <p className="mt-0.5 text-[10.5px] text-foreground-900">{alert.impact}</p>
              </div>
              <div className="rounded-xl bg-background-100/60 px-3 py-2.5">
                <p className="text-[9.5px] text-foreground-500">责任人 / 值班</p>
                <p className="mt-0.5 text-[10.5px] text-foreground-900">{alert.owner}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">时间线</p>
              <ol className="space-y-2 border-l border-background-200 pl-3.5">
                {[
                  { label: "告警触发", desc: alert.title, time: alert.time },
                  ...(alert.raw.updated_at && alert.raw.updated_at !== alert.raw.created_at ? [{ label: "最近更新", desc: `${alert.status}${alert.raw.resolution ? ` · ${alert.raw.resolution}` : ""}`, time: ts2str(alert.raw.updated_at) }] : []),
                  { label: "当前状态", desc: alert.status, time: "—" },
                ].map((event) => (
                  <li key={event.label} className="relative">
                    <span className="absolute left-[-19px] top-1 h-2 w-2 rounded-full border-2 border-background-50 bg-primary-400" />
                    <p className="text-[10.5px] font-medium text-foreground-900">{event.label}</p>
                    <p className="text-[9.5px] text-foreground-500">{event.desc} · {event.time}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 border-t border-background-100 pt-3">
              <Field label="处理 / 恢复说明（写入审计）"><Input value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={alert.raw.status !== "open"} onClick={() => update("handling", "已认领该告警")}>认领</Button>
              <Button size="sm" disabled={alert.raw.status === "resolved" || !resolution} onClick={() => update("resolved", "告警已标记恢复")}>标记恢复</Button>
              <Button size="sm" variant="danger" onClick={() => nav("/ops/resources")}>去暂停相关模型销售</Button>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-foreground-400">
              暂停只影响新任务，不中断已开始的任务。标记恢复需填写原因，所有动作写入审计。
            </p>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[0.7fr_0.8fr_1.1fr_1.1fr_1.4fr] gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
            <span>时间</span>
            <span>操作人</span>
            <span>动作</span>
            <span>对象</span>
            <span>说明</span>
          </div>
          <div className="divide-y divide-background-100">
            {opsAudits.length === 0 ? <p className="px-4 py-8 text-center text-[11px] text-foreground-500">暂无审计记录。</p> : null}
            {opsAudits.map((item) => (
              <div key={item.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-[10.5px] md:grid-cols-[0.7fr_0.8fr_1.1fr_1.1fr_1.4fr] md:items-center md:gap-3">
                <span className="text-foreground-500">{item.time}</span>
                <span className="text-foreground-800">{item.actor}</span>
                <span className="text-foreground-800">{item.action}</span>
                <span className="font-mono-ui text-[9.5px] text-foreground-600">{item.target}</span>
                <span className="leading-relaxed text-foreground-600">{item.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}