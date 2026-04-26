/**
 * 申领活动展示文案（可由环境变量覆盖，无需后端）
 */

export const claimCampaign = {
  title: process.env.NEXT_PUBLIC_CLAIM_CAMPAIGN_TITLE ?? '匿名空投资格领取',
  description:
    process.env.NEXT_PUBLIC_CLAIM_CAMPAIGN_DESC ??
    '在本地生成零知识证明领取资格，原始密钥与完整路径不会以明文上传至服务器。',
};
