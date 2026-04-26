import { describe, it, expect, vi, afterEach } from "vitest";
import {
  auditClaimProposal,
  sanitizeClaimBodyForAudit,
} from "../src/services/ai/aiAudit.service.js";

describe("aiAudit.service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sanitizeClaimBodyForAudit 剥离 secret 与证明细节", () => {
    const s = sanitizeClaimBodyForAudit({
      claimId: "c1",
      secret: "must-not-appear",
      proof: {
        protocol: "groth16",
        pi_a: [1, 2],
        pi_b: [[1], [2]],
        pi_c: [3, 4],
      },
    });
    expect(s.secret).toBeUndefined();
    expect(s.proof_summary).toBeDefined();
    expect(s.proof_summary.protocol).toBe("groth16");
  });

  it("auditClaimProposal 返回稳定结构（mock fetch，避免真实调用 LLM）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  risk_level: "LOW",
                  risk_reasons: [],
                  suggestions: [],
                  confidence: 0.88,
                  notes: "mock",
                }),
              },
            },
          ],
        }),
      }))
    );

    const r = await auditClaimProposal({
      evidenceCid: "ipfs://QmTest",
      publicSignals: ["1", "2", "3"],
      description: "unit test payload",
    });
    expect(["rules", "hybrid"]).toContain(r.audit_source);
    expect(r.risk_level).toMatch(/^(HIGH|MED|LOW)$/);
    expect(Array.isArray(r.risk_reasons)).toBe(true);
    if (r.audit_source === "hybrid") {
      expect(r.llm_used).toBe(true);
    }
  });
});
