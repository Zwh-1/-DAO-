/**
 * 全局响应式导航栏（Dashboard Shell）
 * 
 * 职责：
 * - 提供企业级全局导航系统
 * - 支持侧边栏（Sidebar）+ 顶部导航（Topbar）复合结构
 * - 支持多角色工作簿无缝切换（Member, DAO, Arbitrator 等）
 * - 提供清晰的层级结构与当前位置指示
 * 
 * 视觉规范：
 * - 主色调：医疗蓝 (#0066CC) + 洁净白 (#FFFFFF)
 * - 辅助色：安全绿、警示红
 * - 无蓝紫渐变，符合医疗专业风格
 * 
 * 响应式设计：
 * - 桌面端：固定侧边栏 + 顶部导航
 * - 移动端：可折叠汉堡菜单
 */

"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useHasRole } from "../../components/contexts/AuthContext";
import { ROLE_LABEL, type RoleId } from "../../store/authStore";
import { useSIWE } from "../../hooks/useSIWE";
import { pickDefaultActiveRole, sanitizeRoles } from "../../lib/roleUtils";
import { Button } from "@/components/ui/Button";

/**
 * 导航项接口
 */
interface NavItem {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  label: string;
  /** 跳转路径 */
  href: string;
  /** 所需角色权限（可选，多个角色为 OR 关系） */
  requiredRole?: RoleId | RoleId[];
  /** 图标（可选） */
  icon?: ReactNode;
  /** 子菜单项（可选） */
  children?: NavItem[];
}

/**
 * 角色工作簿配置
 * 
 * 定义每个角色的导航结构与可用功能
 */
const ROLE_WORKBOOKS: Record<RoleId, NavItem[]> = {
  // 成员工作簿
  member: [
    { id: "member-home", label: "成员首页", href: "/member" },
    { id: "member-profile", label: "个人档案", href: "/member/profile" },
    { id: "member-benefits", label: "权益查询", href: "/member/benefits" },
    { id: "member-family", label: "家庭账户", href: "/member/family" },
  ],
  
  // 仲裁员工作簿
  arbitrator: [
    { id: "arbitrator-home", label: "仲裁首页", href: "/arbitrator" },
    { id: "arbitrator-cases", label: "案件列表", href: "/arbitrator/cases" },
    { id: "arbitrator-vote", label: "投票表决", href: "/arbitrator/vote" },
  ],
  
  // 挑战者工作簿
  challenger: [
    { id: "challenger-home", label: "挑战首页", href: "/challenger" },
    { id: "challenger-challenges", label: "我的挑战", href: "/challenger/challenges" },
    { id: "challenger-rewards", label: "奖励查询", href: "/challenger/rewards" },
  ],
  
  // 预言机工作簿
  oracle: [
    { id: "oracle-home", label: "预言机首页", href: "/oracle" },
    { id: "oracle-reports", label: "报告管理", href: "/oracle/reports" },
    { id: "oracle-channels", label: "通道监控", href: "/oracle/channels" },
  ],
  
  // 守护者工作簿
  guardian: [
    { id: "guardian-home", label: "守护者首页", href: "/guardian" },
    { id: "guardian-circuit", label: "熔断器", href: "/guardian/circuit" },
    { id: "guardian-blacklist", label: "黑名单", href: "/guardian/blacklist" },
  ],
  
  // DAO 治理工作簿
  dao: [
    { id: "dao-home", label: "DAO 治理", href: "/dao" },
    { id: "dao-proposals", label: "提案列表", href: "/dao/proposals" },
    { id: "dao-members", label: "成员管理", href: "/dao/members" },
    { id: "dao-treasury", label: "财库管理", href: "/dao/treasury" },
  ],
};

/**
 * 全局导航项（所有角色通用）
 */
const GLOBAL_NAV_ITEMS: NavItem[] = [
  { id: "home", label: "首页", href: "/" },
  { id: "claim", label: "理赔申请", href: "/claim" },
  { id: "airdrop", label: "空投奖励", href: "/airdrop" },
  { id: "explorer", label: "区块浏览器", href: "/explorer" },
];

/**
 * 侧边栏组件
 * 
 * 显示当前角色的导航菜单
 * 支持角色切换与钱包连接状态展示
 */
export function Sidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const { switchActiveRole, activeRoleBusy } = useSIWE();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [roleHint, setRoleHint] = useState<string | null>(null);

  const safeRoles = sanitizeRoles(auth.roles);
  const activeRole =
    auth.activeRole && safeRoles.includes(auth.activeRole)
      ? auth.activeRole
      : pickDefaultActiveRole(safeRoles, null);
  const roleNavItems = ROLE_WORKBOOKS[activeRole as RoleId] || [];
  
  /**
   * 检查导航项是否可见
   * 
   * @param item 导航项
   * @returns 是否可见
   */
  function isNavItemVisible(item: NavItem): boolean {
    if (!item.requiredRole) return true;
    return auth.hasRole(item.requiredRole);
  }
  
  /**
   * 检查导航项是否激活
   * 
   * @param href 导航路径
   * @returns 是否激活
   */
  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  
  return (
    <aside
      className={`
        fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-16" : "w-64"}
      `}
    >
      {/* Logo 区域 */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800" />
            <span className="text-lg font-bold text-gray-900">TrustAID</span>
          </Link>
        )}
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {isCollapsed ? "→" : "←"}
        </Button>
      </div>
      
      {/* 角色切换器 */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="text-xs font-medium text-gray-500 mb-2">
            当前角色
          </div>
          {roleHint && <p className="text-[11px] text-red-600 mb-1">{roleHint}</p>}
          <select
            aria-label="选择当前角色"
            title="选择当前角色"
            disabled={activeRoleBusy || safeRoles.length === 0}
            value={activeRole}
            onChange={(e) => {
              const v = e.target.value as RoleId;
              setRoleHint(null);
              void switchActiveRole(v).catch((err) =>
                setRoleHint(err instanceof Error ? err.message : "切换失败")
              );
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          >
            {safeRoles.length > 0 ? (
              safeRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))
            ) : (
              <option value="member">访客模式</option>
            )}
          </select>
          <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
            仅可选择已授权角色；切换将同步服务端会话。敏感操作仍以接口权限为准。
          </p>
        </div>
      )}
      
      {/* 导航菜单 */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {/* 全局导航项 */}
        <div className="space-y-1 mb-6">
          {!isCollapsed && (
            <div className="text-xs font-medium text-gray-500 mb-2">
              全局功能
            </div>
          )}
          {GLOBAL_NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${isActive(item.href)
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-100"
                }
              `}
            >
              <span className="w-5 h-5 flex items-center justify-center">
                {item.icon || "📄"}
              </span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
        
        {/* 角色专属导航项 */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="text-xs font-medium text-gray-500 mb-2">
              {ROLE_LABEL[activeRole as RoleId] || "工作台"}
            </div>
          )}
          {roleNavItems
            .filter(isNavItemVisible)
            .map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${isActive(item.href)
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  {item.icon || "📁"}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
        </div>
      </nav>
      
      {/* 底部钱包状态 */}
      <div className="p-4 border-t border-gray-200">
        <WalletStatus collapsed={isCollapsed} />
      </div>
    </aside>
  );
}

/**
 * 顶部导航栏组件
 * 
 * 显示面包屑、页面标题、全局操作按钮
 */
export function Topbar() {
  const pathname = usePathname();
  const auth = useAuth();
  
  /**
   * 生成面包屑导航
   */
  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, arr) => {
      const path = "/" + arr.slice(0, index + 1).join("/");
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      return { path, label };
    });
  
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-full px-6">
        {/* 左侧：面包屑导航 */}
        <nav className="flex items-center gap-2 text-sm text-gray-600">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-2">
              {index > 0 && <span className="text-gray-400">/</span>}
              <Link
                href={crumb.path}
                className={`
                  hover:text-blue-600 transition-colors
                  ${index === breadcrumbs.length - 1
                    ? "font-medium text-gray-900"
                    : ""
                  }
                `}
              >
                {crumb.label}
              </Link>
            </div>
          ))}
        </nav>
        
        {/* 右侧：全局操作 */}
        <div className="flex items-center gap-4">
          {/* 通知按钮（未来扩展） */}
          <Button
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="通知"
          >
            🔔
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </Button>
          
          {/* 用户菜单 */}
          <div className="flex items-center gap-3">
            {auth.address ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-blue-800" />
                <span className="text-sm font-medium text-gray-700">
                  {auth.address.slice(0, 6)}...{auth.address.slice(-4)}
                </span>
              </div>
            ) : (
              <Button variant="primary">连接钱包</Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * 钱包状态组件（侧边栏底部）
 */
function WalletStatus({ collapsed }: { collapsed?: boolean }) {
  const auth = useAuth();
  
  if (!auth.address) {
    return (
      <div className="text-center">
        {!collapsed && (
          <p className="text-sm text-gray-500 mb-2">未连接钱包</p>
        )}
        <Button size={collapsed ? "sm" : "md"} variant="primary">
          连接
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800" />
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {auth.address.slice(0, 6)}...{auth.address.slice(-4)}
          </p>
          <p className="text-xs text-gray-500">
            {auth.roles.length} 个角色
          </p>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  
  // 避免服务端渲染与客户端渲染不匹配
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50" />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 主内容区域（侧边栏右侧） */}
      <div className="ml-64">
        {/* 顶部导航栏 */}
        <Topbar />
        
        {/* 页面内容 */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;
