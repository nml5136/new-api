import { useState } from "react";
import { Badge, Button, Card, Modal, Notice, PageHeader, Tabs } from "@/components/base/ui";
import { opsAlerts, opsAudits } from "@/mocks/ops";
import { cx } from "@/lib/format";

export default function OpsAuditPage() {
  const [tab, setTab] = useState("alerts");
  const [selected, setSelected] = useState(opsAlerts[0].id);
  const [alertState, setAlertState] = useState<Record<string, string>>({});
  const [pauseOpen, setPauseOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const alert = opsAlerts.find((a) => a.id === selected) ?? opsAlerts[0];

  return (
    <div>
      <PageHeader
        eyebrow="告警与审计"
        title="每个动作都有影响说明"
        description="原型不提供真实批量删除或无确认的全站停机按钮。敏感操作会记录操作人、对象与原因。"
        actions={<Tabs items={[{ id: "alerts", label: "运行告警" }, { id: "audit", label: "操作审计" }]} value={tab} onChange={setTab} />}
      />

      {notice ? <Notice tone="primary" icon="ri-information-line" className="mb-3">{notice}</Notice> : null}

      {tab === "alerts" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="overflow-hidden">
            <div className="border-b border-background-200 px-4 py-2.5">
              <h2 className="text-[11.5px] font-semibold text-foreground-950">告警队列</h2>
            </div>
            <div className="divide-y divide-background-100">
              {opsAlerts.map((item) => {
                const state = alertState[item.id] ?? item.status;
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
                      <Badge tone={state === "已恢复" ? "success" : state === "处理中" ? "primary" : "warning"}>{state}</Badge>
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
                <p className="mt-0.5 text-[10px] text-foreground-500">{alert.id} · {alert.time}</p>
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
                  { label: "告警触发", desc: "监控检测到错误率超过阈值 3%", time: "08:58" },
                  { label: "自动降权", desc: "该通道权重下调，主通道接管流量", time: "08:59" },
                  { label: "人工认领", desc: "值班同学确认并开始处理", time: "09:05" },
                  { label: "当前状态", desc: alertState[alert.id] ?? alert.status, time: "—" },
                ].map((event) => (
                  <li key={event.label} className="relative">
                    <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full border-2 border-background-50 bg-primary-400" />
                    <p className="text-[10.5px] font-medium text-foreground-900">{event.label}</p>
                    <p className="text-[9.5px] text-foreground-500">{event.desc} · {event.time}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-background-100 pt-3">
              <Button size="sm" variant="outline" onClick={() => { setAlertState((prev) => ({ ...prev, [alert.id]: "处理中" })); setNotice("已认领该告警（演示）。"); }}>认领</Button>
              <Button size="sm" onClick={() => { setAlertState((prev) => ({ ...prev, [alert.id]: "已恢复" })); setNotice("告警已标记恢复，需填写恢复原因并记录审计。"); }}>标记恢复</Button>
              <Button size="sm" variant="danger" onClick={() => setPauseOpen(true)}>暂停相关模型销售</Button>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-foreground-400">
              暂停只影响新任务，不中断已开始的任务。该动作会写入审计并需要说明原因。
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

      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="暂停该模型的新任务"
        description="此操作不会中断已经开始的任务，也不会删除任何记录。"
        footer={
          <>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                setPauseOpen(false);
                setNotice("已暂停该模型的新任务（演示）。已开始的任务继续执行，操作已记入审计。");
              }}
            >
              确认暂停
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          影响范围：使用该模型的场景将回退到其他通过门槛的候选；已在执行中的任务不受影响。
          <p className="mt-2 text-[10px] text-foreground-500">需要填写原因并通知相关客户，原型不发送真实通知。</p>
        </div>
      </Modal>
    </div>
  );
}