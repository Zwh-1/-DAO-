"use client";

import { useEffect, useRef, useId, useCallback, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useConnectWallet } from "@/hooks/useConnectWallet";
import { Button } from "@/components/ui/Button";
import { MetaMaskIcon, EmbeddedIcon, WalletConnectIcon, LoadingSpinner } from "./Svg";

type WalletType = "metamask" | "embedded" | "walletconnect";

/** 弹窗内统一圆角与表面色（与 tailwind theme 对齐，无蓝紫渐变） */
const pickerCard =
  "rounded-card border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30";
const iconTile = "flex h-12 w-12 shrink-0 items-center justify-center rounded-input bg-surface";
const heroIconWrap = "mb-4 flex h-16 w-16 items-center justify-center rounded-card bg-surface";
const heroIconWrapSm = "mb-4 flex h-14 w-14 items-center justify-center rounded-card bg-surface";
const inputClass =
  "w-full rounded-input border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25";

export interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function modalHeaderTitle(selected: WalletType | null): string {
  if (selected === null) return "选择连接方式";
  if (selected === "metamask") return "MetaMask 签名";
  if (selected === "embedded") return "本地内置钱包";
  return "WalletConnect";
}

/**
 * 连接钱包模态框：Portal + AnimatePresence exit、relative 卡片、滚动锁定、焦点回传、减弱动效。
 */
export function ConnectWalletModal({ isOpen, onClose }: ConnectWalletModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const embeddedPasswordHintId = useId();
  const reduceMotion = useReducedMotion();
  const baseTransition = { duration: reduceMotion ? 0.12 : 0.2, ease: "easeOut" as const };
  const contentTransition = { duration: reduceMotion ? 0.1 : 0.18, ease: "easeOut" as const };

  const {
    selectedWallet,
    embeddedStage,
    embeddedTab,
    password,
    mnemonic,
    showPassword,
    passwordStrength,
    isBusy,
    error,
    selectWallet,
    setPassword,
    setMnemonic,
    togglePasswordVisibility,
    setEmbeddedTab,
    setEmbeddedStage,
    connectMetaMask,
    connectWalletConnect,
    setupEmbeddedWallet,
    completeEmbeddedSignIn,
    confirmMnemonicBackedUp,
    clearError,
    resetFlow,
  } = useConnectWallet();

  const [mnemonicBackupAck, setMnemonicBackupAck] = useState(false);
  const mnemonicBackupKey =
    embeddedStage.stage === "mnemonic_backup" ? embeddedStage.address : null;
  useEffect(() => {
    if (mnemonicBackupKey) setMnemonicBackupAck(false);
  }, [mnemonicBackupKey]);

  const wcProjectConfigured = Boolean(
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()
  );

  const handleClose = useCallback(() => {
    resetFlow();
    onClose();
  }, [onClose, resetFlow]);

  // 滚动锁定 + 打开时焦点到关闭钮 + 关闭后焦点回传
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const raf = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) handleClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="wallet-modal-overlay"
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A2540]/40 backdrop-blur-sm p-4"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={baseTransition}
        >
          <motion.div
            className="relative flex w-full max-w-md max-h-[min(90vh,640px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97, y: reduceMotion ? 0 : 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97, y: reduceMotion ? 0 : 14 }}
            transition={baseTransition}
            onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5">
              {selectedWallet ? (
                <button
                  type="button"
                  onClick={() => selectWallet(null)}
                  className="shrink-0 rounded-lg px-1.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="返回选择连接方式"
                >
                  ← 返回
                </button>
              ) : null}
              <h2 id={titleId} className="min-w-0 flex-1 text-base font-bold leading-snug text-primary">
                {modalHeaderTitle(selectedWallet)}
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="关闭窗口"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3 sm:px-5 sm:pt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedWallet ?? "picker"}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                  transition={contentTransition}
                  className="flex flex-col"
                >
                  {!selectedWallet && (
                    <div className="flex flex-col gap-4">
                      <p className="text-center text-xs text-slate-500">连接后需完成签名验证（SIWE）以登录</p>
                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={() => selectWallet("metamask")}
                          className={`flex w-full items-center gap-3 ${pickerCard}`}
                        >
                          <span className={iconTile}>
                            <MetaMaskIcon />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">MetaMask</span>
                            <span className="block text-xs text-slate-500">浏览器扩展</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectWallet("walletconnect")}
                          className={`flex w-full items-center gap-3 ${pickerCard}`}
                        >
                          <span className={iconTile}>
                            <WalletConnectIcon />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">WalletConnect</span>
                            <span className="block text-xs text-slate-500">移动端扫码</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectWallet("embedded")}
                          className={`flex w-full items-center gap-3 ${pickerCard}`}
                        >
                          <span className={iconTile}>
                            <EmbeddedIcon />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">本地内置钱包</span>
                            <span className="block text-xs text-slate-500">密码加密，私钥不离端</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedWallet === "metamask" && (
                    <div className="flex w-full flex-col items-center">
                      <div className={heroIconWrap}>
                        <MetaMaskIcon />
                      </div>
                      <p className="mb-6 text-center text-sm text-slate-500">
                        请在弹出的插件窗口中确认
                        <br />
                        账户连接及身份签名
                      </p>
                      {error && (
                        <div className="mb-4 w-full rounded-input bg-red-50 p-3 text-center text-xs text-red-600" role="alert">
                          {error}
                        </div>
                      )}
                      <Button
                        onClick={connectMetaMask}
                        disabled={isBusy}
                        size="lg"
                        fullWidth
                        className="rounded-input font-semibold"
                      >
                        {isBusy ? <LoadingSpinner /> : "发起连接请求"}
                      </Button>
                    </div>
                  )}

                  {selectedWallet === "embedded" && (
                    <div className="flex w-full flex-col items-center">
                      <div className={heroIconWrapSm}>
                        <EmbeddedIcon />
                      </div>
                      <p className="mb-5 text-center text-xs text-slate-500">密码加密 · 私钥不离端</p>

                      {embeddedStage.stage === "form" ? (
                        <>
                          <div className="mb-4 flex w-full rounded-input bg-surface p-1">
                            {(["unlock", "create", "import"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setEmbeddedTab(t);
                                  clearError();
                                }}
                                className={`flex-1 rounded-input py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                                  embeddedTab === t
                                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-primary/20"
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                {t === "unlock" ? "解锁" : t === "create" ? "新建" : "导入"}
                              </button>
                            ))}
                          </div>

                          <div className="w-full space-y-3">
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                className={inputClass}
                                placeholder="输入密码"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={togglePasswordVisibility}
                                className="absolute right-3 top-2.5 text-sm text-slate-400 hover:text-slate-600"
                              >
                                {showPassword ? "隐藏" : "显示"}
                              </button>
                            </div>

                            {embeddedTab !== "unlock" && password && (
                              <div className="flex h-0.5 gap-1">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-full transition-colors ${
                                      i <= passwordStrength
                                        ? passwordStrength < 3
                                          ? "bg-red-400"
                                          : passwordStrength < 5
                                            ? "bg-amber-400"
                                            : "bg-green-500"
                                        : "bg-slate-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            )}

                            {embeddedTab === "import" && (
                              <textarea
                                placeholder="输入 12 个助记词单词，用空格分隔"
                                className="h-16 w-full resize-none rounded-input border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
                                value={mnemonic}
                                onChange={(e) => setMnemonic(e.target.value)}
                              />
                            )}
                          </div>

                          {error && (
                            <div className="mt-3 w-full rounded-input bg-red-50 p-2.5 text-center text-xs text-red-600" role="alert">
                              {error}
                            </div>
                          )}

                          {!password && !isBusy && (
                            <p id={embeddedPasswordHintId} className="mt-3 text-center text-xs text-slate-500">
                              请先输入密码
                            </p>
                          )}
                          <Button
                            onClick={setupEmbeddedWallet}
                            disabled={isBusy || !password}
                            aria-describedby={!password && !isBusy ? embeddedPasswordHintId : undefined}
                            size="lg"
                            fullWidth
                            className="mt-4 rounded-input font-semibold"
                          >
                            {isBusy ? (
                              <LoadingSpinner />
                            ) : embeddedTab === "unlock" ? (
                              "进入钱包"
                            ) : embeddedTab === "create" ? (
                              "创建钱包"
                            ) : (
                              "导入钱包"
                            )}
                          </Button>
                        </>
                      ) : embeddedStage.stage === "mnemonic_backup" ? (
                        <>
                          <div
                            className="mb-4 w-full rounded-input border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"
                            role="status"
                          >
                            <strong className="font-semibold">请备份助记词</strong>
                            ：以下 12 个单词是恢复钱包的唯一凭证。请勿截图或发送给他人；平台与客服永远不会索要助记词。
                          </div>
                          <div className="mb-3 w-full rounded-input border border-slate-200 bg-surface p-3">
                            <p className="mb-2 text-center font-mono text-xs leading-relaxed text-slate-800">
                              {embeddedStage.mnemonic}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(embeddedStage.mnemonic);
                              }}
                              className="w-full rounded-input border border-slate-200 bg-white py-2 text-xs font-medium text-primary transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                              复制助记词
                            </button>
                          </div>
                          <label className="mb-4 flex cursor-pointer items-start gap-2 text-left text-xs text-slate-600">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                              checked={mnemonicBackupAck}
                              onChange={(e) => setMnemonicBackupAck(e.target.checked)}
                            />
                            <span>我已将助记词保存在安全的地方，并理解丢失后将无法找回资产。</span>
                          </label>
                          <Button
                            type="button"
                            onClick={confirmMnemonicBackedUp}
                            disabled={!mnemonicBackupAck}
                            size="lg"
                            fullWidth
                            className="rounded-input font-semibold"
                          >
                            已备份，前往身份签名
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="mb-4 w-full rounded-input border border-green-100 bg-green-50 p-3">
                            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-green-700">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                              账户已就绪
                            </div>
                            <code className="block break-all rounded bg-white/60 p-1.5 text-center text-[10px] text-green-800">
                              {(embeddedStage as { address?: string }).address}
                            </code>
                          </div>

                          <div className="mb-4 w-full rounded-input bg-slate-50 p-3">
                            <p className="text-center text-xs leading-relaxed text-slate-600">
                              <strong>最后一步：</strong>需要进行身份签名以完成平台授权
                            </p>
                            {embeddedStage.stage === "siwe_error" && (
                              <p className="mt-2 text-center text-xs font-medium text-red-600">
                                {(embeddedStage as { msg?: string }).msg}
                              </p>
                            )}
                          </div>

                          <div className="flex w-full gap-2">
                            <button
                              type="button"
                              onClick={() => setEmbeddedStage({ stage: "form" })}
                              className="flex-1 rounded-input py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                              上一步
                            </button>
                            <Button
                              onClick={completeEmbeddedSignIn}
                              disabled={isBusy}
                              variant="success"
                              size="lg"
                              className="flex-[2] rounded-input font-semibold"
                            >
                              {isBusy ? <LoadingSpinner /> : "完成签名"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {selectedWallet === "walletconnect" && (
                    <div className="flex w-full flex-col items-center py-1">
                      <div className={heroIconWrap}>
                        <WalletConnectIcon />
                      </div>
                      <p className="mb-4 text-center text-sm text-slate-500">将弹出二维码，请使用移动钱包扫码连接</p>
                      {!wcProjectConfigured && (
                        <div
                          className="mb-4 w-full rounded-input border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800"
                          role="status"
                        >
                          未配置 <code className="font-mono">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>
                          ，无法连接。请在 WalletConnect Cloud 创建项目并写入环境变量。
                        </div>
                      )}
                      {error && (
                        <div className="mb-4 w-full rounded-input bg-red-50 p-3 text-center text-xs text-red-600" role="alert">
                          {error}
                        </div>
                      )}
                      <Button
                        onClick={() => void connectWalletConnect()}
                        disabled={isBusy || !wcProjectConfigured}
                        size="lg"
                        fullWidth
                        className="rounded-input font-semibold"
                      >
                        {isBusy ? <LoadingSpinner /> : "扫码连接并签名登录"}
                      </Button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
