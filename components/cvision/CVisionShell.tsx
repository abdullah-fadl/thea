'use client';

import { ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronLeft, Sun, Moon, Menu,
  Search, Bell, Download, Plus, LogOut, RefreshCw, Settings, User, Languages,
} from 'lucide-react';
import { useCVisionTheme, type CVisionPalette } from '@/lib/cvision/theme';
import { useCVisionAuthz } from '@/components/shell/CVisionAuthzClient';
import { SIDEBAR_SECTIONS, type SidebarSection, type SidebarItem } from '@/lib/cvision/sidebar-config';
import { CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { useLang } from '@/hooks/use-lang';

/* ─── Permission helper ──────────────────────────────────────────────── */

function hasPermission(roles: string[], isOwner: boolean, permission: string): boolean {
  if (isOwner) return true;
  for (const role of roles) {
    const perms = CVISION_ROLE_PERMISSIONS[role];
    if (perms?.includes(permission)) return true;
  }
  return false;
}

/* ─── Nav Item ───────────────────────────────────────────────────────── */

function NavItem({
  item,
  active,
  C,
  isRTL,
  onClick,
}: {
  item: SidebarItem;
  active: boolean;
  C: CVisionPalette;
  isRTL: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 11px',
        borderRadius: 9,
        marginBottom: 2,
        cursor: 'pointer',
        transition: 'all 0.2s',
        textDecoration: 'none',
        background: active ? C.goldDim : hovered ? C.bgSubtle : 'transparent',
        borderLeft: !isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
        borderRight: isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
      }}
    >
      <Icon size={17} color={active ? C.gold : C.textMuted} strokeWidth={active ? 2 : 1.5} />
      <div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: active ? 600 : 400,
            color: active ? C.gold : C.textSecondary,
            transition: 'color 0.3s',
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: 8.5, color: C.textMuted, letterSpacing: 0.3 }}>
          {item.labelEn}
        </div>
      </div>
    </Link>
  );
}

/* ─── Section Header ─────────────────────────────────────────────────── */

function SectionHeader({
  section,
  isOpen,
  hasActive,
  C,
  isRTL,
  onToggle,
}: {
  section: SidebarSection;
  isOpen: boolean;
  hasActive: boolean;
  C: CVisionPalette;
  isRTL: boolean;
  onToggle: () => void;
}) {
  const label = isRTL ? section.label : section.labelEn;
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 11px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: hasActive ? C.gold : C.textMuted,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        marginTop: 8,
        transition: 'color 0.2s',
      }}
    >
      <span>{label}</span>
      <ChevronDown
        size={12}
        style={{
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
        }}
      />
    </button>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────── */

function CVisionSidebar({
  C,
  isDark,
  isRTL,
}: {
  C: CVisionPalette;
  isDark: boolean;
  isRTL: boolean;
}) {
  const pathname = usePathname();
  const authz = useCVisionAuthz();
  const roles = authz?.roles || [];
  const isOwner = authz?.isOwner || false;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand active section
  useEffect(() => {
    const activeSection = SIDEBAR_SECTIONS.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))
    );
    if (activeSection) {
      setExpanded((prev) => ({ ...prev, [activeSection.id]: true }));
    }
  }, [pathname]);

  const filteredSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => hasPermission(roles, isOwner, item.permission)),
      })).filter((s) => s.items.length > 0),
    [roles, isOwner]
  );

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        width: 230,
        padding: '20px 14px',
        borderRight: isRTL ? 'none' : `1px solid ${C.border}`,
        borderLeft: isRTL ? `1px solid ${C.border}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        background: C.bgSidebar,
        boxShadow: isDark ? 'none' : '2px 0 12px rgba(0,0,0,0.03)',
        position: 'relative',
        zIndex: 10,
        transition: 'all 0.4s',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '12px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
        <img
          src={isDark ? '/brand/cvision-dark.svg' : '/brand/cvision-light.svg'}
          alt="CVision"
          style={{
            width: '100%',
            maxHeight: 48,
            objectFit: 'contain',
            objectPosition: 'center',
            transition: 'opacity 0.3s',
          }}
        />
      </div>

      {/* Navigation */}
      <div style={{ marginTop: 16, flex: 1, overflowY: 'auto' }}>
        {filteredSections.map((section) => {
          const isOpen = expanded[section.id] ?? false;
          const hasActive = section.items.some(
            (i) => pathname === i.href || pathname.startsWith(i.href + '/')
          );

          // Main section (no header, always visible)
          if (section.id === 'main') {
            return (
              <div key={section.id} style={{ marginBottom: 4 }}>
                {section.items.map((item) => {
                  const active =
                    item.href === '/cvision'
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(item.href + '/');
                  return <NavItem key={item.href} item={item} active={active} C={C} isRTL={isRTL} />;
                })}
              </div>
            );
          }

          return (
            <div key={section.id}>
              <SectionHeader
                section={section}
                isOpen={isOpen}
                hasActive={hasActive}
                C={C}
                isRTL={isRTL}
                onToggle={() => toggle(section.id)}
              />
              {isOpen &&
                section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return <NavItem key={item.href} item={item} active={active} C={C} isRTL={isRTL} />;
                })}
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ─── Top Bar ────────────────────────────────────────────────────────── */

function TopBarIconBtn({
  onClick,
  title,
  C,
  children,
}: {
  onClick: () => void;
  title: string;
  C: CVisionPalette;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? C.bgCard : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: C.textSecondary,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}

function CVisionTopBar({
  C,
  isDark,
  isRTL,
  toggleMode,
  userName,
  userRole,
  userInitials,
}: {
  C: CVisionPalette;
  isDark: boolean;
  isRTL: boolean;
  toggleMode: () => void;
  userName: string;
  userRole: string;
  userInitials: string;
}) {
  const router = useRouter();
  const { language, setLanguage } = useLang();
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
      router.refresh();
    } catch { /* ignore */ }
  }

  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        background: C.bgSidebar,
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        transition: 'background 0.4s, border-color 0.4s',
        flexShrink: 0,
      }}
    >
      {/* Left: Platform Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.gold, letterSpacing: -0.3 }}>
          C-Vision
        </span>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
          HR
        </span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Theme toggle */}
        <TopBarIconBtn onClick={toggleMode} title={tr('تبديل الوضع', 'Toggle theme')} C={C}>
          {isDark ? <Sun size={16} color={C.gold} strokeWidth={1.8} /> : <Moon size={16} color={C.purple} strokeWidth={1.8} />}
        </TopBarIconBtn>

        {/* Language toggle */}
        <TopBarIconBtn
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          title={tr('English', 'العربية')}
          C={C}
        >
          <Languages size={16} strokeWidth={1.8} />
        </TopBarIconBtn>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, marginInline: 6 }} />

        {/* Platform Switcher */}
        <button
          type="button"
          onClick={() => router.push('/platforms')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 10px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            color: C.textSecondary,
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={13} strokeWidth={1.8} />
          {tr('تبديل', 'Switch')}
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, marginInline: 6 }} />

        {/* User Chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${C.gold}50, ${C.purple}50)`,
              border: `1px solid ${isDark ? C.gold + '30' : C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: C.gold,
            }}
          >
            {userInitials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
              {userName}
            </div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{userRole}</div>
          </div>
        </div>

        {/* Logout */}
        <TopBarIconBtn onClick={handleLogout} title={tr('تسجيل الخروج', 'Logout')} C={C}>
          <LogOut size={15} strokeWidth={1.8} />
        </TopBarIconBtn>
      </div>
    </header>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

function CVisionHeader({
  C,
  isDark,
  isRTL,
  userName,
}: {
  C: CVisionPalette;
  isDark: boolean;
  isRTL: boolean;
  userName: string;
}) {
  const tr = useCallback(
    (ar: string, en: string) => (isRTL ? ar : en),
    [isRTL]
  );

  const firstName = userName.split(' ')[0] || userName;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3, color: C.text, transition: 'color 0.4s' }}>
          {tr('مرحباً، ', 'Welcome, ')}
          <span style={{ color: C.gold }}>{firstName}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
          {tr('ملخص الموارد البشرية', 'HR Summary')} — {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Search */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
          }}
        >
          <Search size={16} color={C.textMuted} strokeWidth={1.8} />
        </div>
        {/* Notifications */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <Bell size={16} color={C.textMuted} strokeWidth={1.8} />
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: C.red,
              border: `2px solid ${C.notifBorder}`,
            }}
          />
        </div>
        {/* Export */}
        <div
          style={{
            padding: '0 14px',
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            fontSize: 12,
            color: C.textSecondary,
          }}
        >
          <Download size={14} strokeWidth={1.8} /> {tr('تصدير', 'Export')}
        </div>
        {/* New Employee — same gold as brand/firstName for consistency */}
        <div
          style={{
            padding: '0 14px',
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: C.gold,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            boxShadow: isDark ? 'none' : `0 2px 10px ${C.gold}40`,
          }}
        >
          <Plus size={14} strokeWidth={2.5} color="#fff" /> {tr('موظف جديد', 'New Employee')}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Shell ─────────────────────────────────────────────────────── */

interface CVisionShellProps {
  children: ReactNode;
}

export default function CVisionShell({ children }: CVisionShellProps) {
  const { C, isDark, toggleMode } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data?.user) {
          setUserName(data.user.name || data.user.email?.split('@')[0] || '');
          setUserRole(data.user.role || '');
        }
      })
      .catch((err) => {
        // AbortError is expected on cleanup — swallow silently
        if (err instanceof Error && err.name !== 'AbortError') {
          // Non-abort errors are intentionally ignored (auth state just stays empty)
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const userInitials = useMemo(() => {
    const parts = userName.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (userName.slice(0, 2) || '??').toUpperCase();
  }, [userName]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: "'Outfit', 'Noto Sans Arabic', -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.4s, color 0.4s',
      }}
    >
      {/* Dark mode glow */}
      {isDark && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div
            style={{
              position: 'absolute',
              top: -150,
              right: -150,
              width: 500,
              height: 500,
              background: 'radial-gradient(circle, rgba(201,169,98,0.04) 0%, transparent 65%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -200,
              left: 50,
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(124,92,191,0.03) 0%, transparent 65%)',
            }}
          />
        </div>
      )}

      {/* Top Bar */}
      <CVisionTopBar
        C={C}
        isDark={isDark}
        isRTL={isRTL}
        toggleMode={toggleMode}
        userName={userName}
        userRole={userRole}
        userInitials={userInitials}
      />

      {/* Sidebar + Content Row */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar */}
        <CVisionSidebar
          C={C}
          isDark={isDark}
          isRTL={isRTL}
        />

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            padding: '24px 28px',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 10,
            transition: 'all 0.4s',
          }}
        >
          <CVisionHeader C={C} isDark={isDark} isRTL={isRTL} userName={userName} />
          {children}
        </div>
      </div>
    </div>
  );
}
