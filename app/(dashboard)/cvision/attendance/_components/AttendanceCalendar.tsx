'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { ChevronLeft, ChevronRight, Loader2, MapPin, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
interface CalendarDay {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isToday: boolean;
  status?: string;
  actualIn?: string;
  actualOut?: string;
  workedMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  source?: string;
  isOnLeave?: boolean;
  leaveType?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  employeeNo?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400',
  LATE: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400',
  ABSENT: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400',
  EARLY_LEAVE: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400',
  ON_LEAVE: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
  WEEKEND: 'bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500',
  INCOMPLETE: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
  HOLIDAY: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function AttendanceCalendar() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const DAY_NAMES = isRTL
    ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/employees?limit=500', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => {
        const emps = d.data?.employees || d.employees || d.data?.items || d.data || [];
        setEmployees(Array.isArray(emps) ? emps : []);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!selectedEmployee) {
      setCalendar([]);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    const m = month.toString().padStart(2, '0');
    fetch(
      `/api/cvision/attendance?action=calendar&employeeId=${selectedEmployee}&month=${m}&year=${year}`,
      { credentials: 'include', signal: ac.signal },
    )
      .then(r => r.json())
      .then(d => {
        setCalendar(d.data?.items || d.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [selectedEmployee, month, year]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else { setMonth(m => m - 1); }
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else { setMonth(m => m + 1); }
  }

  const firstDayOfWeek = calendar.length > 0 ? calendar[0].dayOfWeek : 0;
  const paddedDays: (CalendarDay | null)[] = [...Array(firstDayOfWeek).fill(null), ...calendar];

  const present = calendar.filter(d => d.status === 'PRESENT' || d.status === 'LATE').length;
  const absent = calendar.filter(d => d.status === 'ABSENT').length;
  const late = calendar.filter(d => d.status === 'LATE').length;
  const onLeave = calendar.filter(d => d.status === 'ON_LEAVE').length;

  const locale = isRTL ? 'ar-SA' : 'en-US';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <CVisionSelect
                C={C}
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                placeholder={tr('اختر الموظف', 'Select employee')}
                options={employees.map(emp => (
              ({ value: emp.id, label: `${emp.firstName} ${emp.lastName}${emp.employeeNumber || emp.employeeNo
                  ? ` (${emp.employeeNumber || emp.employeeNo})`
                  : ''}` })
            ))}
              />

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

      {/* Summary stats */}
      {selectedEmployee && calendar.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{present}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('حاضر', 'Present')}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{absent}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('غائب', 'Absent')}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{late}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('متأخر', 'Late')}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{onLeave}</p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجازة', 'On Leave')}</p>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {/* Calendar grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
          <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
        </div>
      ) : !selectedEmployee ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
            {tr('اختر موظفاً لعرض تقويم الحضور', 'Select an employee to view their attendance calendar')}
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16 }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {DAY_NAMES.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'text-center text-xs font-medium py-1',
                    i === 5 || i === 6 ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {paddedDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
                const dayNum = parseInt(day.date.split('-')[2]);
                const colorClass = STATUS_COLORS[day.status || ''] || 'bg-background';
                return (
                  <div
                    key={day.date}
                    className={cn(
                      'aspect-square rounded-md border p-1 flex flex-col items-center justify-center text-xs relative transition-colors',
                      colorClass,
                      day.isToday && 'ring-2 ring-primary ring-offset-1',
                    )}
                    title={`${day.date}\n${tr('الحالة', 'Status')}: ${day.status || 'N/A'}${day.actualIn ? `\n${tr('دخول', 'In')}: ${day.actualIn}` : ''}${day.actualOut ? `\n${tr('خروج', 'Out')}: ${day.actualOut}` : ''}${day.lateMinutes ? `\n${tr('تأخير', 'Late')}: ${day.lateMinutes}${tr('د', 'min')}` : ''}`}
                  >
                    <span style={{ fontWeight: 500 }}>{dayNum}</span>
                    {day.actualIn && !day.isWeekend && <span style={{ opacity: 0.7 }}>{day.actualIn}</span>}
                    {day.lateMinutes && day.lateMinutes > 0 ? (
                      <span style={{ color: C.red, fontWeight: 500 }}>+{day.lateMinutes}{tr('د', 'm')}</span>
                    ) : null}
                    {day.source === 'GPS' && <span style={{ position: 'absolute' }}><MapPin className="h-3 w-3" /></span>}
                    {day.source === 'WFH' && <span style={{ position: 'absolute' }}><Home className="h-3 w-3" /></span>}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              {[
                { status: 'PRESENT', label: tr('حاضر', 'Present') },
                { status: 'LATE', label: tr('متأخر', 'Late') },
                { status: 'ABSENT', label: tr('غائب', 'Absent') },
                { status: 'ON_LEAVE', label: tr('إجازة', 'On Leave') },
                { status: 'WEEKEND', label: tr('عطلة أسبوعية', 'Weekend') },
              ].map(({ status, label }) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={cn('w-3 h-3 rounded-sm border', STATUS_COLORS[status])} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}
