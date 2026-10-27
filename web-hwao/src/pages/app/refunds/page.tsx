import { useState } from "react";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Tabs } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { cx, money } from "@/lib/format";

const stepLabels = ["待审核", "额度锁定", "退款中", "完成"];

export default function RefundsPage() {
  const { records, orders, balance, refunds, createRefund, advanceRefund } = useDemo();
  const [tab, setTab] = useState<"refund" | "invoice">("refund");
  const [type, setType] = useState<"unused" | "verify">("verify");
  const [recordId, setRecordId] = useState(records[0]?.id ?? "");
  const [amount, setAmount] = useState("0.06");
  const [reason, setReason] = useState("中断前输出不完整");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [invoice, setInvoice] = useState({ title: "星澜科技（上海）有限公司", tax: "", email: "finance@xinglan.cn" });
  const [invoiceDocs, setInvoiceDocs] = useState<string[]>([]);
  const [invoiceDone, setInvoiceDone] = useState(false);

  const refundable = type === "unused" ? Math.min(balance, 500) : records.find((r) => r.id === recordId)?.cost ?? 0;

  const submit = () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setNotice("请输入有效的申请金额。");
      return;
    }
    if (value > refundable + 0.0001) {
      setNotice(`申请金额不能超过可申请范围 ${money(refundable)}。`);
      return;
    }
    if (refunds.some((r) => r.recordId === recordId && r.status !== "done" && r.type === type)) {
      setNotice("同一业务申请正在处理中，请勿重复提交。");
      return;
    }
    createRefund({ type, recordId, amount: value, reason });
    setNotice("申请已提交，状态为待审核。核实后以补偿或冲正记录体现，不会删除原消费记录。");
    setNote("");
  };

  const submitInvoice = () => {
    if (!invoice.title.trim()) {
      setNotice("请填写发票抬头。");
      return;
    }
    if (invoiceDocs.length === 0) {
      setNotice("请选择需要开票的充值订单。");
      return;
    }
    setInvoiceDone(true);
    setNotice("");
  };

  return (
    <div>
      <PageHeader
        eyebrow="退款与开票"
        title="保留原记录，追加调整"
        description="未使用充值款退款与调用费用核验分开处理。原型不生成具有法律效力的真实发票。"
        actions={<Tabs items={[{ id: "refund", label: "退款与核验" }, { id: "invoice", label: "开票申请" }]} value={tab} onChange={setTab} />}
      />

      {notice ? <Notice tone={notice.includes("已提交") ? "success" : "warning"} className="mb-3">{notice}</Notice> : null}

      {tab === "refund" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.05fr]">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground-950">提交申请</h2>
            <p className="mt-1 text-[10.5px] text-foreground-600">选择申请类型与原记录，系统会列示可申请范围。</p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { id: "unused" as const, label: "未使用充值款退款", desc: "仅可退未消费的充值金额" },
                { id: "verify" as const, label: "调用费用核验", desc: "针对已结算请求申请核对" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={cx(
                    "cursor-pointer rounded-xl border p-3 text-left transition-colors",
                    type === item.id ? "border-primary-300 bg-primary-50/50" : "border-background-200 hover:border-background-300",
                  )}
                >
                  <p className="text-[11.5px] font-medium text-foreground-900">{item.label}</p>
                  <p className="mt-0.5 text-[9.5px] leading-relaxed text-foreground-500">{item.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {type === "verify" ? (
                <Field label="原调用记录">
                  <Select value={recordId} onChange={(e) => setRecordId(e.target.value)}>
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>{r.title} · {r.id} · {r.cost === null ? "待核对" : money(r.cost)}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="原充值订单">
                  <Select defaultValue={orders[0]?.id}>
                    {orders.filter((o) => o.status === "paid").map((o) => (
                      <option key={o.id} value={o.id}>{o.id} · {money(o.amount)} · {o.createdAt}</option>
                    ))}
                  </Select>
                </Field>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="申请金额（元）" hint={`可申请 ${money(refundable)}`}>
                  <Input type="number" min={0.01} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field label="原因">
                  <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                    <option>中断前输出不完整</option>
                    <option>执行失败但仍计费</option>
                    <option>模型与描述不符</option>
                    <option>额度重复扣减</option>
                  </Select>
                </Field>
              </div>

              <Field label="补充说明" hint={`${note.length} / 500`}>
                <textarea
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="描述问题与期望处理方式（可选）"
                  className="w-full resize-y rounded-xl border border-background-300 bg-background-50 px-3 py-2 text-xs leading-relaxed text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"
                />
              </Field>

              <Notice tone="neutral" icon="ri-information-line">
                申请不会删除原消费记录；核实后以补偿或冲正记录体现。申请待确认时不允许重复提交同一业务申请。
              </Notice>

              <Button onClick={submit} className="w-full sm:w-auto">提交申请</Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-background-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground-950">申请与进度</h2>
              <p className="mt-0.5 text-[10px] text-foreground-500">状态变化保留记录，不覆盖历史节点。</p>
            </div>
            <div className="divide-y divide-background-100">
              {refunds.map((refund) => {
                const idx = stepLabels.indexOf(
                  refund.status === "reviewing" ? "待审核" : refund.status === "locked" ? "额度锁定" : refund.status === "refunding" ? "退款中" : "完成",
                );
                const active = refund.status !== "done";
                return (
                  <div key={refund.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono-ui text-[10.5px] text-foreground-700">{refund.id}</p>
                          <Badge tone={refund.type === "unused" ? "primary" : "neutral"}>
                            {refund.type === "unused" ? "未使用退款" : "费用核验"}
                          </Badge>
                          <Badge tone={refund.status === "done" ? "success" : refund.status === "reviewing" ? "warning" : "primary"}>
                            {refund.status === "reviewing" ? "待审核" : refund.status === "locked" ? "额度锁定" : refund.status === "refunding" ? "退款中" : "已完成"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[10.5px] text-foreground-600">{refund.reason} · 关联 {refund.recordId}</p>
                        <p className="mt-0.5 text-[9.5px] text-foreground-400">提交于 {refund.createdAt}</p>
                      </div>
                      <div className="text-right">
                        <p className="tnum text-sm font-medium text-foreground-950">{money(refund.amount)}</p>
                        {active ? (
                          <button
                            type="button"
                            onClick={() => advanceRefund(refund.id)}
                            className="mt-1 cursor-pointer text-[10px] text-primary-600 hover:text-primary-700"
                          >
                            查询进度
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {stepLabels.map((label, i) => (
                        <div key={label} className="flex flex-1 items-center gap-1">
                          <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px]", i <= idx ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-400")}>
                            {i < idx ? <i className="ri-check-line" /> : i + 1}
                          </span>
                          <span className={cx("hidden text-[9px] sm:block", i <= idx ? "text-foreground-800" : "text-foreground-400")}>{label}</span>
                          {i < stepLabels.length - 1 ? <span className={cx("h-px flex-1", i < idx ? "bg-primary-300" : "bg-background-200")} /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {refunds.length === 0 ? <p className="p-6 text-center text-[11px] text-foreground-500">还没有退款或核验申请。</p> : null}
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground-950">开票申请</h2>
            <p className="mt-1 text-[10.5px] text-foreground-600">仅可选择已完成入账的充值订单。一期发票线下开具。</p>
            <div className="mt-4 space-y-3">
              <Field label="发票抬头"><Input value={invoice.title} onChange={(e) => setInvoice((prev) => ({ ...prev, title: e.target.value }))} /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="纳税人识别号"><Input value={invoice.tax} onChange={(e) => setInvoice((prev) => ({ ...prev, tax: e.target.value }))} placeholder="91310000XXXXXXX" /></Field>
                <Field label="接收邮箱"><Input type="email" value={invoice.email} onChange={(e) => setInvoice((prev) => ({ ...prev, email: e.target.value }))} /></Field>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground-700">可开票记录</p>
                <div className="space-y-1.5">
                  {orders.filter((o) => o.status === "paid").map((order) => (
                    <label key={order.id} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-background-200 px-2.5 py-2 text-[10.5px] text-foreground-700">
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={invoiceDocs.includes(order.id)}
                          onChange={(e) => setInvoiceDocs((prev) => (e.target.checked ? [...prev, order.id] : prev.filter((id) => id !== order.id)))}
                          className="h-3.5 w-3.5 cursor-pointer"
                          style={{ accentColor: "oklch(var(--primary-500))" }}
                        />
                        {order.id}
                      </span>
                      <span className="tnum text-foreground-900">{money(order.amount)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={submitInvoice}>提交开票申请</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground-950">开票说明</h2>
            <div className="mt-3 space-y-2 text-[10.5px] leading-relaxed text-foreground-600">
              <p>· 充值订单入账后即可申请开票，开票金额不超过已入账金额。</p>
              <p>· 退款完成后对应开票额度会同步调整。</p>
              <p>· 提交后状态为"处理中"，原型不自动生成具有法律效力的真实发票。</p>
              <p>· 财务成员可查看开票记录，但不可读取任务正文与密钥。</p>
            </div>
            {invoiceDone ? (
              <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50/50 p-4">
                <div className="flex items-center gap-2">
                  <i className="ri-loader-4-line animate-spin text-primary-600" />
                  <p className="text-[11.5px] font-medium text-foreground-950">开票处理中</p>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-foreground-600">
                  抬头：{invoice.title} · 已选 {invoiceDocs.length} 笔订单 · 接收邮箱 {invoice.email}
                </p>
                <p className="mt-1 text-[9.5px] text-foreground-400">一期发票线下开具，由财务联系。</p>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}