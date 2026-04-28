'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, TrendingUp, Palmtree, FileCheck } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { ProfileResponse } from './types';

interface QuickStatsCardProps {
  profile: ProfileResponse;
  editData: Record<string, Record<string, any>>;
}

interface StatItem {
  labelAr: string;
  labelEn: string;
  value: string;
  icon: typeof Calendar;
  color: string;
}

interface DocStatus {
  label: string;
  daysLeft: number;
  status: 'valid' | 'expiring' | 'warning' | 'expired';
}

function isSaudiNationality(val: string | null | undefined): boolean {
  if (!val) return false;
  const n = val.toLowerCase().trim();
  return n === 'sa' || n === 'saudi' || n === 'saudi arabian' || n === 'saudi arabia';
}

function computeDaysLeft(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function docStatusColorInline(days: number, C: any): { dotColor: string; textColor: string; status: DocStatus['status'] } {
  if (days < 0) return { dotColor: C.red, textColor: C.red, status: 'expired' };
  if (days < 7) return { dotColor: C.red, textColor: C.red, status: 'expired' };
  if (days < 30) return { dotColor: C.orange, textColor: C.orange, status: 'warning' };
  if (days < 90) return { dotColor: C.orange, textColor: C.orange, status: 'expiring' };
  return { dotColor: C.green, textColor: C.green, status: 'valid' };
}

function formatDocDays(days: number): string {
  if (days < 0) return `EXPIRED (${Math.abs(days)} days ago)`;
  if (days === 0) return 'Expires today';
  return `${days} days`;
}

export default function QuickStatsCard({ profile, editData }: QuickStatsCardProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [attendanceRate, setAttendanceRate] = useState<string | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<string | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [loadingLeave, setLoadingLeave] = useState(true);

  const employeeId = profile.employee.id;
  const personalData = editData?.PERSONAL || profile.sections?.PERSONAL?.dataJson || {};
  const nationality = personalData.nationality || personalData.nationalityCode || '';
  const isSaudi = isSaudiNationality(nationality);

  const tenure = useMemo(() => {
    const hiredAt = profile.employee.hiredAt || editData.EMPLOYMENT?.hiredAt;
    if (!hiredAt) return 'N/A';
    const hireDate = new Date(hiredAt);
    if (isNaN(hireDate.getTime())) return 'N/A';
    const now = new Date();
    if (hireDate > now) {
      const diffDays = Math.ceil((hireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `${tr('يبدأ في', 'Starts in')} ${diffDays}${tr('ي', 'd')}`;
    }
    const totalDays = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
    if (totalDays < 30) return `${totalDays} ${tr('يوم', 'day')}${!isRTL && totalDays !== 1 ? 's' : ''}`;
    let years = now.getFullYear() - hireDate.getFullYear();
    let months = now.getMonth() - hireDate.getMonth();
    if (now.getDate() < hireDate.getDate()) months--;
    if (months < 0) { years--; months += 12; }
    if (years === 0) return `${months} ${tr('شهر', 'month')}${!isRTL && months !== 1 ? 's' : ''}`;
    if (months === 0) return `${years} ${tr('سنة', 'year')}${!isRTL && years !== 1 ? 's' : ''}`;
    return `${years}${tr('س', 'y')} ${months}${tr('ش', 'mo')}`;
  }, [profile.employee.hiredAt, editData.EMPLOYMENT?.hiredAt, tr, isRTL]);

  const age = useMemo(() => {
    const dob = editData.PERSONAL?.dob || editData.PERSONAL?.dateOfBirth;
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 'N/A';
    const now = new Date();
    let ageYears = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) ageYears--;
    if (ageYears < 0) return 'N/A';
    return `${ageYears}`;
  }, [editData.PERSONAL?.dob, editData.PERSONAL?.dateOfBirth]);

  useEffect(() => {
    const ac = new AbortController();
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    fetch(`/api/cvision/attendance?action=monthly-summary&employeeId=${employeeId}&month=${month}&year=${year}`, { credentials: 'include', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.summary?.attendanceRate != null) setAttendanceRate(`${Math.round(data.summary.attendanceRate)}%`);
        else setAttendanceRate('--');
      })
      .catch(() => {})
      .finally(() => setLoadingAttendance(false));
    return () => ac.abort();
  }, [employeeId]);

  useEffect(() => {
    const ac = new AbortController();
    const year = new Date().getFullYear();
    fetch(`/api/cvision/leaves?action=balance&employeeId=${employeeId}&year=${year}`, { credentials: 'include', signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.balance?.remaining != null) setLeaveBalance(`${data.balance.remaining}${tr('ي', 'd')}`);
        else setLeaveBalance('--');
      })
      .catch(() => {})
      .finally(() => setLoadingLeave(false));
    return () => ac.abort();
  }, [employeeId, tr]);

  const documentStatuses = useMemo(() => {
    const docs: DocStatus[] = [];
    const idLabel = isSaudi ? tr('هوية وطنية', 'National ID') : tr('إقامة', 'Iqama');
    const idDays = computeDaysLeft(personalData.idExpiryDate);
    if (idDays !== null) docs.push({ label: idLabel, daysLeft: idDays, status: docStatusColorInline(idDays, C).status });
    const passportDays = computeDaysLeft(personalData.passportExpiryDate);
    if (passportDays !== null) docs.push({ label: tr('جواز السفر', 'Passport'), daysLeft: passportDays, status: docStatusColorInline(passportDays, C).status });
    if (!isSaudi) {
      const visaDays = computeDaysLeft(personalData.visaExpiryDate);
      if (visaDays !== null) docs.push({ label: tr('التأشيرة', 'Visa'), daysLeft: visaDays, status: docStatusColorInline(visaDays, C).status });
    }
    return docs;
  }, [personalData.idExpiryDate, personalData.passportExpiryDate, personalData.visaExpiryDate, isSaudi, C, tr]);

  const STAT_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b'];

  const stats: StatItem[] = [
    { labelAr: 'المدة', labelEn: 'Tenure', value: tenure, icon: Calendar, color: STAT_COLORS[0] },
    { labelAr: 'العمر', labelEn: 'Age', value: age, icon: Clock, color: STAT_COLORS[1] },
    { labelAr: 'الحضور', labelEn: 'Attendance', value: attendanceRate || '--', icon: TrendingUp, color: STAT_COLORS[2] },
    { labelAr: 'رصيد الإجازات', labelEn: 'Leave Balance', value: leaveBalance || '--', icon: Palmtree, color: STAT_COLORS[3] },
  ];

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('إحصائيات سريعة', 'Quick Stats')}</h3>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            const isLoading = (stat.labelEn === 'Attendance' && loadingAttendance) ||
                              (stat.labelEn === 'Leave Balance' && loadingLeave);
            return (
              <div
                key={stat.labelEn}
                style={{
                  borderLeft: isRTL ? 'none' : `4px solid ${stat.color}`,
                  borderRight: isRTL ? `4px solid ${stat.color}` : 'none',
                  background: `${stat.color}08`,
                  borderRadius: isRTL ? '8px 0 0 8px' : '0 8px 8px 0',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <StatIcon style={{ width: 14, height: 14, color: C.textMuted }} />
                  <span style={{ fontSize: 12, color: C.textMuted }}>{tr(stat.labelAr, stat.labelEn)}</span>
                </div>
                {isLoading ? (
                  <CVisionSkeletonCard C={C} height={24} />
                ) : (
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{stat.value}</p>
                )}
              </div>
            );
          })}
        </div>

        {documentStatuses.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <FileCheck style={{ width: 14, height: 14, color: C.textMuted }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>
                {tr('حالة الوثائق', 'Document Status')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {documentStatuses.map((doc) => {
                const colors = docStatusColorInline(doc.daysLeft, C);
                return (
                  <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', height: 8, width: 8, borderRadius: '50%', background: colors.dotColor }} />
                      <span style={{ color: C.textMuted }}>{doc.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: colors.textColor }}>
                      {doc.daysLeft < 0 ? tr('منتهي', 'EXPIRED') : tr('ساري', 'Valid')} ({formatDocDays(doc.daysLeft)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
