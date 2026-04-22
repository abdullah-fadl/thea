'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function ObgynPostpartum() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { patientId } = useParams();
  const id = String(patientId || '');
  const { data: patientData } = useSWR(`/api/patients/${encodeURIComponent(id)}`, fetcher);
  const { data: formsData, mutate } = useSWR(
    `/api/obgyn/forms/${encodeURIComponent(id)}?type=postpartum`,
    fetcher
  );

  const [form, setForm] = useState({
    deliveryDate: '',
    babyWeight: '',
    babyApgar: '',
    motherStatus: '',
    bleeding: '',
    feeding: '',
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
      body: JSON.stringify({ type: 'postpartum', data: form }),
    });
    setSaving(false);
    setForm({ deliveryDate: '', babyWeight: '', babyApgar: '', motherStatus: '', bleeding: '', feeding: '', notes: '' });
    mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr('\u0646\u0645\u0648\u0630\u062C \u0645\u0627 \u0628\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'Postpartum Care Form')}</h1>
          <p className="text-muted-foreground">{patientData?.patient?.fullName || 'Patient'}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'Delivery Date')}</label>
            <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0648\u0632\u0646 \u0627\u0644\u0637\u0641\u0644 (kg)', 'Baby Weight (kg)')}</label>
            <input type="number" value={form.babyWeight} onChange={(e) => setForm({ ...form, babyWeight: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u062F\u0631\u062C\u0629 \u0623\u0628\u063A\u0627\u0631 (Apgar)', 'Apgar Score')}</label>
            <input type="text" value={form.babyApgar} onChange={(e) => setForm({ ...form, babyApgar: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" placeholder="8/9" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0645', 'Maternal Status')}</label>
            <input type="text" value={form.motherStatus} onChange={(e) => setForm({ ...form, motherStatus: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0627\u0644\u0646\u0632\u064A\u0641', 'Bleeding')}</label>
            <select value={form.bleeding} onChange={(e) => setForm({ ...form, bleeding: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus">
              <option value="">{tr('\u0627\u062E\u062A\u0631...', 'Select...')}</option>
              <option value="Normal">{tr('\u0637\u0628\u064A\u0639\u064A', 'Normal')}</option>
              <option value="Moderate">{tr('\u0645\u062A\u0648\u0633\u0637', 'Moderate')}</option>
              <option value="Heavy">{tr('\u063A\u0632\u064A\u0631', 'Heavy')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">{tr('\u0627\u0644\u0631\u0636\u0627\u0639\u0629', 'Feeding')}</label>
            <select value={form.feeding} onChange={(e) => setForm({ ...form, feeding: e.target.value })} className="w-full border border-border rounded-xl px-3 py-2 thea-input-focus">
              <option value="">{tr('\u0627\u062E\u062A\u0631...', 'Select...')}</option>
              <option value="Breast">{tr('\u0637\u0628\u064A\u0639\u064A', 'Breastfeeding')}</option>
              <option value="Formula">{tr('\u0635\u0646\u0627\u0639\u064A', 'Formula')}</option>
              <option value="Mixed">{tr('\u0645\u0634\u062A\u0631\u0643', 'Mixed')}</option>
            </select>
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
                <div className="text-muted-foreground">
                  {tr('\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0644\u0627\u062F\u0629', 'Delivery Date')}: {item.data?.deliveryDate || '\u2014'} • {tr('\u0648\u0632\u0646 \u0627\u0644\u0637\u0641\u0644', 'Baby Weight')}: {item.data?.babyWeight || '\u2014'} kg • {tr('\u0627\u0644\u0631\u0636\u0627\u0639\u0629', 'Feeding')}: {item.data?.feeding || '\u2014'}
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1">{item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
