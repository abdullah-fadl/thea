'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface OrTimeOutFormProps {
  caseId: string;
}

interface ChecklistItem {
  key: keyof ChecklistState;
  ar: string;
  en: string;
}

interface ChecklistState {
  patientIdConfirmed: boolean;
  procedureConfirmed: boolean;
  siteConfirmed: boolean;
  consentConfirmed: boolean;
  antibioticGiven: boolean;
  imagingAvailable: boolean;
  equipmentReady: boolean;
  teamIntroduced: boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'patientIdConfirmed',  ar: 'تأكيد هوية المريض',           en: 'Patient Identity Confirmed' },
  { key: 'procedureConfirmed',  ar: 'تأكيد نوع العملية',             en: 'Procedure Confirmed' },
  { key: 'siteConfirmed',       ar: 'تأكيد موضع العملية',            en: 'Site Confirmed' },
  { key: 'consentConfirmed',    ar: 'الموافقة موقعة',               en: 'Consent Signed' },
  { key: 'antibioticGiven',     ar: 'المضاد الحيوي الوقائي أعطي',   en: 'Prophylactic Antibiotic Given' },
  { key: 'imagingAvailable',    ar: 'الأشعة متوفرة',                en: 'Imaging Available' },
  { key: 'equipmentReady',      ar: 'المعدات جاهزة',                en: 'Equipment Ready' },
  { key: 'teamIntroduced',      ar: 'الفريق تعارف',                 en: 'Team Introduction Done' },
];

export default function OrTimeOutForm({ caseId }: OrTimeOutFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate, isLoading } = useSWR(
    caseId ? `/api/or/cases/${caseId}/time-out` : null,
    fetcher,
  );

  const existing = data?.timeOut ?? null;

  const [checklist, setChecklist] = useState<ChecklistState>({
    patientIdConfirmed: false,
    procedureConfirmed: false,
    siteConfirmed: false,
    consentConfirmed: false,
    antibioticGiven: false,
    imagingAvailable: false,
    equipmentReady: false,
    teamIntroduced: false,
  });
  const [criticalConcerns, setCriticalConcerns] = useState('');
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Seed from existing record when loaded and not in edit mode
  const displayData = editMode ? null : existing;

  const allChecked = Object.values(checklist).every(Boolean);

  const handleToggle = (key: keyof ChecklistState, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!allChecked) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/time-out`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performedAt: new Date().toISOString(),
          ...checklist,
          criticalConcerns: criticalConcerns.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'));

      toast({ title: tr('تم التوثيق', 'Time-out Recorded'), description: tr('تم تسجيل قائمة التحقق الجراحي بنجاح', 'Surgical Safety Checklist recorded successfully') });
      await mutate();
      setEditMode(false);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل الحفظ', 'Failed to save'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (existing) {
      setChecklist({
        patientIdConfirmed: Boolean(existing.patientIdConfirmed),
        procedureConfirmed: Boolean(existing.procedureConfirmed),
        siteConfirmed: Boolean(existing.siteConfirmed),
        consentConfirmed: Boolean(existing.consentConfirmed),
        antibioticGiven: Boolean(existing.antibioticGiven),
        imagingAvailable: Boolean(existing.imagingAvailable),
        equipmentReady: Boolean(existing.equipmentReady),
        teamIntroduced: Boolean(existing.teamIntroduced),
      });
      setCriticalConcerns(existing.criticalConcerns || '');
    }
    setEditMode(true);
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

  return (
    <Card className="rounded-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              {tr('قائمة التحقق الجراحي', 'Surgical Safety Checklist')}
              {existing && !editMode && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" /> {tr('مكتمل', 'Completed')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {tr('قائمة منظمة الصحة العالمية للسلامة الجراحية', 'WHO Surgical Safety Checklist')}
            </CardDescription>
          </div>
          {existing && !editMode && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              {tr('تعديل', 'Edit')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Read-only view of existing record */}
        {existing && !editMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHECKLIST_ITEMS.map((item) => {
                const checked = Boolean((existing as Record<string, unknown>)[item.key]);
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      checked
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                    }`}
                  >
                    <span className={`${checked ? 'text-green-600' : 'text-red-500'}`}>
                      {checked ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </span>
                    <span className="text-sm text-foreground">{tr(item.ar, item.en)}</span>
                  </div>
                );
              })}
            </div>
            {existing.criticalConcerns && (
              <div className="p-3 rounded-lg border bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-700">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                  {tr('مخاوف حرجة', 'Critical Concerns')}
                </p>
                <p className="text-sm text-foreground">{existing.criticalConcerns}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {tr('وُثِّق في:', 'Performed at:')} {existing.performedAt ? new Date(existing.performedAt).toLocaleString() : '—'}
            </p>
          </div>
        ) : (
          /* Edit / Create form */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={checklist[item.key]}
                    onCheckedChange={(v) => handleToggle(item.key, Boolean(v))}
                  />
                  <span className="text-sm text-foreground select-none">{tr(item.ar, item.en)}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-foreground">
                {tr('مخاوف حرجة (اختياري)', 'Critical Concerns (optional)')}
              </Label>
              <Textarea
                value={criticalConcerns}
                onChange={(e) => setCriticalConcerns(e.target.value)}
                placeholder={tr('اذكر أي مخاوف مهمة...', 'Mention any critical concerns...')}
                rows={3}
                className="thea-input-focus"
              />
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(Object.values(checklist).filter(Boolean).length / CHECKLIST_ITEMS.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {Object.values(checklist).filter(Boolean).length} / {CHECKLIST_ITEMS.length}
              </span>
            </div>

            {!allChecked && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {tr(
                  'يجب تأكيد جميع البنود قبل إتمام التحقق',
                  'All items must be confirmed before completing time-out',
                )}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || !allChecked}
                className={allChecked ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
              >
                {saving
                  ? tr('جارٍ الحفظ...', 'Saving...')
                  : allChecked
                  ? tr('إتمام التحقق الجراحي', 'Complete Time-Out')
                  : tr('إتمام التحقق الجراحي', 'Complete Time-Out')}
              </Button>
              {editMode && (
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
