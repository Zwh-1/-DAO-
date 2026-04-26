'use client';

import React, { useState } from 'react';
import { ROLE_LABEL, type RoleId } from '@/store/authStore';
import { Input, Button } from '@/components/ui/index';
import { postGuardianRoles, getGuardianMemberRolesQuery, ApiError } from '@/lib/api';

const ALL_ROLES: RoleId[] = ['member', 'arbitrator', 'challenger', 'oracle', 'guardian', 'dao'];

/**
 * 守护者角色管理面板
 * 
 * 功能：
 * - 为成员分配角色
 * - 查询成员现有角色
 */
export default function GuardianRolesPanel() {
  const [target, setTarget] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<RoleId[]>(['member']);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

  const [queryAddress, setQueryAddress] = useState('');
  const [queryRoles, setQueryRoles] = useState<RoleId[] | null>(null);
  const [queryMsg, setQueryMsg] = useState('');

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setOk(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(target)) {
      setMsg('请输入合法的以太坊地址');
      setOk(false);
      return;
    }
    if (selectedRoles.length === 0) {
      setMsg('至少需要选择一个角色');
      setOk(false);
      return;
    }
    try {
      await postGuardianRoles({ address: target, roles: selectedRoles });
      setOk(true);
      setMsg(
        `已为 ${target.slice(0, 8)}... 分配角色：${selectedRoles.map((r) => ROLE_LABEL[r]).join('、')}`,
      );
    } catch (err) {
      setOk(false);
      setMsg(err instanceof ApiError ? err.message : '网络错误');
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setQueryMsg('');
    setQueryRoles(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(queryAddress)) {
      setQueryMsg('请输入合法的以太坊地址');
      return;
    }
    try {
      const data = await getGuardianMemberRolesQuery(queryAddress);
      setQueryRoles(data.roles as RoleId[]);
    } catch (err) {
      setQueryMsg(err instanceof ApiError ? err.message : '查询失败');
    }
  }

  function toggleRole(role: RoleId) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  return (
    <div className="space-y-8">
      {/* 分配角色 */}
      <div className="card">
        <h2 className="section-title mb-4">分配角色</h2>
        <form onSubmit={handleAssign} className="space-y-4">
          <Input
            label="目标钱包地址"
            placeholder="0x..."
            value={target}
            onChange={(e) => setTarget(e.target.value)}
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
          {msg && <p className={`text-sm ${ok ? 'text-success' : 'text-alert'}`}>{msg}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            分配角色
          </Button>
        </form>
      </div>

      {/* 查询成员角色 */}
      <div className="card">
        <h2 className="section-title mb-4">查询成员角色</h2>
        <form onSubmit={handleQuery} className="flex gap-3 items-end mb-3">
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
  );
}
