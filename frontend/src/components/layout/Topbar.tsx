"use client";

import { useState, useRef, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore, ROLE_LABEL, ROLE_ORDER, type RoleId } from "@/store/authStore";
import { useSIWE } from "@/hooks/useSIWE";
import { sanitizeRoles } from "@/lib/utils/roleUtils";
import { MobileMenu } from "./MobileMenu";
import { PulseDot, Button } from "@/components/ui/index";
import { walletConnectorAriaLabel, walletConnectorLabel } from "@/lib/wallet/walletLabels";

const ConnectWalletModal = dynamic(
  () => import("@/features/wallet/ConnectWalletModal").then((m) => m.ConnectWalletModal),
  { ssr: false }
);
/**
 * 钱包连接按钮组件
 * 功能：
 * - 显示连接状态
 * - 支持断开连接
 * - 流畅的动画效果
 */
const WalletButton = memo(function WalletButton() {
    const pathname = usePathname();
    const { token, address, walletRuntime, walletConnector, roles, activeRole } = useAuthStore();
    const { signOut, busy, switchActiveRole, activeRoleBusy } = useSIWE();
    const [modalOpen, setModalOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [roleHint, setRoleHint] = useState<string | null>(null);
    const roleDropdownRef = useRef<HTMLDivElement>(null);
    const safeRoles = sanitizeRoles(roles);

    useEffect(() => {
        if (!roleDropdownOpen) return;
        function handleOutside(e: MouseEvent) {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
                setRoleDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [roleDropdownOpen]);

    /**
     * 处理退出
     */
    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut();
        } catch (error) {
            console.error('[Topbar] 退出失败:', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    // 已连接状态
    if (token && address) {
        return (
            <div className="flex items-center gap-3">
                {/* 角色切换器 */}
                <div className="relative" ref={roleDropdownRef}>
                    <button
                        onClick={() => setRoleDropdownOpen((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-all duration-200"
                        aria-label="切换角色"
                    >
                        <span>{activeRole ? ROLE_LABEL[activeRole] : "未选择"}</span>
                        <svg
                            className={`w-3 h-3 text-steel transition-transform duration-200 ${roleDropdownOpen ? "rotate-180" : ""}`}
                            viewBox="0 0 16 16" fill="currentColor" aria-hidden
                        >
                            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z" />
                        </svg>
                    </button>

                    {roleDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-gray-100/60 bg-white shadow-lg z-50">
                            <div className="px-3 py-2 border-b border-gray-100/60">
                                <p className="text-[10px] text-steel">当前身份</p>
                                <p className="text-xs font-semibold text-primary">{activeRole ? ROLE_LABEL[activeRole] : "—"}</p>
                            </div>
                            {roleHint && <p className="px-3 py-1 text-[10px] text-alert">{roleHint}</p>}
                            <div className="p-2 grid grid-cols-2 gap-1">
                                {ROLE_ORDER.map((r) => {
                                    const has = safeRoles.includes(r);
                                    const active = r === activeRole;
                                    return (
                                        <button
                                            key={r}
                                            disabled={!has || activeRoleBusy}
                                            onClick={() => {
                                                if (!has) return;
                                                setRoleHint(null);
                                                void switchActiveRole(r as RoleId)
                                                    .then(() => setRoleDropdownOpen(false))
                                                    .catch((e) => setRoleHint(e instanceof Error ? e.message : "切换失败"));
                                            }}
                                            className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-all duration-150
                                                ${active ? "bg-primary text-white" : ""}
                                                ${has && !active ? "bg-surface text-primary hover:bg-primary/10" : ""}
                                                ${!has ? "text-steel/30 cursor-not-allowed" : ""}
                                            `}
                                        >
                                            {ROLE_LABEL[r]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <Link
                    href="/member/profile#wallet"
                    className={`flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2 shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        pathname === "/member/profile" ? "ring-1 ring-primary/20" : ""
                    }`}
                    role="status"
                    aria-label="进入个人资料（钱包与网络）"
                >
                    <PulseDot color="success" size="sm" ariaLabel="在线状态" />
                    <span className="text-sm font-medium text-success tabular-nums">
                        {address.slice(0, 6)}…{address.slice(-4)}
                    </span>
                    {walletRuntime && (
                        <span
                            className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-steel shadow-sm"
                            aria-label={walletConnectorAriaLabel(walletConnector, walletRuntime)}
                        >
                            {walletConnectorLabel(walletConnector, walletRuntime)}
                        </span>
                    )}
                </Link>
                
                {/* 退出按钮 */}
                <Button
                    onClick={handleSignOut}
                    disabled={busy || isSigningOut}
                    className="text-xs text-steel underline underline-offset-4 hover:text-alert transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-busy={isSigningOut}
                >
                    {isSigningOut ? '退出中...' : '退出'}
                </Button>
            </div>
        );
    }

    // 未连接状态
    return (
        <>
            <Button
                onClick={() => setModalOpen(true)}
                disabled={busy}
                className="group flex items-center gap-2.5 rounded-xl bg-primary text-white text-sm font-semibold px-5 py-2.5 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-all duration-200"
                aria-label="打开钱包连接对话框"
            >
                {/* 钱包图标 - 带悬停动画 */}
                <svg 
                    viewBox="0 0 16 16" 
                    className="w-4.5 h-4.5 group-hover:scale-110 transition-transform duration-200" 
                    fill="currentColor"
                    aria-hidden
                >
                    <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l7.598-3.185A.755.755 0 0 1 16 5.293V4.5A1.5 1.5 0 0 0 14.5 3h-13z" />
                    <path d="M16 6.977l-7.551 3.163a2.25 2.25 0 0 1-1.898 0L0 6.977V11.5A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5V6.977z" />
                </svg>
                <span>连接钱包</span>
                {busy && <span className="ml-2 text-xs opacity-75">(忙碌中)</span>}
            </Button>

            {/* 钱包连接模态框 */}
            <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </>
    );
});

/**
 * 顶部导航栏组件
 * 功能：
 * - 显示用户状态
 * - 提供钱包连接入口
 * - 响应式设计
 */
export function Topbar() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <>
            <header 
                className="h-16 flex-shrink-0 bg-white border-b border-gray-100/60 flex items-center justify-between px-6 md:px-10 z-10 sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm bg-white/90"
                role="banner"
            >
                {/* 左侧移动端菜单按钮 */}
                <div className="flex-1 flex items-center md:hidden">
                    <Button 
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
                        aria-label="打开菜单"
                        aria-expanded={mobileMenuOpen}
                    >
                        <svg className="w-5 h-5 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </Button>
                </div>
                
                {/* 中间区域（预留） */}
                <div className="hidden md:flex flex-1 items-center">
                    {/* 可添加搜索框或通知等 */}
                </div>
                
                {/* 右侧操作区 */}
                <div className="flex items-center gap-4">
                    <WalletButton />
                </div>
            </header>
            
            {/* 移动端菜单 */}
            <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        </>
    );
}

export default Topbar;
