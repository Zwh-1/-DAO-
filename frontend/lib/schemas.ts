/**
 * 表单验证 Schema（使用 Zod）
 * 
 * 职责：
 * - 定义表单数据的类型与验证规则
 * - 提供强类型表单验证
 * - 支持输入防呆与错误提示
 * 
 * 隐私保护：
 * - 不验证或存储明文敏感数据
 * - 地址等数据自动脱敏
 */

import { z } from "zod";

/**
 * 以太坊地址验证器
 * 
 * 规则：
 * - 必须以 0x 开头
 * - 后跟 40 个十六进制字符
 * - 不区分大小写
 */
const ethereumAddress = z.string().refine(
  (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
  {
    message: "无效的以太坊地址格式",
  }
);

/**
 * 成员画像查询表单 Schema
 * 
 * 字段：
 * - address: 以太坊地址（可选，留空则查询当前钱包）
 */
export const memberProfileSchema = z.object({
  address: ethereumAddress.optional().or(z.literal("")),
});

export type MemberProfileFormData = z.infer<typeof memberProfileSchema>;

/**
 * 钱包绑定表单 Schema
 * 
 * 字段：
 * - mainAddr: 主钱包地址
 * - newAddr: 新钱包地址
 * - proof: 绑定证明（可选）
 */
export const bindWalletSchema = z.object({
  mainAddr: ethereumAddress.refine(
    (val) => val && val !== "",
    { message: "主钱包地址不能为空" }
  ),
  newAddr: ethereumAddress.refine(
    (val) => val && val !== "",
    { message: "新钱包地址不能为空" }
  ),
  proof: z.string().optional(),
});

export type BindWalletFormData = z.infer<typeof bindWalletSchema>;

/**
 * DAO 提案表单 Schema
 * 
 * 字段：
 * - description: 提案描述（必填，最小长度 10 字符）
 */
export const governanceProposalSchema = z.object({
  description: z
    .string()
    .min(10, { message: "提案描述至少 10 个字符" })
    .max(1000, { message: "提案描述不能超过 1000 字符" }),
});

export type GovernanceProposalFormData = z.infer<typeof governanceProposalSchema>;

/**
 * 投票表单 Schema
 * 
 * 字段：
 * - proposalId: 提案 ID（必填，正整数）
 * - support: 投票选项（0=反对，1=赞成，2=弃权）
 */
export const voteSchema = z.object({
  proposalId: z
    .string()
    .min(1, { message: "请输入提案 ID" })
    .refine(
      (val) => /^\d+$/.test(val) && parseInt(val) > 0,
      { message: "提案 ID 必须为正整数" }
    ),
  support: z.enum(["0", "1", "2"], {
    message: "请选择投票选项",
  }),
});

export type VoteFormData = z.infer<typeof voteSchema>;

/**
 * 理赔申请表单 Schema
 * 
 * 字段：
 * - claimAmount: 申领金额（必填，正数）
 * - proof: ZK 证明（必填）
 * - memo: 备注（可选）
 */
export const claimSchema = z.object({
  claimAmount: z
    .string()
    .min(1, { message: "请输入申领金额" })
    .refine(
      (val) => /^\d*\.?\d+$/.test(val) && parseFloat(val) > 0,
      { message: "金额必须为正数" }
    ),
  proof: z.string().min(1, { message: "请提供 ZK 证明" }),
  memo: z.string().optional(),
});

export type ClaimFormData = z.infer<typeof claimSchema>;

/**
 * 通用错误消息映射
 * 
 * 将 Zod 错误消息转换为用户友好的中文提示
 */
export function getErrorMessage(error: z.ZodError): Record<string, string> {
  const errorMap: Record<string, string> = {};
  
  error.issues.forEach((err) => {
    const path = err.path.join(".");
    if (path) {
      errorMap[path] = err.message;
    }
  });
  
  return errorMap;
}
