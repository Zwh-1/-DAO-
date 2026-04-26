"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth";
import { PageTransition } from "@/components/ui/index";
import { useWallet } from "@/features/wallet";

export default function ArbitrationRewardsPage() {
  const { address, isConnected } = useWallet();

  return (
    <RoleGuard required="arbitrator">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <section className="card">
            <Link href="/arbitration" className="text-steel hover:text-primary text-sm">← 仲裁工作台</Link>
            <h1 className="text-2xl font-bold text-primary mt-3">奖励中心</h1>
            <p className="mt-1 section-desc">
              完成仲裁并通过 Reveal 后，系统将根据共识结果向参与仲裁员发放奖励，以 Token 结算。
            </p>
          </section>

          <section className="card">
            <h2 className="section-title mb-4">奖励概览</h2>
            {!isConnected && (
              <p className="text-sm text-steel text-center py-8">请先连接钱包以查看奖励记录。</p>
            )}
            {isConnected && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["待领取", "0", "text-primary"],
                  ["已领取", "0", "text-success"],
                  ["总计", "0", "text-steel"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="rounded-xl bg-surface/50 border border-gray-100/60 p-4 text-center">
                    <p className="text-xs text-steel mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${cls}`}>{val}</p>
                    <p className="text-xs text-steel/60 mt-0.5">Token</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isConnected && (
            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">奖励记录</h2>
              </div>
              <div className="text-center py-10 text-steel text-sm">
                <p>暂无奖励记录</p>
                <p className="text-xs mt-1">完成仲裁案件后奖励将在此显示</p>
                <Link href="/arbitration/cases" className="mt-3 inline-block text-primary underline text-xs">
                  前往案件列表
                </Link>
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="section-title mb-3">奖励规则</h2>
            <div className="space-y-3 text-sm text-steel">
              {[
                ["裁决奖励", "每次成功完成 Commit + Reveal 后，按固定费率发放基础奖励"],
                ["一致率加成", "投票与最终共识一致时，额外获得 1.2× 奖励倍率"],
                ["惩罚机制", "超时未 Reveal 或恶意投票将扣除质押并降低信用分"],
                ["领取方式", "奖励自动累计至链上余额，可通过合约领取"],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="font-semibold text-primary w-20 flex-shrink-0">{title}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>

          {isConnected && address && (
            <div className="card text-center py-4">
              <button className="rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors opacity-50 cursor-not-allowed">
                领取奖励（链上合约功能开发中）
              </button>
            </div>
          )}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
