import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader } from "@/components/base/ui";
import { useOps } from "@/lib/ops-data";
import { cx, money } from "@/lib/format";

export default function OpsPricingPage() {
  const { opsPriceVersions, act, notice, error } = useOps();
  const [selected, setSelected] = useState("");
  const [inK, setInK] = useState("12");
  const [outK, setOutK] = useState("2");
  const [newIn, setNewIn] = useState("");
  const [newOut, setNewOut] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const version = opsPriceVersions.find((v) => v.id === selected) ?? opsPriceVersions[0];
  const p: any = version?.raw ?? {};
  // 价格单位：分 / 百万 Token；界面以元展示
  const resetForm = () => { setNewIn(((p.input_price || 0) / 100).toFixed(2)); setNewOut(((p.output_price || 0) / 100).toFixed(2)); };
  useEffect(() => { resetForm(); }, [version?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const per = (tokK: number, yuanPerM: number) => (tokK * 1000 / 1e6) * yuanPerM;
  const inTokens = Number(inK) || 0;
  const outTokens = Number(outK) || 0;
  const before = per(inTokens, (p.input_price || 0) / 100) + per(outTokens, (p.output_price || 0) / 100);
  const after = per(inTokens, Number(newIn) || 0) + per(outTokens, Number(newOut) || 0);
  const cost = per(inTokens, (p.cost_input_price || 0) / 100) + per(outTokens, (p.cost_output_price || 0) / 100);
  const margin = ((after - cost) / (after || 1)) * 100;
  const submit = async () => {
    setConfirmOpen(false);
    await act("POST", "/prices", {
      ...p, id: 0, input_price: Math.round((Number(newIn) || 0) * 100), output_price: Math.round((Number(newOut) || 0) * 100),
      effective_at: 0, reason: "运营后台价格变更",
    }, "价格新版本已发布，仅影响生效后的新请求");
  };
  if (!version) {
    return (
      <div>
        <PageHeader eyebrow="价格管理" title="价格版本与变更预览" />
        <Card className="p-6 text-center text-xs text-foreground-500">{error || "暂无价格版本。"}</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="价格管理"
        title="价格版本与变更预览"
        description="采购价仅运营可见，客户零售价按版本生效。已开始的任务绑定原版本，新价格只影响生效后的新请求。"
      />

      {notice ? <Notice tone="success" icon="ri-check-line" className="mb-3">{notice}</Notice> : null}
      {error ? <Notice tone="danger" icon="ri-error-warning-line" className="mb-3">{error}</Notice> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[0.9fr_1.1fr_1.1fr_0.7fr_0.9fr] gap-2 border-b border-background-200 bg-background-100/50 px-4 py-2 text-[10px] text-foreground-500 md:grid">
            <span>模型</span>
            <span>采购价（运营）</span>
            <span>客户零售价</span>
            <span>范围</span>
            <span>状态 / 生效</span>
          </div>
          <div className="divide-y divide-background-100">
            {opsPriceVersions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row.id)}
                className={cx(
                  "grid w-full cursor-pointer grid-cols-1 gap-1 px-4 py-3 text-left text-[10.5px] transition-colors md:grid-cols-[0.9fr_1.1fr_1.1fr_0.7fr_0.9fr] md:items-center md:gap-2",
                  selected === row.id ? "bg-primary-50/50" : "hover:bg-background-100/50",
                )}
              >
                <span className="text-[11px] font-medium text-foreground-900">{row.model}</span>
                <span className="tnum text-foreground-500">{row.purchase}</span>
                <span className="tnum text-foreground-900">{row.retail}</span>
                <span className="text-foreground-600">{row.scope}</span>
                <span>
                  <Badge tone={row.status === "生效中" ? "success" : "neutral"}>{row.status}</Badge>
                  <span className="mt-0.5 block text-[9px] text-foreground-400">{row.effective}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-background-200 px-4 py-2.5 text-[9.5px] text-foreground-400">
            采购价来源为上游结算，展示前需标注预估或已对账；客户侧不显示该列。
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground-950">{version.model} · 变更预览</h2>
              <p className="mt-0.5 text-[10px] text-foreground-500">#{version.id} · {version.tax} · {version.scope}</p>
            </div>
            <Badge tone={version.status === "生效中" ? "success" : "warning"}>{version.status}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="新输入价（元 / 百万）">
              <Input type="number" step={0.01} value={newIn} onChange={(e) => setNewIn(e.target.value)} />
            </Field>
            <Field label="新输出价（元 / 百万）">
              <Input type="number" step={0.01} value={newOut} onChange={(e) => setNewOut(e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 rounded-xl bg-background-100/60 p-3">
            <p className="mb-2 text-[10px] font-medium text-foreground-700">同一用量下的费用变化</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="输入（千 Token）"><Input type="number" value={inK} onChange={(e) => setInK(e.target.value)} /></Field>
              <Field label="输出（千 Token）"><Input type="number" value={outK} onChange={(e) => setOutK(e.target.value)} /></Field>
            </div>
            <div className="mt-3 space-y-1.5 text-[10.5px]">
              <div className="flex justify-between text-foreground-600"><span>变更前</span><span className="tnum">{money(before, 3)}</span></div>
              <div className="flex justify-between font-medium text-foreground-950"><span>变更后</span><span className="tnum">{money(after, 3)}</span></div>
              <div className={cx("flex justify-between border-t border-background-200 pt-1.5", after > before ? "text-warning" : "text-success")}>
                <span>差额</span>
                <span className="tnum">{`${after - before >= 0 ? "+" : ""}${money(after - before, 3)}`}</span>
              </div>
              <div className="flex justify-between text-foreground-500"><span>变更后毛利率（按采购价）</span><span className="tnum">{margin.toFixed(1)}%</span></div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => setConfirmOpen(true)} disabled={!(Number(newIn) > 0)}>提交价格变更</Button>
            <Button variant="outline" onClick={resetForm}>重置</Button>
            {p.sync_status === "failed" ? <span className="text-[9.5px] text-warning">该版本同步 New API 失败，请检查后重新发布</span> : null}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { title: "价格快照", body: "已开始任务绑定发起时的价格版本。若底层无法提供快照，不应发布价格承诺。" },
          { title: "含税与范围", body: "价格需标注是否含税与适用范围。授权未覆盖的模型不参与对客展示。" },
          { title: "生效时间", body: "价格变更仅影响生效后的新请求，历史消费记录保持原价。" },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <p className="text-[11px] font-medium text-foreground-900">{item.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-foreground-600">{item.body}</p>
          </Card>
        ))}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="提交价格变更"
        description="请确认价格影响范围与生效方式。"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button
              onClick={() => void submit()}
            >
              确认提交
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[11px]">
          <div className="rounded-xl border border-background-200 p-3 space-y-1.5 text-foreground-700">
            <div className="flex justify-between"><span>模型</span><span className="font-medium">{version.model}</span></div>
            <div className="flex justify-between"><span>原零售价</span><span className="tnum">{version.retail}</span></div>
            <div className="flex justify-between"><span>新零售价</span><span className="tnum font-medium">{money(Number(newIn) || 0)} / {money(Number(newOut) || 0)}</span></div>
            <div className="flex justify-between"><span>生效时间</span><span className="font-medium">提交审核通过后次日 00:00</span></div>
          </div>
          <Notice tone="neutral" icon="ri-information-line">
            仅影响生效后的新请求。已开始任务仍绑定原价格版本；若底层版本不支持价格快照，需先完成适配。
          </Notice>
        </div>
      </Modal>
    </div>
  );
}