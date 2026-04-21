'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { apiJson, ApiError } from '@/lib/api/http';
import { V1Routes } from '@/lib/api/v1Routes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import { useSIWE } from '@/hooks/useSIWE';
import { buildIdentityCommitmentCircuitInput } from '@/lib/zk/identityCommitmentWitness';
import { buildAntiSybilVerifierCircuitInput } from '@/lib/zk/antiSybilVerifierWitness';
import { generateProof } from '@/lib/zk/snarkjs';
import { walletSignTypedData } from '@/lib/wallet-adapter';
import { parseEthInputToWei } from '@/lib/zk/claimAmount';
import { generateRandomSecretDecimal } from '@/lib/zk/localSecret';

const PRIMARY = '#0A2540';
const SUCCESS = '#2D8A39';
const ALERT = '#D93025';
const DANGER = '#991b1b';

const INCIDENT_TYPES = [
  { value: 'medical', label: '医疗费用' },
  { value: 'accident', label: '意外伤害' },
  { value: 'disability', label: '伤残' },
  { value: 'critical_illness', label: '重大疾病' },
  { value: 'death', label: '身故' },
  { value: 'other', label: '其他' },
] as const;

type IncidentType = typeof INCIDENT_TYPES[number]['value'];
type FormStep = 'form' | 'submitting' | 'success' | 'error';

interface EvidenceFile {
  name: string;
  size: number;
  type: string;
}

interface FormState {
  policyId: string;
  incidentType: IncidentType | '';
  incidentDate: string;
  description: string;
  claimAmount: string;
  contactInfo: string;
}

function httpErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400: return err.detail || err.message || '请求参数有误，请检查填写内容后重试';
      case 401: return '登录状态已失效，请重新连接钱包并完成 SIWE 签名后再提交';
      case 403: return '您暂无权限提交理赔申请，请确认账户角色已包含「成员」';
      case 404: return '保单号未找到，请确认输入是否正确';
      case 409: return '该保单已存在进行中的理赔申请，不可重复提交';
      case 422: return err.detail || err.message || '提交内容格式有误，请检查各字段后重试';
      case 429: return '提交过于频繁，请稍候片刻再试';
      case 500:
      case 502:
      case 503: return '服务器暂时不可用，请稍后重试或联系管理员';
      default:  return err.message || `请求失败（HTTP ${err.status}）`;
    }
  }
  if (err instanceof Error) return err.message;
  return '提交失败，请稍后重试';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{
        background: done ? SUCCESS : active ? PRIMARY : '#E2E8F0',
        color: done || active ? '#fff' : '#94A3B8',
      }}
    >
      {done ? '✓' : n}
    </div>
  );
}

// ── sessionStorage key ──
const DRAFT_KEY = 'trustaid_claim_draft';

const EMPTY_FORM: FormState = {
  policyId: '',
  incidentType: '',
  incidentDate: '',
  description: '',
  claimAmount: '',
  contactInfo: '',
};

function loadDraft(): FormState {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_FORM;
    return { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<FormState>) };
  } catch {
    return EMPTY_FORM;
  }
}

function saveDraft(form: FormState): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    // sessionStorage quota exceeded or unavailable — silently ignore
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
}

// ── Wizard step labels ──
const WIZARD_STEPS = [
  { label: '基本信息', sub: '保单号、事故类型与日期' },
  { label: '事故详情', sub: '经过描述与申请赔付金额' },
  { label: '证据材料', sub: '上传证明材料与联系方式' },
  { label: 'ZK 身份', sub: '零知识防双重申领验证' },
] as const;

type WizardStep = 0 | 1 | 2 | 3;

interface ZkIdentityState {
  secret: string;
  trapdoor: string;
  socialIdHash: string;
  userLevel: string;
  airdropProjectId: string;
}

const EMPTY_ZK: ZkIdentityState = {
  secret: '',
  trapdoor: '',
  socialIdHash: '0',
  userLevel: '1',
  airdropProjectId: '1',
};

const ANTI_SYBIL_WASM = '/circuits/build/anti_sybil_verifier.wasm';
const ANTI_SYBIL_ZKEY = '/circuits/build/anti_sybil_verifier_final.zkey';

const EIP712_CLAIM_TYPES: Record<string, { name: string; type: string }[]> = {
  Claim: [
    { name: 'nullifier', type: 'uint256' },
    { name: 'identityCommitment', type: 'uint256' },
    { name: 'projectId', type: 'uint256' },
  ],
};

/**
 * 保险理赔申请表单（3 步向导）
 *
 * 特性：
 * - 向导式分步填写（Step 1 基本信息 / Step 2 事故详情 / Step 3 证据与提交）
 * - sessionStorage 草稿箱：输入实时暂存，刷新不丢失
 * - 智能提交：钱包断开提示 → JWT 过期静默 SIWE 重签 → 自动继续提交
 * - 提交至 V1Routes.claim.propose（POST /v1/claim/propose）
 */
export function InsuranceClaimForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── auth / SIWE ──
  const isWalletConnected = useAuthStore((s) => s.isWalletConnected);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const walletAddress = useAuthStore((s) => s.address);
  const { signIn, busy: siweBusy } = useSIWE();

  // ── form state ──
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);

  // ── wizard / submit state ──
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [step, setStep] = useState<FormStep>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [claimId, setClaimId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // ── ZK identity state ──
  const [zkState, setZkState] = useState<ZkIdentityState>(EMPTY_ZK);
  const [zkMerkleProof, setZkMerkleProof] = useState<{
    leafIndex: number;
    merkleRoot: string;
    pathElements: string[];
    pathIndices: number[];
  } | null>(null);
  const [zkSyncing, setZkSyncing] = useState(false);
  const [zkSynced, setZkSynced] = useState(false);
  const walletChainId = useAuthStore((s) => s.walletChainId);

  // ── restore draft on mount ──
  useEffect(() => {
    const draft = loadDraft();
    setForm(draft);
    setDraftLoaded(true);
  }, []);

  // ── persist draft on every change (skip until initial load is done) ──
  useEffect(() => {
    if (!draftLoaded) return;
    saveDraft(form);
  }, [form, draftLoaded]);

  // ── field helpers ──
  const setField = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setEvidenceFiles(files.map((f) => ({ name: f.name, size: f.size, type: f.type })));
  }, []);

  const removeFile = useCallback((index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── per-step validation ──
  const validateStep = useCallback((s: WizardStep): string | null => {
    if (s === 0) {
      if (!form.policyId.trim()) return '请填写保单号';
      if (!form.incidentType) return '请选择事故类型';
      if (!form.incidentDate) return '请选择事故日期';
      const ts = new Date(form.incidentDate).getTime();
      if (Number.isNaN(ts) || ts > Date.now()) return '事故日期不能晚于今天';
    }
    if (s === 1) {
      if (!form.description.trim() || form.description.trim().length < 20)
        return '事故经过描述不能少于 20 个字符';
      if (!form.claimAmount.trim()) return '请填写申请赔付金额';
      const amount = Number(form.claimAmount);
      if (!Number.isFinite(amount) || amount <= 0) return '申请赔付金额须为正数';
    }
    if (s === 2) {
      if (!form.contactInfo.trim()) return '请填写联系方式（手机号或邮箱）';
    }
    if (s === 3) {
      if (!zkState.secret.trim()) return '请填写私密密钥（secret）';
      if (!zkState.trapdoor.trim()) return '请填写陷阱门密钥（trapdoor）';
      if (!zkSynced) return '请先点击「同步 Merkle 路径」完成身份验证';
    }
    return null;
  }, [form, zkState, zkSynced]);

  const goNext = useCallback(() => {
    const err = validateStep(wizardStep);
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage('');
    setWizardStep((prev) => Math.min(prev + 1, 3) as WizardStep);
  }, [wizardStep, validateStep]);

  const handleSyncZkProof = useCallback(async () => {
    setZkSyncing(true);
    setErrorMessage('');
    try {
      const { identity_commitment } = await buildIdentityCommitmentCircuitInput({
        socialIdHash: zkState.socialIdHash.trim() || '0',
        secret: zkState.secret.trim(),
        trapdoor: zkState.trapdoor.trim(),
      });
      const userLevel = Number(zkState.userLevel) || 1;
      const fetchProof = () =>
        apiJson<{ leafIndex: number; merkleRoot: string; pathElements: string[]; pathIndices: number[] }>(
          V1Routes.identity.whitelistProof,
          { method: 'POST', body: JSON.stringify({ identityCommitment: identity_commitment, userLevel }) },
        );

      let result: { leafIndex: number; merkleRoot: string; pathElements: string[]; pathIndices: number[] };
      try {
        result = await fetchProof();
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          await apiJson(V1Routes.identity.whitelistRegister, {
            method: 'POST',
            body: JSON.stringify({ identityCommitment: identity_commitment, userLevel }),
          });
          result = await fetchProof();
        } else {
          throw err;
        }
      }
      setZkMerkleProof(result);
      setZkSynced(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorMessage('身份承诺未能注册到白名单，请稍后重试');
      } else {
        setErrorMessage(httpErrorMessage(err));
      }
      setZkSynced(false);
    } finally {
      setZkSyncing(false);
    }
  }, [zkState]);

  const goBack = useCallback(() => {
    setErrorMessage('');
    setWizardStep((prev) => Math.max(prev - 1, 0) as WizardStep);
  }, []);

  // ── core submit logic (extracted so it can be called after silent SIWE) ──
  const doSubmit = useCallback(async () => {
    setStep('submitting');
    try {
      const newClaimId = crypto.randomUUID();

      // 1. Convert claim amount ETH → wei
      const amountWei = parseEthInputToWei(form.claimAmount.trim());

      // 2. Compute identity commitment from ZK inputs
      const { identity_commitment } = await buildIdentityCommitmentCircuitInput({
        socialIdHash: zkState.socialIdHash.trim() || '0',
        secret: zkState.secret.trim(),
        trapdoor: zkState.trapdoor.trim(),
      });

      // 3. Build anti_sybil_verifier circuit input
      const nowTs = String(Math.floor(Date.now() / 1000));
      const proof_input = await buildAntiSybilVerifierCircuitInput({
        secret: zkState.secret.trim(),
        trapdoor: zkState.trapdoor.trim(),
        socialIdHash: zkState.socialIdHash.trim() || '0',
        pathElements: zkMerkleProof!.pathElements,
        pathIndex: zkMerkleProof!.pathIndices as (0 | 1)[],
        minLevel: '1',
        minAmount: '1',
        maxAmount: String(BigInt('1000') * BigInt('1000000000000000000')),
        tsStart: '0',
        tsEnd: String(Math.floor(Date.now() / 1000) + 365 * 86400),
        airdropProjectId: zkState.airdropProjectId.trim() || '1',
        merkleRoot: zkMerkleProof!.merkleRoot,
        identityCommitment: identity_commitment,
        userLevel: zkState.userLevel.trim() || '1',
        claimAmount: amountWei,
        claimTs: nowTs,
      });

      // 4. Generate real Groth16 ZK proof (runs in main thread; shows spinner)
      const { proof, publicSignals } = await generateProof(
        ANTI_SYBIL_WASM,
        ANTI_SYBIL_ZKEY,
        proof_input,
      );
      const pubSigs = (publicSignals as unknown[]).map(String);

      // 5. Derive nullifierHash from publicSignals[2]
      const nullifierFromProof = BigInt(pubSigs[2]);
      const nullifierHash =
        '0x' + nullifierFromProof.toString(16).padStart(64, '0');

      // 6. Sign EIP-712 Claim with wallet
      const claimVaultAddress =
        process.env.NEXT_PUBLIC_CLAIM_VAULT_ADDRESS ?? '';
      const chainId = walletChainId ?? 31337;
      const claimSignature = await walletSignTypedData({
        domain: {
          name: 'ClaimVaultZK',
          version: '1',
          chainId,
          verifyingContract: claimVaultAddress,
        },
        types: EIP712_CLAIM_TYPES,
        message: {
          nullifier: nullifierFromProof,
          identityCommitment: BigInt(identity_commitment),
          projectId: BigInt(zkState.airdropProjectId.trim() || '1'),
        },
      });

      // 7. Submit
      const data = await apiJson<{ claimId?: string }>(V1Routes.claim.propose, {
        method: 'POST',
        body: JSON.stringify({
          claimId: newClaimId,
          nullifierHash,
          proof,
          publicSignals: pubSigs,
          evidenceCid: 'pending',
          amount: amountWei,
          address: walletAddress ?? '',
          claimSignature,
          policyId: form.policyId.trim(),
          incidentType: form.incidentType,
          incidentDate: form.incidentDate,
          description: form.description.trim(),
          contactInfo: form.contactInfo.trim(),
          evidenceFiles: evidenceFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        }),
      });
      clearDraft();
      setClaimId(data.claimId ?? newClaimId);
      setStep('success');
    } catch (err) {
      setErrorMessage(httpErrorMessage(err));
      setStep('error');
    }
  }, [form, evidenceFiles, walletAddress, zkState, zkMerkleProof, walletChainId]);

  // ── smart submit guard ──
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage('');

      // Step-3 ZK identity validation
      const err = validateStep(3);
      if (err) {
        setErrorMessage(err);
        return;
      }

      // Guard 1: wallet not connected
      if (!isWalletConnected()) {
        setErrorMessage('请先连接钱包后再提交理赔申请');
        return;
      }

      // Guard 2: JWT expired → silent SIWE re-auth, then auto-submit
      if (isTokenExpired()) {
        setStep('submitting'); // show spinner while re-authing
        try {
          await signIn();
        } catch {
          setErrorMessage('重新签名失败，请手动重新连接钱包后再试');
          setStep('error');
          return;
        }
        await doSubmit();
        return;
      }

      await doSubmit();
    },
    [validateStep, isWalletConnected, isTokenExpired, signIn, doSubmit]
  );

  const handleReset = useCallback(() => {
    setStep('form');
    setWizardStep(0);
    setErrorMessage('');
    setClaimId(null);
    setForm(EMPTY_FORM);
    setEvidenceFiles([]);
    setZkState(EMPTY_ZK);
    setZkMerkleProof(null);
    setZkSynced(false);
    clearDraft();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── derived step completion flags ──
  const stepDone: Record<WizardStep, boolean> = {
    0: form.policyId.trim() !== '' && form.incidentType !== '' && form.incidentDate !== '',
    1: form.description.trim().length >= 20 && form.claimAmount.trim() !== '',
    2: form.contactInfo.trim() !== '',
    3: zkSynced,
  };

  // ── loading screen ──
  if (step === 'submitting') {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <div
          className="w-12 h-12 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${PRIMARY} transparent ${PRIMARY} ${PRIMARY}` }}
        />
        <p className="text-sm font-medium" style={{ color: PRIMARY }}>
          {siweBusy ? '正在完成 SIWE 签名，请在钉包中确认…' : '正在生成 ZK 证明并提交理赔，请稍候（此过程可能需要 30-60 秒）…'}
        </p>
      </div>
    );
  }

  // ── success screen ──
  if (step === 'success') {
    return (
      <div className="space-y-6">
        <div
          className="border rounded-lg p-6 text-center"
          style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}
        >
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-lg font-bold mb-1" style={{ color: '#14532D' }}>
            理赔申请已提交
          </h3>
          <p className="text-sm" style={{ color: '#166534' }}>
            您的申请已进入仲裁队列，仲裁员将在规定时间内完成审核。
          </p>
        </div>

        {claimId && (
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
            <span className="text-sm text-slate-600">理赔单号</span>
            <span className="text-sm font-mono font-semibold text-slate-900">{claimId}</span>
          </div>
        )}

        <div
          className="rounded-md border px-4 py-3 text-sm"
          style={{ borderColor: '#BAE6FD', background: '#F0F9FF', color: '#0369A1' }}
        >
          请妥善保存理赔单号，可在「成员中心 → 权益查询」中追踪进度。
        </div>

        <Button type="button" onClick={handleReset} variant="primary" className="w-full">
          提交新申请
        </Button>
      </div>
    );
  }

  // ── wizard form ──
  return (
    <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-auto overflow-hidden border border-slate-200">
      {/* 标题栏 */}
      <div className="px-6 py-5 border-b border-slate-800" style={{ background: PRIMARY }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 rounded-full bg-white/90" />
            <h3 className="text-xl font-bold text-white tracking-tight">理赔申请终端</h3>
          </div>
          <span className="text-xs text-white/60">
            第 {wizardStep + 1} 步，共 4 步
          </span>
        </div>
      </div>

      {/* 顶部步骤进度条 */}
      <div className="flex border-b border-slate-200">
        {WIZARD_STEPS.map((ws, idx) => {
          const isActive = idx === wizardStep;
          const isDone = idx < wizardStep || stepDone[idx as WizardStep];
          return (
            <div
              key={idx}
              className="flex-1 py-3 px-4 flex flex-col items-center gap-0.5 transition-colors"
              style={{
                background: isActive ? '#EFF6FF' : 'transparent',
                borderBottom: isActive ? `2px solid ${PRIMARY}` : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5">
                <StepBadge n={idx + 1} active={isActive} done={isDone} />
                <span
                  className="text-xs font-semibold hidden sm:inline"
                  style={{ color: isActive ? PRIMARY : isDone ? SUCCESS : '#94A3B8' }}
                >
                  {ws.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:block">{ws.sub}</span>
            </div>
          );
        })}
      </div>

      <div className="px-6 sm:px-8 py-8">
        {/* 草稿提示 */}
        {draftLoaded && form.policyId && step === 'form' && wizardStep === 0 && (
          <div
            className="flex items-center justify-between rounded-md border px-3 py-2 text-xs mb-5"
            style={{ borderColor: '#BAE6FD', background: '#F0F9FF', color: '#0369A1' }}
          >
            <span>已恢复上次未提交的草稿</span>
            <button
              type="button"
              className="underline underline-offset-2 ml-3"
              onClick={handleReset}
            >
              清除草稿
            </button>
          </div>
        )}

        {/* 错误横幅 */}
        {(step === 'error' || errorMessage) && errorMessage && (
          <div
            className="border rounded-lg px-4 py-3 text-sm mb-6"
            style={{ borderColor: '#FECACA', background: '#FEF2F2', color: DANGER }}
          >
            {errorMessage}
            {step === 'error' && (
              <button
                type="button"
                className="ml-3 underline underline-offset-2 text-xs"
                style={{ color: DANGER }}
                onClick={() => { setStep('form'); setErrorMessage(''); }}
              >
                返回修改
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Step 0：基本信息 ── */}
          {wizardStep === 0 && (
            <fieldset className="space-y-4">
              <legend
                className="text-sm font-semibold pb-1 border-b w-full"
                style={{ color: PRIMARY, borderColor: '#E2E8F0' }}
              >
                基本信息
              </legend>

              <Input
                label="保单号"
                type="text"
                placeholder="请输入您的保单合同编号"
                value={form.policyId}
                onChange={setField('policyId')}
                required
              />

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#334155' }}>
                  事故类型 <span style={{ color: ALERT }}>*</span>
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  value={form.incidentType}
                  onChange={setField('incidentType')}
                  required
                >
                  <option value="" disabled>请选择事故类型</option>
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <Input
                label="事故发生日期"
                type="date"
                value={form.incidentDate}
                onChange={setField('incidentDate')}
                required
              />
            </fieldset>
          )}

          {/* ── Step 1：事故详情 ── */}
          {wizardStep === 1 && (
            <fieldset className="space-y-4">
              <legend
                className="text-sm font-semibold pb-1 border-b w-full"
                style={{ color: PRIMARY, borderColor: '#E2E8F0' }}
              >
                事故详情
              </legend>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#334155' }}>
                  事故经过描述 <span style={{ color: ALERT }}>*</span>
                </label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-y"
                  placeholder="请详细描述事故发生的时间、地点、经过及伤情（不少于 20 字）"
                  value={form.description}
                  onChange={setField('description')}
                  required
                  minLength={20}
                />
                <p className="text-xs mt-1 text-right" style={{ color: '#94A3B8' }}>
                  {form.description.length} 字{form.description.length < 20 && '（至少 20 字）'}
                </p>
              </div>

              <Input
                label="申请赔付金额（ETH）"
                type="number"
                placeholder="如：0.5"
                min="0.000001"
                step="any"
                value={form.claimAmount}
                onChange={setField('claimAmount')}
                required
              />
            </fieldset>
          )}

          {/* ── Step 2：证据与提交 ── */}
          {wizardStep === 2 && (
            <fieldset className="space-y-4">
              <legend
                className="text-sm font-semibold pb-1 border-b w-full"
                style={{ color: PRIMARY, borderColor: '#E2E8F0' }}
              >
                证据材料与联系方式
              </legend>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#334155' }}>
                  证据文件（可选，支持多选）
                </label>
                <div
                  className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors"
                  style={{ borderColor: '#CBD5E1' }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <p className="text-sm" style={{ color: '#64748B' }}>
                    点击选择文件 · 支持图片、PDF、Word 等格式
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    如：诊断证明、住院发票、事故照片
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.heic"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {evidenceFiles.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {evidenceFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                        style={{ borderColor: '#E2E8F0', background: '#F8FAFC' }}
                      >
                        <span className="truncate max-w-[70%]" style={{ color: '#334155' }}>
                          {f.name}
                        </span>
                        <span className="flex items-center gap-3" style={{ color: '#94A3B8' }}>
                          <span>{formatFileSize(f.size)}</span>
                          <button
                            type="button"
                            style={{ color: '#94A3B8' }}
                            onClick={() => removeFile(i)}
                            aria-label={`移除 ${f.name}`}
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                  * 文件元数据将随申请一并提交；仲裁员审核时可能要求补充原件。
                </p>
              </div>

              <Input
                label="联系方式（手机号或邮箱）"
                type="text"
                placeholder="用于仲裁员与您沟通核实"
                value={form.contactInfo}
                onChange={setField('contactInfo')}
                required
              />

              <div
                className="rounded-md border px-4 py-3 text-xs leading-relaxed"
                style={{ borderColor: '#E2E8F0', background: '#F8FAFC', color: '#64748B' }}
              >
                提交本申请即表示您确认：所填信息真实有效，证据材料未经伪造；本平台将依据 DAO 治理规则
                将申请提交仲裁员审核，结果以链上仲裁投票为准。
              </div>
            </fieldset>
          )}

          {/* ── Step 3：ZK 身份验证 ── */}
          {wizardStep === 3 && (
            <fieldset className="space-y-4">
              <legend
                className="text-sm font-semibold pb-1 border-b w-full"
                style={{ color: PRIMARY, borderColor: '#E2E8F0' }}
              >
                ZK 身份验证
              </legend>

              <div
                className="rounded-md border px-4 py-3 text-xs leading-relaxed"
                style={{ borderColor: '#BAE6FD', background: '#F0F9FF', color: '#0369A1' }}
              >
                零知识证明会在本地生成，您的私密密钥和陷阱门永远不会离开浏览器。
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="私密密钥（secret）"
                    type="password"
                    placeholder="注册身份时生成的私密密钥"
                    value={zkState.secret}
                    onChange={(e) => { setZkState((p) => ({ ...p, secret: e.target.value })); setZkSynced(false); }}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 mb-0.5"
                  onClick={() => { setZkState((p) => ({ ...p, secret: generateRandomSecretDecimal(), trapdoor: generateRandomSecretDecimal() })); setZkSynced(false); }}
                >
                  随机生成
                </Button>
              </div>

              <Input
                label="陷阱门密钥（trapdoor）"
                type="password"
                placeholder="注册身份时生成的陷阱门密钥"
                value={zkState.trapdoor}
                onChange={(e) => { setZkState((p) => ({ ...p, trapdoor: e.target.value })); setZkSynced(false); }}
                required
              />

              <Input
                label="Social ID 哈希（可选，默认 0）"
                type="text"
                placeholder="0"
                value={zkState.socialIdHash}
                onChange={(e) => { setZkState((p) => ({ ...p, socialIdHash: e.target.value })); setZkSynced(false); }}
              />

              <div className="flex gap-3 items-center">
                <Button
                  type="button"
                  variant="primary"
                  className="shrink-0"
                  disabled={zkSyncing || !zkState.secret.trim() || !zkState.trapdoor.trim()}
                  onClick={handleSyncZkProof}
                >
                  {zkSyncing ? '同步中…' : '同步 Merkle 路径'}
                </Button>
                {zkSynced && (
                  <span className="text-xs font-medium" style={{ color: SUCCESS }}>
                    ✓ Merkle 路径已同步（leaf #{zkMerkleProof?.leafIndex}）
                  </span>
                )}
              </div>
            </fieldset>
          )}

          {/* ── 导航按钮 ── */}
          <div className="flex gap-3 pt-2">
            {wizardStep > 0 && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={goBack}
              >
                上一步
              </Button>
            )}
            {wizardStep < 3 ? (
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={goNext}
              >
                下一步
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                className="flex-1 py-3 text-base"
                disabled={siweBusy}
              >
                {siweBusy ? '签名中…' : '提交理赔申请'}
              </Button>
            )}
          </div>
        </form>
      </div>

      <div
        className="px-6 sm:px-8 py-4 border-t border-slate-200"
        style={{ background: '#F8FAFC' }}
      >
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          理赔流程：提交申请 → 仲裁员 Commit-Reveal 投票 → 链上执行赔付
        </p>
      </div>
    </div>
  );
}
