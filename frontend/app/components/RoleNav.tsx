"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthStore, ROLE_LABEL, type RoleId } from "../../store/authStore";
import { useSIWE } from "../../hooks/useSIWE";
import { ConnectWalletModal } from "./ConnectWalletModal";
import { navItems, type NavItem } from "../../components/layout/NavItems";

const ROLE_ORDER: RoleId[] = ["member", "challenger", "dao", "arbitrator", "oracle", "guardian"];

function WalletButton() {
  const { token, address, walletRuntime, roles, activeRole, setActiveRole } = useAuthStore();
  const { signOut, busy } = useSIWE();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (token && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 hover:bg-success/20 transition"
        >
          <span className="w-2 h-2 rounded-full bg-success inline-block flex-shrink-0" />
          <span className="text-xs font-medium text-success">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          {walletRuntime && (
            <span className="text-[10px] text-steel bg-surface rounded-full px-1.5 py-0.5 ml-1">
              {walletRuntime === "injected" ? "MetaMask" : "内置"}
            </span>
          )}
          <svg
            className={`w-3 h-3 text-steel transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-gray-100/60 bg-white shadow-lg z-50">
            <div className="px-4 py-3 border-b border-gray-100/60">
              <p className="text-[11px] text-steel mb-0.5">当前角色</p>
              <p className="text-xs font-semibold text-primary">
                {activeRole ? ROLE_LABEL[activeRole] : "—"}
              </p>
            </div>

            <div className="px-4 py-3 border-b border-gray-100/60">
              <p className="text-[11px] text-steel mb-2">切换角色</p>
              <div className="grid grid-cols-2 gap-1.5">
                {ROLE_ORDER.map((r) => {
                  const hasRole = roles.includes(r);
                  const isActive = r === activeRole;
                  return (
                    <button
                      key={r}
                      disabled={!hasRole}
                      onClick={() => {
                        if (hasRole) {
                          setActiveRole(r);
                          setDropdownOpen(false);
                        }
                      }}
                      className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition
                        ${isActive ? "bg-primary text-white" : ""}
                        ${hasRole && !isActive ? "bg-surface text-primary hover:bg-primary/10 cursor-pointer" : ""}
                        ${!hasRole ? "text-steel/40 cursor-not-allowed bg-surface" : ""}
                      `}
                    >
                      {!hasRole && (
                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                        </svg>
                      )}
                      {isActive && !hasRole === false && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                      )}
                      {ROLE_LABEL[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 px-4 py-3">
              <button
                onClick={copyAddress}
                className="flex-1 rounded-md border border-gray-100/60 py-1.5 text-xs text-steel hover:border-primary hover:text-primary transition"
              >
                {copied ? "已复制 ✓" : "复制地址"}
              </button>
              <button
                onClick={() => { signOut(); setDropdownOpen(false); }}
                className="flex-1 rounded-md border border-red-200 py-1.5 text-xs text-alert hover:bg-red-50 transition"
              >
                断开连接
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-primary text-white text-xs font-medium px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition"
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5v.793c.026.009.051.02.076.032L7.674 8.51c.206.1.446.1.652 0l7.598-3.185A.755.755 0 0 1 16 5.293V4.5A1.5 1.5 0 0 0 14.5 3h-13z" />
          <path d="M16 6.977l-7.551 3.163a2.25 2.25 0 0 1-1.898 0L0 6.977V11.5A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5V6.977z" />
        </svg>
        连接钱包
      </button>

      <ConnectWalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export function RoleNav() {
  return (
    <nav className="rounded-xl border border-gray-100/60 bg-white px-4 py-3 flex items-center justify-between gap-4">
      <ul className="flex flex-wrap gap-2 text-sm flex-1">
        {navItems.map((item, idx) => {
          const navItem = item as NavItem;
          return (
            <li key={navItem.href ?? `group-${idx}`}>
              {navItem.href ? (
                <Link
                  href={navItem.href}
                  className="rounded-md border border-gray-100/60 px-3 py-1.5 text-primary text-xs hover:border-primary hover:bg-primary/5 transition"
                >
                  {navItem.label}
                </Link>
              ) : navItem.children ? (
                <span className="rounded-md px-3 py-1.5 text-steel text-xs font-medium">
                  {navItem.label}
                </span>
              ) : null}
              {navItem.children && (
                <ul className="flex flex-wrap gap-1 ml-1 mt-1">
                  {navItem.children.filter((c): c is NavItem & { href: string } => !!c.href).map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className="rounded-md border border-gray-100/60 px-2.5 py-1 text-primary text-xs hover:border-primary hover:bg-primary/5 transition"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex-shrink-0">
        <WalletButton />
      </div>
    </nav>
  );
}
