"use client";

import Link from "next/link";
import { useAuthStore, ROLE_LABEL, type RoleId } from "@/store/authStore";
import { getNetworkByChainId } from "@/lib/wallet/networks";
import { useMemberActivity, useMemberReputation } from "@/hooks/useQueries";
import { useWallet } from "@/features/wallet";
import { formatShortTime } from "@/lib/utils/format";

const QUICK_LINKS: { href: string; label: string; roles?: RoleId[] }[] = [
  { href: "/claim", label: "理赔申请" },
  { href: "/airdrop", label: "空投奖励" },
  { href: "/member", label: "成员中心首页" },
  { href: "/dao", label: "DAO 治理", roles: ["dao"] },
  { href: "/oracle", label: "预言机工作台", roles: ["oracle"] },
  { href: "/guardian", label: "守护者", roles: ["guardian"] },
  { href: "/challenger", label: "挑战者", roles: ["challenger"] },
  { href: "/arbitrator", label: "仲裁工作台", roles: ["arbitrator"] },
];

const ROLE_HINT: Record<RoleId, string> = {
  member: "成员中心、理赔与申领相关页面",
  challenger: "挑战者工作台与挑战记录",
  dao: "DAO 提案、成员管理与财库",
  arbitrator: "仲裁案件与投票",
  oracle: "预言机报告与通道相关入口",
  guardian: "黑名单、熔断与守护者工具",
};

const ROLE_IDS: RoleId[] = ["member", "challenger", "dao", "arbitrator", "oracle", "guardian"];

function filterRoles(raw: string[] | null | undefined): RoleId[] {
  return (raw ?? []).filter((x): x is RoleId => ROLE_IDS.includes(x as RoleId));
}

/** 快捷入口：公共链接始终显示；带 roles 的仅在有对应 JWT 角色时显示 */
export function ProfileQuickLinks() {
  const roles = filterRoles(useAuthStore((s) => s.roles));
  const set = new Set(roles);

  const visible = QUICK_LINKS.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.some((r) => set.has(r));
  });

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:border-primary/30 hover:bg-primary/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

/** 隐私与数据说明（折叠，无接口） */
export function ProfilePrivacyFold() {
  return (
    <details className="profile-soft-card group open:shadow-md">
      <summary className="cursor-pointer list-none px-6 py-4 font-semibold text-primary md:px-8 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-slate-400 transition group-open:rotate-90" aria-hidden>
            ▸
          </span>
          隐私与数据说明
        </span>
      </summary>
      <div className="border-t border-slate-100 px-6 pb-6 pt-2 text-sm leading-relaxed text-slate-600 md:px-8">
        <ul className="list-inside list-disc space-y-2">
          <li>零知识证明相关见证数据（secret / trapdoor）仅在您的设备本地使用，不会作为明文上传至服务器。</li>
          <li>服务端按业务需要存储公开承诺、Nullifier 与链上可验证摘要；不会在日志中记录钱包与社交账号的明文对应关系。</li>
          <li>当前会话以 JWT（Bearer）为准；敏感操作仍由服务端校验完整角色列表。</li>
        </ul>
      </div>
    </details>
  );
}

/** 当前 JWT 角色与可访问能力（只读） */
export function ProfileRoleHelp() {
  const roles = filterRoles(useAuthStore((s) => s.roles));
  if (roles.length === 0) return null;

  return (
    <section className="profile-soft-card">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary">
        <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.5 9-7 10-3.5-1-7-5-7-10V7l7-4z" />
        </svg>
        角色与权限摘要
      </h2>
      <ul className="space-y-2 text-sm text-slate-600">
        {roles.map((r) => (
          <li key={r} className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-primary">{ROLE_LABEL[r]}</span>
            <span className="text-slate-500">{ROLE_HINT[r]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 近期动态（接 GET /v1/member/activity） */
export function ProfileActivityPlaceholder() {
  const { address } = useWallet();
  const { activities, isLoading, error } = useMemberActivity(address ?? null);

  return (
    <div className="border-t border-slate-100 pt-6">
      <h3 className="mb-3 text-base font-semibold text-primary">近期动态</h3>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <p className="text-sm text-[#D93025]">加载活动记录失败，请稍后重试。</p>
      )}

      {!isLoading && !error && activities.length === 0 && (
        <p className="text-sm text-slate-400">暂无活动记录。完成链上操作后将自动记录于此。</p>
      )}

      {!isLoading && !error && activities.length > 0 && (
        <ul className="space-y-3">
          {activities.slice(0, 10).map((row) => (
            <li key={row.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2D8A39]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-slate-800">{row.detail}</p>
                <p className="text-xs text-slate-400">
                  {formatShortTime(row.timestamp)}
                  {row.txHash && (
                    <span className="ml-2 font-mono text-slate-300">
                      tx: {row.txHash.slice(0, 10)}…
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 声誉趋势（接 GET /v1/member/reputation） */
export function ProfileReputationPlaceholder() {
  const { address } = useWallet();
  const { score, trend, isLoading, error } = useMemberReputation(address ?? null);

  const maxScore = Math.max(1, ...trend.map((t) => t.score));

  return (
    <div className="border-t border-slate-100 pt-6">
      <h3 className="mb-2 text-base font-semibold text-primary">
        声誉趋势
        {score != null && !isLoading && (
          <span className="ml-2 text-sm font-normal text-[#2D8A39]">{score} 分</span>
        )}
      </h3>

      {isLoading && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
          <span className="animate-pulse">加载声誉数据…</span>
        </div>
      )}

      {!isLoading && error && (
        <p className="text-sm text-[#D93025]">加载声誉趋势失败。</p>
      )}

      {!isLoading && !error && trend.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          暂无声誉数据
        </div>
      )}

      {!isLoading && !error && trend.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex h-28 items-end gap-1">
            {trend.map((t) => {
              const pct = Math.max(4, (t.score / maxScore) * 100);
              return (
                <div
                  key={t.date}
                  className="group relative flex flex-1 flex-col items-center"
                >
                  <div
                    className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="mt-1 text-[10px] text-slate-400">
                    {t.date.slice(5)}
                  </span>
                  <span className="absolute -top-5 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {t.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** 区块浏览器地址页（新标签） */
export function ProfileExplorerLink({
  address,
  chainId,
}: {
  address: string | null | undefined;
  chainId: number | null | undefined;
}) {
  if (!address) return null;
  const net = chainId != null ? getNetworkByChainId(chainId) : undefined;
  const base = net?.explorerUrl ?? process.env.NEXT_PUBLIC_EXPLORER_URL;
  if (!base) return null;
  const href = `${base.replace(/\/$/, "")}/address/${address}`;
  return (
    <p className="mt-4 text-sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        在区块浏览器中查看地址
      </a>
    </p>
  );
}
