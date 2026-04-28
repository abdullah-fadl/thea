'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import { useSidebarNav } from '@/lib/thea-ui/hooks/useSidebarNav';
import { TheaSidebarBrand } from './TheaSidebarBrand';
import { TheaSidebarNav } from './TheaSidebarNav';
import { TheaSidebarUser } from './TheaSidebarUser';

interface TheaSidebarProps {
  onLinkClick?: () => void;
}

export function TheaSidebar({ onLinkClick }: TheaSidebarProps) {
  const { isRTL } = useLang();
  const { navItems, unreadCount, erUnreadCount, mounted, me } = useSidebarNav();
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null; }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimers();
    // Small delay before expanding to avoid flicker on accidental hovers
    expandTimer.current = setTimeout(() => setExpanded(true), 80);
  }, [clearTimers]);

  const handleMouseLeave = useCallback(() => {
    clearTimers();
    collapseTimer.current = setTimeout(() => setExpanded(false), 300);
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => clearTimers, [clearTimers]);

  // User display data
  const userName = (me as any)?.user?.name || (me as any)?.user?.email?.split('@')[0] || '';
  const userRole = (me as any)?.user?.role || '';

  // Loading placeholder (matches server-side to avoid hydration mismatch)
  if (!mounted) {
    return (
      <div
        style={{
          width: THEA_UI.sidebar.width.collapsed,
          height: '100vh',
          background: THEA_UI.sidebar.bg,
        }}
      />
    );
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col h-screen select-none"
      style={{
        width: expanded ? THEA_UI.sidebar.width.expanded : THEA_UI.sidebar.width.collapsed,
        background: THEA_UI.sidebar.bg,
        transition: `width ${THEA_UI.animation.duration.sidebar} ${THEA_UI.animation.ease}`,
        direction: isRTL ? 'rtl' : 'ltr',
        overflow: 'hidden',
      }}
    >
      {/* Brand */}
      <TheaSidebarBrand expanded={expanded} />

      {/* Divider */}
      <div style={{ height: 1, background: THEA_UI.sidebar.border, margin: '0 12px', flexShrink: 0 }} />

      {/* Nav */}
      <TheaSidebarNav
        items={navItems}
        expanded={expanded}
        onLinkClick={onLinkClick}
        unreadCount={unreadCount}
        erUnreadCount={erUnreadCount}
      />

      {/* User */}
      <TheaSidebarUser expanded={expanded} name={userName} role={userRole} />
    </div>
  );
}
