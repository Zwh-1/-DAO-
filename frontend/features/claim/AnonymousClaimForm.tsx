'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAnonymousClaimProof } from '@/hooks/useAnonymousClaimProof';
import { useWallet } from '@/hooks/useWallet';
import { anonymousClaimApi } from '@/lib/api/anonymousClaim';
import type { AnonymousClaimStatus } from '@/lib/api/anonymousClaim';
import {
  computeAnonymousCommitment,
  computeAnonymousNullifier,
} from '@/lib/zk/anonymousClaimWitness';
import { parseFieldElement } from '@/lib/zk/fieldScalar';
import { parseEthInputToWei, formatWeiToEth } from '@/lib/zk/claimAmount';
import { generateRandomSecretDecimal } from '@/lib/zk/localSecret';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProofProgress } from '../zk/ProofProgress';
import { PrivacyShield } from '../zk/PrivacyShield';
import { ClaimPoolSummary } from './components/ClaimPoolSummary';
import { ClaimWalletBar } from './components/ClaimWalletBar';
import { ClaimStepIndicator } from './components/ClaimStepIndicator';

const PRIMARY = '#0A2540';

interface WitnessConfig {
  secret: string;
  airdropId: string;
  merkleRoot: string;
  leafIndex: string;
  merklePath: string;
  amount: string;
}

function formatUnixReadable(sec: string): string {
  if (!sec) return '—';
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return sec;
  try {
    return new Date(n * 1000).toLocaleString();
  } catch {
    return sec;
  }
}

/**
 * 匿名申领：分区布局、池子与步骤指引；高级选项可编辑 Merkle 与时间窗。
 */
export function AnonymousClaimForm() {
  const { address, isConnected, chainId } = useWallet();
  const {
    generateAndSubmit,
    isGenerating,
    error: hookError,
    reset,
    defaultWasmPath,
    defaultZkeyPath,
  } = useAnonymousClaimProof();

  const [witnessConfig, setWitnessConfig] = useState<WitnessConfig>({
    secret: '',
    airdropId: '1',
    merkleRoot: '',
    leafIndex: '',
    merklePath: '',
    amount: '1000000000000000000',
  });

  const [amountEth, setAmountEth] = useState('1');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [merkleSynced, setMerkleSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [tsStart, setTsStart] = useState('');
  const [tsEnd, setTsEnd] = useState('');
  const [chainMerkleRoot, setChainMerkleRoot] = useState<string | null>(null);
  const [offchainRoot, setOffchainRoot] = useState<string | null>(null);

  const [claimStatus, setClaimStatus] = useState<AnonymousClaimStatus | null>(null);
  const [statusFetchFailed, setStatusFetchFailed] = useState(false);
  const [showStatusErrorDetails, setShowStatusErrorDetails] = useState(false);

  const [step, setStep] = useState<'config' | 'generating' | 'success' | 'error'>('config');
  const [result, setResult] = useState<{
    txHash?: string;
    nullifier?: string;
    proofTime: number;
    mode?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const contractUnavailable = claimStatus?.source === 'unavailable';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const st = await anonymousClaimApi.getStatus();
        if (cancelled) return;
        setStatusFetchFailed(false);
        setClaimStatus(st);
        if (st.tsStart) setTsStart(st.tsStart);
        if (st.tsEnd) setTsEnd(st.tsEnd);
        if (st.merkleRoot) {
          setChainMerkleRoot(st.merkleRoot);
          setWitnessConfig((prev) => ({ ...prev, merkleRoot: st.merkleRoot || '' }));
        }
        if (st.offchainMerkleRoot) setOffchainRoot(st.offchainMerkleRoot);
      } catch {
        if (!cancelled) {
          setStatusFetchFailed(true);
          setClaimStatus(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (advancedOpen) return;
    try {
      const wei = parseEthInputToWei(amountEth);
      setWitnessConfig((prev) => ({ ...prev, amount: wei }));
    } catch {
      /* 输入不完整时不强制同步 */
    }
  }, [amountEth, advancedOpen]);

  const validateWitness = useCallback((): boolean => {
    if (!witnessConfig.secret.trim()) {
      setErrorMessage('请填写私密密钥，或点击「生成本地密钥」');
      return false;
    }
    try {
      parseFieldElement(witnessConfig.secret);
    } catch {
      setErrorMessage('密钥格式不正确，请使用十进制或 0x 开头的域元素');
      return false;
    }
    if (!witnessConfig.airdropId.trim()) {
      setErrorMessage('请填写活动编号（空投批次）');
      return false;
    }
    try {
      parseFieldElement(witnessConfig.airdropId);
    } catch {
      setErrorMessage('活动编号格式不正确');
      return false;
    }

    let weiAmount: string;
    try {
      weiAmount = advancedOpen
        ? witnessConfig.amount.trim()
        : parseEthInputToWei(amountEth);
    } catch {
      setErrorMessage('领取金额格式不正确，请输入有效数字（如 0.5 或 1）');
      return false;
    }
    if (!weiAmount || BigInt(weiAmount) <= 0n) {
      setErrorMessage('领取金额须大于 0');
      return false;
    }

    if (!advancedOpen) {
      if (!merkleSynced) {
        setErrorMessage('请先点击「同步资格数据」，完成 Merkle 路径拉取');
        return false;
      }
    } else {
      if (!witnessConfig.merkleRoot.trim()) {
        setErrorMessage('请填写 Merkle 根');
        return false;
      }
      if (!/^\d+$/.test(witnessConfig.leafIndex.trim())) {
        setErrorMessage('leaf_index 须为非负整数');
        return false;
      }
      const pathParts = witnessConfig.merklePath
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (pathParts.length !== 20) {
        setErrorMessage('merkle_path 须为 20 个域元素（逗号分隔）');
        return false;
      }
    }

    if (!tsStart || !tsEnd) {
      if (statusFetchFailed) {
        setErrorMessage('无法获取活动时间与参数，请确认网络与服务正常后重试。');
      } else if (contractUnavailable) {
        setErrorMessage(
          '链上合约未配置，无法读取领取时间窗。调试时可在「高级选项」中手动填写 ts_start / ts_end。'
        );
      } else {
        setErrorMessage('缺少领取时间窗，请稍后重试或联系管理员。');
      }
      return false;
    }
    return true;
  }, [
    witnessConfig,
    tsStart,
    tsEnd,
    merkleSynced,
    advancedOpen,
    amountEth,
    statusFetchFailed,
    contractUnavailable,
  ]);

  const runMerkleProofOnly = useCallback(async () => {
    const secret = parseFieldElement(witnessConfig.secret);
    const aid = parseFieldElement(witnessConfig.airdropId);
    const n = await computeAnonymousNullifier(secret, aid);
    const c = await computeAnonymousCommitment(secret, BigInt(n));
    const res = await anonymousClaimApi.postMerkleProof(c);
    const pathStr = res.pathElements.join(', ');
    setWitnessConfig((prev) => ({
      ...prev,
      merkleRoot: res.merkleRoot,
      leafIndex: String(res.leafIndex),
      merklePath: pathStr,
    }));
    return res.merkleRoot;
  }, [witnessConfig.secret, witnessConfig.airdropId]);

  const handleSyncEligibility = useCallback(async () => {
    setErrorMessage('');
    setSyncing(true);
    try {
      const secret = parseFieldElement(witnessConfig.secret);
      const aid = parseFieldElement(witnessConfig.airdropId);
      const n = await computeAnonymousNullifier(secret, aid);
      const c = await computeAnonymousCommitment(secret, BigInt(n));
      try {
        await anonymousClaimApi.registerCommitment(c);
      } catch {
        /* 可能已注册，继续拉取路径 */
      }
      await runMerkleProofOnly();
      setMerkleSynced(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '同步失败，请检查网络或稍后重试');
      setMerkleSynced(false);
    } finally {
      setSyncing(false);
    }
  }, [witnessConfig.secret, witnessConfig.airdropId, runMerkleProofOnly]);

  const handleGenerateSecret = useCallback(() => {
    setWitnessConfig((prev) => ({ ...prev, secret: generateRandomSecretDecimal() }));
    setErrorMessage('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage('');
      if (!address) {
        setErrorMessage('请先连接钱包');
        setStep('error');
        return;
      }
      if (!validateWitness()) {
        setStep('error');
        return;
      }

      const weiAmount = advancedOpen
        ? witnessConfig.amount.trim()
        : parseEthInputToWei(amountEth);

      if (chainMerkleRoot && witnessConfig.merkleRoot.trim() !== chainMerkleRoot) {
        setErrorMessage(
          '当前 Merkle 根与链上合约不一致，无法通过链上校验。请对齐链下白名单树与部署根，或在高级模式中自行确认。'
        );
        setStep('error');
        return;
      }

      setStep('generating');
      const pathParts = witnessConfig.merklePath
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nowTs = Math.floor(Date.now() / 1000);

      const startTime = Date.now();
      const submitResult = await generateAndSubmit(
        {
          secret: witnessConfig.secret.trim(),
          airdropId: witnessConfig.airdropId.trim(),
          leafIndex: Number(witnessConfig.leafIndex),
          merklePath: pathParts,
          merkleRoot: witnessConfig.merkleRoot.trim(),
          claimAmountWei: weiAmount,
          currentTimestamp: String(nowTs),
          tsStart: tsStart,
          tsEnd: tsEnd,
        },
        {
          wasmPath: defaultWasmPath,
          zkeyPath: defaultZkeyPath,
          recipient: address,
        }
      );
      const endTime = Date.now();

      if (!submitResult?.success) {
        setErrorMessage(hookError || '提交失败');
        setStep('error');
        return;
      }

      setResult({
        txHash: submitResult.txHash,
        nullifier: submitResult.nullifier,
        proofTime: endTime - startTime,
        mode: submitResult.mode,
      });
      setStep('success');
    },
    [
      address,
      validateWitness,
      witnessConfig,
      tsStart,
      tsEnd,
      generateAndSubmit,
      hookError,
      chainMerkleRoot,
      defaultWasmPath,
      defaultZkeyPath,
      advancedOpen,
      amountEth,
    ]
  );

  const handleReset = useCallback(() => {
    reset();
    setStep('config');
    setResult(null);
    setErrorMessage('');
    setMerkleSynced(false);
  }, [reset]);

  const rootMismatch =
    chainMerkleRoot &&
    offchainRoot &&
    chainMerkleRoot !== offchainRoot;

  const renderWitnessConfig = useMemo(
    () => (
      <div className="space-y-5">
        <div
          className="border rounded-lg p-4"
          style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}
        >
          <h4 className="text-sm font-semibold mb-1" style={{ color: PRIMARY }}>
            领取流程
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
            连接钱包 → 填写密钥与活动编号 → 同步资格数据 → 验证并领取。证明仅在本地生成。
          </p>
          <p className="text-xs mt-2 font-medium" style={{ color: PRIMARY }}>
            本地算力加密中：您的原始密钥绝不离端，明文不会发送至服务器。
          </p>
        </div>

        {statusFetchFailed && (
          <div
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: '#FECACA', color: '#991B1B', background: '#FEF2F2' }}
          >
            <p>无法获取活动信息，请稍后重试。</p>
            <button
              type="button"
              className="text-xs mt-1 underline underline-offset-2"
              style={{ color: '#991B1B' }}
              onClick={() => setShowStatusErrorDetails((v) => !v)}
            >
              {showStatusErrorDetails ? '收起详情' : '查看排查说明'}
            </button>
            {showStatusErrorDetails && (
              <p className="text-xs mt-2 leading-relaxed opacity-90">
                请确认本机后端服务已启动，且浏览器能访问配置的 API 地址。若您负责部署，请检查前端环境变量中的 API 根地址与后端端口是否一致。
              </p>
            )}
          </div>
        )}

        <ClaimWalletBar address={address} isConnected={isConnected} chainId={chainId} />

        <ClaimStepIndicator
          isConnected={isConnected}
          merkleSynced={merkleSynced}
          advancedOpen={advancedOpen}
          formStep={step}
        />

        <ClaimPoolSummary
          status={claimStatus}
          contractUnavailable={contractUnavailable}
          tsStart={tsStart}
          tsEnd={tsEnd}
          chainMerkleRoot={chainMerkleRoot}
          offchainRoot={offchainRoot}
          rootMismatch={Boolean(rootMismatch)}
          formatUnixReadable={formatUnixReadable}
        />

        <div
          className="space-y-4 pt-1"
          style={{ borderTop: '1px solid #E2E8F0' }}
        >
          <h4 className="text-sm font-semibold" style={{ color: PRIMARY }}>
            填写领取信息
          </h4>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="私密密钥（仅本地保存，勿分享）"
                type="password"
                value={witnessConfig.secret}
                onChange={(e) => {
                  setWitnessConfig((prev) => ({ ...prev, secret: e.target.value }));
                  setMerkleSynced(false);
                }}
                required
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleGenerateSecret}>
              生成本地密钥
            </Button>
          </div>
          <p className="text-xs" style={{ color: '#64748B' }}>
            生成本地密钥后请自行安全备份；丢失将无法再次生成相同领取凭证。
          </p>

          <Input
            label="活动编号（空投批次）"
            type="text"
            value={witnessConfig.airdropId}
            onChange={(e) => {
              setWitnessConfig((prev) => ({ ...prev, airdropId: e.target.value }));
              setMerkleSynced(false);
            }}
            required
          />

          {!advancedOpen && (
            <Input
              label="领取金额（ETH）"
              type="text"
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
              required
            />
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={syncing}
              onClick={handleSyncEligibility}
            >
              {syncing ? '正在同步…' : '同步资格数据'}
            </Button>
            {merkleSynced && !advancedOpen && (
              <span className="text-sm" style={{ color: '#2D8A39' }}>
                已同步（leaf #{witnessConfig.leafIndex}）
              </span>
            )}
          </div>

          {!advancedOpen && merkleSynced && (
            <p className="text-xs" style={{ color: '#64748B' }}>
              Merkle 路径已就绪。如需调试可展开「高级选项」。
            </p>
          )}

          <button
            type="button"
            className="text-sm underline-offset-2 hover:underline text-left w-full"
            style={{ color: PRIMARY }}
            onClick={() => {
              setAdvancedOpen((o) => {
                if (!o) {
                  setAmountEth(formatWeiToEth(witnessConfig.amount));
                }
                return !o;
              });
            }}
          >
            {advancedOpen ? '收起高级选项' : '高级选项（手动 Merkle / wei / 时间窗）'}
          </button>

          {advancedOpen && (
            <div className="space-y-3 pl-2 border-l-2" style={{ borderColor: '#E2E8F0' }}>
              <Input
                label="merkle_root"
                type="text"
                value={witnessConfig.merkleRoot}
                onChange={(e) =>
                  setWitnessConfig((prev) => ({ ...prev, merkleRoot: e.target.value }))
                }
              />
              <Input
                label="leaf_index"
                type="text"
                value={witnessConfig.leafIndex}
                onChange={(e) =>
                  setWitnessConfig((prev) => ({ ...prev, leafIndex: e.target.value }))
                }
              />
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#334155' }}>
                  merkle_path（20 个域元素，逗号分隔）
                </label>
                <textarea
                  className="w-full min-h-[88px] rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                  value={witnessConfig.merklePath}
                  onChange={(e) =>
                    setWitnessConfig((prev) => ({ ...prev, merklePath: e.target.value }))
                  }
                />
              </div>
              <Input
                label="申领金额（wei）"
                type="text"
                value={witnessConfig.amount}
                onChange={(e) =>
                  setWitnessConfig((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="ts_start（Unix 秒）"
                  type="text"
                  value={tsStart}
                  onChange={(e) => setTsStart(e.target.value)}
                />
                <Input
                  label="ts_end（Unix 秒）"
                  type="text"
                  value={tsEnd}
                  onChange={(e) => setTsEnd(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleSyncEligibility}>
                  同步资格数据
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    setErrorMessage('');
                    setSyncing(true);
                    try {
                      await runMerkleProofOnly();
                      setMerkleSynced(true);
                    } catch (e) {
                      setErrorMessage(e instanceof Error ? e.message : '拉取失败');
                    } finally {
                      setSyncing(false);
                    }
                  }}
                >
                  仅拉取 Merkle 路径
                </Button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={!isConnected} variant="primary" className="w-full py-3 text-base">
              {!isConnected ? '请先连接钱包' : '验证资格并领取'}
            </Button>
          </div>
        </div>
      </div>
    ),
    [
      witnessConfig,
      tsStart,
      tsEnd,
      chainMerkleRoot,
      offchainRoot,
      rootMismatch,
      isConnected,
      handleSyncEligibility,
      handleGenerateSecret,
      syncing,
      merkleSynced,
      advancedOpen,
      amountEth,
      statusFetchFailed,
      showStatusErrorDetails,
      claimStatus,
      contractUnavailable,
      address,
      chainId,
      step,
      runMerkleProofOnly,
    ]
  );

  const renderGenerating = useMemo(
    () => (
      <div className="space-y-6">
        <PrivacyShield />
        <div className="space-y-2">
          <ProofProgress value={isGenerating ? 50 : 100} />
          <p className="text-sm text-center" style={{ color: '#64748B' }}>
            {isGenerating ? '正在本地生成 ZK 证明…' : '证明生成完成'}
          </p>
        </div>
      </div>
    ),
    [isGenerating]
  );

  const renderSuccess = useMemo(
    () => (
      <div className="space-y-6">
        <div
          className="border rounded-lg p-6 text-center"
          style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}
        >
          <h3 className="text-lg font-bold mb-1" style={{ color: '#14532D' }}>
            申领已提交
          </h3>
          <p className="text-sm" style={{ color: '#166534' }}>
            {result?.mode === 'onchain' ? '中继已广播链上交易' : '当前为离线模式（未配置中继）'}
          </p>
        </div>

        {result?.nullifier && (
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
            <span className="text-sm text-slate-600">Nullifier</span>
            <span className="text-xs font-mono break-all text-slate-900 max-w-[70%] text-right">
              {result.nullifier}
            </span>
          </div>
        )}

        {result?.txHash && (
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
            <span className="text-sm text-slate-600">txHash</span>
            <span className="text-xs font-mono break-all text-slate-900 max-w-[70%] text-right">
              {result.txHash}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">耗时</span>
          <span className="text-sm font-semibold text-slate-900">{result?.proofTime} ms</span>
        </div>

        <Button type="button" onClick={handleReset} variant="primary" className="w-full">
          再次申领
        </Button>
      </div>
    ),
    [result, handleReset]
  );

  const renderError = useMemo(
    () => (
      <div className="space-y-6">
        <div
          className="border rounded-lg p-6 text-center"
          style={{ background: '#FEF2F2', borderColor: '#FECACA' }}
        >
          <h3 className="text-lg font-bold mb-1" style={{ color: '#991B1B' }}>
            申领失败
          </h3>
          <p className="text-sm" style={{ color: '#B91C1C' }}>
            {errorMessage || hookError || '未知错误'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="button" onClick={handleReset} variant="primary" className="flex-1">
            重试
          </Button>
          <Button
            type="button"
            onClick={() => setStep('config')}
            variant="secondary"
            className="flex-1"
          >
            返回配置
          </Button>
        </div>
      </div>
    ),
    [errorMessage, hookError, handleReset]
  );

  return (
    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-auto overflow-hidden border border-slate-200">
      <div
        className="px-6 py-5 border-b border-slate-800"
        style={{ background: PRIMARY }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 rounded-full bg-white/90" />
          <h3 className="text-xl font-bold text-white tracking-tight">匿名资产申领终端</h3>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-8">
        {step === 'config' && <form onSubmit={handleSubmit}>{renderWitnessConfig}</form>}
        {step === 'generating' && renderGenerating}
        {step === 'success' && renderSuccess}
        {step === 'error' && renderError}
      </div>

      <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: '#64748B' }}>
          <span>
            钱包：{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '未连接'}
          </span>
          <span style={{ color: isConnected ? '#2D8A39' : '#D93025' }}>
            {isConnected ? '● 已连接' : '● 未连接'}
          </span>
        </div>
      </div>
    </div>
  );
}
