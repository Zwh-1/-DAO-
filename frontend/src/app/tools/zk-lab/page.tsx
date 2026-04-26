"use client";

import { useMemo, useState } from "react";
import { V1Routes } from "@/lib/api/v1Routes";
import { CIRCUIT_N_PUBLIC, CORE_CIRCUIT_NAMES } from "@/lib/zk/circuitMeta";

/**
 * ZK 工作台：十条电路 public 个数提示、通用 POST /v1/zk/verify、manifest 产物路径说明
 */
export default function ZkLabPage() {
  const [circuitName, setCircuitName] = useState<(typeof CORE_CIRCUIT_NAMES)[number]>("anonymous_claim");
  const nPublic = useMemo(() => CIRCUIT_N_PUBLIC[circuitName] ?? 0, [circuitName]);
  const [pubJson, setPubJson] = useState('["1","2","3","4","5","6","7"]');
  const [proofJson, setProofJson] = useState("{}");
  const [out, setOut] = useState("");

  async function runVerify() {
    setOut("…");
    try {
      const pubSignals = JSON.parse(pubJson) as string[];
      const proof = JSON.parse(proofJson) as Record<string, unknown>;
      const res = await fetch(V1Routes.zk.verify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuitName, proof, pubSignals }),
      });
      const body = await res.json();
      setOut(JSON.stringify({ status: res.status, body }, null, 2));
    } catch (e) {
      setOut(String(e));
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem", color: "#0A2540" }}>
      <h1 style={{ fontSize: "1.25rem" }}>ZK Lab</h1>
      <p style={{ color: "#64748B", fontSize: "0.9rem" }}>
        选择电路名后，将 snarkjs 的 <code>proof</code> 与 <code>publicSignals</code> 粘贴到 JSON 框，提交到后端{" "}
        <code>POST {V1Routes.zk.verify}</code>（需对应 <code>vkey.json</code> 或开发环境{" "}
        <code>ZK_VERIFY_SKIP_MISSING_VKEY</code>）。
      </p>
      <p style={{ color: "#64748B", fontSize: "0.85rem" }}>
        前端 Worker：<code>/workers/zkWorker.js</code> 读取{" "}
        <code>/circuits/circuits-manifest.json</code>，对非 <code>anti_sybil_verifier</code> 的电路请传入{" "}
        <code>payload.input</code>（由 <code>lib/zk/circuitWitnessBuilders</code> 构造）；抗女巫完整电路仍支持扁平
        legacy 字段并固定 Merkle 深度 20。
      </p>

      <label style={{ display: "block", marginTop: "1rem" }}>
        circuitName（十条核心）
        <select
          style={{ width: "100%", marginTop: 4, padding: "0.35rem" }}
          value={circuitName}
          onChange={(e) => {
            const name = e.target.value as (typeof CORE_CIRCUIT_NAMES)[number];
            setCircuitName(name);
            const n = CIRCUIT_N_PUBLIC[name] ?? 1;
            setPubJson(JSON.stringify(Array.from({ length: n }, (_, i) => String(i + 1))));
          }}
        >
          {CORE_CIRCUIT_NAMES.map((n) => (
            <option key={n} value={n}>
              {n}（{CIRCUIT_N_PUBLIC[n]} public）
            </option>
          ))}
        </select>
      </label>

      <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#64748B" }}>
        当前电路 public 个数：<strong>{nPublic}</strong>（仅提示；占位 JSON 需换成真实证明输出）
      </p>

      <label style={{ display: "block", marginTop: "1rem" }}>
        pubSignals JSON 数组（长度须为 {nPublic}）
        <textarea style={{ width: "100%", minHeight: 80, marginTop: 4 }} value={pubJson} onChange={(e) => setPubJson(e.target.value)} />
      </label>
      <label style={{ display: "block", marginTop: "1rem" }}>
        proof JSON
        <textarea style={{ width: "100%", minHeight: 120, marginTop: 4 }} value={proofJson} onChange={(e) => setProofJson(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => void runVerify()}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          background: "#0A2540",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        POST verify
      </button>

      <section style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#64748B" }}>
        <h2 style={{ fontSize: "1rem", color: "#0A2540" }}>专用验证端点</h2>
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>
            <code>{V1Routes.identity.verifyCommitmentZk}</code> — identity_commitment（2 public）
          </li>
          <li>
            <code>{V1Routes.challenge.verifyAntiSybilClaim}</code> — anti_sybil_claim（3 public）
          </li>
          <li>
            <code>{V1Routes.reputation.historyVerifyAnchor}</code> — history_anchor（2 public，需登录且 merkle_root
            与当前服务根一致）
          </li>
          <li>
            <code>{V1Routes.claim.propose}</code> — 非 Mock 且 8 个 public 时自动执行 anti_sybil_verifier 全量校验
          </li>
        </ul>
      </section>

      <pre style={{ marginTop: "1rem", background: "#F8FAFC", padding: "1rem", overflow: "auto" }}>{out}</pre>
    </main>
  );
}
