"use client";

import { useState } from "react";
import { useAuthStore, ROLE_ORDER, ROLE_LABEL, type RoleId } from "@/store/authStore";
import { useAuth } from "@/components/contexts/AuthContext";

// ── 预设账户：地址唯一，角色完全自由配置 ──────────────────────────
const DEV_ADDRESSES = [
  { label: "账户 A", address: "0xDEV000000000000000000000000000000000000A" },
  { label: "账户 B", address: "0xDEV000000000000000000000000000000000000B" },
  { label: "账户 C", address: "0xDEV000000000000000000000000000000000000C" },
  { label: "账户 D", address: "0xDEV000000000000000000000000000000000000D" },
  { label: "账户 E", address: "0xDEV000000000000000000000000000000000000E" },
  { label: "账户 F", address: "0xDEV000000000000000000000000000000000000F" },
  { label: "账户 G", address: "0xDEV000000000000000000000000000000000000G" },
  { label: "账户 H", address: "0xDEV000000000000000000000000000000000000H" },
] as const;

function makeFakeJWT(address: string): string {
  const header  = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const exp     = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const payload = btoa(
    JSON.stringify({ address, sub: address, exp, iat: Math.floor(Date.now() / 1000) })
  );
  return `${header}.${payload}.dev`;
}

export function DevPanel() {
  const [open, setOpen]           = useState(false);
  const [addrIdx, setAddrIdx]     = useState(0);
  const [customAddr, setCustomAddr] = useState("");
  const [pendingRoles, setPendingRoles] = useState<RoleId[]>(["member"]);
  const [pendingActive, setPendingActive] = useState<RoleId>("member");

  const { setToken } = useAuth();
  const store = useAuthStore();

  // 已注入的实时状态（直接读 store）
  const liveToken  = useAuthStore(s => s.token);
  const liveRoles  = useAuthStore(s => s.roles);
  const liveActive = useAuthStore(s => s.activeRole);
  const liveAddr   = useAuthStore(s => s.address);
  const isInjected = !!liveToken;

  const currentAddress = customAddr.trim() || DEV_ADDRESSES[addrIdx].address;

  // 注入完整 session
  const inject = (addr: string, roles: RoleId[], activeRole: RoleId) => {
    setToken(makeFakeJWT(addr));
    store.setRoles(roles);
    store.setActiveRole(activeRole);
    store.setAddress(addr.toLowerCase());
    store.setWalletSessionState("unlocked");
  };

  // 仅切换 activeRole，无需重新注入
  const switchRole = (role: RoleId) => {
    store.setActiveRole(role);
  };

  const reset = () => {
    setToken(null);
    store.clearSession();
  };

  const togglePendingRole = (role: RoleId) => {
    const next = pendingRoles.includes(role)
      ? pendingRoles.filter(r => r !== role)
      : [...pendingRoles, role];
    setPendingRoles(next);
    if (!next.includes(pendingActive) && next.length > 0) {
      setPendingActive(next[0]);
    }
  };

  const addrLabel =
    liveAddr
      ? (DEV_ADDRESSES.find(a => a.address.toLowerCase() === liveAddr)?.label ?? "自定义")
      : null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-mono text-xs select-none">

      {/* ── 悬浮角色切换条（注入后始终可见，关闭面板也能用） ── */}
      {isInjected && liveRoles.length > 0 && (
        <div className="flex gap-1 mb-1 justify-end flex-wrap max-w-xs">
          {liveRoles.map(role => (
            <button
              key={role}
              onClick={() => switchRole(role)}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                liveActive === role
                  ? "bg-yellow-400 text-black border-yellow-500 font-bold"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-yellow-50"
              }`}
            >
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      )}

      {/* ── 主按钮 ── */}
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(v => !v)}
          className="bg-yellow-400 text-black font-bold px-3 py-1 rounded shadow-lg flex items-center gap-1"
        >
          🛠 DEV
          {addrLabel && (
            <span className="bg-black text-yellow-300 px-1 rounded">{addrLabel}</span>
          )}
        </button>
      </div>

      {/* ── 配置面板 ── */}
      {open && (
        <div className="absolute bottom-10 right-0 bg-white border border-yellow-400 rounded-lg shadow-xl p-4 w-64 space-y-3">

          {/* ① 账户选择 */}
          <div>
            <p className="font-bold text-gray-700 mb-1">① 账户（地址）</p>
            <div className="grid grid-cols-4 gap-1 mb-1">
              {DEV_ADDRESSES.map((a, i) => (
                <button
                  key={a.address}
                  onClick={() => { setAddrIdx(i); setCustomAddr(""); }}
                  className={`rounded border py-0.5 text-center transition-colors ${
                    addrIdx === i && !customAddr
                      ? "bg-yellow-400 border-yellow-500 font-bold"
                      : "border-gray-200 hover:bg-yellow-50"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <input
              className="w-full border rounded px-1 py-0.5 text-xs font-mono"
              value={customAddr}
              onChange={e => setCustomAddr(e.target.value)}
              placeholder="自定义地址 0x..."
            />
          </div>

          <hr className="border-gray-200" />

          {/* ② 角色配置 */}
          <div>
            <p className="font-bold text-gray-700 mb-1">② 拥有角色（可多选）</p>
            <div className="grid grid-cols-2 gap-1">
              {ROLE_ORDER.map(role => (
                <label key={role} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingRoles.includes(role)}
                    onChange={() => togglePendingRole(role)}
                  />
                  {ROLE_LABEL[role]}
                </label>
              ))}
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* ③ 激活身份 */}
          <div>
            <p className="font-bold text-gray-700 mb-1">③ 激活身份（activeRole）</p>
            {pendingRoles.length === 0 ? (
              <p className="text-gray-400">请先勾选角色</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {pendingRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => setPendingActive(role)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      pendingActive === role
                        ? "bg-yellow-400 border-yellow-500 font-bold"
                        : "border-gray-200 hover:bg-yellow-50"
                    }`}
                  >
                    {ROLE_LABEL[role]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          <div className="flex gap-2">
            <button
              onClick={() => inject(currentAddress, pendingRoles, pendingActive)}
              disabled={pendingRoles.length === 0}
              className="flex-1 bg-green-500 disabled:opacity-40 text-white rounded px-2 py-1 hover:bg-green-600 transition-colors"
            >
              注入登录态
            </button>
            <button
              onClick={reset}
              className="flex-1 bg-red-400 text-white rounded px-2 py-1 hover:bg-red-500 transition-colors"
            >
              清除
            </button>
          </div>

          {/* 当前注入状态预览 */}
          {isInjected && (
            <div className="bg-gray-50 rounded p-2 text-gray-500 space-y-0.5 border border-gray-100">
              <p>📍 {liveAddr?.slice(0, 10)}...{liveAddr?.slice(-4)}</p>
              <p>🎭 {liveRoles.map(r => ROLE_LABEL[r]).join(" · ")}</p>
              <p>✅ 当前：{liveActive ? ROLE_LABEL[liveActive] : "—"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
