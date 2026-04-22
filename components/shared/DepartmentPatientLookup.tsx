'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Pill, FlaskConical, Camera, Search, Clock, User, CheckCircle2, X } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type Department = 'pharmacy' | 'lab' | 'radiology';

const DEPT_CONFIG: Record<Department, { icon: React.ReactNode; titleAr: string; titleEn: string; subtitleAr: string; subtitleEn: string; emptyIcon: React.ReactNode }> = {
  pharmacy: {
    icon: <Pill className="h-5 w-5" />,
    titleAr: '\u0628\u062d\u062b \u0639\u0646 \u0645\u0631\u064a\u0636',
    titleEn: 'Patient Lookup',
    subtitleAr: '\u0627\u0644\u0635\u064a\u062f\u0644\u064a\u0629',
    subtitleEn: 'Pharmacy',
    emptyIcon: <Pill className="h-10 w-10 mx-auto opacity-40" />,
  },
  lab: {
    icon: <FlaskConical className="h-5 w-5" />,
    titleAr: '\u0628\u062d\u062b \u0639\u0646 \u0645\u0631\u064a\u0636',
    titleEn: 'Patient Lookup',
    subtitleAr: '\u0627\u0644\u0645\u062e\u062a\u0628\u0631',
    subtitleEn: 'Laboratory',
    emptyIcon: <FlaskConical className="h-10 w-10 mx-auto opacity-40" />,
  },
  radiology: {
    icon: <Camera className="h-5 w-5" />,
    titleAr: '\u0628\u062d\u062b \u0639\u0646 \u0645\u0631\u064a\u0636',
    titleEn: 'Patient Lookup',
    subtitleAr: '\u0627\u0644\u0623\u0634\u0639\u0629',
    subtitleEn: 'Radiology',
    emptyIcon: <Camera className="h-10 w-10 mx-auto opacity-40" />,
  },
};

const ORDER_KIND_LABELS: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  LAB: { labelAr: '\u0645\u062e\u062a\u0628\u0631', labelEn: 'Lab', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  RADIOLOGY: { labelAr: '\u0623\u0634\u0639\u0629', labelEn: 'Radiology', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  RAD: { labelAr: '\u0623\u0634\u0639\u0629', labelEn: 'Radiology', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  PROCEDURE: { labelAr: '\u0625\u062c\u0631\u0627\u0621', labelEn: 'Procedure', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  MEDICATION: { labelAr: '\u062f\u0648\u0627\u0621', labelEn: 'Medication', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  PHARMACY: { labelAr: '\u062f\u0648\u0627\u0621', labelEn: 'Medication', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

function getAge(dob?: string | null): string {
  if (!dob) return '\u2014';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '\u2014';
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${years}y`;
}

interface PaymentDialogData {
  patientId: string;
  patientName: string;
  encounterId: string;
  doctorName: string | null;
  encounterDate: string;
  orders: { id: string; kind: string; orderName: string | null; orderNameAr: string | null; price: number; paymentStatus: string }[];
}

export default function DepartmentPatientLookup({ department }: { department: Department }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const cfg = DEPT_CONFIG[department];

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [expandedEncounter, setExpandedEncounter] = useState<string | null>(null);

  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const { data, isValidating, mutate } = useSWR(
    query.length >= 2
      ? `/api/patient-lookup?q=${encodeURIComponent(query)}&department=${department}`
      : null,
    fetcher,
    { keepPreviousData: true }
  );

  const patients: any[] = Array.isArray(data?.patients) ? data.patients : [];

  const handleSearch = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length >= 2) setQuery(trimmed);
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  function openPaymentDialog(patient: any, enc: any) {
    const unpaidOrders = (enc.orders || []).filter((o: any) => o.paymentStatus === 'UNPAID');
    if (!unpaidOrders.length) return;
    setPaymentDialog({
      patientId: patient.id,
      patientName: patient.fullName,
      encounterId: enc.id,
      doctorName: enc.doctorName,
      encounterDate: enc.createdAt
        ? new Date(enc.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : '\u2014',
      orders: unpaidOrders,
    });
    setPaymentMethod('CASH');
    setPaymentRef('');
    setPaymentSuccess(false);
  }

  async function handleConfirmPayment() {
    if (!paymentDialog) return;
    setPaymentLoading(true);
    try {
      const res = await fetch('/api/billing/order-invoice', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: paymentDialog.patientId,
          orderIds: paymentDialog.orders.map((o) => o.id),
          encounterCoreId: paymentDialog.encounterId,
          paymentMethod,
          paymentReference: paymentRef || undefined,
        }),
      });
      if (res.ok) {
        setPaymentSuccess(true);
        mutate();
        setTimeout(() => {
          setPaymentDialog(null);
          setPaymentSuccess(false);
        }, 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || tr('\u062d\u062f\u062b \u062e\u0637\u0623', 'Payment failed'));
      }
    } catch {
      alert(tr('\u062d\u062f\u062b \u062e\u0637\u0623 \u0641\u064a \u0627\u0644\u0627\u062a\u0635\u0627\u0644', 'Network error'));
    } finally {
      setPaymentLoading(false);
    }
  }

  const totalDialog = paymentDialog
    ? paymentDialog.orders.reduce((s, o) => s + (o.price || 0), 0)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shadow-sm">
              {cfg.icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{tr(cfg.titleAr, cfg.titleEn)}</h1>
              <p className="text-xs text-muted-foreground">
                {tr(cfg.subtitleAr, cfg.subtitleEn)}
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Search className="h-4 w-4" /></span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tr(
                  '\u0627\u0628\u062d\u062b \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064a\u0636...',
                  'Search by MRN or patient name...'
                )}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm outline-none thea-input-focus thea-transition-fast"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searchInput.trim().length < 2}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-40 thea-transition-fast"
            >
              {tr('\u0628\u062d\u062b', 'Search')}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isValidating && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="mb-2"><Clock className="h-6 w-6 mx-auto text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">{tr('\u062c\u0627\u0631\u064a \u0627\u0644\u0628\u062d\u062b...', 'Searching...')}</p>
          </div>
        ) : null}

        {/* No results */}
        {query && !isValidating && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="mb-3"><User className="h-10 w-10 mx-auto text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">{tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c', 'No results found')}</p>
          </div>
        ) : null}

        {/* Results */}
        {patients.length > 0 ? (
          <div className="space-y-3">
            {patients.map((patient: any) => {
              const isExpanded = expandedPatient === patient.id;
              const totalOrders = patient.encounters?.reduce((sum: number, enc: any) => sum + (enc.orders?.length || 0), 0) || 0;
              const totalUnpaid = patient.encounters?.reduce((sum: number, enc: any) => sum + (enc.unpaidOrderCount || 0), 0) || 0;
              const totalPaid = totalOrders - totalUnpaid;
              const rxCount = patient.prescriptions?.length || 0;

              return (
                <div key={patient.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* Patient header */}
                  <button
                    onClick={() => setExpandedPatient(isExpanded ? null : patient.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 thea-transition-fast"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ background: patient.gender === 'MALE' ? 'linear-gradient(135deg, #6693f5, #3366e6)' : 'linear-gradient(135deg, #e882b4, #d63384)' }}
                      >
                        {(patient.fullName || '?')[0]}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-foreground">{patient.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {patient.mrn || '\u2014'} · {getAge(patient.dob)} · {patient.gender === 'MALE' ? 'M' : 'F'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalOrders > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {totalOrders} {tr('\u0637\u0644\u0628', 'orders')}
                        </span>
                      ) : null}
                      {totalPaid > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {totalPaid} {tr('\u0645\u062f\u0641\u0648\u0639', 'paid')}
                        </span>
                      ) : null}
                      {totalUnpaid > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {totalUnpaid} {tr('\u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639', 'unpaid')}
                        </span>
                      ) : null}
                      {department === 'pharmacy' && rxCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 inline-flex items-center gap-0.5">
                          <Pill className="h-3 w-3" /> {rxCount}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded ? (
                    <div className="border-t border-border">
                      {/* Encounters */}
                      {patient.encounters?.length > 0 ? (
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            {tr('\u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a', 'Encounters')} ({patient.encounters.length})
                          </h3>
                          <div className="space-y-2">
                            {patient.encounters.map((enc: any) => {
                              const encExpanded = expandedEncounter === enc.id;
                              const encDate = enc.createdAt
                                ? new Date(enc.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '\u2014';
                              const unpaidCount = enc.unpaidOrderCount || 0;
                              const paidCount = (enc.orders?.length || 0) - unpaidCount;

                              return (
                                <div key={enc.id} className="border border-border/50 rounded-xl overflow-hidden">
                                  <button
                                    onClick={() => setExpandedEncounter(encExpanded ? null : enc.id)}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/20 thea-transition-fast"
                                  >
                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                      <span className={`px-1.5 py-0.5 rounded font-medium ${enc.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {enc.encounterType} · {enc.status}
                                      </span>
                                      <span className="text-muted-foreground">{encDate}</span>
                                      {enc.doctorName ? (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                          {tr('\u0637\u0628\u064a\u0628:', 'Dr:')} {enc.doctorName}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {paidCount > 0 ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                          {paidCount} {tr('\u0645\u062f\u0641\u0648\u0639', 'paid')}
                                        </span>
                                      ) : null}
                                      {unpaidCount > 0 ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                          {unpaidCount} {tr('\u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639', 'unpaid')}
                                        </span>
                                      ) : null}
                                      {enc.orders?.length > 0 && unpaidCount === 0 ? (
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                          {enc.orders.length} {tr('\u0637\u0644\u0628\u0627\u062a', 'orders')}
                                        </span>
                                      ) : null}
                                      <span className="text-muted-foreground text-[10px]">{encExpanded ? '\u25B2' : '\u25BC'}</span>
                                    </div>
                                  </button>

                                  {encExpanded ? (
                                    <div className="border-t border-border/30">
                                      {/* Per-encounter Collect Payment */}
                                      {unpaidCount > 0 ? (
                                        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
                                          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                                            {tr(
                                              `${unpaidCount} \u0637\u0644\u0628 \u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639`,
                                              `${unpaidCount} unpaid order(s)`
                                            )}
                                          </span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openPaymentDialog(patient, enc); }}
                                            className="px-3 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700 thea-transition-fast"
                                          >
                                            {tr('\u062a\u062d\u0635\u064a\u0644', 'Collect Payment')}
                                          </button>
                                        </div>
                                      ) : null}

                                      {enc.orders?.length > 0 ? (
                                        <div className="px-3 py-2 space-y-1.5 bg-muted/10">
                                          {enc.orders.map((order: any) => {
                                            const kindCfg = ORDER_KIND_LABELS[order.kind] || { labelAr: order.kind, labelEn: order.kind, color: 'bg-slate-100 text-slate-700' };
                                            const isPaid = order.paymentStatus === 'PAID';
                                            return (
                                              <div key={order.id} className="flex items-center justify-between py-1">
                                                <div className="flex items-center gap-2">
                                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kindCfg.color}`}>
                                                    {tr(kindCfg.labelAr, kindCfg.labelEn)}
                                                  </span>
                                                  <span className="text-xs text-foreground font-medium">
                                                    {order.orderName || order.orderNameAr || '\u2014'}
                                                  </span>
                                                  {order.price > 0 ? (
                                                    <span className="text-[10px] text-muted-foreground">
                                                      {order.price.toFixed(2)} SAR
                                                    </span>
                                                  ) : null}
                                                </div>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                                  {isPaid ? tr('\u0645\u062f\u0641\u0648\u0639', 'Paid') : tr('\u063a\u064a\u0631 \u0645\u062f\u0641\u0648\u0639', 'Unpaid')}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/10">
                                          {tr('\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a', 'No orders')}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                          {tr(
                            '\u0644\u0627 \u062a\u0648\u062c\u062f \u0632\u064a\u0627\u0631\u0627\u062a \u062e\u0644\u0627\u0644 \u0622\u062e\u0631 30 \u064a\u0648\u0645',
                            'No encounters in the last 30 days'
                          )}
                        </div>
                      )}

                      {/* Prescriptions — pharmacy only */}
                      {department === 'pharmacy' && patient.prescriptions?.length > 0 ? (
                        <div className="px-4 py-3 border-t border-border">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Pill className="h-3.5 w-3.5" /> {tr('\u0627\u0644\u0648\u0635\u0641\u0627\u062a', 'Prescriptions')} ({patient.prescriptions.length})
                          </h3>
                          <div className="space-y-1.5">
                            {patient.prescriptions.map((rx: any) => {
                              return (
                                <div key={rx.id} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
                                  <div>
                                    <span className="text-xs font-medium text-foreground">{rx.medication}</span>
                                    <span className="text-[11px] text-muted-foreground mx-1">{rx.strength}</span>
                                    <span className="text-[10px] text-muted-foreground">· {rx.frequency} · {rx.duration}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">x{rx.quantity}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rx.status === 'DISPENSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                      {rx.status}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Empty state (before search) */}
        {!query && !isValidating ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="mb-3">{cfg.emptyIcon}</div>
            <p className="text-sm font-medium text-foreground mb-1">{tr(cfg.titleAr, cfg.titleEn)}</p>
            <p className="text-xs text-muted-foreground">
              {tr(
                '\u0627\u0628\u062d\u062b \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0644\u0641 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064a\u0636 \u0644\u0639\u0631\u0636 \u0627\u0644\u0637\u0644\u0628\u0627\u062a',
                'Search by MRN or patient name to view orders'
              )}
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Inline Payment Dialog ── */}
      {paymentDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !paymentLoading && setPaymentDialog(null)}>
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Dialog header */}
            <div className="px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {tr('\u062a\u062d\u0635\u064a\u0644 \u0627\u0644\u062f\u0641\u0639', 'Collect Payment')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {paymentDialog.patientName} · {paymentDialog.encounterDate}
                  </p>
                </div>
                <button
                  onClick={() => !paymentLoading && setPaymentDialog(null)}
                  className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted thea-transition-fast text-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {paymentDialog.doctorName ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                    {tr('\u0637\u0628\u064a\u0628:', 'Dr:')} {paymentDialog.doctorName}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Success state */}
            {paymentSuccess ? (
              <div className="px-5 py-10 text-center">
                <div className="mb-3"><CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" /></div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {tr('\u062a\u0645 \u0627\u0644\u062f\u0641\u0639 \u0628\u0646\u062c\u0627\u062d', 'Payment Successful')}
                </p>
              </div>
            ) : (
              <>
                {/* Orders list */}
                <div className="px-5 py-3">
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    {tr('\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u063a\u064a\u0631 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629', 'Unpaid Orders')} ({paymentDialog.orders.length})
                  </h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {paymentDialog.orders.map((order) => {
                      const kindCfg = ORDER_KIND_LABELS[order.kind] || { labelAr: order.kind, labelEn: order.kind, color: 'bg-slate-100 text-slate-700' };
                      return (
                        <div key={order.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/20">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kindCfg.color}`}>
                              {tr(kindCfg.labelAr, kindCfg.labelEn)}
                            </span>
                            <span className="text-xs text-foreground font-medium">
                              {order.orderName || order.orderNameAr || '\u2014'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {order.price > 0 ? `${order.price.toFixed(2)} SAR` : '\u2014'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-sm font-bold text-foreground">{tr('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a', 'Total')}</span>
                    <span className="text-base font-bold text-primary">{totalDialog.toFixed(2)} SAR</span>
                  </div>
                </div>

                {/* Payment method */}
                <div className="px-5 py-3 border-t border-border">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    {tr('\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639', 'Payment Method')}
                  </label>
                  <div className="flex gap-2">
                    {['CASH', 'CARD', 'TRANSFER'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 thea-transition-fast ${
                          paymentMethod === m
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        {m === 'CASH' ? tr('\u0646\u0642\u062f\u064a', 'Cash') : m === 'CARD' ? tr('\u0628\u0637\u0627\u0642\u0629', 'Card') : tr('\u062a\u062d\u0648\u064a\u0644', 'Transfer')}
                      </button>
                    ))}
                  </div>
                  {paymentMethod !== 'CASH' ? (
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder={tr('\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062c\u0639', 'Reference number')}
                      className="w-full mt-2 px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted/30 text-sm outline-none thea-input-focus thea-transition-fast"
                    />
                  ) : null}
                </div>

                {/* Actions */}
                <div className="px-5 py-4 border-t border-border bg-muted/10 flex gap-2">
                  <button
                    onClick={() => setPaymentDialog(null)}
                    disabled={paymentLoading}
                    className="flex-1 py-2.5 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground hover:bg-muted/30 thea-transition-fast disabled:opacity-40"
                  >
                    {tr('\u0625\u0644\u063a\u0627\u0621', 'Cancel')}
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    disabled={paymentLoading}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 thea-transition-fast disabled:opacity-60"
                  >
                    {paymentLoading
                      ? tr('\u062c\u0627\u0631\u064a...', 'Processing...')
                      : tr(`\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639 ${totalDialog.toFixed(2)} SAR`, `Confirm ${totalDialog.toFixed(2)} SAR`)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
