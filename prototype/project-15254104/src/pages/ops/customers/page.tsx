import { useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Modal, Notice, PageHeader, Textarea } from "@/components/base/ui";
import { opsCustomers } from "@/mocks/ops";
import { cx, money } from "@/lib/format";

export default function OpsCustomersPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [amount, setAmount] = useState("500");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");

  const customer = opsCustomers.find((c) => c.id === selected);
  const currentStatus = (id: string, fallback: string) => status[id] ?? fallback;

  return (
    <div>
      <PageHeader
        eyebrow="客户管理"
        title="企业开通、权限与调用状态"
        description="用户组不被呈现为企业租户本身。额度调整需要理由与审批演示，不提供无审计的余额修改。"
      />

      {notice ? <Notice tone="primary" icon="ri-information-line" className="mb-3">{notice}</Notice> : null}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1fr_0.8fr_0.9fr] gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
          <span>企业</span>
          <span>开通状态</span>
          <span>授权模型</span>
          <span>本月消费</span>
          <span>额度状态</span>
          <span>最近活动</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-background-100">
          {opsCustomers.map((customer) => {
            const state = currentStatus(customer.id, customer.status);
            return (
              <div key={customer.id} className="grid grid-cols-1 gap-1.5 px-4 py-3 text-[10.5px] md:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1fr_0.8fr_0.9fr] md:items-center md:gap-3">
                <div>
                  <p className="text-[11.5px] font-medium text-foreground-900">{customer.name}</p>
                  <p className="font-mono-ui text-[9px] text-foreground-400">{customer.id}</p>
                </div>
                <span>
                  <Badge tone={state === "已启用" ? "success" : state === "开通中" ? "warning" : "danger"}>{state}</Badge>
                </span>
                <span className="text-foreground-700">{customer.scope}</span>
                <span className="tnum text-foreground-700">{customer.spend}</span>
                <span className={cx(customer.quota.includes("暂停") || customer.quota.includes("预警") ? "text-warning" : "text-foreground-700")}>{customer.quota}</span>
                <span className="text-foreground-500">{customer.last}</span>
                <div className="flex items-center gap-1 md:justify-end">
                  <button type="button" onClick={() => { setSelected(customer.id); setNotice(""); }} className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[9.5px] text-foreground-700 hover:border-primary-300 hover:text-primary-700">
                    详情
                  </button>
                  {state === "开通中" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStatus((prev) => ({ ...prev, [customer.id]: "已启用" }));
                        setNotice(`${customer.name} 的开通状态已查询为「已启用」（演示）。`);
                      }}
                      className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[9.5px] text-foreground-700 hover:border-primary-300"
                    >
                      查询开通
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Drawer
        open={Boolean(customer)}
        onClose={() => setSelected(null)}
        title={customer?.name ?? ""}
        subtitle={customer ? `${customer.id} · ${currentStatus(customer.id, customer.status)}` : ""}
        width="sm:max-w-[560px]"
        footer={
          customer ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button size="sm" variant="outline" onClick={() => setQuotaOpen(true)}>调整额度</Button>
              {currentStatus(customer.id, customer.status) === "已暂停" ? (
                <Button size="sm" onClick={() => { setStatus((prev) => ({ ...prev, [customer.id]: "已启用" })); setNotice(`${customer.name} 已恢复新请求（演示）。`); }}>
                  恢复新请求
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => { setStatus((prev) => ({ ...prev, [customer.id]: "已暂停" })); setNotice(`${customer.name} 已暂停新请求，已开始的任务不中断（演示）。`); }}
                >
                  暂停新请求
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {customer ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">基础信息</p>
              <div className="space-y-1.5">
                {[
                  ["企业名称", customer.name],
                  ["企业编号", customer.id],
                  ["企业管理员", "林晨 · linchen@xinglan.cn"],
                  ["开通时间", "2026-08-02"],
                  ["当前状态", currentStatus(customer.id, customer.status)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-background-100 py-1.5 last:border-0">
                    <span className="text-[10px] text-foreground-500">{label}</span>
                    <span className="text-[10.5px] text-foreground-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">项目与权限</p>
              <div className="space-y-1.5">
                {["默认项目 · 电商文案 + 办公摘要", "电商内容 · 电商文案", "办公助手 · 办公摘要 + 结构化提取"].map((item) => (
                  <div key={item} className="rounded-lg bg-background-100/70 px-2.5 py-2 text-[10px] text-foreground-700">{item}</div>
                ))}
              </div>
              <p className="mt-1.5 text-[9px] text-foreground-400">授权模型范围：{customer.scope}</p>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">账务摘要</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background-100/70 p-2.5">
                  <p className="text-[9px] text-foreground-500">本月消费</p>
                  <p className="tnum mt-0.5 text-[12px] font-medium text-foreground-900">{customer.spend}</p>
                </div>
                <div className="rounded-lg bg-background-100/70 p-2.5">
                  <p className="text-[9px] text-foreground-500">额度状态</p>
                  <p className="mt-0.5 text-[12px] font-medium text-foreground-900">{customer.quota}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">异常记录</p>
              <div className="space-y-1.5">
                <div className="rounded-lg border border-warning bg-warning-soft/50 px-2.5 py-2 text-[10px] text-foreground-700">1 条调用结果待确认（req_20261024_1050），费用待核对。</div>
                <div className="rounded-lg border border-background-200 px-2.5 py-2 text-[10px] text-foreground-700">2026-10-19 费用核验已完成，追加补偿记录 ¥0.06。</div>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        title="调整额度"
        description="额度调整需要理由与审批演示，改动会写入审计记录。"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuotaOpen(false)}>取消</Button>
            <Button
              disabled={reason.trim().length < 4}
              onClick={() => {
                setQuotaOpen(false);
                setNotice(`${customer?.name} 的额度调整申请已提交：${money(Number(amount) || 0)}，理由「${reason}」。等待审批（演示）。`);
                setReason("");
              }}
            >
              提交审批
            </Button>
          </>
        }
      >
        <Field label="调整金额（元）" hint="正数增加，负数减少">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="调整理由" hint="至少 4 个字符">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="说明业务背景与影响范围" />
        </Field>
        <p className="text-[10px] leading-relaxed text-foreground-500">
          不提供直接改写余额的入口。所有额度变化必须有业务号、金额与原因，并可在审计中查询。
        </p>
      </Modal>
    </div>
  );
}