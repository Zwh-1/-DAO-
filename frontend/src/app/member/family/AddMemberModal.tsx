'use client';

import React, { useState } from 'react';
import { RELATIONSHIP_LABELS, type RelationshipLabel } from '@/lib/contracts/familyMemberSBT';
import { Button } from '@/components/ui/Button';
import { FormErrors, RELATION_EMOJI, EMPTY_FORM, AddMemberModalProps } from '@/types/member';
/**
 * 添加家庭成员弹窗表单
 * 
 * 职责：
 * - 表单验证（地址格式、必填项）
 * - 证件号隐私保护提示
 * - 提交状态反馈
 */
export default function AddMemberModal({
  isOpen,
  onClose,
  onAdd,
  isContractReady,
  isSubmitting,
  error,
}: AddMemberModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  if (!isOpen) return null;

  function validate(): boolean {
    const e: FormErrors = {};
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.address.trim()))
      e.address = '请输入有效的钱包地址（0x + 40位十六进制）';
    if (!form.name.trim())
      e.name = '请输入成员姓名';
    if (isContractReady && !form.idNumber.trim())
      e.idNumber = '证件号用于生成链上身份标识，不可为空';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onAdd(form);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <h2 className="text-lg font-bold text-primary">添加家庭成员</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">成员钱包地址</label>
          <input
            type="text"
            placeholder="0x..."
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">成员姓名</label>
          <input
            type="text"
            placeholder="请输入姓名"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        {isContractReady && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              证件号
              <span className="ml-1 text-xs text-slate-400 font-normal">
                （仅用于生成链上哈希，不存储明文）
              </span>
            </label>
            <input
              type="password"
              placeholder="身份证号 / 护照号"
              autoComplete="off"
              value={form.idNumber}
              onChange={e => setForm(f => ({ ...f, idNumber: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {errors.idNumber && <p className="text-xs text-red-500">{errors.idNumber}</p>}
            <p className="text-xs text-slate-400">
              证件号经 keccak256 哈希后上链，原文永不离开本设备
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">关系</label>
          <select
            title="选择家庭成员关系"
            value={form.relation}
            onChange={e => setForm(f => ({ ...f, relation: e.target.value as RelationshipLabel }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            {RELATIONSHIP_LABELS.map(r => (
              <option key={r} value={r}>{RELATION_EMOJI[r]} {r}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
            发送失败：{error instanceof Error ? error.message : '请重试'}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                上链中...
              </>
            ) : isContractReady ? '发送邀请（钱包签名）' : '确认添加'}
          </Button>
        </div>
      </div>
    </div>
  );
}
