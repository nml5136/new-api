export const money = (value: number, digits = 2) =>
  `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const amount = (value: number, digits = 2) =>
  value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const tokens = (value: number) => value.toLocaleString("en-US");

export const cx = (...list: Array<string | false | null | undefined>) => list.filter(Boolean).join(" ");

export const round4 = (value: number) => Math.round(value * 10000) / 10000;

export const nowStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const sceneLabel = (id: string) => {
  if (id === "commerce-copy") return "电商文案";
  if (id === "office-summary") return "办公摘要";
  if (id === "info-extract") return "结构化提取";
  return id;
};

export const recordStatusMeta: Record<
  string,
  { label: string; tone: "success" | "primary" | "warning" | "danger" | "neutral" }
> = {
  completed: { label: "已完成", tone: "success" },
  streaming: { label: "生成中", tone: "primary" },
  interrupted: { label: "部分输出后中断", tone: "warning" },
  unknown: { label: "结果待确认", tone: "warning" },
  failed: { label: "执行失败", tone: "danger" },
};

export const billingStatusMeta: Record<
  string,
  { label: string; tone: "success" | "primary" | "warning" | "danger" | "neutral" }
> = {
  settled: { label: "已结算", tone: "success" },
  reserved: { label: "预扣中", tone: "primary" },
  pending: { label: "待核对", tone: "warning" },
  released: { label: "已释放", tone: "neutral" },
};