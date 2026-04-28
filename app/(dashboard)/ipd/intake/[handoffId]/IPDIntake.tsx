'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';

interface HandoffData {
  handoff?: {
    patient?: Record<string, unknown>;
    pendingTasks?: Array<{ id: string; label?: string; kind?: string; status?: string }>;
    pendingResults?: unknown[];
    finalStatus?: string;
  } | null;
  error?: string | null;
}

export default function IPDIntake(props: { params?: { handoffId?: string } }) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/ipd/intake');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const handoffId = String(props?.params?.handoffId || '').trim();
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

  const { data, isLoading: loading, mutate } = useSWR(
    hasPermission && canAccess && handoffId ? `/api/handoff/${handoffId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const [busy, setBusy] = useState(false);
  const [createdEpisodeId, setCreatedEpisodeId] = useState<string | null>(null);

  const typedData = data as HandoffData | undefined;
  const handoff = typedData?.handoff || null;
  const error = typedData?.error || null;

  const createEpisode = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/ipd/admission-intake/from-handoff', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoffId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create episode');
      setCreatedEpisodeId(String(payload.episodeId || ''));
      toast({
        title: tr('نجاح', 'Success'),
        description: payload.noOp ? tr('الحلقة موجودة مسبقاً.', 'Episode already exists.') : tr('تم إنشاء حلقة IPD.', 'IPD episode created.'),
      });
      await mutate();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Record<string, unknown>)?.message as string || tr('فشل', 'Failed'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('قبول التنويم', 'Inpatient Admission Intake')}</h2>
          <p className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!hasPermission || !canAccess) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('قبول التنويم', 'Inpatient Admission Intake')}</h2>
          <p className="text-sm text-muted-foreground">{tr('محظور', 'Forbidden')}</p>
          <div className="text-sm text-muted-foreground">
            {tr('هذه الصفحة مقتصرة على أدوار المشرف/الإدارة/الاستقبال.', 'This page is restricted to charge/admin/receiving roles.')}
          </div>
        </div>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="p-6">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{tr('قبول التنويم', 'Inpatient Admission Intake')}</h2>
          <p className="text-sm text-muted-foreground">{error || tr('التسليم غير موجود', 'Handoff not found')}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/er/board">{tr('العودة للوحة الطوارئ', 'Back to ER Board')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const patient = (handoff?.patient || {}) as Record<string, unknown>;
  const pendingTasks = Array.isArray(handoff?.pendingTasks) ? handoff.pendingTasks : [];
  const pendingResults = Array.isArray(handoff?.pendingResults) ? handoff.pendingResults : [];
  const finalStatus = String(handoff?.finalStatus || '');

  const episodeLink = createdEpisodeId ? `/ipd/episode/${createdEpisodeId}` : null;

  return (
    <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Phase 5.1 (fresh)</div>
          <h1 className="text-xl font-semibold">{tr('قبول التنويم', 'Inpatient Admission Intake')}</h1>
          <div className="text-sm text-muted-foreground">
            {tr('المصدر:', 'Source:')} <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">{tr('تسليم قبول الطوارئ', 'ER Admission Handoff')}</span>{' '}
            <span className="ml-2">
              {tr('الحالة النهائية:', 'Final status:')} <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{finalStatus || '—'}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/handoff/${handoffId}`}>{tr('عرض التسليم', 'View Handoff')}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/er/board">{tr('لوحة الطوارئ', 'ER Board')}</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('المريض', 'Patient')}</h2>
        <p className="text-sm text-muted-foreground">{tr('المعرفات من التسليم', 'Identifiers from handoff')}</p>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-muted-foreground">{tr('الاسم:', 'Name:')}</span> {String(patient.fullName || '—')}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('رقم الملف:', 'MRN:')} {String(patient.mrn || '—')}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{tr('رقم الملف المؤقت:', 'Temp MRN:')} {String(patient.tempMrn || '—')}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('اللقطة (قراءة فقط)', 'Snapshot (read-only)')}</h2>
        <p className="text-sm text-muted-foreground">{tr('العناصر المعلقة وقت التسليم', 'Pending items at time of handoff')}</p>
        <div className="space-y-4">
          <div className="text-sm">
            {tr('المهام المعلقة:', 'Pending Tasks:')} <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">{pendingTasks.length}</span>
            <span className="ml-3">
              {tr('النتائج المعلقة:', 'Pending Results:')} <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">{pendingResults.length}</span>
            </span>
          </div>

          {pendingTasks.length ? (
            <div>
              <div className="grid grid-cols-2 gap-4 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
              </div>
              <div>
                {pendingTasks.slice(0, 10).map((t) => (
                  <div key={t.id} className="grid grid-cols-2 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                    <span className="text-sm text-foreground">{t.label || t.kind || t.id}</span>
                    <span className="text-sm text-foreground">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{String(t.status || '')}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{tr('لا توجد مهام معلقة.', 'No pending tasks.')}</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{tr('إنشاء حلقة IPD', 'Create IPD Episode')}</h2>
        <p className="text-sm text-muted-foreground">{tr('يتم الإنشاء فقط من تسليم قبول الطوارئ هذا', 'Created only from this ER admission handoff')}</p>
        <div className="flex items-center gap-3">
          <Button onClick={createEpisode} disabled={busy} className="rounded-xl">
            {tr('إنشاء حلقة', 'Create Episode')}
          </Button>
          {episodeLink ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={episodeLink}>{tr('فتح الحلقة', 'Open Episode')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
