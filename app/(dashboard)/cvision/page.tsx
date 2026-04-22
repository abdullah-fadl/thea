'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  Users, UserCheck, Palmtree, Target, Building2, CreditCard,
  UserPlus, Shield, ExternalLink, Loader2, Trophy,
  HeartPulse, GraduationCap, Briefcase, Filter,
  MoreHorizontal, RefreshCw, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import CVisionStatCard from '@/components/cvision/CVisionStatCard';
import CVisionEmployeeRow from '@/components/cvision/CVisionEmployeeRow';
import CVisionLeaveRow from '@/components/cvision/CVisionLeaveRow';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SummaryData {
  totalEmployees: number;
  activeEmployees: number;
  probationEmployees: number;
  newThisMonth: number;
  resignedThisMonth: number;
  saudizationPercent: number;
  pendingApprovals: number;
  pendingLeaves: number;
  pendingLoans: number;
  pendingLetters: number;
  expiryAlerts: { type: string; count: number; label: string }[];
  departmentCount: number;
  openPositions: number;
  leaveStats: { onLeaveToday: number; pendingRequests: number };
  training: { activeCourses: number; totalEnrollments: number; completedEnrollments: number };
  presentToday: number;
  activeLoans: number;
  recentAnnouncements: any[];
  recentHires: any[];
  recentActivity: any[];
  myPendingRequests: number;
  myUnreadNotifications: number;
  recentLeaves: { employeeName: string; employeeNameAr: string; type: string; startDate: string; endDate: string; days: number; status: string }[];
  departmentHeadcounts: { name: string; nameAr: string; count: number }[];
  recruitmentPipeline: { stage: string; stageAr: string; count: number }[];
  payrollSummary: { totalPayroll: number; basicTotal: number; housingTotal: number; transportTotal: number; gosiTotal: number; deductionsTotal: number };
}

/* ─── Dashboard ──────────────────────────────────────────────────────── */

export default function CVisionDashboard() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [authError, setAuthError] = useState(false);
  const authErrorRef = useRef(false);

  const { data: dashRaw, isLoading: loading, refetch, isError } = useQuery({
    queryKey: cvisionKeys.dashboard.summary(),
    queryFn: () => cvisionFetch('/api/cvision/dashboard/summary'),
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      if (error?.status === 401) return false;
      return failureCount < 2;
    },
  });

  // Detect auth errors
  useEffect(() => {
    if (isError) {
      setAuthError(true);
      authErrorRef.current = true;
    } else {
      setAuthError(false);
      authErrorRef.current = false;
    }
  }, [isError]);

  // Listen for custom refresh events
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('cvision:refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('cvision:refresh-dashboard', handleRefresh);
  }, [refetch]);

  const summary: SummaryData | null = dashRaw?.data ?? null;

  const s = summary;

  /* ─── Loading skeleton ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 120,
                borderRadius: 14,
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <div
            style={{
              flex: 2,
              height: 300,
              borderRadius: 14,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
            }}
          />
          <div
            style={{
              flex: 1,
              height: 300,
              borderRadius: 14,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
            }}
          />
        </div>
      </div>
    );
  }

  /* ─── Auth error ───────────────────────────────────────────────────── */
  if (authError) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background: C.orangeDim,
          border: `1px solid ${C.orange}30`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AlertCircle size={20} color={C.orange} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {tr('وصول محدود', 'Limited Access')}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {tr(
              'بعض البيانات غير متاحة. ستظهر عند إضافة أقسام وموظفين.',
              'Some data could not be loaded. Data will populate as you add departments and employees.'
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px',
            borderRadius: 8,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            color: C.textSecondary,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={12} /> {tr('إعادة المحاولة', 'Retry')}
        </button>
      </div>
    );
  }

  const totalActive = s ? s.activeEmployees + s.probationEmployees : 0;

  /* ─── Sample data for employee table & leaves (when API has data) ── */
  const sampleEmployees = s?.recentHires?.slice(0, 6).map((h: any) => ({
    name: h.name || h.nameEn || 'Employee',
    nameAr: h.nameAr || h.name || '',
    dept: h.department || h.departmentName || '',
    role: h.jobTitle || h.position || '',
    status: tr('نشط', 'Active'),
    initials: ((h.name || h.nameEn || 'E')[0] + ((h.name || h.nameEn || 'E')[1] || '')).toUpperCase(),
  })) || [];

  /* ─── Departments data (real) ──────────────────────────────────────── */
  const deptColors = [C.gold, C.purple, C.blue, C.green, C.orange];
  const maxDeptCount = s?.departmentHeadcounts?.length ? Math.max(...s.departmentHeadcounts.map(d => d.count), 1) : 1;
  const departments = (s?.departmentHeadcounts || []).slice(0, 5).map((d, i) => ({
    name: isRTL && d.nameAr ? d.nameAr : d.name,
    en: d.name,
    count: d.count,
    max: maxDeptCount,
    color: deptColors[i % deptColors.length],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── Stat Cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <CVisionStatCard
          label="Employees"
          labelAr={tr('إجمالي الموظفين', 'Total Employees')}
          value={s?.totalEmployees || 0}
          change={s?.newThisMonth ? `+${s.newThisMonth}` : undefined}
          icon={Users}
          color={C.gold}
          colorDim={C.goldDim}
          C={C}
          isRTL={isRTL}
        />
        <CVisionStatCard
          label="Active"
          labelAr={tr('نشط', 'Active')}
          value={totalActive}
          icon={UserCheck}
          color={C.green}
          colorDim={C.greenDim}
          C={C}
          isRTL={isRTL}
        />
        <CVisionStatCard
          label="On Leave"
          labelAr={tr('في إجازة', 'On Leave')}
          value={s?.leaveStats?.onLeaveToday || 0}
          icon={Palmtree}
          color={C.blue}
          colorDim={C.blueDim}
          C={C}
          isRTL={isRTL}
        />
        <CVisionStatCard
          label="Open Roles"
          labelAr={tr('وظائف شاغرة', 'Open Roles')}
          value={s?.openPositions || 0}
          change={s?.openPositions ? `+${s.openPositions}` : undefined}
          icon={Target}
          color={C.orange}
          colorDim={C.orangeDim}
          C={C}
          isRTL={isRTL}
        />
      </div>

      {/* ─── Middle Row: Employees + Leave Requests ────────────────────── */}
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Employee Table */}
        <div
          style={{
            flex: 2,
            borderRadius: 14,
            overflow: 'hidden',
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            transition: 'all 0.4s',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: `1px solid ${C.border}`,
              background: C.headerBg,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {tr('الموظفون', 'Employees')}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{tr('الموظفون الأخيرون', 'Recent Employees')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  color: C.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Filter size={11} strokeWidth={1.8} /> {tr('فلترة', 'Filter')}
              </div>
              <Link
                href="/cvision/employees"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 10,
                  background: C.goldDim,
                  color: C.gold,
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                {tr('عرض الكل', 'View All')}
              </Link>
            </div>
          </div>
          {sampleEmployees.length > 0 ? (
            sampleEmployees.map((e: any, i: number) => (
              <CVisionEmployeeRow key={i} {...e} C={C} isDark={isDark} />
            ))
          ) : (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: C.textMuted,
                fontSize: 13,
              }}
            >
              {tr('لا يوجد موظفين حديثين', 'No recent employees')}
            </div>
          )}
        </div>

        {/* Leave Requests */}
        <div
          style={{
            flex: 1,
            borderRadius: 14,
            overflow: 'hidden',
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            transition: 'all 0.4s',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: C.headerBg,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {tr('طلبات الإجازات', 'Leave Requests')}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{tr('طلبات الإجازات', 'Leave Requests')}</div>
            </div>
            {(s?.leaveStats?.pendingRequests || 0) > 0 && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: C.orangeBadge,
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.orange,
                }}
              >
                {s?.leaveStats?.pendingRequests || 0}
              </div>
            )}
          </div>
          {(s?.recentLeaves?.length || 0) > 0 ? s!.recentLeaves.map((l, i) => {
            const leaveTypeMap: Record<string, { ar: string; en: string; icon: any }> = {
              ANNUAL: { ar: 'سنوية', en: 'Annual', icon: Palmtree },
              SICK: { ar: 'مرضية', en: 'Sick', icon: HeartPulse },
              MARRIAGE: { ar: 'زواج', en: 'Marriage', icon: GraduationCap },
              MATERNITY: { ar: 'أمومة', en: 'Maternity', icon: HeartPulse },
              PATERNITY: { ar: 'أبوة', en: 'Paternity', icon: Briefcase },
              UNPAID: { ar: 'بدون راتب', en: 'Unpaid', icon: Palmtree },
              BEREAVEMENT: { ar: 'عزاء', en: 'Bereavement', icon: HeartPulse },
              HAJJ: { ar: 'حج', en: 'Hajj', icon: Palmtree },
              COMPASSIONATE: { ar: 'إنسانية', en: 'Compassionate', icon: HeartPulse },
              STUDY: { ar: 'دراسية', en: 'Study', icon: GraduationCap },
              OTHER: { ar: 'أخرى', en: 'Other', icon: Palmtree },
            };
            const statusMap: Record<string, { ar: string; en: string }> = {
              PENDING: { ar: 'بانتظار', en: 'Pending' },
              APPROVED: { ar: 'معتمد', en: 'Approved' },
              REJECTED: { ar: 'مرفوض', en: 'Rejected' },
            };
            const lt = leaveTypeMap[l.type] || { ar: l.type, en: l.type, icon: Palmtree };
            const st = statusMap[l.status] || { ar: l.status, en: l.status };
            const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }) : '';
            return (
              <CVisionLeaveRow
                key={i}
                name={isRTL ? (l.employeeNameAr || l.employeeName) : l.employeeName}
                type={tr(lt.ar, lt.en)}
                typeIcon={lt.icon}
                days={tr(`${l.days} أيام`, `${l.days} days`)}
                date={`${fmtDate(l.startDate)} - ${fmtDate(l.endDate)}`}
                status={tr(st.ar, st.en)}
                C={C}
              />
            );
          }) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              {tr('لا توجد طلبات إجازة', 'No leave requests')}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom Row: Departments + Payroll + Recruitment ───────────── */}
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Departments */}
        <div
          style={{
            flex: 1,
            padding: 18,
            borderRadius: 14,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            transition: 'all 0.4s',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {tr('توزيع الأقسام', 'Department Distribution')}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{tr('توزيع الأقسام', 'Department Distribution')}</div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: C.goldDim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={16} color={C.gold} strokeWidth={1.8} />
            </div>
          </div>
          {departments.map((d, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>
                  {d.name}{' '}
                  <span style={{ color: C.textMuted, fontSize: 10 }}>{d.en}</span>
                </span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{d.count}</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 5,
                  borderRadius: 3,
                  background: C.barTrack,
                }}
              >
                <div
                  style={{
                    width: `${d.max > 0 ? (d.count / d.max) * 100 : 0}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${d.color}, ${d.color}${C.barAlpha})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Payroll Summary */}
        <div
          style={{
            flex: 1,
            padding: 18,
            borderRadius: 14,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            transition: 'all 0.4s',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {tr('ملخص الرواتب', 'Payroll Summary')}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>
                Payroll — {new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: C.goldDim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={16} color={C.gold} strokeWidth={1.8} />
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '16px 4px 14px',
              marginBottom: 12,
              borderRadius: 10,
              background: C.barTrack,
              border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
              Total Payroll
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: C.gold, marginTop: 4 }}>
              {(s?.payrollSummary?.totalPayroll || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('ريال سعودي', 'SAR')}</div>
          </div>
          {[
            { label: tr('الراتب الأساسي', 'Basic Salary'), en: 'Basic', amount: (s?.payrollSummary?.basicTotal || 0).toLocaleString() },
            { label: tr('بدل سكن', 'Housing'), en: 'Housing', amount: (s?.payrollSummary?.housingTotal || 0).toLocaleString() },
            { label: tr('بدل نقل', 'Transport'), en: 'Transport', amount: (s?.payrollSummary?.transportTotal || 0).toLocaleString() },
            { label: 'GOSI', en: 'Employer', amount: (s?.payrollSummary?.gosiTotal || 0).toLocaleString() },
            { label: tr('خصومات', 'Deductions'), en: 'Deductions', amount: `-${(s?.payrollSummary?.deductionsTotal || 0).toLocaleString()}`, negative: true },
          ].map((item: any, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < 4 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <span style={{ fontSize: 11, color: C.textSecondary }}>
                {item.label}{' '}
                <span style={{ color: C.textMuted, fontSize: 9 }}>{item.en}</span>
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: item.negative ? C.red : C.text,
                }}
              >
                {item.amount}
              </span>
            </div>
          ))}
        </div>

        {/* Recruitment Pipeline */}
        <div
          style={{
            flex: 1,
            padding: 18,
            borderRadius: 14,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            boxShadow: C.shadow,
            transition: 'all 0.4s',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {tr('خط التوظيف', 'Recruitment Pipeline')}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{tr('خط التوظيف', 'Recruitment Pipeline')}</div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: C.purpleDim,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={16} color={C.purple} strokeWidth={1.8} />
            </div>
          </div>
          {(() => {
            const pipeColors = [C.textSecondary, C.blue, C.purple, C.gold, C.green];
            const pipeline = (s?.recruitmentPipeline || []).map((p, i) => ({
              stage: tr(p.stageAr, p.stage),
              en: p.stage,
              count: p.count,
              color: pipeColors[i % pipeColors.length],
            }));
            const maxCount = Math.max(...pipeline.map(p => p.count), 1);
            return pipeline.map((st, i) => ({ ...st, pct: Math.round((st.count / maxCount) * 100) }));
          })().map((st, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>
                  {st.stage}{' '}
                  <span style={{ color: C.textMuted, fontSize: 10 }}>{st.en}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{st.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.barTrack }}>
                <div
                  style={{
                    width: `${st.pct}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${st.color}, ${st.color}${isDark ? '40' : '60'})`,
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 12,
              padding: '9px 12px',
              borderRadius: 8,
              background: C.goldDim,
              border: `1px solid ${C.gold}20`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Target size={15} color={C.gold} strokeWidth={1.8} />
            <div>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>
                {s?.openPositions || 5} {tr('وظائف شاغرة', 'open roles')}
              </div>
              <div style={{ fontSize: 9, color: C.textMuted }}>{tr('تحتاج انتباه', 'Need attention')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
