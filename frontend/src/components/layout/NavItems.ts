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
  /** 与后端 JWT / RoleId `dao` 一致 */
  DAO = 'dao',
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
  { href: '/explorer', label: '区块链浏览器' },
  {
    label: '理赔',
    requiredRole: UserRole.MEMBER,
    children: [
      { href: '/claim', label: '发起理赔' },
      { href: '/claim/list', label: '我的理赔' },
      { href: '/airdrop', label: '空投奖励', badge: 'ZK' },
    ],
  },
  {
    label: '成员中心',
    requiredRole: UserRole.MEMBER,
    children: [
      { href: '/member/profile', label: '个人资料' },
      { href: '/member/sbt', label: '灵魂代币', badge: 'SBT' },
      { href: '/member/family', label: '家庭成员' },
      { href: '/member/benefits', label: '我的福利' },
      { href: '/member/payments', label: '缴费记录' },
      { href: '/member/notifications', label: '通知中心' },
    ],
  },
  {
    label: '仲裁工作台',
    requiredRole: UserRole.ARBITRATOR,
    children: [
      { href: '/arbitration', label: '工作台首页' },
      { href: '/arbitration/cases', label: '待裁决案件' },
      { href: '/arbitration/vote', label: '投票表决' },
      { href: '/arbitration/history', label: '仲裁记录' },
      { href: '/arbitration/reputation', label: '声誉系统' },
      { href: '/arbitration/rewards', label: '奖励中心' },
    ],
  },
  {
    label: '挑战者',
    requiredRole: UserRole.CHALLENGER,
    children: [
      { href: '/challenge', label: '工作台首页' },
      { href: '/challenge/browse', label: '浏览理赔' },
      { href: '/challenge/list', label: '我的挑战' },
      { href: '/challenge/deposit', label: '保证金管理' },
      { href: '/challenge/rewards', label: '奖励质押' },
    ],
  },
  {
    label: '预言机',
    requiredRole: UserRole.ORACLE,
    children: [
      { href: '/oracle', label: '工作台首页' },
      { href: '/oracle/stake', label: '质押管理' },
      { href: '/oracle/reputation', label: '信誉系统' },
    ],
  },
  {
    label: '守护者',
    requiredRole: UserRole.GUARDIAN,
    children: [
      { href: '/guardian', label: '控制台首页' },
      { href: '/guardian/params', label: '参数管理' },
      { href: '/guardian/upgrade', label: '合约升级' },
      { href: '/guardian/oracle', label: '预言机管理' },
      { href: '/guardian/oplog', label: '操作日志' },
    ],
  },
  {
    label: 'DAO 治理',
    requiredRole: UserRole.DAO,
    children: [
      { href: '/governance', label: '治理中心' },
      { href: '/governance/proposals', label: '提案大厅' },
      { href: '/governance/create', label: '发起提案' },
      { href: '/governance/vote', label: '投票中心' },
      { href: '/governance/delegate', label: '委托投票' },
      { href: '/governance/history', label: '历史记录' },
      { href: '/governance/treasury', label: '金库' },
      { href: '/governance/members', label: '成员管理' },
    ],
  },
  {
    label: '审计中心',
    requiredRole: UserRole.GUARDIAN,
    children: [
      { href: '/audit', label: '审计仪表盘' },
      { href: '/audit/flow', label: '资金流分析' },
      { href: '/audit/fraud', label: '欺诈检测' },
      { href: '/audit/reports', label: '历史报告' },
      { href: '/audit/publish', label: '发布报告' },
    ],
  },
] as const satisfies readonly NavItem[];

/**
 * 顶部导航专用导航项（精简版，只显示最常用的入口）
 */
export const topNavItems: NavItem[] = [
  { href: '/', label: '门户' },
  { href: '/explorer', label: '区块链浏览器' },
  { href: '/claim', label: '理赔申请' },
  { href: '/airdrop', label: '空投奖励' },
  { href: '/member', label: '成员中心' },
  { href: '/governance', label: 'DAO 治理' },
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
    // 未登录或未提供角色：只保留没有角色限制的项
    return items
      .map(item => {
        // 有任何角色要求的项一律隐藏（含带 children 的分组）
        if (item.requiredRole) return null;
        if (item.children) {
          const filteredChildren = filterNavItemsByRole(item.children, userRoles);
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        return item;
      })
      .filter((item): item is NavItem => item !== null);
  }

  return items
    .map((item): NavItem | null => {
      // 角色不满足时直接隐藏，不再递归子项
      const isVisible = !item.requiredRole || userRoles.includes(item.requiredRole);
      if (!isVisible) return null;

      // 处理子菜单
      let filteredChildren: NavItem[] | undefined;
      if (item.children) {
        filteredChildren = filterNavItemsByRole(item.children, userRoles);
        // 分组无 href 且子项全被过滤，则隐藏整个分组
        if (filteredChildren.length === 0 && !item.href) {
          return null;
        }
      }

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