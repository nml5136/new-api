// 个人充值（/app/wallet）：个人额度余额、易支付在线充值、兑换码、订阅套餐、个人 API 令牌、充值记录。
// 全部复用 New API 原生接口；个人额度与企业钱包相互独立（企业钱包仍走「账单充值」的对公转账）。
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Tabs } from "@/components/base/ui";
import { get, post, put, raw } from "@/lib/api";
import { cx, money } from "@/lib/format";
import { listPage, payStatus, PREF_LABEL, quotaYuan, submitPayForm, type PayStatus, durationText, resetText } from "@/lib/newapi-pay";

type Tab = "topup" | "plans" | "tokens" | "records";
const ts = (t?: number) => (t ? new Date(t * 1000).toLocaleString("zh-CN", { hour12: false }) : "—");
const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = { success: "success", pending: "warning", failed: "danger", expired: "neutral" };
const statusText: Record<string, string> = { success: "已到账", pending: "待支付", failed: "失败", expired: "已过期" };

// 发起易支付下单：后端返回已签名参数与收银台地址，前端表单跳转
async function startPay(path: string, body: unknown) {
  const { data } = await raw("POST", path, body);
  if (data?.message !== "success" || !data?.url) throw new Error(typeof data?.data === "string" ? data.data : data?.message || "下单失败");
  submitPayForm(data.url, data.data);
}

export default function WalletPage() {
  const [tab, setTab] = useState<Tab>("topup");
  const [st, setSt] = useState<PayStatus | null>(null);
  const [self, setSelf] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);
  const [subs, setSubs] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [amount, setAmount] = useState(10);
  const [method, setMethod] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState("");

  const load = useCallback(async () => {
    const s = await payStatus();
    setSt(s);
    const [me, ti, sb, pl, rc, tk] = await Promise.all([
      get<any>("/api/user/self"),
      get<any>("/api/user/topup/info"),
      get<any>("/api/subscription/self").catch(() => null),
      get<any[]>("/api/subscription/plans").catch(() => []),
      listPage("/api/user/topup/self?p=1&page_size=20").catch(() => []),
      listPage("/api/token/?p=1&size=20").catch(() => []),
    ]);
    setSelf(me);
    setInfo(ti);
    setSubs(sb);
    setPlans(pl || []);
    setRecords(rc);
    setTokens(tk);
    if (ti?.pay_methods?.length) setMethod((m) => m || ti.pay_methods[0].type);
    if (ti?.amount_options?.length) setAmount((a) => (ti.amount_options.includes(a) ? a : ti.amount_options[0]));
  }, []);

  useEffect(() => {
    load().catch((e) => setMsg({ tone: "danger", text: (e as Error).message }));
    // 支付网关跳回后刷新一次，显示到账结果
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (!st || !self) return <div className="p-6 text-sm text-foreground-500">正在加载…</div>;
  const balance = quotaYuan(self.quota || 0, st);
  const used = quotaYuan(self.used_quota || 0, st);
  const active = (subs?.subscriptions || []).filter((x: any) => x.subscription?.status === "active");
  const subRemain = active.reduce((n: number, x: any) => n + Math.max(0, (x.subscription.amount_total || 0) - (x.subscription.amount_used || 0)), 0);
  const online = !!info?.enable_online_topup;
  const payNow = amount * st.price * (info?.discount?.[amount] || 1);

  return (
    <div>
      <PageHeader
        eyebrow="个人充值"
        title="个人额度与订阅"
        description="个人额度用于你自己的 New API 令牌调用（/v1 接口），与企业钱包相互独立。企业对公充值请到「账单充值」。"
      />
      {msg ? <Notice tone={msg.tone} className="mb-4">{msg.text}</Notice> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-foreground-500">个人余额</p>
          <p className="mt-2 text-3xl font-semibold text-foreground-900">{money(balance)}</p>
          <p className="mt-1 text-xs text-foreground-500">累计消费 {money(used)} · 分组 {self.group}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-foreground-500">订阅剩余额度</p>
          <p className="mt-2 text-3xl font-semibold text-foreground-900">{money(quotaYuan(subRemain, st))}</p>
          <p className="mt-1 text-xs text-foreground-500">{active.length ? `生效中 ${active.length} 个套餐，最晚到期 ${ts(Math.max(...active.map((x: any) => x.subscription.end_time)))}` : "暂无生效订阅"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-foreground-500">扣费顺序</p>
          <Select
            className="mt-2"
            value={subs?.billing_preference || "subscription_first"}
            onChange={(e) => run(async () => { await put("/api/subscription/self/preference", { billing_preference: e.target.value }); await load(); })}
          >
            {Object.entries(PREF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <p className="mt-1 text-xs text-foreground-500">余额和订阅都不足时调用会被拒绝，请先充值。</p>
        </Card>
      </div>

      <Tabs
        className="mt-6"
        value={tab}
        onChange={setTab}
        items={[
          { id: "topup", label: "充值" },
          { id: "plans", label: "订阅套餐", count: plans.length },
          { id: "tokens", label: "个人令牌", count: tokens.length },
          { id: "records", label: "充值记录", count: records.length },
        ]}
      />

      {tab === "topup" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground-900">在线充值</h3>
            {!online ? (
              <Notice tone="warning" className="mt-3">管理员尚未开通在线支付，可使用兑换码充值。</Notice>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(info.amount_options || []).map((a: number) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(a)}
                      className={cx("rounded-xl border px-2 py-3 text-center transition-colors", a === amount ? "border-primary-500 bg-primary-50 text-primary-700" : "border-background-300 hover:border-primary-300")}
                    >
                      <span className="block text-sm font-semibold">{money(a * st.usdRate, 0)}</span>
                      <span className="block text-[11px] text-foreground-500">{a} 单位</span>
                    </button>
                  ))}
                </div>
                <Field label="自定义单位数" hint={`最少 ${info.min_topup} 单位，1 单位 = ${money(st.usdRate)} 额度`} className="mt-4">
                  <Input type="number" min={info.min_topup} value={amount} onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                </Field>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(info.pay_methods || []).map((m: any) => (
                    <button key={m.type} type="button" onClick={() => setMethod(m.type)}
                      className={cx("rounded-xl border px-4 py-2 text-sm", m.type === method ? "border-primary-500 bg-primary-50 text-primary-700" : "border-background-300")}>
                      {m.name}
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-xl bg-background-100 px-4 py-3">
                  <span className="text-sm text-foreground-700">到账额度 {money(amount * st.usdRate)}</span>
                  <span className="text-lg font-semibold text-foreground-900">应付 {money(payNow)}</span>
                </div>
                <Button className="mt-4 w-full" disabled={busy || amount < (info.min_topup || 1) || !method}
                  onClick={() => run(() => startPay("/api/user/pay", { amount, payment_method: method }))}>
                  去支付
                </Button>
                <p className="mt-2 text-[11px] text-foreground-500">支付成功后由支付平台回调入账，同一订单重复回调只入账一次。</p>
              </>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground-900">兑换码</h3>
            <Field label="输入兑换码" className="mt-4">
              <Input value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="32 位兑换码" />
            </Field>
            <Button className="mt-4 w-full" variant="outline" disabled={busy || !code || !info?.enable_redemption}
              onClick={() => run(async () => {
                const q = await post<number>("/api/user/topup", { key: code });
                setCode("");
                setMsg({ tone: "success", text: `兑换成功，到账 ${money(quotaYuan(q, st))}` });
                await load();
              })}>
              兑换
            </Button>
          </Card>
        </div>
      ) : null}

      {tab === "plans" ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.length === 0 ? <Card className="p-6 text-sm text-foreground-500">暂无可购买的套餐</Card> : null}
          {plans.map(({ plan }: any) => (
            <Card key={plan.id} className="flex flex-col p-5">
              <h3 className="text-base font-semibold text-foreground-900">{plan.title}</h3>
              <p className="mt-1 text-xs text-foreground-500">{plan.subtitle}</p>
              <p className="mt-4 text-3xl font-semibold text-foreground-900">{money(plan.price_amount)}</p>
              <ul className="mt-3 space-y-1 text-xs text-foreground-700">
                <li>有效期：{durationText(plan.duration_value, plan.duration_unit)}</li>
                <li>包含额度：{plan.total_amount ? money(quotaYuan(plan.total_amount, st)) : "不限"}</li>
                <li>额度重置：{resetText(plan.quota_reset_period)}</li>
              </ul>
              <div className="mt-auto flex gap-2 pt-5">
                <Button className="flex-1" disabled={busy || !online || !method}
                  onClick={() => run(() => startPay("/api/subscription/epay/pay", { plan_id: plan.id, payment_method: method }))}>
                  在线购买
                </Button>
                {plan.allow_balance_pay ? (
                  <Button variant="outline" disabled={busy}
                    onClick={() => run(async () => { await post("/api/subscription/balance/pay", { plan_id: plan.id }); setMsg({ tone: "success", text: "已用余额购买" }); await load(); })}>
                    余额购买
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "tokens" ? (
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-700">个人令牌按个人额度/订阅扣费，调用地址 <code>{location.origin}/v1/chat/completions</code></p>
            <Button size="sm" disabled={busy}
              onClick={() => run(async () => {
                await post("/api/token/", { name: `个人令牌-${Date.now() % 100000}`, unlimited_quota: true, expired_time: -1 });
                const list = await listPage("/api/token/?p=1&size=20");
                const k = await post<any>(`/api/token/${list[0].id}/key`);
                setNewKey(String(k?.key || k).startsWith("sk-") ? String(k?.key || k) : `sk-${k?.key || k}`);
                setTokens(list);
              })}>
              新建令牌
            </Button>
          </div>
          <div className="mt-4 divide-y divide-background-200 text-sm">
            {tokens.length === 0 ? <p className="py-6 text-center text-foreground-500">暂无令牌</p> : null}
            {tokens.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-foreground-900">{t.name}</span>
                <span className="text-foreground-500">sk-{t.key}</span>
                <span className="text-foreground-500">已用 {money(quotaYuan(t.used_quota || 0, st))}</span>
                <Badge tone={t.status === 1 ? "success" : "neutral"}>{t.status === 1 ? "启用" : "停用"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {tab === "records" ? (
        <Card className="mt-4 p-5">
          <div className="divide-y divide-background-200 text-sm">
            {records.length === 0 ? <p className="py-6 text-center text-foreground-500">暂无充值记录</p> : null}
            {records.map((r: any) => (
              <div key={r.id} className="grid grid-cols-[1.6fr_1fr_1fr_1fr_auto] items-center gap-3 py-3">
                <span className="truncate font-mono text-xs text-foreground-700">{r.trade_no}</span>
                <span className="text-foreground-700">{r.trade_no.startsWith("SUB") ? "订阅购买" : `充值 ${r.amount} 单位`}</span>
                <span className="text-foreground-900">实付 {money(r.money)}</span>
                <span className="text-xs text-foreground-500">{ts(r.create_time)}</span>
                <Badge tone={statusTone[r.status] || "neutral"}>{statusText[r.status] || r.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal open={!!newKey} onClose={() => setNewKey("")} title="令牌已创建" description="完整令牌只显示这一次，请立即复制保存。">
        <code className="block break-all rounded-xl bg-background-100 p-3 text-xs">{newKey}</code>
      </Modal>
    </div>
  );
}
