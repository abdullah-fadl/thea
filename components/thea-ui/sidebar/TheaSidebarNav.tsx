'use client';

import { TheaSidebarNavItem } from './TheaSidebarNavItem';
import type { NavItem } from '@/lib/thea-ui/hooks/useSidebarNav';

interface TheaSidebarNavProps {
  items: NavItem[];
  expanded: boolean;
  onLinkClick?: () => void;
  unreadCount: number;
  erUnreadCount: number;
}

export function TheaSidebarNav({
  items,
  expanded,
  onLinkClick,
  unreadCount,
  erUnreadCount,
}: TheaSidebarNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden thea-scroll space-y-1 px-2 py-3" style={{ minHeight: 0 }}>
      {items.map((item, idx) => (
        <TheaSidebarNavItem
          key={item.href || `${item.title}-${idx}`}
          item={item}
          expanded={expanded}
          onLinkClick={onLinkClick}
          unreadCount={item.children?.some(c => c.href === '/er/notifications') ? erUnreadCount : unreadCount}
        />
      ))}
    </nav>
  );
}
