'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Bell, Menu, Settings, Moon, Sun, Globe, LogOut, Shield, Crown, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { useTheme } from '@/components/ThemeProvider';
import { useUiTestMode } from '@/lib/hooks/useUiTestMode';
import { getTestAreaLabel, getTestPositionLabel } from '@/lib/ui/testMode';
import { getSectionTitle } from '@/lib/thea-ui/helpers/getSectionTitle';
import { THEA_UI } from '@/lib/thea-ui/tokens';
import { useHijriDate } from '@/hooks/use-hijri-date';
import { FocusTrap } from '@/components/a11y/FocusTrap';

interface TheaMobileTopBarProps {
  onMenuClick?: () => void;
  className?: string;
}

export function TheaMobileTopBar({ onMenuClick, className }: TheaMobileTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isRTL, language, setLanguage } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me } = useMe();
  const { theme, setTheme } = useTheme();
  const { state: testMode, reset } = useUiTestMode(me?.tenantId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!settingsOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeSettings(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [settingsOpen, closeSettings]);

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
  const { title, subtitle } = getSectionTitle(pathname, navT);
  const { todayHijri } = useHijriDate();

  const shouldShowBack = pathname !== '/dashboard' && pathname !== '/';

  const handleBack = () => router.back();

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { credentials: 'include', method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  const exitTestMode = () => {
    reset();
    router.push('/welcome');
  };

  const isDark = theme === 'dark';
  const userRole = (me?.user?.role || '').toString();
  const isOwner = userRole === 'thea-owner' || userRole === 'THEA_OWNER';
  const isAdmin = userRole.toLowerCase() === 'admin' && !isOwner;

  return (
    <header
      data-testid="platform-header"
      className={cn(
        'sticky top-0 z-50 flex items-center justify-between h-14 px-3',
        'bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80',
        'border-b border-border thea-safe-top',
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Left: Back button */}
      <div className="flex items-center min-w-[40px]">
        {shouldShowBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted thea-transition-fast active:scale-95"
            aria-label={tr('رجوع', 'Back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Center: Title */}
      <div className="flex-1 text-center truncate px-2">
        <h1 className="text-base font-extrabold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground -mt-0.5">{subtitle}</p>
        )}
        <p className="text-[10px] text-muted-foreground -mt-0.5">{todayHijri}</p>
        {testMode.enabled && testMode.area && testMode.position && (
          <div className="mt-0.5 flex justify-center">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 font-semibold">
              {tr('وضع الاختبار', 'Test Mode') + ' — '}
              {getTestAreaLabel(testMode.area)} • {getTestPositionLabel(testMode.position)}
            </span>
          </div>
        )}
      </div>

      {/* Right: Notification + Settings Dropdown + Menu */}
      <div className="flex items-center min-w-[40px] justify-end gap-1">
        {/* Notification bell */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted thea-transition-fast active:scale-95"
          aria-label={tr('الإشعارات', 'Notifications')}
        >
          <Bell className="h-[18px] w-[18px]" />
        </button>

        {/* Settings dropdown */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center thea-transition-fast active:scale-95',
              settingsOpen
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
            aria-label={tr('الإعدادات', 'Settings')}
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>

          {settingsOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={closeSettings}
              />

              {/* Dropdown */}
              <FocusTrap active={settingsOpen}>
                <div
                  role="menu"
                  aria-label={tr('قائمة الإعدادات', 'Settings menu')}
                  className={cn(
                    'absolute top-full mt-2 z-50 w-44 py-1',
                    'bg-card rounded-2xl shadow-xl border border-border',
                    'thea-animate-slide-up',
                    isRTL ? 'start-0' : 'end-0',
                  )}
                >
                {/* Theme toggle */}
                <button
                  role="menuitem"
                  onClick={() => { setTheme(isDark ? 'light' : 'dark'); closeSettings(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted thea-transition-fast"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>{isDark ? tr('الوضع الفاتح', 'Light Mode') : tr('الوضع الداكن', 'Dark Mode')}</span>
                </button>

                {/* Language toggle */}
                <button
                  role="menuitem"
                  onClick={() => { setLanguage(language === 'ar' ? 'en' : 'ar'); closeSettings(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted thea-transition-fast"
                >
                  <Globe className="h-4 w-4" />
                  <span>{language === 'ar' ? 'English' : 'العربية'}</span>
                </button>

                {/* Owner (المالك) */}
                {isOwner && (
                  <button
                    role="menuitem"
                    onClick={() => { router.push('/owner'); closeSettings(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted thea-transition-fast"
                  >
                    <Crown className="h-4 w-4" />
                    <span>{tr('لوحة المالك', 'Owner')}</span>
                  </button>
                )}

                {/* Admin (غير المالك) */}
                {isAdmin && !isOwner && (
                  <button
                    role="menuitem"
                    onClick={() => { router.push('/admin'); closeSettings(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted thea-transition-fast"
                  >
                    <Shield className="h-4 w-4" />
                    <span>{tr('لوحة الإدارة', 'Admin')}</span>
                  </button>
                )}

                {/* Separator before Logout */}
                <div className="my-1 h-px bg-border" role="separator" />

                {/* Logout */}
                <button
                  role="menuitem"
                  onClick={() => { handleLogout(); closeSettings(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 thea-transition-fast"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{tr('تسجيل الخروج', 'Logout')}</span>
                </button>

                {/* Test mode exit */}
                {testMode.enabled && (
                  <>
                    <div className="my-1 h-px bg-border" role="separator" />
                    <button
                      role="menuitem"
                      onClick={() => { exitTestMode(); closeSettings(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 thea-transition-fast"
                    >
                      <FlaskConical className="h-4 w-4" />
                      <span>{tr('الخروج من وضع الاختبار', 'Exit Test Mode')}</span>
                    </button>
                  </>
                )}
                </div>
              </FocusTrap>
            </>
          )}
        </div>

        {/* Menu button */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted thea-transition-fast active:scale-95"
            aria-label={tr('القائمة', 'Menu')}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}
