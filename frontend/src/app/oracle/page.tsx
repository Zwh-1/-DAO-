'use client';

import { useState } from 'react';
import { RoleGuard } from '@/components/auth';
import { PageTransition } from '@/components/ui/index';
import OracleSubmitForm from '@/features/oracle/OracleSubmitForm';
import OracleSignForm from '@/features/oracle/OracleSignForm';
import OracleQueryForm from '@/features/oracle/OracleQueryForm';

/**
 * 预言机工作台
 * 
 * 功能：
 * - 提交报告（多签预言机提交链下证据报告）
 * - 追加签名（达到法定签名数后自动终结）
 * - 查询报告状态
 */
export default function OraclePage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'sign' | 'query'>('submit');

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-primary text-primary'
        : 'border-transparent text-steel hover:text-primary'
    }`;

  return (
    <RoleGuard required="oracle">
      <PageTransition>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* 页面头部 */}
          <section className="card">
            <h1 className="text-2xl font-bold text-primary">预言机工作台</h1>
            <p className="mt-2 section-desc">
              多签预言机提交链下证据报告；达到法定签名数后自动终结并通知申领审核。
            </p>
          </section>

          {/* 极速通道说明 */}
          <div className="card-compact">
            <span className="font-semibold text-primary">极速通道：</span>
            <span className="text-sm text-steel">
              当单份报告获得 ≥ 5 个预言机签名时，系统绕过 DAO 等待期直接批准该申领。
              普通通道门槛为 3 个签名。
            </span>
          </div>

          {/* 标签页导航 */}
          <div className="flex border-b border-gray-100/60 mb-6">
            <button className={tabCls('submit')} onClick={() => setActiveTab('submit')}>提交报告</button>
            <button className={tabCls('sign')} onClick={() => setActiveTab('sign')}>追加签名</button>
            <button className={tabCls('query')} onClick={() => setActiveTab('query')}>查询状态</button>
          </div>

          {/* 标签页内容 */}
          {activeTab === 'submit' && <OracleSubmitForm />}
          {activeTab === 'sign' && <OracleSignForm />}
          {activeTab === 'query' && <OracleQueryForm />}
        </div>
      </PageTransition>
    </RoleGuard>
  );
}
