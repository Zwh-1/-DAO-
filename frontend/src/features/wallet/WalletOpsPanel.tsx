"use client";

import { useEffect, useRef, useState } from "react";
import { JsonRpcProvider, parseEther } from "ethers";
import {
  createOrImportEmbeddedWallet,
  deriveNextEmbeddedAccount,
  requestPrimaryAccount,
  selectEmbeddedAccount,
  setEmbeddedWalletConfig,
  setWalletApprovalHandler,
  walletSendTransaction,
  walletSignTypedData,
  walletSwitchChain
} from '@/lib/wallet/wallet-adapter';

type WalletOpsPanelProps = {
  title?: string;
  description?: string;
  actions?: {
    switchChain?: boolean;
    signTypedData?: boolean;
    sendTransaction?: boolean;
  };
  onResult?: (data: unknown) => void;
  onError?: (error: unknown) => void;
};

type ApprovalState = {
  open: boolean;
  action: string;
  payload: Record<string, unknown>;
};

export function WalletOpsPanel({
  title = "钱包能力最小点测",
  description = "通过 wallet-adapter 调用 switchChain / signTypedData / sendTransaction，业务层不直接接触底层 provider。",
  actions,
  onResult,
  onError
}: WalletOpsPanelProps) {
  const enabled = {
    switchChain: actions?.switchChain ?? true,
    signTypedData: actions?.signTypedData ?? true,
    sendTransaction: actions?.sendTransaction ?? true
  };

  const [walletOps, setWalletOps] = useState({
    chainIdHex: "0x539",
    to: "",
    amountEth: "0.0001",
    password: "",
    rpcUrl: "http://127.0.0.1:8545",
    mnemonic: "",
    embeddedAddress: ""
  });
  const [approval, setApproval] = useState<ApprovalState>({ open: false, action: "", payload: {} });
  const approvalResolver = useRef<((allowed: boolean) => void) | null>(null);

  useEffect(() => {
    setEmbeddedWalletConfig({ password: walletOps.password, rpcUrl: walletOps.rpcUrl });
  }, [walletOps.password, walletOps.rpcUrl]);

  useEffect(() => {
    setWalletApprovalHandler(async (intent) => {
      setApproval({ open: true, action: intent.action, payload: intent.payload || {} });
      return await new Promise<boolean>((resolve) => {
        approvalResolver.current = resolve;
      });
    });
    return () => {
      setWalletApprovalHandler(null);
      approvalResolver.current = null;
    };
  }, []);

  function resolveApproval(allowed: boolean) {
    const resolve = approvalResolver.current;
    approvalResolver.current = null;
    setApproval((prev) => ({ ...prev, open: false }));
    resolve?.(allowed);
  }

  async function onSwitchChain() {
    try {
      await walletSwitchChain(walletOps.chainIdHex.trim());
      onResult?.({ ok: true, action: "switchChain", chainIdHex: walletOps.chainIdHex });
    } catch (error) {
      onError?.(error);
    }
  }

  async function onSignTypedData() {
    try {
      const addr = await requestPrimaryAccount();
      const typedData = {
        domain: { name: "TrustAid Wallet Adapter", version: "1", chainId: 1337 },
        types: {
          Mail: [
            { name: "owner", type: "address" },
            { name: "content", type: "string" }
          ]
        },
        message: {
          owner: addr,
          content: "TrustAid typedData test"
        }
      };
      const signature = await walletSignTypedData(typedData);
      onResult?.({ ok: true, action: "signTypedData", address: addr, signature });
    } catch (error) {
      onError?.(error);
    }
  }

  async function onSendTransaction() {
    try {
      const from = await requestPrimaryAccount();
      const valueWei = parseEther(walletOps.amountEth).toString();
      const estimated = await estimateTxMeta({
        from,
        to: walletOps.to,
        valueWei,
        rpcUrl: walletOps.rpcUrl
      });
      const txHash = await walletSendTransaction({
        from,
        to: walletOps.to,
        value: "0x" + parseEther(walletOps.amountEth).toString(16),
        valueWei,
        gasLimit: estimated.gasLimit,
        nonce: estimated.nonce
      });
      onResult?.({ ok: true, action: "sendTransaction", from, to: walletOps.to, txHash });
    } catch (error) {
      onError?.(error);
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 section-title">{title}</h2>
      <p className="mb-3 text-sm text-steel">{description}</p>
      <div className="space-y-3">
        <Input
          label="Embedded 钱包密码（启用 embedded 必填）"
          value={walletOps.password}
          onChange={(value) => setWalletOps({ ...walletOps, password: value })}
        />
        <Input
          label="Embedded RPC URL"
          value={walletOps.rpcUrl}
          onChange={(value) => setWalletOps({ ...walletOps, rpcUrl: value })}
        />
        <Input
          label="助记词（可选，导入用）"
          value={walletOps.mnemonic}
          onChange={(value) => setWalletOps({ ...walletOps, mnemonic: value })}
        />
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const result = await createOrImportEmbeddedWallet({
                  password: walletOps.password,
                  mnemonic: walletOps.mnemonic.trim() || undefined
                });
                setWalletOps({ ...walletOps, embeddedAddress: result.address });
                onResult?.({ ok: true, action: "createOrImportEmbeddedWallet", address: result.address });
              } catch (error) {
                onError?.(error);
              }
            }}
            className="rounded-md bg-primary px-4 py-2 text-white"
          >
            创建/导入 Embedded 钱包
          </button>
          <button
            onClick={async () => {
              try {
                const address = await deriveNextEmbeddedAccount(walletOps.password);
                setWalletOps({ ...walletOps, embeddedAddress: address });
                onResult?.({ ok: true, action: "deriveNextEmbeddedAccount", address });
              } catch (error) {
                onError?.(error);
              }
            }}
            className="rounded-md bg-primary px-4 py-2 text-white"
          >
            派生下一账户
          </button>
        </div>
        <Input
          label="选择 Embedded 账户地址（可选）"
          value={walletOps.embeddedAddress}
          onChange={(value) => setWalletOps({ ...walletOps, embeddedAddress: value })}
        />
        <button
          onClick={async () => {
            try {
              await selectEmbeddedAccount(walletOps.password, walletOps.embeddedAddress);
              onResult?.({ ok: true, action: "selectEmbeddedAccount", address: walletOps.embeddedAddress });
            } catch (error) {
              onError?.(error);
            }
          }}
          className="rounded-md bg-primary px-4 py-2 text-white"
        >
          选择 Embedded 账户
        </button>
        {enabled.switchChain && (
          <Input
            label="目标链 ID（16 进制）"
            value={walletOps.chainIdHex}
            onChange={(value) => setWalletOps({ ...walletOps, chainIdHex: value })}
          />
        )}
        <div className="flex gap-2">
          {enabled.switchChain && (
            <button onClick={onSwitchChain} className="rounded-md bg-primary px-4 py-2 text-white">
              切换链
            </button>
          )}
          {enabled.signTypedData && (
            <button onClick={onSignTypedData} className="rounded-md bg-primary px-4 py-2 text-white">
              签名 TypedData
            </button>
          )}
        </div>
        {enabled.sendTransaction && (
          <>
            <Input
              label="转账目标地址（sendTransaction）"
              value={walletOps.to}
              onChange={(value) => setWalletOps({ ...walletOps, to: value })}
            />
            <Input
              label="转账 ETH 数量（字符串）"
              value={walletOps.amountEth}
              onChange={(value) => setWalletOps({ ...walletOps, amountEth: value })}
            />
            <button onClick={onSendTransaction} className="rounded-md bg-success px-4 py-2 text-white">
              发送交易
            </button>
          </>
        )}
        {!enabled.switchChain && !enabled.signTypedData && !enabled.sendTransaction && (
          <p className="text-sm text-steel">当前页面未启用钱包操作按钮。</p>
        )}
      </div>
      <WalletApprovalModal approval={approval} onApprove={() => resolveApproval(true)} onReject={() => resolveApproval(false)} />
    </section>
  );
}

async function estimateTxMeta(input: { from: string; to: string; valueWei: string; rpcUrl: string }) {
  try {
    const provider = new JsonRpcProvider(input.rpcUrl);
    const [gas, nonce] = await Promise.all([
      provider.estimateGas({ from: input.from, to: input.to, value: BigInt(input.valueWei) }),
      provider.getTransactionCount(input.from, "pending")
    ]);
    return { gasLimit: gas.toString(), nonce: String(nonce) };
  } catch {
    return { gasLimit: "待钱包估算", nonce: "待钱包分配" };
  }
}

function WalletApprovalModal({
  approval,
  onApprove,
  onReject
}: {
  approval: ApprovalState;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!approval.open) return null;

  const actionText =
    approval.action === "sendTransaction"
      ? "发送交易"
      : approval.action === "signTypedData"
        ? "签名 TypedData"
        : "签名消息";
  const txTo = String(approval.payload.to || "");
  const txValueWei = String(approval.payload.valueWei || "");
  const gasLimit = String(approval.payload.gasLimit || "待钱包估算");
  const nonce = String(approval.payload.nonce || "待钱包分配");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-100/60 bg-white p-5">
        <h3 className="text-lg font-semibold text-primary">钱包授权确认</h3>
        <p className="mt-2 text-sm text-steel">你正在执行：{actionText}</p>

        <div className="mt-4 space-y-2 rounded-lg border border-gray-100/60 bg-surface p-3 text-sm text-primary">
          <p>目标地址: {txTo || "-"}</p>
          <p>金额(wei): {txValueWei || "-"}</p>
          <p>预估 Gas: {gasLimit}</p>
          <p>Nonce: {nonce}</p>
        </div>

        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          风险提示：请确认目标地址与金额无误。签名或交易一旦提交，通常不可撤销。
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onReject} className="rounded-md bg-alert px-4 py-2 text-white">
            拒绝
          </button>
          <button onClick={onApprove} className="rounded-md bg-primary px-4 py-2 text-white">
            确认并继续
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-primary">
      <span className="mb-1 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-100/60 px-3 py-2"
      />
    </label>
  );
}
