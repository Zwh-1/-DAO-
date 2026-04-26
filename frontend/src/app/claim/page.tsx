"use client";

import { InsuranceClaimForm } from "@/features/claim";
import { RoleGuard } from "@/components/auth";

/**
 * 理赔申请页面 - 成员提交互助理赔申请，经仲裁员 Commit-Reveal 投票后链上执行赔付
 */
export default function ClaimPage() {
  return (
    <RoleGuard required="member">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="card">
          <h1 className="text-2xl font-bold mb-2 text-primary">
            理赔申请
          </h1>
          <p className="text-slate-600 mb-4">
            填写保单信息与事故详情，提交后进入仲裁队列。仲裁员将通过 Commit-Reveal
            投票机制对申请进行审核，结果链上执行，全程透明可追溯。
          </p>
          <div
            className="rounded-lg border p-4 bg-slate-50 border-slate-200"
          >
            <h4 className="text-sm font-semibold mb-2 text-primary">
              理赔须知
            </h4>
            <ul className="text-xs space-y-1 text-slate-500">
              <li>✦ 请确保所填信息与保单合同一致，虚假申报将导致申请驳回并记录链上</li>
              <li>✦ 证据材料应清晰完整，仲裁员可在投票前要求补充原件</li>
              <li>✦ 仲裁结果由 DAO 治理规则约束，不受单一方干预</li>
              <li>✦ 联系方式仅用于仲裁员核实，不会对外公开</li>
            </ul>
          </div>
        </section>

        <section className="card">
          <InsuranceClaimForm />
        </section>
      </div>
    </RoleGuard>
  );
}
