"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { navItems, type NavItem, filterNavItemsByRole, UserRole } from "./NavItems";
import { SlideIn } from "@/components/ui/index";
import { useAuthStore, type RoleId } from "@/store/authStore";

/**
 * 侧边栏导航项组件
 */
const NavItemLink = memo(function NavItemLink({ 
    href, 
    label, 
    isActive 
}: { 
    href: string; 
    label: string; 
    isActive: boolean;
}) {
    return (
        <Link
            href={href}
            className={`
                group flex items-center px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200
                ${isActive
                    ? "bg-primary/5 text-primary shadow-[0_0_0_1px_rgba(10,37,64,0.1)]"
                    : "text-steel hover:bg-surface hover:text-primary hover:translate-x-1"
                }
            `}
        >
            {/* 激活指示器 */}
            {isActive && (
                <span className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
            <span className="relative">{label}</span>
        </Link>
    );
});

/**
 * 侧边栏导航分组组件
 */
const NavGroup = memo(function NavGroup({ 
    label, 
    children 
}: { 
    label: string; 
    children: React.ReactNode;
}) {
    return (
        <div className="mt-3 mb-1">
            <div className="px-4 py-1.5 text-xs font-semibold text-steel/60 uppercase tracking-wider">
                {label}
            </div>
            <div className="space-y-0.5 relative">
                {children}
            </div>
        </div>
    );
});

/**
 * 侧边栏组件
 * 功能：
 * - 显示导航菜单
 * - 响应式设计
 * - 流畅的动画效果
 */
export function Sidebar() {
    const pathname = usePathname();
    const roles = useAuthStore((s) => s.roles);
    const userRoles = roles.map((r: RoleId) => r as unknown as UserRole);
    const filteredItems = filterNavItemsByRole(navItems, userRoles.length > 0 ? userRoles : undefined);

    return (
        <aside 
            className="w-64 flex-shrink-0 bg-white border-r border-gray-100/60 overflow-y-auto flex flex-col hidden md:flex"
            role="navigation"
            aria-label="主导航"
        >
            {/* Logo 区域 */}
            <div className="h-16 flex items-center px-6 border-b border-gray-100/60 flex-shrink-0">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2.5">
                    {/* 盾牌图标 */}
                    <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="w-6 h-6 text-primary"
                        aria-hidden
                    >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>TrustAid</span>
                </h1>
            </div>
            
            {/* 导航菜单 */}
            <nav className="p-4 space-y-1 flex-1">
                {filteredItems.map((item, idx) => {
                    const navItem = item as NavItem;
                    
                    // 分组导航
                    if (!navItem.href) {
                        if (navItem.children) {
                            return (
                                <SlideIn key={`group-${idx}`} direction="right" delay={idx * 30} duration={250}>
                                    <NavGroup label={navItem.label}>
                                        {navItem.children
                                            .filter((c): c is NavItem & { href: string } => !!c.href)
                                            .map((child) => {
                                                const isChildActive = pathname === child.href;
                                                return (
                                                    <NavItemLink
                                                        key={child.href}
                                                        href={child.href}
                                                        label={child.label}
                                                        isActive={isChildActive}
                                                    />
                                                );
                                            })
                                        }
                                    </NavGroup>
                                </SlideIn>
                            );
                        }
                        return null;
                    }
                    
                    // 单个导航项
                    const isActive = pathname === navItem.href;
                    return (
                        <SlideIn key={navItem.href} direction="right" delay={idx * 30} duration={250}>
                            <NavItemLink
                                href={navItem.href}
                                label={navItem.label}
                                isActive={isActive}
                            />
                        </SlideIn>
                    );
                })}
            </nav>
            
            {/* 底部信息 */}
            <SlideIn direction="up" delay={300} duration={300}>
                <div className="p-6 border-t border-gray-100/60 flex-shrink-0">
                    <div className="text-xs text-steel/80 space-y-1">
                        <p className="font-medium">© 2026 TrustAid</p>
                        <p className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
                            <span>ZK-Powered System</span>
                        </p>
                    </div>
                </div>
            </SlideIn>
        </aside>
    );
}

export default Sidebar;
