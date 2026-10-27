import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "@/components/feature/PublicLayout";
import { Button, Field, Input, Notice } from "@/components/base/ui";
import { cx } from "@/lib/format";
import { post } from "@/lib/api";
import { useDemo } from "@/lib/demo-store";

const stepList = ["验证邀请", "企业与管理员信息", "开通结果"];

export default function ActivatePage() {
  const [step, setStep] = useState(0);
  const { user, reload } = useDemo();
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code") || "");
  const [company, setCompany] = useState("");
  const [admin, setAdmin] = useState(user?.display_name || user?.username || "");
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [provisionNo] = useState(() => `PV-WEB-${Date.now()}`); // 重试复用同一开通业务号，保证幂等
  const [failMsg, setFailMsg] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "provisioning" | "success" | "failed">("idle");

  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("请先登录平台账号，再使用邀请码开通企业。");
      return;
    }
    if (code.trim().length < 6) {
      setError("邀请码格式不正确，请向平台运营确认。");
      return;
    }
    setError("");
    setStep(1);
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setError("请填写企业名称。");
      return;
    }
    if (!agree) {
      setError("请先阅读并同意服务协议。");
      return;
    }
    setError("");
    setStep(2);
    submitOpen();
  };

  // submitOpen 调用开通接口；未完成时可用同一业务号重试查询
  const submitOpen = () => {
    setPhase("provisioning");
    post<any>("/platform/tenant/open", { invite_code: code.trim(), name: company.trim(), agree_terms: true, provision_no: provisionNo })
      .then((t) => {
        if (t?.status === "enabled") {
          setPhase("success");
          reload();
        } else {
          setFailMsg(t?.fail_reason || `当前状态：${t?.status}`);
          setPhase("failed");
        }
      })
      .catch((e: Error) => {
        setFailMsg(e.message);
        setPhase("failed");
      });
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-background-950 pb-14 pt-[112px] text-background-50 md:pt-[128px]">
        <div className="pointer-events-none absolute inset-0 hero-glow opacity-60" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 md:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-500">邀请与企业开通</p>
          <h1 className="mt-3 font-heading text-3xl font-semibold sm:text-[40px]">三步建立企业工作区</h1>
          <p className="mt-3 max-w-[540px] text-sm leading-relaxed text-background-50/55">
            验证邀请后创建企业信息。开通完成后会准备默认项目、企业钱包与三个一期场景，不需要单独购买 Token。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-background-200 bg-background-50 p-5 shadow-soft md:p-7">
            <div className="mb-6 flex items-center gap-2">
              {stepList.map((label, i) => (
                <div key={label} className="flex flex-1 items-center gap-2">
                  <span
                    className={cx(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      i <= step ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500",
                    )}
                  >
                    {i < step ? <i className="ri-check-line" /> : i + 1}
                  </span>
                  <span className={cx("hidden text-[11px] whitespace-nowrap sm:block", i <= step ? "text-foreground-900" : "text-foreground-500")}>
                    {label}
                  </span>
                  {i < stepList.length - 1 ? <span className={cx("h-px flex-1", i < step ? "bg-primary-300" : "bg-background-200")} /> : null}
                </div>
              ))}
            </div>

            {step === 0 ? (
              <form onSubmit={verify} className="space-y-4">
                <Field label="企业邀请码" hint="由平台运营发放">
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HWAO-XXXX-XXXX" />
                </Field>
                {error ? <p className="text-[11px] text-danger">{error}</p> : null}
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  验证邀请
                  <i className="ri-arrow-right-line" />
                </Button>
              </form>
            ) : null}

            {step === 1 ? (
              <form onSubmit={create} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="企业名称">
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="企业全称" />
                  </Field>
                  <Field label="管理员姓名">
                    <Input value={admin} onChange={(e) => setAdmin(e.target.value)} placeholder="姓名" />
                  </Field>
                </div>
                <Field label="联系邮箱（可选）">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
                </Field>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-foreground-600">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  我已阅读并同意《hwao router 服务协议》与《数据处理说明》
                </label>
                <Notice tone="neutral" icon="ri-information-line">
                  开通后不要求填写任何上游网关地址或管理员密钥。所有底层凭证由平台在服务端保管。
                </Notice>
                {error ? <p className="text-[11px] text-danger">{error}</p> : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>上一步</Button>
                  <Button type="submit" size="lg">
                    提交开通
                    <i className="ri-arrow-right-line" />
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 2 ? (
              <div className="py-4">
                {phase === "provisioning" ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                      <i className="ri-loader-4-line animate-spin text-xl" />
                    </span>
                    <p className="text-sm font-medium text-foreground-950">正在准备工作区</p>
                    <p className="mt-1.5 text-xs text-foreground-600">创建默认项目、企业钱包与三个场景，约需数秒。</p>
                  </div>
                ) : phase === "success" ? (
                  <div>
                    <div className="flex flex-col items-center py-6 text-center">
                      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
                        <i className="ri-check-line text-xl" />
                      </span>
                      <p className="text-base font-semibold text-foreground-950">工作区已启用</p>
                      <p className="mt-1.5 max-w-[380px] text-xs leading-relaxed text-foreground-600">
                        {company} 的默认项目、企业钱包与三个一期场景已准备完成。可以进入工作台完成第一个任务。
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                      <Link
                        to="/app/overview"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary-500 px-5 text-xs font-medium text-background-50 transition-colors hover:bg-primary-600 whitespace-nowrap"
                      >
                        进入工作台
                      </Link>
                      <Link
                        to="/app/scenes"
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-background-300 px-5 text-xs text-foreground-800 transition-colors hover:border-primary-300 whitespace-nowrap"
                      >
                        查看场景
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col items-center py-6 text-center">
                      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
                        <i className="ri-time-line text-xl" />
                      </span>
                      <p className="text-base font-semibold text-foreground-950">开通待处理</p>
                      <p className="mt-1.5 max-w-[380px] text-xs leading-relaxed text-foreground-600">
                        {failMsg || "开通请求已提交但未收到完成回执。"} 可使用同一开通业务号重试，不会重复创建企业钱包。
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button onClick={submitOpen}>重试 / 查询开通进度</Button>
                        <Button variant="outline" onClick={() => setStep(1)}>返回修改</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-background-200 bg-background-100/60 p-5 md:p-6">
            <p className="text-xs font-medium text-foreground-900">开通后可用内容</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl bg-background-50 p-3">
                <i className="ri-folder-3-line mt-0.5 text-primary-600" />
                <div>
                  <p className="text-[11px] font-medium text-foreground-900">默认项目</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-500">含独立预算与密钥，可继续新增项目。</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-background-50 p-3">
                <i className="ri-wallet-3-line mt-0.5 text-primary-600" />
                <div>
                  <p className="text-[11px] font-medium text-foreground-900">企业钱包</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-500">全企业共用一份余额，任务与 API 调用统一扣费。</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-background-50 p-3">
                <i className="ri-layout-grid-line mt-0.5 text-primary-600" />
                <div>
                  <p className="text-[11px] font-medium text-foreground-900">三个一期场景</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-500">电商文案、办公摘要、结构化提取，均带质量检查点。</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-foreground-500">
              开通前需先登录平台账号（成员须已有 New API 账号）。还未登录？<Link to="/login?next=/activate" className="text-primary-600">去登录</Link>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}