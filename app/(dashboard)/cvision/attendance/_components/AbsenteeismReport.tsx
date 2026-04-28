'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader , CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { ChevronLeft, ChevronRight, Loader2, Building2, Users, AlertTriangle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeptReport {
  department: string;
  departmentId: string;
  totalEmployees: number;
  avgAttendanceRate: number;
  totalAbsentDays: number;
  totalLateDays: number;
  topAbsentees: { employeeId: string; name: string; absentDays: number }[];
}

export default function AbsenteeismReport() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [report, setReport] = useState<DeptReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const m = month.toString().padStart(2, '0');
    fetch(`/api/cvision/attendance?action=dept-absenteeism&month=${m}&year=${year}`, { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => setReport(d.data?.items || d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [month, year]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else { setMonth(m => m - 1); }
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else { setMonth(m => m + 1); }
  }

  function getAttendanceColor(rate: number) {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    if (rate >= 50) return 'text-orange-600';
    return 'text-red-600';
  }

  function getBarColor(rate: number) {
    if (rate >= 90) return 'bg-green-500';
    if (rate >= 75) return 'bg-yellow-500';
    if (rate >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  }

  const totalEmployees = report.reduce((s, r) => s + r.totalEmployees, 0);
  const avgRate = report.length > 0 ? Math.round(report.reduce((s, r) => s + r.avgAttendanceRate, 0) / report.length) : 0;
  const totalAbsent = report.reduce((s, r) => s + r.totalAbsentDays, 0);
  const totalLate = report.reduce((s, r) => s + r.totalLateDays, 0);

  const locale = isRTL ? 'ar-SA' : 'en-US';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft style={{ height: 16, width: 16 }} />
          </CVisionButton>
          <span style={{ fontSize: 13, fontWeight: 500, width: 128, textAlign: 'center' }}>
            {new Date(year, month - 1).toLocaleString(locale, { month: 'long', year: 'numeric' })}
          </span>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight style={{ height: 16, width: 16 }} />
          </CVisionButton>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Building2 style={{ height: 32, width: 32, color: C.blue }} />
            <div>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{report.length}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الأقسام', 'Departments')}</p>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users style={{ height: 32, width: 32 }} />
            <div>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{totalEmployees}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي الموظفين', 'Total Employees')}</p>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <TrendingDown style={{ height: 32, width: 32, color: C.green }} />
            <div>
              <p className={cn('text-2xl font-bold', getAttendanceColor(avgRate))}>{avgRate}%</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('متوسط الحضور', 'Avg Attendance')}</p>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle style={{ height: 32, width: 32, color: C.red }} />
            <div>
              <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{totalAbsent}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي أيام الغياب', 'Total Absent Days')}</p>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Department breakdown */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
          <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
        </div>
      ) : report.length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            {tr('لا توجد بيانات أقسام لهذا الشهر', 'No department data available for this month')}
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.map(dept => (
            <CVisionCard C={C}
              key={dept.departmentId}
              className={cn('cursor-pointer transition-all', expanded === dept.departmentId && 'ring-2 ring-primary')}
              onClick={() => setExpanded(expanded === dept.departmentId ? null : dept.departmentId)}
            >
              <CVisionCardBody style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Building2 style={{ height: 16, width: 16, color: C.textMuted }} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{dept.department}</span>
                    <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                      {dept.totalEmployees} {tr('موظف', 'employees')}
                    </CVisionBadge>
                  </div>
                  <span className={cn('text-lg font-bold', getAttendanceColor(dept.avgAttendanceRate))}>
                    {dept.avgAttendanceRate}%
                  </span>
                </div>

                <div style={{ width: '100%', borderRadius: '50%', height: 8, marginBottom: 8 }}>
                  <div className={cn('h-2 rounded-full transition-all', getBarColor(dept.avgAttendanceRate))} style={{ width: `${dept.avgAttendanceRate}%` }} />
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.textMuted }}>
                  <span>{tr('غياب', 'Absent')}: <strong style={{ color: C.red }}>{dept.totalAbsentDays}</strong> {tr('يوم', 'days')}</span>
                  <span>{tr('تأخير', 'Late')}: <strong style={{ color: C.orange }}>{dept.totalLateDays}</strong> {tr('يوم', 'days')}</span>
                </div>

                {expanded === dept.departmentId && dept.topAbsentees.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>
                      {tr('أكثر الغائبين', 'Top Absentees')}
                    </p>
                    <CVisionTable C={C}>
                      <CVisionTableHead C={C}>
                          <CVisionTh C={C} style={{ fontSize: 12 }}>{tr('الموظف', 'Employee')}</CVisionTh>
                          <CVisionTh C={C} style={{ fontSize: 12, textAlign: isRTL ? 'left' : 'right' }}>{tr('أيام الغياب', 'Absent Days')}</CVisionTh>
                      </CVisionTableHead>
                      <CVisionTableBody>
                        {dept.topAbsentees.map((a, i) => (
                          <CVisionTr C={C} key={a.employeeId}>
                            <CVisionTd style={{ fontSize: 13, paddingTop: 6, paddingBottom: 6 }}>
                              <span style={{ color: C.textMuted, marginInlineEnd: 8 }}>{i + 1}.</span>
                              {a.name}
                            </CVisionTd>
                            <CVisionTd align="right" style={{ fontSize: 13, paddingTop: 6, paddingBottom: 6, textAlign: isRTL ? 'left' : 'right', fontWeight: 500, color: C.red }}>
                              {a.absentDays}
                            </CVisionTd>
                          </CVisionTr>
                        ))}
                      </CVisionTableBody>
                    </CVisionTable>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}
    </div>
  );
}
