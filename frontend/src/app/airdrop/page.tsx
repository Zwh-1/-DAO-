"use client";

import { AnonymousClaimForm } from "@/features/claim";
import { RoleGuard } from "@/components/auth";
import { claimCampaign } from "@/config/claimCampaign";

/**
 * Airdrop 页面 - 匿名资产申领（标题与副文案可由 NEXT_PUBLIC_CLAIM_CAMPAIGN_* 配置）
 */
export default function AirdropPage() {
  return (
    <RoleGuard required="member">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="card">
          <h1 className="text-2xl font-bold mb-4 text-primary">
            {claimCampaign.title}
          </h1>
          <p className="text-slate-600 mb-4">{claimCampaign.description}</p>
          <div
            className="rounded-lg border p-4 bg-slate-50 border-slate-200"
          >
            <h4 className="text-sm font-semibold mb-2 text-primary">
              隐私保护说明
            </h4>
            <ul className="text-xs space-y-1 text-slate-500">
              <li>
                <span className="text-success">✓</span> Witness 仅在本地浏览器用于计算证明
              </li>
              <li>
                <span className="text-success">✓</span> 证明在本地完成，不上传 secret / 完整 Merkle 路径明细
              </li>
              <li>
                <span className="text-success">✓</span> 使用 Poseidon 哈希（非 MD5）
              </li>
              <li>
                <span className="text-success">✓</span> Nullifier 用于防重复领取
              </li>
            </ul>
          </div>
        </section>

        <section className="card">
          <AnonymousClaimForm />
        </section>
      </div>
    </RoleGuard>
  );
}
