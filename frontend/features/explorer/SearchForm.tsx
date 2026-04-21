/**
 * 搜索表单组件
 * 
 * 支持搜索类型：
 * - 交易哈希（0x 开头 66 位十六进制）
 * - 钱包地址（0x 开头 42 位十六进制）
 * - 区块高度（纯数字）
 * 
 * 验证规则：
 * - 输入格式校验
 * - 长度校验
 * - 字符集校验（仅允许十六进制）
 * 
 * 隐私保护：
 * - 搜索记录不存储
 * - 日志脱敏（不记录完整地址）
 */

'use client';

import React, { useState, FormEvent } from 'react';
import { useExplorerStore } from '../../store/explorer-store';

/**
 * 输入类型枚举
 */
type InputType = 'unknown' | 'transaction' | 'address' | 'block';

/**
 * 搜索表单组件
 */
export default function SearchForm() {
  const [query, setQuery] = useState('');
  const [inputType, setInputType] = useState<InputType>('unknown');
  const [error, setError] = useState<string | null>(null);
  
  // Explorer Store
  const { search, isLoading, clearSearch } = useExplorerStore();
  
  /**
   * 验证输入类型
   */
  const validateInputType = (value: string): InputType => {
    // 去除前后空格
    const trimmed = value.trim();
    
    // 空字符串
    if (!trimmed) {
      return 'unknown';
    }
    
    // 交易哈希：0x 开头 + 64 位十六进制（共 66 字符）
    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
      return 'transaction';
    }
    
    // 钱包地址：0x 开头 + 40 位十六进制（共 42 字符）
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return 'address';
    }
    
    // 区块高度：纯数字（支持 1-10 位）
    if (/^[0-9]{1,10}$/.test(trimmed)) {
      return 'block';
    }
    
    // 未知类型
    return 'unknown';
  };
  
  /**
   * 输入变化处理
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // 实时验证类型
    const type = validateInputType(value);
    setInputType(type);
    
    // 清除错误
    if (error) {
      setError(null);
    }
    
    // 如果输入为空，清除搜索结果
    if (!value.trim()) {
      clearSearch();
    }
  };
  
  /**
   * 提交处理
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // 验证输入
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('请输入搜索内容');
      return;
    }
    
    if (inputType === 'unknown') {
      setError('请输入有效的交易哈希、钱包地址或区块高度');
      return;
    }
    
    // 执行搜索
    try {
      await search(trimmedQuery);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    }
  };
  
  /**
   * 获取输入提示文本
   */
  const getPlaceholderText = () => {
    return '输入交易哈希、钱包地址或区块高度...';
  };
  
  /**
   * 获取类型提示
   */
  const getTypeHint = () => {
    switch (inputType) {
      case 'transaction':
        return '✅ 交易哈希';
      case 'address':
        return '✅ 钱包地址';
      case 'block':
        return '✅ 区块高度';
      case 'unknown':
        return query ? '❌ 格式不正确' : '';
      default:
        return '';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <form onSubmit={handleSubmit}>
        {/* 输入框和按钮 */}
        <div className="flex gap-2">
          {/* 搜索输入框 */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={getPlaceholderText()}
              className={`
                w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2
                ${error
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-gray-300 focus:ring-blue-200'
                }
              `}
              disabled={isLoading}
            />
            
            {/* 类型提示 */}
            {getTypeHint() && (
              <p className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                {getTypeHint()}
              </p>
            )}
          </div>
          
          {/* 搜索按钮 */}
          <button
            type="submit"
            disabled={isLoading || inputType === 'unknown'}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${isLoading || inputType === 'unknown'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isLoading ? '搜索中...' : '搜索'}
          </button>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <p className="mt-2 text-sm text-red-600">
            ⚠️ {error}
          </p>
        )}
        
        {/* 帮助文本 */}
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <div>
            <span className="font-medium">交易哈希：</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">0x...</code> (66 字符)
          </div>
          <div>
            <span className="font-medium">钱包地址：</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">0x...</code> (42 字符)
          </div>
          <div>
            <span className="font-medium">区块高度：</span>
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">12345678</code> (数字)
          </div>
        </div>
      </form>
    </div>
  );
}
