/**
 * 成员页面（优化版）
 * 
 * 使用技术栈：
 * - React Hook Form：表单状态管理
 * - Zod：类型验证
 * - useQueries：数据获取
 * - Toast：全局提示
 * 
 * 优化点：
 * - 替换 useState 为 useForm
 * - 自动表单验证
 * - 加载状态与按钮禁用
 * - 结构化数据展示（替代 <pre> 标签）
 */

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemberProfile } from "@/hooks/useQueries";
import { useToast } from "@/components/ui/Toast";
import { memberProfileSchema, type MemberProfileFormData } from "@/lib/schemas";
import { RoleGuard } from "@/components/auth";
import { useSIWE } from "@/hooks/useSIWE";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * 成员画像数据展示组件（结构化 UI）
 * 
 * 替代 <pre> 标签直接展示 JSON
 * 使用卡片、表格等形式清晰展示数据
 */
function MemberProfileCard({ data }: { data: any }) {
  if (!data) return null;
  
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">成员画像信息</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 地址信息 */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500">钱包地址</div>
          <div className="text-sm font-mono text-gray-900">
            {data.address?.slice(0, 10)}...{data.address?.slice(-8)}
          </div>
        </div>
        
        {/* SBT 信息 */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500">SBT 等级</div>
          <div className="text-sm font-semibold text-blue-600">
            {data.sbtLevel || "未铸造"}
          </div>
        </div>
        
        {/* 声誉积分 */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500">声誉积分</div>
          <div className="text-sm font-semibold text-green-600">
            {data.reputationScore || 0}
          </div>
        </div>
        
        {/* 注册时间 */}
        <div className="space-y-1">
          <div className="text-xs text-gray-500">注册时间</div>
          <div className="text-sm text-gray-700">
            {data.registeredAt ? new Date(data.registeredAt).toLocaleString("zh-CN") : "—"}
          </div>
        </div>
      </div>
      
      {/* 详细数据（可折叠） */}
      {data.metadata && (
        <details className="mt-4">
          <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600">
            查看详细元数据
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-auto max-h-64">
            {JSON.stringify(data.metadata, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function MemberPageOptimized() {
  const { address: siweAddress } = useSIWE();
  const toast = useToast();
  
  // 表单 Hook（React Hook Form）
  const form = useForm<MemberProfileFormData>({
    resolver: zodResolver(memberProfileSchema),
    defaultValues: {
      address: "",
    },
  });
  
  const { register, handleSubmit, formState, reset, watch } = form;
  const { errors } = formState;
  const formAddress = watch("address");
  
  // 数据获取 Hook（React Query）
  const { profile, isLoading, refetch } = useMemberProfile(
    formAddress || siweAddress || null,
    { enabled: false } // 不自动获取，手动触发
  );
  
  /**
   * 查询画像处理函数
   * 
   * 流程：
   * 1. 表单验证
   * 2. 显示加载提示
   * 3. 调用 API
   * 4. 显示结果或错误
   */
  const handleGetProfile = async (data: MemberProfileFormData) => {
    const addr = data.address || siweAddress;
    
    if (!addr) {
      toast.error("请先连接钱包或输入地址");
      return;
    }
    
    try {
      // 显示加载提示
      const loadingId = toast.loading("正在查询成员画像...");
      
      // 触发查询
      await refetch();
      
      // 关闭加载提示
      toast.dismiss(loadingId);
      
      if (profile) {
        toast.success("查询成功");
      } else {
        toast.warning("未找到成员画像");
      }
    } catch (error) {
      toast.error(`查询失败：${(error as Error).message}`);
    }
  };
  
  return (
    <RoleGuard required="member">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* 页面标题 */}
        <section className="card">
          <h1 className="text-xl font-bold text-primary">普通成员工作台</h1>
          <p className="mt-2 section-desc">
            支持成员画像查询和多钱包绑定（钱包绑定需登录）。
          </p>
        </section>
        
        {/* 成员画像查询 */}
        <section className="card">
          <h2 className="mb-3 section-title">成员画像查询</h2>
          
          <form onSubmit={handleSubmit(handleGetProfile)} className="space-y-4">
            {/* 地址输入框 */}
            <Input
              label="钱包地址"
              placeholder="0x…（留空则查询当前已连接钱包）"
              value={formAddress}
              onChange={(e) => {
                register("address").onChange(e);
                reset({ address: e.target.value });
              }}
              error={errors.address?.message}
              disabled={isLoading}
            />
            
            {/* 查询按钮（带加载状态） */}
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !!Object.keys(errors).length}
              isLoading={isLoading}
            >
              {isLoading ? "查询中..." : "查询画像"}
            </Button>
          </form>
          
          {/* 查询结果展示 */}
          {isLoading && (
            <div className="mt-4">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          
          {profile && !isLoading && (
            <div className="mt-4">
              <MemberProfileCard data={profile} />
            </div>
          )}
        </section>
      </div>
    </RoleGuard>
  );
}
