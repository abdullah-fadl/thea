'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { hasRoutePermission } from '@/lib/permissions';
import { useMe } from '@/lib/hooks/useMe';
import { Button } from '@/components/ui/button';
import { Keyboard, RefreshCw, UserPlus, CalendarDays, ClipboardList, Stethoscope, FileText } from 'lucide-react';
import type { PatientRecord } from './components/types';
import { PatientCard } from './components/PatientCard';
import { PatientList } from './components/PatientList';
import { PatientFilters, type PatientFilterState } from './components/PatientFilters';
import { BulkActions } from './components/BulkActions';
import { PatientStats } from './components/PatientStats';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type ViewMode = 'grid' | 'list';

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  keyboardNavigation: boolean;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: any;
  shortcut: string;
}

export default function Patients() {
  const router = useRouter();
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { theme } = useTheme();
  const { me } = useMe();
  const { hasPermission, isLoading: permissionLoading } = useRoutePermission('/patients');

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    keyboardNavigation: false,
  });

  const [filters, setFilters] = useState<PatientFilterState>({
    query: '',
    status: '',
    mrn: '',
    mobile: '',
    nationalId: '',
    iqama: '',
    passport: '',
    dob: '',
    gender: '',
    department: '',
    urgency: '',
    insurance: '',
    limit: '30',
  });

  const isDark = theme === 'dark';
  const colors = useMemo(
    () => ({
      primary: isDark ? '#22D3EE' : '#0891B2',
      secondary: isDark ? '#38BDF8' : '#0EA5E9',
      accent: isDark ? '#06B6D4' : '#0284C7',
      background: isDark ? '#0F172A' : '#FFFFFF',
      surface: isDark ? '#1E293B' : '#F8FAFC',
      text: isDark ? '#F1F5F9' : '#0F172A',
      textSecondary: isDark ? '#94A3B8' : '#64748B',
    }),
    [isDark]
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(filters.query.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [filters.query]);

  const updateFilters = useCallback((updates: Partial<PatientFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      query: '',
      status: '',
      mrn: '',
      mobile: '',
      nationalId: '',
      iqama: '',
      passport: '',
      dob: '',
      gender: '',
      department: '',
      urgency: '',
      insurance: '',
      limit: '30',
    });
  }, []);

  const presets = [
    { id: 'all', label: tr('الكل', 'All'), value: { status: '' } },
    { id: 'active', label: tr('نشط', 'Active'), value: { status: 'ACTIVE' } },
    { id: 'admitted', label: tr('منوم', 'Admitted'), value: { status: 'ADMITTED' } },
    { id: 'discharged', label: tr('خروج', 'Discharged'), value: { status: 'DISCHARGED' } },
  ];

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (filters.status) params.set('status', filters.status);
    if (filters.mrn) params.set('mrn', filters.mrn);
    if (filters.mobile) params.set('mobile', filters.mobile);
    if (filters.nationalId) params.set('nationalId', filters.nationalId);
    if (filters.iqama) params.set('iqama', filters.iqama);
    if (filters.passport) params.set('passport', filters.passport);
    if (filters.dob) params.set('dob', filters.dob);
    if (filters.limit) params.set('limit', filters.limit);
    return params;
  }, [debouncedQuery, filters]);

  const hasCriteria = useMemo(() => {
    return Boolean(
      debouncedQuery ||
      filters.status ||
      filters.mrn ||
      filters.mobile ||
      filters.nationalId ||
      filters.iqama ||
      filters.passport ||
      filters.dob
    );
  }, [debouncedQuery, filters]);

  const searchUrl = hasPermission && hasCriteria ? `/api/patients/search?${queryParams.toString()}` : null;
  const { data, isLoading } = useSWR(searchUrl, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(data?.items) ? data.items : [];

  const filteredItems = useMemo(() => {
    return items.filter((patient: PatientRecord) => {
      if (filters.gender && String(patient.gender || '').toLowerCase() !== filters.gender.toLowerCase()) {
        return false;
      }
      if (filters.department && String(patient.department || '').toLowerCase().indexOf(filters.department.toLowerCase()) === -1) {
        return false;
      }
      if (filters.urgency && String(patient.urgency || '').toLowerCase().indexOf(filters.urgency.toLowerCase()) === -1) {
        return false;
      }
      if (filters.insurance && String(patient.insurance || '').toLowerCase().indexOf(filters.insurance.toLowerCase()) === -1) {
        return false;
      }
      return true;
    });
  }, [items, filters]);

  const patientRows = useMemo(() => {
    return filteredItems.map((patient, index) => {
      const patientId =
        patient.patientMasterId ||
        patient.id ||
        patient.links?.mrn ||
        patient.identifiers?.mrn ||
        patient.links?.tempMrn ||
        patient.identifiers?.tempMrn ||
        `${patient.fullName || 'patient'}-${index}`;
      return { patient, patientId };
    });
  }, [filteredItems]);

  const stats = useMemo(() => {
    const statusCounts = filteredItems.reduce(
      (acc, patient) => {
        const status = String(patient.status || '').toLowerCase();
        if (status.includes('active')) acc.active += 1;
        if (status.includes('admitted')) acc.admitted += 1;
        if (status.includes('discharged')) acc.discharged += 1;
        if (String(patient.urgency || '').toLowerCase() === 'critical') acc.critical += 1;
        return acc;
      },
      { active: 0, admitted: 0, discharged: 0, critical: 0 }
    );
    return [
      { label: tr('الإجمالي', 'Total'), value: filteredItems.length },
      { label: tr('نشط', 'Active'), value: statusCounts.active },
      { label: tr('منوم', 'Admitted'), value: statusCounts.admitted },
      { label: tr('حرج', 'Critical'), value: statusCounts.critical },
    ];
  }, [filteredItems, language]);

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

  const quickActions: QuickAction[] = useMemo(() => {
    if (roleKey === 'doctor') {
      return [
        { title: tr('مريض جديد', 'New Patient'), description: tr('فتح زيارة جديدة', 'Create a new visit'), href: '/opd/home', icon: UserPlus, shortcut: 'N' },
        { title: tr('الجدولة', 'Schedule'), description: tr('مواعيد اليوم', 'Today schedule'), href: '/scheduling/scheduling', icon: CalendarDays, shortcut: 'S' },
        { title: tr('النتائج', 'Results'), description: tr('نتائج مختبر وأشعة', 'Lab and radiology'), href: '/results', icon: FileText, shortcut: 'R' },
        { title: tr('العيادة', 'OPD Dashboard'), description: tr('لوحة العيادة', 'Clinic dashboard'), href: '/opd/home', icon: Stethoscope, shortcut: 'O' },
      ];
    }
    if (roleKey === 'nurse') {
      return [
        { title: tr('التمريض', 'Nursing Ops'), description: tr('مهام التمريض', 'Nursing tasks'), href: '/nursing/operations', icon: ClipboardList, shortcut: 'N' },
        { title: tr('الجدولة', 'Scheduling'), description: tr('الورديات', 'Shift schedules'), href: '/scheduling/scheduling', icon: CalendarDays, shortcut: 'S' },
        { title: tr('العيادة', 'OPD Dashboard'), description: tr('لوحة العيادة', 'Clinic overview'), href: '/opd/home', icon: Stethoscope, shortcut: 'O' },
        { title: tr('النتائج', 'Results'), description: tr('نتائج المرضى', 'Patient results'), href: '/results', icon: FileText, shortcut: 'R' },
      ];
    }
    if (roleKey === 'receptionist') {
      return [
        { title: tr('موعد جديد', 'New Appointment'), description: tr('حجز موعد', 'Book appointment'), href: '/scheduling/scheduling', icon: CalendarDays, shortcut: 'A' },
        { title: tr('تسجيل مريض', 'Check-in'), description: tr('تسجيل وصول', 'Register patient'), href: '/opd/registration', icon: UserPlus, shortcut: 'C' },
        { title: tr('قائمة الانتظار', 'Waiting List'), description: tr('إدارة الانتظار', 'Queue management'), href: '/opd/waiting-list', icon: ClipboardList, shortcut: 'W' },
        { title: tr('العيادة', 'OPD Dashboard'), description: tr('لوحة العيادة', 'Clinic dashboard'), href: '/opd/home', icon: Stethoscope, shortcut: 'O' },
      ];
    }
    return [
      { title: tr('لوحة العيادة', 'OPD Dashboard'), description: tr('إدارة العمليات', 'Operations overview'), href: '/opd/home', icon: Stethoscope, shortcut: 'O' },
      { title: tr('الجدولة', 'Scheduling'), description: tr('إدارة المواعيد', 'Manage appointments'), href: '/scheduling/scheduling', icon: CalendarDays, shortcut: 'S' },
      { title: tr('النتائج', 'Results'), description: tr('نتائج المرضى', 'Patient results'), href: '/results', icon: FileText, shortcut: 'R' },
      { title: tr('التمريض', 'Nursing'), description: tr('عمليات التمريض', 'Nursing operations'), href: '/nursing/operations', icon: ClipboardList, shortcut: 'N' },
    ];
  }, [language, roleKey]);

  const permittedActions = quickActions.filter((action) => hasRoutePermission(me?.user?.permissions || [], action.href));

  useEffect(() => {
    if (!accessibilitySettings.keyboardNavigation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toUpperCase();
      const match = permittedActions.find((action) => action.shortcut === key);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [accessibilitySettings.keyboardNavigation, permittedActions, router]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(patientRows.map((row) => row.patientId)));
  }, [patientRows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exportSelected = useCallback(() => {
    const selectedPatients = patientRows.filter((row) => selectedIds.has(row.patientId));
    if (!selectedPatients.length) return;
    const headers = ['Name', 'MRN', 'Gender', 'Age', 'Status', 'Phone'];
    const rows = selectedPatients.map(({ patient }) => {
      const name = patient.fullName || patient.displayName || patient.name || '';
      const mrn = patient.mrn || patient.links?.mrn || patient.identifiers?.mrn || '';
      const gender = patient.gender || '';
      const age = patient.age != null ? String(patient.age) : '';
      const status = patient.status || '';
      const phone = patient.phone || patient.mobile || '';
      return [name, mrn, gender, age, status, phone];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'patients-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [patientRows, selectedIds]);

  if (permissionLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const labels = {
    title: tr('إدارة المرضى', 'Patient Management'),
    subtitle: tr('واجهة شاملة لإدارة سجلات المرضى', 'Manage patient records with advanced tools'),
    quickActions: tr('إجراءات سريعة', 'Quick Actions'),
    search: tr('بحث بالاسم أو الرقم', 'Search by name or MRN'),
    status: tr('الحالة', 'Status'),
    mrn: tr('رقم الملف', 'MRN'),
    mobile: tr('الجوال', 'Mobile'),
    nationalId: tr('الهوية الوطنية', 'National ID'),
    iqama: tr('الإقامة', 'Iqama'),
    passport: tr('الجواز', 'Passport'),
    dob: tr('تاريخ الميلاد', 'Date of birth'),
    gender: tr('الجنس', 'Gender'),
    department: tr('القسم', 'Department'),
    urgency: tr('الأولوية', 'Urgency'),
    insurance: tr('التأمين', 'Insurance'),
    limit: tr('الحد', 'Limit'),
    grid: tr('بطاقات', 'Grid'),
    list: tr('قائمة', 'List'),
    reset: tr('إعادة ضبط', 'Reset'),
    selected: tr('المحدد', 'Selected'),
    export: tr('تصدير', 'Export'),
    clear: tr('إلغاء', 'Clear'),
    name: tr('الاسم', 'Name'),
    actions: tr('الإجراءات', 'Actions'),
    openProfile: tr('الملف', 'Profile'),
    viewJourney: tr('رحلة المريض', 'Journey'),
    view360: tr('عرض 360', '360 View'),
    empty: tr('لا توجد نتائج', 'No results found.'),
    searchPrompt: tr('ابدأ بالبحث لعرض المرضى', 'Enter search criteria to see results.'),
    skip: tr('انتقل إلى المحتوى الرئيسي', 'Skip to Main Content'),
  };

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen transition-all duration-500"
      style={{
        backgroundColor: colors.background,
        backgroundImage: isDark
          ? `radial-gradient(circle at 25% 25%, rgba(34, 211, 238, 0.06) 0%, transparent 50%),
             radial-gradient(circle at 75% 75%, rgba(56, 189, 248, 0.06) 0%, transparent 50%)`
          : `radial-gradient(circle at 25% 25%, rgba(8, 145, 178, 0.04) 0%, transparent 50%),
             radial-gradient(circle at 75% 75%, rgba(14, 165, 233, 0.04) 0%, transparent 50%)`,
        filter: accessibilitySettings.highContrast ? 'contrast(150%)' : 'none',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 rounded-lg text-white font-medium"
        style={{ backgroundColor: colors.primary }}
      >
        {labels.skip}
      </a>

      {!accessibilitySettings.reduceMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full opacity-40"
              style={{
                backgroundColor: i % 2 === 0 ? colors.primary : colors.secondary,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h1 className={`text-2xl md:text-4xl font-bold text-foreground ${accessibilitySettings.largeText ? 'md:text-5xl' : ''}`}>
              {labels.title}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {labels.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => updateFilters({})}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {tr('تحديث', 'Refresh')}
            </Button>
            <button
              type="button"
              onClick={() =>
                setAccessibilitySettings((prev) => ({
                  ...prev,
                  keyboardNavigation: !prev.keyboardNavigation,
                }))
              }
              className={`p-2 rounded-xl border border-border transition-all duration-200 ${
                accessibilitySettings.keyboardNavigation ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{
                color: accessibilitySettings.keyboardNavigation ? colors.primary : colors.textSecondary,
                ['--tw-ring-color' as string]: colors.primary,
              }}
              aria-label="Toggle accessibility features"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
        </div>

        <PatientStats stats={stats} />

        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{labels.quickActions}</h2>
          <p className="text-sm text-muted-foreground">{tr('اختصارات حسب الدور', 'Role-based shortcuts')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {permittedActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  type="button"
                  onClick={() => router.push(action.href)}
                  aria-keyshortcuts={`Alt+${action.shortcut}`}
                  className="text-left p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-xl text-white"
                      style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{action.title}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
                    </div>
                    {accessibilitySettings.keyboardNavigation ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">Alt+{action.shortcut}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div id="main-content" className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{tr('بحث متعدد المعايير', 'Advanced search and filtering')}</p>
          <div className="space-y-6">
            <PatientFilters
              filters={filters}
              onChange={updateFilters}
              onReset={resetFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              presets={presets}
              labels={labels}
            />

            <BulkActions
              selectedCount={selectedIds.size}
              onClear={clearSelection}
              onExport={exportSelected}
              labels={{ selected: labels.selected, export: labels.export, clear: labels.clear }}
            />

            {isLoading ? (
              <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
            ) : !hasCriteria ? (
              <div className="text-sm text-muted-foreground">{labels.searchPrompt}</div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {patientRows.map(({ patient, patientId }) => (
                  <PatientCard
                    key={patientId}
                    patient={patient}
                    patientId={patientId}
                    selected={selectedIds.has(patientId)}
                    onToggleSelect={toggleSelect}
                    labels={{
                      mrn: labels.mrn,
                      tempMrn: tr('ملف مؤقت', 'tempMRN'),
                      openProfile: labels.openProfile,
                      viewJourney: labels.viewJourney,
                      view360: labels.view360,
                      unknown: tr('غير معروف', 'Unknown'),
                    }}
                  />
                ))}
                {!patientRows.length ? <div className="text-sm text-muted-foreground">{labels.empty}</div> : null}
              </div>
            ) : (
              <PatientList
                patients={patientRows}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onClearAll={clearSelection}
                labels={{
                  name: labels.name,
                  mrn: labels.mrn,
                  status: labels.status,
                  actions: labels.actions,
                  openProfile: labels.openProfile,
                  viewJourney: labels.viewJourney,
                  view360: labels.view360,
                  selectAll: tr('تحديد الكل', 'Select all'),
                  clear: labels.clear,
                  empty: labels.empty,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {accessibilitySettings.keyboardNavigation ? (
        <div
          role="dialog"
          aria-labelledby="accessibility-panel-title"
          className="fixed bottom-6 right-6 w-80 p-5 rounded-2xl border border-border z-50 bg-card"
          style={{
            backdropFilter: 'blur(20px)',
            boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1)`,
          }}
        >
          <h3 id="accessibility-panel-title" className="font-bold mb-4 text-foreground">
            {tr('إعدادات إمكانية الوصول', 'Accessibility Settings')}
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.highContrast}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, highContrast: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span className="text-foreground">{tr('تباين عالي', 'High Contrast')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.largeText}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, largeText: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span className="text-foreground">{tr('نص كبير', 'Large Text')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accessibilitySettings.reduceMotion}
                onChange={(e) => setAccessibilitySettings((prev) => ({ ...prev, reduceMotion: e.target.checked }))}
                className="w-4 h-4 rounded"
                style={{ accentColor: colors.primary }}
              />
              <span className="text-foreground">{tr('تقليل الحركة', 'Reduce Motion')}</span>
            </label>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 0.4;
          }
          50% {
            transform: translateY(-30px) rotate(180deg);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
