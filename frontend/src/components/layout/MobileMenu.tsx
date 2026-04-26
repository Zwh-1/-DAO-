/**
 * 移动端菜单组件
 * 
 * 功能：
 * - 移动端侧滑菜单
 * - 响应式导航
 * - 流畅的动画效果
 * 
 * 视觉规范：
 * - 医疗蓝配色
 * - 无蓝紫渐变
 * - 大触摸目标（≥44px）
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlideIn } from '@/components/ui/Animations';
import { navItems, type NavItem } from './NavItems';

export interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 移动端菜单项
 */
const MobileNavItem = React.memo(function MobileNavItem({
  href,
  label,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center px-4 py-4 rounded-xl text-base font-medium
        transition-all duration-200 touch-manipulation
        ${isActive
          ? 'bg-primary/5 text-primary shadow-[0_0_0_1px_rgba(10,37,64,0.1)]'
          : 'text-steel hover:bg-surface hover:text-primary'
        }
      `}
      role="menuitem"
    >
      {label}
    </Link>
  );
});

/**
 * 移动端菜单分组
 */
const MobileNavGroup = React.memo(function MobileNavGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="px-4 py-2 text-xs font-semibold text-steel/60 uppercase tracking-wider">
        {label}
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
});

/**
 * 移动端菜单组件
 */
export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const [isClosing, setIsClosing] = useState(false);

  /**
   * 处理关闭
   */
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  /**
   * 处理点击导航项
   */
  const handleNavClick = useCallback(() => {
    handleClose();
  }, [handleClose]);

  /**
   * ESC 键关闭菜单
   */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, handleClose]);

  /**
   * 阻止背景滚动
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`
          fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden
          transition-opacity duration-200
          ${isOpen && !isClosing ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 菜单面板 */}
      <div
        className={`
          fixed top-0 left-0 bottom-0 w-72 bg-white z-50 md:hidden
          shadow-2xl overflow-y-auto
          transition-transform duration-200 ease-out
          ${isOpen && !isClosing ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
      >
        {/* 菜单头部 */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100/60">
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5"
              className="w-6 h-6"
              aria-hidden
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>TrustAid</span>
          </h2>
          
          {/* 关闭按钮 */}
          <button
            onClick={() => {
              console.log('[MobileMenu] 点击关闭按钮');
              handleClose();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
            aria-label="关闭菜单"
          >
            <svg className="w-5 h-5 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 菜单内容 */}
        <nav className="p-4">
          {navItems.map((item, idx) => {
            const navItem = item as NavItem;
            
            // 分组导航
            if (!navItem.href && navItem.children) {
              return (
                <MobileNavGroup key={`group-${idx}`} label={navItem.label}>
                  {navItem.children
                    .filter((c): c is NavItem & { href: string } => !!c.href)
                    .map((child) => (
                      <MobileNavItem
                        key={child.href}
                        href={child.href}
                        label={child.label}
                        isActive={pathname === child.href}
                        onClick={handleNavClick}
                      />
                    ))
                  }
                </MobileNavGroup>
              );
            }
            
            // 单个导航项
            if (navItem.href) {
              return (
                <SlideIn key={navItem.href} direction="right" delay={idx * 30} duration={200}>
                  <MobileNavItem
                    href={navItem.href}
                    label={navItem.label}
                    isActive={pathname === navItem.href}
                    onClick={handleNavClick}
                  />
                </SlideIn>
              );
            }
            
            return null;
          })}
        </nav>

        {/* 菜单底部 */}
        <div className="p-6 border-t border-gray-100/60">
          <div className="text-xs text-steel/80 space-y-1">
            <p className="font-medium">© 2026 TrustAid</p>
            <p className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
              <span>ZK-Powered System</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileMenu;
