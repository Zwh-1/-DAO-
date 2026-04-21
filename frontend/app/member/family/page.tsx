'use client';

import React from 'react';
import { RoleGuard } from '@/features/governance';

/**
 * 家庭成员页面
 * 
 * 功能：
 * - 家庭成员管理
 * - 家庭关系绑定
 * - 家庭福利查看
 */
export default function MemberFamilyPage() {
  return (
    <RoleGuard required="member">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="card">
          <h1 className="text-2xl font-bold text-primary mb-2">
            家庭成员
          </h1>
          <p className="text-slate-600">
            管理您的家庭成员关系和共享福利
          </p>
        </section>

        <section className="card">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👨‍‍👧👦</div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">
              暂无家庭成员
            </h3>
            <p className="text-slate-500 mb-6">
              添加家庭成员以共享福利和保障
            </p>
            <button className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors">
              添加家庭成员
            </button>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
