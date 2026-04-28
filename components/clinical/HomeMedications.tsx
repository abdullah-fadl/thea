'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Pill, AlertTriangle, Check } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export interface HomeMedication {
  id: string;
  drugName: string;
  genericName?: string;
  dose: string;
  unit: string;
  frequency: string;
  route: string;
  indication?: string;
  prescriber?: string;
  startDate?: string;
  lastTaken?: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  source: 'patient' | 'family' | 'pharmacy' | 'referral' | 'ehr';
  notes?: string;
}

interface Props {
  patientId: string;
  encounterId?: string;
  medications: HomeMedication[];
  onAdd: (med: Omit<HomeMedication, 'id'>) => void;
  onUpdate: (id: string, med: Partial<HomeMedication>) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  editable?: boolean;
}

const frequencyOptions = [
  { value: 'QD', label: 'مرة يومياً (QD)' },
  { value: 'BID', label: 'مرتين يومياً (BID)' },
  { value: 'TID', label: 'ثلاث مرات يومياً (TID)' },
  { value: 'QID', label: 'أربع مرات يومياً (QID)' },
  { value: 'Q8H', label: 'كل 8 ساعات (Q8H)' },
  { value: 'Q12H', label: 'كل 12 ساعة (Q12H)' },
  { value: 'QHS', label: 'عند النوم (QHS)' },
  { value: 'PRN', label: 'عند الحاجة (PRN)' },
  { value: 'WEEKLY', label: 'أسبوعياً' },
  { value: 'MONTHLY', label: 'شهرياً' },
];

const routeOptions = [
  { value: 'PO', label: 'فموي (PO)' },
  { value: 'IV', label: 'وريدي (IV)' },
  { value: 'IM', label: 'عضلي (IM)' },
  { value: 'SC', label: 'تحت الجلد (SC)' },
  { value: 'INH', label: 'استنشاق (INH)' },
  { value: 'TOP', label: 'موضعي (TOP)' },
  { value: 'PR', label: 'شرجي (PR)' },
  { value: 'SL', label: 'تحت اللسان (SL)' },
  { value: 'OPH', label: 'عيني (OPH)' },
  { value: 'OTIC', label: 'أذني (OTIC)' },
];

const sourceOptions = [
  { value: 'patient', label: 'المريض' },
  { value: 'family', label: 'العائلة' },
  { value: 'pharmacy', label: 'الصيدلية' },
  { value: 'referral', label: 'تحويل' },
  { value: 'ehr', label: 'السجل الإلكتروني' },
];

export function HomeMedications({
  patientId,
  encounterId,
  medications,
  onAdd,
  onUpdate,
  onDelete,
  onVerify,
  editable = true,
}: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMed, setEditingMed] = useState<HomeMedication | null>(null);

  const verifiedCount = medications.filter((m) => m.isVerified).length;
  const totalCount = medications.length;

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-slate-900">{tr('أدوية المنزل', 'Home Medications')}</h3>
          <p className="text-sm text-slate-500">
            {verifiedCount}/{totalCount} {tr('تم التحقق منها', 'verified')}
          </p>
        </div>
        {editable && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {tr('إضافة دواء', 'Add Medication')}
          </button>
        )}
      </div>

      <div className="divide-y">
        {medications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Pill className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>{tr('لا توجد أدوية منزلية مسجلة', 'No home medications recorded')}</p>
            {editable && (
              <button onClick={() => setShowAddForm(true)} className="mt-3 text-blue-600 hover:underline">
                {tr('أضف دواء', 'Add medication')}
              </button>
            )}
          </div>
        ) : (
          medications.map((med) => (
            <div key={med.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full ${
                    med.isVerified ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {med.isVerified ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{med.drugName}</span>
                    {med.genericName && <span className="text-sm text-slate-500">({med.genericName})</span>}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                    <span>
                      {med.dose} {med.unit}
                    </span>
                    <span>•</span>
                    <span>{frequencyOptions.find((f) => f.value === med.frequency)?.label || med.frequency}</span>
                    <span>•</span>
                    <span>{routeOptions.find((r) => r.value === med.route)?.label || med.route}</span>
                  </div>

                  {med.indication && <div className="text-sm text-slate-500 mt-1">{tr('السبب', 'Indication')}: {med.indication}</div>}

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span>{tr('المصدر', 'Source')}: {sourceOptions.find((s) => s.value === med.source)?.label}</span>
                    {med.lastTaken && <span>{tr('آخر جرعة', 'Last dose')}: {new Date(med.lastTaken).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>}
                  </div>

                  {med.isVerified && med.verifiedBy && (
                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> {tr('تم التحقق بواسطة', 'Verified by')} {med.verifiedBy}</div>
                  )}
                </div>

                {editable && (
                  <div className="flex items-center gap-1">
                    {!med.isVerified && (
                      <button
                        onClick={() => onVerify(med.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title={tr('تحقق', 'Verify')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingMed(med)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      title={tr('تعديل', 'Edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(med.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title={tr('حذف', 'Delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {(showAddForm || editingMed) && (
        <MedicationForm
          medication={editingMed || undefined}
          onSubmit={(data) => {
            if (editingMed) {
              onUpdate(editingMed.id, data);
            } else {
              onAdd(data as Omit<HomeMedication, 'id'>);
            }
            setShowAddForm(false);
            setEditingMed(null);
          }}
          onClose={() => {
            setShowAddForm(false);
            setEditingMed(null);
          }}
        />
      )}
    </div>
  );
}

function MedicationForm({
  medication,
  onSubmit,
  onClose,
}: {
  medication?: HomeMedication;
  onSubmit: (data: Partial<HomeMedication>) => void;
  onClose: () => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [formData, setFormData] = useState({
    drugName: medication?.drugName || '',
    genericName: medication?.genericName || '',
    dose: medication?.dose || '',
    unit: medication?.unit || 'mg',
    frequency: medication?.frequency || 'QD',
    route: medication?.route || 'PO',
    indication: medication?.indication || '',
    prescriber: medication?.prescriber || '',
    startDate: medication?.startDate?.split('T')[0] || '',
    lastTaken: medication?.lastTaken?.split('T')[0] || '',
    source: medication?.source || 'patient',
    notes: medication?.notes || '',
    isVerified: medication?.isVerified || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card">
          <h2 className="font-semibold">{medication ? tr('تعديل دواء', 'Edit Medication') : tr('إضافة دواء منزلي', 'Add Home Medication')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{tr('اسم الدواء', 'Drug Name')} *</label>
            <input
              type="text"
              value={formData.drugName}
              onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('مثال: Metformin', 'e.g., Metformin')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('الاسم العلمي', 'Generic Name')}</label>
            <input
              type="text"
              value={formData.genericName}
              onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('مثال: Metformin HCL', 'e.g., Metformin HCL')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الجرعة', 'Dose')} *</label>
              <input
                type="text"
                value={formData.dose}
                onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الوحدة', 'Unit')} *</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="mg">mg</option>
                <option value="g">g</option>
                <option value="mcg">mcg</option>
                <option value="mL">mL</option>
                <option value="units">units</option>
                <option value="puffs">puffs</option>
                <option value="drops">drops</option>
                <option value="tablets">tablets</option>
                <option value="capsules">capsules</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('التكرار', 'Frequency')} *</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('طريقة الإعطاء', 'Route of Administration')} *</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                {routeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('السبب/التشخيص', 'Indication/Diagnosis')}</label>
            <input
              type="text"
              value={formData.indication}
              onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('مثال: السكري النوع الثاني', 'e.g., Type 2 Diabetes')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('مصدر المعلومات', 'Information Source')} *</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الطبيب الواصف', 'Prescribing Doctor')}</label>
              <input
                type="text"
                value={formData.prescriber}
                onChange={(e) => setFormData({ ...formData, prescriber: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={tr('اسم الطبيب', 'Doctor name')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('تاريخ البدء', 'Start Date')}</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('آخر جرعة', 'Last Dose')}</label>
              <input
                type="date"
                value={formData.lastTaken}
                onChange={(e) => setFormData({ ...formData, lastTaken: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('ملاحظات', 'Notes')}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              placeholder={tr('أي ملاحظات إضافية...', 'Any additional notes...')}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">
              {tr('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {medication ? tr('تحديث', 'Update') : tr('إضافة', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
