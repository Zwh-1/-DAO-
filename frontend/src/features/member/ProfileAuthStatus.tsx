'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface ProfileAuthStatusProps {
  error: string;
  onRetry: () => void;
  isLoading: boolean;
  hasProfile: boolean;
  sbtCount: number;
}

/**
 * 个人资料认证状态区域
 * 
 * 展示：
 * - 错误状态与重试按钮
 * - 空数据状态
 * - 身份认证状态（基础/高级）
 * - SBT 代币展示
 */
export default function ProfileAuthStatus({
  error,
  onRetry,
  isLoading,
  hasProfile,
  sbtCount,
}: ProfileAuthStatusProps) {
  return (
    <>
      {/* 错误状态 */}
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-[#D93025]">
          {error}
          <Button onClick={onRetry} variant="primary" size="sm" className="ml-3">
            重试
          </Button>
        </div>
      )}

      {/* 空数据状态 */}
      {!isLoading && !error && !hasProfile && (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-10 text-center">
          <p className="text-sm text-slate-500">暂无个人资料数据</p>
          <Button onClick={onRetry} variant="primary" className="mt-4">
            刷新
          </Button>
        </div>
      )}

      {/* 凭证与活动 */}
      <section className="profile-soft-card">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-primary">
          <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          凭证与活动
        </h2>

        <div className="space-y-6">
          {/* SBT */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary">SBT 代币</h3>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8">
              {sbtCount === 0 && (
                <div className="text-center">
                  <svg className="mx-auto mb-2 h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-sm text-slate-400">暂无 SBT 代币</p>
                </div>
              )}
            </div>
          </div>

          {/* 身份认证状态 */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-primary">身份认证</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 px-4 py-3">
                <span className="text-sm text-slate-800">基础身份认证</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2D8A39]">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  已认证
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-800">高级身份认证</span>
                <span className="text-xs font-medium text-slate-400">未认证</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
