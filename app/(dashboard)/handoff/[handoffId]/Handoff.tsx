'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface HandoffProps {
  params?: { handoffId?: string };
}

interface HandoffData {
  finalStatus?: string;
  encounterId?: string;
  patient?: { fullName?: string; mrn?: string; tempMrn?: string };
  riskFlags?: { sepsisSuspected?: boolean; hasOpenEscalation?: boolean };
  pendingTasks?: { id: string; label?: string; kind?: string; status?: string }[];
  pendingResults?: { id: string; label?: string; kind?: string }[];
  doctorSummary?: { content?: string } | null;
  nursingSummary?: { situation?: string; background?: string; assessment?: string; recommendation?: string } | null;
  reasonForAdmission?: string;
}

export default function Handoff(props: HandoffProps) {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/handoff');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const handoffId = String(props.params?.handoffId || '');
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

  const { data, isLoading: loading } = useSWR(
    hasPermission && canAccess && handoffId ? `/api/handoff/${handoffId}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const apiData = data as { handoff?: HandoffData; error?: string } | undefined;
  const handoff: HandoffData | null = apiData?.handoff || null;
  const error = apiData?.error || null;

  if (isLoading || loading) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{tr('تسليم القبول', 'Admission Handoff')}</CardTitle>
            <CardDescription>{tr('جاري التحميل...', 'Loading...')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!hasPermission || !canAccess) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{tr('تسليم القبول', 'Admission Handoff')}</CardTitle>
            <CardDescription>{tr('محظور', 'Forbidden')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {tr('هذا العارض مقتصر على أدوار المشرف/الإدارة/الاستقبال.', 'This viewer is restricted to charge/admin/receiving roles.')}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{tr('تسليم القبول', 'Admission Handoff')}</CardTitle>
            <CardDescription>{error || tr('غير موجود', 'Not found')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/er/board">{tr('العودة للوحة الطوارئ', 'Back to ER Board')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const patient = handoff.patient || {};
  const flags = handoff.riskFlags || {};
  const pendingTasks = Array.isArray(handoff.pendingTasks) ? handoff.pendingTasks : [];
  const pendingResults = Array.isArray(handoff.pendingResults) ? handoff.pendingResults : [];
  const doctorSummary = handoff.doctorSummary || null;
  const nursingSummary = handoff.nursingSummary || null;

  return (
    <div className="p-6 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{tr('جسر القبول (قراءة فقط)', 'Admission Bridge (read-only)')}</div>
          <h1 className="text-xl font-semibold">{tr('تسليم القبول', 'Admission Handoff')}</h1>
          <div className="text-sm text-muted-foreground">
            {tr('الحالة النهائية:', 'Final status:')} <Badge variant="secondary">{String(handoff.finalStatus || '')}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/er/board">{tr('لوحة الطوارئ', 'ER Board')}</Link>
          </Button>
          {handoff.encounterId ? (
            <Button asChild variant="outline">
              <Link href={`/er/encounter/${String(handoff.encounterId)}`}>{tr('فتح الزيارة', 'Open Encounter')}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{tr('المريض', 'Patient')}</CardTitle>
          <CardDescription>{tr('المعرفات وقت إنشاء التسليم', 'Identifiers at handoff creation time')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">{tr('الاسم:', 'Name:')}</span> {patient.fullName || '—'}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{tr('رقم الملف:', 'MRN:')} {patient.mrn || '—'}</Badge>
            <Badge variant="outline">{tr('رقم الملف المؤقت:', 'Temp MRN:')} {patient.tempMrn || '—'}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {flags.sepsisSuspected ? <Badge variant="destructive">{tr('اشتباه تعفن', 'Sepsis suspected')}</Badge> : <Badge variant="secondary">{tr('لا يوجد تعفن', 'No sepsis flag')}</Badge>}
            {flags.hasOpenEscalation ? <Badge variant="destructive">{tr('تصعيد مفتوح', 'Open escalation')}</Badge> : <Badge variant="secondary">{tr('لا يوجد تصعيد', 'No escalation')}</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{tr('السبب', 'Reason')}</CardTitle>
          <CardDescription>{tr('من التصرف وقت الانتهاء', 'From disposition at finalize time')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm whitespace-pre-wrap">
          {String(handoff.reasonForAdmission || '').trim() || '—'}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{tr('ملخص الطبيب (التقييم والخطة)', 'Doctor Summary (Assessment & Plan)')}</CardTitle>
          <CardDescription>{tr('آخر ملاحظة طبيب الطوارئ عند الانتهاء', 'Latest ER doctor note captured at finalize time')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm whitespace-pre-wrap">
          {String(doctorSummary?.content || '').trim() || '—'}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{tr('ملخص التمريض', 'Nursing Summary')}</CardTitle>
          <CardDescription>{tr('آخر تسليم تمريض (SBAR)', 'Latest nursing handover (SBAR)')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {nursingSummary ? (
            <>
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">{tr('الحالة:', 'Situation:')}</span> {String(nursingSummary.situation || '').trim() || '—'}
              </div>
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">{tr('الخلفية:', 'Background:')}</span> {String(nursingSummary.background || '').trim() || '—'}
              </div>
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">{tr('التقييم:', 'Assessment:')}</span> {String(nursingSummary.assessment || '').trim() || '—'}
              </div>
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">{tr('التوصية:', 'Recommendation:')}</span> {String(nursingSummary.recommendation || '').trim() || '—'}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">—</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{tr('العناصر المعلقة', 'Pending Items')}</CardTitle>
          <CardDescription>{tr('تم التقاطها وقت إنشاء التسليم', 'Captured at handoff creation time')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">
              {tr('المهام المعلقة', 'Pending Tasks')} <Badge variant="secondary">{pendingTasks.length}</Badge>
            </div>
            {pendingTasks.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('المهمة', 'Task')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTasks.map((t: { id: string; label?: string; kind?: string; status?: string }) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.label || t.kind || t.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{String(t.status || '')}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">{tr('لا توجد مهام معلقة.', 'No pending tasks.')}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">
              {tr('النتائج المعلقة', 'Pending Results')} <Badge variant="secondary">{pendingResults.length}</Badge>
            </div>
            {pendingResults.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('النتيجة', 'Result')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingResults.map((r: { id: string; label?: string; kind?: string }) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.label || r.kind || r.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground">{tr('لا توجد نتائج معلقة.', 'No pending results.')}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
