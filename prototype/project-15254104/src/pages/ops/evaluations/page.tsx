import { useState } from "react";
import { Badge, Button, Card, Modal, PageHeader, ProgressBar } from "@/components/base/ui";
import { opsEvaluations, opsEvalRows } from "@/mocks/ops";
import { cx } from "@/lib/format";

const sampleRows = [
  { id: "s-01", task: "秋季保温杯详情页", result: "通过", note: "卖点未新增事实" },
  { id: "s-02", task: "双十一预热短文案", result: "通过", note: "长度符合渠道限制" },
  { id: "s-03", task: "家居活动页文案", result: "不通过", note: "出现禁用词" },
  { id: "s-04", task: "通勤杯社媒文案", result: "通过", note: "语气一致" },
];

export default function OpsEvaluationsPage() {
  const [selected, setSelected] = useState(opsEvaluations[0].id);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("电商文案 · 11 月样本集");
  const [scene, setScene] = useState("电商文案");
  const [samples, setSamples] = useState("120");
  const [rows, setRows] = useState(sampleRows);
  const [notice, setNotice] = useState("");

  const job = opsEvaluations.find((j) => j.id === selected) ?? opsEvaluations[0];

  return (
    <div>
      <PageHeader
        eyebrow="评测中心"
        title="质量与成本一起决定能不能发布"
        description="结果区包含质量达标率、每个合格结果成本、耗时分布与样本数量。低价但质量不足的候选会明确标注不满足发布门槛。"
        actions={<Button onClick={() => setOpen(true)}><i className="ri-add-line" />新建评测</Button>}
      />

      {notice ? (
        <div className="mb-3 rounded-xl border border-primary-200 bg-primary-50 px-3.5 py-2.5 text-[11px] text-primary-800">{notice}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit overflow-hidden">
          <p className="border-b border-background-100 px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-foreground-400">评测任务</p>
          <div className="divide-y divide-background-100">
            {opsEvaluations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={cx("w-full cursor-pointer px-4 py-3 text-left transition-colors", selected === item.id ? "bg-primary-50/60" : "hover:bg-background-100/70")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-foreground-900">{item.name}</span>
                  <Badge tone={item.status === "已完成" ? "success" : "warning"}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-[9.5px] text-foreground-500">{item.id} · {item.samples} 个样本</p>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground-950">{job.name}</h2>
                <p className="mt-0.5 text-[10px] text-foreground-500">{job.id} · 样本 {job.samples} 个 · 最后运行 2026-10-26</p>
              </div>
              <Badge tone={job.status === "已完成" ? "success" : "warning"}>{job.status}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "质量达标率", value: job.pass },
                { label: "每个合格结果成本", value: job.cost },
                { label: "平均耗时", value: job.duration },
                { label: "样本数量", value: `${job.samples}` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-background-100/60 p-3">
                  <p className="text-[9.5px] text-foreground-500">{item.label}</p>
                  <p className="tnum mt-1 text-base font-semibold text-foreground-950">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-foreground-400">候选模型对比</p>
              <div className="overflow-hidden rounded-xl border border-background-200">
                <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-2 bg-background-100/60 px-3 py-2 text-[9.5px] text-foreground-500">
                  <span>模型</span><span>质量达标率</span><span>合格成本</span><span>耗时</span><span>结论</span>
                </div>
                <div className="divide-y divide-background-100">
                  {opsEvalRows.map((row) => (
                    <div key={row.model} className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.9fr] items-center gap-2 px-3 py-2 text-[10.5px]">
                      <span className="text-foreground-900">{row.model}</span>
                      <span className={cx("tnum", row.verdict === "质量不足" ? "text-danger" : "text-foreground-700")}>{row.pass}</span>
                      <span className="tnum text-foreground-700">{row.cost}</span>
                      <span className="tnum text-foreground-700">{row.latency}</span>
                      <span>
                        <Badge tone={row.verdict === "满足门槛" ? "success" : "danger"}>{row.verdict}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-[120px] shrink-0 text-[9.5px] text-foreground-500">A 达标率 92.5%</span>
                  <ProgressBar value={92.5} tone="success" />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-[120px] shrink-0 text-[9.5px] text-foreground-500">B 达标率 79.4%</span>
                  <ProgressBar value={79.4} tone="warning" />
                </div>
                <p className="mt-2 text-[9px] text-foreground-400">B 价格更低，但低于 90% 质量底线，不满足发布门槛。</p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-background-200 px-4 py-2.5">
              <h3 className="text-[11.5px] font-semibold text-foreground-950">样本与标注</h3>
              <span className="text-[9.5px] text-foreground-400">演示 / 授权样本</span>
            </div>
            <div className="divide-y divide-background-100">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10.5px] text-foreground-900">{row.task}</p>
                    <p className="mt-0.5 text-[9.5px] text-foreground-500">{row.id} · {row.note}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, result: "通过", note: "已由运营标注为通过" } : r)))}
                      className={cx("cursor-pointer rounded-md border px-2 py-1 text-[9.5px]", row.result === "通过" ? "border-success bg-success-soft text-success" : "border-background-300 text-foreground-600 hover:border-success")}
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, result: "不通过", note: "已由运营标注为不通过" } : r)))}
                      className={cx("cursor-pointer rounded-md border px-2 py-1 text-[9.5px]", row.result === "不通过" ? "border-danger bg-danger-soft text-danger" : "border-background-300 text-foreground-600 hover:border-danger")}
                    >
                      不通过
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="新建评测"
        description="评测使用演示或授权样本，不抓取客户对话正文。"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button
              onClick={() => {
                setOpen(false);
                setNotice(`评测「${name}」已提交：${scene} · ${samples} 个样本。演示环境不执行真实评测。`);
              }}
            >
              提交评测
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">评测名称</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:border-primary-400 focus:outline-none" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">场景</span>
            <select value={scene} onChange={(e) => setScene(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:outline-none">
              <option>电商文案</option>
              <option>办公摘要</option>
              <option>结构化提取</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">样本数量</span>
            <input type="number" value={samples} onChange={(e) => setSamples(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:border-primary-400 focus:outline-none" />
          </label>
        </div>
        <p className="text-[10px] leading-relaxed text-foreground-500">
          评测将比较候选模型的质量达标率与每个合格结果成本。低于发布门槛的候选不会因为价格低而进入发布。
        </p>
      </Modal>
    </div>
  );
}