import { useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Tabs } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { cx } from "@/lib/format";

// 队列项：统一承载对账差异、充值订单与退款单
type Item = { key: string; kind: "diff" | "order" | "refund"; type: string; subject: string; platform: string; external: string; diff: string; status: string; raw: any };

const tabMap: Record<string, string> = { payment: "支付对账", consume: "消费对账", purchase: "上游采购", refund: "退款" };

export default function OpsFinancePage() {
  const { opsFinanceDiffs, opsOrders, opsRefunds, yuan, act, notice, error, loading, raw } = useOps();
  // 登记线下充值：生成待确认的支付订单，仍需“确认到账”后才入账
  const [rcOpen, setRcOpen] = useState(false);
  const [rc, setRc] = useState({ tenant_id: "", amount: "", pay_channel: "transfer", voucher: "", remark: "" });
  const [rcErr, setRcErr] = useState("");
  const submitRc = async () => {
    if (!rc.tenant_id) return setRcErr("请选择企业");
    if (!(Number(rc.amount) > 0)) return setRcErr("金额须大于 0");
    if (rc.voucher.trim().length < 2) return setRcErr("请填写凭证号");
    const r = await act("POST", "/recharges", { tenant_id: Number(rc.tenant_id), amount: Math.round(Number(rc.amount) * 100), kind: "pay", pay_channel: rc.pay_channel, voucher: rc.voucher, remark: rc.remark }, "充值订单已登记，待确认到账后入账");
    if (r !== undefined) { setRcOpen(false); setRc({ tenant_id: "", amount: "", pay_channel: "transfer", voucher: "", remark: "" }); }
  };
  const [tab, setTab] = useState("payment");
  const [selected, setSelected] = useState("");
  const [tradeNo, setTradeNo] = useState("");
  const [paid, setPaid] = useState("");
  const [extNo, setExtNo] = useState("");
  const [remark, setRemark] = useState("");

  const items: Item[] = [
    ...opsFinanceDiffs.map((d) => ({ key: `d-${d.id}`, kind: "diff" as const, type: d.type, subject: d.subject, platform: d.platform, external: d.external, diff: d.diff, status: d.status, raw: d.raw })),
    ...opsOrders.filter((o: any) => o.status !== "credited" && o.status !== "closed").map((o: any) => ({
      key: `o-${o.order_no}`, kind: "order" as const, type: "支付对账", subject: `${o.order_no} · ${o.tenantName}`, platform: yuan(o.amount), external: o.trade_no || "未回传",
      diff: o.kind === "grant" ? "审批发放待确认" : "待确认到账", status: o.statusText, raw: o,
    })),
    ...opsRefunds.map((r: any) => ({
      key: `r-${r.refund_no}`, kind: "refund" as const, type: "退款", subject: `${r.refund_no} · ${r.tenantName}`, platform: yuan(r.amount), external: r.external_no || "—",
      diff: r.reason || (r.kind === "compensation" ? "调用补偿" : "未使用充值退回"), status: r.statusText, raw: r,
    })),
  ];
  const list = items.filter((d) => d.type === tabMap[tab]);
  const current = items.find((d) => d.key === selected) ?? list[0];
  const pending = items.filter((d) => ["待核对", "待到账", "确认中", "异常待核对", "待审核", "额度锁定", "结果待确认"].includes(d.status));
  const tone = (s: string) => (["已处理", "已完成", "已入账"].includes(s) ? "success" : ["待审核", "待核对", "异常待核对", "结果待确认"].includes(s) ? "warning" : "primary");

  const pick = (d: Item) => {
    setSelected(d.key);
    const k = Object.keys(tabMap).find((x) => tabMap[x] === d.type);
    if (k) setTab(k);
    setTradeNo(""); setPaid(""); setExtNo(""); setRemark("");
  };

  const actions = () => {
    if (!current) return null;
    const r = current.raw;
    if (current.kind === "diff") {
      return r.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void act("POST", `/recon/diffs/${r.id}?status=resolved`, undefined, "差异已标记为已处理")}>标记已处理</Button>
          <Button size="sm" variant="outline" onClick={() => void act("POST", `/recon/diffs/${r.id}?status=ignored`, undefined, "差异已忽略")}>忽略</Button>
        </div>
      ) : <p className="text-[10px] text-foreground-500">该差异已处理。</p>;
    }
    if (current.kind === "order") {
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="第三方交易号 / 银行流水号"><Input value={tradeNo} onChange={(e) => setTradeNo(e.target.value)} /></Field>
            <Field label="实收金额（元）"><Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={(r.amount / 100).toFixed(2)} /></Field>
          </div>
          <Button size="sm" disabled={!tradeNo} onClick={() => void act("POST", `/recharges/${r.order_no}/confirm`, { trade_no: tradeNo, paid: Math.round((Number(paid || r.amount / 100) || 0) * 100) }, "到账已确认，额度入账中")}>确认到账并入账</Button>
        </div>
      );
    }
    if (r.status === "pending") {
      return (
        <div className="space-y-2">
          <Field label="审核意见"><Input value={remark} onChange={(e) => setRemark(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void act("POST", `/refunds/${r.refund_no}/approve?remark=${encodeURIComponent(remark)}`, undefined, "退款已审核通过")}>审核通过</Button>
            <Button size="sm" variant="outline" onClick={() => void act("POST", `/refunds/${r.refund_no}/reject?remark=${encodeURIComponent(remark)}`, undefined, "退款已驳回")}>驳回</Button>
          </div>
        </div>
      );
    }
    if (r.status === "locked") {
      return (
        <div className="space-y-2">
          <Field label="外部退款交易号"><Input value={extNo} onChange={(e) => setExtNo(e.target.value)} /></Field>
          <div className="flex gap-2">
            <Button size="sm" disabled={!extNo} onClick={() => void act("POST", `/refunds/${r.refund_no}/success?external_no=${encodeURIComponent(extNo)}`, undefined, "退款已完成")}>外部退款成功</Button>
            <Button size="sm" variant="outline" onClick={() => void act("POST", `/refunds/${r.refund_no}/failed`, undefined, "退款已标记失败，锁定额度已释放")}>外部退款失败</Button>
          </div>
        </div>
      );
    }
    return <p className="text-[10px] text-foreground-500">该退款单已结束（{current.status}）。</p>;
  };

  return (
    <div>
      <PageHeader
        eyebrow="对账与退款"
        title="先看差异，再处理差异"
        description="详情采用左右对照：平台记录与外部记录。差异字段高亮，不允许用删除原记录来消除差异。"
        actions={<><Button variant="outline" onClick={() => { setRcErr(""); setRcOpen(true); }}><i className="ri-bank-card-line" />登记线下充值</Button><Button variant="outline" onClick={() => void act("POST", "/recon/run", undefined, "对账已执行")}><i className="ri-refresh-line" />立即对账</Button></>}
      />

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {pending.slice(0, 4).map((diff) => (
          <button
            key={diff.key}
            type="button"
            onClick={() => pick(diff)}
            className={cx("cursor-pointer rounded-xl border bg-background-50 p-3 text-left transition-colors", current?.key === diff.key ? "border-primary-300" : "border-background-200 hover:border-background-300")}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-foreground-500">{diff.type}</span>
              <Badge tone={tone(diff.status)}>{diff.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono-ui text-[10px] text-foreground-800">{diff.subject}</p>
            <p className="mt-1 text-[10px] text-foreground-600">差异：{diff.diff}</p>
          </button>
        ))}
        {pending.length === 0 && !loading ? <p className="text-[11px] text-foreground-500">暂无待处理事项。</p> : null}
      </div>

      <Tabs
        items={[
          { id: "payment", label: "支付对账" },
          { id: "consume", label: "消费对账" },
          { id: "purchase", label: "上游采购对账" },
          { id: "refund", label: "退款审核" },
        ]}
        value={tab}
        onChange={(t) => { setTab(t); setSelected(""); }}
      />

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-background-200 px-4 py-2.5">
            <h2 className="text-[11.5px] font-semibold text-foreground-950">{tabMap[tab]}队列</h2>
          </div>
          <div className="divide-y divide-background-100">
            {list.map((diff) => (
              <button
                key={diff.key}
                type="button"
                onClick={() => pick(diff)}
                className={cx("w-full cursor-pointer px-4 py-3 text-left transition-colors", current?.key === diff.key ? "bg-primary-50/50" : "hover:bg-background-100/60")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-ui text-[10px] text-foreground-700">{diff.subject}</span>
                  <Badge tone={tone(diff.status)}>{diff.status}</Badge>
                </div>
                <p className="mt-1 text-[10px] text-foreground-500">差异字段：{diff.diff}</p>
              </button>
            ))}
            {list.length === 0 ? <p className="px-4 py-8 text-center text-[11px] text-foreground-500">该类型暂无记录，无需处理。</p> : null}
          </div>
        </Card>

        {current ? (
          <Card className="h-fit p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground-950">{current.subject}</h2>
                <p className="mt-0.5 text-[10px] text-foreground-500">{current.type} · {current.kind === "diff" ? `差异编号 ${current.raw.id} · 批次 ${current.raw.batch_no}` : current.kind === "order" ? "充值订单" : "退款单"}</p>
              </div>
              <Badge tone={tone(current.status)}>{current.status}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-background-200 p-3">
                <p className="mb-2 text-[9.5px] uppercase tracking-[0.14em] text-foreground-400">平台记录</p>
                <div className="space-y-1.5 text-[10.5px] text-foreground-700">
                  <div className="flex justify-between"><span>金额</span><span className="tnum">{current.platform}</span></div>
                  <div className="flex justify-between"><span>来源</span><span>平台账务</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-warning bg-warning-soft/40 p-3">
                <p className="mb-2 text-[9.5px] uppercase tracking-[0.14em] text-warning">外部记录</p>
                <div className="space-y-1.5 text-[10.5px] text-foreground-800">
                  <div className="flex justify-between"><span>{current.kind === "diff" ? "金额" : "外部单号"}</span><span className="tnum">{current.external}</span></div>
                  <div className="flex justify-between"><span>说明</span><span className="text-warning">{current.diff}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4">{actions()}</div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-foreground-400">
              每次动作都记录业务号、金额与原因并写入审计。系统不允许删除原记录来消除差异，退款与补偿以追加记录体现。
            </p>
          </Card>
        ) : null}
      </div>
      <Modal
        open={rcOpen}
        onClose={() => setRcOpen(false)}
        title="登记线下充值"
        description="对公转账等线下到账：先登记订单，核对银行流水后在“支付对账”中确认到账才会入账。"
        footer={<><Button variant="outline" onClick={() => setRcOpen(false)}>取消</Button><Button onClick={() => void submitRc()}>登记</Button></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="企业 *"><Select value={rc.tenant_id} onChange={(e) => setRc({ ...rc, tenant_id: e.target.value })}><option value="">请选择</option>{raw.tenants.map((x: any) => <option key={x.tenant.id} value={x.tenant.id}>{x.tenant.name}</option>)}</Select></Field>
          <Field label="金额（元）*"><Input type="number" value={rc.amount} onChange={(e) => setRc({ ...rc, amount: e.target.value })} /></Field>
          <Field label="渠道"><Select value={rc.pay_channel} onChange={(e) => setRc({ ...rc, pay_channel: e.target.value })}><option value="transfer">对公转账</option><option value="manual">其他线下</option></Select></Field>
          <Field label="凭证号 *"><Input value={rc.voucher} onChange={(e) => setRc({ ...rc, voucher: e.target.value })} /></Field>
          <Field label="备注" className="sm:col-span-2"><Input value={rc.remark} onChange={(e) => setRc({ ...rc, remark: e.target.value })} /></Field>
          {rcErr ? <p className="text-[11px] text-danger sm:col-span-2">{rcErr}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
