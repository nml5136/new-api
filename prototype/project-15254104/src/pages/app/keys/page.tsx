import { useState } from "react";
import { Badge, Button, Card, Copyable, Drawer, Field, Input, Modal, Notice, PageHeader, Select } from "@/components/base/ui";
import { useDemo } from "@/lib/demo-store";
import { money } from "@/lib/format";
import type { ApiKey } from "@/lib/types";

const endpoint = "https://api.example.com/v1";

export default function KeysPage() {
  const { keys, projects, createKey, setKeyStatus } = useDemo();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("生产环境服务端");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [expires, setExpires] = useState("90 天");
  const [limit, setLimit] = useState("60");
  const [ip, setIp] = useState("10.0.0.0/24");
  const [scenes, setScenes] = useState<string[]>(["commerce-copy"]);
  const [plain, setPlain] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState("");
  const [revokeKey, setRevokeKey] = useState<ApiKey | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [notice, setNotice] = useState("");

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "—";

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedEndpoint(true);
      window.setTimeout(() => setCopiedEndpoint(false), 1500);
    } catch {
      setCopiedEndpoint(false);
    }
  };

  const submit = () => {
    if (!name.trim() || !projectId) {
      setNotice("请填写密钥名称并选择所属项目。");
      return;
    }
    const result = createKey({ name, projectId, limit: Number(limit) || 30, expiresAt: expires });
    setCreatedName(name);
    setPlain(result.plain);
    setOpen(false);
    setNotice("");
  };

  const rotate = (key: ApiKey) => {
    const result = createKey({ name: `${key.name}（轮换）`, projectId: key.projectId, limit: key.limit, expiresAt: key.expiresAt });
    setKeyStatus(key.id, "revoked");
    setCreatedName(result.key.name);
    setPlain(result.plain);
  };

  return (
    <div>
      <PageHeader
        eyebrow="API Key"
        title="接入你的应用"
        description="密钥只在创建时展示一次完整值，之后仅保留掩码。所有演示密钥以 demo_hr_ 开头，无法用于真实调用。"
        actions={
          <Button onClick={() => setOpen(true)}>
            <i className="ri-add-line" />
            创建密钥
          </Button>
        }
      />

      {notice ? <Notice tone="warning" className="mb-3">{notice}</Notice> : null}

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10.5px] text-foreground-500">平台接入地址（占位）</p>
            <p className="mt-1 truncate font-mono-ui text-xs text-foreground-900">{endpoint}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyEndpoint}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-background-300 px-2.5 text-[11px] text-foreground-700 hover:border-primary-300 hover:text-primary-700"
            >
              <i className={copiedEndpoint ? "ri-check-line" : "ri-file-copy-line"} />
              {copiedEndpoint ? "已复制" : "复制地址"}
            </button>
            <span className="hidden text-[9.5px] text-foreground-400 md:inline">不暴露内部网关域名</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-background-950 p-3">
          <pre className="overflow-x-auto font-mono-ui text-[10.5px] leading-relaxed text-background-50/70 scroll-thin">
{`curl ${endpoint}/chat/completions \\
  -H "Authorization: Bearer demo_hr_xxxxxxxx" \\
  -H "X-Route-Mode: scene" \\
  -d '{ "model": "scene:commerce-copy", "messages": [...] }'`}
          </pre>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1.3fr_1fr_1.2fr_0.7fr_0.9fr_0.9fr] gap-3 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] font-medium text-foreground-500 md:grid">
          <span>名称</span>
          <span>项目</span>
          <span>密钥</span>
          <span>状态</span>
          <span>有效期</span>
          <span className="text-right">操作</span>
        </div>
        <div className="divide-y divide-background-100">
          {keys.map((key) => (
            <div key={key.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1.3fr_1fr_1.2fr_0.7fr_0.9fr_0.9fr] md:items-center md:gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-foreground-900">{key.name}</p>
                <p className="mt-0.5 text-[9.5px] text-foreground-400">创建于 {key.createdAt} · 额度上限 {money(key.limit)}</p>
              </div>
              <span className="text-[11px] text-foreground-600">{projectName(key.projectId)}</span>
              <span className="truncate font-mono-ui text-[10px] text-foreground-500">{key.masked}</span>
              <span>
                <Badge tone={key.status === "active" ? "success" : key.status === "disabled" ? "warning" : "danger"}>
                  {key.status === "active" ? "启用中" : key.status === "disabled" ? "已停用" : "已撤销"}
                </Badge>
              </span>
              <span className="text-[10.5px] text-foreground-600">{key.expiresAt}</span>
              <div className="flex flex-wrap items-center gap-1 md:justify-end">
                {key.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setKeyStatus(key.id, "disabled")}
                    className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-warning hover:text-warning"
                  >
                    停用
                  </button>
                ) : key.status === "disabled" ? (
                  <button
                    type="button"
                    onClick={() => setKeyStatus(key.id, "active")}
                    className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                  >
                    启用
                  </button>
                ) : null}
                {key.status !== "revoked" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => rotate(key)}
                      className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-primary-300 hover:text-primary-700"
                    >
                      轮换
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevokeKey(key)}
                      className="cursor-pointer rounded-md border border-background-300 px-2 py-1 text-[10px] text-foreground-700 hover:border-danger hover:text-danger"
                    >
                      撤销
                    </button>
                  </>
                ) : (
                  <span className="text-[9.5px] text-foreground-400">不可再使用</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Notice tone="warning" icon="ri-flask-line">
          本页密钥全部为演示字符串，不会调用任何真实服务，也不应写入生产环境变量。
        </Notice>
        <Notice tone="neutral" icon="ri-shield-line">
          密钥可限制场景、模型与 IP 白名单；停用后新请求立即失败，轮换会撤销旧密钥。
        </Notice>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="创建密钥"
        subtitle="完整密钥仅在创建成功后显示一次"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={submit}>创建密钥</Button>
          </div>
        }
      >
        <Field label="密钥名称">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：生产环境服务端" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="所属项目">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="有效期">
            <Select value={expires} onChange={(e) => setExpires(e.target.value)}>
              <option>30 天</option>
              <option>90 天</option>
              <option>180 天</option>
              <option>长期</option>
            </Select>
          </Field>
          <Field label="月度额度上限（元）">
            <Input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
          <Field label="IP 白名单" hint="演示">
            <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.0/24" />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground-700">允许场景</p>
          <div className="space-y-1.5">
            {[
              { id: "commerce-copy", label: "电商文案" },
              { id: "office-summary", label: "办公摘要" },
              { id: "info-extract", label: "结构化提取" },
            ].map((scene) => (
              <label key={scene.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-background-200 px-2.5 py-2 text-[11px] text-foreground-700">
                <input
                  type="checkbox"
                  checked={scenes.includes(scene.id)}
                  onChange={(e) => setScenes((prev) => (e.target.checked ? [...prev, scene.id] : prev.filter((s) => s !== scene.id)))}
                  className="h-3.5 w-3.5 cursor-pointer"
                  style={{ accentColor: "oklch(var(--primary-500))" }}
                />
                {scene.label}
              </label>
            ))}
          </div>
        </div>
        <Notice tone="neutral" icon="ri-information-line">
          创建后请立即保存密钥。本原型不会把密钥写入浏览器长期存储之外的任何位置。
        </Notice>
      </Drawer>

      <Modal
        open={Boolean(plain)}
        onClose={() => setPlain(null)}
        title="密钥已创建，仅显示一次"
        description={`${createdName} · 关闭后将只保留掩码`}
        footer={<Button onClick={() => setPlain(null)}>我已保存</Button>}
      >
        <div className="rounded-xl border border-background-200 bg-background-950 p-3">
          <p className="break-all font-mono-ui text-[11px] leading-relaxed text-background-50">{plain}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Copyable value={plain ?? ""} label="复制完整密钥" />
          <span className="text-[10px] leading-relaxed text-foreground-500">
            示例密钥以 demo_hr_ 开头，仅供演示，不能用于真实调用。
          </span>
        </div>
        <Notice tone="warning" icon="ri-error-warning-line">
          不要把密钥写入前端代码或公开仓库。生产环境应保存在服务端密钥管理中。
        </Notice>
      </Modal>

      <Modal
        open={Boolean(revokeKey)}
        onClose={() => setRevokeKey(null)}
        title="撤销密钥"
        description="撤销后无法恢复，使用该密钥的请求将立即失败。"
        footer={
          <>
            <Button variant="outline" onClick={() => setRevokeKey(null)}>取消</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (revokeKey) setKeyStatus(revokeKey.id, "revoked");
                setRevokeKey(null);
              }}
            >
              确认撤销
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-700">
          密钥「{revokeKey?.name}」将立即失效。建议先创建并部署新密钥，再撤销旧密钥，避免服务中断。
          <p className="mt-2 font-mono-ui text-[10px] text-foreground-500">{revokeKey?.masked}</p>
        </div>
      </Modal>
    </div>
  );
}