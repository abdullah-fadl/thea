'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import dynamic from 'next/dynamic';
import { AlertCircle, Search, FileText, Stethoscope, Clipboard, Building2, UserRound } from 'lucide-react';

const Partogram = dynamic(() => import('@/components/obgyn/Partogram'), { ssr: false });

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const MEOWS_CONFIG: Record<string, {
  bg: string; text: string; labelAr: string; labelEn: string; border: string;
}> = {
  NORMAL:    { bg: 'bg-emerald-50', text: 'text-emerald-700', labelAr: 'طبيعي',   labelEn: 'Normal',    border: 'border-emerald-200' },
  CAUTION:   { bg: 'bg-yellow-50',  text: 'text-yellow-700',  labelAr: 'تنبيه',   labelEn: 'Caution',   border: 'border-yellow-200' },
  URGENT:    { bg: 'bg-orange-50',  text: 'text-orange-700',  labelAr: 'عاجل',    labelEn: 'Urgent',    border: 'border-orange-200' },
  EMERGENCY: { bg: 'bg-red-50',     text: 'text-red-700',     labelAr: 'طارئ', labelEn: 'Emergency', border: 'border-red-300' },
};

const getMeowsLabel = (cfg: typeof MEOWS_CONFIG[string], language: string) =>
  language === 'ar' ? cfg.labelAr : cfg.labelEn;

const DELIVERY_DECISIONS = [
  { value: 'AWAIT',        labelAr: 'مراقبة ومتابعة',      labelEn: 'Watch & Wait',         color: 'bg-blue-100 text-blue-700' },
  { value: 'AUGMENT',      labelAr: 'تحفيز المخاض',         labelEn: 'Augment Labor',        color: 'bg-amber-100 text-amber-700' },
  { value: 'INSTRUMENTAL', labelAr: 'ولادة بالملقط / شفط',  labelEn: 'Instrumental Delivery', color: 'bg-orange-100 text-orange-700' },
  { value: 'CSECTION',     labelAr: '🔪 عملية قيصرية',       labelEn: '🔪 Cesarean Section',   color: 'bg-red-100 text-red-700' },
  { value: 'NORMAL',       labelAr: '✓ ولادة طبيعية',        labelEn: '✓ Normal Delivery',    color: 'bg-emerald-100 text-emerald-700' },
];

const getDecisionLabel = (decision: typeof DELIVERY_DECISIONS[number], language: string) =>
  language === 'ar' ? decision.labelAr : decision.labelEn;

// ── Doctor Assessment Form ────────────────────────────────────────────────────
function DoctorAssessmentForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [form, setForm] = useState({
    dilation: '', station: '0', effacement: '', membranesStatus: '',
    bishopScore: '',
    deliveryDecision: 'AWAIT',
    soapSubjective: '', soapObjective: '', soapAssessment: '', soapPlan: '',
    prescriptions: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'exam' | 'soap'>('exam');

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/obgyn/labor/${encodeURIComponent(patientId)}/doctor`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) onSaved();
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(['exam', 'soap'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {t === 'exam'
              ? tr('الفحص والقرار', 'Exam & Decision')
              : 'SOAP'}
          </button>
        ))}
      </div>

      {tab === 'exam' && (
        <div className="space-y-4">
          {/* Cervical Assessment */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              {tr('تقييم عنق الرحم', 'Cervical Assessment')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('الاتساع (cm)', 'Dilation (cm)')}
                </label>
                <input type="number" min="0" max="10" value={form.dilation}
                  onChange={f('dilation')} placeholder="0–10"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('الترقق (%)', 'Effacement (%)')}
                </label>
                <input type="number" min="0" max="100" value={form.effacement}
                  onChange={f('effacement')} placeholder="0–100"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('مستوى الرأس', 'Fetal Station')}
                </label>
                <select value={form.station} onChange={f('station')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[-3, -2, -1, 0, 1, 2, 3].map((s) => (
                    <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('بيشوب سكور', 'Bishop Score')}
                </label>
                <input type="number" min="0" max="13" value={form.bishopScore}
                  onChange={f('bishopScore')} placeholder="0–13"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">
                  {tr('حالة الأغشية', 'Membranes Status')}
                </label>
                <select value={form.membranesStatus} onChange={f('membranesStatus')}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{tr('— اختر —', '— Select —')}</option>
                  <option value="INTACT">{tr('سليمة', 'Intact')}</option>
                  <option value="RUPTURED">{tr('مكسورة (SROM)', 'Ruptured (SROM)')}</option>
                  <option value="ARTIFICIAL">{tr('كسر طبي (AROM)', 'Artificial (AROM)')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Delivery Decision */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">
              {tr('قرار الولادة', 'Delivery Decision')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {DELIVERY_DECISIONS.map(({ value, labelAr, labelEn, color }) => (
                <button
                  key={value}
                  onClick={() => setForm((prev) => ({ ...prev, deliveryDecision: value }))}
                  className={`py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.deliveryDecision === value
                      ? `${color} border-current`
                      : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
                >
                  {language === 'ar' ? labelAr : labelEn}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('ملاحظات الطبيب', 'Doctor Notes')}
            </label>
            <textarea rows={3} value={form.notes} onChange={f('notes')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
      )}

      {tab === 'soap' && (
        <div className="space-y-3">
          {[
            { key: 'soapSubjective'  as const, label: tr('Subjective — شكوى المريضة',       'Subjective — Patient Complaint') },
            { key: 'soapObjective'   as const, label: tr('Objective — النتائج الموضوعية',    'Objective — Clinical Findings') },
            { key: 'soapAssessment'  as const, label: tr('Assessment — التقييم والتشخيص',    'Assessment — Diagnosis') },
            { key: 'soapPlan'        as const, label: tr('Plan — خطة العلاج',                'Plan — Treatment Plan') },
            { key: 'prescriptions'   as const, label: tr('الوصفة الطبية',                    'Prescription') },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <textarea rows={3} value={form[key]} onChange={f(key)}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-60">
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LaborDoctorStation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assessment' | 'partogram' | 'nursing' | 'history'>('assessment');

  const { data, mutate, isValidating } = useSWR('/api/obgyn/labor/worklist', fetcher, {
    refreshInterval: 30000,
  });
  const patients: any[] = data?.patients ?? [];

  const { data: nursingData } = useSWR(
    selectedPatient ? `/api/obgyn/labor/${encodeURIComponent(selectedPatient.patientId)}/nursing` : null,
    fetcher
  );
  const nursingEntries: any[] = nursingData?.entries ?? [];

  const { data: doctorData, mutate: mutateDoctor } = useSWR(
    selectedPatient ? `/api/obgyn/labor/${encodeURIComponent(selectedPatient.patientId)}/doctor` : null,
    fetcher
  );
  const doctorEntries: any[] = doctorData?.entries ?? [];

  const selPat = selectedPatient
    ? patients.find((p) => p.patientId === selectedPatient.patientId) ?? selectedPatient
    : null;

  const meowsCfg = selPat ? MEOWS_CONFIG[selPat.alertLevel] ?? MEOWS_CONFIG.NORMAL : null;
  const latestNursing = nursingEntries[0] ?? selPat?.latestNursing;
  const latestDoctor = doctorEntries[0] ?? selPat?.latestDoctor;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <UserRound className="h-5 w-5" />
          <div>
            <h1 className="font-bold text-foreground">
              {tr('محطة طبيب الولادة', 'Labor Doctor Station')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {patients.length} {tr('مريضة نشطة', 'active patients')}
            </p>
          </div>
        </div>
        {isValidating && (
          <span className="text-xs text-muted-foreground">
            {tr('جاري التحديث...', 'Refreshing...')}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Patient List */}
        <div className="w-72 shrink-0 border-e border-border bg-card overflow-y-auto thea-scroll">
          {patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <Building2 className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {tr('لا توجد مريضات نشطات', 'No active labor patients')}
              </p>
            </div>
          ) : (
            patients.map((p: any) => {
              const cfg = MEOWS_CONFIG[p.alertLevel] ?? MEOWS_CONFIG.NORMAL;
              const isSelected = selectedPatient?.patientId === p.patientId;
              const decisionObj = DELIVERY_DECISIONS.find((d) => d.value === p.latestDoctor?.deliveryDecision);
              const admittedHours = Math.floor(
                (Date.now() - new Date(p.admittedAt).getTime()) / 3600000
              );

              return (
                <button
                  key={p.patientId}
                  onClick={() => { setSelectedPatient(p); setActiveTab('assessment'); }}
                  className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                    isSelected ? 'bg-blue-50 border-s-2 border-s-blue-500' : 'hover:bg-muted/50'
                  } ${p.alertLevel === 'EMERGENCY' ? 'bg-red-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{p.patient?.fullName}</div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      {p.meowsScore !== null ? p.meowsScore : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {language === 'ar' ? `منذ ${admittedHours}س` : `${admittedHours}h`}
                    </span>
                    {p.dilation !== null && <span>• {p.dilation}cm</span>}
                    {decisionObj && decisionObj.value !== 'AWAIT' && (
                      <span className="text-blue-600 font-medium">
                        • {getDecisionLabel(decisionObj, language)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        {selPat ? (
          <div className="flex-1 overflow-y-auto thea-scroll p-4 space-y-4">
            {/* Patient header */}
            <div className={`rounded-2xl border p-4 ${meowsCfg?.bg ?? ''} ${meowsCfg?.border ?? 'border-border'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-foreground">{selPat.patient?.fullName}</h2>
                    {meowsCfg && selPat.meowsScore !== null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${meowsCfg.text}`}>
                        MEOWS {selPat.meowsScore} — {getMeowsLabel(meowsCfg, language)}
                      </span>
                    )}
                    {latestDoctor?.deliveryDecision && latestDoctor.deliveryDecision !== 'AWAIT' && (() => {
                      const dec = DELIVERY_DECISIONS.find((d) => d.value === latestDoctor.deliveryDecision);
                      return dec ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dec.color}`}>
                          {getDecisionLabel(dec, language)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    <span>MRN: {selPat.patient?.mrn}</span>
                    <span>G{selPat.episodeData?.gravida ?? '—'}P{selPat.episodeData?.para ?? '—'}</span>
                    <span>EDD: {selPat.episodeData?.edd || '—'}</span>
                    <span>{selPat.episodeData?.presentationType}</span>
                    <span>{selPat.episodeData?.membranesStatus}</span>
                  </div>
                </div>
              </div>

              {/* Quick vitals strip */}
              {latestNursing && (
                <div className="mt-3 pt-3 border-t border-white/30 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {[
                    ['BP',                                    latestNursing.bp],
                    [tr('HR أم', 'Mat HR'),                   latestNursing.hr ? `${latestNursing.hr}` : null],
                    [tr('حرارة', 'Temp'),                     latestNursing.temp ? `${latestNursing.temp}°` : null],
                    ['FHR',                                   latestNursing.fetalHr ? `${latestNursing.fetalHr}` : null,
                      latestNursing.fetalHr && (latestNursing.fetalHr < 110 || latestNursing.fetalHr > 160)],
                    [tr('اتساع', 'Dilation'),                 latestNursing.dilation ? `${latestNursing.dilation}cm` : null],
                    [tr('انقباض', 'CTX'),                     latestNursing.contractions ? `${latestNursing.contractions}/10` : null],
                  ].map(([label, value, alert]) => (
                    <div key={label as string} className={`rounded-lg p-1.5 ${alert ? 'bg-red-200' : 'bg-white/40'}`}>
                      <div className={`text-sm font-bold ${alert ? 'text-red-800' : 'text-foreground'}`}>
                        {value ?? '—'}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
              {(['assessment', 'partogram', 'nursing', 'history'] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-colors whitespace-nowrap ${
                    activeTab === t ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}>
                  {t === 'assessment' ? tr('تقييم الطبيب', 'Doctor Exam') :
                   t === 'partogram'  ? tr('البارتوجرام', 'Partogram') :
                   t === 'nursing'    ? `${tr('التمريض', 'Nursing')} (${nursingEntries.length})` :
                   `${tr('سجل الطبيب', 'Doctor Log')} (${doctorEntries.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'assessment' && (
              <DoctorAssessmentForm
                patientId={selPat.patientId}
                onSaved={() => { mutate(); mutateDoctor(); }}
              />
            )}

            {activeTab === 'partogram' && <Partogram patientId={selPat.patientId} />}

            {activeTab === 'nursing' && (
              <div className="space-y-2">
                {nursingEntries.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    {tr('لا توجد تقييمات تمريض', 'No nursing assessments yet')}
                  </div>
                )}
                {nursingEntries.map((e: any, i: number) => {
                  const cfg = MEOWS_CONFIG[e.meowsLevel] ?? MEOWS_CONFIG.NORMAL;
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.assessedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                        {e.meows !== null && e.meows !== undefined && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                            MEOWS {e.meows} — {getMeowsLabel(cfg, language)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        {[
                          ['BP',                          e.bp],
                          ['HR',                          e.hr ? `${e.hr} bpm` : null],
                          [tr('حرارة', 'Temp'),           e.temp ? `${e.temp}°C` : null],
                          ['FHR',                         e.fetalHr ? `${e.fetalHr} bpm` : null],
                          [tr('اتساع', 'Dilation'),       e.dilation ? `${e.dilation}cm` : null],
                          [tr('انقباضات', 'Contractions'),e.contractions ? `${e.contractions}/10` : null],
                          [tr('السائل', 'Liquor'),        e.liquor],
                          [tr('الوعي', 'Consciousness'),  e.consciousness],
                        ].map(([label, value]) => value ? (
                          <span key={label as string}>
                            <span className="text-muted-foreground">{label}: </span>{value}
                          </span>
                        ) : null)}
                      </div>
                      {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-2">
                {doctorEntries.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    {tr('لا توجد تقييمات طبيب', 'No doctor assessments yet')}
                  </div>
                )}
                {doctorEntries.map((e: any, i: number) => {
                  const dec = DELIVERY_DECISIONS.find((d) => d.value === e.deliveryDecision);
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.assessedAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                        {dec && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dec.color}`}>
                            {getDecisionLabel(dec, language)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        {[
                          [tr('اتساع', 'Dilation'),   e.dilation ? `${e.dilation}cm` : null],
                          [tr('الترقق', 'Effacement'), e.effacement ? `${e.effacement}%` : null],
                          ['Station',                  e.station !== null ? e.station : null],
                          ['Bishop',                   e.bishopScore !== null ? e.bishopScore : null],
                        ].map(([label, value]) => value !== null && value !== undefined ? (
                          <span key={label as string}>
                            <span className="text-muted-foreground">{label}: </span>{value}
                          </span>
                        ) : null)}
                      </div>
                      {e.soapAssessment && (
                        <div className="text-xs mt-1">
                          <span className="text-muted-foreground">{tr('التقييم', 'Assessment')}: </span>
                          {e.soapAssessment}
                        </div>
                      )}
                      {e.soapPlan && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">{tr('الخطة', 'Plan')}: </span>
                          {e.soapPlan}
                        </div>
                      )}
                      {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <UserRound className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {tr('اختر مريضة من القائمة', 'Select a patient from the list')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
