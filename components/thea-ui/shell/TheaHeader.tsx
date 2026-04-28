'use client';

import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  LogOut,
  User,
  RefreshCw,
  Settings,
  Search,
  Bell,
  Sun,
  Moon,
  Languages,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { usePlatformContext } from '@/components/LanguageProvider';
import { useUiTestMode } from '@/lib/hooks/useUiTestMode';
import { hasRoutePermission } from '@/lib/permissions';
import { getTestAreaLabel, getTestPositionLabel } from '@/lib/ui/testMode';
import { useTheme } from '@/components/ThemeProvider';
import { getSectionTitle } from '@/lib/thea-ui/helpers/getSectionTitle';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import { HijriDateDisplay } from '@/components/ui/HijriDateDisplay';

interface TheaHeaderProps {
  onMenuClick?: () => void;
}

export function TheaHeader({ onMenuClick }: TheaHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, isRTL } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me } = useMe();
  const { platform: platformData } = usePlatform();
  const initialPlatformFromContext = usePlatformContext();
  const { state: testMode, reset } = useUiTestMode(me?.tenantId);
  const { theme, toggleTheme } = useTheme();

  // ── User / permissions ──
  const user = me?.user || null;
  const userPermissions = me?.user?.permissions || [];
  const canViewNotifications = user ? hasRoutePermission(userPermissions, '/notifications') : false;

  const { data: inboxData } = useSWR(
    canViewNotifications ? '/api/notifications/inbox?status=OPEN&limit=1' : null,
    (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json()),
    { refreshInterval: 30000 },
  );
  const openCount = Number(inboxData?.openCount || 0);
  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'thea-owner';

  // ── Platform detection ──
  const routePlatform = (() => {
    if (!pathname) return null;
    if (pathname.startsWith('/sam') || pathname.startsWith('/platforms/sam')) return 'sam';
    if (
      pathname.startsWith('/platforms/thea-health') ||
      pathname.startsWith('/er') || pathname.startsWith('/ipd') ||
      pathname.startsWith('/opd') || pathname.startsWith('/billing') ||
      pathname.startsWith('/dashboard') || pathname.startsWith('/registration') ||
      pathname.startsWith('/orders') || pathname.startsWith('/handover') ||
      pathname.startsWith('/tasks') || pathname.startsWith('/results') ||
      pathname.startsWith('/mortuary') || pathname.startsWith('/departments') ||
      pathname.startsWith('/nursing') || pathname.startsWith('/patient') ||
      pathname.startsWith('/patient-experience') || pathname.startsWith('/scheduling') ||
      pathname.startsWith('/quality') || pathname.startsWith('/search')
    ) return 'health';
    return null;
  })();

  const platform =
    routePlatform ||
    (platformData?.platform === 'sam' || platformData?.platform === 'health'
      ? platformData.platform
      : initialPlatformFromContext === 'sam' || initialPlatformFromContext === 'health'
        ? initialPlatformFromContext
        : null);

  // ── Role labels ──
  const roleMap: Record<string, string> = {
    admin: tr('مسؤول', 'Admin'),
    doctor: tr('طبيب', 'Doctor'),
    nurse: tr('ممرض/ة', 'Nurse'),
    receptionist: tr('موظف استقبال', 'Receptionist'),
    pharmacist: tr('صيدلي', 'Pharmacist'),
    lab_tech: tr('فني مختبر', 'Lab Tech'),
    'thea-owner': tr('المالك', 'Owner'),
    billing: tr('محاسب', 'Billing'),
    triage: tr('فرز', 'Triage'),
  };

  // ── Nav translations for getSectionTitle ──
  const navT = {
    nav: {
      dashboard: tr('لوحة المعلومات', 'Dashboard'),
      opd: tr('العيادات الخارجية', 'Outpatient'),
      er: tr('الطوارئ', 'Emergency'),
      ipd: tr('التنويم', 'Inpatient'),
      billing: tr('الفوترة', 'Billing'),
      admin: tr('الإدارة', 'Administration'),
      orders: tr('الطلبات', 'Orders'),
      ordersHub: tr('الطلبات', 'Orders'),
      resultsInbox: tr('النتائج', 'Results'),
      tasksQueue: tr('المهام', 'Tasks'),
      handover: tr('التسليم', 'Handover'),
      registration: tr('التسجيل', 'Registration'),
      notifications: tr('الإشعارات', 'Notifications'),
      quality: tr('الجودة', 'Quality'),
      opdReferrals: tr('الإحالات', 'Referrals'),
      account: tr('الحساب', 'Account'),
      settings: tr('الإعدادات', 'Settings'),
    },
  };

  // ── Section title ──
  const section = getSectionTitle(pathname || '', navT);

  // ── Handlers ──
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  function exitTestMode() {
    reset();
    router.push('/welcome');
  }

  // ── Render ──
  return (
    <header
      data-testid="platform-header"
      className="sticky top-0 z-40 flex items-center justify-between flex-shrink-0 border-b bg-card"
      style={{
        height: THEA_UI.layout.headerHeight,
        padding: '0 18px',
        borderColor: THEA_UI.border.default,
      }}
    >
      {/* ── Left: section title + Hijri date ── */}
      <div className="flex items-center gap-3 min-w-0">
        <h1
          className="truncate text-foreground"
          style={{ fontWeight: THEA_UI.font.weight.extrabold, fontSize: THEA_UI.font.size.xl }}
        >
          {section.title}
        </h1>
        {section.subtitle && (
          <span
            className="text-muted-foreground hidden sm:inline"
            style={{ fontSize: THEA_UI.font.size.sm }}
          >
            {section.subtitle}
          </span>
        )}
        <span className="hidden lg:inline-flex border-l border-border pl-3">
          <HijriDateDisplay date={new Date()} mode="hijri" className="text-xs" />
        </span>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search */}
        <button
          type="button"
          onClick={() => router.push('/search')}
          className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground thea-transition-fast"
          style={{
            height: 38,
            padding: '0 10px',
            borderRadius: THEA_UI.radius.md,
            border: `1px solid ${THEA_UI.border.default}`,
            background: THEA_UI.bg.input,
            fontSize: THEA_UI.font.size.md,
            width: 180,
            cursor: 'pointer',
          }}
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="truncate" style={{ color: THEA_UI.text.placeholder }}>
            {tr('بحث...', 'Search...')}
          </span>
        </button>

        {/* Notifications bell */}
        <HeaderIconButton
          onClick={() => router.push('/notifications')}
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {openCount > 0 && (
            <span
              className="absolute -top-1 flex items-center justify-center text-white"
              style={{
                ...(isRTL ? { left: -4 } : { right: -4 }),
                height: 18,
                minWidth: 18,
                borderRadius: THEA_UI.radius.pill,
                background: THEA_UI.colors.danger,
                fontSize: 10,
                fontWeight: THEA_UI.font.weight.semibold,
                padding: '0 4px',
              }}
            >
              {openCount > 99 ? '99+' : openCount}
            </span>
          )}
        </HeaderIconButton>

        {/* Test mode badge */}
        {platform === 'health' && testMode.enabled && testMode.area && testMode.position && (
          <div className="hidden md:flex items-center gap-2">
            <span
              className="text-xs border rounded-full px-2 py-0.5 text-muted-foreground border-border"
            >
              {getTestAreaLabel(testMode.area)} · {getTestPositionLabel(testMode.position)}
            </span>
            <HeaderTextButton
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new Event('ui-test-mode-open'));
                }
              }}
            >
              {tr('تغيير', 'Change')}
            </HeaderTextButton>
            <HeaderTextButton onClick={exitTestMode}>
              {tr('خروج', 'Exit')}
            </HeaderTextButton>
          </div>
        )}

        {/* Theme toggle */}
        <HeaderIconButton onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </HeaderIconButton>

        {/* Language toggle */}
        <HeaderIconButton
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          title="Toggle language"
        >
          <Languages className="h-4 w-4" />
        </HeaderIconButton>

        {/* Switch Platform */}
        {user && (
          <HeaderTextButton onClick={() => router.push('/platforms')}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{tr('تبديل', 'Switch')}</span>
          </HeaderTextButton>
        )}

        {/* Owner */}
        {isOwner && (
          <HeaderTextButton onClick={() => router.push('/owner')}>
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{tr('المالك', 'Owner')}</span>
          </HeaderTextButton>
        )}

        {/* Admin (non-owner) */}
        {isAdmin && !isOwner && (
          <HeaderTextButton onClick={() => router.push('/admin')}>
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{tr('الإدارة', 'Admin')}</span>
          </HeaderTextButton>
        )}

        {/* User chip */}
        {user && (
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-full">
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                background: THEA_UI.bg.muted,
              }}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-medium text-foreground truncate" style={{ maxWidth: 120 }}>
                {user.firstName} {user.lastName}
              </div>
              <div className="text-xs text-muted-foreground capitalize truncate" style={{ maxWidth: 120 }}>
                {roleMap[user.role] || user.role}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <HeaderTextButton onClick={handleLogout}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{tr('تسجيل الخروج', 'Logout')}</span>
        </HeaderTextButton>
      </div>
    </header>
  );
}

// ── Shared button primitives (local) ──

function HeaderIconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent thea-transition-fast"
      style={{
        width: 38,
        height: 38,
      }}
    >
      {children}
    </button>
  );
}

function HeaderTextButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-accent thea-transition-fast border-border"
      style={{
        height: 34,
        padding: '0 10px',
        fontSize: THEA_UI.font.size.md,
      }}
    >
      {children}
    </button>
  );
}
