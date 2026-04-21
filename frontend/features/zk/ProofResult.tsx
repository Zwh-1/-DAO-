"use client";

import type { ZkPhase } from "../../store/zkStore";

export function ProofResult(props: {
  phase: ZkPhase;
  progress: number;
  summary?: string;
  onGenerate: () => void;
}) {
  const isGenerating = props.phase === "generating" || props.phase === "loading";

  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={props.onGenerate}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200"
      >
        {isGenerating && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        在 Worker 中生成本地证明（MVP）
      </button>
      {props.summary && <p className="text-xs text-steel">{props.summary}</p>}
      <div className="text-xs text-steel">
        状态：{props.phase} {isGenerating ? `(${props.progress}%)` : ""}
      </div>
    </div>
  );
}
