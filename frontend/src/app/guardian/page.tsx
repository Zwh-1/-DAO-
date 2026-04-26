'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/auth';
import { PageTransition } from '@/components/ui/index';
import { getGuardianStatusAdmin, ApiError } from '@/lib/api';
import GuardianCircuitPanel from '@/features/workbench/guardian/GuardianCircuitPanel';
import GuardianBlacklistPanel from '@/features/workbench/guardian/GuardianBlacklistPanel';
import GuardianRolesPanel from '@/features/workbench/guardian/GuardianRolesPanel';
import { Button } from "@/components/ui/Button";
/**
 * 系统守护者工作台
 * 
 * 功能：
 * - 熔断器控制（紧急暂停/恢复）
 * - 黑名单管理
 * - 角色分配与查询
 * - 系统状态监控
 */
export default function GuardianPage() {
  const [activeTab, setActiveTab] = useState<'circuit' | 'blacklist' | 'roles'>('circuit');
  const [systemStatus, setSystemStatus] = useState<{ paused: boolean; bannedCount: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  async function fetchStatus() {
    setStatusMsg('');
    try {
      const data = await getGuardianStatusAdmin();
      setSystemStatus(data);
    } catch (err) {
      setStatusMsg(err instanceof ApiError ? err.message : '网络错误');
    }
  }

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-primary text-primary'
        : 'border-transparent text-steel hover:text-primary'
    }`;

  return (
    <RoleGuard required="guardian">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* 页面标题 */}
          <section className="card">
            <h1 className="text-2xl font-bold text-primary">系统守护者工作台</h1>
            <p className="mt-2 section-desc">
              守护者拥有紧急熔断权、黑名单管理权与角色分配权，所有操作需要 Admin Token 鉴权并写入审计日志。
            </p>
          </section>

          {/* 警告横幅 */}
          <div className="error-banner">
            守护者操作不可逆，请谨慎执行。所有操作均记录在链下审计日志。
          </div>

          {/* 系统状态 */}
          <div className="card-compact flex items-center justify-between">
            <div>
              <div className="text-xs text-steel mb-1">当前系统状态</div>
              {systemStatus ? (
                <div className="flex gap-4 text-sm">
                  <span className={systemStatus.paused ? 'text-alert font-semibold' : 'text-success font-semibold'}>
                    {systemStatus.paused ? '已暂停' : '运行中'}
                  </span>
                  <span className="text-steel">黑名单：{systemStatus.bannedCount} 个地址</span>
                </div>
              ) : (
                <span className="text-steel text-sm">点击刷新查看</span>
              )}
              {statusMsg && <p className="text-alert text-xs mt-1">{statusMsg}</p>}
            </div>
            <Button type="button" onClick={fetchStatus} className="text-sm text-primary underline hover:opacity-80">
              刷新状态
            </Button>
          </div>

          {/* 标签页导航 */}
          <div className="flex border-b border-gray-100/60 mb-6">
            <Button type="button" className={tabCls('circuit')} onClick={() => setActiveTab('circuit')}>
              熔断器
            </Button>
            <Button type="button" className={tabCls('blacklist')} onClick={() => setActiveTab('blacklist')}>
              黑名单
            </Button>
            <Button type="button" className={tabCls('roles')} onClick={() => setActiveTab('roles')}>
              角色管理
            </Button>
          </div>

          {/* 标签页内容 */}
          {activeTab === 'circuit' && <GuardianCircuitPanel />}
          {activeTab === 'blacklist' && <GuardianBlacklistPanel />}
          {activeTab === 'roles' && <GuardianRolesPanel />}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
