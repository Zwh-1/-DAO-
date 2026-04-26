'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface FamilyPageHeaderProps {
  isContractReady: boolean;
  memberCount: number;
  onAddClick: () => void;
}

/**
 * 家庭成员页面头部
 * 
 * 职责：
 * - 展示页面标题和描述
 * - 链上状态标签
 * - 添加成员按钮（仅当已有成员时显示）
 */
export default function FamilyPageHeader({
  isContractReady,
  memberCount,
  onAddClick,
}: FamilyPageHeaderProps) {
  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-2">家庭成员</h1>
          <p className="text-slate-600">管理您的家庭成员关系和共享福利</p>
        </div>
        <div className="flex items-center gap-3">
          {isContractReady && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              链上已启用
            </span>
          )}
          {memberCount > 0 && (
            <Button
              onClick={onAddClick}
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors text-sm"
            >
              + 添加成员
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
