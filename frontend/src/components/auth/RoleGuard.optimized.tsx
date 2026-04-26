/**
 * 权限守卫组件（优化版）
 * 
 * 优化点：
 * - 使用 AuthContext 替代直接使用 useAuthStore
 * - 改进 Empty State 设计（更友好的权限不足提示）
 * - 支持钱包未连接检测
 * - 提供清晰的操作指引
 * 
 * 视觉规范：
 * - 无蓝紫渐变，使用医疗蓝、安全绿、警示红
 * - 高对比度、清晰易读
 */

"use client";

import { type ReactNode, memo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useHasRole } from "../../components/contexts/AuthContext";
import { ROLE_LABEL, type RoleId } from "../../store/authStore";
import { Button } from "@/components/ui/Button";

// ==================== 类型定义 ====================

interface RoleGuardProps {
  /** 必需的角色（支持单个或多个） */
  required: RoleId | RoleId[];
  /** 多角色模式：'any' 满足任一即可，'all' 需全部满足 */
  mode?: "any" | "all";
  /** 未认证或权限不足时是否重定向到指定路径 */
  redirectTo?: string;
  /** 自定义权限不足时显示的组件 */
  fallback?: ReactNode;
  /** 加载中时显示的组件 */
  loadingFallback?: ReactNode;
  /** 未连接钱包时显示的组件 */
  walletRequired?: boolean;
  children: ReactNode;
}

// ==================== 默认组件 ====================

/** 默认加载中占位符 */
const DEFAULT_LOADING_FALLBACK = (
  <div className="flex items-center justify-center py-12">
    <div className="text-sm text-gray-500">加载中...</div>
  </div>
);

/**
 * Empty State：权限不足提示
 * 
 * 视觉设计：
 * - 橙色背景（警示但不刺眼）
 * - 清晰的图标与文案
 * - 提供操作指引
 */
const NoPermissionBanner = ({ missingRoles }: { missingRoles: RoleId[] }) => {
  const roleLabels = missingRoles.map(role => ROLE_LABEL[role] ?? role).join("、");
  
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-md rounded-2xl border border-orange-200 bg-orange-50 p-8 text-center shadow-sm"
    >
      {/* 图标 */}
      <div className="mb-4 text-4xl">⚠️</div>
      
      {/* 标题 */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        权限不足
      </h2>
      
      {/* 描述 */}
      <p className="mb-6 text-sm text-gray-600 leading-relaxed">
        您当前缺少【
        <span className="font-semibold text-orange-700">{roleLabels}</span>
        】角色权限
      </p>
      
      {/* 操作指引 */}
      <div className="text-xs text-gray-500 bg-white rounded-lg p-3">
        <p className="mb-2 font-medium">解决方案：</p>
        <ol className="text-left list-decimal list-inside space-y-1">
          <li>联系管理员分配角色</li>
          <li>或使用其他有权限的钱包登录</li>
        </ol>
      </div>
    </div>
  );
};

/**
 * Empty State：钱包未连接
 * 
 * 视觉设计：
 * - 蓝色背景（中性提示）
 * - 提供连接钱包按钮
 */
const WalletRequiredBanner = () => {
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-md rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center shadow-sm"
    >
      {/* 图标 */}
      <div className="mb-4 text-4xl">👛</div>
      
      {/* 标题 */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        需要连接钱包
      </h2>
      
      {/* 描述 */}
      <p className="mb-6 text-sm text-gray-600 leading-relaxed">
        此操作需要先连接您的加密钱包
      </p>
      
      {/* 连接按钮 */}
      <Button variant="primary" size="md">
        连接钱包
      </Button>
      
      {/* 安全提示 */}
      <p className="mt-4 text-xs text-gray-500">
        🔒 我们不会存储您的私钥或助记词
      </p>
    </div>
  );
};

/**
 * Empty State：未登录
 * 
 * 视觉设计：
 * - 灰色背景（中性提示）
 * - 提供登录引导
 */
const UnauthenticatedBanner = ({ requiredFor }: { requiredFor: string }) => {
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-md rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center shadow-sm"
    >
      {/* 图标 */}
      <div className="mb-4 text-4xl">🔐</div>
      
      {/* 标题 */}
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        需要登录
      </h2>
      
      {/* 描述 */}
      <p className="mb-6 text-sm text-gray-600 leading-relaxed">
        进行【{requiredFor}】需要先登录账户
      </p>
      
      {/* 操作按钮 */}
      <div className="flex flex-col gap-3">
        <Button variant="primary" size="md">
          登录账户
        </Button>
        <Button variant="secondary" size="md">
          注册新账户
        </Button>
      </div>
    </div>
  );
};

// ==================== 主组件 ====================

export const RoleGuard = memo(function RoleGuard({
  required,
  mode = "any",
  redirectTo,
  fallback,
  loadingFallback = DEFAULT_LOADING_FALLBACK,
  walletRequired = false,
  children,
}: RoleGuardProps) {
  const router = useRouter();
  
  // 使用 AuthContext（替代 useAuthStore）
  const auth = useAuth();
  const hasRole = useHasRole(required);
  
  const { token, isAuthenticated, address, isLoading } = auth;
  
  // 处理重定向副作用
  useEffect(() => {
    if (!redirectTo) return;
    
    const isUnauthenticated = !token;
    const hasPermission = Array.isArray(required)
      ? (mode === "any"
          ? required.some(r => auth.hasRole(r))
          : required.every(r => auth.hasRole(r)))
      : auth.hasRole(required);
    
    if (isUnauthenticated || !hasPermission) {
      router.push(redirectTo);
    }
  }, [token, required, mode, redirectTo, router, auth]);
  
  // 加载中状态
  if (isLoading) {
    return loadingFallback;
  }
  
  // 未连接钱包（且要求钱包）
  if (walletRequired && !address) {
    if (redirectTo) return null;
    return fallback ?? <WalletRequiredBanner />;
  }
  
  // 未登录
  if (!token) {
    if (redirectTo) return null;
    
    const requiredList = Array.isArray(required) ? required : [required];
    const firstRoleLabel = ROLE_LABEL[requiredList[0]] ?? "所需权限";
    return fallback ?? <UnauthenticatedBanner requiredFor={`${firstRoleLabel}操作`} />;
  }
  
  // 权限检查
  const requiredRoles = Array.isArray(required) ? required : [required];
  const hasPermission =
    mode === "any"
      ? requiredRoles.some(r => auth.hasRole(r))
      : requiredRoles.every(r => auth.hasRole(r));
  
  if (!hasPermission) {
    if (redirectTo) return null;
    
    const missingRoles = requiredRoles.filter(r => !auth.hasRole(r));
    return fallback ?? <NoPermissionBanner missingRoles={missingRoles} />;
  }
  
  return <>{children}</>;
});

export default RoleGuard;
