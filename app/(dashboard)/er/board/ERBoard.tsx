'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErPageShell } from '@/components/er/ErPageShell';
import { ErStatusPill } from '@/components/er/ErStatusPill';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { cn } from '@/lib/utils';
import { deriveErRole } from '@/lib/er/role';
import { TheaStatusBadge } from '@/components/thea-ui';
import { Building2 } from 'lucide-react';

type BoardItem = {
  id: string;
  visitNumber?: string | null;
  patientName: string;
  mrn: string;
  status: string;
  triageLevel?: number | null;
  triageComplete?: boolean;
  triageMissing?: string[];
  stageLabel?: string | null;
  stageStartedAt?: string | null;
  bedLabel?: string | null;
  bedZone?: string | null;
  doctorId?: string | null;
  nurseId?: string | null;
  paymentStatus?: string | null;
  arrivalMethod?: string | null;
  critical?: boolean;
  respiratoryDecision?: 'ISOLATE' | 'PRECAUTIONS' | 'NO' | null;
};

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'in-bed', label: 'In Bed' },
  { key: 'seen', label: 'Seen' },
  { key: 'results', label: 'Pending Results' },
  { key: 'dispo', label: 'Dispo' },
] as const;

export default function ERBoard() {
  const router = useRouter();
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/board');
  const { me } = useMe();
  const permissions = me?.user?.permissions || [];
  const role = deriveErRole(permissions);

  const defaultFilter = role === 'reception' ? 'waiting' : 'all';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>(defaultFilter);
  const getFilterLabel = (key: (typeof FILTERS)[number]['key']) => {
    if (key === 'all') return tr('الكل', 'All');
    if (key === 'waiting') return tr('بانتظار الفرز', 'Waiting');
    if (key === 'in-bed') return tr('على السرير', 'In Bed');
    if (key === 'seen') return tr('تمت المعاينة', 'Seen');
    if (key === 'results') return tr('نتائج معلّقة', 'Pending Results');
    return tr('قرار', 'Dispo');
  };

  const { data, isLoading: isBoardLoading } = useSWR<{ items: BoardItem[] }>(
    '/api/er/board',
    fetcher,
    { refreshInterval: 5000 }
  );

  const filtered = useMemo(() => {
    const items = data?.items || [];
    return items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'waiting') return ['REGISTERED', 'TRIAGE_IN_PROGRESS', 'TRIAGE_COMPLETED', 'TRIAGED', 'WAITING_BED'].includes(item.status);
      if (filter === 'in-bed') return ['IN_BED'].includes(item.status);
      if (filter === 'seen') return ['SEEN_BY_DOCTOR'].includes(item.status);
      if (filter === 'results') return ['RESULTS_PENDING', 'ORDERS_IN_PROGRESS'].includes(item.status);
      if (filter === 'dispo') return ['DECISION', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'DEATH'].includes(item.status);
      return true;
    });
  }, [data, filter]);

  const computeElapsedMinutes = (stageStartedAt?: string | null) => {
    if (!stageStartedAt) return null;
    const start = new Date(stageStartedAt);
    if (Number.isNaN(start.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
  };

  const formatStageElapsed = (stageLabel?: string | null, stageStartedAt?: string | null) => {
    if (!stageLabel || !stageStartedAt) return '—';
    const start = new Date(stageStartedAt);
    if (Number.isNaN(start.getTime())) return '—';
    const minutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000));
    if (minutes < 60) return `${stageLabel}: ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${stageLabel}: ${hours}h ${mins}m`;
  };

  const formatStageLabel = (value?: string | null) => {
    const label = String(value || '').toUpperCase();
    if (label === 'WAITING_BED') return tr('بانتظار سرير', 'Waiting Bed');
    if (label === 'IN_BED') return tr('في السرير', 'In Bed');
    if (label === 'SEEN') return tr('تمت المعاينة', 'Seen');
    if (label === 'PENDING_RESULTS') return tr('بانتظار النتائج', 'Pending Results');
    if (label === 'DISPO') return tr('القرار', 'Dispo');
    if (label === 'WAITING') return tr('بالانتظار', 'Waiting');
    return label || tr('بالانتظار', 'Waiting');
  };

  const getSlaLevel = (item: BoardItem) => {
    const stage = String(item.stageLabel || '').toUpperCase();
    const elapsed = computeElapsedMinutes(item.stageStartedAt);
    if (elapsed == null) return 'OK';
    if (stage === 'WAITING') {
      if (elapsed > 30) return 'CRIT';
      if (elapsed > 15) return 'WARN';
      return 'OK';
    }
    if (stage === 'IN_BED') {
      const status = String(item.status || '').toUpperCase();
      const seen = status === 'SEEN_BY_DOCTOR' || status === 'ORDERS_IN_PROGRESS' || status === 'RESULTS_PENDING' || status === 'DECISION';
      if (!seen && elapsed > 30) return 'CRIT';
    }
    if (stage === 'PENDING_RESULTS' || stage === 'RESULTS_PENDING') {
      if (elapsed > 90) return 'CRIT';
    }
    return 'OK';
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <ErPageShell
      isRTL={isRTL}
      title={tr('لوحة متابعة الطوارئ', 'ER Tracking Board')}
      subtitle={tr('يتم التحديث كل 5 ثوانٍ.', 'Updated every 5 seconds.')}
      actions={
        <>
          <button onClick={() => router.push('/er/register')}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted thea-transition-fast">
            {tr('تسجيل سريع', 'Quick Register')}
          </button>
          <button onClick={() => router.push('/er/beds')}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted thea-transition-fast">
            {tr('خريطة الأسرّة', 'Bed Map')}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-full border font-medium text-[13px] thea-transition-fast ${
              filter === tab.key
                ? 'bg-primary border-primary text-white font-bold'
                : 'bg-card border-border text-foreground hover:-translate-y-px hover:shadow-sm'
            }`}>
            {getFilterLabel(tab.key)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-extrabold text-base text-foreground">{tr('اللوحة', 'Board')}</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} {tr('زيارة', 'visits')}</span>
        </div>
        <div className="pt-0">
          {isBoardLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">{tr('جارٍ التحميل...', 'Loading...')}</div>
          )}
          {!isBoardLoading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Building2 className="h-7 w-7 text-muted-foreground" /></div>
              <div className="text-sm font-medium text-muted-foreground">{tr('لا توجد زيارات في هذا العرض.', 'No visits in this view.')}</div>
            </div>
          )}
          {!isBoardLoading && filtered.length > 0 && (
            <>
              {/* Desktop header row */}
              <div className="hidden md:grid grid-cols-[2fr_80px_auto_auto_auto] gap-3 px-5 py-3 bg-muted/30 border-b border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('المريض', 'Patient')}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{tr('الفرز', 'Triage')}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[120px]">{tr('الحالة', 'Status')}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider min-w-[140px]">{tr('الانتظار / السرير', 'Wait / Bed')}</span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right min-w-[140px]">{tr('الإجراءات', 'Actions')}</span>
              </div>

              {/* Desktop rows */}
              <div className="hidden md:block">
                {filtered.map((item) => {
                  const displayStatus = item.status === 'TRIAGED' ? 'TRIAGE_COMPLETED' : item.status;
                  const missing = Array.isArray(item.triageMissing) ? item.triageMissing : [];
                  const triageReady = missing.length === 0;
                  const hideTriageAction = displayStatus === 'TRIAGE_COMPLETED' || Boolean(item.triageComplete);
                  const missingLabel = missing
                    .map((m) => {
                      if (m === 'chiefComplaint') return tr('الشكوى الرئيسية', 'Chief complaint');
                      if (m === 'triageLevel') return tr('مستوى الفرز', 'Triage level');
                      if (m === 'systolic') return tr('الانقباضي', 'Systolic');
                      if (m === 'diastolic') return tr('الانبساطي', 'Diastolic');
                      if (m === 'HR') return tr('معدل القلب', 'HR');
                      if (m === 'RR') return tr('معدل التنفس', 'RR');
                      if (m === 'TEMP') return tr('الحرارة', 'Temp');
                      if (m === 'SPO2') return tr('تشبع الأكسجين', 'SpO₂');
                      return m;
                    })
                    .join(', ');

                  const stageLabel = formatStageLabel(item.stageLabel);
                  const slaLevel = getSlaLevel(item);

                  return (
                    <div key={item.id}
                      onClick={() => router.push(`/er/encounter/${item.id}`)}
                      className={cn(
                        'grid grid-cols-[2fr_80px_auto_auto_auto] gap-3 px-5 py-3.5 border-b border-border last:border-0 cursor-pointer thea-hover-lift thea-transition-fast items-center group',
                        item.critical && 'bg-red-50/50 dark:bg-red-950/10 border-l-4 border-l-red-500'
                      )}>
                      {/* Patient info */}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground">{item.patientName}</div>
                        <div className="text-[11px] text-muted-foreground">{item.mrn}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr('زيارة الطوارئ', 'ER Visit')}: {item.visitNumber || 'ER-—'} • {tr('الطبيب', 'Doctor')}: {item.doctorId || '—'} • {tr('التمريض', 'Nurse')}: {item.nurseId || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr('الدفع', 'Payment')}: {item.paymentStatus || '—'} • {tr('طريقة الوصول', 'Arrival')}: {item.arrivalMethod || '—'}
                        </div>
                      </div>

                      {/* Triage level */}
                      <div>
                        <span className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-bold',
                          item.triageLevel === 1 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' :
                          item.triageLevel === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' :
                          item.triageLevel === 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                          item.triageLevel === 4 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                          item.triageLevel === 5 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {item.triageLevel ?? '--'}
                        </span>
                        {!triageReady && <div className="text-[10px] text-muted-foreground mt-0.5">{tr('ناقص', 'Missing')}</div>}
                      </div>

                      {/* Status */}
                      <div className="min-w-[120px] flex flex-wrap items-center gap-1.5">
                        <ErStatusPill status={displayStatus} critical={item.critical} />
                        {item.respiratoryDecision && item.respiratoryDecision !== 'NO' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            {item.respiratoryDecision === 'ISOLATE' ? tr('عزل', 'Isolate') : tr('احتياطات', 'Precautions')}
                          </span>
                        )}
                      </div>

                      {/* Wait / Bed */}
                      <div className="min-w-[140px]">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums border',
                          slaLevel === 'CRIT' ? 'border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400' :
                          slaLevel === 'WARN' ? 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400' :
                          'border-border text-muted-foreground bg-muted/20'
                        )}>
                          {formatStageElapsed(stageLabel, item.stageStartedAt)}
                        </span>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.bedLabel ? `${item.bedZone}-${item.bedLabel}` : tr('بدون سرير', 'No bed')}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="min-w-[140px] text-right flex items-center justify-end gap-2">
                        {!item.bedLabel ? (
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/er/beds?encounterId=${encodeURIComponent(item.id)}`); }}
                            className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast">
                            {tr('تخصيص سرير', 'Assign Bed')}
                          </button>
                        ) : null}
                        {!hideTriageAction ? (
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/er/triage/${item.id}`); }}
                            className="px-3 py-1.5 rounded-xl border border-primary text-xs font-bold text-primary hover:bg-primary/10 thea-transition-fast">
                            {tr('فرز', 'Triage')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {filtered.map((item) => {
                  const displayStatus = item.status === 'TRIAGED' ? 'TRIAGE_COMPLETED' : item.status;
                  const missing = Array.isArray(item.triageMissing) ? item.triageMissing : [];
                  const triageReady = missing.length === 0;
                  const hideTriageAction = displayStatus === 'TRIAGE_COMPLETED' || Boolean(item.triageComplete);
                  const stageLabel = formatStageLabel(item.stageLabel);
                  const slaLevel = getSlaLevel(item);

                  return (
                    <div key={item.id} onClick={() => router.push(`/er/encounter/${item.id}`)}
                      className={cn('p-4 cursor-pointer thea-transition-fast', item.critical && 'bg-red-50/50 dark:bg-red-950/10')}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{item.patientName}</div>
                          <div className="text-[11px] text-muted-foreground">{item.mrn}</div>
                        </div>
                        <span className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-xl text-sm font-bold',
                          item.triageLevel === 1 ? 'bg-red-100 text-red-700' :
                          item.triageLevel === 2 ? 'bg-orange-100 text-orange-700' :
                          item.triageLevel === 3 ? 'bg-amber-100 text-amber-700' :
                          item.triageLevel === 4 ? 'bg-green-100 text-green-700' :
                          item.triageLevel === 5 ? 'bg-blue-100 text-blue-700' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {item.triageLevel ?? '--'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <ErStatusPill status={displayStatus} critical={item.critical} />
                        <span className={cn(
                          'text-xs font-bold tabular-nums px-1.5 py-0.5 rounded border',
                          slaLevel === 'CRIT' ? 'border-red-400 text-red-700 bg-red-50' :
                          slaLevel === 'WARN' ? 'border-amber-400 text-amber-700 bg-amber-50' :
                          'border-border text-muted-foreground'
                        )}>
                          {formatStageElapsed(stageLabel, item.stageStartedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {item.bedLabel ? `${item.bedZone}-${item.bedLabel}` : tr('بدون سرير', 'No bed')}
                        </span>
                        <div className="flex gap-2">
                          {!item.bedLabel ? (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/er/beds?encounterId=${encodeURIComponent(item.id)}`); }}
                              className="px-2 py-1 rounded-lg text-[11px] font-medium border border-border thea-transition-fast">
                              {tr('سرير', 'Bed')}
                            </button>
                          ) : null}
                          {!hideTriageAction ? (
                            <button onClick={(e) => { e.stopPropagation(); router.push(`/er/triage/${item.id}`); }}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold text-primary border border-primary thea-transition-fast">
                              {tr('فرز', 'Triage')}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </ErPageShell>
  );
}
