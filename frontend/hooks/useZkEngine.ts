"use client";

import { useCallback, useEffect, useRef } from "react";
import { useZkStore } from "../store/zkStore";

export function useZkEngine() {
  const workerRef = useRef<Worker | null>(null);
  const { setPhase, setProgress, setProof, setError, reset } = useZkStore();

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const generate = useCallback(
    (
      payload: Record<string, unknown> & {
        circuitName?: string;
        circuit?: string;
        input?: Record<string, unknown>;
        publicSignalsHint?: string[];
      }
    ) => {
      reset();
      setPhase("loading", "加载密钥与 WASM…");
      workerRef.current?.terminate();
      const w = new Worker("/workers/zkWorker.js");
      workerRef.current = w;

      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m?.type === "PROGRESS") {
          setPhase("generating", "本地隐私保护中…");
          setProgress(Number(m.progress) || 0);
        }
        if (m?.type === "STATUS") {
          // 透传 Worker 状态信息
        }
        if (m?.type === "DONE") {
          setProgress(100);
          setProof({ proof: m.proof, publicSignals: m.publicSignals });
          setPhase("success", "证明生成完成");
        }
        if (m?.type === "ERROR") {
          const errMsg = String(m.error || "未知错误");
          const isCritical = errMsg.includes("CRITICAL_ARTIFACT_MISSING");
          setError(
            isCritical
              ? "安全电路环境加载失败，请检查网络或联系管理员部署产物。"
              : errMsg,
          );
          setPhase("error", isCritical
            ? "安全电路环境加载失败，请检查网络或联系管理员部署产物。"
            : errMsg,
          );
        }
      };

      w.onerror = () => {
        setPhase("error", "Worker 异常退出");
      };

      setPhase("generating", "本地算力加密中：您的原始身份数据绝不离端…");
      w.postMessage({
        type: "GENERATE",
        payload: {
          circuitName: payload.circuitName ?? payload.circuit ?? "anti_sybil_verifier",
          ...payload,
        },
      });
    },
    [reset, setError, setPhase, setProgress, setProof]
  );

  return { generate };
}
