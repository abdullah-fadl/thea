'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ObgynAntenatal() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { patientId } = useParams();
  const id = String(patientId || '');
  const { data: patientData } = useSWR(`/api/patients/${encodeURIComponent(id)}`, fetcher);
  const { data: formsData, mutate } = useSWR(
    `/api/obgyn/forms/${encodeURIComponent(id)}?type=antenatal`,
    fetcher
  );

  const [form, setForm] = useState({
    lmp: '',
    edd: '',
    gaWeeks: '',
    gravida: '',
    para: '',
    abortions: '',
    bp: '',
    weight: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const items = Array.isArray(formsData?.items) ? formsData.items : [];

  const saveForm = async () => {
    setSaving(true);
    await fetch(`/api/obgyn/forms/${encodeURIComponent(id)}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'antenatal', data: form }),
    });
    setSaving(false);
    setForm({ lmp: '', edd: '', gaWeeks: '', gravida: '', para: '', abortions: '', bp: '', weight: '', notes: '' });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr('\u0646\u0645\u0648\u0630\u062C \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062D\u0645\u0644', 'Antenatal Care Form')}</h1>
          <p className="text-muted-foreground">{patientData?.patient?.fullName || 'Patient'}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0622\u062E\u0631 \u062F\u0648\u0631\u0629 (LMP)', 'LMP')}</label>
            <input type="date" value={form.lmp} onChange={(e) => setForm({ ...form, lmp: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0645\u0648\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629 \u0627\u0644\u0645\u062A\u0648\u0642\u0639 (EDD)', 'EDD')}</label>
            <input type="date" value={form.edd} onChange={(e) => setForm({ ...form, edd: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062D\u0645\u0644 (GA)', 'GA (Weeks)')}</label>
            <input type="number" value={form.gaWeeks} onChange={(e) => setForm({ ...form, gaWeeks: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{tr('\u062D\u0645\u0644 (G)', 'G')}</label>
              <input type="number" value={form.gravida} onChange={(e) => setForm({ ...form, gravida: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{tr('\u0648\u0644\u0627\u062F\u0629 (P)', 'P')}</label>
              <input type="number" value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">{tr('\u0625\u062C\u0647\u0627\u0636 (A)', 'A')}</label>
              <input type="number" value={form.abortions} onChange={(e) => setForm({ ...form, abortions: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0636\u063A\u0637 \u0627\u0644\u062F\u0645 (BP)', 'Blood Pressure (BP)')}</label>
            <input type="text" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" placeholder="120/80" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0627\u0644\u0648\u0632\u0646 (kg)', 'Weight (kg)')}</label>
            <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'Notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" rows={3} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={saveForm} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl">
              {saving ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...', 'Saving...') : tr('\u062D\u0641\u0638', 'Save')}
            </button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-sm text-muted-foreground mb-3">{tr('\u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629', 'Previous Records')}</div>
          <div className="space-y-2">
            {items.length === 0 && <div className="text-sm text-muted-foreground">{tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A', 'No records')}</div>}
            {items.map((item: any) => (
              <div key={item.id} className="border border-border rounded-xl p-3 text-sm">
                <div className="text-muted-foreground">GA: {item.data?.gaWeeks || '\u2014'} {tr('\u0623\u0633\u0628\u0648\u0639', 'weeks')} • BP: {item.data?.bp || '\u2014'} • {tr('\u0648\u0632\u0646', 'Weight')}: {item.data?.weight || '\u2014'} kg</div>
                <div className="text-xs text-muted-foreground/60 mt-1">{item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
