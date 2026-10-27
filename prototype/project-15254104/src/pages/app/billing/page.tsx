import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Modal, Notice, PageHeader, ProgressBar, Tabs } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { billingStatusMeta, cx, money, recordStatusMeta, sceneLabel } from "@/lib/format";

type Tab = "orders" | "spend" | "ledger";

export default function BillingPage() {
  const { balance, monthSpend, monthBudget, reserved, orders, records, createRecharge, settleOrder, failOrder } = useDemo();
  const [tab, setTab] = useState<Tab>("orders");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "pay" | "processing" | "done" | "delayed" | "failed">("choose");
  const [amount, setAmount] = useState(200);
  const [custom, setCustom] = useState("");
  const [orderId, setOrderId] = useState("");
  const [phase, setPhase] = useState(0);

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const pendingRecords = records.filter((r) => r.billing === "pending");
  const usage = Math.round((monthSpend / monthBudget) * 100);

  const ledger = useMemo(() => {
    const entries: Array<{ id: string; time: string; type: string; amount: number; note: string; ref: string }> = [];
    orders.forEach((o) => {
      entries.push({
        id: `led-${o.id}`,
        time: o.createdAt,
        type: o.status === "paid" ? "充值入账" : o.status === "failed" ? "支付失败" : "待入账",
        amount: o.status === "paid" ? o.amount : 0,
        note: o.note,
        ref: o.id,
      });
    });
    records.forEach((r) => {
      entries.push({
        id: `led-${r.id}`,
        time: r.time,
        type: r.billing === "released" ? "预扣释放" : r.billing === "pending" ? "预扣待核对" : "调用消费",
        amount: r.billing === "released" || r.cost === null ? 0 : -r.cost,
        note: `${sceneLabel(r.scene)} · ${r.model}`,
        ref: r.id,
      });
    });
    return entries.slice(0, 14);
  }, [orders, records]);

  const reset = () => {
    setOpen(false);
    setStep("choose");
    setCustom("");
    setOrderId("");
    setPhase(0);
  };

  const start = (mode: "success" | "delay" | "fail") => {
    const id = createRecharge(amount);
    setOrderId(id);
    setStep("processing");
    setPhase(0);
    if (mode === "success") {
      window.setTimeout(() => setPhase(1), 500);
      window.setTimeout(() => {
        setPhase(2);
        settleOrder(id);
      }, 1100);
      window.setTimeout(() => setStep("done"), 1500);
    } else if (mode === "delay") {
      window.setTimeout(() => setStep("delayed"), 900);
    } else {
      window.setTimeout(() => {
        failOrder(id);
        setStep("failed");
      }, 900);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="账单与充值"
        title="一个企业，一份余额"
        description="任务与 API 调用共用同一份企业钱包。充值只入账一次，重复回调不会让余额再次增长。"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-background-950 p-5 text-background-50 md:p-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-[200px] w-[200px] rounded-full bg-primary-500/25 blur-[70px]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] text-background-50/45">企业可用余额</p>
                <p className="tnum mt-1 font-heading text-[34px] font-semibold leading-none">{money(balance)}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-background-50/40">
                  <i className="ri-shield-check-line text-accent-500" />
                  统一钱包 · 任务与 API 共用
                </p>
              </div>
              <Button
                onClick={() => {
                  setOpen(true);
                  setStep("choose");
                }}
                className="bg-background-50 text-background-950 hover:bg-background-100"
              >
                <i className="ri-add-line" />
                充值
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-background-50/10 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-background-50/40">本月消费</p>
                <p className="tnum mt-1 text-sm font-medium">{money(monthSpend)}</p>
              </div>
              <div>
                <p className="text-[10px] text-background-50/40">在途预扣</p>
                <p className="tnum mt-1 text-sm font-medium">{money(reserved)}</p>
              </div>
              <div>
                <p className="text-[10px] text-background-50/40">待处理</p>
                <p className="tnum mt-1 text-sm font-medium">
                  {pendingOrders.length + pendingRecords.length} 项
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-foreground-500">企业月预算</p>
              <p className="tnum mt-1 text-lg font-semibold text-foreground-950">{money(monthBudget)}</p>
            </div>
            <Badge tone={usage >= 95 ? "danger" : usage >= 80 ? "warning" : "primary"}>{usage}% 已使用</Badge>
          </div>
          <div className="mt-3">
            <ProgressBar value={usage} tone={usage >= 95 ? "danger" : usage >= 80 ? "warning" : "primary"} />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-foreground-500">
            <span>已消费 {money(monthSpend)}</span>
            <span>剩余 {money(Math.max(0, monthBudget - monthSpend - reserved))}</span>
          </div>
          <div className="mt-4 space-y-2 border-t border-background-100 pt-3 text-[10.5px]">
            <div className="flex items-center justify-between">
              <span className="text-foreground-500">待入账订单</span>
              <span className="text-foreground-900">{pendingOrders.length} 笔</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground-500">费用待核对</span>
              <Link to="/app/requests" className="text-primary-600 hover:text-primary-700">{pendingRecords.length} 笔 · 查看</Link>
            </div>
          </div>
          <Notice tone="neutral" icon="ri-information-line" className="mt-3">
            预算不足与钱包余额不足是两种不同问题：前者限制消费额度，后者需要充值。
          </Notice>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 py-3">
          <Tabs
            items={[
              { id: "orders", label: "充值订单", count: orders.length },
              { id: "spend", label: "消费明细", count: records.length },
              { id: "ledger", label: "额度变动" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <span className="text-[10px] text-foreground-400">金额为演示数据 · 不接入真实支付</span>
        </div>

        {tab === "orders" ? (
          <div className="divide-y divide-background-100">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono-ui text-[10.5px] text-foreground-700">{order.id}</p>
                    <Badge tone={order.status === "paid" ? "success" : order.status === "pending" ? "warning" : "danger"}>
                      {order.status === "paid" ? "已入账" : order.status === "pending" ? "待入账" : "支付失败"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-foreground-500">{order.createdAt} · {order.channel} · {order.note}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className={cx("tnum text-sm font-medium", order.status === "failed" ? "text-foreground-400 line-through" : "text-foreground-950")}>
                    {money(order.amount)}
                  </p>
                  {order.status === "pending" ? (
                    <Button size="sm" variant="outline" onClick={() => settleOrder(order.id)}>查询到账进度</Button>
                  ) : null}
                  {order.status === "failed" ? (
                    <Button size="sm" variant="outline" onClick={() => { setOpen(true); setStep("choose"); }}>重新充值</Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "spend" ? (
          <div className="divide-y divide-background-100">
            {records.filter((r) => r.cost !== null).map((record) => (
              <Link key={record.id} to={`/app/requests?focus=${record.id}`} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-background-100/60 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[11.5px] font-medium text-foreground-900">{record.title}</p>
                    <Badge tone={(recordStatusMeta[record.status] ?? recordStatusMeta.completed).tone}>
                      {(recordStatusMeta[record.status] ?? recordStatusMeta.completed).label}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono-ui text-[10px] text-foreground-400">{record.id} · {record.time}</p>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="tnum text-sm font-medium text-foreground-950">{money(record.cost ?? 0)}</p>
                    <p className="text-[9.5px] text-foreground-400">{(billingStatusMeta[record.billing] ?? billingStatusMeta.settled).label}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-foreground-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {tab === "ledger" ? (
          <div>
            <div className="hidden grid-cols-[1fr_0.9fr_0.8fr_1.3fr] gap-3 border-b border-background-100 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 sm:grid">
              <span>时间</span>
              <span>类型</span>
              <span className="text-right">金额</span>
              <span>关联</span>
            </div>
            <div className="divide-y divide-background-100">
              {ledger.map((entry) => (
                <div key={entry.id} className="grid grid-cols-1 gap-1 px-4 py-2.5 text-[10.5px] sm:grid-cols-[1fr_0.9fr_0.8fr_1.3fr] sm:items-center sm:gap-3">
                  <span className="text-foreground-600">{entry.time}</span>
                  <span className={cx(entry.type === "充值入账" ? "text-success" : entry.type === "预扣释放" ? "text-foreground-500" : "text-foreground-800")}>{entry.type}</span>
                  <span className={cx("tnum sm:text-right", entry.amount > 0 ? "text-success" : entry.amount < 0 ? "text-foreground-900" : "text-foreground-400")}>
                    {entry.amount === 0 ? "—" : `${entry.amount > 0 ? "+" : ""}${money(entry.amount)}`}
                  </span>
                  <span className="truncate font-mono-ui text-[9.5px] text-foreground-400">{entry.ref} · {entry.note}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <p className="mt-3 text-[10px] leading-relaxed text-foreground-400">
        充值只进入企业统一余额，不计入本月消费。全部任务与 API 调用都从这一份余额扣减。
      </p>

      <Modal
        open={open}
        onClose={reset}
        title={step === "choose" ? "充值企业钱包" : step === "pay" ? "确认支付" : step === "processing" ? "支付处理中" : "充值结果"}
        description={step === "choose" ? "选择演示金额，查看支付金额与可用额度说明。" : "以下为模拟支付界面，不与真实支付渠道交互。"}
        footer={
          step === "choose" ? (
            <>
              <Button variant="outline" onClick={reset}>取消</Button>
              <Button onClick={() => setStep("pay")} disabled={amount <= 0}>下一步：确认支付</Button>
            </>
          ) : step === "pay" ? (
            <>
              <Button variant="outline" onClick={() => setStep("choose")}>上一步</Button>
              <Button onClick={() => start("success")}>模拟支付成功</Button>
            </>
          ) : step === "delayed" ? (
            <>
              <Button variant="outline" onClick={reset}>稍后处理</Button>
              <Button
                onClick={() => {
                  settleOrder(orderId);
                  setStep("done");
                }}
              >
                查询到账进度
              </Button>
            </>
          ) : step === "done" || step === "failed" ? (
            <Button onClick={reset}>完成</Button>
          ) : null
        }
      >
        {step === "choose" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[100, 200, 500, 1000].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAmount(value);
                    setCustom("");
                  }}
                  className={cx(
                    "cursor-pointer rounded-xl border py-3 text-center transition-colors",
                    amount === value && !custom ? "border-primary-400 bg-primary-50 text-primary-700" : "border-background-200 text-foreground-700 hover:border-background-300",
                  )}
                >
                  <span className="tnum block text-sm font-medium">{money(value, 0)}</span>
                  <span className="mt-0.5 block text-[9.5px] text-foreground-400">演示金额</span>
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">自定义金额</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500">¥</span>
                <input
                  type="number"
                  min={1}
                  value={custom}
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setAmount(Number(e.target.value) || 0);
                  }}
                  placeholder="输入其他金额"
                  className="h-10 w-full rounded-xl border border-background-300 bg-background-50 pl-7 pr-3 text-sm text-foreground-900 focus:border-primary-400 focus:outline-none"
                />
              </div>
            </label>
            <div className="rounded-xl bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
              <div className="flex justify-between"><span>支付金额</span><span className="tnum font-medium text-foreground-900">{money(amount)}</span></div>
              <div className="mt-1.5 flex justify-between"><span>入账可用额度</span><span className="tnum font-medium text-foreground-900">{money(amount)}</span></div>
              <p className="mt-2 text-foreground-500">充值只增加企业钱包余额，不影响本月消费与预算使用率。</p>
            </div>
          </div>
        ) : null}

        {step === "pay" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-background-200 p-4 text-center">
              <p className="text-[11px] text-foreground-500">模拟支付金额</p>
              <p className="tnum mt-1 font-heading text-3xl font-semibold text-foreground-950">{money(amount)}</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-1 text-[10px] text-warning">
                <i className="ri-flask-line" />
                模拟支付 · 无真实二维码与收款链接
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => start("success")}>模拟成功</Button>
              <Button className="flex-1" variant="outline" onClick={() => start("delay")}>模拟回调延迟</Button>
              <Button className="flex-1" variant="danger" onClick={() => start("fail")}>模拟失败</Button>
            </div>
            <p className="text-[10px] leading-relaxed text-foreground-500">
              支付界面点击成功不会直接跳过入账逻辑；成功回调只入账一次，重复查询不会增加余额。
            </p>
          </div>
        ) : null}

        {step === "processing" ? (
          <div className="py-6">
            <div className="flex flex-col items-center text-center">
              <i className="ri-loader-4-line mb-3 animate-spin text-2xl text-primary-500" />
              <p className="text-sm font-medium text-foreground-950">
                {phase === 0 ? "支付确认中" : phase === 1 ? "入账中" : "已完成入账"}
              </p>
              <p className="mt-1 text-[11px] text-foreground-500">订单号 {orderId}</p>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2">
              {["支付确认中", "入账中", "已入账"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[9px]", i <= phase ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-400")}>
                    {i < phase ? <i className="ri-check-line" /> : i + 1}
                  </span>
                  <span className={cx("text-[10px]", i <= phase ? "text-foreground-800" : "text-foreground-400")}>{label}</span>
                  {i < 2 ? <span className="h-px w-4 bg-background-200" /> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="py-4 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
              <i className="ri-check-line text-lg" />
            </span>
            <p className="text-sm font-semibold text-foreground-950">已入账 {money(amount)}</p>
            <p className="mt-1 text-[11px] text-foreground-600">当前可用余额 {money(balance)}</p>
            <p className="mt-1 font-mono-ui text-[10px] text-foreground-400">订单号 {orderId}</p>
            <p className="mt-3 text-[10px] text-foreground-400">重复查询该订单不会再次增加余额。</p>
          </div>
        ) : null}

        {step === "delayed" ? (
          <div className="py-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-warning bg-warning-soft/60 p-3.5">
              <i className="ri-time-line mt-0.5 text-warning" />
              <div>
                <p className="text-xs font-medium text-foreground-950">回调延迟，等待入账</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">
                  支付机构尚未返回回执，订单已创建但未计入余额。请查询到账进度，不要重复付款。
                </p>
                <p className="mt-2 font-mono-ui text-[10px] text-foreground-500">订单号 {orderId}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === "failed" ? (
          <div className="py-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-danger bg-danger-soft/60 p-3.5">
              <i className="ri-close-circle-line mt-0.5 text-danger" />
              <div>
                <p className="text-xs font-medium text-foreground-950">支付失败，未入账</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-600">
                  本次充值没有改变余额。可以重新发起充值，或稍后在充值订单中查看状态。
                </p>
                <p className="mt-2 font-mono-ui text-[10px] text-foreground-500">订单号 {orderId}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}