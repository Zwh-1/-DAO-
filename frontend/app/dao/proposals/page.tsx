'use client';

import React from 'react';
import { RoleGuard } from '@/features/governance';

/**
 * DAO 提案页面
 * 
 * 功能：
 * - 提案列表展示
 * - 提案创建
 * - 提案投票
 */
export default function DAOProposalsPage() {
  return (
    <RoleGuard required="dao">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary mb-2">
                提案管理
              </h1>
              <p className="text-slate-600">
                创建、查看和投票治理提案
              </p>
            </div>
            <button className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors">
              + 创建提案
            </button>
          </div>
        </section>

        <section className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              暂无提案
            </h3>
            <p className="text-slate-500">
              创建第一个治理提案
            </p>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
