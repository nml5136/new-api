import { useState } from "react";
import { Badge, Button, Card, Drawer, Field, Input, Modal, Notice, PageHeader, Select } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";

const roles = [
  { name: "企业管理员", desc: "管理成员、预算、密钥与账单，可查看任务正文。" },
  { name: "使用成员", desc: "在授权项目内创建任务与密钥，不可修改企业预算。" },
  { name: "财务成员", desc: "查看账务与账单，默认不可读取密钥与任务正文。" },
];

export default function MembersPage() {
  const { members, projects, inviteMember, removeMember } = useDemo();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"企业管理员" | "使用成员" | "财务成员">("使用成员");
  const [access, setAccess] = useState<string[]>([projects[0]?.name ?? "默认项目"]);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const visible = members.filter((m) => !removed.includes(m.id));
  const target = members.find((m) => m.id === removeId);

  // 一期按平台账号用户名（或注册邮箱对应的用户名）加入企业，不发送邮件
  const submit = async () => {
    if (!email.trim()) {
      setNotice("请输入成员的平台用户名。");
      return;
    }
    try {
      await inviteMember({ email: email.trim(), role, projects: access });
      setNotice(`已将 ${email} 加入企业。`);
      setEmail("");
      setOpen(false);
    } catch (e) {
      setNotice(`添加失败：${(e as Error).message}`);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="成员与权限"
        title="角色决定能看到什么"
        description="财务成员默认可查看账务，但不能读取企业密钥与任务正文；客户与运营角色使用不同导航。"
        actions={
          <Button onClick={() => setOpen(true)}>
            <i className="ri-user-add-line" />
            邀请成员
          </Button>
        }
      />

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {roles.map((item) => (
          <Card key={item.name} className="p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <i className={item.name === "财务成员" ? "ri-safe-2-line" : item.name === "使用成员" ? "ri-user-line" : "ri-shield-user-line"} />
              </span>
              <p className="text-[12px] font-medium text-foreground-950">{item.name}</p>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-foreground-600">{item.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_0.8fr_1.2fr_0.8fr_0.7fr_0.8fr] gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] font-medium text-foreground-500 md:grid">
          <span>成员</span>
          <span>角色</span>
          <span>可访问项目</span>
          <span>最近活动</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-background-100">
          {visible.map((member) => (
            <div key={member.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1.2fr_0.8fr_1.2fr_0.8fr_0.7fr_0.8fr] md:items-center md:gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground-900">{member.name}</p>
                <p className="truncate text-[9.5px] text-foreground-400">{member.email}</p>
              </div>
              <span className="text-[11px] text-foreground-700">{member.role}</span>
              <span className="text-[10.5px] text-foreground-600">{member.projects.join("、")}</span>
              <span className="text-[10px] text-foreground-500">{member.lastActive}</span>
              <span>
                <Badge tone={member.status === "active" ? "success" : member.status === "invited" ? "warning" : "neutral"}>
                  {member.status === "active" ? "已加入" : member.status === "invited" ? "待接受" : "已停用"}
                </Badge>
              </span>
              <div className="flex items-center gap-1 md:justify-end">
                {member.status === "invited" ? (
                  <button
                    type="button"
                    onClick={() => setNotice(`一期不发送邀请邮件，请通知 ${member.email} 直接登录。`)}
                    className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                  >
                    重发邀请
                  </button>
                ) : null}
                {member.role !== "企业管理员" ? (
                  <button
                    type="button"
                    onClick={() => setRemoveId(member.id)}
                    className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-danger hover:text-danger"
                  >
                    移除
                  </button>
                ) : (
                  <span className="text-[9.5px] text-foreground-400">不可移除</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Notice tone="neutral" icon="ri-information-line" className="mt-3">
        移出成员与企业级服务密钥是两件事：移除成员会收回其访问权限，但不会删除任何密钥或历史记录。
      </Notice>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="邀请成员"
        subtitle="邀请后状态为待接受"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit}>发送邀请</Button>
          </div>
        }
      >
        <Field label="平台用户名" hint="成员需先注册平台账号">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="username" />
        </Field>
        <Field label="角色">
          <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option>企业管理员</option>
            <option>使用成员</option>
            <option>财务成员</option>
          </Select>
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground-700">可访问项目</p>
          <div className="space-y-1.5">
            {projects.map((project) => (
              <label key={project.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-background-200 px-2.5 py-2 text-[11px] text-foreground-700">
                <input
                  type="checkbox"
                  checked={access.includes(project.name)}
                  onChange={(e) => setAccess((prev) => (e.target.checked ? [...prev, project.name] : prev.filter((p) => p !== project.name)))}
                  className="h-3.5 w-3.5 cursor-pointer"
                  style={{ accentColor: "oklch(var(--primary-500))" }}
                />
                {project.name}
              </label>
            ))}
          </div>
        </div>
        {role === "财务成员" ? (
          <Notice tone="warning" icon="ri-lock-line">
            财务成员默认仅可查看账务，不能读取任务正文与企业密钥。该限制在原型中通过角色说明表达。
          </Notice>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(removeId)}
        onClose={() => setRemoveId(null)}
        title="移除成员"
        description="移除后该成员将立即失去所有项目访问权限。"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveId(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                const id = removeId;
                setRemoveId(null);
                if (!id) return;
                removeMember(id)
                  .then(() => { setRemoved((prev) => [...prev, id]); setNotice(`${target?.name ?? "成员"} 已被移出企业。其历史任务与账务记录保留。`); })
                  .catch((e) => setNotice(`移除失败：${(e as Error).message}`));
              }}
            >
              确认移除
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          {target?.name}（{target?.email}）当前角色为 {target?.role}。
          <p className="mt-2 text-[10px] text-foreground-500">账务与安全记录不会因移除成员而删除；已创建的密钥需要单独撤销。</p>
        </div>
      </Modal>
    </div>
  );
}