'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Globe, CheckCircle2, Clock, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import type { ProfileResponse } from './types';

interface MuqeemRecord {
  employeeId: string;
  employeeName: string;
  iqamaNumber: string;
  iqamaExpiryDate: string;
  passportNumber: string;
  passportExpiryDate: string;
  nationality: string;
  absherStatus: string;
  lastAbsherCheck?: string;
  currentStatus: string;
  daysRemaining: number;
  exitReentryVisas?: { status: string }[];
}

interface MuqeemCardProps {
  profile: ProfileResponse;
  editData: Record<string, Record<string, any>>;
}

const FLAG_MAP: Record<string, string> = {
  SA: '\ud83c\uddf8\ud83c\udde6', EG: '\ud83c\uddea\ud83c\uddec', PK: '\ud83c\uddf5\ud83c\uddf0',
  IN: '\ud83c\uddee\ud83c\uddf3', PH: '\ud83c\uddf5\ud83c\udded', BD: '\ud83c\udde7\ud83c\udde9',
  JO: '\ud83c\uddef\ud83c\uddf4', SY: '\ud83c\uddf8\ud83c\uddfe', YE: '\ud83c\uddfe\ud83c\uddea',
  SD: '\ud83c\uddf8\ud83c\udde9', LB: '\ud83c\uddf1\ud83c\udde7', US: '\ud83c\uddfa\ud83c\uddf8',
  GB: '\ud83c\uddec\ud83c\udde7',
};

function statusInfo(status: string, days: number) {
  if (status === 'EXPIRED') return { text: 'Expired', variant: 'danger' as const };
  if (status === 'EXPIRING_SOON' || days <= 90) return { text: `Expiring Soon (${days} days)`, variant: 'warning' as const };
  return { text: 'Valid', variant: 'success' as const };
}

const fmtShort = (d: string | undefined | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '\u2014';

const fmtPassport = (d: string | undefined | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '\u2014';

function isSaudi(nationalityRaw: string | undefined | null): boolean {
  if (!nationalityRaw) return false;
  const n = nationalityRaw.toLowerCase().trim();
  return n === 'sa' || n === 'saudi' || n === 'saudi arabian';
}

export default function MuqeemCard({ profile, editData }: MuqeemCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [record, setRecord] = useState<MuqeemRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const employeeId = profile.employee.id;
  const personalData = profile.sections?.PERSONAL?.dataJson || editData?.PERSONAL || {};
  const nationality = personalData.nationality || personalData.nationalityCode || '';
  const saudi = isSaudi(nationality);

  useEffect(() => {
    if (saudi) { setLoading(false); return; }
    const ac = new AbortController();
    async function fetchMuqeem() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cvision/muqeem?action=detail&employeeId=${employeeId}`, { credentials: 'include', signal: ac.signal });
        const json = await res.json();
        if (json.success && json.data) { setRecord(json.data); setNotFound(false); }
        else { setNotFound(true); }
      } catch { if (!ac.signal.aborted) setNotFound(true); }
      finally { if (!ac.signal.aborted) setLoading(false); }
    }
    fetchMuqeem();
    return () => ac.abort();
  }, [employeeId, saudi]);

  function InfoRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textMuted, fontSize: 13 }}>{label}</span>
        {children || <span style={{ fontSize: 13, color: C.text }}>{value || '\u2014'}</span>}
      </div>
    );
  }

  if (saudi) {
    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>{'\ud83c\uddf8\ud83c\udde6'}</span>
        <div>
          <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{tr('مواطن سعودي', 'Saudi National')}</p>
          <p style={{ fontSize: 12, color: C.textMuted }}>{tr('لا يتطلب إقامة', 'No Iqama Required')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe style={{ width: 16, height: 16, color: C.textMuted }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الإقامة والتأشيرة', 'Iqama & Visa')}</h3>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CVisionSkeletonCard C={C} height={16} />
          <CVisionSkeletonCard C={C} height={16} />
          <CVisionSkeletonCard C={C} height={16} />
        </div>
      </div>
    );
  }

  if (notFound || !record) {
    return (
      <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe style={{ width: 16, height: 16, color: C.textMuted }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الإقامة والتأشيرة', 'Iqama & Visa')}</h3>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{tr('لا يوجد سجل إقامة لهذا الموظف.', 'No iqama record found for this employee.')}</p>
          <Link href="/cvision/muqeem">
            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<Shield style={{ width: 12, height: 12 }} />}>
              {tr('إضافة سجل', 'Add Record')}
            </CVisionButton>
          </Link>
        </div>
      </div>
    );
  }

  const status = statusInfo(record.currentStatus, record.daysRemaining);
  const activeVisa = record.exitReentryVisas?.find(v => v.status === 'ISSUED' || v.status === 'DEPARTED');
  const passportDaysLeft = record.passportExpiryDate
    ? Math.floor((new Date(record.passportExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Globe style={{ width: 16, height: 16, color: C.textMuted }} />
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
          {tr('الإقامة والتأشيرة', 'Iqama & Visa')}
        </h3>
        {FLAG_MAP[record.nationality] && <span>{FLAG_MAP[record.nationality]}</span>}
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
        {/* Iqama */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <InfoRow label={tr('الإقامة', 'Iqama')}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.text }}>{record.iqamaNumber}</span>
          </InfoRow>
          <InfoRow label={tr('الانتهاء', 'Expiry')} value={fmtShort(record.iqamaExpiryDate)} />
          <InfoRow label={tr('الحالة', 'Status')}>
            <CVisionBadge C={C} variant={status.variant}>{status.text}</CVisionBadge>
          </InfoRow>
        </div>

        {/* Passport */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <InfoRow label={tr('الجواز', 'Passport')}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{record.passportNumber}</span>
          </InfoRow>
          <InfoRow label={tr('الانتهاء', 'Expiry')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.text }}>
              {fmtPassport(record.passportExpiryDate)}
              {passportDaysLeft !== null && passportDaysLeft > 180 && <CheckCircle2 style={{ width: 12, height: 12, color: C.green }} />}
              {passportDaysLeft !== null && passportDaysLeft <= 180 && passportDaysLeft > 0 && <AlertTriangle style={{ width: 12, height: 12, color: C.orange }} />}
              {passportDaysLeft !== null && passportDaysLeft <= 0 && <AlertTriangle style={{ width: 12, height: 12, color: C.red }} />}
            </span>
          </InfoRow>
        </div>

        {/* Exit Visa */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <InfoRow label={tr('تأشيرة خروج', 'Exit Visa')} value={activeVisa ? `${tr('نشطة', 'Active')} (${activeVisa.status})` : tr('لا يوجد نشطة', 'None active')} />
        </div>

        {/* Absher */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <InfoRow label={tr('أبشر', 'Absher')}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.text }}>
              {record.absherStatus === 'VERIFIED'
                ? <><CheckCircle2 style={{ width: 14, height: 14, color: C.green }} /> {tr('موثق', 'Verified')}</>
                : record.absherStatus === 'MISMATCH'
                  ? <><AlertTriangle style={{ width: 14, height: 14, color: C.red }} /> {tr('عدم تطابق', 'Mismatch')}</>
                  : <><Clock style={{ width: 14, height: 14, color: C.orange }} /> {record.absherStatus || tr('قيد الانتظار', 'Pending')}</>
              }
            </span>
          </InfoRow>
        </div>

        {/* Link */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <Link href="/cvision/muqeem" style={{ textDecoration: 'none' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<ArrowRight style={{ width: 12, height: 12 }} />} style={{ width: '100%' }}>
              {tr('عرض السجل الكامل', 'View Full Record')}
            </CVisionButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
