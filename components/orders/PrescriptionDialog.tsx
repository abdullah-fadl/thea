"use client";

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MedicationSearchSelect, type SelectedMedication } from '@/components/orders/MedicationSearchSelect';
import { DrugInteractionAlert } from '@/components/prescription/DrugInteractionAlert';
import { AllergyAlertComponent } from '@/components/clinical/AllergyAlert';
import { checkDuplicateTherapy, type DuplicateAlert } from '@/lib/clinical/duplicateCheck';
import type { AllergyAlert } from '@/lib/clinical/allergyCheck';

const frequencies = [
  { value: 'QD', label: 'QD - Once daily' },
  { value: 'BID', label: 'BID - Twice daily' },
  { value: 'TID', label: 'TID - Three times daily' },
  { value: 'QID', label: 'QID - Four times daily' },
  { value: 'Q4H', label: 'Q4H - Every 4 hours' },
  { value: 'Q6H', label: 'Q6H - Every 6 hours' },
  { value: 'Q8H', label: 'Q8H - Every 8 hours' },
  { value: 'Q12H', label: 'Q12H - Every 12 hours' },
  { value: 'PRN', label: 'PRN - As needed' },
];

const routes = [
  { value: 'PO', label: 'PO - Oral' },
  { value: 'IV', label: 'IV - Intravenous' },
  { value: 'IM', label: 'IM - Intramuscular' },
  { value: 'SC', label: 'SC - Subcutaneous' },
  { value: 'SL', label: 'SL - Sublingual' },
  { value: 'TOPICAL', label: 'Topical' },
  { value: 'INH', label: 'INH - Inhalation' },
];

export interface PrescriptionDialogProps {
  encounterCoreId: string;
  allergies?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PrescriptionDialog({
  encounterCoreId,
  allergies,
  open,
  onOpenChange,
  onSuccess,
}: PrescriptionDialogProps) {
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [selectedMed, setSelectedMed] = useState<SelectedMedication | null>(null);
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [route, setRoute] = useState('');
  const [duration, setDuration] = useState('');
  const [quantity, setQuantity] = useState('');
  const [instructions, setInstructions] = useState('');
  const [indication, setIndication] = useState('');
  const [prn, setPrn] = useState(false);
  const [allergyAlerts, setAllergyAlerts] = useState<AllergyAlert[]>([]);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [allergyOverrideReason, setAllergyOverrideReason] = useState<string | null>(null);
  const [allergyOverrideAccepted, setAllergyOverrideAccepted] = useState(false);
  const [duplicateAlerts, setDuplicateAlerts] = useState<DuplicateAlert[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showInteractionAlert, setShowInteractionAlert] = useState(false);
  const [interactionItems, setInteractionItems] = useState<any[]>([]);
  const [pendingInteractionSave, setPendingInteractionSave] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [pedsWeight, setPedsWeight] = useState('');
  const [pedsAge, setPedsAge] = useState('');
  const [pedsAgeMonths, setPedsAgeMonths] = useState('');
  const [dosageResult, setDosageResult] = useState<any>(null);
  const [dosageLoading, setDosageLoading] = useState(false);
  const [dosageError, setDosageError] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedMed(null);
    setDose('');
    setFrequency('');
    setRoute('');
    setDuration('');
    setQuantity('');
    setInstructions('');
    setIndication('');
    setPrn(false);
    setAllergyAlerts([]);
    setShowAllergyModal(false);
    setAllergyOverrideReason(null);
    setAllergyOverrideAccepted(false);
    setDuplicateAlerts([]);
    setConfirmDuplicate(false);
    setErrors({});
    setDosageResult(null);
    setDosageError(null);
    setPedsWeight('');
    setPedsAge('');
    setPedsAgeMonths('');
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const isPrnFrequency = useMemo(() => frequency === 'PRN', [frequency]);
  const requiresAllergyOverride = useMemo(
    () => allergyAlerts.some((alert) => alert.requiresOverride),
    [allergyAlerts]
  );

  useEffect(() => {
    if (isPrnFrequency) {
      setPrn(true);
    }
  }, [isPrnFrequency]);

  useEffect(() => {
    if (!encounterCoreId) return;
    let active = true;
    const loadPatient = async () => {
      try {
        const res = await fetch(`/api/opd/encounters/${encodeURIComponent(encounterCoreId)}`, { credentials: 'include' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        setPatientId(payload?.opd?.patientId || null);
      } catch {
        if (active) setPatientId(null);
      }
    };
    loadPatient();
    return () => {
      active = false;
    };
  }, [encounterCoreId]);

  const normalizeDrugCode = (name: string) =>
    String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const runAllergyCheck = async (drugName: string) => {
    if (!patientId || !drugName) return;
    try {
      const res = await fetch('/api/clinical/allergy-check', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, drugName }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
      setAllergyAlerts(alerts);
      setAllergyOverrideReason(null);
      setAllergyOverrideAccepted(false);
      if (alerts.length) {
        setShowAllergyModal(true);
      }
    } catch {
      setAllergyAlerts([]);
    }
  };

  const runDuplicateCheck = async (drugName: string) => {
    if (!drugName) return;
    try {
      const existingRes = await fetch(`/api/opd/encounters/${encodeURIComponent(encounterCoreId)}/orders`, { credentials: 'include' });
      const existingPayload = await existingRes.json().catch(() => ({}));
      const existingItems = Array.isArray(existingPayload?.items) ? existingPayload.items : [];
      const meds = existingItems
        .map((item: any) => item?.orderName || item?.name || item?.meta?.drugName || '')
        .filter(Boolean)
        .map((name: string) => ({
          drugCode: normalizeDrugCode(name),
          drugName: name,
          status: 'active' as const,
          startDate: new Date().toISOString(),
        }));
      const alerts = checkDuplicateTherapy(drugName, meds);
      setDuplicateAlerts(alerts);
      if (!alerts.length) {
        setConfirmDuplicate(false);
      }
    } catch {
      setDuplicateAlerts([]);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!selectedMed?.medicationCatalogId) next.medication = tr('الدواء مطلوب', 'Medication is required');
    if (!dose.trim()) next.dose = tr('الجرعة مطلوبة', 'Dose is required');
    if (!frequency) next.frequency = tr('التكرار مطلوب', 'Frequency is required');
    if (!route) next.route = tr('طريقة الإعطاء مطلوبة', 'Route is required');
    if (!duration.trim()) next.duration = tr('المدة مطلوبة', 'Duration is required');
    if (!quantity.trim()) next.quantity = tr('الكمية مطلوبة', 'Quantity is required');
    if (requiresAllergyOverride && !allergyOverrideAccepted) next.allergyConfirm = tr('مطلوب تجاوز تنبيه الحساسية', 'Allergy override required');
    if (duplicateAlerts.length && !confirmDuplicate) next.duplicateConfirm = tr('يرجى تأكيد مراجعة العلاج المكرر', 'Please confirm duplicate therapy review');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const runSave = async () => {
    if (!selectedMed) return;
    setSaving(true);
    try {
      const key =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const res = await fetch('/api/orders', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId,
          kind: 'MEDICATION',
          orderCode: selectedMed.code,
          orderName: selectedMed.genericName,
          priority: 'ROUTINE',
          meta: {
            medicationCatalogId: selectedMed.medicationCatalogId,
            dose: dose.trim(),
            frequency,
            route,
            duration: duration.trim(),
            quantity: quantity.trim(),
            instructions: instructions.trim() || undefined,
            indication: indication.trim() || undefined,
            prn: Boolean(prn),
            form: selectedMed.form || undefined,
            strength: selectedMed.strength || undefined,
            allergyOverrideReason: allergyOverrideReason || undefined,
            duplicateTherapyReviewed: duplicateAlerts.length ? Boolean(confirmDuplicate) : undefined,
          },
          idempotencyKey: key,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save prescription');
      toast({ title: payload.noOp ? tr('الوصفة محفوظة مسبقاً', 'Prescription already saved') : tr('تم حفظ الوصفة', 'Prescription saved') });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    } finally {
      setSaving(false);
      setPendingInteractionSave(false);
    }
  };

  const checkInteractions = async () => {
    if (!selectedMed) return true;
    try {
      const existingRes = await fetch(`/api/opd/encounters/${encodeURIComponent(encounterCoreId)}/orders`, { credentials: 'include' });
      const existingPayload = await existingRes.json().catch(() => ({}));
      const existingItems = Array.isArray(existingPayload?.items) ? existingPayload.items : [];
      const meds = existingItems
        .map((item: any) => item?.orderName || item?.name || item?.meta?.drugName || '')
        .filter(Boolean)
        .map((name: string) => ({ name }));
      const newMedName = selectedMed.genericName || selectedMed.code;
      const medications = [...meds, { name: newMedName }].filter((m) => m.name);
      if (medications.length < 2) return true;

      const res = await fetch('/api/clinical/drug-interactions/check', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return true;
      if (payload.hasInteractions) {
        setInteractionItems(payload.interactions || []);
        setShowInteractionAlert(true);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleSave = async () => {
    if (requiresAllergyOverride && !allergyOverrideAccepted) {
      setShowAllergyModal(true);
      return;
    }
    if (!validate()) return;
    if (!selectedMed) return;
    const canProceed = await checkInteractions();
    if (!canProceed) {
      setPendingInteractionSave(true);
      return;
    }
    await runSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr('وصفة جديدة', 'New Prescription')}</DialogTitle>
            <DialogDescription>{tr('أدخل تفاصيل الدواء لهذه الزيارة.', 'Capture medication details for this encounter.')}</DialogDescription>
          </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{tr('الدواء', 'Medication')}</Label>
            <MedicationSearchSelect
              value={selectedMed?.medicationCatalogId}
              onSelect={(med) => {
                setSelectedMed(med);
                if (med) {
                  runAllergyCheck(med.genericName);
                  runDuplicateCheck(med.genericName);
                } else {
                  setAllergyAlerts([]);
                  setShowAllergyModal(false);
                  setAllergyOverrideReason(null);
                  setAllergyOverrideAccepted(false);
                  setDuplicateAlerts([]);
                  setConfirmDuplicate(false);
                }
              }}
              disabled={saving}
              placeholder={tr('اختر الدواء', 'Select medication')}
            />
            {errors.medication ? <div className="text-xs text-destructive">{errors.medication}</div> : null}
          </div>

          {duplicateAlerts.length ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {tr('تحذير علاج مكرر', 'Duplicate Therapy Warning')}
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {duplicateAlerts.map((alert, idx) => (
                  <div key={`${alert.type}-${idx}`}>
                    {alert.messageAr} ({alert.message})
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Checkbox
                  id="duplicate-confirm"
                  checked={confirmDuplicate}
                  onCheckedChange={(value) => setConfirmDuplicate(Boolean(value))}
                  disabled={saving}
                />
                <Label htmlFor="duplicate-confirm" className="text-xs">
                  {tr('لقد راجعت تحذير العلاج المكرر', 'I have reviewed the duplicate therapy warning')}
                </Label>
              </div>
              {errors.duplicateConfirm ? (
                <div className="mt-1 text-xs text-destructive">{errors.duplicateConfirm}</div>
              ) : null}
            </div>
          ) : null}

          {requiresAllergyOverride ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {tr('تم اكتشاف تنبيه حساسية', 'Allergy Alert Detected')}
              </div>
              <div className="mt-1 text-xs">
                {tr('المريض لديه حساسية موثقة قد تكون مرتبطة بهذا الدواء.', 'Patient has a documented allergy that may be related to this medication.')}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllergyModal(true)}
                  disabled={saving}
                >
                  {tr('مراجعة تنبيه الحساسية', 'Review Allergy Alert')}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tr('الجرعة', 'Dose')}</Label>
              <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500mg" disabled={saving} />
              {errors.dose ? <div className="text-xs text-destructive">{errors.dose}</div> : null}
            </div>
            <div className="space-y-2">
              <Label>{tr('التكرار', 'Frequency')}</Label>
              <Select value={frequency} onValueChange={setFrequency} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر التكرار', 'Select frequency')} />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.frequency ? <div className="text-xs text-destructive">{errors.frequency}</div> : null}
            </div>
            <div className="space-y-2">
              <Label>{tr('طريقة الإعطاء', 'Route')}</Label>
              <Select value={route} onValueChange={setRoute} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر الطريقة', 'Select route')} />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.route ? <div className="text-xs text-destructive">{errors.route}</div> : null}
            </div>
            <div className="space-y-2">
              <Label>{tr('المدة', 'Duration')}</Label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={tr('٧ أيام', '7 days')} disabled={saving} />
              {errors.duration ? <div className="text-xs text-destructive">{errors.duration}</div> : null}
            </div>
            <div className="space-y-2">
              <Label>{tr('الكمية', 'Quantity')}</Label>
              <Input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={tr('٢١ قرص', '21 tablets')}
                disabled={saving}
              />
              {errors.quantity ? <div className="text-xs text-destructive">{errors.quantity}</div> : null}
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="prn" checked={prn} onCheckedChange={(value) => setPrn(Boolean(value))} disabled={saving} />
              <Label htmlFor="prn">{tr('عند الحاجة (PRN)', 'PRN (as needed)')}</Label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-sm font-medium text-slate-800">{tr('حاسبة جرعة الأطفال', 'Pediatric Dose Calculator')}</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{tr('الوزن (كجم)', 'Weight (kg)')}</Label>
                <Input value={pedsWeight} onChange={(e) => setPedsWeight(e.target.value)} placeholder="15" />
              </div>
              <div className="space-y-1">
                <Label>{tr('العمر (سنوات)', 'Age (years)')}</Label>
                <Input value={pedsAge} onChange={(e) => setPedsAge(e.target.value)} placeholder="6" />
              </div>
              <div className="space-y-1">
                <Label>{tr('العمر (أشهر)', 'Age (months)')}</Label>
                <Input value={pedsAgeMonths} onChange={(e) => setPedsAgeMonths(e.target.value)} placeholder="0" />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedMed || dosageLoading}
              onClick={async () => {
                if (!selectedMed) return;
                setDosageLoading(true);
                setDosageError(null);
                setDosageResult(null);
                try {
                  const res = await fetch('/api/clinical/dosage-calc', {
                    credentials: 'include',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      drugCode: normalizeDrugCode(selectedMed.genericName || selectedMed.code),
                      patientWeight: Number(pedsWeight),
                      patientAge: Number(pedsAge),
                      patientAgeMonths: pedsAgeMonths ? Number(pedsAgeMonths) : undefined,
                      indication: indication.trim() || undefined,
                    }),
                  });
                  const payload = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(payload.error || 'Failed to calculate dose');
                  setDosageResult(payload?.calculation || null);
                } catch (err: any) {
                  setDosageError(err?.message || 'Failed to calculate dose');
                } finally {
                  setDosageLoading(false);
                }
              }}
            >
              {dosageLoading ? tr('جاري الحساب...', 'Calculating...') : tr('حساب جرعة الأطفال', 'Calculate Pediatric Dose')}
            </Button>
            {dosageError ? <div className="text-xs text-destructive">{dosageError}</div> : null}
            {dosageResult ? (
              <div className="text-xs text-slate-700 space-y-1">
                <div>
                  {tr('الجرعة الموصى بها', 'Recommended dose')}: <strong>{dosageResult.recommendedDose}</strong> {dosageResult.unit} (
                  {dosageResult.frequency})
                </div>
                <div>
                  {tr('الحد الأقصى يومياً', 'Max daily')}: {dosageResult.maxDailyDose} {dosageResult.unit} • {tr('الطريقة', 'Route')}: {dosageResult.route}
                </div>
                <div>{tr('طريقة الحساب', 'Method')}: {dosageResult.calculationMethod}</div>
                {dosageResult.warnings?.length ? (
                  <div className="text-amber-700">{tr('تحذيرات', 'Warnings')}: {dosageResult.warnings.join(' | ')}</div>
                ) : null}
                {dosageResult.adjustments?.length ? (
                  <div className="text-slate-600">{tr('تعديلات', 'Adjustments')}: {dosageResult.adjustments.join(' | ')}</div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tr('التعليمات', 'Instructions')}</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={tr('تؤخذ بعد الوجبات', 'Take after meals')}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('الاستطباب', 'Indication')}</Label>
              <Textarea
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder={tr('سبب الوصفة', 'Reason for prescription')}
                disabled={saving}
              />
            </div>
          </div>
        </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('صرف الوصفة', 'Save Prescription')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showInteractionAlert ? (
        <DrugInteractionAlert
          interactions={interactionItems}
          onAcknowledge={() => {
            setShowInteractionAlert(false);
            if (pendingInteractionSave) {
              runSave();
            }
          }}
          onCancel={() => {
            setShowInteractionAlert(false);
            setPendingInteractionSave(false);
          }}
        />
      ) : null}

      {showAllergyModal ? (
        <AllergyAlertComponent
          alerts={allergyAlerts}
          onOverride={(alertId, reason) => {
            setAllergyOverrideReason(reason);
            setAllergyOverrideAccepted(true);
            setShowAllergyModal(false);
            setErrors((prev) => ({ ...prev, allergyConfirm: '' }));
          }}
          onCancel={() => {
            setShowAllergyModal(false);
            setAllergyOverrideReason(null);
            setAllergyOverrideAccepted(false);
          }}
        />
      ) : null}
    </>
  );
}
