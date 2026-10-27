import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, ProgressBar, Select } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { cx, money } from "@/lib/format";

export default function BudgetsPage() {
  const { monthBudget, monthSpend, reserved, balance, singleCap, projects, updateBudget, updateProject } = useDemo();
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [formBudget, setFormBudget] = useState(String(monthBudget));
  const [formCap, setFormCap] = useState(String(singleCap));
  const [warn, setWarn] = useState("80");
  const [receiver, setReceiver] = useState("企业管理员 · 林晨");
  const [projectBudget, setProjectBudget] = useState("");
  const [saved, setSaved] = useState("");

  const remaining = monthBudget - monthSpend - reserved;
  const usage = monthBudget ? Math.round((monthSpend / monthBudget) * 100) : 0;
  const activeProject = projects.find((p) => p.id === projectId);

  const tone = (value: number) => (value >= 100 ? "danger" : value >= 95 ? "danger" : value >= 80 ? "warning" : "primary");

  const saveEnterprise = async () => {
    setEnterpriseOpen(false);
    try {
      await updateBudget({ monthBudget: Number(formBudget) || monthBudget, singleCap: Number(formCap) || singleCap });
      setSaved("企业预算与单次上限已更新");
    } catch (e) { setSaved(`保存失败：${(e as Error).message}`); }
  };

  const saveProject = async () => {
    if (!activeProject) return;
    setProjectId(null);
    try {
      await updateProject(activeProject.id, { monthlyBudget: Number(projectBudget) || activeProject.monthlyBudget });
      setSaved(`项目「${activeProject.name}」的月预算已更新`);
    } catch (e) { setSaved(`保存失败：${(e as Error).message}`); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="预算"
        title="预算不是余额，而是消费上限"
        description="项目预算是消费限制，资金来自企业统一钱包。预算不足与余额不足采用不同提示与恢复路径。"
        actions={
          <Button variant="outline" onClick={() => { setFormBudget(String(monthBudget)); setFormCap(String(singleCap)); setEnterpriseOpen(true); }}>
            <i className="ri-settings-3-line" />
            企业预算设置
          </Button>
        }
      />

      {saved ? (
        <Notice tone="success" icon="ri-check-line" className="mb-3">
          {saved}
        </Notice>
      ) : null}

      <Card className="p-0">
        <div className="grid grid-cols-2 divide-background-100 lg:grid-cols-4 lg:divide-x">
          {[
            { label: "企业月预算", value: money(monthBudget), note: "到期后自动重置" },
            { label: "本月消费", value: money(monthSpend), note: `已使用 ${usage}%` },
            { label: "在途预留", value: money(reserved), note: "生成中任务的预扣" },
            { label: "剩余可用预算", value: money(Math.max(0, remaining)), note: "预算 - 消费 - 预留" },
          ].map((item, i) => (
            <div key={item.label} className={cx("p-4 md:p-5", i < 2 ? "border-b border-background-100 lg:border-b-0" : "")}>
              <p className="text-[10.5px] text-foreground-500">{item.label}</p>
              <p className="tnum mt-1.5 font-heading text-xl font-semibold text-foreground-950 md:text-2xl">{item.value}</p>
              <p className="mt-1 text-[9.5px] text-foreground-400">{item.note}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-background-100 px-4 py-3.5 md:px-5">
          <ProgressBar value={usage} tone={tone(usage)} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex flex-wrap items-center gap-3 text-foreground-500">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-foreground-400" />正常</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" />80% 警告</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-danger" />95% 强警告</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-danger" />100% 停止新请求</span>
            </div>
            <span className="text-foreground-400">阈值用数值与文案表达，不只依赖颜色</span>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground-950">项目预算分布</h2>
              <p className="mt-0.5 text-[10.5px] text-foreground-500">点击项目修改月预算，保存后立即影响后续任务的预算校验。</p>
            </div>
            <Link to="/app/projects" className="text-[11px] text-primary-600 hover:text-primary-700">管理项目</Link>
          </div>

          <div className="space-y-2">
            {projects.map((project) => {
              const percent = Math.round((project.spent / project.monthlyBudget) * 100);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setProjectId(project.id);
                    setProjectBudget(String(project.monthlyBudget));
                  }}
                  className="w-full cursor-pointer rounded-xl border border-background-200 p-3.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[12.5px] font-medium text-foreground-900">{project.name}</p>
                      <Badge tone={percent >= 95 ? "danger" : percent >= 80 ? "warning" : "neutral"}>{percent}%</Badge>
                    </div>
                    <p className="tnum text-[10.5px] text-foreground-600">
                      {money(project.spent)} / {money(project.monthlyBudget)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={percent} tone={tone(percent) as "primary" | "warning" | "danger"} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-foreground-400">
                    <span>剩余 {money(Math.max(0, project.monthlyBudget - project.spent))}</span>
                    <span>{percent >= 100 ? "已停止新请求" : percent >= 80 ? "接近阈值" : "正常"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-[9.5px] leading-relaxed text-foreground-400">
            预算为 0 表示不能发起新任务。已在执行中的任务不受影响，可在项目配置中恢复额度。
          </p>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10.5px] text-foreground-500">企业钱包余额</p>
                <p className="tnum mt-1 text-lg font-semibold text-foreground-950">{money(balance)}</p>
              </div>
              <Link to="/app/billing" className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary-500 px-3 text-[11px] font-medium text-background-50 hover:bg-primary-600">
                充值
              </Link>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-foreground-500">
              余额用于实际扣费；预算只决定"最多可以花多少"。预算不足时提示调整预算，余额不足时引导充值。
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-medium text-foreground-900">三个关键区别</p>
            <div className="mt-2 space-y-2 text-[10px] leading-relaxed">
              <div className="rounded-lg bg-background-100/70 p-2.5">
                <p className="font-medium text-foreground-800">钱包余额</p>
                <p className="mt-0.5 text-foreground-500">真实可用资金，充值与消费都在这里变化。</p>
              </div>
              <div className="rounded-lg bg-background-100/70 p-2.5">
                <p className="font-medium text-foreground-800">预算限制</p>
                <p className="mt-0.5 text-foreground-500">企业月预算与项目分配，超出后拒绝新请求。</p>
              </div>
              <div className="rounded-lg bg-background-100/70 p-2.5">
                <p className="font-medium text-foreground-800">在途预留</p>
                <p className="mt-0.5 text-foreground-500">生成中任务暂时占用的额度，结算后转为消费。</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={enterpriseOpen}
        onClose={() => setEnterpriseOpen(false)}
        title="企业预算设置"
        description="仅影响之后发起的新请求，已在执行中的任务仍按原版本结算。"
        footer={
          <>
            <Button variant="outline" onClick={() => setEnterpriseOpen(false)}>取消</Button>
            <Button onClick={saveEnterprise}>保存设置</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="企业月预算（元）">
            <Input type="number" min={0} step={10} value={formBudget} onChange={(e) => setFormBudget(e.target.value)} />
          </Field>
          <Field label="默认单次上限（元）">
            <Input type="number" min={0.01} step={0.01} value={formCap} onChange={(e) => setFormCap(e.target.value)} />
          </Field>
          <Field label="预警阈值">
            <Select value={warn} onChange={(e) => setWarn(e.target.value)}>
              <option value="70">70% 提醒</option>
              <option value="80">80% 警告</option>
              <option value="95">95% 强警告</option>
            </Select>
          </Field>
          <Field label="通知接收人">
            <Select value={receiver} onChange={(e) => setReceiver(e.target.value)}>
              <option>企业管理员 · 林晨</option>
              <option>财务成员 · 何雨</option>
              <option>全部管理员</option>
            </Select>
          </Field>
        </div>
        <Notice tone="neutral" icon="ri-information-line">
          预算告警在运营后台生成，一期不发送邮件或站内信。当前阈值 {warn}%，接收人 {receiver}。
        </Notice>
      </Modal>

      <Modal
        open={Boolean(activeProject)}
        onClose={() => setProjectId(null)}
        title={`调整「${activeProject?.name ?? ""}」月预算`}
        description="项目预算只限制消费额度，不产生新的资金账户。"
        footer={
          <>
            <Button variant="outline" onClick={() => setProjectId(null)}>取消</Button>
            <Button onClick={saveProject}>保存预算</Button>
          </>
        }
      >
        <Field label="项目月预算（元）">
          <Input type="number" min={0} step={10} value={projectBudget} onChange={(e) => setProjectBudget(e.target.value)} />
        </Field>
        <div className="rounded-xl bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
          <div className="flex justify-between"><span>当前已消费</span><span className="tnum">{money(activeProject?.spent ?? 0)}</span></div>
          <div className="mt-1 flex justify-between"><span>调整后剩余</span><span className="tnum">{money(Math.max(0, (Number(projectBudget) || 0) - (activeProject?.spent ?? 0)))}</span></div>
          {(Number(projectBudget) || 0) <= (activeProject?.spent ?? 0) ? (
            <p className="mt-2 text-warning">保存后该项目将没有剩余预算，新任务会被拒绝。</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}