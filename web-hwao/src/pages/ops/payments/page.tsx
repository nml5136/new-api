// 运营端「支付与订阅」（/ops/payments）：易支付配置、合规确认、兑换码、订阅套餐、个人充值订单。
// 全部复用 New API 管理接口（/api/option、/api/redemption、/api/subscription/admin、/api/user/topup）。
// 商户密钥只写不读：New API 不回传 EpayKey，留空表示不修改。
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Tabs } from "@/components/base/ui";
import { get, patch, post, put } from "@/lib/api";
import { money } from "@/lib/format";
import { listPage, payStatus, quotaYuan, yuanQuota, type PayStatus } from "@/lib/newapi-pay";

type Tab = "config" | "codes" | "plans" | "orders";
const ts = (t?: number) => (t ? new Date(t * 1000).toLocaleString("zh-CN", { hour12: false }) : "—");
const CFG_KEYS = ["PayAddress", "EpayId", "Price", "MinTopUp", "ServerAddress", "payment_setting.amount_options"] as const;
const emptyPlan = { title: "", subtitle: "", price_amount: 19.9, currency: "CNY", duration_unit: "month", duration_value: 1, enabled: true, total_amount_yuan: 30, quota_reset_period: "never", allow_balance_pay: false, max_purchase_per_user: 0 };

export default function OpsPaymentsPage() {
  const [tab, setTab] = useState<Tab>("config");
  const [st, setSt] = useState<PayStatus | null>(null);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [epayKey, setEpayKey] = useState("");
  const [compliance, setCompliance] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [gen, setGen] = useState({ name: "活动兑换码", count: 1, yuan: 10 });
  const [made, setMade] = useState<string[]>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = useCallback(async () => {
    setSt(await payStatus());
    const opts = await get<any[]>("/api/option/");
    const m: Record<string, string> = {};
    (opts || []).forEach((o: any) => (m[o.key] = String(o.value ?? "")));
    setCfg(Object.fromEntries(CFG_KEYS.map((k) => [k, m[k] || ""])));
    setCompliance(m["payment_setting.compliance_confirmed"] === "true");
    const [c, p, o] = await Promise.all([
      listPage("/api/redemption/?p=1&page_size=50").catch(() => []),
      get<any[]>("/api/subscription/admin/plans").catch(() => []),
      listPage("/api/user/topup?p=1&page_size=50").catch(() => []),
    ]);
    setCodes(c);
    setPlans(p || []);
    setOrders(o);
  }, []);
  useEffect(() => { load().catch((e) => setMsg({ tone: "danger", text: (e as Error).message })); }, [load]);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ tone: "success", text: ok });
      await load();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  const saveCfg = () => run(async () => {
    for (const k of CFG_KEYS) await put("/api/option/", { key: k, value: cfg[k] });
    if (epayKey) await put("/api/option/", { key: "EpayKey", value: epayKey });
    setEpayKey("");
  }, "支付配置已保存");

  const savePlan = () => run(async () => {
    const { total_amount_yuan, ...rest } = edit;
    const plan = { ...rest, price_amount: Number(rest.price_amount), duration_value: Number(rest.duration_value), total_amount: yuanQuota(Number(total_amount_yuan) || 0, st!) };
    if (edit.id) await put(`/api/subscription/admin/plans/${edit.id}`, { plan });
    else await post("/api/subscription/admin/plans", { plan });
    setEdit(null);
  }, "套餐已保存");

  if (!st) return <div className="p-6 text-sm text-foreground-500">正在加载…</div>;
  return (
    <div>
      <PageHeader eyebrow="支付与订阅" title="个人在线充值、兑换码与订阅套餐" description="复用 New API 原生支付能力。个人额度与企业钱包相互独立；企业对公充值仍在「对账与退款」确认到账。" />
      {msg ? <Notice tone={msg.tone} className="mb-4">{msg.text}</Notice> : null}
      <Tabs value={tab} onChange={setTab} items={[
        { id: "config", label: "支付配置" },
        { id: "codes", label: "兑换码", count: codes.length },
        { id: "plans", label: "订阅套餐", count: plans.length },
        { id: "orders", label: "充值订单", count: orders.length },
      ]} />

      {tab === "config" ? (
        <Card className="mt-4 p-5">
          {!compliance ? (
            <Notice tone="warning" className="mb-4">
              支付、兑换码、订阅功能需管理员先确认 New API 合规声明后才能启用。
              <Button size="sm" className="ml-3" onClick={() => run(() => post("/api/option/payment_compliance", { confirmed: true }), "已确认合规声明")}>确认并启用</Button>
            </Notice>
          ) : <Notice tone="success" className="mb-4">合规声明已确认，支付功能已启用。</Notice>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="易支付网关地址" hint="例：https://pay.example.com"><Input value={cfg.PayAddress} onChange={(e) => setCfg({ ...cfg, PayAddress: e.target.value })} /></Field>
            <Field label="商户号（PID）"><Input value={cfg.EpayId} onChange={(e) => setCfg({ ...cfg, EpayId: e.target.value })} /></Field>
            <Field label="商户密钥" hint="只写不读，留空不修改"><Input type="password" autoComplete="new-password" value={epayKey} onChange={(e) => setEpayKey(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="回调地址（服务器地址）" hint="支付平台回调到 {地址}/api/user/epay/notify"><Input value={cfg.ServerAddress} onChange={(e) => setCfg({ ...cfg, ServerAddress: e.target.value })} /></Field>
            <Field label="充值单价（元 / 单位）" hint={`1 单位 = ${money(st.usdRate)} 额度`}><Input type="number" value={cfg.Price} onChange={(e) => setCfg({ ...cfg, Price: e.target.value })} /></Field>
            <Field label="最低充值（单位）"><Input type="number" value={cfg.MinTopUp} onChange={(e) => setCfg({ ...cfg, MinTopUp: e.target.value })} /></Field>
            <Field label="充值档位（单位，JSON 数组）" className="md:col-span-2"><Input value={cfg["payment_setting.amount_options"]} onChange={(e) => setCfg({ ...cfg, "payment_setting.amount_options": e.target.value })} /></Field>
          </div>
          <Button className="mt-5" onClick={saveCfg}>保存配置</Button>
        </Card>
      ) : null}

      {tab === "codes" ? (
        <Card className="mt-4 p-5">
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <Field label="名称"><Input value={gen.name} onChange={(e) => setGen({ ...gen, name: e.target.value })} /></Field>
            <Field label="数量"><Input type="number" value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) || 1 })} /></Field>
            <Field label="面额（元）"><Input type="number" value={gen.yuan} onChange={(e) => setGen({ ...gen, yuan: Number(e.target.value) || 0 })} /></Field>
            <Button onClick={() => run(async () => { setMade(await post<string[]>("/api/redemption/", { name: gen.name, count: gen.count, quota: yuanQuota(gen.yuan, st) })); }, "兑换码已生成")}>生成</Button>
          </div>
          <div className="mt-5 divide-y divide-background-200 text-sm">
            {codes.map((c: any) => (
              <div key={c.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center gap-3 py-2.5">
                <span className="text-foreground-900">{c.name}</span>
                <span className="font-mono text-xs text-foreground-500">{c.status === 1 ? `${c.key.slice(0, 6)}…${c.key.slice(-4)}` : c.key.slice(0, 6) + "…"}</span>
                <span>{money(quotaYuan(c.quota, st))}</span>
                <span className="text-xs text-foreground-500">{c.status === 3 ? `用户 #${c.used_user_id} 于 ${ts(c.redeemed_time)}` : ts(c.created_time)}</span>
                <Badge tone={c.status === 1 ? "success" : "neutral"}>{({ 1: "未使用", 2: "已禁用", 3: "已使用" } as any)[c.status] || c.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "plans" ? (
        <div className="mt-4">
          <Button onClick={() => setEdit({ ...emptyPlan })}>新增套餐</Button>
          <Notice tone="primary" className="mt-3">易支付按「价格」直接以人民币收款；默认关闭余额购买（New API 余额购买按美元口径换算，与人民币价格不一致）。</Notice>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map(({ plan }: any) => (
              <Card key={plan.id} className="p-5">
                <div className="flex items-center justify-between"><h3 className="font-semibold">{plan.title}</h3><Badge tone={plan.enabled ? "success" : "neutral"}>{plan.enabled ? "上架" : "下架"}</Badge></div>
                <p className="mt-1 text-xs text-foreground-500">{plan.subtitle}</p>
                <p className="mt-3 text-2xl font-semibold">{money(plan.price_amount)}</p>
                <p className="mt-1 text-xs text-foreground-500">{plan.duration_value} {plan.duration_unit} · 额度 {money(quotaYuan(plan.total_amount, st))} · 重置 {plan.quota_reset_period}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit({ ...plan, total_amount_yuan: Number(quotaYuan(plan.total_amount, st).toFixed(2)) })}>编辑</Button>
                  <Button size="sm" variant="ghost" onClick={() => run(() => patch(`/api/subscription/admin/plans/${plan.id}`, { enabled: !plan.enabled }), plan.enabled ? "已下架" : "已上架")}>{plan.enabled ? "下架" : "上架"}</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "orders" ? (
        <Card className="mt-4 p-5">
          <div className="divide-y divide-background-200 text-sm">
            {orders.length === 0 ? <p className="py-6 text-center text-foreground-500">暂无订单</p> : null}
            {orders.map((o: any) => (
              <div key={o.id} className="grid grid-cols-[1.6fr_0.6fr_1fr_1fr_1fr_auto] items-center gap-3 py-2.5">
                <span className="truncate font-mono text-xs">{o.trade_no}</span>
                <span>#{o.user_id}</span>
                <span>{o.trade_no.startsWith("SUB") ? "订阅" : `${o.amount} 单位`} · {money(o.money)}</span>
                <span className="text-xs text-foreground-500">{o.payment_method}</span>
                <span className="text-xs text-foreground-500">{ts(o.create_time)}</span>
                {o.status === "pending" && !o.trade_no.startsWith("SUB") ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => post("/api/user/topup/complete", { trade_no: o.trade_no }), "已人工补单")}>人工补单</Button>
                ) : <Badge tone={o.status === "success" ? "success" : o.status === "pending" ? "warning" : "neutral"}>{({ success: "已到账", pending: "待支付", failed: "失败", expired: "已过期" } as any)[o.status] || o.status}</Badge>}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal open={made.length > 0} onClose={() => setMade([])} title="兑换码已生成" description="请妥善保存，发放给用户后可在「个人充值」兑换。">
        <code className="block max-h-60 overflow-auto whitespace-pre rounded-xl bg-background-100 p-3 text-xs">{made.join("\n")}</code>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "编辑套餐" : "新增套餐"} footer={<Button onClick={savePlan}>保存</Button>}>
        {edit ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="名称" className="col-span-2"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="副标题" className="col-span-2"><Input value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
            <Field label="价格（元）"><Input type="number" value={edit.price_amount} onChange={(e) => setEdit({ ...edit, price_amount: e.target.value })} /></Field>
            <Field label="包含额度（元，0 不限）"><Input type="number" value={edit.total_amount_yuan} onChange={(e) => setEdit({ ...edit, total_amount_yuan: e.target.value })} /></Field>
            <Field label="有效期数值"><Input type="number" value={edit.duration_value} onChange={(e) => setEdit({ ...edit, duration_value: e.target.value })} /></Field>
            <Field label="有效期单位"><Select value={edit.duration_unit} onChange={(e) => setEdit({ ...edit, duration_unit: e.target.value })}><option value="day">天</option><option value="month">月</option><option value="year">年</option></Select></Field>
            <Field label="额度重置"><Select value={edit.quota_reset_period} onChange={(e) => setEdit({ ...edit, quota_reset_period: e.target.value })}><option value="never">不重置</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></Select></Field>
            <Field label="每人限购（0 不限）"><Input type="number" value={edit.max_purchase_per_user} onChange={(e) => setEdit({ ...edit, max_purchase_per_user: Number(e.target.value) || 0 })} /></Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
