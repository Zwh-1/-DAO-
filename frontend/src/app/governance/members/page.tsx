'use client';

import React from 'react';
import { RoleGuard } from '@/components/auth';

export default function GovernanceMembersPage() {
  return (
    <RoleGuard required="dao">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary mb-2">
            成员管理
          </h1>
          <p className="text-slate-600">
            管理 DAO 成员和角色权限
          </p>
        </section>

        <section className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              暂无成员数据
            </h3>
            <p className="text-slate-500">
              成员列表将在这里显示
            </p>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
