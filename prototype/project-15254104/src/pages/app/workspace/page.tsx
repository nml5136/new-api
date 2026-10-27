import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, Drawer, Modal, Notice, Select } from "@/components/base/ui";
import ModelPanel from "@/pages/app/workspace/components/ModelPanel";
import ResultPanel from "@/pages/app/workspace/components/ResultPanel";
import RouteSummary from "@/pages/app/workspace/components/RouteSummary";
import SceneInput from "@/pages/app/workspace/components/SceneInput";
import { useDemo } from "@/lib/demo-store";
import { models, scenes } from "@/mocks/demo";
import { commerceOutput, commerceSample, extractJson, extractSample, summaryOutput, summarySample } from "@/mocks/outputs";
import { cx, money } from "@/lib/format";
import type { ModelInfo, Preference, SceneId, UsageRecord } from "@/lib/types";

const prefOptions: Array<{ id: Preference; label: string; hint: string }> = [
  { id: "economy", label: "经济", hint: "费用优先，质量需满足底线" },
  { id: "balanced", label: "均衡", hint: "默认，质量与费用兼顾" },
  { id: "quality", label: "质量优先", hint: "复杂字段或长文使用" },
];

const sampleByScene: Record<SceneId, string> = {
  "commerce-copy": commerceSample,
  "office-summary": summarySample,
  "info-extract": extractSample,
};

const outputByScene = (scene: SceneId) => {
  if (scene === "office-summary") return summaryOutput;
  if (scene === "info-extract") return extractJson;
  return commerceOutput;
};

const modelFor = (preference: Preference) => {
  const id = preference === "economy" ? "model-b" : preference === "quality" ? "model-c" : "model-a";
  return (models.find((m) => m.id === id) ?? models[0]) as unknown as ModelInfo;
};

const preferenceForModel = (name: string): Preference => {
  if (name.includes("B")) return "economy";
  if (name.includes("C")) return "quality";
  return "balanced";
};

const defaultTitle = (scene: SceneId) =>
  scene === "commerce-copy" ? "秋季保温杯详情页文案" : scene === "office-summary" ? "客户反馈周报摘要" : "采购合同字段提取";

export default function WorkspacePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    records,
    tasks,
    projects,
    drafts,
    currentProjectId,
    executeTask,
    finalizeRecord,
    interruptRecord,
    resolveRecord,
    removeDraft,
    singleCap,
    updateBudget,
    monthBudget,
    monthSpend,
    reserved,
  } = useDemo();

  const draftId = params.get("draft");
  const taskParam = params.get("task");
  const sceneParam = (params.get("scene") as SceneId) || "commerce-copy";
  const restoredRecord = taskParam ? records.find((r) => r.id === taskParam) : undefined;
  const restoredDraft = draftId ? drafts[draftId] : undefined;

  const [scene, setScene] = useState<SceneId>(
    restoredRecord?.scene ?? restoredDraft?.scene ?? (scenes.some((s) => s.id === sceneParam) ? sceneParam : "commerce-copy"),
  );
  const [title, setTitle] = useState(restoredRecord?.title ?? restoredDraft?.title ?? defaultTitle(sceneParam));
  const [prompt, setPrompt] = useState(
    restoredRecord?.prompt ?? restoredDraft?.prompt ?? sampleByScene[sceneParam] ?? commerceSample,
  );
  const [preference, setPreference] = useState<Preference>(
    restoredRecord ? preferenceForModel(restoredRecord.model) : restoredDraft?.preference ?? "balanced",
  );
  const [options, setOptions] = useState<Record<string, string>>({
    channel: "详情页",
    tone: "克制可信",
    length: "中",
    ban: "最好、第一、永久",
    summaryLen: "中",
    actions: "yes",
    nullRule: "原文未提及标记为 null",
  });

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(restoredRecord ? 3 : -1);
  const [output, setOutput] = useState(
    restoredRecord && (restoredRecord.status === "completed" || restoredRecord.status === "interrupted")
      ? restoredRecord.output ?? outputByScene(restoredRecord.scene)
      : "",
  );
  const [resultId, setResultId] = useState<string | null>(restoredRecord?.id ?? null);
  const [error, setError] = useState<{ type: "budget" | "balance"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [focus, setFocus] = useState<"both" | "edit" | "result">("both");
  const [explainOpen, setExplainOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [switchNote, setSwitchNote] = useState("");

  const ignoreTaskRef = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (taskParam && taskParam === ignoreTaskRef.current) return;
    if (taskParam) {
      const record = records.find((r) => r.id === taskParam);
      if (!record) return;
      clearTimers();
      setScene(record.scene);
      setTitle(record.title);
      setPrompt(record.prompt ?? sampleByScene[record.scene]);
      setPreference(preferenceForModel(record.model));
      setOutput(
        record.status === "completed" || record.status === "interrupted" ? record.output ?? outputByScene(record.scene) : "",
      );
      setResultId(record.id);
      setStage(3);
      setRunning(false);
      setError(null);
      setFeedback(null);
      return;
    }
    if (draftId && drafts[draftId]) {
      const draft = drafts[draftId];
      clearTimers();
      setScene(draft.scene);
      setTitle(draft.title);
      setPrompt(draft.prompt);
      setPreference(draft.preference);
      setOutput("");
      setResultId(null);
      setStage(-1);
      setRunning(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, draftId]);

  const model = modelFor(preference);
  const liveRecord = records.find((r) => r.id === resultId);
  const remaining = monthBudget - monthSpend - reserved;
  const estimated = useMemo(() => {
    const inK = preference === "economy" ? 9.6 : preference === "quality" ? 14.4 : 12;
    const outK = preference === "economy" ? 1.8 : preference === "quality" ? 2.4 : 2;
    return Math.round(((inK / 1000) * model.priceIn + (outK / 1000) * model.priceOut) * 1000) / 1000;
  }, [preference, model]);

  const currentProject = projects.find((p) => p.id === currentProjectId) ?? projects[0];

  const resetCanvas = () => {
    clearTimers();
    setResultId(null);
    setOutput("");
    setStage(-1);
    setError(null);
    setRunning(false);
    setFeedback(null);
    setSwitchNote("");
  };

  const changeScene = (id: SceneId) => {
    setScene(id);
    setPrompt(sampleByScene[id]);
    const rec = scenes.find((s) => s.id === id)?.recommend ?? "balanced";
    setPreference(rec as Preference);
    setTitle(defaultTitle(id));
    resetCanvas();
  };

  const newTask = () => {
    resetCanvas();
    setTitle("未命名任务");
    setPrompt(sampleByScene[scene]);
    setParams({ scene }, { replace: true });
  };

  const run = () => {
    if (running) return;
    clearTimers();
    const res = executeTask({ scene, preference, title, prompt, projectId: currentProjectId });
    if (!res.ok) {
      setError({ type: res.reason, message: res.message });
      return;
    }
    setError(null);
    setResultId(res.record.id);
    setOutput("");
    setFeedback(null);
    setStage(0);
    setRunning(true);
    if (draftId) removeDraft(draftId);
    ignoreTaskRef.current = res.record.id;
    setParams({ task: res.record.id, scene }, { replace: true });

    timers.current.push(window.setTimeout(() => setStage(1), 320));

    if (res.record.status === "unknown") {
      timers.current.push(
        window.setTimeout(() => {
          setStage(3);
          setRunning(false);
        }, 1000),
      );
      return;
    }

    if (res.record.status === "interrupted") {
      timers.current.push(
        window.setTimeout(() => {
          setOutput(res.output);
          setStage(3);
          setRunning(false);
        }, 800),
      );
      return;
    }

    timers.current.push(
      window.setTimeout(() => {
        setStage(2);
        const text = res.output;
        let i = 0;
        const step = Math.max(2, Math.ceil(text.length / 70));
        const interval = window.setInterval(() => {
          i += step;
          setOutput(text.slice(0, i));
          if (i >= text.length) {
            window.clearInterval(interval);
            setStage(3);
            setRunning(false);
            if (res.record.status === "streaming") finalizeRecord(res.record.id);
          }
        }, 38);
        timers.current.push(interval);
      }, 680),
    );
  };

  const stop = () => {
    clearTimers();
    if (resultId) interruptRecord(resultId);
    setRunning(false);
    setStage(3);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "任务结果"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreSource = () => {
    setPrompt(liveRecord?.prompt ?? sampleByScene[scene]);
  };

  const pickModel = (target: ModelInfo) => {
    const map: Record<string, Preference> = { "model-a": "balanced", "model-b": "economy", "model-c": "quality" };
    const next = map[target.id] ?? "balanced";
    setPreference(next);
    setSwitchNote(`已切换推荐偏好为「${prefOptions.find((p) => p.id === next)?.label}」，下一个新任务会使用 ${target.name}。当前任务结果保持原模型。`);
    setSwitchOpen(false);
    setCandidatesOpen(false);
  };

  const openTask = (record: UsageRecord) => {
    clearTimers();
    ignoreTaskRef.current = null;
    setRecentOpen(false);
    setParams({ task: record.id, scene: record.scene });
  };

  const availableModels = models.filter((m) => m.status !== "pending") as unknown as ModelInfo[];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="任务名称"
              className="min-w-0 max-w-[360px] flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold text-foreground-950 transition-colors hover:border-background-300 focus:border-primary-400 focus:bg-background-50 focus:outline-none"
            />
            <Badge tone="primary">{scenes.find((s) => s.id === scene)?.name}</Badge>
            <button
              type="button"
              onClick={() => setRecentOpen(true)}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-background-300 bg-background-50 px-2.5 text-[10px] text-foreground-700 transition-colors hover:border-primary-300 hover:text-primary-700"
            >
              <i className="ri-history-line" />
              最近任务
              <span className="tnum text-foreground-400">{tasks.length}</span>
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1 text-[10.5px] text-foreground-500">
            <span className="flex items-center gap-1"><i className="ri-folder-3-line" />{currentProject?.name}</span>
            <span className="flex items-center gap-1"><i className="ri-check-double-line text-success" />已自动保存</span>
            <span className="flex items-center gap-1"><i className="ri-database-2-line" />任务内容仅保存在工作区，不写入链接</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-background-100 p-1">
            {[
              { id: "both" as const, label: "并排", icon: "ri-layout-row-line" },
              { id: "edit" as const, label: "编辑", icon: "ri-edit-2-line" },
              { id: "result" as const, label: "结果", icon: "ri-file-text-line" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFocus(item.id)}
                className={cx(
                  "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
                  focus === item.id ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-600 hover:text-foreground-900",
                )}
              >
                <i className={item.icon} />
                {item.label}
              </button>
            ))}
          </div>
          <Select
            value={scene}
            onChange={(e) => changeScene(e.target.value as SceneId)}
            className="h-9 w-[140px] text-xs"
            aria-label="切换场景"
          >
            {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button variant="outline" size="sm" onClick={newTask}>
            <i className="ri-add-line" />
            新建任务
          </Button>
        </div>
      </div>

      <RouteSummary
        model={model}
        preference={preference}
        cap={singleCap}
        estimated={estimated}
        remaining={remaining}
        record={liveRecord}
        running={running}
        onOpenExplain={() => setExplainOpen(true)}
        onCandidates={() => setCandidatesOpen(true)}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-background-200 bg-background-50 px-3.5 py-2">
        <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-background-100 p-1">
          {prefOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreference(option.id)}
              title={option.hint}
              className={cx(
                "cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                preference === option.id ? "bg-background-50 text-foreground-950 shadow-sm" : "text-foreground-600 hover:text-foreground-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-foreground-500">单次上限</span>
          <span className="text-[11px] text-foreground-500">¥</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={singleCap}
            onChange={(e) => updateBudget({ singleCap: Math.max(0.01, Number(e.target.value) || 0.01) })}
            className="tnum h-8 w-[74px] rounded-lg border border-background-300 bg-background-50 px-2 text-[11px] text-foreground-900 focus:border-primary-400 focus:outline-none"
            aria-label="单次费用上限"
          />
        </div>
        <span className="text-[9.5px] text-foreground-400">切换偏好只影响下一个任务，已提交的任务保持原模型</span>
        {switchNote ? (
          <span className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[9.5px] leading-relaxed text-primary-700">{switchNote}</span>
        ) : null}
      </div>

      {error ? (
        <Notice tone={error.type === "budget" ? "warning" : "danger"} icon={error.type === "budget" ? "ri-wallet-3-line" : "ri-bank-card-line"}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <strong className="font-medium">{error.type === "budget" ? "项目预算不足：" : "钱包余额不足："}</strong>
              {error.message}
            </span>
            <button
              type="button"
              onClick={() => navigate(error.type === "budget" ? "/app/budgets" : "/app/billing")}
              className="shrink-0 cursor-pointer whitespace-nowrap rounded-lg border border-current px-2.5 py-1 text-[10.5px] font-medium"
            >
              {error.type === "budget" ? "申请调整预算" : "去充值"}
            </button>
          </div>
        </Notice>
      ) : null}

      <div className="space-y-3">
        {focus !== "result" ? (
          <SceneInput
            scene={scene}
            prompt={prompt}
            onPrompt={setPrompt}
            options={options}
            onOption={(key, value) => setOptions((prev) => ({ ...prev, [key]: value }))}
            disabled={running}
            onGenerate={run}
            running={running}
            onStop={stop}
          />
        ) : null}

        {focus !== "edit" ? (
          <ResultPanel
            record={liveRecord}
            output={output}
            running={running}
            stage={stage}
            estimated={estimated}
            copied={copied}
            feedback={feedback}
            onCopy={copy}
            onDownload={download}
            onFeedback={(v) => setFeedback(v)}
            onRegenerate={() => setRegenOpen(true)}
            onOpenDetail={() => navigate(resultId ? `/app/requests?focus=${resultId}` : "/app/requests")}
            onRestoreSource={restoreSource}
            onResolve={(outcome) => {
              if (resultId) resolveRecord(resultId, outcome);
            }}
            onNewTask={() => navigate("/app/scenes")}
          />
        ) : null}
      </div>

      <Drawer
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        title="最近任务"
        subtitle="打开后恢复当时的输入、结果、模型与费用，不会重新生成或再次扣费"
        width="sm:max-w-[400px]"
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-foreground-400">共 {tasks.length} 个任务</span>
            <Button
              size="sm"
              onClick={() => {
                setRecentOpen(false);
                newTask();
              }}
            >
              <i className="ri-add-line" />
              新建任务
            </Button>
          </div>
        }
      >
        <div className="space-y-1">
          {tasks.slice(0, 20).map((task) => {
            const record = records.find((r) => r.id === task.recordId);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => (record ? openTask(record) : undefined)}
                className={cx(
                  "w-full cursor-pointer rounded-lg border px-2.5 py-2.5 text-left transition-colors",
                  task.recordId === resultId
                    ? "border-primary-300 bg-primary-50/60"
                    : "border-transparent hover:bg-background-100",
                )}
              >
                <p className="truncate text-[11.5px] text-foreground-900">{task.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[9.5px] text-foreground-500">
                  <span>{task.scene === "commerce-copy" ? "电商文案" : task.scene === "office-summary" ? "办公摘要" : "结构化提取"}</span>
                  <span className="text-background-300">·</span>
                  <span>{task.model}</span>
                  <span className="text-background-300">·</span>
                  <span className="tnum">{task.cost === null ? "费用待核对" : money(task.cost)}</span>
                  {task.recordId === resultId ? <span className="ml-auto text-primary-600">当前</span> : null}
                </p>
              </button>
            );
          })}
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-foreground-500">还没有任务，先完成一次生成。</p>
          ) : null}
        </div>
      </Drawer>

      <Drawer
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        title="路由解释"
        subtitle="模型、费用与容灾设置"
        width="sm:max-w-[380px]"
      >
        <ModelPanel
          model={model}
          preference={preference}
          cap={singleCap}
          estimated={estimated}
          remaining={remaining}
          record={liveRecord}
          running={running}
          switchNote={switchNote}
          onCandidates={() => setCandidatesOpen(true)}
          onSwitch={() => setSwitchOpen(true)}
          onCollapse={() => setExplainOpen(false)}
        />
      </Drawer>

      <Drawer
        open={candidatesOpen}
        onClose={() => setCandidatesOpen(false)}
        title="候选模型比较"
        subtitle="只用可说明的能力与价格做比较"
        width="sm:max-w-[520px]"
      >
        <div className="space-y-2">
          {availableModels.map((item) => {
            const cost = (12 / 1000) * item.priceIn + (2 / 1000) * item.priceOut;
            return (
              <div key={item.id} className="rounded-xl border border-background-200 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-foreground-950">{item.name}</p>
                    <p className="mt-0.5 text-[10px] text-foreground-500">{item.version} · {item.context} · {item.latency}</p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-xs font-medium text-foreground-900">{money(cost, 3)}</p>
                    <p className="text-[9.5px] text-foreground-400">按 12K 输入 / 2K 输出</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-foreground-600">{item.note}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-background-100 px-2 py-0.5 text-[9.5px] text-foreground-600">{tag}</span>
                  ))}
                  {item.status === "restricted" ? <Badge tone="warning">授权未覆盖</Badge> : null}
                  {item.id === model.id ? <Badge tone="primary">当前推荐</Badge> : null}
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="text-[9.5px] text-foreground-400">演示质量分 {item.quality}</span>
                  <button
                    type="button"
                    disabled={item.status === "restricted"}
                    onClick={() => pickModel(item)}
                    className={cx(
                      "cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-medium",
                      item.status === "restricted"
                        ? "cursor-not-allowed bg-background-100 text-foreground-400"
                        : "bg-primary-50 text-primary-700 hover:bg-primary-100",
                    )}
                  >
                    {item.status === "restricted" ? "权限不足" : "使用此模型"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Drawer>

      <Modal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        title="切换模型"
        description="切换只影响下一个新任务。当前任务的历史与结果保持原模型，不会被替换。"
        footer={
          <>
            <Button variant="outline" onClick={() => setSwitchOpen(false)}>继续使用当前模型</Button>
            <Button onClick={() => pickModel(model)}>确认切换</Button>
          </>
        }
      >
        <div className="space-y-2">
          {availableModels.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickModel(item)}
              className={cx(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                item.id === model.id ? "border-primary-300 bg-primary-50/50" : "border-background-200 hover:border-background-300",
              )}
            >
              <div>
                <p className="text-xs font-medium text-foreground-900">{item.name}</p>
                <p className="mt-0.5 text-[10px] text-foreground-500">
                  {item.context} · {item.structured ? "结构化输出稳定" : "长文生成"} · {money(item.priceIn)} / {money(item.priceOut)}
                </p>
              </div>
              {item.id === model.id ? <Badge tone="primary">当前</Badge> : <i className="ri-arrow-right-line text-foreground-400" />}
            </button>
          ))}
        </div>
        <Notice tone="neutral" icon="ri-information-line">
          上下文超限时不会自动截断或静默摘要；未获得授权时也不会切换成另一个模型继续执行。
        </Notice>
      </Modal>

      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title="重新生成会作为新任务计费"
        description="当前结果会保留在调用记录中，新任务产生独立请求号与费用。"
        footer={
          <>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                setRegenOpen(false);
                run();
              }}
            >
              确认重新生成
            </Button>
          </>
        }
      >
        <div className="rounded-xl bg-background-100/70 p-3.5 text-[11px] leading-relaxed text-foreground-600">
          当前任务实际模型为 <span className="font-medium text-foreground-900">{liveRecord?.model ?? model.name}</span>，
          重新生成会沿用该配置；预估费用 {money(estimated, 3)}，仍受单次上限 {money(singleCap)} 限制。
        </div>
      </Modal>
    </div>
  );
}