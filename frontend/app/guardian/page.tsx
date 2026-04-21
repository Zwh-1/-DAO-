"use client";

import { useState } from "react";
import { RoleGuard } from "@/features/governance";
import { ROLE_LABEL, type RoleId } from "../../store/authStore";
import { Input, Button, PageTransition } from "@/components/ui/index";
import {
  postGuardianCircuit,
  postGuardianBlacklist,
  postGuardianRoles,
  getGuardianMemberRolesQuery,
  getGuardianStatusAdmin,
  ApiError,
} from "@/lib/api";

const ALL_ROLES: RoleId[] = ["member", "arbitrator", "challenger", "oracle", "guardian", "dao"];

export default function GuardianPage() {
  const [activeTab, setActiveTab] = useState<"circuit" | "blacklist" | "roles">("circuit");

  const [circuitMsg, setCircuitMsg] = useState("");
  const [circuitOk, setCircuitOk] = useState<boolean | null>(null);
  const [action, setAction] = useState<"pause" | "resume">("pause");
  const [reason, setReason] = useState("");

  const [banAddress, setBanAddress] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banMsg, setBanMsg] = useState("");
  const [banOk, setBanOk] = useState<boolean | null>(null);

  const [systemStatus, setSystemStatus] = useState<{ paused: boolean; bannedCount: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const [roleTarget, setRoleTarget] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<RoleId[]>(["member"]);
  const [roleMsg, setRoleMsg] = useState("");
  const [roleOk, setRoleOk] = useState<boolean | null>(null);
  const [queryAddress, setQueryAddress] = useState("");
  const [queryRoles, setQueryRoles] = useState<RoleId[] | null>(null);
  const [queryMsg, setQueryMsg] = useState("");

  async function handleCircuit(e: React.FormEvent) {
    e.preventDefault();
    setCircuitMsg("");
    setCircuitOk(null);
    try {
      const data = await postGuardianCircuit({ action, reason });
      setCircuitOk(true);
      setCircuitMsg(`系统已${action === "pause" ? "暂停" : "恢复"}：${(data as { message?: string }).message ?? ""}`);
    } catch (err) {
      setCircuitOk(false);
      setCircuitMsg(err instanceof ApiError ? err.message : "网络错误");
    }
  }

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    setBanMsg("");
    setBanOk(null);

    if (!/^0x[0-9a-fA-F]{40}$/.test(banAddress)) {
      setBanMsg("请输入合法的以太坊地址");
      setBanOk(false);
      return;
    }

    try {
      await postGuardianBlacklist({ address: banAddress, reason: banReason });
      setBanOk(true);
      setBanMsg(`地址 ${banAddress.slice(0, 8)}... 已加入黑名单`);
      setBanAddress("");
      setBanReason("");
    } catch (err) {
      setBanOk(false);
      setBanMsg(err instanceof ApiError ? err.message : "网络错误");
    }
  }

  async function handleAssignRoles(e: React.FormEvent) {
    e.preventDefault();
    setRoleMsg("");
    setRoleOk(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(roleTarget)) {
      setRoleMsg("请输入合法的以太坊地址");
      setRoleOk(false);
      return;
    }
    if (selectedRoles.length === 0) {
      setRoleMsg("至少需要选择一个角色");
      setRoleOk(false);
      return;
    }
    try {
      await postGuardianRoles({ address: roleTarget, roles: selectedRoles });
      setRoleOk(true);
      setRoleMsg(
        `已为 ${roleTarget.slice(0, 8)}... 分配角色：${selectedRoles.map((r) => ROLE_LABEL[r]).join("、")}`,
      );
    } catch (err) {
      setRoleOk(false);
      setRoleMsg(err instanceof ApiError ? err.message : "网络错误");
    }
  }

  async function handleQueryRoles(e: React.FormEvent) {
    e.preventDefault();
    setQueryMsg("");
    setQueryRoles(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(queryAddress)) {
      setQueryMsg("请输入合法的以太坊地址");
      return;
    }
    try {
      const data = await getGuardianMemberRolesQuery(queryAddress);
      setQueryRoles(data.roles as RoleId[]);
    } catch (err) {
      setQueryMsg(err instanceof ApiError ? err.message : "查询失败");
    }
  }

  function toggleRole(role: RoleId) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function fetchStatus() {
    setStatusMsg("");
    try {
      const data = await getGuardianStatusAdmin();
      setSystemStatus(data);
    } catch (err) {
      setStatusMsg(err instanceof ApiError ? err.message : "网络错误");
    }
  }

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? "border-primary text-primary"
        : "border-transparent text-steel hover:text-primary"
    }`;

  return (
    <RoleGuard required="guardian">
      <PageTransition>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary">系统守护者工作台</h1>
          <p className="mt-2 section-desc">
            守护者拥有紧急熔断权、黑名单管理权与角色分配权，所有操作需要 Admin Token 鉴权并写入审计日志。
          </p>
        </section>

        <div className="error-banner">
          守护者操作不可逆，请谨慎执行。所有操作均记录在链下审计日志。
        </div>

        <div className="card-compact flex items-center justify-between">
          <div>
            <div className="text-xs text-steel mb-1">当前系统状态</div>
            {systemStatus ? (
              <div className="flex gap-4 text-sm">
                <span className={systemStatus.paused ? "text-alert font-semibold" : "text-success font-semibold"}>
                  {systemStatus.paused ? "已暂停" : "运行中"}
                </span>
                <span className="text-steel">黑名单：{systemStatus.bannedCount} 个地址</span>
              </div>
            ) : (
              <span className="text-steel text-sm">点击刷新查看</span>
            )}
            {statusMsg && <p className="text-alert text-xs mt-1">{statusMsg}</p>}
          </div>
          <button type="button" onClick={fetchStatus} className="text-sm text-primary underline hover:opacity-80">
            刷新状态
          </button>
        </div>

        <div className="flex border-b border-gray-100/60 mb-6">
          <button type="button" className={tabCls("circuit")} onClick={() => setActiveTab("circuit")}>
            熔断器
          </button>
          <button type="button" className={tabCls("blacklist")} onClick={() => setActiveTab("blacklist")}>
            黑名单
          </button>
          <button type="button" className={tabCls("roles")} onClick={() => setActiveTab("roles")}>
            角色管理
          </button>
        </div>

        {activeTab === "circuit" && (
          <form onSubmit={handleCircuit} className="card space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">操作类型</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="pause"
                    checked={action === "pause"}
                    onChange={() => setAction("pause")}
                    className="accent-alert"
                  />
                  <span className="text-sm text-alert font-medium">紧急暂停</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value="resume"
                    checked={action === "resume"}
                    onChange={() => setAction("resume")}
                    className="accent-success"
                  />
                  <span className="text-sm text-success font-medium">恢复运行</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">操作原因</label>
              <textarea
                className="w-full rounded-xl border border-gray-100/60 bg-surface/50 px-3 py-2 text-sm text-primary placeholder:text-steel/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                placeholder="请说明紧急暂停或恢复运行的原因（将写入审计日志）"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            {circuitMsg && <p className={`text-sm ${circuitOk ? "text-success" : "text-alert"}`}>{circuitMsg}</p>}
            <Button type="submit" variant={action === "pause" ? "danger" : "success"} size="lg" className="w-full">
              {action === "pause" ? "执行紧急暂停" : "恢复系统运行"}
            </Button>
          </form>
        )}

        {activeTab === "blacklist" && (
          <form onSubmit={handleBan} className="card space-y-4">
            <Input label="目标钱包地址" placeholder="0x..." value={banAddress} onChange={(e) => setBanAddress(e.target.value)} />
            <Input
              label="拉黑原因（必填）"
              placeholder="例如：女巫攻击检测"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
            {banMsg && <p className={`text-sm ${banOk ? "text-success" : "text-alert"}`}>{banMsg}</p>}
            <Button type="submit" variant="danger" size="lg" className="w-full">
              加入黑名单
            </Button>
          </form>
        )}

        {activeTab === "roles" && (
          <div className="space-y-8">
            <div className="card">
              <h2 className="section-title mb-4">分配角色</h2>
              <form onSubmit={handleAssignRoles} className="space-y-4">
                <Input
                  label="目标钱包地址"
                  placeholder="0x..."
                  value={roleTarget}
                  onChange={(e) => setRoleTarget(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">选择角色（可多选）</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role)}
                          onChange={() => toggleRole(role)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-primary">{ROLE_LABEL[role]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {roleMsg && <p className={`text-sm ${roleOk ? "text-success" : "text-alert"}`}>{roleMsg}</p>}
                <Button type="submit" variant="primary" size="lg" className="w-full">
                  分配角色
                </Button>
              </form>
            </div>

            <div className="card">
              <h2 className="section-title mb-4">查询成员角色</h2>
              <form onSubmit={handleQueryRoles} className="flex gap-3 items-end mb-3">
                <div className="flex-1">
                  <Input
                    label="钱包地址"
                    placeholder="0x..."
                    value={queryAddress}
                    onChange={(e) => setQueryAddress(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="primary">
                  查询
                </Button>
              </form>
              {queryMsg && <p className="text-sm text-alert">{queryMsg}</p>}
              {queryRoles && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {queryRoles.length === 0 ? (
                    <span className="text-sm text-steel">无角色</span>
                  ) : (
                    queryRoles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {ROLE_LABEL[r]}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </PageTransition>
    </RoleGuard>
  );
}
