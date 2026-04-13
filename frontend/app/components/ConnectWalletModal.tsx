"use client";

import { useEffect, useRef, useState } from "react";
import {
  createOrImportEmbeddedWallet,
  getWalletClient,
  setEmbeddedWalletConfig,
  setWalletMode,
} from "../../lib/wallet-adapter";
import { useSIWE } from "../../hooks/useSIWE";

// ---- 图标 SVG ----

function MetaMaskIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden>
      <path d="M35.2 3 22.1 12.7l2.4-5.7L35.2 3z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.8 3l13 9.8-2.3-5.8L4.8 3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30.3 27.8l-3.5 5.3 7.5 2.1 2.2-7.3-6.2-.1z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 27.9 5.7 35l7.5-2.1-3.5-5.3-6.2.3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.2 18.4-2.1 3.2 7.5.3-.2-8-5.2 4.5z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m26.8 18.4-5.3-4.6-.2 8.1 7.5-.3-2-3.2z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.2 33.2 4.5-2.2-3.9-3-.6 5.2z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22.3 31-3.9 2.2-.7-5.2 4.6 3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmbeddedIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none" aria-hidden>
      <rect x="6" y="10" width="28" height="20" rx="4" stroke="#0A2540" strokeWidth="2.2" />
      <rect x="14" y="18" width="12" height="8" rx="2" stroke="#0A2540" strokeWidth="2" />
      <path d="M20 14v4" stroke="#0A2540" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="1.5" fill="#0A2540" />
    </svg>
  );
}

function WalletConnectIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#3B99FC" />
      <path d="M11.5 19c4.7-4.7 12.3-4.7 17 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M14.5 22c2.8-2.8 7.2-2.8 10 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="20" cy="26" r="2" fill="white" />
    </svg>
  );
}

// ---- 可选钱包类型 ----

type WalletOption = {
  id: "metamask" | "embedded" | "walletconnect";
  label: string;
  description: string;
  Icon: React.FC;
  badge?: string;
};

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "metamask",
    label: "MetaMask",
    description: "浏览器插件钱包",
    Icon: MetaMaskIcon,
    badge: "已安装",
  },
  {
    id: "embedded",
    label: "本地内置钱包",
    description: "密码加密 · 私钥不离端",
    Icon: EmbeddedIcon,
  },
  {
    id: "walletconnect",
    label: "WalletConnect",
    description: "扫码连接手机钱包",
    Icon: WalletConnectIcon,
    badge: "敬请期待",
  },
];

// ---- 主弹窗 ----

export interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---- embedded 钱包阶段类型 ----
type EmbeddedPhase =
  | { stage: "form" }                         // 初始表单
  | { stage: "ready"; address: string }        // 钱包已就绪，等待 SIWE
  | { stage: "siwe_error"; address: string; msg: string }; // SIWE 失败但钱包已导入

export function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const [selected, setSelected] = useState<WalletOption["id"]>("metamask");
  const [password, setPassword] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [embeddedTab, setEmbeddedTab] = useState<"unlock" | "create" | "import">("unlock");
  const [embeddedPhase, setEmbeddedPhase] = useState<EmbeddedPhase>({ stage: "form" });
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, busy: siweBusy } = useSIWE();
  const overlayRef = useRef<HTMLDivElement>(null);

  const busy = localBusy || siweBusy;

  // 键盘 Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // 切换钱包类型时重置 embedded 状态
  function selectWallet(id: WalletOption["id"]) {
    setSelected(id);
    setEmbeddedPhase({ stage: "form" });
    setError(null);
  }

  if (!isOpen) return null;

  // ── MetaMask：直接一步 SIWE ──
  async function handleMetaMaskConnect() {
    setError(null);
    try {
      setWalletMode("injected");
      await signIn();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // ── embedded 第一阶段：本地导入/创建（纯本地，无需后端）──
  async function handleEmbeddedSetup() {
    if (!password) { setError("请输入钱包密码"); return; }
    if (embeddedTab === "import" && !mnemonic.trim()) { setError("请输入助记词"); return; }
    setError(null);
    setLocalBusy(true);
    try {
      setWalletMode("embedded");
      setEmbeddedWalletConfig({ password, rpcUrl: "http://127.0.0.1:8545" });

      let address: string;
      if (embeddedTab === "unlock") {
        // 解锁：只需列出账户，不做写操作
        const accounts = await getWalletClient().listEmbeddedAccounts(password);
        if (!accounts.length) throw new Error("未找到账户，请先创建钱包或导入助记词");
        address = String(accounts[0]);
      } else {
        address = await createOrImportEmbeddedWallet(
          embeddedTab === "import"
            ? { password, mnemonic: mnemonic.trim() }
            : { password }
        );
      }
      setEmbeddedPhase({ stage: "ready", address });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocalBusy(false);
    }
  }

  // ── embedded 第二阶段：SIWE 签名登录（需要后端）──
  async function handleEmbeddedSignIn() {
    setError(null);
    try {
      await signIn();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const addr = embeddedPhase.stage !== "form" ? embeddedPhase.address : "";
      setEmbeddedPhase({ stage: "siwe_error", address: addr, msg });
    }
  }

  const currentOption = WALLET_OPTIONS.find(w => w.id === selected)!;
  void currentOption;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-[620px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row min-h-[400px]">

        {/* ── 左侧：钱包列表 ── */}
        <aside className="w-full sm:w-[200px] flex-shrink-0 bg-surface border-b sm:border-b-0 sm:border-r border-gray-100/60 p-5 flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-primary mb-4">连接钱包</h2>

          {WALLET_OPTIONS.map((opt) => {
            const isDisabled = opt.id === "walletconnect";
            return (
              <button
                key={opt.id}
                disabled={isDisabled}
                onClick={() => { if (!isDisabled) { setSelected(opt.id); setError(null); } }}
                className={[
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  selected === opt.id
                    ? "bg-primary text-white shadow-sm"
                    : "text-steel hover:bg-gray-100",
                  isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                <span className="flex-shrink-0">
                  <opt.Icon />
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-medium">{opt.label}</span>
                  {opt.badge && (
                    <span className={[
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      selected === opt.id
                        ? (opt.id === "walletconnect" ? "bg-white/20 text-white" : "bg-white/20 text-white")
                        : (opt.id === "walletconnect" ? "bg-gray-200 text-steel/60" : "bg-success/15 text-success")
                    ].join(" ")}>
                      {opt.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          <div className="mt-auto pt-4 text-[11px] text-steel/60 leading-relaxed">
            私钥永不离端<br />AI 助手不会索要私钥
          </div>
        </aside>

        {/* ── 右侧：交互区 ── */}
        <section className="flex-1 p-8 flex flex-col">
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="self-end text-steel/60 hover:text-steel transition mb-2"
            aria-label="关闭"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>

          {selected === "metamask" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <MetaMaskIcon />
              <h3 className="mt-4 text-[17px] font-semibold text-primary">正在打开 MetaMask…</h3>
              <p className="mt-2 text-sm text-steel">请在浏览器扩展中确认连接请求</p>
              <div className="mt-6 w-full max-w-xs">
                {error && (
                  <p className="mb-3 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  onClick={handleMetaMaskConnect}
                  disabled={busy}
                  className="w-full bg-primary text-white font-medium py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
                >
                  {busy ? "连接中…" : "确认连接"}
                </button>
              </div>
            </div>
          )}

          {selected === "embedded" && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <EmbeddedIcon />
                <div>
                  <h3 className="text-[16px] font-semibold text-primary">本地内置钱包</h3>
                  <p className="text-xs text-steel mt-0.5">密钥加密存储于本地 · 明文不离端</p>
                </div>
              </div>

              {/* ── 阶段一：钱包表单 ── */}
              {embeddedPhase.stage === "form" && (
                <>
                  {/* 操作模式 Tab */}
                  <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1 text-xs">
                    {(["unlock", "create", "import"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setEmbeddedTab(tab); setError(null); }}
                        className={[
                          "flex-1 py-1.5 rounded-md font-medium transition",
                          embeddedTab === tab ? "bg-white shadow-sm text-primary" : "text-steel hover:text-primary"
                        ].join(" ")}
                      >
                        {tab === "unlock" ? "解锁" : tab === "create" ? "新建" : "导入助记词"}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 flex-1">
                    <div>
                      <label className="block text-xs font-medium text-steel mb-1">
                        钱包密码 <span className="text-alert">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder={embeddedTab === "unlock" ? "输入已设置的密码" : "设置钱包密码（至少 8 位）"}
                        className="w-full px-3 py-2 text-sm border border-gray-100/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    {embeddedTab === "import" && (
                      <div>
                        <label className="block text-xs font-medium text-steel mb-1">
                          助记词 <span className="text-alert">*</span>
                        </label>
                        <textarea
                          rows={3}
                          placeholder="输入 12 或 24 个单词，用空格分隔"
                          className="w-full px-3 py-2 text-sm border border-gray-100/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono text-xs"
                          value={mnemonic}
                          onChange={(e) => setMnemonic(e.target.value)}
                        />
                        <p className="text-[11px] text-steel mt-1">
                          🔒 本地算力加密中：助记词仅在本地处理，明文不会发送至服务器
                        </p>
                      </div>
                    )}

                    {embeddedTab === "unlock" && (
                      <p className="text-xs text-steel bg-surface border border-gray-100/60 rounded-lg px-3 py-2">
                        使用已有密码解锁本地钱包。此步骤<strong>无需网络连接</strong>，纯本地验证。
                      </p>
                    )}
                    {embeddedTab === "create" && (
                      <p className="text-xs text-steel bg-surface border border-gray-100/60 rounded-lg px-3 py-2">
                        将在本地生成新的助记词并加密存储，请务必在安全环境中备份。
                      </p>
                    )}
                  </div>

                  {error && (
                    <p className="mt-3 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    onClick={handleEmbeddedSetup}
                    disabled={busy || !password}
                    className="mt-4 w-full bg-primary text-white font-medium py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {busy
                      ? "处理中…"
                      : embeddedTab === "unlock"
                        ? "解锁钱包"
                        : embeddedTab === "create"
                          ? "创建钱包"
                          : "导入钱包"}
                  </button>
                </>
              )}

              {/* ── 阶段二：钱包就绪，等待 SIWE ── */}
              {(embeddedPhase.stage === "ready" || embeddedPhase.stage === "siwe_error") && (
                <>
                  <div className="flex items-center gap-2 mb-4 bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-success">钱包已就绪</p>
                      <p className="text-[11px] font-mono text-success/80 mt-0.5">
                        {embeddedPhase.address.slice(0, 10)}…{embeddedPhase.address.slice(-6)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-steel bg-surface border border-gray-100/60 rounded-lg px-3 py-2 mb-4">
                    第二步：完成 SIWE 签名以登录平台。此步骤需要<strong>后端服务在线</strong>（端口 3010）。
                  </p>

                  {embeddedPhase.stage === "siwe_error" && (
                    <p className="mb-3 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
                      {embeddedPhase.msg}
                    </p>
                  )}

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => { setEmbeddedPhase({ stage: "form" }); setError(null); }}
                      className="flex-1 border border-gray-100/60 text-steel text-sm py-2.5 rounded-xl hover:bg-surface transition"
                    >
                      返回
                    </button>
                    <button
                      onClick={handleEmbeddedSignIn}
                      disabled={siweBusy}
                      className="flex-1 bg-primary text-white font-medium text-sm py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition"
                    >
                      {siweBusy ? "签名中…" : "Sign In（SIWE）"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {selected === "walletconnect" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <WalletConnectIcon />
              <h3 className="mt-4 text-[17px] font-semibold text-primary">WalletConnect</h3>
              <p className="mt-2 text-sm text-steel">扫码连接移动端钱包，该功能将在后续版本上线。</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
