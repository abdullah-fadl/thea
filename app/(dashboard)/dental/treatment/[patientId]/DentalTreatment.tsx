'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface TreatmentItem {
  id: string;
  toothNumber: number;
  surface?: string;
  procedureCode: string;
  procedureName: string;
  procedureNameAr: string;
  fee: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: number;
  notes?: string;
  completedAt?: string;
}

const DENTAL_PROCEDURES = [
  { code: 'D0120', nameAr: 'فحص دوري',                   nameEn: 'Periodic oral evaluation',    fee: 150 },
  { code: 'D0220', nameAr: 'أشعة ذروية',                  nameEn: 'Periapical X-ray',            fee: 50 },
  { code: 'D0330', nameAr: 'أشعة بانورامية',               nameEn: 'Panoramic X-ray',             fee: 200 },
  { code: 'D1110', nameAr: 'تنظيف الأسنان',               nameEn: 'Prophylaxis (cleaning)',       fee: 250 },
  { code: 'D2140', nameAr: 'حشوة أملغم - سطح واحد',       nameEn: 'Amalgam filling - 1 surface', fee: 200 },
  { code: 'D2150', nameAr: 'حشوة أملغم - سطحين',          nameEn: 'Amalgam filling - 2 surfaces',fee: 300 },
  { code: 'D2330', nameAr: 'حشوة تجميلية - سطح واحد',     nameEn: 'Composite filling - 1 surface',fee: 350 },
  { code: 'D2331', nameAr: 'حشوة تجميلية - سطحين',        nameEn: 'Composite filling - 2 surfaces',fee: 450 },
  { code: 'D2750', nameAr: 'تاج بورسلين',                  nameEn: 'Crown - porcelain',           fee: 2500 },
  { code: 'D3310', nameAr: 'علاج عصب - سن أمامي',         nameEn: 'Root canal - anterior',       fee: 1500 },
  { code: 'D3320', nameAr: 'علاج عصب - سن ضاحك',          nameEn: 'Root canal - premolar',       fee: 2000 },
  { code: 'D3330', nameAr: 'علاج عصب - سن طاحن',          nameEn: 'Root canal - molar',          fee: 2500 },
  { code: 'D7140', nameAr: 'خلع - سن بازغ',               nameEn: 'Extraction - erupted tooth',  fee: 300 },
  { code: 'D7210', nameAr: 'خلع جراحي',                   nameEn: 'Surgical extraction',         fee: 600 },
  { code: 'D6010', nameAr: 'زرعة سنية داخل العظم',        nameEn: 'Implant - endosteal',         fee: 5000 },
];

const STATUS_CONFIG = {
  PLANNED:     { ar: 'مخطط',        en: 'Planned',     color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  COMPLETED:   { ar: 'مكتمل',       en: 'Completed',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  CANCELLED:   { ar: 'ملغي',        en: 'Cancelled',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export default function DentalTreatment() {
  const { patientId } = useParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [showAddModal, setShowAddModal] = useState(false);

  const { data: patientData } = useSWR(`/api/patients/${patientId}`, fetcher);
  const { data: planData, mutate } = useSWR(`/api/dental/treatment/${patientId}`, fetcher);

  const treatments: TreatmentItem[] = Array.isArray(planData?.items) ? planData.items : [];

  const totalFee     = treatments.reduce((sum, t) => sum + (t.status !== 'CANCELLED' ? t.fee : 0), 0);
  const completedFee = treatments.reduce((sum, t) => sum + (t.status === 'COMPLETED' ? t.fee : 0), 0);
  const remaining    = totalFee - completedFee;

  const updateStatus = async (id: string, status: TreatmentItem['status']) => {
    await fetch(`/api/dental/treatment/${patientId}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, status }),
    });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('خطة العلاج', 'Treatment Plan')}</h1>
            <p className="text-muted-foreground">
              {patientData?.patient?.fullName || tr('جاري التحميل...', 'Loading...')}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            {tr('+ إضافة إجراء', '+ Add Procedure')}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-foreground">
              {totalFee.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ms-1">{tr('ر.س', 'SAR')}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{tr('إجمالي الخطة', 'Total Plan')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-emerald-600">
              {completedFee.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ms-1">{tr('ر.س', 'SAR')}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{tr('تم إنجازه', 'Completed')}</div>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-2xl font-bold text-blue-600">
              {remaining.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ms-1">{tr('ر.س', 'SAR')}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{tr('المتبقي', 'Remaining')}</div>
          </div>
        </div>

        {/* Progress bar */}
        {totalFee > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{tr('التقدم', 'Progress')}</span>
              <span>{Math.round((completedFee / totalFee) * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((completedFee / totalFee) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr className="text-sm text-muted-foreground">
                <th className="px-4 py-3 font-medium text-start">#</th>
                <th className="px-4 py-3 font-medium text-start">{tr('السن', 'Tooth')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الإجراء', 'Procedure')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الرسوم', 'Fee')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الحالة', 'Status')}</th>
                <th className="px-4 py-3 font-medium text-start">{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {treatments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {tr('لا توجد إجراءات مضافة بعد', 'No procedures added yet')}
                  </td>
                </tr>
              ) : (
                treatments.map((treatment, idx) => {
                  const statusCfg = STATUS_CONFIG[treatment.status];
                  return (
                    <tr key={treatment.id} className="thea-hover-lift">
                      <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono bg-muted px-2 py-1 rounded-lg text-sm">
                          {treatment.toothNumber}
                          {treatment.surface && `-${treatment.surface}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {language === 'ar' ? treatment.procedureNameAr : treatment.procedureName}
                        </div>
                        <div className="text-xs text-muted-foreground">{treatment.procedureCode}</div>
                        {treatment.notes && (
                          <div className="text-xs text-muted-foreground italic mt-0.5">{treatment.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {treatment.fee.toLocaleString()} {tr('ر.س', 'SAR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {tr(statusCfg.ar, statusCfg.en)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {treatment.status === 'PLANNED' && (
                            <>
                              <button
                                onClick={() => updateStatus(treatment.id, 'IN_PROGRESS')}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {tr('بدء', 'Start')}
                              </button>
                              <button
                                onClick={() => updateStatus(treatment.id, 'CANCELLED')}
                                className="text-red-500 hover:underline text-sm"
                              >
                                {tr('إلغاء', 'Cancel')}
                              </button>
                            </>
                          )}
                          {treatment.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => updateStatus(treatment.id, 'COMPLETED')}
                              className="text-emerald-600 hover:underline text-sm font-medium"
                            >
                              {tr('إكمال', 'Complete')}
                            </button>
                          )}
                          {treatment.status === 'COMPLETED' && treatment.completedAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(treatment.completedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddTreatmentModal
          patientId={String(patientId || '')}
          language={language}
          tr={tr}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { mutate(); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}

function AddTreatmentModal({
  patientId,
  language,
  tr,
  onClose,
  onSaved,
}: {
  patientId: string;
  language: string;
  tr: (ar: string, en: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [toothNumber, setToothNumber] = useState('');
  const [surface, setSurface]         = useState('');
  const [procedureCode, setProcedureCode] = useState(DENTAL_PROCEDURES[0].code);
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const procedure = DENTAL_PROCEDURES.find((p) => p.code === procedureCode)!;

  const handleSave = async () => {
    if (!toothNumber || isNaN(Number(toothNumber))) {
      setError(tr('يرجى إدخال رقم السن', 'Please enter a valid tooth number'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await fetch(`/api/dental/treatment/${patientId}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          item: {
            toothNumber: Number(toothNumber),
            surface: surface.toUpperCase() || undefined,
            procedureCode: procedure.code,
            procedureName: procedure.nameEn,
            procedureNameAr: procedure.nameAr,
            fee: procedure.fee,
            status: 'PLANNED',
            priority: 1,
            notes,
          },
        }),
      });
      onSaved();
    } catch {
      setError(tr('حدث خطأ، يرجى المحاولة مرة أخرى', 'An error occurred, please try again'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full shadow-2xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">{tr('إضافة إجراء للخطة', 'Add Procedure to Plan')}</h2>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('رقم السن *', 'Tooth Number *')}
            </label>
            <input
              type="number"
              value={toothNumber}
              onChange={(e) => setToothNumber(e.target.value)}
              placeholder={tr('مثال: 36', 'e.g. 36')}
              min={11}
              max={85}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('السطح (اختياري)', 'Surface (optional)')}
            </label>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
            >
              <option value="">{tr('— اختر السطح —', '— Select surface —')}</option>
              <option value="O">{tr('إطباقي (O)', 'Occlusal (O)')}</option>
              <option value="M">{tr('إنسي (M)', 'Mesial (M)')}</option>
              <option value="D">{tr('وحشي (D)', 'Distal (D)')}</option>
              <option value="B">{tr('شفوي (B)', 'Buccal (B)')}</option>
              <option value="L">{tr('لساني (L)', 'Lingual (L)')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('الإجراء *', 'Procedure *')}
            </label>
            <select
              value={procedureCode}
              onChange={(e) => setProcedureCode(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
            >
              {DENTAL_PROCEDURES.map((p) => (
                <option key={p.code} value={p.code}>
                  {language === 'ar' ? p.nameAr : p.nameEn} — {p.fee.toLocaleString()} {language === 'ar' ? 'ر.س' : 'SAR'}
                </option>
              ))}
            </select>
          </div>
          <div className="p-3 bg-muted rounded-xl">
            <div className="text-sm text-muted-foreground">{tr('الرسوم المتوقعة', 'Expected Fee')}</div>
            <div className="text-xl font-bold text-foreground">
              {procedure.fee.toLocaleString()} {tr('ر.س', 'SAR')}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('ملاحظات', 'Notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr('ملاحظات سريرية اختيارية...', 'Optional clinical notes...')}
              className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
              rows={2}
            />
          </div>
        </div>
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !toothNumber}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? tr('جاري الإضافة...', 'Adding...') : tr('إضافة للخطة', 'Add to Plan')}
          </button>
        </div>
      </div>
    </div>
  );
}
