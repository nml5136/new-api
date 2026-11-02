// 个人额度 / 在线充值 / 订阅 —— 全部复用 New API 原生接口（/api/user/*、/api/subscription/*），hwao 不新增后端。
// 额度换算：New API 内部额度 quota，quota_per_unit 额度 = 1 个充值单位（美元口径）；
// 人民币展示 = 单位数 × usd_exchange_rate（与 hwao 企业钱包 QuotaToFen 同口径）。
import { get } from "@/lib/api";

export interface PayStatus {
  quotaPerUnit: number; // 每单位额度
  usdRate: number; // 1 单位 = 多少元（额度价值口径）
  price: number; // 易支付：1 单位实付多少元
}

let cached: PayStatus | null = null;
export async function payStatus(): Promise<PayStatus> {
  if (cached) return cached;
  const r = await fetch("/api/status").then((x) => x.json());
  const d = r?.data || {};
  cached = { quotaPerUnit: d.quota_per_unit || 500000, usdRate: d.usd_exchange_rate || 7.3, price: d.price || 7.3 };
  return cached;
}

// quota → 人民币元（额度价值）
export const quotaYuan = (q: number, s: PayStatus) => (q / s.quotaPerUnit) * s.usdRate;
// 人民币元 → quota（向下取整，避免多发）
export const yuanQuota = (y: number, s: PayStatus) => Math.floor((y / s.usdRate) * s.quotaPerUnit);

// 以表单 POST 跳转到支付网关收银台（易支付标准做法，参数已由后端签名）
export function submitPayForm(url: string, params: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  Object.entries(params).forEach(([k, v]) => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
}

export const listPage = async <T = any>(path: string) => {
  const d = await get<any>(path);
  return (d?.items || d || []) as T[];
};

export const PREF_LABEL: Record<string, string> = {
  subscription_first: "优先扣订阅额度，用完再扣余额",
  wallet_first: "优先扣余额，余额不足再扣订阅",
  subscription_only: "只扣订阅额度",
  wallet_only: "只扣余额",
};

// 订阅套餐时长 / 额度重置周期中文名（New API 返回英文枚举）
export const DURATION_UNIT: Record<string, string> = { year: "年", month: "个月", day: "天", hour: "小时", custom: "（自定义）" };
export const RESET_PERIOD: Record<string, string> = { never: "不重置", daily: "每天重置", weekly: "每周重置", monthly: "每月重置", custom: "自定义周期" };
export const durationText = (v: number, u: string) => `${v} ${DURATION_UNIT[u] || u}`;
export const resetText = (p: string) => RESET_PERIOD[p] || p;
