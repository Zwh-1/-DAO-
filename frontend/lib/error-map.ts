import { ApiError } from "./api";

const CODE_MESSAGE_MAP: Record<number, string> = {
  // ── 认证 / 钱包 ──
  1001: "钱包签名校验失败，请重新登录并重签。",
  1002: "登录会话已过期，请重新连接钱包并签名。",
  1003: "Nonce 已失效或被篡改，请刷新页面后重试。",
  1004: "该地址已被系统封禁，如有异议请联系管理员。",

  // ── 零知识证明 ──
  2001: "零知识证明校验失败，请检查电路输入与 publicSignals 顺序。",
  2002: "Nullifier 已被使用，触发抗重放保护，请勿重复提交。",
  2003: "Merkle 根校验不通过，链上根与本地不一致，请重新同步资格数据。",
  2004: "证明格式错误，请确认 pi_a / pi_b / pi_c 与 protocol 字段完整。",
  2005: "领取时间窗外提交，当前时间不在合约允许的 tsStart–tsEnd 范围内。",

  // ── 仲裁 ──
  3001: "您未被选为当前案件仲裁员，或缺少对应 Commit 记录。",
  3002: "Commit 阶段已结束，无法再提交承诺。",
  3003: "Reveal 校验失败：commitment 与 reveal 数据不匹配。",
  3004: "该案件当前状态不允许此操作。",

  // ── 参数 / 信用 ──
  4001: "信用分或质押额度不足，当前操作被拒绝。",
  4002: "缺少 secret 或 airdropId 参数。",
  4003: "钱包绑定参数不完整，请检查主地址/新地址/证明。",
  4004: "预言机上报参数不完整，请检查 claimId/verdict/signature。",
  4005: "挑战参数不完整，请检查 proposalId/reasonCode/txHash/challenger/stakeAmount。",
  4006: "提案描述不能为空。",
  4007: "投票意向字段无效，需为 0（反对）、1（赞成）或 2（弃权）。",

  // ── 治理 ──
  5001: "该提案当前状态不允许投票。",
  5002: "您已对此提案投票，请勿重复提交。",
  5003: "提案创建失败：SBT 积分不足或未注册身份。",

  // ── 预言机 ──
  6001: "报告 ID 不存在或已终结。",
  6002: "签名重复：您已对此报告签名。",
  6003: "签名数未达法定门槛，无法终结。",

  // ── 挑战 ──
  7001: "目标提案不存在或不在可挑战状态。",
  7002: "质押金额低于系统最低要求。",

  // ── 守护者 ──
  8001: "Admin Token 无效或已过期，请联系系统管理员。",
  8002: "系统已处于暂停状态，无需重复操作。",
  8003: "目标地址已在黑名单中。",

  // ── 身份 / SBT ──
  9001: "Identity Commitment 已注册，请勿重复提交。",
  9002: "白名单校验未通过，您不在当前批次名单中。",
};

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGE_MAP[error.code]) {
      return `错误码 ${error.code}：${CODE_MESSAGE_MAP[error.code]}`;
    }
    const detail = error.detail ? `（${error.detail}）` : "";
    return `请求失败（HTTP ${error.status}）：${error.message}${detail}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "发生未知错误，请稍后重试。";
}
