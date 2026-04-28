'use client';

import { useState } from 'react';
import { Home, Hospital, Check, X, Plus, Printer, FileText } from 'lucide-react';
import type { ReconciliationItem } from './MedReconciliation';
import { useLang } from '@/hooks/use-lang';

interface DischargeMedication {
  id: string;
  source: 'home' | 'hospital' | 'new';
  drugName: string;
  dose: string;
  unit: string;
  frequency: string;
  route: string;
  duration?: string;
  quantity?: number;
  refills?: number;
  instructions?: string;
  includeInDischarge: boolean;
}

interface Props {
  patientId: string;
  encounterId: string;
  admissionReconciliation: ReconciliationItem[];
  hospitalMedications: any[];
  onComplete: (medications: DischargeMedication[]) => void;
  onPrint: () => void;
  onCancel: () => void;
}

export function DischargeMedRec({
  patientId,
  encounterId,
  admissionReconciliation,
  hospitalMedications,
  onComplete,
  onPrint,
  onCancel,
}: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [medications, setMedications] = useState<DischargeMedication[]>(() => {
    const dischargeMeds: DischargeMedication[] = [];

    admissionReconciliation
      .filter((item) => item.decision === 'continue' || item.decision === 'modify')
      .forEach((item) => {
        dischargeMeds.push({
          id: `dm_${item.homeMedication.id}`,
          source: 'home',
          drugName: item.homeMedication.drugName,
          dose: item.newDose || item.homeMedication.dose,
          unit: item.homeMedication.unit,
          frequency: item.newFrequency || item.homeMedication.frequency,
          route: item.homeMedication.route,
          includeInDischarge: true,
        });
      });

    hospitalMedications
      .filter((med) => med.status === 'active')
      .forEach((med) => {
        const exists = dischargeMeds.some((dm) => dm.drugName.toLowerCase() === med.drugName.toLowerCase());
        if (!exists) {
          dischargeMeds.push({
            id: `dm_${med.id}`,
            source: 'hospital',
            drugName: med.drugName,
            dose: med.dose,
            unit: med.unit || 'mg',
            frequency: med.frequency,
            route: med.route || 'PO',
            includeInDischarge: true,
          });
        }
      });

    return dischargeMeds;
  });

  const [showAddForm, setShowAddForm] = useState(false);

  const includedMeds = medications.filter((m) => m.includeInDischarge);
  const excludedMeds = medications.filter((m) => !m.includeInDischarge);

  const toggleInclude = (id: string) => {
    setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, includeInDischarge: !m.includeInDischarge } : m)));
  };

  const updateMedication = (id: string, updates: Partial<DischargeMedication>) => {
    setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const addMedication = (med: Omit<DischargeMedication, 'id'>) => {
    setMedications((prev) => [...prev, { ...med, id: `dm_new_${Date.now()}` }]);
    setShowAddForm(false);
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{tr('أدوية الخروج', 'Discharge Medications')}</h2>
            <p className="text-sm text-slate-500">{includedMeds.length} {tr('دواء سيتم صرفه', 'medications to be dispensed')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-card"
            >
              <Plus className="w-4 h-4" />
              {tr('إضافة دواء', 'Add Medication')}
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-card"
            >
              <Printer className="w-4 h-4" />
              {tr('طباعة', 'Print')}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          {tr('أدوية سيتم صرفها', 'Medications to Dispense')} ({includedMeds.length})
        </h3>

        <div className="space-y-3">
          {includedMeds.map((med) => (
            <div key={med.id} className="p-4 border rounded-lg hover:border-slate-300">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    med.source === 'home'
                      ? 'bg-blue-100 text-blue-600'
                      : med.source === 'hospital'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {med.source === 'home' ? (
                    <Home className="w-4 h-4" />
                  ) : med.source === 'hospital' ? (
                    <Hospital className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="font-medium text-slate-900">{med.drugName}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {med.dose} {med.unit} - {med.frequency} - {med.route}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-slate-500">{tr('المدة', 'Duration')}</label>
                      <input
                        type="text"
                        value={med.duration || ''}
                        onChange={(e) => updateMedication(med.id, { duration: e.target.value })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        placeholder={tr('مثال: 7 أيام', 'e.g., 7 days')}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">{tr('الكمية', 'Quantity')}</label>
                      <input
                        type="number"
                        value={med.quantity || ''}
                        onChange={(e) => updateMedication(med.id, { quantity: parseInt(e.target.value, 10) })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">{tr('إعادة الصرف', 'Refills')}</label>
                      <input
                        type="number"
                        value={med.refills || 0}
                        onChange={(e) => updateMedication(med.id, { refills: parseInt(e.target.value, 10) })}
                        className="w-full px-2 py-1 text-sm border rounded"
                        min="0"
                        max="5"
                      />
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-xs text-slate-500">{tr('تعليمات للمريض', 'Patient Instructions')}</label>
                    <input
                      type="text"
                      value={med.instructions || ''}
                      onChange={(e) => updateMedication(med.id, { instructions: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                      placeholder={tr('مثال: يؤخذ بعد الأكل', 'e.g., Take after meals')}
                    />
                  </div>
                </div>

                <button
                  onClick={() => toggleInclude(med.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title={tr('استبعاد', 'Exclude')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {excludedMeds.length > 0 && (
        <div className="p-4 border-t">
          <h3 className="font-medium text-slate-500 mb-3 flex items-center gap-2">
            <X className="w-5 h-5 text-slate-400" />
            {tr('أدوية مستبعدة', 'Excluded Medications')} ({excludedMeds.length})
          </h3>

          <div className="space-y-2">
            {excludedMeds.map((med) => (
              <div key={med.id} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-slate-600">{med.drugName}</span>
                  <span className="text-sm text-slate-400 mr-2">
                    {med.dose} {med.unit}
                  </span>
                </div>
                <button onClick={() => toggleInclude(med.id)} className="text-sm text-blue-600 hover:underline">
                  {tr('إضافة', 'Add')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
        <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-card">
          {tr('إلغاء', 'Cancel')}
        </button>

        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-card">
            <FileText className="w-4 h-4" />
            {tr('معاينة الوصفة', 'Preview Prescription')}
          </button>
          <button
            onClick={() => onComplete(includedMeds)}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Check className="w-4 h-4" />
            {tr('تأكيد وصرف الأدوية', 'Confirm & Dispense')}
          </button>
        </div>
      </div>

      {showAddForm && <AddDischargeMedForm onSubmit={addMedication} onClose={() => setShowAddForm(false)} tr={tr} />}
    </div>
  );
}

function AddDischargeMedForm({
  onSubmit,
  onClose,
  tr,
}: {
  onSubmit: (med: Omit<DischargeMedication, 'id'>) => void;
  onClose: () => void;
  tr: (ar: string, en: string) => string;
}) {
  const [formData, setFormData] = useState({
    drugName: '',
    dose: '',
    unit: 'mg',
    frequency: 'QD',
    route: 'PO',
    duration: '',
    quantity: 30,
    refills: 0,
    instructions: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      source: 'new',
      includeInDischarge: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">{tr('إضافة دواء جديد للخروج', 'Add New Discharge Medication')}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{tr('اسم الدواء', 'Drug Name')} *</label>
            <input
              type="text"
              value={formData.drugName}
              onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
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
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الوحدة', 'Unit')}</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="mg">mg</option>
                <option value="g">g</option>
                <option value="mcg">mcg</option>
                <option value="mL">mL</option>
                <option value="units">units</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('التكرار', 'Frequency')}</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="QD">{tr('مرة يومياً', 'Once daily')}</option>
                <option value="BID">{tr('مرتين يومياً', 'Twice daily')}</option>
                <option value="TID">{tr('ثلاث مرات', 'Three times daily')}</option>
                <option value="QID">{tr('أربع مرات', 'Four times daily')}</option>
                <option value="PRN">{tr('عند الحاجة', 'As needed')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الطريقة', 'Route')}</label>
              <select
                value={formData.route}
                onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="PO">{tr('فموي', 'Oral')}</option>
                <option value="IV">{tr('وريدي', 'Intravenous')}</option>
                <option value="IM">{tr('عضلي', 'Intramuscular')}</option>
                <option value="SC">{tr('تحت الجلد', 'Subcutaneous')}</option>
                <option value="INH">{tr('استنشاق', 'Inhalation')}</option>
                <option value="TOP">{tr('موضعي', 'Topical')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{tr('المدة', 'Duration')}</label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={tr('7 أيام', '7 days')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('الكمية', 'Quantity')}</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{tr('إعادة صرف', 'Refills')}</label>
              <input
                type="number"
                value={formData.refills}
                onChange={(e) => setFormData({ ...formData, refills: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{tr('تعليمات', 'Instructions')}</label>
            <input
              type="text"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder={tr('يؤخذ بعد الأكل', 'Take after meals')}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50">
              {tr('إلغاء', 'Cancel')}
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {tr('إضافة', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
