'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, Circle, MinusCircle, Save } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const SYSTEMS = [
  { key: 'general', labelAr: 'عام', labelEn: 'General' },
  { key: 'heent', labelAr: 'الرأس والعيون والأنف والحنجرة', labelEn: 'HEENT' },
  { key: 'cardiovascular', labelAr: 'القلب والأوعية', labelEn: 'Cardiovascular' },
  { key: 'respiratory', labelAr: 'الجهاز التنفسي', labelEn: 'Respiratory' },
  { key: 'abdomen', labelAr: 'البطن', labelEn: 'Abdomen' },
  { key: 'msk', labelAr: 'العضلات والعظام', labelEn: 'MSK' },
  { key: 'neuro', labelAr: 'الجهاز العصبي', labelEn: 'Neuro' },
  { key: 'skin', labelAr: 'الجلد', labelEn: 'Skin' },
  { key: 'psych', labelAr: 'النفسي', labelEn: 'Psych' },
];

type ExamStatus = 'NORMAL' | 'ABNORMAL' | 'NOT_EXAMINED';

interface ExamSystem {
  status: ExamStatus;
  notes: string;
}

interface Props {
  encounterId: string;
}

export function PhysicalExam({ encounterId }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR(`/api/opd/encounters/${encounterId}/physical-exam`, fetcher);
  const [saving, setSaving] = useState(false);

  const [systems, setSystems] = useState<Record<string, ExamSystem>>(
    SYSTEMS.reduce<Record<string, ExamSystem>>((acc, system) => {
      acc[system.key] = { status: 'NOT_EXAMINED', notes: '' };
      return acc;
    }, {})
  );
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (data?.exam?.systems) {
      setSystems((prev) => ({ ...prev, ...data.exam.systems }));
      setSummary(data.exam.summary || '');
    }
  }, [data]);

  const allNormal = useMemo(
    () => SYSTEMS.every((system) => systems[system.key]?.status === 'NORMAL'),
    [systems]
  );

  const markAllNormal = () => {
    setSystems((prev) =>
      SYSTEMS.reduce<Record<string, ExamSystem>>((acc, system) => {
        acc[system.key] = { status: 'NORMAL', notes: prev[system.key]?.notes || '' };
        return acc;
      }, {})
    );
  };

  const saveExam = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/opd/encounters/${encounterId}/physical-exam`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systems, summary }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save');
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const statusButton = (systemKey: string, status: ExamStatus, label: string) => {
    const active = systems[systemKey]?.status === status;
    return (
      <button
        onClick={() => setSystems((prev) => ({ ...prev, [systemKey]: { ...prev[systemKey], status } }))}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
          active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{tr('الفحص السريري', 'Physical Exam')}</span>
          {allNormal && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> {tr('الكل طبيعي', 'All Normal')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllNormal}
            className="px-3 py-2 text-xs rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
          >
            {tr('تحديد الكل طبيعي', 'Mark All Normal')}
          </button>
          <button
            onClick={saveExam}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {SYSTEMS.map((system) => (
          <div key={system.key} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{tr(system.labelAr, system.labelEn)}</span>
                {systems[system.key]?.status === 'NORMAL' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                {systems[system.key]?.status === 'ABNORMAL' && <Circle className="w-4 h-4 text-amber-500" />}
                {systems[system.key]?.status === 'NOT_EXAMINED' && <MinusCircle className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="flex gap-1.5">
                {statusButton(system.key, 'NORMAL', tr('طبيعي', 'Normal'))}
                {statusButton(system.key, 'ABNORMAL', tr('غير طبيعي', 'Abnormal'))}
                {statusButton(system.key, 'NOT_EXAMINED', tr('لم يُفحص', 'Not Examined'))}
              </div>
            </div>
            <textarea
              value={systems[system.key]?.notes || ''}
              onChange={(e) =>
                setSystems((prev) => ({
                  ...prev,
                  [system.key]: { ...prev[system.key], notes: e.target.value },
                }))
              }
              placeholder={tr('ملاحظات...', 'Notes...')}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-slate-500">{tr('الملخص', 'Summary')}</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>
    </div>
  );
}
