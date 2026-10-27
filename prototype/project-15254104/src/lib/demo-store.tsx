import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { models, seedKeys, seedMembers, seedOrders, seedProjects, seedRecords, seedRefunds } from "@/mocks/demo";
import { commerceFailOutput, commerceOutput, extractJson, summaryOutput } from "@/mocks/outputs";
import { nowStamp, round4 } from "@/lib/format";
import type {
  ApiKey,
  DemoScenario,
  DemoState,
  Draft,
  ExecFailure,
  ExecInput,
  ExecSuccess,
  Member,
  ModelInfo,
  Project,
  QualityCheck,
  RecordStatus,
  RefundRequest,
  SceneId,
  UsageRecord,
} from "@/lib/types";

const STORAGE_KEY = "hwao-router-demo-v1";

const initialState: DemoState = {
  balance: 1280.5,
  reserved: 0,
  monthBudget: 600,
  monthSpend: 326.4,
  singleCap: 0.1,
  scenario: "success",
  currentProjectId: "proj-default",
  projects: seedProjects as unknown as Project[],
  keys: seedKeys as unknown as ApiKey[],
  records: seedRecords as unknown as UsageRecord[],
  tasks: seedRecords.slice(0, 5).map((r) => ({
    id: r.id.replace("req_", "task_"),
    title: r.title,
    scene: r.scene as SceneId,
    model: r.model,
    createdAt: r.time,
    status: r.status as RecordStatus,
    cost: r.cost,
    recordId: r.id,
  })),
  orders: seedOrders as unknown as DemoState["orders"],
  refunds: seedRefunds as unknown as RefundRequest[],
  members: seedMembers as unknown as Member[],
  drafts: {},
};

export const scenarioOptions: Array<{ id: DemoScenario; label: string; hint: string }> = [
  { id: "success", label: "正常成功", hint: "预算校验通过，正常生成与结算" },
  { id: "quality_fail", label: "质量不通过", hint: "输出新增了输入未提供的事实，检查不通过" },
  { id: "throttle", label: "同模型通道限流", hint: "主通道限流后切换备用通道，模型不变" },
  { id: "interrupt", label: "流式中断", hint: "保留部分输出，按实际用量结算" },
  { id: "unknown", label: "结果未知", hint: "执行与费用待核对，不提供直接重试" },
  { id: "insufficient_budget", label: "预算不足", hint: "项目预算低于本次预估费用" },
  { id: "insufficient_balance", label: "余额不足", hint: "企业钱包余额不足以覆盖本次调用" },
  { id: "payment_delay", label: "支付回调延迟", hint: "充值订单进入待入账，可查询进度" },
  { id: "sync_fail", label: "同步失败", hint: "运营侧策略发布同步失败，保留草稿" },
];

const pickModel = (preference: string): ModelInfo => {
  const target = preference === "economy" ? "model-b" : preference === "quality" ? "model-c" : "model-a";
  return (models.find((m) => m.id === target) ?? models[0]) as unknown as ModelInfo;
};

const sceneOutput = (scene: SceneId) => {
  if (scene === "office-summary") return summaryOutput;
  if (scene === "info-extract") return extractJson;
  return commerceOutput;
};

const checksFor = (scene: SceneId, passed: boolean): QualityCheck[] => {
  const factLabel = scene === "commerce-copy" ? "商品事实一致" : scene === "office-summary" ? "未引入原文外信息" : "未猜测原文缺失字段";
  const secondary: QualityCheck =
    scene === "commerce-copy"
      ? { key: "banned", label: "禁用词", status: "pass", detail: "未命中禁用词：最好、第一、永久" }
      : scene === "office-summary"
        ? { key: "numbers", label: "关键数字保留", status: "pass", detail: "214 条 / 78 条 / 1.6 天等关键数字与原文一致" }
        : { key: "types", label: "字段类型校验", status: "pass", detail: "8 个字段类型全部通过，允许空字段已标记" };
  return [
    {
      key: "facts",
      label: factLabel,
      status: passed ? "pass" : "fail",
      detail: passed
        ? "输出内容与输入一致，未新增未提供的商品事实"
        : "输出新增了输入未提供的「无塑接触设计」「十年质保」「附赠备用密封圈」",
    },
    secondary,
    { key: "length", label: "长度与格式", status: "pass", detail: "段落与长度符合渠道要求" },
  ];
};

const estimate = (record: Pick<UsageRecord, "tokensIn" | "tokensOut">, modelName: string) => {
  const model = (models.find((m) => m.name === modelName) ?? models[0]) as unknown as ModelInfo;
  return round4((record.tokensIn / 1_000_000) * model.priceIn + (record.tokensOut / 1_000_000) * model.priceOut);
};

interface DemoContextValue extends DemoState {
  setScenario: (scenario: DemoScenario) => void;
  setCurrentProject: (projectId: string) => void;
  saveDraft: (payload: Omit<Draft, "id">) => string;
  removeDraft: (id: string) => void;
  executeTask: (input: ExecInput) => ExecSuccess | ExecFailure;
  finalizeRecord: (id: string) => void;
  interruptRecord: (id: string) => void;
  resolveRecord: (id: string, outcome: "completed" | "failed") => void;
  updateBudget: (payload: { monthBudget?: number; singleCap?: number }) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  createProject: (payload: { name: string; description: string; budget: number }) => Project;
  createKey: (payload: { name: string; projectId: string; limit: number; expiresAt: string }) => { key: ApiKey; plain: string };
  setKeyStatus: (id: string, status: ApiKey["status"]) => void;
  createRecharge: (amountValue: number) => string;
  settleOrder: (id: string) => void;
  failOrder: (id: string) => void;
  createRefund: (payload: { type: RefundRequest["type"]; recordId: string; amount: number; reason: string }) => string;
  advanceRefund: (id: string) => void;
  inviteMember: (payload: { email: string; role: Member["role"]; projects: string[] }) => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const loadState = (): DemoState => {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || !Array.isArray(parsed.records)) return initialState;
    return { ...initialState, ...parsed };
  } catch {
    return initialState;
  }
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 演示状态写入失败不影响页面使用 */
    }
  }, [state]);

  const setScenario = useCallback((scenario: DemoScenario) => {
    setState((prev) => ({ ...prev, scenario }));
  }, []);

  const setCurrentProject = useCallback((projectId: string) => {
    setState((prev) => ({ ...prev, currentProjectId: projectId }));
  }, []);

  const saveDraft = useCallback((payload: Omit<Draft, "id">) => {
    const id = `draft_${Date.now()}`;
    setState((prev) => ({ ...prev, drafts: { ...prev.drafts, [id]: { ...payload, id } } }));
    return id;
  }, []);

  const removeDraft = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev.drafts };
      delete next[id];
      return { ...prev, drafts: next };
    });
  }, []);

  const executeTask = useCallback(
    (input: ExecInput): ExecSuccess | ExecFailure => {
      const model = pickModel(input.preference);
      const tokensIn = input.preference === "economy" ? 9600 : input.preference === "quality" ? 14400 : 12000;
      const tokensOut = input.preference === "economy" ? 1800 : input.preference === "quality" ? 2400 : 2000;
      const cost = round4((tokensIn / 1_000_000) * model.priceIn + (tokensOut / 1_000_000) * model.priceOut);
      const project = state.projects.find((p) => p.id === input.projectId) ?? state.projects[0];
      const remainingBudget = state.monthBudget - state.monthSpend - state.reserved;

      if (state.scenario === "insufficient_budget" || state.scenario === "insufficient_balance") {
        const isBudget = state.scenario === "insufficient_budget";
        return {
          ok: false,
          reason: isBudget ? "budget" : "balance",
          message: isBudget
            ? `项目「${project.name}」剩余预算不足以覆盖本次预估费用 ${cost.toFixed(2)} 元。`
            : `企业可用余额不足以覆盖本次预估费用 ${cost.toFixed(2)} 元，请先充值。`,
        };
      }
      if (cost > state.singleCap) {
        return {
          ok: false,
          reason: "budget",
          message: `本次预估费用 ${cost.toFixed(2)} 元超过单次费用上限 ${state.singleCap.toFixed(2)} 元，请调整上限或改用经济模式。`,
        };
      }
      if (cost > remainingBudget) {
        return {
          ok: false,
          reason: "budget",
          message: `本月剩余预算 ${remainingBudget.toFixed(2)} 元不足以覆盖本次费用 ${cost.toFixed(2)} 元，请调整预算分配。`,
        };
      }
      if (cost > state.balance) {
        return {
          ok: false,
          reason: "balance",
          message: `企业可用余额 ${state.balance.toFixed(2)} 元不足以覆盖本次费用 ${cost.toFixed(2)} 元，请先充值。`,
        };
      }

      const scenario = state.scenario;
      let status: RecordStatus = "streaming";
      let billing: UsageRecord["billing"] = "reserved";
      let finalCost: number | null = cost;
      let output = scenario === "quality_fail" ? commerceFailOutput : sceneOutput(input.scene);
      const passed = scenario !== "quality_fail";
      let notes = passed ? "事实、禁用词、长度与格式四项检查通过（示例检查结果）。" : "质量检查未通过：输出新增了输入未提供的商品事实。";
      let tokensOutActual = tokensOut;
      const attempts =
        scenario === "throttle"
          ? [
              { channel: `${model.channel} 主通道`, result: "rate_limited" as const, latency: "0.4s" },
              { channel: `${model.channel} 备用通道`, result: "success" as const, latency: "1.6s" },
            ]
          : [{ channel: `${model.channel} 主通道`, result: "success" as const, latency: "1.2s" }];

      if (scenario === "throttle") notes = "主通道限流后切换同模型备用通道，实际模型未变化，仅产生一个净费用。";
      if (scenario === "interrupt") {
        status = "interrupted";
        billing = "settled";
        finalCost = round4(cost * 0.72);
        tokensOutActual = Math.round(tokensOut * 0.6);
        output = `${output.slice(0, Math.max(120, Math.floor(output.length * 0.45)))}…`;
        notes = "流式输出中断，已发生用量按实际结算，可申请费用核验。";
      }
      if (scenario === "unknown") {
        status = "unknown";
        billing = "pending";
        finalCost = null;
        output = "";
        notes = "执行结果与费用正在核对，暂不提供重新执行。";
      }

      const stamp = Date.now();
      const record: UsageRecord = {
        id: `req_${stamp}`,
        time: nowStamp(),
        projectId: project.id,
        scene: input.scene,
        model: model.name,
        status,
        billing,
        tokensIn,
        tokensOut: tokensOutActual,
        cost: finalCost,
        duration: status === "streaming" ? "进行中" : "4.2s",
        title: input.title,
        attempts,
        notes,
        prompt: input.prompt,
        output,
        checks: checksFor(input.scene, passed),
      };

      setState((prev) => {
        const nextReserved =
          status === "interrupted" ? prev.reserved : round4(prev.reserved + cost);
        return {
          ...prev,
          records: [record, ...prev.records],
          tasks: [
            {
              id: `task_${stamp}`,
              title: input.title,
              scene: input.scene,
              model: model.name,
              createdAt: record.time,
              status,
              cost: finalCost,
              recordId: record.id,
            },
            ...prev.tasks,
          ],
          reserved: nextReserved,
          balance: status === "interrupted" ? round4(prev.balance - (finalCost ?? 0)) : prev.balance,
          monthSpend: status === "interrupted" ? round4(prev.monthSpend + (finalCost ?? 0)) : prev.monthSpend,
          projects:
            status === "interrupted"
              ? prev.projects.map((p) =>
                  p.id === project.id ? { ...p, spent: round4(p.spent + (finalCost ?? 0)) } : p,
                )
              : prev.projects,
        };
      });

      return { ok: true, record, output, model, estimated: cost };
    },
    [state],
  );

  const settle = useCallback((id: string, overrideStatus?: RecordStatus, overrideCost?: number) => {
    setState((prev) => {
      const record = prev.records.find((r) => r.id === id);
      if (!record) return prev;
      const cost = overrideCost ?? record.cost ?? estimate(record, record.model);
      const status = overrideStatus ?? "completed";
      return {
        ...prev,
        balance: round4(prev.balance - cost),
        monthSpend: round4(prev.monthSpend + cost),
        reserved: round4(Math.max(0, prev.reserved - (record.cost ?? estimate(record, record.model)))),
        records: prev.records.map((r) =>
          r.id === id
            ? { ...r, status, billing: "settled", cost, duration: r.duration === "进行中" ? "4.2s" : r.duration }
            : r,
        ),
        tasks: prev.tasks.map((t) => (t.recordId === id ? { ...t, status, cost } : t)),
        projects: prev.projects.map((p) =>
          p.id === record.projectId ? { ...p, spent: round4(p.spent + cost) } : p,
        ),
      };
    });
  }, []);

  const finalizeRecord = useCallback(
    (id: string) => {
      settle(id, "completed");
    },
    [settle],
  );

  const interruptRecord = useCallback(
    (id: string) => {
      setState((prev) => {
        const record = prev.records.find((r) => r.id === id);
        if (!record || record.status !== "streaming") return prev;
        const est = record.cost ?? estimate(record, record.model);
        const cost = round4(est * 0.72);
        return {
          ...prev,
          balance: round4(prev.balance - cost),
          monthSpend: round4(prev.monthSpend + cost),
          reserved: round4(Math.max(0, prev.reserved - est)),
          records: prev.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "interrupted",
                  billing: "settled",
                  cost,
                  tokensOut: Math.round(r.tokensOut * 0.6),
                  duration: "3.1s",
                  notes: "用户停止生成，已发生用量按实际结算。",
                }
              : r,
          ),
          tasks: prev.tasks.map((t) => (t.recordId === id ? { ...t, status: "interrupted", cost } : t)),
          projects: prev.projects.map((p) =>
            p.id === record.projectId ? { ...p, spent: round4(p.spent + cost) } : p,
          ),
        };
      });
    },
    [],
  );

  const resolveRecord = useCallback((id: string, outcome: "completed" | "failed") => {
    setState((prev) => {
      const record = prev.records.find((r) => r.id === id);
      if (!record) return prev;
      const est = estimate(record, record.model);
      if (outcome === "completed") {
        return {
          ...prev,
          balance: round4(prev.balance - est),
          monthSpend: round4(prev.monthSpend + est),
          reserved: round4(Math.max(0, prev.reserved - est)),
          records: prev.records.map((r) =>
            r.id === id
              ? { ...r, status: "completed", billing: "settled", cost: est, notes: "核对完成，执行成功并已结算。" }
              : r,
          ),
          tasks: prev.tasks.map((t) => (t.recordId === id ? { ...t, status: "completed", cost: est } : t)),
          projects: prev.projects.map((p) =>
            p.id === record.projectId ? { ...p, spent: round4(p.spent + est) } : p,
          ),
        };
      }
      return {
        ...prev,
        reserved: round4(Math.max(0, prev.reserved - est)),
        records: prev.records.map((r) =>
          r.id === id
            ? { ...r, status: "failed", billing: "released", cost: 0, notes: "核对完成，执行失败，预扣额度已释放。" }
            : r,
        ),
        tasks: prev.tasks.map((t) => (t.recordId === id ? { ...t, status: "failed", cost: 0 } : t)),
      };
    });
  }, []);

  const updateBudget = useCallback((payload: { monthBudget?: number; singleCap?: number }) => {
    setState((prev) => ({
      ...prev,
      monthBudget: payload.monthBudget ?? prev.monthBudget,
      singleCap: payload.singleCap ?? prev.singleCap,
    }));
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const createProject = useCallback((payload: { name: string; description: string; budget: number }) => {
    const project: Project = {
      id: `proj_${Date.now()}`,
      name: payload.name,
      description: payload.description,
      owner: "林晨",
      scenes: ["commerce-copy", "office-summary"],
      monthlyBudget: payload.budget,
      spent: 0,
      status: "active",
      keys: 0,
    };
    setState((prev) => ({ ...prev, projects: [...prev.projects, project], currentProjectId: project.id }));
    return project;
  }, []);

  const createKey = useCallback(
    (payload: { name: string; projectId: string; limit: number; expiresAt: string }) => {
      const suffix = Math.random().toString(36).slice(2, 6);
      const plain = `demo_hr_${suffix}${Math.random().toString(36).slice(2, 10)}`;
      const key: ApiKey = {
        id: `key_${Date.now()}`,
        name: payload.name,
        projectId: payload.projectId,
        masked: `demo_hr_${plain.slice(8, 12)}••••••••${plain.slice(-4)}`,
        status: "active",
        createdAt: nowStamp().slice(0, 10),
        expiresAt: payload.expiresAt,
        limit: payload.limit,
      };
      setState((prev) => ({ ...prev, keys: [key, ...prev.keys] }));
      return { key, plain };
    },
    [],
  );

  const setKeyStatus = useCallback((id: string, status: ApiKey["status"]) => {
    setState((prev) => ({ ...prev, keys: prev.keys.map((k) => (k.id === id ? { ...k, status } : k)) }));
  }, []);

  const createRecharge = useCallback((amountValue: number) => {
    const id = `ord_${Date.now()}`;
    setState((prev) => ({
      ...prev,
      orders: [
        { id, amount: amountValue, status: "pending", createdAt: nowStamp(), channel: "演示支付", note: "等待回调入账" },
        ...prev.orders,
      ],
    }));
    return id;
  }, []);

  const settleOrder = useCallback((id: string) => {
    setState((prev) => {
      const order = prev.orders.find((o) => o.id === id);
      if (!order || order.status === "paid") return prev;
      return {
        ...prev,
        balance: round4(prev.balance + order.amount),
        orders: prev.orders.map((o) => (o.id === id ? { ...o, status: "paid", note: "已入账 · 演示支付" } : o)),
      };
    });
  }, []);

  const failOrder = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === id ? { ...o, status: "failed", note: "支付失败 · 未入账" } : o)),
    }));
  }, []);

  const createRefund = useCallback(
    (payload: { type: RefundRequest["type"]; recordId: string; amount: number; reason: string }) => {
      const id = `rf_${Date.now()}`;
      setState((prev) => ({
        ...prev,
        refunds: [
          {
            ...payload,
            id,
            status: "reviewing",
            createdAt: nowStamp(),
          },
          ...prev.refunds,
        ],
      }));
      return id;
    },
    [],
  );

  const advanceRefund = useCallback((id: string) => {
    const order: RefundRequest["status"][] = ["reviewing", "locked", "refunding", "done"];
    setState((prev) => ({
      ...prev,
      refunds: prev.refunds.map((r) => {
        if (r.id !== id) return r;
        const idx = order.indexOf(r.status);
        const next = order[Math.min(order.length - 1, Math.max(0, idx) + 1)];
        return { ...r, status: next };
      }),
      balance:
        prev.refunds.find((r) => r.id === id)?.status === "refunding"
          ? round4(prev.balance + (prev.refunds.find((r) => r.id === id)?.amount ?? 0))
          : prev.balance,
    }));
  }, []);

  const inviteMember = useCallback((payload: { email: string; role: Member["role"]; projects: string[] }) => {
    setState((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        {
          id: `m_${Date.now()}`,
          name: payload.email.split("@")[0],
          email: payload.email,
          role: payload.role,
          projects: payload.projects,
          lastActive: "—",
          status: "invited",
        },
      ],
    }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      ...state,
      setScenario,
      setCurrentProject,
      saveDraft,
      removeDraft,
      executeTask,
      finalizeRecord,
      interruptRecord,
      resolveRecord,
      updateBudget,
      updateProject,
      createProject,
      createKey,
      setKeyStatus,
      createRecharge,
      settleOrder,
      failOrder,
      createRefund,
      advanceRefund,
      inviteMember,
      resetDemo,
    }),
    [
      state,
      setScenario,
      setCurrentProject,
      saveDraft,
      removeDraft,
      executeTask,
      finalizeRecord,
      interruptRecord,
      resolveRecord,
      updateBudget,
      updateProject,
      createProject,
      createKey,
      setKeyStatus,
      createRecharge,
      settleOrder,
      failOrder,
      createRefund,
      advanceRefund,
      inviteMember,
      resetDemo,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}