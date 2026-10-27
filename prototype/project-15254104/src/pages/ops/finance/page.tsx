import { useState } from "react";
import { Badge, Button, Card, Notice, PageHeader, Tabs } from "@/components/base/ui";
import { opsFinanceDiffs } from "@/mocks/ops";
import { cx } from "@/lib/format";

const tabMap: Record<string, string> = {
  payment: "支付对账",
  consume: "消费对账",
  purchase: "上游采购",
  refund: "退款",
};

export default function OpsFinancePage() {
  const [tab, setTab] = useState("payment");
  const [selected, setSelected] = useState(opsFinanceDiffs[0].id);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const list = opsFinanceDiffs.filter((d) => d.type === tabMap[tab]);
  const current = opsFinanceDiffs.find((d) => d.id === selected) ?? opsFinanceDiffs[0];
  const currentStatus = status[current.id] ?? current.status;

  const update = (next: string) => {
    setStatus((prev) => ({ ...prev, [current.id]: next }));
    setNotice(`${current.subject} 已更新为「${next}」（演示）。每次动作都会记录业务号、金额与原因。`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="对账与退款"
        title="先看差异，再处理差异"
        description="详情采用左右对照：平台记录与外部记录。差异字段高亮，不允许用删除原记录来消除差异。"
      />

      {notice ? <Notice tone="primary" icon="ri-information-line" className="mb-3">{notice}</Notice> : null}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {opsFinanceDiffs.slice(0, 4).map((diff) => (
          <button
            key={diff.id}
            type="button"
            onClick={() => {
              setSelected(diff.id);
              const key = Object.keys(tabMap).find((k) => tabMap[k] === diff.type);
              if (key) setTab(key);
            }}
            className={cx(
              "cursor-pointer rounded-xl border bg-background-50 p-3 text-left transition-colors",
              selected === diff.id ? "border-primary-300" : "border-background-200 hover:border-background-300",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] text-foreground-500">{diff.type}</span>
              <Badge tone={diff.status === "待审核" ? "warning" : diff.status === "核对中" ? "primary" : "neutral"}>{status[diff.id] ?? diff.status}</Badge>
            </div>
            <p className="mt-1 truncate font-mono-ui text-[10px] text-foreground-800">{diff.subject}</p>
            <p className="mt-1 text-[10px] text-foreground-600">差异：{diff.diff}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          items={[
            { id: "payment", label: "支付对账" },
            { id: "consume", label: "消费对账" },
            { id: "purchase", label: "上游采购对账" },
            { id: "refund", label: "退款审核" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <span className="text-[9.5px] text-foreground-400">演示数据 · 不对接真实支付或 New API</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-background-200 px-4 py-2.5">
            <h2 className="text-[11.5px] font-semibold text-foreground-950">{tabMap[tab]}队列</h2>
          </div>
          <div className="divide-y divide-background-100">
            {list.map((diff) => (
              <button
                key={diff.id}
                type="button"
                onClick={() => setSelected(diff.id)}
                className={cx("w-full cursor-pointer px-4 py-3 text-left transition-colors", selected === diff.id ? "bg-primary-50/50" : "hover:bg-background-100/60")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-ui text-[10px] text-foreground-700">{diff.subject}</span>
                  <Badge tone={status[diff.id] === "已确认" ? "success" : (status[diff.id] ?? diff.status) === "待审核" ? "warning" : "primary"}>
                    {status[diff.id] ?? diff.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] text-foreground-500">差异字段：{diff.diff}</p>
              </button>
            ))}
            {list.length === 0 ? <p className="px-4 py-8 text-center text-[11px] text-foreground-500">该类型暂无差异，无需处理。</p> : null}
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground-950">{current.subject}</h2>
                <p className="mt-0.5 text-[10px] text-foreground-500">{current.type} · 差异编号 {current.id}</p>
              </div>
              <Badge tone={currentStatus === "已确认" ? "success" : currentStatus === "待审核" ? "warning" : "primary"}>{currentStatus}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-background-200 p-3">
                <p className="mb-2 text-[9.5px] uppercase tracking-[0.14em] text-foreground-400">平台记录</p>
                <div className="space-y-1.5 text-[10.5px] text-foreground-700">
                  <div className="flex justify-between"><span>金额</span><span className="tnum">{current.platform}</span></div>
                  <div className="flex justify-between"><span>状态</span><span>已记录</span></div>
                  <div className="flex justify-between"><span>来源</span><span>平台账务</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-warning bg-warning-soft/40 p-3">
                <p className="mb-2 text-[9.5px] uppercase tracking-[0.14em] text-warning">外部记录</p>
                <div className="space-y-1.5 text-[10.5px] text-foreground-800">
                  <div className="flex justify-between"><span>金额</span><span className="tnum">{current.external}</span></div>
                  <div className="flex justify-between"><span>状态</span><span className="text-warning">{current.diff}</span></div>
                  <div className="flex justify-between"><span>来源</span><span>支付 / New API / 上游</span></div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => update("待核对")}>标记待核对</Button>
              <Button size="sm" variant="outline" onClick={() => update("核对中")}>查询外部结果</Button>
              <Button size="sm" onClick={() => update("待审核")}>发起审核</Button>
              <Button size="sm" variant="ghost" onClick={() => update("已确认")}>查看冲正记录</Button>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-foreground-400">
              处理动作展示业务号、金额与原因。系统不允许删除原记录来消除差异，退款与补偿以追加记录体现。
            </p>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">冲正与审核记录</p>
            <div className="space-y-2">
              <div className="rounded-lg bg-background-100/70 px-2.5 py-2 text-[10px] text-foreground-700">
                <div className="flex items-center justify-between"><span>rf_20261019_02 · 费用核验</span><span className="tnum">+¥0.06</span></div>
                <p className="mt-0.5 text-[9px] text-foreground-400">2026-10-25 11:08 · 财务 · 何雨 · 关联 req_20261025_1904</p>
              </div>
              <div className="rounded-lg bg-background-100/70 px-2.5 py-2 text-[10px] text-foreground-700">
                <div className="flex items-center justify-between"><span>ord_20260926_09 · 支付失败</span><span className="tnum">¥0.00</span></div>
                <p className="mt-0.5 text-[9px] text-foreground-400">2026-09-26 18:47 · 未入账 · 无需冲正</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}