// 网页自由对话：会话列表 + 消息线程 + 输入区。
// 走平台网关（登录态鉴权、项目预算与权限），对话正文保存在服务端；删除对话不删除调用与账务记录。
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { ApiError, del, fen2yuan, get, post, put, streamFetch } from "@/lib/api";
import { useDemo } from "@/lib/demo-store";
import { cx } from "@/lib/format";
import { Badge, Button, Input, Modal, Select } from "@/components/base/ui";

interface Conv { conv_id: string; title: string; model: string; route_mode: string; session_id: string; project_id: number; updated_at: number }
interface Meta {
  actual_model: string; requested_model: string; route_mode: string; scene_id: string; prompt_tokens: number; completion_tokens: number;
  net_cost_fen: number; estimated_cost_fen: number; billing_status: string; fallback: boolean; fallback_reason: string;
  latency_ms: number; first_byte_ms: number; session_id: string; status: string;
}
interface Msg { id: number | string; role: "user" | "assistant"; content: string; request_id?: string; status: string; error_code?: string; error_message?: string; meta?: Meta; local?: boolean }

const MODES = [
  { v: "fixed", label: "固定模型", hint: "每次都用所选模型" },
  { v: "scene", label: "场景路由", hint: "按场景策略自动挑选并兜底" },
  { v: "session", label: "会话保持", hint: "首轮选定后整段对话保持同一模型" },
];
const SUGGEST = [
  { icon: "ri-quill-pen-line", t: "帮我写一段保温杯的电商详情页卖点文案，突出 12 小时保温" },
  { icon: "ri-file-text-line", t: "把下面的会议纪要整理成三条要点和待办：" },
  { icon: "ri-code-s-slash-line", t: "用 Python 写一个读取 CSV 并按列求和的函数" },
  { icon: "ri-translate-2", t: "把这段话翻译成地道的英文商务邮件：" },
];
const statusNote: Record<string, string> = {
  cancelled: "已停止生成，已生成部分仍按实际用量计费",
  interrupted: "上游中断，已生成部分按实际用量计费，可重新生成",
};
const yuan = (f?: number) => (f ? `¥${fen2yuan(f).toFixed(2)}` : "不足 ¥0.01");

// 标题展示：去除 Markdown 语法（兼容历史标题）
const plainTitle = (s: string) =>
  s.replace(/```[\s\S]*?(```|$)/g, " ").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~>#]+/g, "").replace(/\s+/g, " ").trim() || "新对话";

function relTime(t: number) {
  const d = Date.now() / 1000 - t;
  if (d < 60) return "刚刚";
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return `${Math.floor(d / 86400)} 天前`;
}

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" title="复制" className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-foreground-500 hover:bg-background-100 hover:text-foreground-800", className)}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); } catch { /* 忽略 */ } }}>
      <i className={ok ? "ri-check-line text-success" : "ri-file-copy-line"} />{ok ? "已复制" : "复制"}
    </button>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="chat-md text-[14px] leading-7 text-foreground-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => {
            const code = String((children as any)?.props?.children ?? "");
            return (
              <div className="group relative my-3 overflow-hidden rounded-xl border border-background-200 bg-background-100/70">
                <CopyBtn text={code.replace(/\n$/, "")} className="absolute right-2 top-2 bg-background-50/90 opacity-0 group-hover:opacity-100" />
                <pre className="overflow-x-auto p-4 text-[13px] leading-6 scroll-thin">{children}</pre>
              </div>
            );
          },
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer noopener" className="text-primary-600 underline">{children}</a>,
        }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatPage() {
  const { currentProjectId, projects } = useDemo();
  const nav = useNavigate();
  const loc = useLocation();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [cur, setCur] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [retention, setRetention] = useState(180);
  const [models, setModels] = useState<{ id: string; name: string; ctx: number }[]>([]);
  const [scenes, setScenes] = useState<{ id: string; name: string }[]>([]);
  const [model, setModel] = useState("auto");
  const [mode, setMode] = useState("fixed");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string; requestId?: string } | null>(null);
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [mobileList, setMobileList] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pid = Number(currentProjectId) || 0;
  const projName = projects.find((p) => p.id === currentProjectId)?.name;

  const loadList = useCallback(async () => {
    if (!pid) return;
    const d = await get<any>(`/platform/chats?project_id=${pid}`).catch(() => null);
    if (d) {
      setConvs(d.items || []); setRetention(d.retention_days || 180);
      setCur((c) => (c ? (d.items || []).find((x: Conv) => x.conv_id === c.conv_id) || c : c));
    }
  }, [pid]);

  useEffect(() => {
    get<any>("/platform/catalog").then((c) => {
      setModels((c.models || []).map((m: any) => ({ id: m.model.model_name, name: m.model.display_name || m.model.model_name, ctx: m.model.context_length })));
      setScenes((c.scenes || []).map((s: any) => ({ id: s.scene.scene_id, name: s.scene.name || s.scene.scene_id })));
    }).catch(() => undefined);
  }, []);
  useEffect(() => { loadList(); setCur(null); setMsgs([]); }, [loadList]);

  // 从场景任务“继续对话”带入
  useEffect(() => {
    const st = loc.state as any;
    if (!st?.seed || !pid) return;
    nav(loc.pathname, { replace: true, state: null });
    post<Conv>("/platform/chats", { project_id: pid, title: st.title, model: st.model || "auto", route_mode: st.route_mode || "fixed", seed: st.seed })
      .then(async (c) => { await loadList(); open(c); }).catch((e) => setErr({ code: e.code, message: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const scrollEnd = () => requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end" }));

  const open = async (c: Conv) => {
    if (busy) abortRef.current?.abort();
    setCur(c); setErr(null); setMobileList(false); setModel(c.model); setMode(c.route_mode);
    const d = await get<any>(`/platform/chats/${c.conv_id}/messages`).catch(() => null);
    if (d) { setMsgs(d.messages || []); setCur(d.conversation); }
    scrollEnd();
    pollPending(d?.messages || []);
  };

  const newChat = () => { abortRef.current?.abort(); setCur(null); setMsgs([]); setErr(null); setMobileList(false); taRef.current?.focus(); };

  // 账务异步结算：轮询直到费用落定
  const pollPending = (list: Msg[]) => {
    list.filter((m) => m.role === "assistant" && m.request_id && m.meta?.billing_status === "pending").forEach((m) => {
      let n = 0;
      const tick = async () => {
        n++;
        const r = await get<any>(`/platform/requests/${m.request_id}`).catch(() => null);
        if (r && r.billing_status !== "pending") {
          setMsgs((xs) => xs.map((x) => x.id === m.id && x.meta ? { ...x, meta: { ...x.meta, billing_status: r.billing_status, net_cost_fen: r.net_cost_fen ?? r.net_cost, prompt_tokens: r.prompt_tokens, completion_tokens: r.completion_tokens } } : x));
        } else if (n < 12) setTimeout(tick, 2500);
      };
      setTimeout(tick, 1500);
    });
  };

  const changeRoute = async (m: string, md: string) => {
    if (md === "scene" && !m.startsWith("scene:")) m = scenes[0] ? `scene:${scenes[0].id}` : m;
    if (md === "fixed" && m.startsWith("scene:")) m = "auto";
    setModel(m); setMode(md);
    if (cur) {
      const c = await put<Conv>(`/platform/chats/${cur.conv_id}`, { model: m, route_mode: md }).catch((e) => { setErr({ code: e.code, message: e.message }); return null; });
      if (c) setCur(c);
    }
  };

  const send = async (opts: { text?: string; regenerate?: boolean; trim?: boolean } = {}) => {
    const text = (opts.text ?? input).trim();
    if (busy || (!text && !opts.regenerate && !opts.trim)) return;
    if (!pid) { setErr({ code: "no_project", message: "请先在顶栏选择一个项目" }); return; }
    setErr(null); setBusy(true);
    let conv = cur;
    try {
      if (!conv) {
        conv = await post<Conv>("/platform/chats", { project_id: pid, model, route_mode: mode });
        setCur(conv);
      }
    } catch (e: any) { setErr({ code: e.code, message: e.message }); setBusy(false); return; }
    const resend = opts.trim; // 裁剪重试：用户消息已保存，直接重新发送
    let base = msgs;
    if (opts.regenerate) base = msgs[msgs.length - 1]?.role === "assistant" ? msgs.slice(0, -1) : msgs;
    if (resend) base = msgs.filter((m) => !(m.role === "assistant" && m.status === "failed"));
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: text, status: "succeeded", local: true };
    const aid = `a${Date.now()}`;
    const draft: Msg = { id: aid, role: "assistant", content: "", status: "executing", local: true };
    setMsgs([...base, ...(opts.regenerate || resend ? [] : [userMsg]), draft]);
    if (!opts.regenerate && !resend) setInput("");
    scrollEnd();
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      // 裁剪重试：上一条用户消息已在服务端保存，按“重新生成 + 裁剪”处理，避免重复写入
      const body = opts.regenerate || resend ? { regenerate: true, trim: !!resend } : { content: text };
      const res = await streamFetch(`/platform/chats/${conv.conv_id}/messages`, body, ac.signal);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "", event = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, "");
          buf = buf.slice(i + 1);
          if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
          if (!line.startsWith("data:")) { if (!line) event = ""; continue; }
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (event === "hwao") {
              const m: Msg = j.message;
              setMsgs((xs) => xs.map((x) => (x.id === aid ? m : x)));
              if (j.session_id) setCur((c) => (c ? { ...c, session_id: j.session_id } : c));
              pollPending([m]);
            } else if (j.error) {
              throw new ApiError(500, j.error.code || "upstream_error", j.error.message || "生成中断");
            } else {
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) { acc += delta; setMsgs((xs) => xs.map((x) => (x.id === aid ? { ...x, content: acc } : x))); }
            }
          } catch (e) { if (e instanceof ApiError) throw e; }
        }
        scrollEnd();
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setMsgs((xs) => xs.map((x) => (x.id === aid ? { ...x, status: "cancelled" } : x)));
      } else {
        setMsgs((xs) => xs.filter((x) => x.id !== aid));
        setErr({ code: e.code || "network", message: e.message || "网络异常，请稍后重试", requestId: e.requestId });
      }
    } finally {
      setBusy(false); abortRef.current = null;
      loadList();
      // 停止后稍等服务端落库再刷新（以拿到请求号与费用）
      if (ac.signal.aborted && conv) setTimeout(() => get<any>(`/platform/chats/${conv!.conv_id}/messages`).then((d) => { setMsgs(d.messages || []); pollPending(d.messages || []); }).catch(() => undefined), 1200);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };
  useEffect(() => {
    const t = taRef.current; if (!t) return;
    t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 220)}px`;
  }, [input]);

  const filtered = useMemo(() => convs.filter((c) => !q || plainTitle(c.title).includes(q)), [convs, q]);
  const lastAssistant = msgs[msgs.length - 1]?.role === "assistant" ? msgs[msgs.length - 1] : null;
  const modelLabel = (m: string) => m === "auto" ? "自动选择" : m.startsWith("scene:") ? `场景 · ${scenes.find((s) => `scene:${s.id}` === m)?.name || m.slice(6)}` : models.find((x) => x.id === m)?.name || m;

  const sidebar = (
    <aside className="flex h-full w-full flex-col border-background-200 bg-background-50 lg:w-72 lg:border-r">
      <div className="flex items-center gap-2 p-3">
        <Button className="flex-1" onClick={newChat}><i className="ri-add-line" />新对话</Button>
        <button type="button" className="rounded-lg p-2 text-foreground-500 hover:bg-background-100 lg:hidden" onClick={() => setMobileList(false)}><i className="ri-close-line text-lg" /></button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索对话" className="h-9 pl-9 text-[13px]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 scroll-thin">
        {filtered.length === 0 ? <div className="px-3 py-10 text-center text-xs text-foreground-500">{q ? "没有匹配的对话" : "还没有对话，开始第一段吧"}</div> : null}
        {filtered.map((c) => (
          <div key={c.conv_id} onClick={() => open(c)}
            className={cx("group mb-0.5 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 transition-colors", cur?.conv_id === c.conv_id ? "bg-primary-50 text-primary-800" : "hover:bg-background-100")}>
            <i className={cx("ri-chat-3-line text-sm", cur?.conv_id === c.conv_id ? "text-primary-600" : "text-foreground-400")} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{plainTitle(c.title)}</div>
              <div className="truncate text-[11px] text-foreground-500">{modelLabel(c.model)} · {relTime(c.updated_at)}</div>
            </div>
            <div className="hidden shrink-0 items-center group-hover:flex">
              <button type="button" title="重命名" className="rounded-md p-1 text-foreground-500 hover:bg-background-200" onClick={(e) => { e.stopPropagation(); setRenaming({ id: c.conv_id, title: c.title }); }}><i className="ri-edit-line" /></button>
              <button type="button" title="删除" className="rounded-md p-1 text-foreground-500 hover:bg-danger-soft hover:text-danger" onClick={(e) => { e.stopPropagation(); setDelId(c.conv_id); }}><i className="ri-delete-bin-6-line" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-background-200 p-3 text-[11px] leading-5 text-foreground-500">
        <i className="ri-shield-check-line mr-1" />对话正文保存在服务端，保留 {retention} 天；删除对话仅删除正文，调用与账务记录保留。
      </div>
    </aside>
  );

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] overflow-hidden bg-background-100/40 md:-mx-6 lg:-mx-8">
      <div className="hidden lg:flex">{sidebar}</div>
      {mobileList ? <div className="fixed inset-0 z-40 flex bg-background-950/40 lg:hidden" onClick={() => setMobileList(false)}><div className="h-full w-80 max-w-[85vw] shadow-lift" onClick={(e) => e.stopPropagation()}>{sidebar}</div></div> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        {/* 顶部：标题 + 模型 / 路由模式 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-background-200 bg-background-50/90 px-4 py-2.5 backdrop-blur md:px-6">
          <button type="button" className="rounded-lg p-1.5 text-foreground-600 hover:bg-background-100 lg:hidden" onClick={() => setMobileList(true)}><i className="ri-chat-history-line text-lg" /></button>
          <div className="mr-auto min-w-0">
            <div className="truncate font-heading text-[15px] font-semibold text-foreground-900">{cur ? plainTitle(cur.title) : "新对话"}</div>
            <div className="truncate text-[11px] text-foreground-500">{projName ? `项目：${projName}` : "未选择项目"}{cur?.session_id ? ` · 会话 ${cur.session_id.slice(-8)}` : ""}</div>
          </div>
          <Select aria-label="路由模式" value={mode} onChange={(e) => changeRoute(model, e.target.value)} disabled={busy} className="!h-9 !w-[7.5rem] text-[13px]" title={MODES.find((m) => m.v === mode)?.hint}>
            {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </Select>
          <Select aria-label="模型" value={model} onChange={(e) => changeRoute(e.target.value, mode)} disabled={busy} className="!h-9 !w-[11.5rem] text-[13px]">
            {mode !== "scene" ? <option value="auto">自动选择（推荐）</option> : null}
            {mode !== "scene" ? <optgroup label="固定模型">{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup> : null}
            {mode !== "fixed" ? <optgroup label="场景">{scenes.map((s) => <option key={s.id} value={`scene:${s.id}`}>{s.name}</option>)}</optgroup> : null}
          </Select>
        </div>

        {/* 消息区 */}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
            {msgs.length === 0 ? (
              <div className="flex flex-col items-center pt-[8vh] text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-background-50 shadow-soft"><i className="ri-chat-smile-3-line text-2xl" /></div>
                <h2 className="font-heading text-2xl font-semibold text-foreground-900">今天想聊点什么？</h2>
                <p className="mt-2 max-w-md text-sm text-foreground-600">自由提问、多轮追问。费用按实际用量从企业余额扣除，并计入当前项目预算。</p>
                <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                  {SUGGEST.map((s) => (
                    <button key={s.t} type="button" onClick={() => { setInput(s.t); taRef.current?.focus(); }}
                      className="flex items-start gap-3 rounded-xl2 border border-background-200 bg-background-50 p-4 text-left text-[13px] leading-6 text-foreground-700 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-300">
                      <i className={cx(s.icon, "mt-0.5 text-base text-primary-500")} />{s.t}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {msgs.map((m, i) => m.role === "user" ? (
              <div key={m.id} className="group mb-6 flex flex-col items-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary-500 px-4 py-2.5 text-[14px] leading-7 text-background-50 shadow-soft">{m.content}</div>
                <CopyBtn text={m.content} className="mt-1 opacity-0 group-hover:opacity-100" />
              </div>
            ) : (
              <div key={m.id} className="mb-7 flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-800"><i className="ri-robot-2-line" /></div>
                <div className="min-w-0 flex-1">
                  {m.status === "failed" ? (
                    <div className="rounded-xl border border-danger bg-danger-soft px-3.5 py-3 text-[13px] text-danger"><i className="ri-error-warning-line mr-1" />{m.error_message || "生成失败"}{m.request_id ? <span className="ml-2 text-[11px] opacity-70">请求号 {m.request_id}</span> : null}</div>
                  ) : m.content ? <Markdown text={m.content} /> : m.status === "executing" ? (
                    <div className="flex items-center gap-1.5 py-2"><span className="h-2 w-2 animate-bounce rounded-full bg-primary-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:240ms]" /></div>
                  ) : null}
                  {statusNote[m.status] ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1 text-[12px] text-warning"><i className="ri-stop-circle-line" />{statusNote[m.status]}</div> : null}
                  {m.meta?.fallback ? <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent-50 px-2.5 py-1 text-[12px] text-accent-800"><i className="ri-shuffle-line" />已自动兜底切换{m.meta.fallback_reason ? `：${m.meta.fallback_reason}` : ""}</div> : null}
                  {m.status !== "executing" && m.status !== "failed" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-500">
                      <CopyBtn text={m.content} className="-ml-1.5" />
                      {i === msgs.length - 1 && !busy ? <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs hover:bg-background-100 hover:text-foreground-800" onClick={() => setRegenOpen(true)}><i className="ri-refresh-line" />重新生成</button> : null}
                      {m.meta ? <>
                        <span className="inline-flex items-center gap-1"><i className="ri-cpu-line" />{m.meta.actual_model || "—"}{cur?.model === "auto" ? "（自动）" : ""}</span>
                        <span>{m.meta.prompt_tokens + m.meta.completion_tokens > 0 ? `${m.meta.prompt_tokens} 入 / ${m.meta.completion_tokens} 出 Token` : "Token 统计中"}</span>
                        <span>{m.meta.billing_status === "pending" ? <span className="inline-flex items-center gap-1"><i className="ri-loader-4-line animate-spin" />费用结算中（预估 {yuan(m.meta.estimated_cost_fen)}）</span> : `费用 ${yuan(m.meta.net_cost_fen)}`}</span>
                        {m.meta.latency_ms ? <span>{(m.meta.latency_ms / 1000).toFixed(1)}s</span> : null}
                        {m.request_id ? <button type="button" className="hover:text-primary-600" onClick={() => nav(`/app/requests?focus=${m.request_id}`)}>详情</button> : null}
                      </> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {err ? (
              <div className="mb-6 rounded-xl2 border border-background-200 bg-background-50 p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <i className={cx("text-lg", err.code === "context_length_exceeded" ? "ri-scissors-cut-line text-warning" : "ri-error-warning-line text-danger")} />
                  <div className="min-w-0 flex-1 text-[13px] text-foreground-800">
                    <div className="font-medium">{err.code === "context_length_exceeded" ? "对话太长了" : err.code === "quota_exceeded" || /余额|预算/.test(err.message) ? "额度不足" : "没能完成这次回复"}</div>
                    <div className="mt-1 text-foreground-600">{err.message}{err.requestId ? `（请求号 ${err.requestId}）` : ""}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {err.code === "context_length_exceeded" ? <>
                        <Button size="sm" onClick={() => send({ trim: true })}><i className="ri-scissors-line" />裁剪较早消息后重试</Button>
                        <Button size="sm" variant="outline" onClick={newChat}>新建对话</Button>
                      </> : <Button size="sm" variant="outline" onClick={() => setErr(null)}>知道了</Button>}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t border-background-200 bg-background-50 px-4 pb-4 pt-3 md:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-2xl border border-background-300 bg-background-50 p-2 shadow-soft focus-within:border-primary-400">
              <textarea ref={taRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
                placeholder={pid ? "输入消息，Enter 发送，Shift + Enter 换行" : "请先在顶栏选择项目"}
                className="max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-6 text-foreground-900 outline-none placeholder:text-foreground-400 focus-visible:!outline-none" />
              {busy ? (
                <Button variant="outline" onClick={() => abortRef.current?.abort()} title="停止生成"><i className="ri-stop-fill" />停止</Button>
              ) : (
                <Button onClick={() => send()} disabled={!input.trim()} title="发送"><i className="ri-send-plane-2-fill" />发送</Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-foreground-500">
              <span>{modelLabel(model)} · {MODES.find((m) => m.v === mode)?.label}{busy ? " · 停止后已生成部分仍会计费" : ""}</span>
              <span>AI 生成内容仅供参考，请核实后使用</span>
            </div>
          </div>
        </div>
      </section>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="重命名对话"
        footer={<><Button variant="ghost" onClick={() => setRenaming(null)}>取消</Button><Button onClick={async () => {
          if (!renaming) return; const c = await put<Conv>(`/platform/chats/${renaming.id}`, { title: renaming.title }).catch(() => null);
          if (c && cur?.conv_id === c.conv_id) setCur(c); setRenaming(null); loadList();
        }}>保存</Button></>}>
        <Input autoFocus value={renaming?.title || ""} maxLength={60} onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))} />
      </Modal>
      <Modal open={!!delId} onClose={() => setDelId(null)} title="删除这段对话？" description="将删除对话正文与会话历史，无法恢复。已产生的调用记录与账务流水会保留，不影响对账。"
        footer={<><Button variant="ghost" onClick={() => setDelId(null)}>取消</Button><Button variant="danger" onClick={async () => {
          if (!delId) return; await del(`/platform/chats/${delId}`).catch(() => null);
          if (cur?.conv_id === delId) newChat(); setDelId(null); loadList();
        }}>删除</Button></>}>
        <div className="text-[13px] text-foreground-600">调用记录可在「调用记录」中继续查看。</div>
      </Modal>
      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="重新生成回复？" description="将基于上一条消息重新调用模型，会再次产生费用；原回复的调用与账务记录保留。"
        footer={<><Button variant="ghost" onClick={() => setRegenOpen(false)}>取消</Button><Button onClick={() => { setRegenOpen(false); send({ regenerate: true }); }}><i className="ri-refresh-line" />确认重新生成</Button></>}>
        <div className="text-[13px] text-foreground-600">{lastAssistant?.meta ? `上次花费 ${yuan(lastAssistant.meta.net_cost_fen || lastAssistant.meta.estimated_cost_fen)}，模型 ${lastAssistant.meta.actual_model}。` : "将按当前模型与路由模式重新生成。"}</div>
      </Modal>
    </div>
  );
}
