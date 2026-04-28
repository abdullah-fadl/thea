'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import OrTimeOutForm from '@/components/or/OrTimeOutForm';
import OrAnesthesiaForm from '@/components/or/OrAnesthesiaForm';
import OrPacuForm from '@/components/or/OrPacuForm';
import OrImplantsList from '@/components/or/OrImplantsList';
import OrTeamPanel from '@/components/or/OrTeamPanel';
import OrSurgicalCountForm from '@/components/or/OrSurgicalCountForm';
import OrSpecimenLog from '@/components/or/OrSpecimenLog';
import OrCirculatingNurseDoc from '@/components/or/OrCirculatingNurseDoc';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const NEXT_STEP: Record<string, string | null> = {
  START: 'PRE_OP',
  PRE_OP: 'TIME_OUT',
  TIME_OUT: 'INTRA_OP',
  INTRA_OP: 'POST_OP',
  POST_OP: 'RECOVERY',
  RECOVERY: null,
};

type TabKey = 'lifecycle' | 'team' | 'timeout' | 'anesthesia' | 'pacu' | 'implants' | 'counts' | 'specimens' | 'nursing-doc';

interface TabDef {
  key: TabKey;
  ar: string;
  en: string;
}

const TABS: TabDef[] = [
  { key: 'lifecycle',  ar: 'مسار العملية',         en: 'OR Lifecycle' },
  { key: 'team',       ar: 'الفريق الجراحي',        en: 'Surgical Team' },
  { key: 'timeout',    ar: 'التحقق الجراحي',        en: 'Time-Out' },
  { key: 'anesthesia', ar: 'التخدير',               en: 'Anesthesia' },
  { key: 'pacu',       ar: 'وحدة الإفاقة',          en: 'PACU' },
  { key: 'implants',   ar: 'المستلزمات',            en: 'Implants' },
  { key: 'counts',     ar: 'عدّ الأدوات',            en: 'Counts' },
  { key: 'specimens',  ar: 'العيّنات',               en: 'Specimens' },
  { key: 'nursing-doc', ar: 'التوثيق التمريضي',      en: 'Nursing Doc' },
];

export default function ORCase(props: any) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/cases');
  const caseId = String(props?.params?.caseId || '').trim();

  const [activeTab, setActiveTab] = useState<TabKey>('lifecycle');

  const { data, mutate } = useSWR(caseId ? `/api/or/cases/${caseId}` : null, fetcher, { refreshInterval: 0 });
  const orCase = data?.case || null;
  const events = Array.isArray(data?.events) ? data.events : [];

  const lastStep = events.length ? String(events[events.length - 1]?.step || '') : 'START';
  const nextStep = NEXT_STEP[lastStep] || null;

  const [preOpChecklist, setPreOpChecklist] = useState({
    patientIdentified: false,
    procedureConfirmed: false,
    siteMarked: false,
    allergiesReviewed: false,
  });
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentAt, setConsentAt] = useState('');
  const [surgeonUserId, setSurgeonUserId] = useState('');
  const [anesthesiaUserId, setAnesthesiaUserId] = useState('');
  const [preOpNotes, setPreOpNotes] = useState('');

  const [timeoutPatient, setTimeoutPatient] = useState(false);
  const [timeoutProcedure, setTimeoutProcedure] = useState(false);
  const [timeoutSite, setTimeoutSite] = useState(false);

  const [intraOpNote, setIntraOpNote] = useState('');
  const [intraOpStartAt, setIntraOpStartAt] = useState('');
  const [intraOpEndAt, setIntraOpEndAt] = useState('');

  const [postOpNote, setPostOpNote] = useState('');
  const [postOpComplications, setPostOpComplications] = useState(false);
  const [postOpComplicationDesc, setPostOpComplicationDesc] = useState('');

  const [recoverySummary, setRecoverySummary] = useState('');
  const [recoveryDestination, setRecoveryDestination] = useState<'WARD' | 'ICU' | 'DISCHARGE' | ''>('');

  const [saving, setSaving] = useState(false);

  const submitEvent = async (step: string, payload: Record<string, any>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/events`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed to save'));
      toast({ title: tr('تم الحفظ', 'Saved'), description: `${step} ${tr('سُجِّل', 'recorded')}.` });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div className="p-6 space-y-4 bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Case Header */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-foreground">{tr('قضية غرفة العمليات', 'OR Case')}</CardTitle>
              <CardDescription>{tr('تسلسل العمليات والتوثيق الجراحي', 'Append-only OR lifecycle & documentation')}</CardDescription>
            </div>
            <Badge variant={nextStep ? 'secondary' : 'default'} className="text-sm">
              {nextStep ? `${tr('الخطوة التالية', 'Next')}: ${nextStep}` : `✓ ${tr('مكتمل', 'Completed')}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{tr('رقم القضية', 'Case ID')}</p>
            <Badge variant="outline" className="font-mono">{caseId ? caseId.slice(0, 8) : '—'}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{tr('الإجراء', 'Procedure')}</p>
            <p className="text-foreground">{orCase?.procedureName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{tr('رقم الطلب', 'Order ID')}</p>
            <p className="text-foreground text-xs font-mono">{orCase?.orderId?.slice(0, 8) || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{tr('المرحلة الحالية', 'Current Step')}</p>
            <Badge variant="secondary">{lastStep}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border overflow-x-auto pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
            }`}
          >
            {tr(tab.ar, tab.en)}
          </button>
        ))}
      </div>

      {/* Tab panels */}

      {/* ─── OR Lifecycle Tab ─── */}
      {activeTab === 'lifecycle' && (
        <div className="space-y-4">
          {nextStep === 'PRE_OP' && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('ما قبل العملية', 'Pre-op')}</CardTitle>
                <CardDescription>{tr('قائمة التحقق والموافقة والتعيينات', 'Checklist, consent, and assignments')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Checkbox
                      checked={preOpChecklist.patientIdentified}
                      onCheckedChange={(v) => setPreOpChecklist((p) => ({ ...p, patientIdentified: Boolean(v) }))}
                    />
                    {tr('تحديد هوية المريض', 'Patient identified')}
                  </label>
                  <label className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Checkbox
                      checked={preOpChecklist.procedureConfirmed}
                      onCheckedChange={(v) => setPreOpChecklist((p) => ({ ...p, procedureConfirmed: Boolean(v) }))}
                    />
                    {tr('تأكيد الإجراء', 'Procedure confirmed')}
                  </label>
                  <label className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Checkbox
                      checked={preOpChecklist.siteMarked}
                      onCheckedChange={(v) => setPreOpChecklist((p) => ({ ...p, siteMarked: Boolean(v) }))}
                    />
                    {tr('تحديد موضع العملية', 'Site marked')}
                  </label>
                  <label className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Checkbox
                      checked={preOpChecklist.allergiesReviewed}
                      onCheckedChange={(v) => setPreOpChecklist((p) => ({ ...p, allergiesReviewed: Boolean(v) }))}
                    />
                    {tr('مراجعة الحساسية', 'Allergies reviewed')}
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={consentConfirmed} onCheckedChange={(v) => setConsentConfirmed(Boolean(v))} />
                  {tr('الموافقة مؤكدة', 'Consent confirmed')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('وقت الموافقة', 'Consent Time')}</Label>
                    <Input type="datetime-local" value={consentAt} onChange={(e) => setConsentAt(e.target.value)} className="thea-input-focus" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('معرف الجراح', 'Surgeon User ID')}</Label>
                    <Input value={surgeonUserId} onChange={(e) => setSurgeonUserId(e.target.value)} className="thea-input-focus" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('معرف طبيب التخدير', 'Anesthesia User ID')}</Label>
                    <Input value={anesthesiaUserId} onChange={(e) => setAnesthesiaUserId(e.target.value)} className="thea-input-focus" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
                  <Textarea value={preOpNotes} onChange={(e) => setPreOpNotes(e.target.value)} className="thea-input-focus" />
                </div>
                <Button
                  onClick={() =>
                    submitEvent('PRE_OP', {
                      checklist: preOpChecklist,
                      consentConfirmed,
                      consentAt,
                      surgeonUserId,
                      anesthesiaUserId,
                      notes: preOpNotes,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل ما قبل العملية', 'Record Pre-op')}
                </Button>
              </CardContent>
            </Card>
          )}

          {nextStep === 'TIME_OUT' && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('التحقق الزمني', 'Time-out')}</CardTitle>
                <CardDescription>{tr('التأكيدات الإلزامية', 'Mandatory confirmations')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <Checkbox checked={timeoutPatient} onCheckedChange={(v) => setTimeoutPatient(Boolean(v))} />
                  {tr('تأكيد هوية المريض', 'Patient confirmed')}
                </label>
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <Checkbox checked={timeoutProcedure} onCheckedChange={(v) => setTimeoutProcedure(Boolean(v))} />
                  {tr('تأكيد الإجراء', 'Procedure confirmed')}
                </label>
                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                  <Checkbox checked={timeoutSite} onCheckedChange={(v) => setTimeoutSite(Boolean(v))} />
                  {tr('تأكيد الموضع', 'Site confirmed')}
                </label>
                <Button
                  onClick={() =>
                    submitEvent('TIME_OUT', {
                      patientConfirmed: timeoutPatient,
                      procedureConfirmed: timeoutProcedure,
                      siteConfirmed: timeoutSite,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل التحقق', 'Record Time-out')}
                </Button>
              </CardContent>
            </Card>
          )}

          {nextStep === 'INTRA_OP' && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('أثناء العملية', 'Intra-op')}</CardTitle>
                <CardDescription>{tr('ملاحظة أثناء العملية مع التوقيتات', 'Intra-op note with timestamps')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('وقت البدء', 'Start Time')}</Label>
                    <Input type="datetime-local" value={intraOpStartAt} onChange={(e) => setIntraOpStartAt(e.target.value)} className="thea-input-focus" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('وقت الانتهاء (اختياري)', 'End Time (optional)')}</Label>
                    <Input type="datetime-local" value={intraOpEndAt} onChange={(e) => setIntraOpEndAt(e.target.value)} className="thea-input-focus" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملاحظة أثناء العملية', 'Intra-op Note')}</Label>
                  <Textarea value={intraOpNote} onChange={(e) => setIntraOpNote(e.target.value)} className="thea-input-focus" />
                </div>
                <Button
                  onClick={() =>
                    submitEvent('INTRA_OP', {
                      note: intraOpNote,
                      startedAt: intraOpStartAt,
                      endedAt: intraOpEndAt || null,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل أثناء العملية', 'Record Intra-op')}
                </Button>
              </CardContent>
            </Card>
          )}

          {nextStep === 'POST_OP' && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('ما بعد العملية', 'Post-op')}</CardTitle>
                <CardDescription>{tr('ملاحظة ما بعد العملية والمضاعفات', 'Post-op note and complications')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملاحظة ما بعد العملية', 'Post-op Note')}</Label>
                  <Textarea value={postOpNote} onChange={(e) => setPostOpNote(e.target.value)} className="thea-input-focus" />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <Checkbox checked={postOpComplications} onCheckedChange={(v) => setPostOpComplications(Boolean(v))} />
                  {tr('مضاعفات', 'Complications')}
                </label>
                {postOpComplications && (
                  <div className="space-y-1">
                    <Label className="text-foreground">{tr('وصف المضاعفات', 'Complication Description')}</Label>
                    <Textarea value={postOpComplicationDesc} onChange={(e) => setPostOpComplicationDesc(e.target.value)} className="thea-input-focus" />
                  </div>
                )}
                <Button
                  onClick={() =>
                    submitEvent('POST_OP', {
                      note: postOpNote,
                      complications: postOpComplications,
                      complicationDescription: postOpComplicationDesc,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل ما بعد العملية', 'Record Post-op')}
                </Button>
              </CardContent>
            </Card>
          )}

          {nextStep === 'RECOVERY' && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">{tr('الاستشفاء / التسليم', 'Recovery / Handoff')}</CardTitle>
                <CardDescription>{tr('ملخص التسليم والوجهة', 'Handoff summary and destination')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('ملخص التسليم', 'Handoff Summary')}</Label>
                  <Textarea value={recoverySummary} onChange={(e) => setRecoverySummary(e.target.value)} className="thea-input-focus" />
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">{tr('الوجهة', 'Destination')}</Label>
                  <Select value={recoveryDestination} onValueChange={(value) => setRecoveryDestination(value as 'WARD' | 'ICU' | 'DISCHARGE' | '')}>
                    <SelectTrigger className="thea-input-focus">
                      <SelectValue placeholder={tr('اختر الوجهة', 'Select destination')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                      <SelectItem value="ICU">{tr('العناية المركزة', 'ICU')}</SelectItem>
                      <SelectItem value="DISCHARGE">{tr('خروج', 'Discharge')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() =>
                    submitEvent('RECOVERY', {
                      handoffSummary: recoverySummary,
                      destination: recoveryDestination,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('تسجيل الاستشفاء', 'Record Recovery')}
                </Button>
              </CardContent>
            </Card>
          )}

          {!nextStep && (
            <Card className="rounded-2xl border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
              <CardContent className="py-6 text-center">
                <p className="text-green-700 dark:text-green-300 font-medium text-sm">
                  ✓ {tr('اكتمل مسار العملية الجراحية', 'OR lifecycle completed successfully')}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Event Timeline */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-foreground">{tr('سجل الأحداث', 'Event Timeline')}</CardTitle>
              <CardDescription>{tr('أحداث للقراءة فقط بالترتيب الزمني', 'Append-only events in chronological order')}</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('الوقت', 'When')}</TableHead>
                      <TableHead>{tr('الخطوة', 'Step')}</TableHead>
                      <TableHead>{tr('التفاصيل', 'Details')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev: any) => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ev.step}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {JSON.stringify(ev.data)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  {tr('لا توجد أحداث بعد', 'No events yet.')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Surgical Team Tab ─── */}
      {activeTab === 'team' && caseId && (
        <OrTeamPanel caseId={caseId} />
      )}

      {/* ─── WHO Surgical Safety Checklist Tab ─── */}
      {activeTab === 'timeout' && caseId && (
        <OrTimeOutForm caseId={caseId} />
      )}

      {/* ─── Anesthesia Tab ─── */}
      {activeTab === 'anesthesia' && caseId && (
        <OrAnesthesiaForm caseId={caseId} />
      )}

      {/* ─── PACU Tab ─── */}
      {activeTab === 'pacu' && caseId && (
        <OrPacuForm caseId={caseId} />
      )}

      {/* ─── Implants Tab ─── */}
      {activeTab === 'implants' && caseId && (
        <OrImplantsList caseId={caseId} />
      )}

      {/* ─── Surgical Counts Tab ─── */}
      {activeTab === 'counts' && caseId && (
        <OrSurgicalCountForm caseId={caseId} tr={tr} language={language} />
      )}

      {/* ─── Specimens Tab ─── */}
      {activeTab === 'specimens' && caseId && (
        <OrSpecimenLog caseId={caseId} patientMasterId={orCase?.patientMasterId} tr={tr} language={language} />
      )}

      {/* ─── Nursing Documentation Tab ─── */}
      {activeTab === 'nursing-doc' && caseId && (
        <OrCirculatingNurseDoc caseId={caseId} tr={tr} language={language} />
      )}
    </div>
  );
}
