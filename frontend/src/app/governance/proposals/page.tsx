'use client';

import React from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/auth';

export default function GovernanceProposalsPage() {
  return (
    <RoleGuard required="dao">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary mb-2">
                提案大厅
              </h1>
              <p className="text-slate-600">
                查看和投票治理提案
              </p>
            </div>
            <Link
              href="/governance/create"
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors text-sm"
            >
              + 发起提案
            </Link>
          </div>
        </section>

        <section className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              暂无提案
            </h3>
            <p className="text-slate-500 mb-4">
              创建第一个治理提案
            </p>
            <Link
              href="/governance/create"
              className="inline-block px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors text-sm"
            >
              发起提案
            </Link>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
