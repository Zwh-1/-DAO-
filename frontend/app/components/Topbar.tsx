"use client";

import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useSIWE } from "../../hooks/useSIWE";
import { ConnectWalletModal } from "./ConnectWalletModal";

function WalletButton() {
    const { token, address, walletRuntime } = useAuthStore();
    const { signOut, busy } = useSIWE();
    const [modalOpen, setModalOpen] = useState(false);

    if (token && address) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-1.5 shadow-sm">
                    <span className="w-2.5 h-2.5 rounded-full bg-success relative">
                        <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-30"></span>
                    </span>
                    <span className="text-sm font-medium text-success">
                        {address.slice(0, 6)}…{address.slice(-4)}
                    </span>
                    {walletRuntime && (
                        <span className="text-[10px] text-steel bg-white border border-gray-200 rounded-full px-2 py-0.5 ml-1 shadow-sm font-medium">
                            {walletRuntime === "injected" ? "MetaMask" : "内置"}
                        </span>
                    )}
                </div>
                <button
                    onClick={signOut}
                    className="text-xs text-steel underline underline-offset-4 hover:text-alert transition"
                >
                    退出
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setModalOpen(true)}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-primary text-white text-sm font-medium px-5 py-2.5 hover:opacity-90 disabled:opacity-50 shadow-sm active:scale-95 transition-all duration-200"
            >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                    <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l7.598-3.185A.755.755 0 0 1 16 5.293V4.5A1.5 1.5 0 0 0 14.5 3h-13z" />
                    <path d="M16 6.977l-7.551 3.163a2.25 2.25 0 0 1-1.898 0L0 6.977V11.5A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5V6.977z" />
                </svg>
                连接钱包
            </button>

            <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
}

export function Topbar() {
    return (
        <header className="h-16 flex-shrink-0 bg-white border-b border-gray-100/60 flex items-center justify-between px-6 md:px-10 z-10 sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex-1 flex items-center">
                {/* Mobile menu trigger could potentially go here */}
            </div>
            <div className="flex items-center gap-4">
                <WalletButton />
            </div>
        </header>
    );
}
