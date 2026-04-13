"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProofProgress } from "../../components/zk/ProofProgress";
import { ProofResult } from "../../components/zk/ProofResult";
import { PrivacyShield } from "../../components/zk/PrivacyShield";
import { useSIWE } from "../../hooks/useSIWE";
import { useZkEngine } from "../../hooks/useZkEngine";
import { proposeClaim, queryClaimStatus, type ClaimProposePayload } from "../../lib/api";
import { useZkStore } from "../../store/zkStore";
import { toUserErrorMessage } from "../../lib/error-map";
import { publicSignalToBytes32Hex } from "../../lib/zk-helpers";
import { RoleGuard } from "../../components/auth/RoleGuard";
import { Input ,Button } from "../../components/ui/index";
import {
  requireBytes32,
  requireEthAddress,
  requireIpfsUri,
  requireNonEmpty,
  requirePositiveIntegerString
} from "../../lib/validators";

/** 与 `circuits/scripts/zk-prove.mjs` 占位一致；真实申领需替换为有效 Merkle 路径与承诺 */
function defaultZkWitnessPayload() {
  const now = Math.floor(Date.now() / 1000);
  return {
    secret: "12345678",
    airdrop_project_id: "1",
    pathElements: Array(8).fill("0"),
    pathIndex: Array(8).fill("0"),
    merkle_root: "0",
    identity_commitment: "0",
    nullifier: "0",
    user_level: "3",
    min_level: "2",
    claim_amount: "1000",
    min_amount: "100",
    max_amount: "10000",
    claim_ts: String(now),
    ts_start: String(now - 3600),
    ts_end: String(now + 86400),
  };
}

type Groth16ProofBody = ClaimProposePayload["proof"];

type LastZkBundle = {
  proof?: Groth16ProofBody;
  publicSignals?: string[];
} | null;

export default function ClaimPage() {
  const { signIn, signOut, busy: siweBusy, token, address: siweAddress } = useSIWE();
  const { generate } = useZkEngine();
  const zkPhase = useZkStore((s) => s.phase);
  const zkProgress = useZkStore((s) => s.progress);
  const zkMessage = useZkStore((s) => s.message);
  const lastZk = useZkStore((s) => s.lastProof) as LastZkBundle;

  const [form, setForm] = useState({
    claimId: "CL-20260403-001",
    proofProtocol: "groth16",
    publicSignals: "",
    evidenceCid: "ipfs://QmExample",
    description: "本地生成证明完毕",
    nullifierHash: "0x" + "0".repeat(64),
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    amount: "1000"
  });
  const [statusQueryId, setStatusQueryId] = useState("CL-20260403-001");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (siweAddress) {
      setForm((f) => ({ ...f, address: siweAddress }));
    }
  }, [siweAddress]);

  function proofForRequest(): Groth16ProofBody {
    const p = lastZk?.proof;
    if (p?.pi_a && p.pi_a.length >= 2 && p.pi_b && p.pi_c) {
      return {
        protocol: p.protocol ?? "groth16",
        pi_a: p.pi_a,
        pi_b: p.pi_b,
        pi_c: p.pi_c,
        ...(p._isMock ? { _isMock: true } : {})
      };
    }
    return { protocol: form.proofProtocol };
  }

  function validateClaimForm() {
    requireNonEmpty(form.claimId, "claimId");
    requireNonEmpty(form.proofProtocol, "proof.protocol");
    requireNonEmpty(form.publicSignals, "publicSignals");
    requireIpfsUri(form.evidenceCid, "evidenceCid");
    requireBytes32(form.nullifierHash, "nullifierHash");
    requireEthAddress(form.address, "address");
    requirePositiveIntegerString(form.amount, "amount");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setLoading(true);
    try {
      validateClaimForm();
      const data = await proposeClaim({
        claimId: form.claimId,
        nullifierHash: form.nullifierHash,
        proof: proofForRequest(),
        publicSignals: form.publicSignals.split(",").map((v) => v.trim()),
        evidenceCid: form.evidenceCid,
        address: form.address,
        amount: form.amount
      });
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function onQueryStatus() {
    setFormError("");
    setLoading(true);
    try {
      requireNonEmpty(statusQueryId, "claimId");
      const data = await queryClaimStatus(statusQueryId);
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFormError(toUserErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <RoleGuard required="member">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <section className="card">
        <h2 className="section-title">阶段七：SIWE + 本地 ZK（Web Worker）</h2>
        <p className="mt-2 section-desc">
          AI 助手永远不会询问您的私钥或助记词；Witness 仅在 Worker 内使用，请勿在控制台打印。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => signIn().catch((e) => setFormError(String(e)))}
            disabled={siweBusy}
            variant="primary"
          >
            {siweBusy ? "登录中…" : "SIWE 登录"}
          </Button>
          <Button type="button" onClick={() => signOut()} variant="secondary" size="sm">
            退出会话
          </Button>
          <span className="text-xs text-steel">
            {token ? `已登录（JWT）` : "未登录：提交理赔需 JWT 或后端 BYPASS_AUTH=1"}
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <PrivacyShield />
          <div className="min-w-0 flex-1 space-y-2">
            <ProofProgress value={zkProgress} />
            <p className="text-xs text-steel">{zkMessage}</p>
            <ProofResult
              phase={zkPhase}
              progress={zkProgress}
              summary={zkPhase === "generating" || zkPhase === "loading" ? "本地算力加密中：明文不会离开浏览器" : ""}
              onGenerate={() =>
                generate({
                  ...defaultZkWitnessPayload(),
                  publicSignalsHint: form.publicSignals
                    ? form.publicSignals.split(",").map((v) => v.trim())
                    : undefined
                })
              }
            />
            {lastZk?.proof && (
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => {
                  const sigs = lastZk.publicSignals || [];
                  setForm((f) => ({
                    ...f,
                    proofProtocol: String(lastZk.proof?.protocol || "groth16"),
                    publicSignals: sigs.join(","),
                    ...(sigs.length > 7
                      ? {
                        amount: String(BigInt(sigs[7])),
                        nullifierHash:
                          sigs.length > 2 ? publicSignalToBytes32Hex(sigs[2]) : f.nullifierHash
                      }
                      : {})
                  }));
                }}
              >
                将 Worker 的 publicSignals / nullifier / amount 填入表单（提交时自动附带完整 Groth16 proof）
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h1 className="text-xl font-bold text-primary">理赔申请中心</h1>
        <p className="mt-2 section-desc">
          本地生成 ZK 证明后，仅提交 proof/publicSignals/nullifierHash，不上传 Witness 明文。
        </p>
        <p className="mt-2 text-xs text-steel">
          链上 ClaimVaultZK 与 <code className="font-mono">anti_sybil_verifier.circom</code> 对齐时，publicSignals 须为
          11 个字段；其中 nullifier 为索引 2，claim_amount 为索引 7，须与下方 nullifierHash / amount 一致（开启 RPC 中继时后端会校验）。
        </p>
      </section>

      <section className="card">
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="Claim ID" value={form.claimId} onChange={(e) => setForm({ ...form, claimId: e.target.value })} />
          <Input
            label="Proof Protocol"
            value={form.proofProtocol}
            onChange={(e) => setForm({ ...form, proofProtocol: e.target.value })}
          />
          <Input
            label="Public Signals（11 个十进制字段，逗号分隔；可先运行 Worker 再一键填入）"
            value={form.publicSignals}
            onChange={(e) => setForm({ ...form, publicSignals: e.target.value })}
          />
          <Input label="Evidence CID" value={form.evidenceCid} onChange={(e) => setForm({ ...form, evidenceCid: e.target.value })} />
          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Nullifier Hash (bytes32)"
            value={form.nullifierHash}
            onChange={(e) => setForm({ ...form, nullifierHash: e.target.value })}
          />
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            isLoading={loading}
          >
            {loading ? "提交中..." : "提交理赔"}
          </Button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-3 section-title">状态查询</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-full md:w-[320px]">
            <Input
              label="Claim ID"
              value={statusQueryId}
              onChange={(e) => setStatusQueryId(e.target.value)}
            />
          </div>
          <Button onClick={onQueryStatus} disabled={loading} variant="success">
            查询状态
          </Button>
        </div>
      </section>

      {formError && (
        <div className="error-banner">{formError}</div>
      )}

      <pre className="result-pre">
        {result || "接口返回结果会显示在这里"}
      </pre>
    </div>
    </RoleGuard>
  );
}
