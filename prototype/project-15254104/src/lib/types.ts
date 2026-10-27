export type SceneId = "commerce-copy" | "office-summary" | "info-extract";

export type Preference = "economy" | "balanced" | "quality";

export type DemoScenario =
  | "success"
  | "quality_fail"
  | "throttle"
  | "interrupt"
  | "unknown"
  | "insufficient_balance"
  | "insufficient_budget"
  | "payment_delay"
  | "sync_fail";

export type ModelStatus = "available" | "unavailable" | "restricted" | "pending";

export type RecordStatus = "completed" | "streaming" | "interrupted" | "unknown" | "failed";

export type BillingStatus = "settled" | "reserved" | "released" | "pending";

export type CheckStatus = "pass" | "fail" | "unverified" | "pending";

export interface Scene {
  id: SceneId;
  name: string;
  tagline: string;
  fit: string;
  output: string;
  inputs: string[];
  checks: string[];
  recommend: Preference;
  action: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  scenes: SceneId[];
  tags: string[];
  context: string;
  structured: boolean;
  priceIn: number;
  priceOut: number;
  status: ModelStatus;
  latency: string;
  note: string;
  channel: string;
  quality: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  scenes: SceneId[];
  monthlyBudget: number;
  spent: number;
  status: "active" | "paused";
  keys: number;
}

export interface ApiKey {
  id: string;
  name: string;
  projectId: string;
  masked: string;
  status: "active" | "disabled" | "revoked";
  createdAt: string;
  expiresAt: string;
  limit: number;
}

export interface ChannelAttempt {
  channel: string;
  result: "success" | "rate_limited" | "timeout";
  latency: string;
}

export interface UsageRecord {
  id: string;
  time: string;
  projectId: string;
  scene: SceneId;
  model: string;
  status: RecordStatus;
  billing: BillingStatus;
  tokensIn: number;
  tokensOut: number;
  cost: number | null;
  duration: string;
  title: string;
  attempts: ChannelAttempt[];
  notes: string;
  prompt?: string;
  output?: string;
  checks?: QualityCheck[];
}

export interface Task {
  id: string;
  title: string;
  scene: SceneId;
  model: string;
  createdAt: string;
  status: RecordStatus;
  cost: number | null;
  recordId: string;
}

export interface Order {
  id: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  createdAt: string;
  channel: string;
  note: string;
}

export interface RefundRequest {
  id: string;
  type: "unused" | "verify";
  recordId: string;
  amount: number;
  reason: string;
  status: "reviewing" | "locked" | "refunding" | "done" | "pending";
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "企业管理员" | "使用成员" | "财务成员";
  projects: string[];
  lastActive: string;
  status: "active" | "invited" | "disabled";
}

export interface DemoState {
  balance: number;
  reserved: number;
  monthBudget: number;
  monthSpend: number;
  singleCap: number;
  scenario: DemoScenario;
  currentProjectId: string;
  projects: Project[];
  keys: ApiKey[];
  records: UsageRecord[];
  tasks: Task[];
  orders: Order[];
  refunds: RefundRequest[];
  members: Member[];
  drafts: Record<string, Draft>;
}

export interface ExecInput {
  scene: SceneId;
  preference: Preference;
  title: string;
  prompt: string;
  projectId: string;
}

export interface ExecSuccess {
  ok: true;
  record: UsageRecord;
  output: string;
  model: ModelInfo;
  estimated: number;
}

export interface ExecFailure {
  ok: false;
  reason: "budget" | "balance";
  message: string;
}

export interface QualityCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface Draft {
  id: string;
  scene: SceneId;
  title: string;
  prompt: string;
  preference: Preference;
}