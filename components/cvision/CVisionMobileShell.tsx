'use client';

import { ReactNode, useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Bell, LayoutDashboard, FileText, User, Sun, Moon, Languages, RefreshCw, LogOut } from 'lucide-react';
import { useCVisionTheme, type CVisionPalette } from '@/lib/cvision/theme';
import { useCVisionAuthz } from '@/components/shell/CVisionAuthzClient';
import { SIDEBAR_SECTIONS, type SidebarSection, type SidebarItem } from '@/lib/cvision/sidebar-config';
import { CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { useLang } from '@/hooks/use-lang';
import { ChevronDown } from 'lucide-react';

function hasPermission(roles: string[], isOwner: boolean, permission: string): boolean {
  if (isOwner) return true;
  for (const role of roles) {
    const perms = CVISION_ROLE_PERMISSIONS[role];
    if (perms?.includes(permission)) return true;
  }
  return false;
}

/* ─── Bottom Nav Tabs ────────────────────────────────────────────────── */

const BOTTOM_TABS = [
  { label: 'Dashboard', labelAr: 'الرئيسية', href: '/cvision', icon: LayoutDashboard },
  { label: 'Requests', labelAr: 'طلباتي', href: '/cvision/self-service', icon: FileText },
  { label: 'Alerts', labelAr: 'الإشعارات', href: '/cvision/notifications', icon: Bell },
  { label: 'Profile', labelAr: 'حسابي', href: '/cvision/directory', icon: User },
];

/* ─── Mobile Shell ───────────────────────────────────────────────────── */

interface CVisionMobileShellProps {
  children: ReactNode;
}

export default function CVisionMobileShell({ children }: CVisionMobileShellProps) {
  const { C, isDark, toggleMode } = useCVisionTheme();
  const { language, setLanguage } = useLang();
  const isRTL = language === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  const authz = useCVisionAuthz();
  const roles = authz?.roles || [];
  const isOwner = authz?.isOwner || false;

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUserName(data.user.name || data.user.email?.split('@')[0] || '');
          setUserRole(data.user.role || '');
        }
      })
      .catch(() => {});
  }, []);

  const userInitials = useMemo(() => {
    const parts = userName.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (userName.slice(0, 2) || '??').toUpperCase();
  }, [userName]);

  const filteredSections = useMemo(
    () =>
      SIDEBAR_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => hasPermission(roles, isOwner, item.permission)),
      })).filter((s) => s.items.length > 0),
    [roles, isOwner]
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const tr = (ar: string, en: string) => (isRTL ? ar : en);

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
      {/* Top Bar */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bgSidebar,
          position: 'sticky',
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Left: Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>C-Vision</span>
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}>HR</span>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleMode}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {isDark ? <Sun size={16} color={C.gold} /> : <Moon size={16} color={C.purple} />}
          </button>
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Languages size={16} color={C.textSecondary} />
          </button>
          {/* Platform switch */}
          <button
            type="button"
            onClick={() => router.push('/platforms')}
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={14} color={C.textSecondary} />
          </button>
          {/* Notifications */}
          <div style={{ position: 'relative', cursor: 'pointer', padding: 4 }}>
            <Bell size={18} color={C.textMuted} />
            <div
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: C.red,
                border: `2px solid ${C.bgSidebar}`,
              }}
            />
          </div>
          {/* Menu */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <Menu size={20} color={C.text} />
          </button>
        </div>
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          [isRTL ? 'right' : 'left']: drawerOpen ? 0 : -280,
          width: 280,
          height: '100vh',
          background: C.bgSidebar,
          borderRight: isRTL ? 'none' : `1px solid ${C.border}`,
          borderLeft: isRTL ? `1px solid ${C.border}` : 'none',
          zIndex: 110,
          transition: `${isRTL ? 'right' : 'left'} 0.3s ease`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '16px 12px',
        }}
      >
        {/* Drawer header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={isDark ? '/brand/cvision-dark.svg' : '/brand/cvision-light.svg'}
              alt="CVision"
              style={{ height: 28, objectFit: 'contain' }}
            />
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color={C.textMuted} />
          </button>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1 }}>
          {filteredSections.map((section) => {
            const isOpen = expanded[section.id] ?? false;
            const hasActive = section.items.some(
              (i) => pathname === i.href || pathname.startsWith(i.href + '/')
            );

            if (section.id === 'main') {
              return (
                <div key={section.id} style={{ marginBottom: 4 }}>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.href === '/cvision' ? pathname === item.href : pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 9,
                          marginBottom: 2,
                          textDecoration: 'none',
                          background: active ? C.goldDim : 'transparent',
                          borderLeft: !isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
                          borderRight: isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
                        }}
                      >
                        <Icon size={17} color={active ? C.gold : C.textMuted} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.gold : C.textSecondary }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 9, color: C.textMuted }}>{item.labelEn}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggle(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 12px',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: hasActive ? C.gold : C.textMuted,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  <span>{isRTL ? section.label : section.labelEn}</span>
                  <ChevronDown
                    size={12}
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
                  />
                </button>
                {isOpen &&
                  section.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 9,
                          marginBottom: 2,
                          textDecoration: 'none',
                          background: active ? C.goldDim : 'transparent',
                          borderLeft: !isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
                          borderRight: isRTL ? (active ? `2.5px solid ${C.gold}` : '2.5px solid transparent') : undefined,
                        }}
                      >
                        <Icon size={17} color={active ? C.gold : C.textMuted} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.gold : C.textSecondary }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 9, color: C.textMuted }}>{item.labelEn}</div>
                        </div>
                      </Link>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {/* User + Logout */}
        <div
          style={{
            padding: '12px 10px',
            borderRadius: 10,
            background: isDark ? C.bgCard : C.bgSubtle,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${C.gold}50, ${C.purple}50)`,
              border: `1px solid ${isDark ? C.gold + '30' : C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: C.gold,
            }}
          >
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </div>
            <div style={{ fontSize: 9, color: C.textMuted }}>{userRole}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                router.push('/login');
                router.refresh();
              } catch { /* ignore */ }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            title={tr('تسجيل الخروج', 'Logout')}
          >
            <LogOut size={16} color={C.textMuted} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', paddingBottom: 80 }}>
        {children}
      </div>

      {/* Bottom Nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          background: C.bgSidebar,
          borderTop: `1px solid ${C.border}`,
          zIndex: 50,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {BOTTOM_TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/cvision' && pathname.startsWith(tab.href + '/'));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 12px',
                textDecoration: 'none',
              }}
            >
              <Icon size={20} color={active ? C.gold : C.textMuted} strokeWidth={active ? 2.5 : 1.5} />
              {active && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.gold }} />
              )}
              <span style={{ fontSize: 10, color: active ? C.gold : C.textMuted, fontWeight: active ? 600 : 400 }}>
                {isRTL ? tab.labelAr : tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
