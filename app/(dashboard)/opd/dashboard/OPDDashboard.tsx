'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { BarChart3, Building2, UserRound, DoorOpen, Timer, Brain, ClipboardList, CalendarDays, Stethoscope, Hourglass } from 'lucide-react';
import { TimeFilterValue, getAPIParams } from '@/components/TimeFilter';
import DashboardHeader from '@/components/opd/dashboard/DashboardHeader';
import OverviewTab from '@/components/opd/dashboard/OverviewTab';
import DepartmentsTab from '@/components/opd/dashboard/DepartmentsTab';
import DoctorsTab from '@/components/opd/dashboard/DoctorsTab';
import RoomsTab from '@/components/opd/dashboard/RoomsTab';
import TimeAnalysisTab from '@/components/opd/dashboard/TimeAnalysisTab';
import StrategicTab from '@/components/opd/dashboard/StrategicTab';

// ── Tab definitions ──
interface TabDef {
  key: string;
  icon: ReactNode;
  labelAr: string;
  labelEn: string;
  permission?: string;
}

const iconCls = 'h-4 w-4';

const TABS: TabDef[] = [
  { key: 'overview', icon: <BarChart3 className={iconCls} />, labelAr: 'نظرة عامة', labelEn: 'Overview' },
  { key: 'departments', icon: <Building2 className={iconCls} />, labelAr: 'الأقسام', labelEn: 'Departments', permission: 'opd.dashboard.specialties' },
  { key: 'doctors', icon: <UserRound className={iconCls} />, labelAr: 'الأطباء', labelEn: 'Doctors', permission: 'opd.dashboard.doctors' },
  { key: 'rooms', icon: <DoorOpen className={iconCls} />, labelAr: 'العيادات', labelEn: 'Rooms', permission: 'opd.dashboard.rooms' },
  { key: 'timeAnalysis', icon: <Timer className={iconCls} />, labelAr: 'التحليل الزمني', labelEn: 'Time Analysis' },
  { key: 'strategic', icon: <Brain className={iconCls} />, labelAr: 'ذكاء إداري', labelEn: 'Strategic', permission: 'opd.dashboard.strategic' },
];

type TabKey = string;

export default function OPDDashboard() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: isPermissionLoading } = useRoutePermission('/opd/dashboard');
  const { me } = useMe();
  const userPermissions = me?.user?.permissions || [];
  const isAdmin = me?.user?.role === 'admin';

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [filter, setFilter] = useState<TimeFilterValue>({ granularity: 'day', date: today });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Data state
  const [stats, setStats] = useState<any>({ totalVisits: 0, avgUtilization: 0, activeClinics: 0, newPatients: 0, followUpPatients: 0 });
  const [visitTypeBreakdown, setVisitTypeBreakdown] = useState<Record<string, number>>({});
  const [previousPeriod, setPreviousPeriod] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // ── Visible tabs (based on permissions) ──
  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      if (!tab.permission) return true;
      return isAdmin || userPermissions.includes(tab.permission);
    });
  }, [isAdmin, userPermissions]);

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    if (!hasPermission) return;
    setIsLoading(true);
    try {
      const params = getAPIParams(filter);
      const queryString = new URLSearchParams(params).toString();
      const date = params.date || params.fromDate || today;

      let section = 'overview';
      if (activeTab === 'timeAnalysis') section = 'timeAnalysis';
      else if (activeTab === 'strategic') section = 'strategic';
      else if (activeTab !== 'overview') section = 'all';

      const [statsRes, deptRes, analyticsRes] = await Promise.all([
        fetch(`/api/opd/dashboard/stats?${queryString}`, { credentials: 'include' }),
        fetch(`/api/opd/census/detailed?${queryString}`, { credentials: 'include' }),
        fetch(`/api/opd/dashboard/analytics?date=${date}&section=${section}`, { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || {});
        setVisitTypeBreakdown(data.visitTypeBreakdown || {});
        setPreviousPeriod(data.previousPeriod || null);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.departmentStats || []);
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  }, [filter, hasPermission, activeTab, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Auto-refresh (30s when viewing today) ──
  useEffect(() => {
    if (filter.granularity !== 'day' || filter.date !== today) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [filter, today, fetchData]);

  // ── Export handlers ──
  const handleExportPDF = useCallback(async () => {
    if (!isAdmin && !userPermissions.includes('opd.dashboard.export')) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const el = document.getElementById('dashboard-content');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      pdf.save(`opd-dashboard-${today}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  }, [isAdmin, userPermissions, today]);

  const handleExportExcel = useCallback(async () => {
    if (!isAdmin && !userPermissions.includes('opd.dashboard.export')) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      if (departments.length > 0) {
        const deptRows = departments.map((d: any) => ({
          [tr('القسم', 'Department')]: d.departmentName,
          [tr('الزيارات', 'Visits')]: d.totalPatients,
          [tr('محجوز', 'Booked')]: d.booked || 0,
          [tr('انتظار', 'Walk-in')]: d.waiting || 0,
          [tr('لم يحضر', 'No-show')]: d.noShow || 0,
          [tr('إجراءات', 'Procedures')]: d.procedures || 0,
          [tr('الاستخدام %', 'Utilization %')]: d.utilization || 0,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), tr('الأقسام', 'Departments'));
      }

      const doctorRows: any[] = [];
      for (const dept of departments) {
        for (const doc of (dept.doctors || [])) {
          doctorRows.push({
            [tr('القسم', 'Department')]: dept.departmentName,
            [tr('الطبيب', 'Doctor')]: doc.doctorName,
            [tr('المرضى', 'Patients')]: doc.totalPatients,
            [tr('ساعات', 'Hours')]: doc.hours || 0,
            [tr('الهدف', 'Target')]: doc.target || 0,
            [tr('الاستخدام %', 'Utilization %')]: doc.utilization || 0,
          });
        }
      }
      if (doctorRows.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(doctorRows), tr('الأطباء', 'Doctors'));
      }

      XLSX.writeFile(wb, `opd-dashboard-${today}.xlsx`);
    } catch (err) {
      console.error('Excel export error:', err);
    }
  }, [departments, isAdmin, userPermissions, today, tr]);

  const quickLinks: { href: string; icon: ReactNode; label: string; desc: string }[] = [
    { href: '/opd/registration', icon: <ClipboardList className="h-6 w-6" />, label: tr('التسجيل', 'Registration'), desc: tr('تسجيل مرضى بدون موعد', 'Register walk-in patients') },
    { href: '/opd/appointments', icon: <CalendarDays className="h-6 w-6" />, label: tr('المواعيد', 'Appointments'), desc: tr('حجز وإدارة المواعيد', 'Book and manage appointments') },
    { href: '/opd/nurse-station', icon: <UserRound className="h-6 w-6" />, label: tr('محطة التمريض', 'Nurse station'), desc: tr('الفرز والتقييم التمريضي', 'Triage and nursing assessment') },
    { href: '/opd/doctor-worklist', icon: <Stethoscope className="h-6 w-6" />, label: tr('قائمة الطبيب', 'Doctor worklist'), desc: tr('قائمة مرضى الطبيب', 'Doctor patient list') },
    { href: '/opd/waiting-list', icon: <Hourglass className="h-6 w-6" />, label: tr('قائمة الانتظار', 'Waiting list'), desc: tr('غرفة الانتظار المباشرة', 'Live waiting room') },
  ];

  if (isPermissionLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const canExport = isAdmin || userPermissions.includes('opd.dashboard.export');

  const isRefreshing = isLoading && hasLoadedOnce;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-background">
      {/* Slim progress bar during background refresh — no full-page reload */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary/20 z-[100] overflow-hidden">
          <div className="h-full bg-primary animate-loading-bar" style={{ maxWidth: '100%' }} />
        </div>
      )}
      <DashboardHeader
        filter={filter}
        onFilterChange={setFilter}
        onRefresh={fetchData}
        onExportPDF={canExport ? handleExportPDF : undefined}
        onExportExcel={canExport ? handleExportExcel : undefined}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {/* Tab bar — TheaTab pill style */}
      <div className="bg-card border border-border rounded-xl sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted my-2 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap rounded-xl thea-transition-fast ${
                    isActive
                      ? 'bg-card text-foreground shadow-sm font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                  }`}
                >
                  {tab.icon}
                  {language === 'ar' ? tab.labelAr : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content — full loading only on initial load; refresh updates in-place */}
      <div id="dashboard-content" className="max-w-[1600px] mx-auto px-4 py-5 relative">
        {isLoading && !hasLoadedOnce && (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
          </div>
        )}

        {(hasLoadedOnce || stats.totalVisits > 0) && (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                stats={stats}
                analytics={analytics}
                visitTypeBreakdown={visitTypeBreakdown}
                previousPeriod={previousPeriod}
              />
            )}

            {activeTab === 'departments' && (
              <DepartmentsTab departments={departments} analytics={analytics} />
            )}

            {activeTab === 'doctors' && (
              <DoctorsTab departments={departments} analytics={analytics} />
            )}

            {activeTab === 'rooms' && (
              <RoomsTab departments={departments} />
            )}

            {activeTab === 'timeAnalysis' && (
              <TimeAnalysisTab analytics={analytics} />
            )}

            {activeTab === 'strategic' && (
              <StrategicTab analytics={analytics} departments={departments} />
            )}

            {/* Quick access links — shown on overview tab only */}
            {activeTab === 'overview' && (
              <div className="mt-5">
                <div className="text-sm font-semibold text-foreground mb-3">{tr('وصول سريع', 'Quick access')}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {quickLinks.filter((link) => isAdmin || hasRoutePermission(userPermissions, link.href)).map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-2xl bg-card border border-border p-3 text-center thea-hover-lift thea-transition-fast"
                    >
                      <div className="flex justify-center mb-1 text-muted-foreground">{link.icon}</div>
                      <div className="text-xs font-semibold text-foreground">{link.label}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{link.desc}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
