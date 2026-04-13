/**
 * 共享导航配置
 * 集中管理全站导航项，避免多处重复定义
 *
 * 医疗级导航设计原则：
 * - 清晰的层级结构（门户 → 核心功能 → 管理功能）
 * - 角色权限分离（成员/仲裁/守护者等）
 * - 高对比度文字（text-primary + hover:text-primary）
 */

// ==================== 类型定义 ====================

/**
 * 用户角色枚举
 * 集中定义所有可能的角色，避免魔法字符串
 */
export enum UserRole {
  MEMBER = 'member',
  ARBITRATOR = 'arbitrator',
  CHALLENGER = 'challenger',
  ORACLE = 'oracle',
  GUARDIAN = 'guardian',
  DAO_ADMIN = 'dao_admin',
}

/**
 * 导航项配置（支持嵌套子菜单）
 */
export interface NavItem {
  /** 路由路径（如果有 children 且无 href，则作为分组标题） */
  href?: string;
  /** 显示文本 */
  label: string;
  /** 可选：仅当用户拥有该角色时才显示 */
  requiredRole?: UserRole;
  /** 可选：显示角标（如"新"、"Beta"） */
  badge?: string;
  /** 可选：是否在新标签页打开 */
  external?: boolean;
  /** 可选：子菜单项（支持无限嵌套） */
  children?: NavItem[];
}

// ==================== 常量定义 ====================

/**
 * 主导航项列表（按功能模块排序，支持嵌套）
 * 使用 `as const` 断言，获得最精确的字面量类型推断
 */
export const navItems = [
  { href: '/', label: '门户' },
  { href: '/claim', label: '理赔申请' },
  {
    label: '成员中心',
    children: [
      { href: '/member/profile', label: '个人资料' },
      { href: '/member/family', label: '家庭成员' },
      { href: '/member/benefits', label: '我的福利' },
    ],
  },
  {
    href: '/arbitrator',
    label: '仲裁工作台',
    requiredRole: UserRole.ARBITRATOR,
  },
  { href: '/challenger', label: '挑战者', requiredRole: UserRole.CHALLENGER },
  { href: '/oracle', label: '预言机', requiredRole: UserRole.ORACLE },
  { href: '/guardian', label: '守护者', requiredRole: UserRole.GUARDIAN },
  {
    label: 'DAO 治理',
    requiredRole: UserRole.DAO_ADMIN,
    children: [
      { href: '/dao/proposals', label: '提案' },
      { href: '/dao/members', label: '成员管理' },
    ],
  },
] as const satisfies readonly NavItem[];

/**
 * 顶部导航专用导航项（精简版，只显示最常用的入口）
 */
export const topNavItems: NavItem[] = [
  { href: '/', label: '门户' },
  { href: '/claim', label: '理赔申请' },
  { href: '/member', label: '成员中心' },
  { href: '/dao', label: 'DAO 治理' },
];

// ==================== 辅助函数 ====================

/**
 * 检查用户是否拥有指定角色
 * @param userRoles - 当前用户的角色列表
 * @param requiredRole - 需要的角色
 * @returns 是否拥有该角色
 */
export function hasRole(userRoles: UserRole[], requiredRole: UserRole): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * 递归过滤导航项，根据用户角色筛选并保持层级结构
 * @param items - 导航项数组
 * @param userRoles - 当前用户角色列表
 * @returns 过滤后的导航项（如果某分组下无可见子项，则整个分组隐藏）
 */
export function filterNavItemsByRole(
  items: readonly NavItem[],
  userRoles?: UserRole[]
): NavItem[] {
  if (!userRoles || userRoles.length === 0) {
    // 未登录或未提供角色：只保留没有角色限制且无子项或子项过滤后非空的项
    return items
      .map(item => {
        if (item.children) {
          const filteredChildren = filterNavItemsByRole(item.children, userRoles);
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        return item.requiredRole ? null : item;
      })
      .filter((item): item is NavItem => item !== null);
  }

  return items
    .map((item): NavItem | null => {
      const isVisible = !item.requiredRole || userRoles.includes(item.requiredRole);
      
      // 处理子菜单
      let filteredChildren: NavItem[] | undefined;
      if (item.children) {
        filteredChildren = filterNavItemsByRole(item.children, userRoles);
        // 如果有子菜单但过滤后为空，且当前项本身无 href（分组标题），则隐藏整个分组
        if (filteredChildren.length === 0 && !item.href) {
          return null;
        }
      }
      
      // 如果当前项不可见且没有子菜单，跳过
      if (!isVisible && !filteredChildren) return null;
      
      // 构建返回的项
      return {
        ...item,
        children: filteredChildren,
      };
    })
    .filter((item): item is NavItem => item !== null);
}

/**
 * 根据用户角色过滤导航项（用于侧边栏或动态菜单）
 * @param userRoles - 当前用户的角色列表（可选，若为空或未登录则只显示无需角色的项）
 * @returns 过滤后的导航项数组（支持嵌套）
 */
export function getFilteredNavItems(userRoles?: UserRole[]): NavItem[] {
  return filterNavItemsByRole(navItems, userRoles);
}

/**
 * 获取侧边栏导航项（与 getFilteredNavItems 相同，但保留原函数名以兼容旧代码）
 * @deprecated 请使用 getFilteredNavItems，该方法仅用于向后兼容
 */
export function getSidebarNavItems(userRoles?: UserRole[]): NavItem[] {
  return getFilteredNavItems(userRoles);
}

// ==================== 性能优化（可选） ====================

/**
 * 预计算常用角色组合的过滤结果（如果角色组合有限，可以缓存）
 */
const navItemsCache = new Map<string, NavItem[]>();

/**
 * 带缓存的过滤函数（高级用法，按需使用）
 * @param userRoles - 用户角色列表
 * @returns 过滤后的导航项
 */
export function getFilteredNavItemsWithCache(userRoles?: UserRole[]): NavItem[] {
  const key = userRoles ? [...userRoles].sort().join(',') : 'no-roles';
  if (!navItemsCache.has(key)) {
    navItemsCache.set(key, getFilteredNavItems(userRoles));
  }
  return navItemsCache.get(key)!;
}