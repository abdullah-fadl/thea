'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import type { NavItem } from '@/lib/thea-ui/hooks/useSidebarNav';

interface TheaSidebarNavItemProps {
  item: NavItem;
  expanded: boolean;
  level?: number;
  onLinkClick?: () => void;
  unreadCount?: number;
}

export function TheaSidebarNavItem({
  item,
  expanded,
  level = 0,
  onLinkClick,
  unreadCount = 0,
}: TheaSidebarNavItemProps) {
  const pathname = usePathname();

  // ── Group (has children) ──
  if (item.children) {
    return (
      <TheaSidebarGroup
        item={item}
        expanded={expanded}
        level={level}
        onLinkClick={onLinkClick}
        unreadCount={unreadCount}
      />
    );
  }

  // ── Leaf item ──
  const isActive = pathname === item.href;
  const Icon = item.icon;
  const showBadge =
    (item.href === '/notifications' || item.href === '/er/notifications') && unreadCount > 0;

  return (
    <Link
      href={item.href!}
      onClick={onLinkClick}
      className="group relative flex items-center gap-3 no-underline outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
      title={!expanded ? item.title : undefined}
      style={{
        padding: expanded ? '8px 10px' : '8px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: THEA_UI.radius.md,
        background: isActive ? THEA_UI.sidebar.activeBg : 'transparent',
        transition: `all ${THEA_UI.animation.duration.fast} ${THEA_UI.animation.ease}`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget.style.background = THEA_UI.sidebar.hoverBg);
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget.style.background = 'transparent');
      }}
      onFocus={(e) => {
        if (!isActive) (e.currentTarget.style.background = THEA_UI.sidebar.hoverBg);
      }}
      onBlur={(e) => {
        if (!isActive) (e.currentTarget.style.background = 'transparent');
      }}
    >
      {/* Dot indicator */}
      <span
        className="flex-shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          background: isActive ? THEA_UI.sidebar.dotActive : THEA_UI.sidebar.dot,
          transition: `background ${THEA_UI.animation.duration.fast} ${THEA_UI.animation.ease}`,
        }}
      />
      {/* Icon (only when collapsed for leaf items in a group — but top-level leaves use dot) */}
      {/* Label */}
      {expanded && (
        <span
          className="truncate"
          style={{
            fontSize: THEA_UI.font.size.md,
            fontWeight: isActive ? THEA_UI.font.weight.medium : THEA_UI.font.weight.normal,
            color: isActive ? THEA_UI.sidebar.text : '#CBD5E1',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </span>
      )}
      {/* Notification badge */}
      {showBadge && (
        <span
          className="absolute flex items-center justify-center"
          style={{
            top: 2,
            right: expanded ? 8 : 2,
            minWidth: 18,
            height: 18,
            borderRadius: THEA_UI.radius.pill,
            background: THEA_UI.colors.danger,
            color: THEA_UI.text.inverse,
            fontSize: THEA_UI.font.size.xs,
            fontWeight: THEA_UI.font.weight.semibold,
            padding: '0 4px',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

// ── Collapsible group ──

function TheaSidebarGroup({
  item,
  expanded,
  level,
  onLinkClick,
  unreadCount,
}: TheaSidebarNavItemProps) {
  const pathname = usePathname();
  const hasActiveChild = item.children?.some((c) => c.href === pathname);
  const [isOpen, setIsOpen] = useState(hasActiveChild || false);
  const Icon = item.icon;

  useEffect(() => {
    if (item.children?.some((c) => c.href === pathname)) setIsOpen(true);
  }, [pathname, item.children]);

  // Collapsed: show only the icon
  if (!expanded) {
    return (
      <div
        className="flex items-center justify-center"
        title={item.title}
        style={{
          padding: '8px 0',
          borderRadius: THEA_UI.radius.md,
          cursor: 'default',
        }}
      >
        <Icon
          size={18}
          style={{
            color: hasActiveChild ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted,
            flexShrink: 0,
          }}
        />
      </div>
    );
  }

  // Expanded: button + children
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full group outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        style={{
          padding: '8px 10px',
          borderRadius: THEA_UI.radius.md,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: `background ${THEA_UI.animation.duration.fast} ${THEA_UI.animation.ease}`,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = THEA_UI.sidebar.hoverBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        onFocus={(e) => { e.currentTarget.style.background = THEA_UI.sidebar.hoverBg; }}
        onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div className="flex items-center gap-3">
          <Icon
            size={18}
            style={{
              color: hasActiveChild ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: THEA_UI.font.size.md,
              fontWeight: THEA_UI.font.weight.medium,
              color: hasActiveChild ? THEA_UI.sidebar.text : THEA_UI.sidebar.textMuted,
            }}
          >
            {item.title}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: THEA_UI.sidebar.textMuted,
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: `transform ${THEA_UI.animation.duration.fast} ${THEA_UI.animation.ease}`,
          }}
        />
      </button>

      {isOpen && (
        <div className="mt-1 space-y-0.5" style={{ paddingInlineStart: 12 }}>
          {item.children!.map((child, idx) => (
            <TheaSidebarNavItem
              key={child.href || `${child.title}-${idx}`}
              item={child}
              expanded={expanded}
              level={(level ?? 0) + 1}
              onLinkClick={onLinkClick}
              unreadCount={unreadCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
