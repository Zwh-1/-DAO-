'use client';

import React from 'react';

interface ProfilePageHeaderProps {
  isConnected: boolean;
}

/**
 * 个人资料页面头部
 * 
 * 展示：
 * - 页面标题
 * - 描述文字
 * - 未连接钱包警告横幅
 */
export default function ProfilePageHeader({ isConnected }: ProfilePageHeaderProps) {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
          个人资料
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          管理身份信息、钱包会话与链上网络设置
        </p>
      </header>

      {/* 未连接钱包警告 */}
      {!isConnected && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <svg className="h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>请先连接钱包以加载成员画像；也可在下方「钱包与网络」完成连接与签名（SIWE）。</span>
        </div>
      )}
    </>
  );
}
