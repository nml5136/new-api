import { useState } from "react";
import { Badge, Button, Input, Select } from "@/components/base/ui";
import { commerceSample, extractSample, summarySample } from "@/mocks/outputs";
import { cx } from "@/lib/format";
import type { SceneId } from "@/lib/types";

interface Props {
  scene: SceneId;
  prompt: string;
  onPrompt: (value: string) => void;
  options: Record<string, string>;
  onOption: (key: string, value: string) => void;
  disabled: boolean;
  onGenerate: () => void;
  running: boolean;
  onStop: () => void;
}

const fieldTypes = ["string", "number", "date", "boolean"];

export default function SceneInput({ scene, prompt, onPrompt, options, onOption, disabled, onGenerate, running, onStop }: Props) {
  const [fields, setFields] = useState([
    { name: "contract_no", type: "string", required: true },
    { name: "buyer", type: "string", required: true },
    { name: "amount", type: "number", required: true },
    { name: "sign_date", type: "date", required: true },
    { name: "remark", type: "string", required: false },
  ]);
  const [newField, setNewField] = useState({ name: "", type: "string" });
  const [paramsOpen, setParamsOpen] = useState(true);

  const fill = () => {
    if (scene === "commerce-copy") {
      onPrompt(commerceSample);
    } else if (scene === "office-summary") {
      onPrompt(summarySample);
    } else {
      onPrompt(extractSample);
    }
  };

  const actionLabel = scene === "commerce-copy" ? "生成文案" : scene === "office-summary" ? "生成摘要" : "提取信息";

  return (
    <div className="rounded-2xl border border-background-200 bg-background-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground-700">任务输入</span>
          <Badge tone="neutral">
            {scene === "commerce-copy" ? "商品事实必填" : scene === "office-summary" ? "原文必填" : "字段与原文必填"}
          </Badge>
        </div>
        <button
          type="button"
          onClick={fill}
          className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10.5px] text-primary-600 transition-colors hover:bg-primary-50"
        >
          <i className="ri-magic-line" />
          填入示例
        </button>
      </div>

      <div className="p-4">
        <label htmlFor="task-prompt" className="mb-1.5 block text-[11px] font-medium text-foreground-600">
          {scene === "commerce-copy" ? "商品事实" : "原始文本"}
        </label>
        <textarea
          id="task-prompt"
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          rows={10}
          disabled={disabled}
          placeholder={
            scene === "commerce-copy"
              ? "名称、容量、材质、保温数据、卖点、渠道、语气与禁用词…"
              : scene === "office-summary"
                ? "粘贴会议记录、调研长文或客户反馈…"
                : "粘贴合同、订单或线索文本…"
          }
          className="w-full resize-y rounded-xl border border-background-200 bg-background-50 px-3.5 py-3 text-xs leading-[1.9] text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-hidden focus:ring-2 focus:ring-primary-500/10 disabled:bg-background-100"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-foreground-400">
          <span>{prompt.length} 字符 · 支持文本输入</span>
          <span>预计输入约 {Math.max(0.6, prompt.length / 1.6 / 1000).toFixed(1)} 千 Token（含任务说明与历史上下文）</span>
        </div>

        {scene === "info-extract" ? (
          <div className="mt-3 rounded-xl border border-background-200">
            <p className="border-b border-background-100 px-2.5 py-1.5 text-[10.5px] font-medium text-foreground-700">字段定义</p>
            <div className="max-h-[150px] space-y-1 overflow-y-auto p-1.5 scroll-thin">
              {fields.map((field, index) => (
                <div key={`${field.name}-${index}`} className="flex items-center gap-1.5 rounded-md bg-background-100/60 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate font-mono-ui text-[10px] text-foreground-800">{field.name}</span>
                  <span className="text-[9px] text-foreground-400">{field.type}</span>
                  {field.required ? <span className="text-[9px] text-danger">必填</span> : null}
                  <button
                    type="button"
                    aria-label={`移除 ${field.name}`}
                    onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
                    className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-foreground-400 hover:bg-background-200 hover:text-danger"
                  >
                    <i className="ri-close-line text-[10px]" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 border-t border-background-100 p-1.5">
              <input
                value={newField.name}
                onChange={(e) => setNewField((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="新增字段名"
                className="h-7 min-w-0 flex-1 rounded-md border border-background-200 px-2 text-[10px] focus:border-primary-400 focus:outline-hidden"
              />
              <select
                value={newField.type}
                onChange={(e) => setNewField((prev) => ({ ...prev, type: e.target.value }))}
                className="h-7 cursor-pointer rounded-md border border-background-200 px-1 text-[10px] text-foreground-700 focus:outline-hidden"
              >
                {fieldTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!newField.name.trim()) return;
                  setFields((prev) => [...prev, { name: newField.name.trim(), type: newField.type, required: false }]);
                  setNewField({ name: "", type: "string" });
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100"
                aria-label="添加字段"
              >
                <i className="ri-add-line text-xs" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-background-200">
          <button
            type="button"
            onClick={() => setParamsOpen((v) => !v)}
            aria-expanded={paramsOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[10.5px] font-medium text-foreground-700"
          >
            <span className="flex items-center gap-1.5">
              <i className="ri-equalizer-line text-foreground-500" />
              任务参数
              <span className="font-normal text-foreground-400">
                {scene === "commerce-copy"
                  ? `${options.channel} · ${options.tone} · ${options.length}`
                  : scene === "office-summary"
                    ? `${options.summaryLen} · ${options.actions === "yes" ? "含行动项" : "不含行动项"}`
                    : options.nullRule}
              </span>
            </span>
            <i className={cx(paramsOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line", "text-foreground-400")} />
          </button>

          {paramsOpen ? (
            <div className="border-t border-background-100 p-3">
              {scene === "commerce-copy" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] text-foreground-600">渠道</span>
                    <Select className="h-8 text-xs" value={options.channel} onChange={(e) => onOption("channel", e.target.value)} disabled={disabled}>
                      <option>详情页</option>
                      <option>社媒短文案</option>
                      <option>活动页</option>
                    </Select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] text-foreground-600">语气</span>
                    <Select className="h-8 text-xs" value={options.tone} onChange={(e) => onOption("tone", e.target.value)} disabled={disabled}>
                      <option>克制可信</option>
                      <option>简洁直接</option>
                      <option>活泼促销</option>
                    </Select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] text-foreground-600">长度</span>
                    <Select className="h-8 text-xs" value={options.length} onChange={(e) => onOption("length", e.target.value)} disabled={disabled}>
                      <option>短</option>
                      <option>中</option>
                      <option>长</option>
                    </Select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] text-foreground-600">禁用词</span>
                    <Input className="h-8 text-xs" value={options.ban} onChange={(e) => onOption("ban", e.target.value)} disabled={disabled} />
                  </label>
                </div>
              ) : null}

              {scene === "office-summary" ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr]">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[10.5px] text-foreground-600">摘要长度</span>
                    <Select className="h-8 text-xs" value={options.summaryLen} onChange={(e) => onOption("summaryLen", e.target.value)} disabled={disabled}>
                      <option>短（3 条以内）</option>
                      <option>中（5 条左右）</option>
                      <option>详细（保留全部要点）</option>
                    </Select>
                  </label>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-[11px] text-foreground-700">
                    <input
                      type="checkbox"
                      checked={options.actions === "yes"}
                      onChange={(e) => onOption("actions", e.target.checked ? "yes" : "no")}
                      disabled={disabled}
                      className="h-3.5 w-3.5 cursor-pointer"
                      style={{ accentColor: "oklch(var(--primary-500))" }}
                    />
                    同时提取行动项
                  </label>
                </div>
              ) : null}

              {scene === "info-extract" ? (
                <label className="block min-w-0">
                  <span className="mb-1 block text-[10.5px] text-foreground-600">空值规则</span>
                  <Select className="h-8 text-xs" value={options.nullRule} onChange={(e) => onOption("nullRule", e.target.value)} disabled={disabled}>
                    <option>原文未提及标记为 null</option>
                    <option>原文未提及则跳过字段</option>
                    <option>必填缺失时任务失败</option>
                  </Select>
                </label>
              ) : null}

              <p className="mt-2 text-[10px] leading-relaxed text-foreground-500">
                {scene === "commerce-copy"
                  ? "生成后会分别检查商品事实是否被新增、禁用词是否命中、长度与格式是否符合渠道。"
                  : scene === "office-summary"
                    ? "摘要不会引入原文之外的信息，关键数字与专有名词会保留。"
                    : "原文未提及的字段会按规则标记为 null，不会猜测填入。"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-background-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-[10px] text-foreground-400">
          <i className="ri-information-line" />
          提交后先做预算校验，再确定实际模型
        </p>
        <div className="flex items-center gap-2">
          {running ? (
            <Button variant="danger" onClick={onStop}>
              <i className="ri-stop-circle-line" />
              停止生成
            </Button>
          ) : null}
          <Button onClick={onGenerate} disabled={disabled || running || prompt.trim().length < 10}>
            <i className="ri-sparkling-2-line" />
            {running ? "生成中…" : actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}