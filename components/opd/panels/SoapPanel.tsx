'use client';

import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { ICD10Selector, ICD10Code } from '@/components/clinical/ICD10Selector';
import { NOTE_TEMPLATES } from '@/lib/clinical/noteTemplates';
import { useSpeechDictation } from '@/lib/hooks/useSpeechDictation';
import { useLang } from '@/hooks/use-lang';
import { Mic, Clipboard } from 'lucide-react';
import { getSpecialtyConfig } from '@/lib/opd/specialtyConfig';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function SoapPanel({ visitId, specialtyCode }: { visitId: string; specialtyCode?: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR(`/api/opd/encounters/${visitId}/visit-notes`, fetcher);
  const { data: nursingData } = useSWR(`/api/opd/encounters/${visitId}/nursing`, fetcher);

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [diagnoses, setDiagnoses] = useState<ICD10Code[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [autoSaveMessage, setAutoSaveMessage] = useState('');
  const [templateId, setTemplateId] = useState('general');
  const [cdsAlerts, setCdsAlerts] = useState<any[]>([]);
  const [cdsLoading, setCdsLoading] = useState(false);
  const dictation = useSpeechDictation();

  const storageKey = `opd_visit_note_draft_${visitId}`;

  // Load local draft if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setChiefComplaint(draft.chiefComplaint || '');
      setHistoryOfPresentIllness(draft.historyOfPresentIllness || '');
      setPhysicalExam(draft.physicalExam || '');
      setAssessment(draft.assessment || '');
      setPlan(draft.plan || '');
      setDiagnoses(Array.isArray(draft.diagnoses) ? draft.diagnoses : []);
    } catch {
      // ignore draft
    }
  }, [storageKey]);

  // Pre-populate form from latest saved note when no meaningful local draft exists
  useEffect(() => {
    if (!data?.items?.length) return;
    const hasFormData = chiefComplaint || assessment || plan;
    if (hasFormData) return;

    // Check if draft has meaningful content (not just empty fields)
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        const draftHasContent = draft.chiefComplaint || draft.assessment || draft.plan || draft.historyOfPresentIllness || draft.physicalExam;
        if (draftHasContent) return; // real draft takes priority
      }
    } catch { /* ignore */ }

    const note = data.items[0];
    if (note) {
      setChiefComplaint(note.chiefComplaint || '');
      setHistoryOfPresentIllness(note.historyOfPresentIllness || '');
      setPhysicalExam(note.physicalExam || '');
      setAssessment(note.assessment || '');
      setPlan(note.plan || '');
      if (Array.isArray(note.diagnoses) && note.diagnoses.length > 0) {
        setDiagnoses(note.diagnoses.map((d: any) => ({
          code: d.code || '',
          description: d.description || '',
          descriptionAr: d.descriptionAr || '',
        })));
      }
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/opd/encounters/${visitId}/visit-notes`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chiefComplaint,
          historyOfPresentIllness,
          physicalExam,
          assessment,
          plan,
          diagnoses: diagnoses.map((d, index) => ({
            code: d.code,
            description: d.description,
            descriptionAr: d.descriptionAr,
            isPrimary: index === 0,
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save note');
      }
      // Keep the form populated with saved data (don't clear)
      mutate();
      localStorage.removeItem(storageKey);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const hasContent = chiefComplaint || historyOfPresentIllness || physicalExam || assessment || plan;
    if (!hasContent) return; // don't save empty drafts
    const draft = {
      chiefComplaint,
      historyOfPresentIllness,
      physicalExam,
      assessment,
      plan,
      diagnoses,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [chiefComplaint, historyOfPresentIllness, physicalExam, assessment, plan, diagnoses, storageKey]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (saving || autoSaving) return;
      const hasAny =
        chiefComplaint.trim() ||
        historyOfPresentIllness.trim() ||
        physicalExam.trim() ||
        assessment.trim() ||
        plan.trim();
      if (!hasAny) return;

      if (!chiefComplaint.trim() || !assessment.trim() || !plan.trim()) {
        setAutoSaveMessage(tr('تم حفظ المسودة محلياً.', 'Draft saved locally.'));
        return;
      }

      setAutoSaving(true);
      try {
        const res = await fetch(`/api/opd/encounters/${visitId}/visit-notes`, {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chiefComplaint,
            historyOfPresentIllness,
            physicalExam,
            assessment,
            plan,
            autoSave: true,
            diagnoses: diagnoses.map((d, index) => ({
              code: d.code,
              description: d.description,
              descriptionAr: d.descriptionAr,
              isPrimary: index === 0,
            })),
          }),
        });
        if (res.ok) {
          setAutoSaveMessage(tr('تم الحفظ التلقائي.', 'Auto-saved.'));
          mutate();
        }
      } catch {
        setAutoSaveMessage(tr('فشل الحفظ التلقائي.', 'Auto-save failed.'));
      } finally {
        setAutoSaving(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [
    visitId,
    chiefComplaint,
    historyOfPresentIllness,
    physicalExam,
    assessment,
    plan,
    diagnoses,
    saving,
    autoSaving,
    mutate,
  ]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const latest = items[0];
  const latestNursing = Array.isArray(nursingData?.items) ? nursingData.items[0] : null;
  const latestVitals = latestNursing?.vitals || latestNursing?.latestVitals || null;

  const applyTemplate = () => {
    const template = NOTE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setHistoryOfPresentIllness(template.historyOfPresentIllness || historyOfPresentIllness);
    setPhysicalExam(template.physicalExam || physicalExam);
    setPlan(template.plan || plan);
  };

  const runCds = async () => {
    setCdsLoading(true);
    try {
      const res = await fetch('/api/clinical/cds/evaluate', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: latestVitals,
          diagnoses,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      setCdsAlerts(Array.isArray(payload?.alerts) ? payload.alerts : []);
    } finally {
      setCdsLoading(false);
    }
  };

  const toggleDictation = (onResult: (text: string) => void) => {
    if (dictation.listening) {
      dictation.stop();
      return;
    }
    dictation.start(onResult);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{tr('ملاحظات SOAP', 'SOAP Notes')}</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {NOTE_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyTemplate}
            className="px-3 py-2 rounded-lg text-sm bg-slate-100 hover:bg-slate-200"
          >
            {tr('تطبيق قالب', 'Apply template')}
          </button>
          <button
            type="button"
            onClick={runCds}
            className="px-3 py-2 rounded-lg text-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            {cdsLoading ? tr('جاري الفحص...', 'Checking...') : tr('فحص القرار السريري', 'Run clinical decision support')}
          </button>
          {dictation.error && <span className="text-xs text-red-600">{dictation.error}</span>}
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">{tr('الشكوى الرئيسية *', 'Chief complaint *')}</label>
            <div className="flex gap-2 items-center">
            <input
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
              <button
                type="button"
                onClick={() => toggleDictation((text) => setChiefComplaint((prev) => `${prev} ${text}`.trim()))}
                className={`mt-1 px-3 py-2 rounded-lg text-sm ${
                  dictation.listening ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{tr('تاريخ المرض الحالي', 'History of present illness')}</label>
            <div className="flex gap-2 items-start">
            <textarea
              value={historyOfPresentIllness}
              onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[80px]"
            />
              <button
                type="button"
                onClick={() => toggleDictation((text) => setHistoryOfPresentIllness((prev) => `${prev} ${text}`.trim()))}
                className={`mt-1 px-3 py-2 rounded-lg text-sm ${
                  dictation.listening ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">{tr('الفحص السريري', 'Physical exam')}</label>
              {specialtyCode && (() => {
                const cfg = getSpecialtyConfig(specialtyCode);
                const hint = language === 'ar' ? cfg?.soapHints?.physicalExamAr : cfg?.soapHints?.physicalExamEn;
                if (!hint) return null;
                return (
                  <button type="button" onClick={() => setPhysicalExam(hint)}
                    className="text-xs text-blue-600 hover:text-blue-800 transition">
                    <><Clipboard className="h-3.5 w-3.5 inline-block" /> {tr('قالب التخصص', 'Specialty template')}</>

                  </button>
                );
              })()}
            </div>
            <div className="flex gap-2 items-start">
            <textarea
              value={physicalExam}
              onChange={(e) => setPhysicalExam(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[80px]"
            />
              <button
                type="button"
                onClick={() => toggleDictation((text) => setPhysicalExam((prev) => `${prev} ${text}`.trim()))}
                className={`mt-1 px-3 py-2 rounded-lg text-sm ${
                  dictation.listening ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{tr('التقييم *', 'Assessment *')}</label>
            <div className="flex gap-2 items-start">
            <textarea
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[80px]"
            />
              <button
                type="button"
                onClick={() => toggleDictation((text) => setAssessment((prev) => `${prev} ${text}`.trim()))}
                className={`mt-1 px-3 py-2 rounded-lg text-sm ${
                  dictation.listening ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ICD10Selector value={diagnoses} onChange={setDiagnoses} maxSelections={10} />
          <div>
            <label className="block text-sm font-medium text-slate-700">{tr('الخطة *', 'Plan *')}</label>
            <div className="flex gap-2 items-start">
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[80px]"
            />
              <button
                type="button"
                onClick={() => toggleDictation((text) => setPlan((prev) => `${prev} ${text}`.trim()))}
                className={`mt-1 px-3 py-2 rounded-lg text-sm ${
                  dictation.listening ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>
          {cdsAlerts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="font-medium text-amber-800 mb-2">{tr('تنبيهات القرار السريري', 'Clinical decision alerts')}</div>
              <div className="space-y-2">
                {cdsAlerts.map((alert: any) => (
                  <div key={alert.id} className="text-amber-700">
                    <strong>{alert.title}:</strong> {alert.message}
                    {alert.recommendation ? (
                      <div className="text-xs text-amber-600 mt-1">{alert.recommendation}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {autoSaveMessage ? <div className="text-xs text-slate-500">{autoSaveMessage}</div> : null}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save note')}
          </button>
        </div>
      </div>

      {latest ? (
        <div className="bg-card rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{tr('آخر ملاحظة', 'Latest note')}</h3>
          <div className="space-y-2 text-sm text-slate-700">
            <div><strong>{tr('الشكوى الرئيسية', 'Chief complaint')}:</strong> {latest.chiefComplaint}</div>
            <div><strong>{tr('التقييم', 'Assessment')}:</strong> {latest.assessment}</div>
            <div><strong>{tr('الخطة', 'Plan')}:</strong> {latest.plan}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
