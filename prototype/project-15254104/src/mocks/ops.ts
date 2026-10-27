export const opsMetrics = [
  { label: "今日服务收入", value: "¥4,286.40", delta: "+6.2%", note: "演示样例" },
  { label: "预估采购成本", value: "¥2,914.80", delta: "未对账", note: "预估" },
  { label: "贡献毛利", value: "¥1,371.60", delta: "31.9%", note: "演示样例" },
  { label: "业务成功率", value: "99.2%", delta: "近 24 小时", note: "演示样例" },
];

export const opsQueue = [
  { id: "q1", title: "支付回调延迟 1 笔", meta: "星澜科技 · 订单 ord_20261026_41 · ¥200", tone: "warning", action: "查询外部结果" },
  { id: "q2", title: "上游渠道授权 7 天后到期", meta: "渠道组 C-1 · 示例模型 C", tone: "warning", action: "查看授权" },
  { id: "q3", title: "退款待审核 1 笔", meta: "rf_20261025_07 · ¥0.06 费用核验", tone: "primary", action: "进入审核" },
  { id: "q4", title: "渠道 B-2 错误率上升", meta: "近 1 小时 4.1% · 已自动降权", tone: "danger", action: "查看告警" },
];

export const opsChannels = [
  { id: "ch-a1", name: "A-1 主通道", group: "示例模型 A", status: "健康", latency: "1.2s", errorRate: "0.2%", note: "主力通道" },
  { id: "ch-a2", name: "A-2 备用通道", group: "示例模型 A", status: "健康", latency: "1.8s", errorRate: "0.4%", note: "需在场景策略中启用兜底" },
  { id: "ch-b2", name: "B-2 主通道", group: "示例模型 B", status: "降权", latency: "2.6s", errorRate: "4.1%", note: "错误率上升，已降低权重" },
  { id: "ch-c1", name: "C-1 主通道", group: "示例模型 C", status: "授权到期", latency: "3.4s", errorRate: "0.6%", note: "授权 7 天后到期" },
  { id: "ch-e2", name: "E-2 主通道", group: "示例模型 E", status: "暂停销售", latency: "—", errorRate: "—", note: "暂不对外销售" },
];

export const opsSyncLogs = [
  { time: "2026-10-26 09:20", action: "资源同步", result: "成功", detail: "新增 1 个候选模型，更新 3 个价格版本" },
  { time: "2026-10-25 21:05", action: "资源同步", result: "部分失败", detail: "渠道 C-1 回读超时，已保留上次可用快照" },
  { time: "2026-10-24 10:30", action: "连接测试", result: "成功", detail: "New API 适配层响应 240ms" },
];

export const opsStrategies = [
  {
    id: "st-copy",
    scene: "电商文案",
    version: "v1.4",
    published: "2026-10-22",
    gate: "质量达标率 ≥ 90%",
    candidates: ["示例模型 A", "示例模型 B"],
    status: "已发布",
    lastEval: "10-22 评测通过",
  },
  {
    id: "st-summary",
    scene: "办公摘要",
    version: "v1.2",
    published: "2026-10-18",
    gate: "要点召回 ≥ 88%",
    candidates: ["示例模型 A", "示例模型 E"],
    status: "已发布",
    lastEval: "10-18 评测通过",
  },
  {
    id: "st-extract",
    scene: "结构化提取",
    version: "v0.9 草稿",
    published: "—",
    gate: "字段准确率 ≥ 95%",
    candidates: ["示例模型 C", "示例模型 A"],
    status: "草稿",
    lastEval: "待发布验证",
  },
];

export const opsEvaluations = [
  { id: "ev-0611", name: "电商文案 · 10 月样本集", samples: 120, pass: "92.5%", cost: "¥0.043", duration: "3.9s", status: "已完成" },
  { id: "ev-0610", name: "结构化提取 · 合同样本", samples: 80, pass: "95.0%", cost: "¥0.094", duration: "5.2s", status: "已完成" },
  { id: "ev-0609", name: "办公摘要 · 长文复核", samples: 64, pass: "88.1%", cost: "¥0.038", duration: "4.4s", status: "已完成" },
  { id: "ev-0608", name: "电商文案 · 低价候选对比", samples: 120, pass: "79.4%", cost: "¥0.021", duration: "1.7s", status: "未达门槛" },
];

export const opsEvalRows = [
  { model: "示例模型 A", pass: "92.5%", cost: "¥0.043", latency: "3.9s", verdict: "满足门槛" },
  { model: "示例模型 B", pass: "79.4%", cost: "¥0.021", latency: "1.7s", verdict: "质量不足" },
  { model: "示例模型 C", pass: "96.0%", cost: "¥0.094", latency: "5.2s", verdict: "满足门槛" },
];

export const opsCustomers = [
  { id: "c-01", name: "星澜科技", status: "已启用", scope: "A / B / C", spend: "¥326.44", quota: "正常", last: "刚刚" },
  { id: "c-02", name: "禾南贸易", status: "已启用", scope: "A / B", spend: "¥1,204.20", quota: "80% 预警", last: "23 分钟前" },
  { id: "c-03", name: "朝雾设计", status: "开通中", scope: "A", spend: "¥0.00", quota: "—", last: "1 小时前" },
  { id: "c-04", name: "经纬物流", status: "已暂停", scope: "A / C", spend: "¥842.60", quota: "已暂停新请求", last: "昨天" },
  { id: "c-05", name: "沐光传媒", status: "已启用", scope: "A / B / C", spend: "¥2,118.90", quota: "正常", last: "3 小时前" },
];

export const opsPriceVersions = [
  { id: "pv-04", model: "示例模型 A", purchase: "¥1.35 / ¥5.40", retail: "¥2.00 / ¥8.00", scope: "全部企业", tax: "含税", effective: "2026-10-01 生效", status: "生效中" },
  { id: "pv-03", model: "示例模型 B", purchase: "¥0.78 / ¥2.90", retail: "¥1.20 / ¥4.50", scope: "全部企业", tax: "含税", effective: "2026-09-15 生效", status: "生效中" },
  { id: "pv-02", model: "示例模型 C", purchase: "¥2.80 / ¥9.60", retail: "¥4.00 / ¥14.00", scope: "已授权企业", tax: "含税", effective: "2026-10-08 生效", status: "生效中" },
  { id: "pv-01", model: "示例模型 E", purchase: "¥2.10 / ¥6.30", retail: "¥3.20 / ¥9.60", scope: "待授权", tax: "待确认", effective: "未发布", status: "草稿" },
];

export const opsFinanceDiffs = [
  { id: "df-081", type: "支付对账", subject: "ord_20261026_41", platform: "¥200.00 已入账", external: "回调延迟，外部显示处理中", diff: "状态不一致", status: "待核对" },
  { id: "df-080", type: "消费对账", subject: "req_20261024_1050", platform: "待核对", external: "New API 用量 11,000 Token", diff: "费用未结算", status: "核对中" },
  { id: "df-079", type: "上游采购", subject: "2026-10 上半月", platform: "¥2,914.80", external: "¥2,948.10", diff: "+¥33.30", status: "待审核" },
  { id: "df-078", type: "退款", subject: "rf_20261025_07", platform: "¥0.06", external: "待退款", diff: "—", status: "待审核" },
];

export const opsAlerts = [
  { id: "al-31", level: "严重", title: "渠道 B-2 错误率超过阈值", impact: "影响使用经济模式的 12 个企业", time: "2026-10-26 08:58", owner: "值班 · 陈屿", status: "处理中" },
  { id: "al-30", level: "警告", title: "支付回调延迟", impact: "1 笔订单未入账，客户余额未更新", time: "2026-10-26 08:12", owner: "值班 · 何雨", status: "已定位" },
  { id: "al-29", level: "提示", title: "渠道 C-1 授权临期", impact: "7 天后到期，影响结构化提取候选", time: "2026-10-25 17:40", owner: "资源组 · 唐勉", status: "待处理" },
];

export const opsAudits = [
  { id: "au-412", time: "2026-10-25 16:22", actor: "运营 · 陈屿", action: "修改场景策略", target: "电商文案 v1.4", detail: "新增同模型备用通道兜底，质量门槛未变" },
  { id: "au-411", time: "2026-10-25 11:08", actor: "财务 · 何雨", action: "审核退款", target: "rf_20261019_02", detail: "通过费用核验，追加补偿记录 ¥0.06" },
  { id: "au-410", time: "2026-10-24 19:31", actor: "运营 · 唐勉", action: "暂停销售", target: "示例模型 E", detail: "授权未覆盖，暂停对全部企业销售" },
  { id: "au-409", time: "2026-10-24 10:02", actor: "系统", action: "资源同步", target: "New API 适配层", detail: "同步部分失败，保留上次可用快照" },
];

export const docsNav = [
  { id: "quickstart", label: "快速接入" },
  { id: "auth", label: "认证与密钥" },
  { id: "scene", label: "按场景调用" },
  { id: "headers", label: "平台请求头" },
  { id: "session", label: "会话保持" },
  { id: "billing", label: "费用查询" },
  { id: "errors", label: "错误与重试" },
];