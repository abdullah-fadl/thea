'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, Plus, Trash2, CheckCircle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa', 'Latex', 'Eggs', 'Peanuts', 'Shellfish', 'NSAIDs'];

const ALLERGY_TYPES = [
  { value: 'DRUG', labelAr: 'دواء', labelEn: 'Drug' },
  { value: 'FOOD', labelAr: 'طعام', labelEn: 'Food' },
  { value: 'ENVIRONMENT', labelAr: 'بيئي', labelEn: 'Environmental' },
  { value: 'OTHER', labelAr: 'أخرى', labelEn: 'Other' },
];

const SEVERITY_LEVELS = [
  { value: 'LOW', labelAr: 'خفيف', labelEn: 'Low' },
  { value: 'MODERATE', labelAr: 'متوسط', labelEn: 'Moderate' },
  { value: 'SEVERE', labelAr: 'شديد', labelEn: 'Severe' },
];

interface Props {
  patientId: string;
}

export function AllergiesManager({ patientId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { confirm, alert: showAlert } = useConfirm();
  const { data, mutate } = useSWR(`/api/patients/${patientId}/allergies`, fetcher);
  const allergies = data?.items || [];
  const nkda = Boolean(data?.nkda);

  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [type, setType] = useState('DRUG');
  const [severity, setSeverity] = useState('MODERATE');
  const [saving, setSaving] = useState(false);

  const addAllergy = async () => {
    if (!allergen.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/allergies`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergen, reaction, type, severity }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || tr('فشل إضافة الحساسية', 'Failed to add allergy'));
      setAllergen('');
      setReaction('');
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const deleteAllergy = async (id: string) => {
    const confirmed = await confirm(
      tr('هل أنت متأكد من حذف هذه الحساسية؟', 'Are you sure you want to delete this allergy?')
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/patients/${patientId}/allergies/${id}`, { credentials: 'include', method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || tr('فشل حذف الحساسية', 'Failed to delete allergy'));
      }
      await mutate();
    } catch (err) {
      console.error('Delete allergy error:', err);
      await showAlert(tr('فشل حذف الحساسية', 'Failed to delete allergy'));
    }
  };

  const markNkda = async () => {
    const res = await fetch(`/api/patients/${patientId}/allergies/nkda`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nkda: true }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || tr('فشل تعيين NKDA', 'Failed to set NKDA'));
    await mutate();
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-slate-900">{tr('الحساسية', 'Allergies')}</span>
        </div>
        <button
          onClick={markNkda}
          className="text-xs px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        >
          NKDA
        </button>
      </div>

      {nkda && allergies.length === 0 && (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
          <CheckCircle className="w-4 h-4" />
          {tr('لا توجد حساسية دوائية معروفة (NKDA)', 'No known drug allergies (NKDA)')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-slate-500">{tr('المادة المسببة للحساسية', 'Allergen')}</label>
          <input
            value={allergen}
            onChange={(e) => setAllergen(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {COMMON_ALLERGIES.map((item) => (
              <button
                key={item}
                onClick={() => setAllergen(item)}
                className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">{tr('النوع', 'Type')}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-card"
          >
            {ALLERGY_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {tr(option.labelAr, option.labelEn)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">{tr('الشدة', 'Severity')}</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-card"
          >
            {SEVERITY_LEVELS.map((option) => (
              <option key={option.value} value={option.value}>
                {tr(option.labelAr, option.labelEn)}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4">
          <label className="text-xs text-slate-500">{tr('التفاعل', 'Reaction')}</label>
          <input
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <button
        onClick={addAllergy}
        disabled={saving || !allergen.trim()}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {tr('إضافة حساسية', 'Add Allergy')}
      </button>

      <div className="space-y-2">
        {allergies.map((allergy: any) => (
          <div key={allergy.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
            <div>
              <div className="font-medium">{allergy.allergen || allergy.substance}</div>
              <div className="text-xs text-slate-500">
                {allergy.type} • {allergy.severity}
                {allergy.reaction ? ` • ${allergy.reaction}` : ''}
              </div>
            </div>
            <button onClick={() => deleteAllergy(allergy.id)} className="text-red-500 text-xs">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
