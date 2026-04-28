'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrOperativeNoteFormProps {
  caseId: string;
  onSaved?: () => void;
}

export default function OrOperativeNoteForm({ caseId, onSaved }: OrOperativeNoteFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/operative-note` : null,
    fetcher,
  );

  const existing = data?.operativeNote ?? null;

  // ── Procedure Details ──
  const [preOpDiagnosis, setPreOpDiagnosis] = useState('');
  const [postOpDiagnosis, setPostOpDiagnosis] = useState('');
  const [procedurePerformed, setProcedurePerformed] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [operationType, setOperationType] = useState('');
  const [laterality, setLaterality] = useState('');

  // ── Timing ──
  const [incisionTime, setIncisionTime] = useState('');
  const [closureTime, setClosureTime] = useState('');

  // ── Surgical Team ──
  const [assistantSurgeon, setAssistantSurgeon] = useState('');
  const [anesthesiologist, setAnesthesiologist] = useState('');
  const [scrubNurse, setScrubNurse] = useState('');
  const [circulatingNurse, setCirculatingNurse] = useState('');

  // ── Anesthesia ──
  const [anesthesiaType, setAnesthesiaType] = useState('');

  // ── Operative Details ──
  const [findings, setFindings] = useState('');
  const [techniqueDescription, setTechniqueDescription] = useState('');
  const [complications, setComplications] = useState('');
  const [estimatedBloodLossMl, setEstimatedBloodLossMl] = useState('');
  const [drains, setDrains] = useState('');
  const [specimens, setSpecimens] = useState('');
  const [implants, setImplants] = useState('');

  // ── Wound Closure ──
  const [closureMethod, setClosureMethod] = useState('');
  const [dressingType, setDressingType] = useState('');

  // ── Post-Op Plan ──
  const [disposition, setDisposition] = useState('');
  const [postOpInstructions, setPostOpInstructions] = useState('');
  const [dietInstructions, setDietInstructions] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [followUpPlan, setFollowUpPlan] = useState('');

  // ── Amendment ──
  const [amendmentReason, setAmendmentReason] = useState('');

  const [saving, setSaving] = useState(false);

  // Auto-calculate duration
  const totalDurationMin = useMemo(() => {
    if (!incisionTime || !closureTime) return null;
    const start = new Date(incisionTime).getTime();
    const end = new Date(closureTime).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    return Math.round((end - start) / 60000);
  }, [incisionTime, closureTime]);

  // Hydrate form from existing record
  useEffect(() => {
    if (!existing) return;
    setPreOpDiagnosis(existing.preOpDiagnosis || '');
    setPostOpDiagnosis(existing.postOpDiagnosis || '');
    setProcedurePerformed(existing.procedurePerformed || '');
    setProcedureCode(existing.procedureCode || '');
    setOperationType(existing.operationType || '');
    setLaterality(existing.laterality || '');
    setIncisionTime(existing.incisionTime ? new Date(existing.incisionTime).toISOString().slice(0, 16) : '');
    setClosureTime(existing.closureTime ? new Date(existing.closureTime).toISOString().slice(0, 16) : '');
    setAssistantSurgeon(existing.assistantSurgeon || '');
    setAnesthesiologist(existing.anesthesiologist || '');
    setScrubNurse(existing.scrubNurse || '');
    setCirculatingNurse(existing.circulatingNurse || '');
    setAnesthesiaType(existing.anesthesiaType || '');
    setFindings(existing.findings || '');
    setTechniqueDescription(existing.techniqueDescription || '');
    setComplications(existing.complications || '');
    setEstimatedBloodLossMl(existing.estimatedBloodLossMl != null ? String(existing.estimatedBloodLossMl) : '');
    setDrains(existing.drains || '');
    setSpecimens(existing.specimens || '');
    setImplants(existing.implants || '');
    setClosureMethod(existing.closureMethod || '');
    setDressingType(existing.dressingType || '');
    setDisposition(existing.disposition || '');
    setPostOpInstructions(existing.postOpInstructions || '');
    setDietInstructions(existing.dietInstructions || '');
    setActivityLevel(existing.activityLevel || '');
    setFollowUpPlan(existing.followUpPlan || '');
  }, [existing]);

  const buildPayload = (status: string) => ({
    preOpDiagnosis: preOpDiagnosis.trim() || null,
    postOpDiagnosis: postOpDiagnosis.trim() || null,
    procedurePerformed: procedurePerformed.trim() || null,
    procedureCode: procedureCode.trim() || null,
    operationType: operationType || null,
    laterality: laterality || null,
    incisionTime: incisionTime || null,
    closureTime: closureTime || null,
    totalDurationMin,
    assistantSurgeon: assistantSurgeon.trim() || null,
    anesthesiologist: anesthesiologist.trim() || null,
    scrubNurse: scrubNurse.trim() || null,
    circulatingNurse: circulatingNurse.trim() || null,
    anesthesiaType: anesthesiaType || null,
    findings: findings.trim() || null,
    techniqueDescription: techniqueDescription.trim() || null,
    complications: complications.trim() || null,
    estimatedBloodLossMl: estimatedBloodLossMl ? Number(estimatedBloodLossMl) : null,
    drains: drains.trim() || null,
    specimens: specimens.trim() || null,
    implants: implants.trim() || null,
    closureMethod: closureMethod || null,
    dressingType: dressingType.trim() || null,
    disposition: disposition || null,
    postOpInstructions: postOpInstructions.trim() || null,
    dietInstructions: dietInstructions.trim() || null,
    activityLevel: activityLevel || null,
    followUpPlan: followUpPlan.trim() || null,
    status,
    ...(status === 'AMENDED' ? { amendmentReason: amendmentReason.trim() || null } : {}),
  });

  const handleSave = async (status: string) => {
    if (status === 'SIGNED' && !procedurePerformed.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('اسم الإجراء مطلوب للتوقيع', 'Procedure name is required to sign'),
        variant: 'destructive' as const,
      });
      return;
    }
    if (status === 'AMENDED' && !amendmentReason.trim()) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('سبب التعديل مطلوب', 'Amendment reason is required'),
        variant: 'destructive' as const,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/operative-note`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(status)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({
        title: tr('تم الحفظ', 'Saved'),
        description: status === 'SIGNED'
          ? tr('تم توقيع التقرير الجراحي', 'Operative note signed')
          : status === 'AMENDED'
          ? tr('تم تعديل التقرير', 'Operative note amended')
          : tr('تم حفظ المسودة', 'Draft saved'),
      });
      await mutate();
      onSaved?.();
    } catch (err: any) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err?.message || tr('فشل الحفظ', 'Save failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {tr('جارٍ التحميل...', 'Loading...')}
        </CardContent>
      </Card>
    );
  }

  const isSigned = existing?.status === 'SIGNED';

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Status header */}
      {existing && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isSigned ? 'default' : 'secondary'} className="text-xs">
            {existing.status === 'SIGNED'
              ? tr('موقّع', 'Signed')
              : existing.status === 'AMENDED'
              ? tr('معدّل', 'Amended')
              : tr('مسودة', 'Draft')}
          </Badge>
          {existing.surgeonName && (
            <span className="text-xs text-muted-foreground">
              {tr('الجرّاح', 'Surgeon')}: {existing.surgeonName}
            </span>
          )}
          {existing.signedAt && (
            <span className="text-xs text-muted-foreground">
              {tr('وقت التوقيع', 'Signed')}: {new Date(existing.signedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* ─── 1. Procedure Details ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('تفاصيل الإجراء', 'Procedure Details')}</CardTitle>
          <CardDescription>{tr('التشخيص والإجراء المنفذ', 'Diagnosis and procedure performed')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('التشخيص قبل العملية', 'Pre-Op Diagnosis')}</Label>
              <Input
                value={preOpDiagnosis}
                onChange={(e) => setPreOpDiagnosis(e.target.value)}
                placeholder={tr('مثل: التهاب المرارة الحاد', 'e.g. Acute cholecystitis')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('التشخيص بعد العملية', 'Post-Op Diagnosis')}</Label>
              <Input
                value={postOpDiagnosis}
                onChange={(e) => setPostOpDiagnosis(e.target.value)}
                placeholder={tr('مثل: التهاب المرارة الحاد مع حصوات', 'e.g. Acute cholecystitis with cholelithiasis')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الإجراء المنفذ *', 'Procedure Performed *')}</Label>
              <Input
                value={procedurePerformed}
                onChange={(e) => setProcedurePerformed(e.target.value)}
                placeholder={tr('مثل: استئصال المرارة بالمنظار', 'e.g. Laparoscopic cholecystectomy')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('رمز الإجراء (CPT)', 'Procedure Code (CPT)')}</Label>
              <Input
                value={procedureCode}
                onChange={(e) => setProcedureCode(e.target.value)}
                placeholder={tr('مثل: 47562', 'e.g. 47562')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('نوع العملية', 'Operation Type')}</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر النوع', 'Select type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ELECTIVE">{tr('اختيارية', 'Elective')}</SelectItem>
                  <SelectItem value="EMERGENCY">{tr('طارئة', 'Emergency')}</SelectItem>
                  <SelectItem value="URGENT">{tr('عاجلة', 'Urgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الجانب', 'Laterality')}</Label>
              <Select value={laterality} onValueChange={setLaterality}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر الجانب', 'Select side')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEFT">{tr('أيسر', 'Left')}</SelectItem>
                  <SelectItem value="RIGHT">{tr('أيمن', 'Right')}</SelectItem>
                  <SelectItem value="BILATERAL">{tr('ثنائي الجانب', 'Bilateral')}</SelectItem>
                  <SelectItem value="N_A">{tr('لا ينطبق', 'N/A')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 2. Timing ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('التوقيت', 'Timing')}</CardTitle>
          <CardDescription>{tr('أوقات الشق والإغلاق', 'Incision and closure times')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('وقت الشق', 'Incision Time')}</Label>
              <Input
                type="datetime-local"
                value={incisionTime}
                onChange={(e) => setIncisionTime(e.target.value)}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('وقت الإغلاق', 'Closure Time')}</Label>
              <Input
                type="datetime-local"
                value={closureTime}
                onChange={(e) => setClosureTime(e.target.value)}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('المدة الإجمالية (دقيقة)', 'Total Duration (min)')}</Label>
              <Input
                value={totalDurationMin != null ? String(totalDurationMin) : ''}
                readOnly
                disabled
                placeholder={tr('تحسب تلقائيًا', 'Auto-calculated')}
                className="thea-input-focus bg-muted"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. Surgical Team ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('الفريق الجراحي', 'Surgical Team')}</CardTitle>
          <CardDescription>{tr('أعضاء الفريق المشاركين', 'Team members involved')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الجرّاح المساعد', 'Assistant Surgeon')}</Label>
              <Input
                value={assistantSurgeon}
                onChange={(e) => setAssistantSurgeon(e.target.value)}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('طبيب التخدير', 'Anesthesiologist')}</Label>
              <Input
                value={anesthesiologist}
                onChange={(e) => setAnesthesiologist(e.target.value)}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('ممرض/ة التعقيم', 'Scrub Nurse')}</Label>
              <Input
                value={scrubNurse}
                onChange={(e) => setScrubNurse(e.target.value)}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('ممرض/ة الدوران', 'Circulating Nurse')}</Label>
              <Input
                value={circulatingNurse}
                onChange={(e) => setCirculatingNurse(e.target.value)}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 4. Anesthesia Type ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('نوع التخدير', 'Anesthesia Type')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Select value={anesthesiaType} onValueChange={setAnesthesiaType}>
              <SelectTrigger className="thea-input-focus">
                <SelectValue placeholder={tr('اختر نوع التخدير', 'Select anesthesia type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL">{tr('تخدير عام', 'General')}</SelectItem>
                <SelectItem value="REGIONAL">{tr('تخدير موضعي إقليمي', 'Regional')}</SelectItem>
                <SelectItem value="SPINAL">{tr('تخدير نخاعي', 'Spinal')}</SelectItem>
                <SelectItem value="EPIDURAL">{tr('تخدير فوق الجافية', 'Epidural')}</SelectItem>
                <SelectItem value="MAC">{tr('تخدير مراقب (MAC)', 'MAC')}</SelectItem>
                <SelectItem value="LOCAL">{tr('تخدير موضعي', 'Local')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ─── 5. Operative Details ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('تفاصيل العملية', 'Operative Details')}</CardTitle>
          <CardDescription>{tr('النتائج والتقنية والمضاعفات', 'Findings, technique, and complications')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-foreground">{tr('النتائج الجراحية', 'Findings')}</Label>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder={tr('صف النتائج أثناء العملية...', 'Describe intraoperative findings...')}
              rows={3}
              className="thea-input-focus"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-foreground">{tr('وصف التقنية', 'Technique Description')}</Label>
            <Textarea
              value={techniqueDescription}
              onChange={(e) => setTechniqueDescription(e.target.value)}
              placeholder={tr('صف التقنية الجراحية خطوة بخطوة...', 'Describe the surgical technique step by step...')}
              rows={5}
              className="thea-input-focus"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-foreground">{tr('المضاعفات', 'Complications')}</Label>
            <Textarea
              value={complications}
              onChange={(e) => setComplications(e.target.value)}
              placeholder={tr('لا توجد مضاعفات أو صف المضاعفات...', 'None or describe complications...')}
              rows={2}
              className="thea-input-focus"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الفقد الدموي المقدّر (مل)', 'Estimated Blood Loss (mL)')}</Label>
              <Input
                type="number"
                min="0"
                value={estimatedBloodLossMl}
                onChange={(e) => setEstimatedBloodLossMl(e.target.value)}
                placeholder="0"
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الأنابيب / المصارف', 'Drains')}</Label>
              <Input
                value={drains}
                onChange={(e) => setDrains(e.target.value)}
                placeholder={tr('مثل: مصرف JP في الموقع', 'e.g. JP drain in situ')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('العيّنات', 'Specimens')}</Label>
              <Input
                value={specimens}
                onChange={(e) => setSpecimens(e.target.value)}
                placeholder={tr('مثل: مرارة مرسلة للباثولوجي', 'e.g. Gallbladder sent to pathology')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الغرسات / المستلزمات', 'Implants')}</Label>
              <Input
                value={implants}
                onChange={(e) => setImplants(e.target.value)}
                placeholder={tr('مثل: شبكة، مسامير...', 'e.g. Mesh, screws...')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 6. Wound Closure ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('إغلاق الجرح', 'Wound Closure')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('طريقة الإغلاق', 'Closure Method')}</Label>
              <Select value={closureMethod} onValueChange={setClosureMethod}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر الطريقة', 'Select method')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUTURES">{tr('خيوط جراحية', 'Sutures')}</SelectItem>
                  <SelectItem value="STAPLES">{tr('دبابيس', 'Staples')}</SelectItem>
                  <SelectItem value="ADHESIVE">{tr('لاصق جراحي', 'Adhesive')}</SelectItem>
                  <SelectItem value="STERI_STRIPS">{tr('شرائط لاصقة', 'Steri-Strips')}</SelectItem>
                  <SelectItem value="COMBINATION">{tr('طريقة مركّبة', 'Combination')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('نوع الضماد', 'Dressing Type')}</Label>
              <Input
                value={dressingType}
                onChange={(e) => setDressingType(e.target.value)}
                placeholder={tr('مثل: ضماد معقم جاف', 'e.g. Sterile dry dressing')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 7. Post-Op Plan ─── */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-foreground text-base">{tr('خطة ما بعد العملية', 'Post-Op Plan')}</CardTitle>
          <CardDescription>{tr('التعليمات والوجهة والمتابعة', 'Instructions, disposition, and follow-up')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('الوجهة', 'Disposition')}</Label>
              <Select value={disposition} onValueChange={setDisposition}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر الوجهة', 'Select disposition')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WARD">{tr('الجناح', 'Ward')}</SelectItem>
                  <SelectItem value="ICU">{tr('العناية المركزة', 'ICU')}</SelectItem>
                  <SelectItem value="PACU">{tr('وحدة الإفاقة', 'PACU')}</SelectItem>
                  <SelectItem value="SAME_DAY_DISCHARGE">{tr('خروج في نفس اليوم', 'Same Day Discharge')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('مستوى النشاط', 'Activity Level')}</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger className="thea-input-focus">
                  <SelectValue placeholder={tr('اختر المستوى', 'Select level')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BED_REST">{tr('راحة تامة', 'Bed Rest')}</SelectItem>
                  <SelectItem value="RESTRICTED">{tr('نشاط محدود', 'Restricted')}</SelectItem>
                  <SelectItem value="AS_TOLERATED">{tr('حسب التحمل', 'As Tolerated')}</SelectItem>
                  <SelectItem value="FULL_ACTIVITY">{tr('نشاط كامل', 'Full Activity')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-foreground">{tr('تعليمات ما بعد العملية', 'Post-Op Instructions')}</Label>
            <Textarea
              value={postOpInstructions}
              onChange={(e) => setPostOpInstructions(e.target.value)}
              placeholder={tr('تعليمات العناية بالجرح والأدوية...', 'Wound care, medications, activity...')}
              rows={3}
              className="thea-input-focus"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-foreground">{tr('تعليمات الحمية', 'Diet Instructions')}</Label>
              <Input
                value={dietInstructions}
                onChange={(e) => setDietInstructions(e.target.value)}
                placeholder={tr('مثل: سوائل صافية ثم تدرج', 'e.g. Clear liquids then advance')}
                className="thea-input-focus"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('خطة المتابعة', 'Follow-Up Plan')}</Label>
              <Input
                value={followUpPlan}
                onChange={(e) => setFollowUpPlan(e.target.value)}
                placeholder={tr('مثل: مراجعة بعد أسبوعين', 'e.g. Follow-up in 2 weeks')}
                className="thea-input-focus"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Amendment reason (for signed notes) ─── */}
      {isSigned && (
        <Card className="rounded-2xl border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-foreground text-base">{tr('تعديل التقرير', 'Amend Note')}</CardTitle>
            <CardDescription>{tr('سبب التعديل مطلوب لتعديل تقرير موقّع', 'Reason is required to amend a signed note')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Label className="text-foreground">{tr('سبب التعديل *', 'Amendment Reason *')}</Label>
              <Textarea
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                placeholder={tr('اذكر سبب التعديل...', 'Describe the reason for amendment...')}
                rows={2}
                className="thea-input-focus"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Action buttons ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        {!isSigned && (
          <>
            <Button
              variant="outline"
              onClick={() => handleSave('DRAFT')}
              disabled={saving}
            >
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ مسودة', 'Save Draft')}
            </Button>
            <Button
              onClick={() => handleSave('SIGNED')}
              disabled={saving}
            >
              {saving ? tr('جارٍ التوقيع...', 'Signing...') : tr('توقيع التقرير', 'Sign Note')}
            </Button>
          </>
        )}
        {isSigned && (
          <Button
            variant="outline"
            onClick={() => handleSave('AMENDED')}
            disabled={saving || !amendmentReason.trim()}
          >
            {saving ? tr('جارٍ التعديل...', 'Amending...') : tr('تعديل التقرير', 'Amend Note')}
          </Button>
        )}
      </div>
    </div>
  );
}
