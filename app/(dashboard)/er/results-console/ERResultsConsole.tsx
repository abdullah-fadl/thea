'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { safeUUID } from '@/lib/utils/uuid';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type SeverityFilter = 'all' | 'normal' | 'abnormal' | 'critical';

export default function ERResultsConsole() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
    { value: 'all', label: tr('الكل', 'All') },
    { value: 'normal', label: tr('طبيعي', 'Normal') },
    { value: 'abnormal', label: tr('غير طبيعي', 'Abnormal') },
    { value: 'critical', label: tr('حرج', 'Critical') },
  ];
  const { hasPermission, isLoading } = useRoutePermission('/er/results-console');
  const { toast } = useToast();

  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [patientFilter, setPatientFilter] = useState('');
  const [ackingId, setAckingId] = useState<string | null>(null);

  const { data, isLoading: resultsLoading, mutate } = useSWR(
    hasPermission ? '/api/results/inbox?scope=mine&unacked=1' : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const rows = Array.isArray(data?.items) ? data.items : [];

  const filtered = useMemo(() => {
    const text = patientFilter.trim().toLowerCase();
    return rows.filter((item: any) => {
      if (String(item.encounterType || '').toUpperCase() !== 'ER') return false;
      if (severity !== 'all' && String(item.severity || 'normal') !== severity) return false;
      if (!text) return true;
      const mrn = String(item.mrn || item.tempMrn || '').toLowerCase();
      const name = String(item.patientName || '').toLowerCase();
      return mrn.includes(text) || name.includes(text);
    });
  }, [rows, patientFilter, severity]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const ackResult = async (resultId: string) => {
    setAckingId(resultId);
    try {
      const res = await fetch(`/api/results/${resultId}/ack`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: safeUUID() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل التأكيد', 'Failed to acknowledge'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تأكيد النتيجة.', 'Result acknowledged.') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setAckingId(null);
    }
  };

  const severityBadgeStyle = (value: string) => {
    if (value === 'critical') return 'border-destructive/50 text-destructive bg-destructive/10';
    if (value === 'abnormal') return 'border-amber-500/50 text-amber-700 bg-amber-500/10';
    return 'border-border text-muted-foreground';
  };

  const severityLabel = (value: string) => {
    if (value === 'critical') return tr('حرج', 'Critical');
    if (value === 'abnormal') return tr('غير طبيعي', 'Abnormal');
    return tr('طبيعي', 'Normal');
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr('وحدة نتائج الطوارئ', 'ER Results Console')}</h1>
          <p className="text-sm text-muted-foreground">
            {tr('النتائج غير المؤكدة لزيارات الطوارئ فقط.', 'Unacknowledged results for ER encounters only.')}
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('التصفية', 'Filters')}</h2>
            <p className="text-sm text-muted-foreground">{tr('تصفية حسب المريض أو الشدة.', 'Filter by patient or severity.')}</p>
          </div>
          <div className="p-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض (الاسم أو رقم الملف)', 'Patient (name or MRN)')}</label>
              <input
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                placeholder={tr('الاسم أو رقم الملف', 'Name or MRN')}
                className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشدة', 'Severity')}</label>
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted w-fit">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`px-4 py-2 text-sm rounded-xl thea-transition-fast ${
                      severity === opt.value
                        ? 'bg-card text-foreground shadow-sm font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('النتائج غير المؤكدة', 'Unacknowledged Results')}</h2>
            <p className="text-sm text-muted-foreground">{tr('تأكيد النتائج مباشرة دون فتح كل زيارة.', 'ACK results directly without opening each encounter.')}</p>
          </div>
          <div className="p-5">
            {resultsLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل…', 'Loading…')}</div>}
            {!resultsLoading && filtered.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">{tr('لا توجد نتائج غير مؤكدة.', 'No unacknowledged results.')}</div>
            )}
            {!resultsLoading && filtered.length > 0 && (
              <>
                {/* Header row */}
                <div className="hidden md:grid grid-cols-6 gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <div>{tr('المريض', 'Patient')}</div>
                  <div>{tr('الشدة', 'Severity')}</div>
                  <div>{tr('النوع', 'Kind')}</div>
                  <div>{tr('الملخص', 'Summary')}</div>
                  <div>{tr('التاريخ', 'Created')}</div>
                  <div className="text-right">{tr('الإجراء', 'Action')}</div>
                </div>

                {/* Data rows */}
                {filtered.map((item: any) => {
                  const mrn = item.mrn || item.tempMrn || '—';
                  return (
                    <div
                      key={item.resultId}
                      className="grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-3 px-3 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 thea-transition-fast rounded-xl"
                    >
                      <div>
                        <div className="font-medium text-sm text-foreground">{item.patientName || tr('غير معروف', 'Unknown')}</div>
                        <div className="text-xs text-muted-foreground">{tr('رقم الملف', 'MRN')}: {mrn}</div>
                      </div>
                      <div>
                        <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${severityBadgeStyle(String(item.severity || 'normal'))}`}>
                          {severityLabel(String(item.severity || 'normal'))}
                        </span>
                      </div>
                      <div className="text-sm text-foreground flex items-center gap-2">
                        <span>{item.kind || '—'}</span>
                        {item.source === 'CONNECT' ? (
                          <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{tr('خارجي', 'External')}</span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">{item.summary || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {item.deepLink && (
                          <Link
                            href={item.deepLink}
                            className="px-3 py-1 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
                          >
                            {tr('فتح', 'Open')}
                          </Link>
                        )}
                        {item.source !== 'CONNECT' ? (
                          <button
                            onClick={() => ackResult(item.resultId)}
                            disabled={ackingId === item.resultId}
                            className="px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 thea-transition-fast disabled:opacity-50"
                          >
                            {ackingId === item.resultId ? tr('جاري التأكيد...', 'ACK...') : tr('تأكيد', 'ACK')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
