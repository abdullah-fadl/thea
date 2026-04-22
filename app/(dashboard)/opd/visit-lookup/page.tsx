'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const KIND_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  LAB: { ar: '\u0645\u062e\u062a\u0628\u0631', en: 'Lab', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  RADIOLOGY: { ar: '\u0623\u0634\u0639\u0629', en: 'Radiology', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  RAD: { ar: '\u0623\u0634\u0639\u0629', en: 'Radiology', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  PROCEDURE: { ar: '\u0625\u062c\u0631\u0627\u0621', en: 'Procedure', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  MEDICATION: { ar: '\u062f\u0648\u0627\u0621', en: 'Medication', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  PHARMACY: { ar: '\u062f\u0648\u0627\u0621', en: 'Medication', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  CONSULTATION: { ar: '\u0627\u0633\u062a\u0634\u0627\u0631\u0629', en: 'Consultation', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
};

function getAge(dob?: string | null): string {
  if (!dob) return '\u2014';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '\u2014';
  return `${Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000))}y`;
}

function fmtDate(d: string | null | undefined, lang: string) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d: string | null | undefined, lang: string) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function VisitLookupPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  const { data: searchData, isValidating: searching } = useSWR(
    query.length >= 2 ? `/api/opd/visit-lookup?q=${encodeURIComponent(query)}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  const { data: visitData, isValidating: loadingVisit } = useSWR(
    selectedEncounterId ? `/api/opd/visit-lookup?encounterId=${selectedEncounterId}` : null,
    fetcher
  );

  const patients: any[] = Array.isArray(searchData?.patients) ? searchData.patients : [];
  const visit = visitData?.visit || null;

  const handleSearch = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length >= 2) {
      setQuery(trimmed);
      setSelectedEncounterId(null);
    }
  }, [searchInput]);

  function selectEncounter(encId: string) {
    setSelectedEncounterId(encId);
  }

  function goBack() {
    setSelectedEncounterId(null);
  }

  // ── Visit Detail View ──
  if (selectedEncounterId) {
    if (loadingVisit && !visit) {
      return (
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-5xl mx-auto">
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <div className="text-2xl mb-2">{'\u23F3'}</div>
              <p className="text-sm text-muted-foreground">{tr('\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0632\u064a\u0627\u0631\u0629...', 'Loading visit...')}</p>
            </div>
          </div>
        </div>
      );
    }

    if (!visit) {
      return (
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-5xl mx-auto">
            <button onClick={goBack} className="mb-4 text-sm text-primary font-medium hover:underline">{'\u2190'} {tr('\u0631\u062c\u0648\u0639', 'Back')}</button>
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">{tr('\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0632\u064a\u0627\u0631\u0629', 'Visit not found')}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          {/* Back button */}
          <button onClick={goBack} className="mb-4 text-sm text-primary font-medium hover:underline flex items-center gap-1">
            {'\u2190'} {tr('\u0631\u062c\u0648\u0639 \u0644\u0644\u0628\u062d\u062b', 'Back to search')}
          </button>

          {/* Patient + Visit header */}
          <div className="bg-card rounded-2xl border border-border p-5 mb-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                  style={{ background: visit.patient?.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
                >
                  {(visit.patient?.fullName || '?')[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{visit.patient?.fullName || '\u2014'}</h2>
                  <p className="text-xs text-muted-foreground">
                    {visit.patient?.mrn || '\u2014'} · {getAge(visit.patient?.dob)} · {visit.patient?.gender === 'MALE' ? tr('\u0630\u0643\u0631', 'Male') : tr('\u0623\u0646\u062b\u0649', 'Female')}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                {visit.doctorName ? (
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-bold">
                    {tr('\u0637\u0628\u064a\u0628:', 'Dr:')} {visit.doctorName}
                  </span>
                ) : null}
                <div className="text-xs text-muted-foreground">{fmtDate(visit.createdAt, language)}</div>
                <div className="flex gap-1.5 justify-end flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${visit.encounterStatus === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {visit.encounterStatus}
                  </span>
                  {visit.opdFlowState ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                      {visit.opdFlowState}
                    </span>
                  ) : null}
                  {visit.visitType ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {visit.visitType}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            {visit.dispositionType ? (
              <div className="mt-3 pt-3 border-t border-border text-xs">
                <span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u0642\u0631\u0627\u0631:', 'Disposition:')}</span>
                <span className="ml-2 text-foreground">{visit.dispositionType}</span>
                {visit.dispositionNote ? <span className="ml-2 text-muted-foreground">— {visit.dispositionNote}</span> : null}
              </div>
            ) : null}
          </div>

          {/* ── Nursing Entries (Vitals) ── */}
          {visit.nursingEntries?.length > 0 ? (
            <Section title={tr('\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062a\u0645\u0631\u064a\u0636', 'Nursing Records')} icon="\uD83E\uDE7A">
              {visit.nursingEntries.map((n: any) => (
                <div key={n.id} className="bg-muted/20 rounded-xl p-3 space-y-2">
                  {n.createdBy ? (
                    <div className="text-[10px] text-muted-foreground">{n.createdBy} · {fmtDateTime(n.createdAt, language)}</div>
                  ) : null}
                  {n.chiefComplaint ? (
                    <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u0634\u0643\u0648\u0649:', 'Chief Complaint:')}</span> <span className="text-foreground">{n.chiefComplaint}</span></div>
                  ) : null}
                  {n.vitals ? <VitalsDisplay vitals={n.vitals} tr={tr} /> : null}
                  {n.painScore != null ? (
                    <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u0623\u0644\u0645:', 'Pain Score:')}</span> <span className="text-foreground">{n.painScore}/10 {n.painLocation ? `(${n.painLocation})` : ''}</span></div>
                  ) : null}
                  {n.nursingNote ? (
                    <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a:', 'Notes:')}</span> <span className="text-foreground">{n.nursingNote}</span></div>
                  ) : null}
                </div>
              ))}
            </Section>
          ) : null}

          {/* ── Doctor SOAP Notes ── */}
          {visit.doctorEntries?.length > 0 ? (
            <Section title={tr('\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0637\u0628\u064a\u0628 (SOAP)', 'Doctor Notes (SOAP)')} icon="\uD83E\uDE7A">
              {visit.doctorEntries.map((d: any) => (
                <div key={d.id} className="bg-muted/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{d.noteType}</span>
                    {d.createdBy ? <span className="text-[10px] text-muted-foreground">{d.createdBy}</span> : null}
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(d.createdAt, language)}</span>
                  </div>
                  {d.subjective ? <SoapField label="S" value={d.subjective} /> : null}
                  {d.objective ? <SoapField label="O" value={d.objective} /> : null}
                  {d.assessment ? <SoapField label="A" value={d.assessment} /> : null}
                  {d.plan ? <SoapField label="P" value={d.plan} /> : null}
                  {d.freeText ? <div className="text-xs text-foreground whitespace-pre-wrap">{d.freeText}</div> : null}
                </div>
              ))}
            </Section>
          ) : null}

          {/* ── Visit Notes (full clinical notes with diagnoses) ── */}
          {visit.visitNotes?.length > 0 ? (
            <Section title={tr('\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629', 'Clinical Notes')} icon="\uD83D\uDCCB">
              {visit.visitNotes.map((vn: any) => (
                <div key={vn.id} className="bg-muted/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${vn.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{vn.status}</span>
                    {vn.createdBy ? <span className="text-[10px] text-muted-foreground">{vn.createdBy}</span> : null}
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(vn.createdAt, language)}</span>
                  </div>
                  {vn.chiefComplaint ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u0634\u0643\u0648\u0649:', 'CC:')}</span> {vn.chiefComplaint}</div> : null}
                  {vn.historyOfPresentIllness ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u0631\u0636:', 'HPI:')}</span> {vn.historyOfPresentIllness}</div> : null}
                  {vn.physicalExam ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u0641\u062d\u0635:', 'Exam:')}</span> {vn.physicalExam}</div> : null}
                  {vn.assessment ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u062a\u0642\u064a\u064a\u0645:', 'Assessment:')}</span> {vn.assessment}</div> : null}
                  {vn.plan ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u062e\u0637\u0629:', 'Plan:')}</span> {vn.plan}</div> : null}
                  {Array.isArray(vn.diagnoses) && vn.diagnoses.length > 0 ? (
                    <div className="pt-1 border-t border-border/30">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">{tr('\u0627\u0644\u062a\u0634\u062e\u064a\u0635\u0627\u062a', 'Diagnoses')}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {vn.diagnoses.map((dx: any, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                            {dx.code ? `${dx.code}: ` : ''}{dx.description || dx.name || '\u2014'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </Section>
          ) : null}

          {/* ── Doctor Addenda ── */}
          {visit.doctorAddenda?.length > 0 ? (
            <Section title={tr('\u0625\u0636\u0627\u0641\u0627\u062a \u0627\u0644\u0637\u0628\u064a\u0628', 'Doctor Addenda')} icon="\u270F\uFE0F">
              {visit.doctorAddenda.map((a: any) => (
                <div key={a.id} className="bg-muted/20 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">{tr('\u0625\u0636\u0627\u0641\u0629', 'Addendum')}</span>
                    {a.createdBy ? <span className="text-[10px] text-muted-foreground">{a.createdBy}</span> : null}
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(a.createdAt, language)}</span>
                  </div>
                  {a.reason ? <div className="text-xs text-amber-700 dark:text-amber-300"><span className="font-bold">{tr('\u0627\u0644\u0633\u0628\u0628:', 'Reason:')}</span> {a.reason}</div> : null}
                  {a.subjective ? <SoapField label="S" value={a.subjective} /> : null}
                  {a.objective ? <SoapField label="O" value={a.objective} /> : null}
                  {a.assessment ? <SoapField label="A" value={a.assessment} /> : null}
                  {a.plan ? <SoapField label="P" value={a.plan} /> : null}
                </div>
              ))}
            </Section>
          ) : null}

          {/* ── Orders ── */}
          {visit.orders?.length > 0 ? (
            <Section title={tr('\u0627\u0644\u0637\u0644\u0628\u0627\u062a', 'Orders')} icon="\uD83D\uDCE6">
              <div className="space-y-1.5">
                {visit.orders.map((o: any) => {
                  const kl = KIND_LABELS[o.kind] || { ar: o.kind, en: o.kind, color: 'bg-slate-100 text-slate-700' };
                  const isPaid = o.paymentStatus === 'PAID';
                  return (
                    <div key={o.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/20">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kl.color}`}>{tr(kl.ar, kl.en)}</span>
                        <span className="text-xs font-medium text-foreground">{o.orderName || o.orderNameAr || '\u2014'}</span>
                        {o.priority && o.priority !== 'ROUTINE' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">{o.priority}</span>
                        ) : null}
                        {o.notes ? <span className="text-[10px] text-muted-foreground italic">{o.notes}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {o.price > 0 ? <span className="text-[10px] text-muted-foreground">{o.price.toFixed(2)} SAR</span> : null}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : o.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {o.status}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'}`}>
                          {isPaid ? tr('\u0645\u062f\u0641\u0648\u0639', 'Paid') : tr('\u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639', 'Unpaid')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}

          {/* ── Referrals ── */}
          {visit.referrals?.length > 0 ? (
            <Section title={tr('\u0627\u0644\u062a\u062d\u0648\u064a\u0644\u0627\u062a', 'Referrals')} icon="\uD83D\uDD04">
              {visit.referrals.map((r: any) => (
                <div key={r.id} className="bg-muted/20 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : r.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                    <span className="text-[10px] text-muted-foreground">{r.type}</span>
                    {r.transferBilling ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{tr('\u0646\u0642\u0644 \u0641\u0627\u062a\u0648\u0631\u0629', 'Billing Transfer')}</span> : null}
                    <span className="text-[10px] text-muted-foreground">{fmtDateTime(r.createdAt, language)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">{tr('\u0645\u0646:', 'From:')}</span>
                    <span className="font-medium text-foreground ml-1">{r.fromProviderName || '\u2014'}</span>
                    <span className="text-muted-foreground mx-2">{'\u2192'}</span>
                    <span className="text-muted-foreground">{tr('\u0625\u0644\u0649:', 'To:')}</span>
                    <span className="font-medium text-foreground ml-1">{r.toProviderName || '\u2014'}</span>
                  </div>
                  {r.reason ? <div className="text-xs"><span className="font-bold text-muted-foreground">{tr('\u0627\u0644\u0633\u0628\u0628:', 'Reason:')}</span> {r.reason}</div> : null}
                  {r.clinicalNotes ? <div className="text-xs text-muted-foreground italic">{r.clinicalNotes}</div> : null}
                </div>
              ))}
            </Section>
          ) : null}

          {/* ── Ophthalmology/Clinic Extensions ── */}
          {visit.clinicExtensions ? (
            <ClinicExtensionsDisplay data={visit.clinicExtensions} tr={tr} />
          ) : null}

          {/* Empty visit */}
          {!visit.nursingEntries?.length && !visit.doctorEntries?.length && !visit.visitNotes?.length && !visit.orders?.length && !visit.referrals?.length ? (
            <div className="bg-card rounded-2xl border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">{tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0644\u0647\u0630\u0647 \u0627\u0644\u0632\u064a\u0627\u0631\u0629', 'No data recorded for this visit')}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Search View ──
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-sm">
              {'\uD83D\uDCCB'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{tr('\u0627\u0633\u062a\u0639\u0631\u0627\u0636 \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a', 'Visit Lookup')}</h1>
              <p className="text-xs text-muted-foreground">{tr('\u0627\u0644\u0639\u064a\u0627\u062f\u0627\u062a \u0627\u0644\u062e\u0627\u0631\u062c\u064a\u0629', 'Outpatient Department')}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{'\uD83D\uDD0D'}</span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={tr('\u0627\u0628\u062d\u062b \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064a\u0636...', 'Search by MRN or patient name...')}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm outline-none thea-input-focus thea-transition-fast"
                autoFocus
              />
            </div>
            <button onClick={handleSearch} disabled={searchInput.trim().length < 2} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 thea-transition-fast">
              {tr('\u0628\u062d\u062b', 'Search')}
            </button>
          </div>
        </div>

        {/* Loading */}
        {searching && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="text-2xl mb-2">{'\u23F3'}</div>
            <p className="text-sm text-muted-foreground">{tr('\u062c\u0627\u0631\u064a \u0627\u0644\u0628\u062d\u062b...', 'Searching...')}</p>
          </div>
        ) : null}

        {/* No results */}
        {query && !searching && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="text-4xl mb-3">{'\uD83D\uDC64'}</div>
            <p className="text-sm text-muted-foreground">{tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c', 'No results found')}</p>
          </div>
        ) : null}

        {/* Results */}
        {patients.length > 0 ? (
          <div className="space-y-3">
            {patients.map((patient: any) => (
              <div key={patient.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: patient.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
                  >
                    {(patient.fullName || '?')[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{patient.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">{patient.mrn || '\u2014'} · {getAge(patient.dob)} · {patient.gender === 'MALE' ? 'M' : 'F'}</div>
                  </div>
                </div>
                {patient.encounters?.length > 0 ? (
                  <div className="border-t border-border px-4 py-2 space-y-1.5">
                    {patient.encounters.map((enc: any) => (
                      <button
                        key={enc.id}
                        onClick={() => selectEncounter(enc.id)}
                        className="w-full px-3 py-2 rounded-xl border border-border/50 flex items-center justify-between hover:bg-primary/5 hover:border-primary/30 thea-transition-fast group"
                      >
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${enc.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                            {enc.encounterType} · {enc.status}
                          </span>
                          <span className="text-muted-foreground">{fmtDate(enc.createdAt, language)}</span>
                          {enc.doctorName ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {tr('\u0637\u0628\u064a\u0628:', 'Dr:')} {enc.doctorName}
                            </span>
                          ) : null}
                          {enc.opdFlowState ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300">{enc.opdFlowState}</span>
                          ) : null}
                        </div>
                        <span className="text-primary text-xs font-medium opacity-0 group-hover:opacity-100 thea-transition-fast">
                          {tr('\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644', 'View Details')} {'\u2192'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    {tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0632\u064a\u0627\u0631\u0627\u062a', 'No encounters')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!query && !searching ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="text-4xl mb-3">{'\uD83D\uDCCB'}</div>
            <p className="text-sm font-medium text-foreground mb-1">{tr('\u0627\u0633\u062a\u0639\u0631\u0627\u0636 \u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a', 'Visit Lookup')}</p>
            <p className="text-xs text-muted-foreground">{tr('\u0627\u0628\u062d\u062b \u0639\u0646 \u0645\u0631\u064a\u0636 \u0644\u0639\u0631\u0636 \u062a\u0641\u0627\u0635\u064a\u0644 \u0632\u064a\u0627\u0631\u0627\u062a\u0647', 'Search for a patient to view their visit details')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Reusable components ──

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border mb-4 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/10 flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  );
}

function SoapField({ label, value }: { label: string; value: string }) {
  const colors: Record<string, string> = {
    S: 'bg-blue-100 text-blue-700',
    O: 'bg-green-100 text-green-700',
    A: 'bg-amber-100 text-amber-700',
    P: 'bg-purple-100 text-purple-700',
  };
  return (
    <div className="flex items-start gap-2">
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${colors[label] || 'bg-slate-100 text-slate-700'}`}>{label}</span>
      <span className="text-xs text-foreground whitespace-pre-wrap">{value}</span>
    </div>
  );
}

function VitalsDisplay({ vitals, tr }: { vitals: any; tr: (ar: string, en: string) => string }) {
  if (!vitals || typeof vitals !== 'object') return null;
  const fields = [
    { key: 'bp', ar: '\u0636\u063a\u0637 \u0627\u0644\u062f\u0645', en: 'BP', unit: 'mmHg' },
    { key: 'hr', ar: '\u0627\u0644\u0646\u0628\u0636', en: 'HR', unit: 'bpm' },
    { key: 'temp', ar: '\u0627\u0644\u062d\u0631\u0627\u0631\u0629', en: 'Temp', unit: '\u00B0C' },
    { key: 'rr', ar: '\u0627\u0644\u062a\u0646\u0641\u0633', en: 'RR', unit: '/min' },
    { key: 'spo2', ar: 'SpO2', en: 'SpO2', unit: '%' },
    { key: 'weight', ar: '\u0627\u0644\u0648\u0632\u0646', en: 'Weight', unit: 'kg' },
    { key: 'height', ar: '\u0627\u0644\u0637\u0648\u0644', en: 'Height', unit: 'cm' },
    { key: 'bmi', ar: 'BMI', en: 'BMI', unit: '' },
  ];
  const present = fields.filter((f) => vitals[f.key] != null && vitals[f.key] !== '');
  if (!present.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {present.map((f) => (
        <div key={f.key} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px]">
          <span className="font-bold text-muted-foreground">{tr(f.ar, f.en)}: </span>
          <span className="text-foreground font-medium">{typeof vitals[f.key] === 'object' ? JSON.stringify(vitals[f.key]) : vitals[f.key]}{f.unit ? ` ${f.unit}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

function ClinicExtensionsDisplay({ data, tr }: { data: any; tr: (ar: string, en: string) => string }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;
  return (
    <Section title={tr('\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u064a\u0627\u062f\u0629', 'Clinic Data')} icon="\uD83C\uDFE5">
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px]">
            <span className="font-bold text-muted-foreground">{key}: </span>
            <span className="text-foreground font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
