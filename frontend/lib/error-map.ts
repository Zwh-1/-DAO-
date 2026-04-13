import { ApiError } from "./api";

const CODE_MESSAGE_MAP: Record<number, string> = {
  1001: "钱包签名校验失败，请重新登录并重签。",
  2001: "零知识证明校验失败，请检查电路输入与 publicSignals 顺序。",
  2002: "Nullifier 已被使用，触发抗重放保护，请勿重复提交。",
  3001: "您未被选为当前案件仲裁员，或缺少对应 Commit 记录。",
  4001: "信用分或质押额度不足，当前操作被拒绝。",
  4002: "缺少 secret 或 airdropId 参数。",
  4003: "钱包绑定参数不完整，请检查主地址/新地址/证明。",
  4004: "预言机上报参数不完整，请检查 claimId/verdict/signature。",
  4005: "挑战参数不完整，请检查 proposalId/reasonCode/txHash/challenger/stakeAmount。"
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
