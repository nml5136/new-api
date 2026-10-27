import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select } from "@/components/base/ui";
import { cx } from "@/lib/format";

const sections = [
  { id: "company", label: "企业资料", icon: "ri-building-4-line" },
  { id: "profile", label: "个人资料", icon: "ri-user-3-line" },
  { id: "security", label: "安全", icon: "ri-shield-keyhole-line" },
  { id: "notify", label: "通知", icon: "ri-notification-3-line" },
  { id: "history", label: "历史与数据", icon: "ri-database-2-line" },
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>("company");
  const [notice, setNotice] = useState("");
  const [company, setCompany] = useState("星澜科技");
  const [contact, setContact] = useState("linchen@xinglan.cn");
  const [name, setName] = useState("林晨");
  const [phone, setPhone] = useState("138****2049");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [sessionList, setSessionList] = useState([
    { id: "s1", device: "macOS · Chrome", location: "上海", time: "当前会话", current: true },
    { id: "s2", device: "iOS · Safari", location: "上海", time: "2 小时前", current: false },
    { id: "s3", device: "Windows · Edge", location: "杭州", time: "昨天 21:40", current: false },
  ]);
  const [mfa, setMfa] = useState(true);
  const [retention, setRetention] = useState("30");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notify, setNotify] = useState({ budget: true, bill: true, task: false, email: true, inapp: true });

  const save = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };

  return (
    <div>
      <PageHeader
        eyebrow="设置"
        title="企业与个人设置"
        description="安全、通知与历史保存策略集中在此。"
      />

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_1fr]">
        <Card className="h-fit p-1.5">
          <div className="flex gap-1 overflow-x-auto lg:flex-col scroll-thin">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cx(
                  "flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11.5px] transition-colors",
                  section === item.id ? "bg-primary-50 font-medium text-primary-700" : "text-foreground-600 hover:bg-background-100",
                )}
              >
                <i className={cx(item.icon, "text-sm")} />
                {item.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 p-5 md:p-6">
          {section === "company" ? (
            <div className="max-w-[560px]">
              <h2 className="text-sm font-semibold text-foreground-950">企业资料</h2>
              <p className="mt-1 text-[11px] text-foreground-600">企业名称会显示在账单与发票抬头建议中。</p>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="企业名称"><Input value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
                <Field label="企业编号" hint="只读"><Input value="ENT-2026-0417" readOnly className="bg-background-100 text-foreground-500" /></Field>
                <Field label="管理员邮箱"><Input value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
                <Field label="默认币种"><Select defaultValue="CNY"><option value="CNY">人民币 CNY</option></Select></Field>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <Button onClick={() => save("企业资料已保存（一期仅保存在本页）")}>保存资料</Button>
                <span className="text-[10px] text-foreground-400">一期未接入后端，刷新后不保留</span>
              </div>
            </div>
          ) : null}

          {section === "profile" ? (
            <div className="max-w-[560px]">
              <h2 className="text-sm font-semibold text-foreground-950">个人资料</h2>
              <p className="mt-1 text-[11px] text-foreground-600">当前账号为企业管理员，可查看全部项目与密钥列表。</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-800 text-sm font-medium text-background-50">林</span>
                <div>
                  <p className="text-[12px] font-medium text-foreground-900">{name}</p>
                  <p className="text-[10px] text-foreground-500">企业管理员 · 星澜科技</p>
                </div>
                <Badge tone="primary" className="ml-auto">默认头像</Badge>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="姓名"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label="手机号"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              </div>
              <div className="mt-5">
                <Button onClick={() => save("个人资料已保存（一期仅保存在本页）")}>保存资料</Button>
              </div>
            </div>
          ) : null}

          {section === "security" ? (
            <div className="max-w-[640px]">
              <h2 className="text-sm font-semibold text-foreground-950">安全</h2>
              <p className="mt-1 text-[11px] text-foreground-600">一期请在登录页使用“忘记密码”或联系管理员修改密码。</p>

              <div className="mt-5 rounded-xl border border-background-200 p-4">
                <p className="text-[11.5px] font-medium text-foreground-900">修改密码</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="当前密码"><Input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="••••••••" /></Field>
                  <Field label="新密码" hint="至少 8 位"><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••" /></Field>
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    if (newPwd.length < 8) {
                      save("新密码至少 8 位，请重新输入。");
                      return;
                    }
                    setOldPwd("");
                    setNewPwd("");
                    save("密码已更新（一期仅保存在本页）。其他会话将需要重新登录。");
                  }}
                >
                  更新密码
                </Button>
              </div>

              <div className="mt-3 rounded-xl border border-background-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11.5px] font-medium text-foreground-900">敏感操作二次验证</p>
                    <p className="mt-0.5 text-[10px] text-foreground-500">撤销密钥、修改预算与退款申请需要二次确认。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMfa((v) => !v)}
                    aria-label="切换二次验证"
                    className={cx("relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors", mfa ? "bg-primary-500" : "bg-background-300")}
                  >
                    <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-background-50 transition-all", mfa ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-background-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11.5px] font-medium text-foreground-900">登录会话</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionList((prev) => prev.filter((s) => s.current));
                      save("已撤销其他所有会话（一期仅保存在本页）。");
                    }}
                    className="cursor-pointer text-[10.5px] text-danger hover:underline"
                  >
                    撤销其他会话
                  </button>
                </div>
                <div className="mt-2 divide-y divide-background-100">
                  {sessionList.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="text-[10.5px] text-foreground-800">{s.device}</p>
                        <p className="text-[9.5px] text-foreground-400">{s.location} · {s.time}</p>
                      </div>
                      {s.current ? (
                        <Badge tone="success">当前</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionList((prev) => prev.filter((x) => x.id !== s.id));
                            save("该会话已撤销（一期仅保存在本页）。");
                          }}
                          className="cursor-pointer text-[10px] text-foreground-500 hover:text-danger"
                        >
                          撤销
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Notice tone="neutral" icon="ri-lock-line" className="mt-3">
                上游网关地址与管理密钥由平台统一管理，客户侧无需配置。
              </Notice>
            </div>
          ) : null}

          {section === "notify" ? (
            <div className="max-w-[560px]">
              <h2 className="text-sm font-semibold text-foreground-950">通知</h2>
              <p className="mt-1 text-[11px] text-foreground-600">选择需要接收的通知类型与方式，一期不发送消息通知。</p>
              <div className="mt-5 space-y-2">
                {[
                  { key: "budget" as const, label: "预算预警", desc: "达到 80% / 95% 阈值时提醒" },
                  { key: "bill" as const, label: "账单异常", desc: "支付回调延迟、费用待核对" },
                  { key: "task" as const, label: "任务中断", desc: "流式中断或执行失败" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-background-200 px-3.5 py-3">
                    <div>
                      <p className="text-[11.5px] font-medium text-foreground-900">{item.label}</p>
                      <p className="mt-0.5 text-[10px] text-foreground-500">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notify[item.key]}
                      onChange={(e) => setNotify((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                      className="h-4 w-4 cursor-pointer"
                      style={{ accentColor: "oklch(var(--primary-500))" }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-background-200 px-3 py-2.5 text-[11px] text-foreground-700">
                  <input type="checkbox" checked={notify.email} onChange={(e) => setNotify((prev) => ({ ...prev, email: e.target.checked }))} className="h-3.5 w-3.5 cursor-pointer" style={{ accentColor: "oklch(var(--primary-500))" }} />
                  邮件通知
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-background-200 px-3 py-2.5 text-[11px] text-foreground-700">
                  <input type="checkbox" checked={notify.inapp} onChange={(e) => setNotify((prev) => ({ ...prev, inapp: e.target.checked }))} className="h-3.5 w-3.5 cursor-pointer" style={{ accentColor: "oklch(var(--primary-500))" }} />
                  站内通知
                </label>
              </div>
              <Button className="mt-4" onClick={() => save("通知设置已保存（一期仅保存在本页）")}>保存通知设置</Button>
            </div>
          ) : null}

          {section === "history" ? (
            <div className="max-w-[620px]">
              <h2 className="text-sm font-semibold text-foreground-950">历史与数据</h2>
              <p className="mt-1 text-[11px] text-foreground-600">说明网页正文保存策略。API 默认不长期保存正文，以下设置一期仅为界面占位。</p>

              <div className="mt-5 space-y-2">
                {[
                  { id: "7", label: "保存 7 天", desc: "适合对内容留存敏感的企业" },
                  { id: "30", label: "保存 30 天", desc: "默认，可在记录中查看任务内容" },
                  { id: "0", label: "不保存正文", desc: "仅保留用量、费用与状态" },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={cx(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 transition-colors",
                      retention === item.id ? "border-primary-300 bg-primary-50/40" : "border-background-200",
                    )}
                  >
                    <input
                      type="radio"
                      name="retention"
                      checked={retention === item.id}
                      onChange={() => setRetention(item.id)}
                      className="mt-0.5 h-3.5 w-3.5 cursor-pointer"
                      style={{ accentColor: "oklch(var(--primary-500))" }}
                    />
                    <span>
                      <span className="block text-[11.5px] font-medium text-foreground-900">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] text-foreground-500">{item.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => save(`历史保存策略已更新为${retention === "0" ? "不保存正文" : `保存 ${retention} 天`}（一期仅保存在本页）`)}>保存策略</Button>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>删除历史正文</Button>
              </div>

              <Notice tone="neutral" icon="ri-information-line" className="mt-4">
                删除历史正文不会删除依法或依约需保留的账务、退款与安全审计记录。删除操作会记录在审计日志中。
              </Notice>
              <p className="mt-3 text-[10px] text-foreground-400">
                需要查看接口侧的保存说明？参见 <Link to="/docs" className="text-primary-600">开发文档</Link>。
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="删除历史正文"
        description="此操作不可撤销，但不会影响账务与审计记录。"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(false);
                save("历史正文删除任务已提交（一期仅保存在本页）。账务与审计记录保留。");
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          将删除当前企业所有超出保存策略的任务正文。调用记录、费用、退款与安全审计记录会继续保留，用于对账与合规。
        </div>
      </Modal>
    </div>
  );
}