"use client";

/**
 * 路由级 UI 守卫（体验层，非安全边界）
 *
 * - 仅根据 Zustand 中的 JWT `roles` 隐藏或展示子页面，**不能替代**后端 `requireAuth` / `requireRole`。
 * - 攻击者可直接调用 REST；所有敏感操作必须在 [`backend/src/routes/`](../../../backend/src/routes) 中校验。
 * - 管理员敏感操作另见 `requireAdmin`（`ADMIN_TOKEN`），勿存于可被 XSS 读取的长期明文（参见 `docs/安全/权限模型.md`）。
 */

import { type ReactNode, memo, useEffect } from "react";
import { useRouter } from "next/navigation"; // Next.js App Router 专用；若使用 Pages Router 则改为 'next/router'
import { useAuthStore, ROLE_LABEL, type RoleId } from "../../store/authStore";
import { SessionBanner } from "./SessionBanner";

// ==================== 类型定义 ====================

interface RoleGuardProps {
  /** 必需的角色（支持单个或多个） */
  required: RoleId | RoleId[];
  /** 多角色模式：'any' 满足任一即可，'all' 需全部满足 */
  mode?: "any" | "all";
  /** 未认证或权限不足时是否重定向到指定路径（如 '/login' 或 '/403'） */
  redirectTo?: string;
  /** 自定义权限不足时显示的组件（覆盖默认的 NoPermissionBanner） */
  fallback?: ReactNode;
  /** 加载中时显示的组件 */
  loadingFallback?: ReactNode;
  children: ReactNode;
}

// ==================== 默认组件 ====================

/** 默认加载中占位符（提取为常量，避免每次渲染重新创建） */
const DEFAULT_LOADING_FALLBACK = <div>加载中...</div>;

/** 权限不足提示组件（支持显示多个缺失角色） */
const NoPermissionBanner = ({ missingRoles }: { missingRoles: RoleId[] }) => {
  const roleLabels = missingRoles.map(role => ROLE_LABEL[role] ?? role).join("、");
  return (
    <div
      role="alert"
      className="mx-auto mt-10 max-w-md rounded-xl border border-orange-200 bg-orange-50 p-6 text-center"
    >
      <div className="mb-3 text-3xl">⚠️</div>
      <h2 className="mb-2 text-base font-semibold text-primary">权限不足</h2>
      <p className="text-sm text-steel">
        您当前缺少【{roleLabels}】角色权限，请联系管理员分配。
      </p>
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
  children,
}: RoleGuardProps) {
  const router = useRouter(); // Next.js 路由实例，用于执行重定向
  const token = useAuthStore(state => state.token);
  const roles = useAuthStore(state => state.roles);
  const isLoading = useAuthStore(state => state.isLoading); // 需确保 store 有此字段

  // 处理重定向副作用（必须在渲染阶段之后执行）
  useEffect(() => {
    if (!redirectTo) return;

    // 未登录或权限不足时执行重定向
    const isUnauthenticated = !token;
    const requiredRoles = Array.isArray(required) ? required : [required];
    const hasPermission = (() => {
      if (!roles) return false;
      if (mode === "any") {
        return requiredRoles.some(r => roles.includes(r));
      } else {
        return requiredRoles.every(r => roles.includes(r));
      }
    })();

    if (isUnauthenticated || !hasPermission) {
      router.push(redirectTo);
    }
  }, [token, roles, required, mode, redirectTo, router]);

  // 加载中状态
  if (isLoading) {
    return loadingFallback;
  }

  // 未登录：展示 SessionBanner 或重定向（重定向已在 useEffect 中处理，这里直接返回空）
  if (!token) {
    // 如果设置了重定向，不渲染任何内容（避免闪现）
    if (redirectTo) return null;

    // 生成友好的提示文案
    const requiredList = Array.isArray(required) ? required : [required];
    const firstRoleLabel = ROLE_LABEL[requiredList[0]] ?? "所需权限";
    return <SessionBanner requiredFor={`${firstRoleLabel}操作`} />;
  }

  // 权限检查（roles 存在且非空）
  const requiredRoles = Array.isArray(required) ? required : [required];
  const hasPermission =
    mode === "any"
      ? requiredRoles.some(r => roles?.includes(r))
      : requiredRoles.every(r => roles?.includes(r));

  if (!hasPermission) {
    // 如果设置了重定向，不渲染内容（由 useEffect 处理跳转）
    if (redirectTo) return null;

    // 计算缺失的角色列表，用于展示详细提示
    const missingRoles = requiredRoles.filter(r => !roles?.includes(r));
    return fallback ?? <NoPermissionBanner missingRoles={missingRoles} />;
  }

  return <>{children}</>;
});