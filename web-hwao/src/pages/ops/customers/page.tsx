import { useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Modal, Notice, PageHeader, Textarea } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { ts2str } from "@/lib/api";
import { cx, money } from "@/lib/format";

export default function OpsCustomersPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [amount, setAmount] = useState("500");
  const [reason, setReason] = useState("");
  const { opsCustomers, raw, act, notice, setNotice, error } = useOps();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRemark, setInviteRemark] = useState("");
  const [inviteDays, setInviteDays] = useState("30");
  void status;
  void setStatus;

  const customer = opsCustomers.find((c) => c.id === selected);
  // 状态以服务端为准
  const currentStatus = (_id: string, fallback: string) => fallback;
  const tenantAction = (id: string, action: "enable" | "disable" | "provision", msg: string) => void act("POST", `/tenants/${id}/${action}`, {}, msg);
  const createInvite = async () => {
    const inv = await act("POST", "/invites", { remark: inviteRemark, valid_days: Number(inviteDays) || 30 }, "邀请码已生成");
    if (inv) setNotice(`邀请码已生成：${(inv as any).code}（${inviteDays} 天内有效，仅可使用一次）`);
    setInviteOpen(false);
    setInviteRemark("");
  };

  return (
    <div>
      <PageHeader
        eyebrow="客户管理"
        title="企业开通、权限与调用状态"
        description="用户组不被呈现为企业租户本身。额度发放需要理由并写入审计，不提供无审计的余额修改。"
        actions={<Button onClick={() => setInviteOpen(true)}><i className="ri-mail-send-line" />生成邀请码</Button>}
      />
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      {notice ? <Notice tone="primary" icon="ri-information-line" className="mb-3">{notice}</Notice> : null}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1fr_0.8fr_0.9fr] gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
          <span>企业</span>
          <span>开通状态</span>
          <span>说明</span>
          <span>钱包余额</span>
          <span>预算</span>
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
                  {state === "开通中" || state === "开通失败" ? (
                    <button
                      type="button"
                      onClick={() => tenantAction(customer.id, "provision", `${customer.name} 已重试开通钱包`)}
                      className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[9.5px] text-foreground-700 hover:border-primary-300"
                    >
                      重试开通
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
              <Button size="sm" variant="outline" onClick={() => setQuotaOpen(true)}>发放额度</Button>
              {currentStatus(customer.id, customer.status) === "已暂停" ? (
                <Button size="sm" onClick={() => tenantAction(customer.id, "enable", `${customer.name} 已恢复新请求。`)}>
                  恢复新请求
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => tenantAction(customer.id, "disable", `${customer.name} 已暂停新请求，已开始的任务不中断。`)}
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
                  ["计费钱包", customer.raw.newapi_user_id ? `New API 用户 #${customer.raw.newapi_user_id}` : "未开通"],
                  ["开通时间", ts2str(customer.raw.created_at)],
                  ["并发上限", String(customer.raw.max_concurrency || "不限")],
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
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">账务摘要</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background-100/70 p-2.5">
                  <p className="text-[9px] text-foreground-500">钱包余额</p>
                  <p className="tnum mt-0.5 text-[12px] font-medium text-foreground-900">{customer.spend}</p>
                </div>
                <div className="rounded-lg bg-background-100/70 p-2.5">
                  <p className="text-[9px] text-foreground-500">预算</p>
                  <p className="mt-0.5 text-[12px] font-medium text-foreground-900">{customer.quota}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">异常记录</p>
              <div className="space-y-1.5">
                {raw.alerts.filter((a: any) => String(a.tenant_id) === customer.id && a.status !== "resolved").map((a: any) => (
                  <div key={a.id} className="rounded-lg border border-warning bg-warning-soft/50 px-2.5 py-2 text-[10px] text-foreground-700">{a.message}</div>
                ))}
                {raw.alerts.filter((a: any) => String(a.tenant_id) === customer.id && a.status !== "resolved").length === 0 ? (
                  <div className="rounded-lg border border-background-200 px-2.5 py-2 text-[10px] text-foreground-500">暂无未处理异常。</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        title="发放额度"
        description="以审批发放方式入账（不计收入），凭证与理由写入审计记录。"
        footer={
          <>
            <Button variant="outline" onClick={() => setQuotaOpen(false)}>取消</Button>
            <Button
              disabled={reason.trim().length < 4}
              onClick={async () => {
                setQuotaOpen(false);
                const fen = Math.round((Number(amount) || 0) * 100);
                await act("POST", "/recharges", { tenant_id: Number(customer?.id), amount: fen, kind: "grant", pay_channel: "manual", voucher: reason, remark: reason }, `${customer?.name} 已发放额度 ${money(fen / 100)}`);
                setReason("");
              }}
            >
              提交审批
            </Button>
          </>
        }
      >
        <Field label="发放金额（元）" hint="仅支持正数">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="调整理由" hint="至少 4 个字符">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="说明业务背景与影响范围" />
        </Field>
        <p className="text-[10px] leading-relaxed text-foreground-500">
          不提供直接改写余额的入口。所有额度变化必须有业务号、金额与原因，并可在审计中查询。
        </p>
      </Modal>
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="生成企业邀请码"
        description="邀请码仅可使用一次，客户登录后在开通页填写。"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>取消</Button>
            <Button onClick={() => void createInvite()}>生成</Button>
          </>
        }
      >
        <Field label="备注（客户名称等）">
          <Input value={inviteRemark} onChange={(e) => setInviteRemark(e.target.value)} />
        </Field>
        <Field label="有效天数">
          <Input type="number" value={inviteDays} onChange={(e) => setInviteDays(e.target.value)} />
        </Field>
        <div className="mt-2 space-y-1">
          {raw.invites.slice(0, 8).map((i: any) => (
            <div key={i.id} className="flex justify-between text-[10px] text-foreground-600">
              <span className="font-mono-ui">{i.code}</span>
              <span>{i.used_by ? `已使用 · 企业 #${i.tenant_id}` : `未使用 · ${ts2str(i.expires_at).slice(0, 10)} 到期`}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}