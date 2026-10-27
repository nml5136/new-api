import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Drawer, Field, Input, PageHeader, ProgressBar, Tabs } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { cx, money, recordStatusMeta, sceneLabel } from "@/lib/format";

type Tab = "overview" | "config" | "members" | "keys" | "records";

export default function ProjectsPage() {
  const { projects, keys, records, members, currentProjectId, setCurrentProject, createProject, updateProject, singleCap } = useDemo();
  const [selected, setSelected] = useState(currentProjectId);
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState("200");
  const [editOpen, setEditOpen] = useState(false);
  const [editBudget, setEditBudget] = useState("");

  const project = projects.find((p) => p.id === selected) ?? projects[0];
  const projectKeys = keys.filter((k) => k.projectId === project?.id);
  const projectRecords = records.filter((r) => r.projectId === project?.id);
  const projectMembers = members.filter((m) => m.projects.includes(project?.name ?? ""));
  const percent = project ? Math.round((project.spent / project.monthlyBudget) * 100) : 0;

  const submit = async () => {
    if (!name.trim()) return;
    const created = await createProject({ name, description: desc || "未填写描述", budget: Number(budget) || 100 });
    setSelected(created.id);
    setName("");
    setDesc("");
    setBudget("200");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="项目"
        title="项目是用量与权限的边界"
        description="项目预算是消费限制，资金来自企业统一钱包。项目不设充值入口，也不产生独立余额。"
        actions={
          <Button onClick={() => setOpen(true)}>
            <i className="ri-add-line" />
            新建项目
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-2">
          {projects.map((item) => {
            const pct = Math.round((item.spent / item.monthlyBudget) * 100);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelected(item.id);
                  setTab("overview");
                }}
                className={cx(
                  "w-full cursor-pointer rounded-xl border p-3.5 text-left transition-all",
                  selected === item.id ? "border-primary-300 bg-primary-50/40" : "border-background-200 bg-background-50 hover:border-background-300",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium text-foreground-950">{item.name}</span>
                    {item.id === currentProjectId ? <Badge tone="primary">当前项目</Badge> : null}
                  </div>
                  <Badge tone={item.status === "active" ? "success" : "warning"}>{item.status === "active" ? "启用" : "暂停"}</Badge>
                </div>
                <p className="mt-1 line-clamp-1 text-[10.5px] text-foreground-500">{item.description}</p>
                <div className="mt-2.5">
                  <ProgressBar value={pct} tone={pct >= 80 ? "warning" : "primary"} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9.5px] text-foreground-400">
                  <span className="tnum">{money(item.spent)} / {money(item.monthlyBudget)}</span>
                  <span>{item.keys} 个密钥</span>
                </div>
              </button>
            );
          })}
          <p className="px-1 text-[9.5px] leading-relaxed text-foreground-400">
            新建项目后，顶部项目选择器会立即更新，任务默认可归入该项目。
          </p>
        </div>

        {project ? (
          <Card className="min-w-0 overflow-hidden">
            <div className="border-b border-background-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground-950">{project.name}</h2>
                    <Badge tone="neutral">负责人 {project.owner}</Badge>
                  </div>
                  <p className="mt-1 max-w-[520px] text-xs leading-relaxed text-foreground-600">{project.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {project.scenes.map((s) => (
                      <span key={s} className="rounded-full bg-background-100 px-2 py-0.5 text-[10px] text-foreground-600">{sceneLabel(s)}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.id !== currentProjectId ? (
                    <Button size="sm" variant="outline" onClick={() => setCurrentProject(project.id)}>设为当前项目</Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditBudget(String(project.monthlyBudget));
                      setEditOpen(true);
                    }}
                  >
                    编辑项目
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-b border-background-200 px-4 py-3">
              <Tabs
                items={[
                  { id: "overview", label: "概览" },
                  { id: "config", label: "使用配置" },
                  { id: "members", label: "成员", count: projectMembers.length },
                  { id: "keys", label: "关联密钥", count: projectKeys.length },
                  { id: "records", label: "近期调用", count: projectRecords.length },
                ]}
                value={tab}
                onChange={setTab}
              />
            </div>

            <div className="p-5">
              {tab === "overview" ? (
                <div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "月预算", value: money(project.monthlyBudget) },
                      { label: "本月已消费", value: money(project.spent) },
                      { label: "活跃密钥", value: `${projectKeys.filter((k) => k.status === "active").length} 个` },
                      { label: "使用率", value: `${percent}%` },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-background-100/60 p-3">
                        <p className="text-[10px] text-foreground-500">{item.label}</p>
                        <p className="tnum mt-1 text-sm font-semibold text-foreground-950">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={percent} tone={percent >= 80 ? "warning" : "primary"} />
                    <p className="mt-2 text-[10px] text-foreground-500">剩余可用 {money(Math.max(0, project.monthlyBudget - project.spent))} · 单次上限 {money(singleCap)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Link to="/app/workspace" className="rounded-xl border border-background-200 p-3.5 transition-colors hover:border-primary-300">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground-900"><i className="ri-sparkling-2-line text-primary-600" />发起任务</p>
                      <p className="mt-1 text-[10px] text-foreground-500">使用该项目预算与默认场景创建任务。</p>
                    </Link>
                    <Link to="/app/keys" className="rounded-xl border border-background-200 p-3.5 transition-colors hover:border-primary-300">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground-900"><i className="ri-key-2-line text-primary-600" />管理密钥</p>
                      <p className="mt-1 text-[10px] text-foreground-500">为服务端接入创建或轮换平台密钥。</p>
                    </Link>
                  </div>
                </div>
              ) : null}

              {tab === "config" ? (
                <div className="space-y-1">
                  {[
                    ["允许场景", project.scenes.map(sceneLabel).join("、")],
                    ["允许模型", "按场景策略可售模型"],
                    ["默认路由", "场景选型 + 会话保持"],
                    ["同模型渠道兜底", "已启用（主通道限流时切换备用通道）"],
                    ["跨模型自动兜底", "未启用（需授权与计费验证）"],
                    ["并发限制", "一期未单独限制"],
                    ["单次费用上限", money(singleCap)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-background-100 py-2.5 last:border-0">
                      <span className="text-[10.5px] text-foreground-500">{label}</span>
                      <span className="text-right text-[11px] text-foreground-900">{value}</span>
                    </div>
                  ))}
                  <p className="pt-2 text-[9.5px] leading-relaxed text-foreground-400">
                    底层上游密钥与多通道凭据在 New API 管理，不在本项目内维护。
                  </p>
                </div>
              ) : null}

              {tab === "members" ? (
                <div className="space-y-2">
                  {projectMembers.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-foreground-500">该项目暂无直接成员，管理员默认可访问全部项目。</p>
                  ) : (
                    projectMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg border border-background-200 px-3 py-2.5">
                        <div>
                          <p className="text-[11.5px] font-medium text-foreground-900">{member.name}</p>
                          <p className="text-[9.5px] text-foreground-500">{member.email}</p>
                        </div>
                        <Badge tone={member.role === "财务成员" ? "warning" : "neutral"}>{member.role}</Badge>
                      </div>
                    ))
                  )}
                  <Link to="/app/members" className="inline-flex items-center gap-1 pt-1 text-[10.5px] text-primary-600 hover:text-primary-700">
                    管理成员与权限 <i className="ri-arrow-right-line" />
                  </Link>
                </div>
              ) : null}

              {tab === "keys" ? (
                <div className="space-y-2">
                  {projectKeys.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-foreground-500">该项目还没有密钥。</p>
                  ) : (
                    projectKeys.map((key) => (
                      <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-background-200 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium text-foreground-900">{key.name}</p>
                          <p className="truncate font-mono-ui text-[9.5px] text-foreground-400">{key.masked}</p>
                        </div>
                        <Badge tone={key.status === "active" ? "success" : key.status === "disabled" ? "warning" : "danger"}>
                          {key.status === "active" ? "启用中" : key.status === "disabled" ? "已停用" : "已撤销"}
                        </Badge>
                      </div>
                    ))
                  )}
                  <Link to="/app/keys" className="inline-flex items-center gap-1 pt-1 text-[10.5px] text-primary-600 hover:text-primary-700">
                    前往 API Key 管理 <i className="ri-arrow-right-line" />
                  </Link>
                </div>
              ) : null}

              {tab === "records" ? (
                <div className="space-y-2">
                  {projectRecords.slice(0, 5).map((record) => (
                    <Link key={record.id} to={`/app/requests?focus=${record.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-background-200 px-3 py-2.5 transition-colors hover:bg-background-100/70">
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] text-foreground-900">{record.title}</p>
                        <p className="mt-0.5 text-[9.5px] text-foreground-500">{record.time} · {record.model}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={(recordStatusMeta[record.status] ?? recordStatusMeta.completed).tone}>
                          {(recordStatusMeta[record.status] ?? recordStatusMeta.completed).label}
                        </Badge>
                        <span className="tnum text-[11px] text-foreground-900">{record.cost === null ? "待核对" : money(record.cost)}</span>
                      </div>
                    </Link>
                  ))}
                  {projectRecords.length === 0 ? <p className="py-6 text-center text-[11px] text-foreground-500">该项目还没有调用记录。</p> : null}
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="新建项目"
        subtitle="创建后可继续配置密钥与预算"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit}>保存项目</Button>
          </div>
        }
      >
        <Field label="项目名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：客服知识整理" />
        </Field>
        <Field label="项目描述" hint="可选">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="这个项目主要用来做什么" />
        </Field>
        <Field label="月预算（元）" hint="可后续调整">
          <Input type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <div className="rounded-xl bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
          新项目默认允许「电商文案」与「办公摘要」场景，默认路由为场景选型。项目不提供充值入口。
        </div>
      </Drawer>

      <Drawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`编辑 ${project?.name ?? ""}`}
        subtitle="预算与状态修改立即生效"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                if (project) updateProject(project.id, { monthlyBudget: Number(editBudget) || project.monthlyBudget });
                setEditOpen(false);
              }}
            >
              保存修改
            </Button>
          </div>
        }
      >
        <Field label="月预算（元）">
          <Input type="number" min={0} step={10} value={editBudget} onChange={(e) => setEditBudget(e.target.value)} />
        </Field>
        <Field label="项目状态">
          <select
            value={project?.status ?? "active"}
            onChange={(e) => {
              if (project) updateProject(project.id, { status: e.target.value as "active" | "paused" });
            }}
            className="h-10 w-full cursor-pointer rounded-xl border border-background-300 bg-background-50 px-3 text-sm text-foreground-900 focus:border-primary-400 focus:outline-hidden"
          >
            <option value="active">启用</option>
            <option value="paused">暂停新请求</option>
          </select>
        </Field>
        <div className="rounded-xl bg-background-100/70 p-3 text-[10.5px] leading-relaxed text-foreground-600">
          暂停后该项目的新任务与新请求会被拒绝，已开始的任务不受影响。
        </div>
      </Drawer>
    </div>
  );
}