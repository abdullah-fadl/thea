'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';
import { useSidebarNav } from '@/lib/thea-ui/hooks/useSidebarNav';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import { ChevronDown, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useState } from 'react';
import type { NavItem } from '@/lib/thea-ui/hooks/useSidebarNav';

interface TheaMobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TheaMobileSidebar({ open, onOpenChange }: TheaMobileSidebarProps) {
  const { isRTL, language } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const { navItems, unreadCount, erUnreadCount, me } = useSidebarNav();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const userName = (me as any)?.user?.name || (me as any)?.user?.email?.split('@')[0] || '';
  const userRole = (me as any)?.user?.role || '';
  const avatarInitial = userName.charAt(0).toUpperCase() || '?';

  const handleLinkClick = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  function isActive(href?: string): boolean {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function isGroupActive(item: NavItem): boolean {
    if (item.href) return isActive(item.href);
    return item.children?.some((c) => isActive(c.href)) || false;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'left' : 'right'}
        className="w-[280px] p-0 border-0 [&>button]:hidden"
        style={{ background: THEA_UI.sidebar.bg }}
      >
        <div className="flex flex-col h-full">
          {/* ── Brand ── */}
          <div className="px-5 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: THEA_UI.sidebar.brandLogo }}
              >
                <span className="text-white text-sm font-black">T</span>
              </div>
              <div>
                <div className="text-sm font-extrabold" style={{ color: THEA_UI.sidebar.text }}>
                  {tr('ثيا هيلث', 'Thea Health')}
                </div>
                <div className="text-[10px]" style={{ color: THEA_UI.sidebar.textMuted }}>
                  {tr('بيئة العمل السريرية', 'Clinical Workspace')}
                </div>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/5"
              style={{ color: THEA_UI.sidebar.textMuted }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Divider ── */}
          <div className="mx-4 h-px" style={{ background: THEA_UI.sidebar.border }} />

          {/* ── Nav Items ── */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 thea-scroll">
            {navItems.map((item, idx) => {
              const hasChildren = item.children && item.children.length > 0;
              const active = isGroupActive(item);
              const isExpanded = expandedGroup === (item.title || String(idx));

              if (!hasChildren && item.href) {
                // ── Leaf item ──
                return (
                  <button
                    key={item.href}
                    onClick={() => handleLinkClick(item.href!)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl thea-transition-fast',
                      active ? 'bg-card/[0.06]' : 'hover:bg-card/[0.04]',
                    )}
                  >
                    {/* Dot indicator */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: active ? THEA_UI.sidebar.dotActive : THEA_UI.sidebar.dot,
                      }}
                    />
                    {/* Icon */}
                    {item.icon && (
                      <item.icon
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: active ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted }}
                      />
                    )}
                    {/* Label */}
                    <span
                      className={cn('text-sm truncate', active ? 'font-bold' : 'font-medium')}
                      style={{ color: active ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted }}
                    >
                      {item.title}
                    </span>
                    {/* Badge */}
                    {item.href === '/notifications' && unreadCount > 0 && (
                      <span className="ms-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                );
              }

              // ── Group item ──
              return (
                <div key={item.title || idx}>
                  <button
                    onClick={() =>
                      setExpandedGroup(isExpanded ? null : (item.title || String(idx)))
                    }
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl thea-transition-fast',
                      active ? 'bg-card/[0.06]' : 'hover:bg-card/[0.04]',
                    )}
                  >
                    {item.icon && (
                      <item.icon
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: active ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted }}
                      />
                    )}
                    <span
                      className={cn('text-sm truncate flex-1 text-start', active ? 'font-bold' : 'font-medium')}
                      style={{ color: active ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted }}
                    >
                      {item.title}
                    </span>
                    {/* ER badge */}
                    {item.area === 'er' && erUnreadCount > 0 && (
                      <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {erUnreadCount > 99 ? '99+' : erUnreadCount}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0 thea-transition-fast',
                        isExpanded && 'rotate-180',
                      )}
                      style={{ color: THEA_UI.sidebar.textMuted }}
                    />
                  </button>

                  {/* Children */}
                  {isExpanded && item.children && (
                    <div className="ms-4 mt-0.5 space-y-0.5 thea-animate-slide-up">
                      {item.children.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <button
                            key={child.href}
                            onClick={() => child.href && handleLinkClick(child.href)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl thea-transition-fast',
                              childActive ? 'bg-card/[0.06]' : 'hover:bg-card/[0.04]',
                            )}
                          >
                            <span
                              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                              style={{
                                background: childActive ? THEA_UI.sidebar.dotActive : THEA_UI.sidebar.dot,
                              }}
                            />
                            <span
                              className={cn('text-[13px] truncate', childActive ? 'font-bold' : 'font-medium')}
                              style={{ color: childActive ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted }}
                            >
                              {child.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* ── Divider ── */}
          <div className="mx-4 h-px" style={{ background: THEA_UI.sidebar.border }} />

          {/* ── User Info ── */}
          <div className="px-4 py-4 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: THEA_UI.sidebar.userAvatar }}
            >
              {avatarInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-bold truncate"
                style={{ color: THEA_UI.sidebar.text }}
              >
                {userName}
              </div>
              <div
                className="text-[10px] truncate"
                style={{ color: THEA_UI.sidebar.textMuted }}
              >
                {userRole}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
