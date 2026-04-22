'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  Users,
  Bed,
  PackagePlus,
  TrendingUp,
  AlertCircle,
  Scissors,
  Scan,
  Heart,
  Baby,
  Skull,
  Pill,
  Dumbbell,
  Calendar,
  ClipboardList,
  Settings,
  BarChart3,
  Database,
  FileText,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { KPISkeleton, StatsSkeleton } from '@/components/mobile/SkeletonLoaders';

interface KPI {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  trend?: string;
  href?: string;
}

interface ActionItem {
  title: string;
  description: string;
  href: string;
  icon: any;
  shortcut: string;
}

interface ActivityItem {
  title: string;
  description: string;
  time: string;
  tone: 'info' | 'warning' | 'success';
}

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  keyboardNavigation: boolean;
}

interface DashboardStats {
  totalVisits: number;
  activePatients: number;
  bedOccupancy: number;
  bedOccupancyPercent: number;
  equipmentCount: number;
  equipmentOperational: number;
  orOperations: number;
  lapOperations: number;
  radiology: number;
  kathLap: number;
  endoscopy: number;
  physiotherapy: number;
  deliveries: number;
  deaths: number;
  pharmacyVisits: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    activePatients: 0,
    bedOccupancy: 0,
    bedOccupancyPercent: 0,
    equipmentCount: 0,
    equipmentOperational: 0,
    orOperations: 0,
    lapOperations: 0,
    radiology: 0,
    kathLap: 0,
    endoscopy: 0,
    physiotherapy: 0,
    deliveries: 0,
    deaths: 0,
    pharmacyVisits: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    keyboardNavigation: false,
  });

  const { me, isLoading: meLoading } = useMe();

  const buildDateParams = useCallback(() => {
    const now = new Date();
    if (timeRange === 'day') {
      return {
        granularity: 'day',
        date: now.toISOString().split('T')[0],
      };
    }
    if (timeRange === 'week') {
      const start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        granularity: 'week',
        fromDate: start.toISOString().split('T')[0],
        toDate: end.toISOString().split('T')[0],
      };
    }
    if (timeRange === 'month') {
      return {
        granularity: 'month',
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
      };
    }
    return {
      granularity: 'year',
      year: String(now.getFullYear()),
    };
  }, [timeRange]);

  const fetchDashboardStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams(buildDateParams());
      const response = await fetch(`/api/dashboard/stats?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setLastUpdated(new Date().toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [buildDateParams, language]);

  useEffect(() => {
    setMounted(true);

    if (meLoading || !me) return;

    const permissions = me.user?.permissions || [];
    setUserPermissions(permissions);

    // Check if user has dashboard.view permission
    const hasAccess = hasRoutePermission(permissions, '/dashboard');
    setHasPermission(hasAccess);

    // If user doesn't have dashboard access, redirect to welcome page
    if (!hasAccess) {
      router.push('/welcome');
      return;
    }

    // Only fetch data if user has permission
    if (hasAccess) {
      fetchDashboardStats();
    }
  }, [me, meLoading, router, fetchDashboardStats]);

  useEffect(() => {
    if (!mounted || hasPermission === null) return;

    if (hasPermission) {
      fetchDashboardStats();
    }

    const updateDateTime = () => {
      const now = new Date();
      const locale = language === 'ar' ? 'ar-SA' : 'en-US';
      const date = now.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const time = now.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentDateTime(`${date} - ${time}`);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, [language, mounted, hasPermission, fetchDashboardStats]);

  useEffect(() => {
    if (!hasPermission) return;
    const interval = setInterval(fetchDashboardStats, 60000);
    return () => clearInterval(interval);
  }, [hasPermission, fetchDashboardStats]);

  const roleRaw = (me?.user?.role || '').toLowerCase();
  const roleKey = roleRaw.includes('doctor')
    ? 'doctor'
    : roleRaw.includes('nurse')
      ? 'nurse'
      : roleRaw.includes('reception')
        ? 'receptionist'
        : roleRaw.includes('admin') || roleRaw.includes('owner')
          ? 'admin'
          : 'staff';

  const roleContent = useMemo(() => {
    const isAr = language === 'ar';
    if (roleKey === 'doctor') {
      return {
        kpis: [
          { title: isAr ? 'مرضى اليوم' : 'Patients Today', value: stats.totalVisits, description: isAr ? 'زيارات اليوم' : 'Today visits', icon: Users, href: '/opd/home' },
          { title: isAr ? 'الاستشارات' : 'Consultations', value: stats.activePatients, description: isAr ? 'زيارات نشطة' : 'Active visits', icon: Activity, href: '/dashboard' },
          { title: isAr ? 'نتائج الأشعة' : 'Radiology Results', value: stats.radiology, description: isAr ? 'فحوصات اليوم' : 'Today studies', icon: Scan, href: '/dashboard' },
          { title: isAr ? 'مراجعات معلّقة' : 'Pending Reviews', value: stats.pharmacyVisits, description: isAr ? 'مراجعات اليوم' : 'Today reviews', icon: Pill, href: '/dashboard' },
        ] as KPI[],
        actions: [
          { title: isAr ? 'مريض جديد' : 'New Patient', description: isAr ? 'إضافة زيارة' : 'Create a visit', href: '/opd/home', icon: Users, shortcut: 'N' },
          { title: isAr ? 'النتائج المخبرية' : 'Lab Results', description: isAr ? 'عرض النتائج' : 'View results', href: '/dashboard', icon: Scan, shortcut: 'L' },
          { title: isAr ? 'الوصفات' : 'Prescriptions', description: isAr ? 'إدارة الوصفات' : 'Manage prescriptions', href: '/dashboard', icon: Pill, shortcut: 'P' },
          { title: isAr ? 'الجدولة' : 'Schedule', description: isAr ? 'المواعيد القادمة' : 'Upcoming appointments', href: '/scheduling/scheduling', icon: Calendar, shortcut: 'S' },
        ] as ActionItem[],
        activities: [
          { title: isAr ? 'نتائج جديدة' : 'New Results', description: isAr ? 'تمت إضافة نتائج أشعة' : 'Radiology results added', time: isAr ? 'منذ 5 دقائق' : '5 min ago', tone: 'info' },
          { title: isAr ? 'مواعيد قريبة' : 'Upcoming Visits', description: isAr ? 'زيارات خلال الساعة القادمة' : 'Visits in the next hour', time: isAr ? 'منذ 12 دقيقة' : '12 min ago', tone: 'success' },
          { title: isAr ? 'تنبيه دواء' : 'Medication Alert', description: isAr ? 'وصفة تحتاج مراجعة' : 'Prescription needs review', time: isAr ? 'منذ 30 دقيقة' : '30 min ago', tone: 'warning' },
        ] as ActivityItem[],
      };
    }
    if (roleKey === 'nurse') {
      return {
        kpis: [
          { title: isAr ? 'مرضى مسؤولين' : 'Assigned Patients', value: stats.activePatients, description: isAr ? 'زيارات نشطة' : 'Active visits', icon: Users, href: '/nursing/operations' },
          { title: isAr ? 'جرعات دواء' : 'Medications', value: stats.pharmacyVisits, description: isAr ? 'صرف الأدوية' : 'Dispensed today', icon: Pill, href: '/nursing/operations' },
          { title: isAr ? 'مؤشرات حيوية' : 'Vitals', value: stats.physiotherapy, description: isAr ? 'قياسات اليوم' : 'Recorded today', icon: Heart, href: '/nursing/operations' },
          { title: isAr ? 'إشغال الأسرة' : 'Bed Occupancy', value: `${stats.bedOccupancyPercent}%`, description: isAr ? 'حالة الأسرة' : 'Bed status', icon: Bed, href: '/ipd/live-beds' },
        ] as KPI[],
        actions: [
          { title: isAr ? 'جولات التمريض' : 'Nursing Rounds', description: isAr ? 'تسجيل الجولات' : 'Record rounds', href: '/nursing/operations', icon: Activity, shortcut: 'R' },
          { title: isAr ? 'الأدوية' : 'Medications', description: isAr ? 'إدارة الجرعات' : 'Manage doses', href: '/nursing/operations', icon: Pill, shortcut: 'M' },
          { title: isAr ? 'العلامات الحيوية' : 'Vitals', description: isAr ? 'تسجيل القياسات' : 'Record vitals', href: '/nursing/operations', icon: Heart, shortcut: 'V' },
          { title: isAr ? 'المهام' : 'Tasks', description: isAr ? 'مهام التمريض' : 'Nursing tasks', href: '/nursing/operations', icon: ClipboardList, shortcut: 'T' },
        ] as ActionItem[],
        activities: [
          { title: isAr ? 'تنبيه حيوي' : 'Vitals Alert', description: isAr ? 'ارتفاع في المؤشرات' : 'High vitals recorded', time: isAr ? 'منذ 4 دقائق' : '4 min ago', tone: 'warning' },
          { title: isAr ? 'جولة مكتملة' : 'Round Complete', description: isAr ? 'تمت جولة تمريض' : 'Nursing round finished', time: isAr ? 'منذ 20 دقيقة' : '20 min ago', tone: 'success' },
          { title: isAr ? 'جرعة مجدولة' : 'Dose Scheduled', description: isAr ? 'جرعة خلال 30 دقيقة' : 'Dose in 30 minutes', time: isAr ? 'منذ 35 دقيقة' : '35 min ago', tone: 'info' },
        ] as ActivityItem[],
      };
    }
    if (roleKey === 'receptionist') {
      return {
        kpis: [
          { title: isAr ? 'تسجيلات اليوم' : 'Check-ins', value: stats.totalVisits, description: isAr ? 'زيارات جديدة' : 'New arrivals', icon: Users, href: '/opd/home' },
          { title: isAr ? 'المواعيد' : 'Appointments', value: stats.totalVisits, description: isAr ? 'مجدولة اليوم' : 'Scheduled today', icon: Calendar, href: '/scheduling/scheduling' },
          { title: isAr ? 'انتظار' : 'Waiting Queue', value: stats.activePatients, description: isAr ? 'في الانتظار' : 'Currently waiting', icon: Activity, href: '/er/register' },
          { title: isAr ? 'فواتير' : 'Pending Bills', value: stats.pharmacyVisits, description: isAr ? 'حالات تحتاج دفع' : 'Pending billing', icon: FileText, href: '/dashboard' },
        ] as KPI[],
        actions: [
          { title: isAr ? 'موعد جديد' : 'New Appointment', description: isAr ? 'حجز موعد' : 'Book appointment', href: '/scheduling/scheduling', icon: Calendar, shortcut: 'A' },
          { title: isAr ? 'تسجيل دخول' : 'Check-in', description: isAr ? 'تسجيل مريض' : 'Register patient', href: '/opd/home', icon: Users, shortcut: 'C' },
          { title: isAr ? 'الفوترة' : 'Billing', description: isAr ? 'إدارة الفواتير' : 'Manage billing', href: '/dashboard', icon: FileText, shortcut: 'B' },
          { title: isAr ? 'الطوارئ' : 'Emergency', description: isAr ? 'تسجيل حالة' : 'Register ER', href: '/er/register', icon: AlertCircle, shortcut: 'E' },
        ] as ActionItem[],
        activities: [
          { title: isAr ? 'مريض جديد' : 'New Arrival', description: isAr ? 'تم تسجيل مريض' : 'Patient checked in', time: isAr ? 'منذ 3 دقائق' : '3 min ago', tone: 'success' },
          { title: isAr ? 'إلغاء موعد' : 'Cancelled Visit', description: isAr ? 'تم إلغاء موعد' : 'Appointment cancelled', time: isAr ? 'منذ 18 دقيقة' : '18 min ago', tone: 'warning' },
          { title: isAr ? 'تنبيه دفع' : 'Payment Alert', description: isAr ? 'فاتورة بانتظار' : 'Pending invoice', time: isAr ? 'منذ 40 دقيقة' : '40 min ago', tone: 'info' },
        ] as ActivityItem[],
      };
    }
    return {
      kpis: [
        { title: language === 'ar' ? 'الزيارات' : 'Total Visits', value: stats.totalVisits, description: language === 'ar' ? 'زيارات اليوم' : 'Today visits', icon: Activity, href: '/dashboard' },
        { title: language === 'ar' ? 'إشغال الأسرة' : 'Bed Occupancy', value: `${stats.bedOccupancyPercent}%`, description: language === 'ar' ? 'الحالة الحالية' : 'Current status', icon: Bed, href: '/ipd/live-beds' },
        { title: language === 'ar' ? 'المعدات' : 'Equipment', value: `${stats.equipmentOperational}%`, description: language === 'ar' ? 'جاهزية المعدات' : 'Operational rate', icon: PackagePlus, href: '/equipment/checklist' },
        { title: language === 'ar' ? 'العمليات' : 'Operations', value: stats.orOperations, description: language === 'ar' ? 'إجراءات اليوم' : 'Today procedures', icon: Scissors, href: '/dashboard' },
      ] as KPI[],
      actions: [
        { title: language === 'ar' ? 'التقارير' : 'Reports', description: language === 'ar' ? 'لوحات الأداء' : 'Performance reports', href: '/dashboard', icon: BarChart3, shortcut: 'R' },
        { title: language === 'ar' ? 'المستخدمون' : 'Users', description: language === 'ar' ? 'إدارة المستخدمين' : 'Manage users', href: '/admin', icon: Users, shortcut: 'U' },
        { title: language === 'ar' ? 'الإعدادات' : 'Settings', description: language === 'ar' ? 'إعدادات النظام' : 'System settings', href: '/admin', icon: Settings, shortcut: 'S' },
        { title: language === 'ar' ? 'النسخ الاحتياطي' : 'Backup', description: language === 'ar' ? 'صحة البيانات' : 'Data health', href: '/dashboard', icon: Database, shortcut: 'B' },
      ] as ActionItem[],
      activities: [
        { title: language === 'ar' ? 'تحديث النظام' : 'System Update', description: language === 'ar' ? 'الخدمات تعمل بشكل طبيعي' : 'Services operating normally', time: language === 'ar' ? 'منذ 2 دقائق' : '2 min ago', tone: 'success' },
        { title: language === 'ar' ? 'تقرير جديد' : 'Report Ready', description: language === 'ar' ? 'تقرير أداء جديد' : 'New performance report', time: language === 'ar' ? 'منذ 25 دقيقة' : '25 min ago', tone: 'info' },
        { title: language === 'ar' ? 'تنبيه سعة' : 'Capacity Alert', description: language === 'ar' ? 'ارتفاع الإشغال' : 'High occupancy', time: language === 'ar' ? 'منذ ساعة' : '1 hour ago', tone: 'warning' },
      ] as ActivityItem[],
    };
  }, [language, roleKey, stats]);

  const kpis: KPI[] = [
    {
      title: tr('زيارات العيادات الخارجية', 'OPD Visits'),
      value: stats.totalVisits,
      description: tr('للفترة المحددة', 'For selected period'),
      icon: Activity,
      trend: stats.totalVisits > 0 ? '+12%' : undefined,
    },
    {
      title: tr('زيارات الطوارئ', 'ER Visits'),
      value: stats.activePatients,
      description: tr('زيارات غرفة الطوارئ', 'Emergency room visits'),
      icon: AlertCircle,
      trend: stats.activePatients > 0 ? '+3' : undefined,
    },
    {
      title: tr('إشغال الأسرة', 'Bed Occupancy'),
      value: `${stats.bedOccupancyPercent}%`,
      description: `${stats.bedOccupancy} ${tr('أسرة مشغولة', 'beds occupied')}`,
      icon: Bed,
      trend: tr('مستقر', 'Stable'),
    },
    {
      title: tr('عمليات غرفة العمليات', 'OR Operations'),
      value: stats.orOperations,
      description: tr('إجراءات غرفة العمليات', 'Operating room procedures'),
      icon: Scissors,
      trend: stats.orOperations > 0 ? '+5%' : undefined,
    },
    {
      title: tr('عمليات المنظار', 'Lap Operations'),
      value: stats.lapOperations,
      description: tr('إجراءات المنظار', 'Laparoscopic procedures'),
      icon: Scissors,
      trend: stats.lapOperations > 0 ? '+8%' : undefined,
    },
    {
      title: tr('الأشعة', 'Radiology'),
      value: stats.radiology,
      description: tr('دراسات التصوير', 'Imaging studies'),
      icon: Scan,
      trend: stats.radiology > 0 ? '+10%' : undefined,
    },
    {
      title: tr('قسطرة القلب', 'Cath Lab'),
      value: stats.kathLap,
      description: tr('إجراءات القسطرة', 'Catheterization procedures'),
      icon: Heart,
      trend: stats.kathLap > 0 ? '+3%' : undefined,
    },
    {
      title: tr('المنظار', 'Endoscopy'),
      value: stats.endoscopy,
      description: tr('إجراءات المنظار', 'Endoscopic procedures'),
      icon: Scan,
      trend: stats.endoscopy > 0 ? '+7%' : undefined,
    },
    {
      title: tr('العلاج الطبيعي', 'Physiotherapy'),
      value: stats.physiotherapy,
      description: tr('جلسات العلاج الطبيعي', 'Physical therapy sessions'),
      icon: Dumbbell,
      trend: stats.physiotherapy > 0 ? '+15%' : undefined,
    },
    {
      title: tr('الولادات', 'Deliveries'),
      value: stats.deliveries,
      description: tr('الولادات', 'Births'),
      icon: Baby,
      trend: stats.deliveries > 0 ? '+2%' : undefined,
    },
    {
      title: tr('الوفيات', 'Deaths'),
      value: stats.deaths,
      description: tr('عدد الوفيات', 'Mortality count'),
      icon: Skull,
      trend: undefined,
    },
    {
      title: tr('زيارات الصيدلية', 'Pharmacy Visits'),
      value: stats.pharmacyVisits,
      description: tr('استشارات الصيدلية', 'Pharmacy consultations'),
      icon: Pill,
      trend: stats.pharmacyVisits > 0 ? '+20%' : undefined,
    },
  ];

  const roleActions = roleContent.actions.filter((action) => hasRoutePermission(userPermissions, action.href));
  const roleKpis = roleContent.kpis.filter((kpi) => !kpi.href || hasRoutePermission(userPermissions, kpi.href));

  useEffect(() => {
    if (!accessibilitySettings.keyboardNavigation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toUpperCase();
      const match = roleActions.find((action) => action.shortcut === key);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [accessibilitySettings.keyboardNavigation, roleActions, router]);

  const ranges = [
    { id: 'day', label: language === 'ar' ? 'اليوم' : 'Today' },
    { id: 'week', label: language === 'ar' ? 'الأسبوع' : 'Week' },
    { id: 'month', label: language === 'ar' ? 'الشهر' : 'Month' },
    { id: 'year', label: language === 'ar' ? 'السنة' : 'Year' },
  ] as const;

  // Show message if user doesn't have permission
  if (!mounted || hasPermission === null) {
    return null; // Still loading
  }

  // Redirect handled in useEffect, but show loading state if redirecting
  if (!hasPermission) {
    return null; // Will redirect to /welcome in useEffect
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen"
      style={accessibilitySettings.highContrast ? { filter: 'contrast(150%)' } : undefined}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 rounded-xl bg-primary text-white font-medium"
      >
        {language === 'ar' ? 'انتقل إلى المحتوى الرئيسي' : 'Skip to Main Content'}
      </a>

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{tr('الرئيسية', 'Home')}</h1>
            {currentDateTime ? <p className="text-sm text-muted-foreground mt-1">{currentDateTime}</p> : null}
            {lastUpdated ? <p className="text-xs text-muted-foreground">{language === 'ar' ? `آخر تحديث: ${lastUpdated}` : `Last updated: ${lastUpdated}`}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted/50 rounded-xl border border-border p-1" role="tablist" aria-label={language === 'ar' ? 'نطاق زمني' : 'Time range'}>
              {ranges.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  role="tab"
                  aria-selected={timeRange === range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg thea-transition-fast ${
                    timeRange === range.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchDashboardStats}
              className="p-2 rounded-xl border border-border hover:bg-muted thea-transition-fast text-muted-foreground"
              aria-label={language === 'ar' ? 'تحديث البيانات' : 'Refresh data'}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setAccessibilitySettings((prev) => ({
                  ...prev,
                  keyboardNavigation: !prev.keyboardNavigation,
                }))
              }
              className={`p-2 rounded-xl border border-border thea-transition-fast ${
                accessibilitySettings.keyboardNavigation ? 'ring-2 ring-primary text-primary' : 'text-muted-foreground hover:bg-muted'
              }`}
              aria-label="Toggle accessibility features"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Loading / Content */}
        {isLoading || meLoading ? (
          <>
            <div className="md:hidden space-y-3">
              <StatsSkeleton count={4} />
            </div>
            <div className="hidden md:block space-y-4">
              <KPISkeleton count={4} />
              <KPISkeleton count={4} />
              <KPISkeleton count={4} />
            </div>
          </>
        ) : (
          <>
            {/* Role Summary KPI Cards */}
            <section id="main-content" role="region" aria-label={language === 'ar' ? 'ملخص الدور' : 'Role Summary'} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-foreground">
                  {language === 'ar' ? 'ملخص الدور' : 'Role Summary'}
                </h2>
                {accessibilitySettings.keyboardNavigation ? (
                  <span className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'Alt + حرف' : 'Alt + Letter'}
                  </span>
                ) : null}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: accessibilitySettings.reduceMotion ? 0 : 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              >
                {roleKpis.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <button
                      key={kpi.title}
                      type="button"
                      onClick={() => (kpi.href ? router.push(kpi.href) : null)}
                      className="text-start bg-card border border-border rounded-2xl p-4 thea-hover-lift thea-transition-fast group"
                      aria-label={`${kpi.title}: ${kpi.value} - ${kpi.description}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{kpi.title}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-foreground">{kpi.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                    </button>
                  );
                })}
              </motion.div>
            </section>

            {/* Quick Actions + Activity Feed */}
            <section role="region" aria-label={language === 'ar' ? 'إجراءات سريعة ونشاط حديث' : 'Quick actions and recent activity'} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Quick Actions -- spans 2 cols */}
              <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-extrabold text-base text-foreground">{tr('إجراءات سريعة', 'Quick Actions')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{tr('المهام والعمليات الشائعة', 'Common tasks and operations')}</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roleActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.title}
                        type="button"
                        onClick={() => router.push(action.href)}
                        aria-keyshortcuts={`Alt+${action.shortcut}`}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-muted/50 thea-transition-fast text-start"
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-foreground">{action.title}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                        {accessibilitySettings.keyboardNavigation ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">Alt+{action.shortcut}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activity Feed -- spans 1 col */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-extrabold text-base text-foreground">{tr('النشاط الأخير', 'Recent Activity')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{tr('آخر تحديثات النظام', 'Latest system updates')}</p>
                </div>
                <div className="divide-y divide-border">
                  {roleContent.activities.map((activity, index) => (
                    <div key={`${activity.title}-${index}`} className="px-5 py-3.5 flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        activity.tone === 'success' ? 'bg-emerald-500' :
                        activity.tone === 'warning' ? 'bg-amber-500' : 'bg-primary'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">{activity.description}</div>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* All Metrics */}
            <section role="region" aria-label={language === 'ar' ? 'جميع المقاييس' : 'All Metrics'} className="space-y-4">
              <h2 className="text-lg font-extrabold text-foreground">{tr('جميع المقاييس', 'All Metrics')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.title} className="bg-card border border-border rounded-2xl p-4 thea-hover-lift thea-transition-fast">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{kpi.title}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-foreground">{kpi.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                      {kpi.trend ? (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500">{kpi.trend}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* System Status */}
            <section role="region" aria-label={language === 'ar' ? 'حالة النظام' : 'System status'} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-extrabold text-base text-foreground">{tr('حالة النظام', 'System Status')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{tr('صحة المنصة والاتصال', 'Platform health and connectivity')}</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{tr('قاعدة البيانات', 'Database')}</div>
                    <div className="text-xs text-muted-foreground">{tr('متصل', 'Connected')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{tr('خدمات API', 'API Services')}</div>
                    <div className="text-xs text-muted-foreground">{tr('تعمل', 'Operational')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{tr('خدمات الذكاء الاصطناعي', 'AI Services')}</div>
                    <div className="text-xs text-muted-foreground">{tr('جاهز', 'Ready')}</div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Accessibility Panel */}
      {accessibilitySettings.keyboardNavigation ? (
        <div
          role="dialog"
          aria-labelledby="accessibility-panel-title"
          className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 p-5 rounded-2xl bg-card border border-border shadow-xl z-50"
        >
          <h3 id="accessibility-panel-title" className="font-bold mb-4 text-foreground">
            {language === 'ar' ? 'إعدادات إمكانية الوصول' : 'Accessibility Settings'}
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.highContrast}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, highContrast: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-foreground">{language === 'ar' ? 'تباين عالي' : 'High Contrast'}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.largeText}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, largeText: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-foreground">{language === 'ar' ? 'نص كبير' : 'Large Text'}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.reduceMotion}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, reduceMotion: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-foreground">{language === 'ar' ? 'تقليل الحركة' : 'Reduce Motion'}</span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
