'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Stethoscope,
  Activity,
  Heart,
  FileText,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/hooks/useMe';
import { hasRoutePermission } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  badge?: number;
  requiredPermission?: string;
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', requiredPermission: 'dashboard.view' },
  { href: '/registration', icon: ClipboardList, labelKey: 'nav.registration', requiredPermission: 'registration.view' },
  { href: '/opd/home', icon: Stethoscope, labelKey: 'nav.opdDashboard', requiredPermission: 'opd.dashboard.view' },
  { href: '/er/nursing', icon: Activity, labelKey: 'nav.nursingOperations', requiredPermission: 'nursing.operations.view' },
  { href: '/quality/kpis', icon: Heart, labelKey: 'nav.patientExperience', requiredPermission: 'px.dashboard.view' },
  { href: '/sam/library', icon: FileText, labelKey: 'nav.library', requiredPermission: 'policies.view' },
  { href: '/admin', icon: Settings, labelKey: 'nav.admin', requiredPermission: 'admin.users.view' },
  { href: '/account', icon: User, labelKey: 'nav.account', requiredPermission: 'account.view' },
];

const priorityOrder = [
  '/dashboard',
  '/registration',
  '/opd/home',
  '/er/nursing',
  '/quality/kpis',
  '/sam/library',
  '/account',
  '/admin',
];

export function TheaMobileBottomNav() {
  const pathname = usePathname();
  const { me } = useMe();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [unreadCount, setUnreadCount] = useState(0);

  // Notification polling
  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const response = await fetch('/api/notifications?unread=1&limit=1', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        } else if (response.status === 401) {
          setUnreadCount(0);
        }
      } catch { /* silent */ }
    }
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Permission filtering
  const userPermissions = me?.user?.permissions || [];
  const userRole = me?.user?.role || '';
  const isOwnerRole = userRole === 'thea-owner';

  const visibleNavItems = isOwnerRole
    ? allNavItems
    : allNavItems.filter((item) => {
        if (!item.requiredPermission) return true;
        return hasRoutePermission(userPermissions, item.href);
      });

  // Sort by priority + limit to 5
  const sortedItems = [...visibleNavItems].sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.href);
    const bIndex = priorityOrder.indexOf(b.href);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const mainNavItems = sortedItems.slice(0, 5);

  // Nav label translations
  const navLabels: Record<string, string> = {
    'nav.dashboard': tr('لوحة المعلومات', 'Dashboard'),
    'nav.registration': tr('التسجيل', 'Registration'),
    'nav.opdDashboard': tr('العيادات', 'OPD'),
    'nav.nursingOperations': tr('التمريض', 'Nursing'),
    'nav.patientExperience': tr('تجربة المريض', 'Patient Exp'),
    'nav.library': tr('المكتبة', 'Library'),
    'nav.admin': tr('الإدارة', 'Admin'),
    'nav.account': tr('الحساب', 'Account'),
  };

  function resolveLabel(labelKey: string): string {
    return navLabels[labelKey] || labelKey;
  }

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80',
        'border-t border-border',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 px-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center',
                'flex-1 h-full min-w-0 pt-1',
                'thea-transition-fast active:scale-95',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {/* Icon */}
              <div className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -end-2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* Active dot */}
              {isActive && (
                <span
                  className="absolute bottom-[6px] w-1 h-1 rounded-full"
                  style={{ background: '#1D4ED8' }}
                />
              )}

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] mt-1 truncate w-full text-center',
                  isActive ? 'font-bold' : 'font-medium',
                )}
              >
                {resolveLabel(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
