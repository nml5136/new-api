import { useState } from "react";
import { Badge, Button, Card, Modal, PageHeader, ProgressBar } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { cx } from "@/lib/format";

export default function OpsEvaluationsPage() {
  const { opsEvaluations, opsEvalRows, raw, act, notice, error } = useOps();
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scene, setScene] = useState("SC01");
  const [samples, setSamples] = useState("100");
  const [model, setModel] = useState("");
  const [passRate, setPassRate] = useState("90");
  const [cpq, setCpq] = useState("0.05");

  const job = opsEvaluations.find((j) => j.id === selected) ?? opsEvaluations[0];
  // 一期评测为离线执行，此处登记评测结果，供场景发布门槛校验
  const submit = async () => {
    setOpen(false);
    await act("POST", "/evals", {
      scene_id: scene, model_name: model, sample_size: Number(samples) || 0, pass_rate: (Number(passRate) || 0) / 100,
      cost_per_qualified: Math.round((Number(cpq) || 0) * 100), remark: name,
    }, "评测结果已登记");
  };
  function renderModal() {
    return (
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="登记评测结果"
        description="评测在线下使用授权样本执行，不抓取客户对话正文。"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button
              disabled={!model}
              onClick={() => void submit()}
            >
              登记
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">备注（样本集名称）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:border-primary-400 focus:outline-hidden" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">场景</span>
            <select value={scene} onChange={(e) => setScene(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:outline-hidden">
              {raw.scenes.map((x: any) => <option key={x.scene.scene_id} value={x.scene.scene_id}>{x.scene.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">样本数量</span>
            <input type="number" value={samples} onChange={(e) => setSamples(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:border-primary-400 focus:outline-hidden" />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">模型</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-background-300 bg-background-50 px-3 text-sm focus:outline-hidden">
              <option value="">请选择</option>
              {raw.models.map((x: any) => <option key={x.model.id} value={x.model.model_name}>{x.model.model_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">合格率 %</span>
            <input type="number" value={passRate} onChange={(e) => setPassRate(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-foreground-700">合格结果成本（元）</span>
            <input type="number" value={cpq} onChange={(e) => setCpq(e.target.value)} className="h-10 w-full rounded-xl border border-background-300 bg-background-50 px-3 text-sm" />
          </label>
        </div>
        <p className="text-[10px] leading-relaxed text-foreground-500">
          评测将比较候选模型的质量达标率与每个合格结果成本。低于发布门槛的候选不会因为价格低而进入发布。
        </p>
      </Modal>
    );
  }
  if (!job) {
    return (
      <div>
        <PageHeader eyebrow="评测中心" title="质量与成本一起决定能不能发布" actions={<Button onClick={() => setOpen(true)}><i className="ri-add-line" />登记评测</Button>} />
        <Card className="p-6 text-center text-xs text-foreground-500">{error || "暂无评测结果。登记后才能把场景版本标记为评测通过。"}</Card>
        {renderModal()}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="评测中心"
        title="质量与成本一起决定能不能发布"
        description="结果区包含质量达标率、每个合格结果成本、耗时分布与样本数量。低价但质量不足的候选会明确标注不满足发布门槛。"
        actions={<Button onClick={() => setOpen(true)}><i className="ri-add-line" />登记评测</Button>}
      />
      {error ? <div className="mb-3 rounded-xl border border-danger bg-danger-soft px-3.5 py-2.5 text-[11px] text-danger">{error}</div> : null}

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
                <p className="mt-0.5 text-[10px] text-foreground-500">#{job.id} · 样本 {job.samples} 个 · 登记于 {job.duration}</p>
              </div>
              <Badge tone={job.status === "已完成" ? "success" : "warning"}>{job.status}</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "质量达标率", value: job.pass },
                { label: "每个合格结果成本", value: job.cost },
                { label: "登记时间", value: job.duration },
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
                {/* 达标率进度条：取真实评测记录 */}
                {opsEvalRows.slice(0, 4).map((row) => {
                  const v = parseFloat(String(row.pass)) || 0;
                  return (
                    <div key={row.model} className="mt-1 flex items-center gap-2">
                      <span className="w-[120px] shrink-0 truncate text-[9.5px] text-foreground-500">{row.model} 达标率 {row.pass}</span>
                      <ProgressBar value={v} tone={row.verdict === "满足门槛" ? "success" : "warning"} />
                    </div>
                  );
                })}
                <p className="mt-2 text-[9px] text-foreground-400">低于场景质量门槛的候选不满足发布条件，价格再低也不会进入发布。</p>
              </div>
            </div>
          </Card>

        </div>
      </div>

      {renderModal()}
    </div>
  );
}