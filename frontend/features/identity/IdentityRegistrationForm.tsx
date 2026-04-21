'use client';

import React, { useState, useMemo } from 'react';
import { useIdentityRegistration } from '../../hooks/useIdentityRegistration';
import { useWallet } from '../../hooks/useWallet';
// 修正 viem 导入：使用 stringToBytes 代替 toUtf8Bytes
import { keccak256, stringToBytes } from 'viem';

export interface IdentityRegistrationFormProps {
  onSuccess?: (result: { commitment: string; merkleRoot: string; level: number }) => void;
  onClose?: () => void;
}

type Step = 'input' | 'processing' | 'success' | 'error';

export function IdentityRegistrationForm({ onSuccess, onClose }: IdentityRegistrationFormProps) {
  // 1. 变量利用：确保 address 和 isRegistered 在逻辑中被引用
  const { address, isConnected } = useWallet();
  const { register, isRegistering, isRegistered, error, reset } = useIdentityRegistration();
  
  const [socialId, setSocialId] = useState('');
  const [level, setLevel] = useState(3);
  const [step, setStep] = useState<Step>('input');

  // 2. 逻辑优化：使用 useMemo 监听注册状态，自动切换步骤
  React.useEffect(() => {
    if (isRegistered && step === 'processing') {
      setStep('success');
    }
  }, [isRegistered, step]);

  /**
   * 计算社交 ID 哈希：修正 viem 方法调用
   */
  const calculateSocialIdHash = (id: string): string => {
    // viem 规范：使用 stringToBytes
    return keccak256(stringToBytes(id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialId.trim() || level < 1 || level > 5 || !isConnected) return;

    setStep('processing');

    try {
      const socialIdHash = calculateSocialIdHash(socialId.trim());
      const result = await register(socialIdHash, level);
      
      if (result) {
        // 使用 address 进行日志记录或加密关联，确保 address 变量被使用
        console.log(`[Identity] Registering for wallet: ${address}`);
        
        localStorage.setItem('identity_secret', JSON.stringify(Array.from(result.secret)));
        
        onSuccess?.({
          commitment: `0x${result.commitment.toString(16)}`,
          merkleRoot: result.merkleRoot,
          level: result.level,
        });
      } else {
        setStep('error');
      }
    } catch (err) {
      console.error('[IdentityRegistration] Error:', err);
      setStep('error');
    }
  };

  const handleClose = () => {
    reset();
    setStep('input');
    setSocialId('');
    setLevel(3);
    onClose?.();
  };

  // 3. 视觉优化：医疗级专业色值 (Slate + Blue-700)
  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-slate-200">
      {/* 头部：深蓝色背景，高对比度 */}
      <div className="bg-slate-900 px-6 py-5 border-b border-slate-700">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
          数字身份注册
        </h3>
      </div>

      <div className="px-8 py-8">
        {step === 'input' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="socialId" className="block text-sm font-bold text-slate-700">
                认证社交 ID (电子邮箱)
              </label>
              <input
                type="email"
                id="socialId"
                value={socialId}
                onChange={(e) => setSocialId(e.target.value)}
                placeholder="name@institution.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                disabled={isRegistering}
                required
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                🛡️ 隐私声明：标识符在本地完成 Keccak-256 哈希处理，原始数据不会离开您的终端。
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="level" className="block text-sm font-bold text-slate-700">
                承诺权重等级
              </label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600 outline-none"
                disabled={isRegistering}
              >
                {[1, 2, 3, 4, 5].map(v => (
                  <option key={v} value={v}>等级 {v} - {v === 3 ? '推荐配置' : v === 5 ? '最高权限' : '基础准入'}</option>
                ))}
              </select>
            </div>

            {!isConnected && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-amber-800 text-sm font-medium">
                检测到钱包未连接，请先激活您的数字钱包。
              </div>
            )}

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={!isConnected || isRegistering}
                className="w-full py-4 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/10"
              >
                {isRegistering ? '正在进行零知识安全计算...' : '启动安全注册'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 text-slate-500 font-semibold hover:text-slate-800 transition-colors"
              >
                取消返回
              </button>
            </div>
          </form>
        )}

        {step === 'processing' && (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-800 font-bold text-lg text-center">正在加密并提交凭证...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-6 space-y-6">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl border border-emerald-100">
              ✓
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-slate-900">注册已成功</h4>
              <p className="text-slate-500 text-sm">您的身份已安全匿名化并持久化至分布式账本。</p>
            </div>
            <button
              onClick={handleClose}
              className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition-all"
            >
              进入管理控制台
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6 space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-4xl border border-red-100">
              !
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-slate-900">注册过程被中断</h4>
              <p className="text-red-600 text-sm font-medium">{error || '网络通信异常，请检查网关。'}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep('input')}
                className="flex-1 py-3 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800"
              >
                重试
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold"
              >
                放弃
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IdentityRegistrationForm;