'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useGovernanceProposals } from '@/hooks/useQueries';
import { useWallet } from '@/features/wallet';
import { getNetworkByChainId } from '@/lib/wallet/networks';

const STATE_LABEL: Record<string, string> = {
  '0': '待定',
  '1': '投票中',
  '2': '通过',
  '3': '否决',
  '4': '排队中',
  '5': '已执行',
  '6': '已取消',
};

export function TreasuryView() {
  const { proposals, isLoading, error, refetch, isRefetching } = useGovernanceProposals({
    autoRefresh: true,
    refreshInterval: 45000,
  });
  const { chainId, isConnected } = useWallet();

  const govAddr = process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS?.trim() ?? '';
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);

  const queuedOrPassed = useMemo(() => {
    return proposals.filter((p: { state: string }) => p.state === '4' || p.state === '2');
  }, [proposals]);

  useEffect(() => {
    let cancelled = false;
    async function loadOnChain() {
      setChainErr(null);
      if (!govAddr || !/^0x[0-9a-fA-F]{40}$/.test(govAddr)) {
        setEthBalance(null);
        setBlockNumber(null);
        return;
      }
      if (typeof window === 'undefined' || !(window as unknown as { ethereum?: unknown }).ethereum) {
        if (!cancelled) setChainErr('未检测到浏览器钱包扩展，无法读取链上余额。');
        return;
      }
      try {
        const provider = new ethers.BrowserProvider(
          (window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum,
        );
        const bal = await provider.getBalance(govAddr);
        const bn = await provider.getBlockNumber();
        if (!cancelled) {
          setEthBalance(ethers.formatEther(bal));
          setBlockNumber(bn);
        }
      } catch (e) {
        if (!cancelled) setChainErr(e instanceof Error ? e.message : '链上读取失败');
      }
    }
    if (isConnected) loadOnChain();
    else {
      setEthBalance(null);
      setBlockNumber(null);
    }
    return () => {
      cancelled = true;
    };
  }, [govAddr, isConnected, chainId]);

  const explorer = chainId ? getNetworkByChainId(chainId)?.explorerUrl : undefined;
  const etherscanGov =
    explorer && govAddr && /^0x[0-9a-fA-F]{40}$/.test(govAddr)
      ? `${explorer}/address/${govAddr}`
      : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <section className="card">
        <div className="mb-4 flex flex-wrap justify-end gap-3">
          <Link
            href="/dao"
            className="text-sm font-semibold text-primary underline"
          >
            返回 DAO 治理
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-primary">DAO 财库概览</h1>
        <p className="mt-2 section-desc">
          本项目的治理与内存提案 API 并行：财库执行依赖部署的 Governance 与时间锁合约；以下为内存治理中已通过或排队中的提案摘要，以及可选链上余额（需配置{' '}
          <code className="text-xs">NEXT_PUBLIC_GOVERNANCE_ADDRESS</code> 并连接钱包）。
        </p>
      </section>

      <section className="card">
        <h2 className="section-title mb-3">链上 Governance（可选）</h2>
        {!govAddr && (
          <p className="text-sm text-steel">
            未配置治理合约地址：在环境变量中设置 <code className="text-xs">NEXT_PUBLIC_GOVERNANCE_ADDRESS</code>{' '}
            后可在此展示 ETH 余额与浏览器链接。
          </p>
        )}
        {govAddr && (
          <ul className="space-y-2 text-sm text-steel">
            <li>
              合约地址：
              <span className="ml-2 font-mono text-xs text-primary">{govAddr}</span>
              {etherscanGov && (
                <Link href={etherscanGov} className="ml-3 text-primary underline" target="_blank" rel="noreferrer">
                  在浏览器中打开
                </Link>
              )}
            </li>
            {!isConnected && <li className="text-alert">连接钱包后可尝试读取该地址 ETH 余额（只读）。</li>}
            {isConnected && chainErr && <li className="text-alert">{chainErr}</li>}
            {isConnected && !chainErr && ethBalance !== null && (
              <li>
                ETH 余额：<span className="font-semibold text-primary">{ethBalance}</span> ETH
                {blockNumber !== null && (
                  <span className="ml-3 text-xs">区块 {blockNumber}</span>
                )}
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">内存治理：已通过 / 排队中</h2>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-primary hover:bg-surface/80"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? '刷新中…' : '刷新列表'}
          </button>
        </div>
        {isLoading && <p className="text-sm text-steel">加载提案…</p>}
        {error && <p className="text-sm text-alert">{(error as Error).message}</p>}
        {!isLoading && !error && queuedOrPassed.length === 0 && (
          <p className="text-sm text-steel">暂无「通过」或「排队中」状态的内存提案。</p>
        )}
        {!isLoading && !error && queuedOrPassed.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-100/60">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface/80 text-xs uppercase text-steel">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">描述</th>
                  <th className="px-4 py-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {queuedOrPassed.map((p: { id: number; description: string; state: string }) => (
                  <tr key={p.id} className="border-t border-gray-100/60">
                    <td className="px-4 py-3">#{p.id}</td>
                    <td className="max-w-md px-4 py-3 text-steel">{p.description}</td>
                    <td className="px-4 py-3">{STATE_LABEL[p.state] ?? p.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-steel">
          多签与链上提案状态请使用 <code className="text-xs">getOnchainProposalState</code> 等与部署脚本一致的接口；完整操作见{' '}
          <Link href="/dao" className="text-primary underline">
            DAO 治理首页
          </Link>
          。
        </p>
      </section>
    </div>
  );
}
