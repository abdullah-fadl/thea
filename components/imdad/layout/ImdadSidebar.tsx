'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  ShieldCheck,
  DollarSign,
  BarChart3,
  Wrench,
  Stethoscope,
  Truck,
  FileText,
  Settings,
  Network,
  Inbox,
  Users,
  AlertTriangle,
  ClipboardList,
  Activity,
  Boxes,
  PackageSearch,
  Receipt,
  TrendingUp,
  Target,
  Layers,
  Building2,
  Siren,
  LineChart,
  ArrowLeftRight,
  Heart,
} from 'lucide-react';

interface NavItem {
  label: { ar: string; en: string };
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
  badge?: string;
}

const NAV_SECTIONS: NavItem[] = [
  {
    label: { ar: 'لوحة التحكم', en: 'Dashboard' },
    href: '/imdad',
    icon: LayoutDashboard,
  },
  {
    label: { ar: 'المخزون', en: 'Inventory' },
    icon: Package,
    children: [
      { label: { ar: 'نظرة عامة', en: 'Overview' }, href: '/imdad/inventory', icon: Boxes },
      { label: { ar: 'كتالوج الأصناف', en: 'Item Catalog' }, href: '/imdad/inventory/catalog', icon: PackageSearch },
      { label: { ar: 'مستويات المخزون', en: 'Stock Levels' }, href: '/imdad/inventory/levels', icon: BarChart3 },
      { label: { ar: 'التتبع والأثر', en: 'Trace & Track' }, href: '/imdad/trace', icon: Activity },
    ],
  },
  {
    label: { ar: 'المشتريات', en: 'Procurement' },
    icon: ShoppingCart,
    children: [
      { label: { ar: 'نظرة عامة', en: 'Overview' }, href: '/imdad/procurement', icon: ClipboardList },
      { label: { ar: 'الطلبات', en: 'Requests' }, href: '/imdad/requests', icon: FileText },
      { label: { ar: 'الموافقات', en: 'Approvals' }, href: '/imdad/approvals', icon: ShieldCheck },
      { label: { ar: 'أوامر الشراء', en: 'Purchase Orders' }, href: '/imdad/procurement/orders', icon: Receipt },
      { label: { ar: 'شبكة الموردين', en: 'Supplier Network' }, href: '/imdad/network', icon: Network },
    ],
  },
  {
    label: { ar: 'المستودعات', en: 'Warehouse' },
    icon: Warehouse,
    children: [
      { label: { ar: 'نظرة عامة', en: 'Overview' }, href: '/imdad/warehouse', icon: Building2 },
      { label: { ar: 'الاستلام', en: 'Receiving' }, href: '/imdad/warehouse/receiving', icon: Truck },
      { label: { ar: 'التحويلات', en: 'Transfers' }, href: '/imdad/warehouse/transfers', icon: ArrowLeftRight },
      { label: { ar: 'المخزون بالجملة', en: 'Bulk Operations' }, href: '/imdad/bulk', icon: Layers },
    ],
  },
  {
    label: { ar: 'الجودة', en: 'Quality' },
    icon: ShieldCheck,
    children: [
      { label: { ar: 'فحص الجودة', en: 'Quality Control' }, href: '/imdad/quality', icon: ShieldCheck },
      { label: { ar: 'التقارير', en: 'Reports' }, href: '/imdad/quality/reports', icon: FileText },
    ],
  },
  {
    label: { ar: 'المالية', en: 'Financial' },
    icon: DollarSign,
    children: [
      { label: { ar: 'نظرة عامة', en: 'Overview' }, href: '/imdad/financial', icon: TrendingUp },
      { label: { ar: 'حوكمة الميزانية', en: 'Budget Governance' }, href: '/imdad/budget-governance', icon: Target },
    ],
  },
  {
    label: { ar: 'التحليلات', en: 'Analytics' },
    icon: BarChart3,
    children: [
      { label: { ar: 'لوحة التحليلات', en: 'Analytics Dashboard' }, href: '/imdad/analytics', icon: LineChart },
      { label: { ar: 'التقارير', en: 'Reports' }, href: '/imdad/reports', icon: FileText },
      { label: { ar: 'التصدير', en: 'Export' }, href: '/imdad/export', icon: FileText },
    ],
  },
  {
    label: { ar: 'الأصول', en: 'Assets' },
    icon: Wrench,
    children: [
      { label: { ar: 'إدارة الأصول', en: 'Asset Management' }, href: '/imdad/assets', icon: Wrench },
    ],
  },
  {
    label: { ar: 'السريري', en: 'Clinical' },
    icon: Stethoscope,
    children: [
      { label: { ar: 'الإمداد السريري', en: 'Clinical Supply' }, href: '/imdad/clinical', icon: Heart },
      { label: { ar: 'التكاملات', en: 'Integrations' }, href: '/imdad/integrations', icon: Layers },
    ],
  },
  {
    label: { ar: 'العمليات', en: 'Operations' },
    icon: Activity,
    children: [
      { label: { ar: 'مركز القيادة', en: 'Command Center' }, href: '/imdad/command-center', icon: Siren },
      { label: { ar: 'غرفة العمليات', en: 'War Room' }, href: '/imdad/war-room', icon: Target },
      { label: { ar: 'المحاكاة', en: 'Simulation' }, href: '/imdad/simulation', icon: Activity },
      { label: { ar: 'القرارات', en: 'Decisions' }, href: '/imdad/decisions', icon: ClipboardList },
    ],
  },
  {
    label: { ar: 'صندوق الوارد', en: 'Inbox' },
    href: '/imdad/inbox',
    icon: Inbox,
  },
  {
    label: { ar: 'الإشعارات', en: 'Notifications' },
    href: '/imdad/notifications',
    icon: AlertTriangle,
  },
  {
    label: { ar: 'عملياتي', en: 'My Operations' },
    href: '/imdad/my-operations',
    icon: Users,
  },
  {
    label: { ar: 'أعمالي', en: 'My Work' },
    href: '/imdad/my-work',
    icon: ClipboardList,
  },
  {
    label: { ar: 'الموظفين', en: 'Staff' },
    href: '/imdad/staff',
    icon: Users,
  },
  {
    label: { ar: 'الإعدادات', en: 'Settings' },
    href: '/imdad/settings',
    icon: Settings,
  },
];

export default function ImdadSidebar() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === '/imdad') return pathname === '/imdad';
    return pathname.startsWith(href);
  };

  const isChildActive = (item: NavItem) => {
    return item.children?.some((child) => isActive(child.href)) ?? false;
  };

  return (
    <aside
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className={cn(
        'flex h-full flex-col border-e border-gray-200 bg-white transition-all duration-200 dark:border-gray-700 dark:bg-gray-900',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" />
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {tr('إمداد', 'IMDAD')}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
          title={tr('طي/توسيع', 'Collapse/Expand')}
        >
          {language === 'ar' ? (
            collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      {/* @ts-expect-error - ScrollArea prop types mismatch */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV_SECTIONS.map((item) => {
            const key = item.label.en;
            const Icon = item.icon;
            const expanded = expandedSections.has(key) || isChildActive(item);
            const active = isActive(item.href);

            // Top-level link (no children)
            if (!item.children) {
              return (
                <Link
                  key={key}
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  )}
                  title={collapsed ? (language === 'ar' ? item.label.ar : item.label.en) : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="truncate">
                      {language === 'ar' ? item.label.ar : item.label.en}
                    </span>
                  )}
                  {item.badge && !collapsed && (
                    <Badge variant="secondary" className="ms-auto text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            }

            // Collapsible section
            return (
              <div key={key}>
                <button
                  onClick={() => toggleSection(key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isChildActive(item)
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  )}
                  title={collapsed ? (language === 'ar' ? item.label.ar : item.label.en) : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-start">
                        {language === 'ar' ? item.label.ar : item.label.en}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 transition-transform',
                          expanded && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </button>

                {/* Children */}
                {expanded && !collapsed && (
                  <div className="ms-4 mt-0.5 flex flex-col gap-0.5 border-s border-gray-200 ps-3 dark:border-gray-700">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isActive(child.href);
                      return (
                        <Link
                          key={child.label.en}
                          href={child.href!}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                            childActive
                              ? 'bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {language === 'ar' ? child.label.ar : child.label.en}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {tr('منصة إمداد لسلسلة الإمداد', 'IMDAD Supply Chain Platform')}
          </p>
        </div>
      )}
    </aside>
  );
}
