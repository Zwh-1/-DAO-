'use client';

import React from 'react';
import { RoleGuard } from '@/components/auth';

/**
 * 我的福利页面
 * 
 * 功能：
 * - 查看可用福利
 * - 福利兑换记录
 * - 福利券管理
 */
export default function MemberBenefitsPage() {
  return (
    <RoleGuard required="member">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary mb-2">
            我的福利
          </h1>
          <p className="text-slate-600">
            查看和管理您的专属福利和权益
          </p>
        </section>

        <section className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              暂无可用福利
            </h3>
            <p className="text-slate-500 mb-6">
              积极参与活动获取更多福利
            </p>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
