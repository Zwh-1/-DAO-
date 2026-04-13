"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, type NavItem } from "../../components/layout/NavItems";

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-100/60 overflow-y-auto flex flex-col hidden md:flex">
            <div className="h-16 flex items-center px-6 border-b border-gray-100/60 flex-shrink-0">
                <h1 className="text-xl font-bold text-primary flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    TrustAid
                </h1>
            </div>
            <nav className="p-4 space-y-1 flex-1">
                {navItems.map((item, idx) => {
                    const navItem = item as NavItem;
                    if (!navItem.href) {
                        if (navItem.children) {
                            return (
                                <div key={`group-${idx}`} className="mt-3 mb-1">
                                    <div className="px-4 py-1.5 text-xs font-semibold text-steel/60 uppercase tracking-wider">
                                        {navItem.label}
                                    </div>
                                    {navItem.children.filter((c): c is NavItem & { href: string } => !!c.href).map((child) => {
                                        const isChildActive = pathname === child.href;
                                        return (
                                            <Link
                                                key={child.href}
                                                href={child.href}
                                                className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isChildActive
                                                        ? "bg-primary/5 text-primary shadow-[0_0_0_1px_rgba(10,37,64,0.1)]"
                                                        : "text-steel hover:bg-surface hover:text-primary"
                                                    }`}
                                            >
                                                {child.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            );
                        }
                        return null;
                    }
                    const isActive = pathname === navItem.href;
                    return (
                        <Link
                            key={navItem.href}
                            href={navItem.href}
                            className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-primary/5 text-primary shadow-[0_0_0_1px_rgba(10,37,64,0.1)]"
                                    : "text-steel hover:bg-surface hover:text-primary"
                                }`}
                        >
                            {navItem.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-6 border-t border-gray-100/60 flex-shrink-0">
                <div className="text-xs text-steel/80">
                    <p>© 2026 TrustAid</p>
                    <p className="mt-1">ZK-Powered System</p>
                </div>
            </div>
        </aside>
    );
}
