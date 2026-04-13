"use client";

import { useState } from "react";
import { useSIWE } from "../../hooks/useSIWE";
import { ConnectWalletModal } from "../../app/components/ConnectWalletModal";

interface Props {
  /** 需要登录才能执行的操作名，显示在提示文字中 */
  requiredFor?: string;
}

/**
 * 可复用的 SIWE 登录状态横幅。
 * 已登录：显示地址 + 退出按钮（绿色）。
 * 未登录：显示"连接钱包"按钮，点击后弹出 ConnectWalletModal 让用户选择钱包类型。
 */
export function SessionBanner({ requiredFor = "写操作" }: Props) {
  const { signOut, busy, token, address } = useSIWE();
  const [modalOpen, setModalOpen] = useState(false);

  if (token && address) {
    return (
      <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-4 py-2 mb-5 text-sm">
        <div className="text-success font-medium">
          已连接：
          <span className="font-mono ml-1">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>
        <button
          onClick={signOut}
          className="text-steel text-xs underline hover:text-alert transition"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="border border-primary/30 bg-primary/5 rounded-lg px-4 py-3 mb-5">
        <p className="text-sm text-primary mb-2">
          执行<span className="font-semibold"> {requiredFor} </span>需先连接钱包并完成签名验证（SIWE）。
        </p>
        <button
          onClick={() => setModalOpen(true)}
          disabled={busy}
          className="bg-primary text-white text-sm px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? "连接中…" : "连接钱包 / Sign-In"}
        </button>
      </div>

      <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
