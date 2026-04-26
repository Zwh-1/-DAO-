"use client";

const STAGES = [
  { threshold: 0,  label: "准备电路参数…" },
  { threshold: 15, label: "加载 WASM 与 zkey…" },
  { threshold: 30, label: "计算 witness（Poseidon 哈希）…" },
  { threshold: 55, label: "生成 Groth16 证明…" },
  { threshold: 85, label: "序列化 proof 与 publicSignals…" },
  { threshold: 100, label: "证明生成完成" },
] as const;

function getStageLabel(v: number): string {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (v >= STAGES[i].threshold) return STAGES[i].label;
  }
  return STAGES[0].label;
}

export function ProofProgress({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const stageLabel = label ?? getStageLabel(v);
  const isDone = v >= 100;

  return (
    <div className="space-y-2" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="ZK 证明进度">
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isDone ? "bg-success" : "bg-primary"}`}
          style={{ width: `${v}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={`flex items-center gap-1.5 ${isDone ? "text-success font-medium" : "text-steel"}`}>
          {!isDone && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
          {isDone && <span className="text-success">✓</span>}
          {stageLabel}
        </span>
        <span className="text-steel tabular-nums font-medium">{v}%</span>
      </div>
      {!isDone && (
        <p className="text-[11px] text-primary/60">
          本地算力加密中：敏感数据不离端，明文不会发送至服务器
        </p>
      )}
    </div>
  );
}
