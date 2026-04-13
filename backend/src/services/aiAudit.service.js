/**
 * AI / 规则混合审计：LLM 不可用时降级静态规则（文档 8.3.2 结构）
 */
export async function auditClaimProposal(body) {
  const risks = [];
  const suggestions = [];

  if (!body?.evidenceCid?.startsWith?.("ipfs://")) {
    risks.push("证据未使用 ipfs:// 指针");
    suggestions.push({
      file: "claim/propose",
      before: "evidenceCid 非 IPFS",
      after: "使用 ipfs:// 前缀的 CID"
    });
  }

  if (body?.publicSignals?.length < 2) {
    risks.push("publicSignals 长度过短，疑似异常");
  }

  const dupSuspect = String(body?.description || "").toLowerCase().includes("test bulk");
  if (dupSuspect) {
    risks.push("描述命中批量测试关键字");
  }

  const risk_level = risks.length >= 2 ? "HIGH" : risks.length === 1 ? "MED" : "LOW";
  const confidence = risk_level === "LOW" ? 0.85 : 0.62;

  return {
    risk_level,
    risk_reasons: risks,
    suggestions,
    confidence
  };
}
