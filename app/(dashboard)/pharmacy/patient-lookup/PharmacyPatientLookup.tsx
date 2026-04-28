'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Search, Clock, User, Pill } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ORDER_KIND_LABELS: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  LAB: { labelAr: 'مختبر', labelEn: 'Lab', color: 'bg-emerald-100 text-emerald-800' },
  RADIOLOGY: { labelAr: 'أشعة', labelEn: 'Radiology', color: 'bg-blue-100 text-blue-800' },
  RAD: { labelAr: 'أشعة', labelEn: 'Radiology', color: 'bg-blue-100 text-blue-800' },
  PROCEDURE: { labelAr: 'إجراء', labelEn: 'Procedure', color: 'bg-purple-100 text-purple-800' },
  MEDICATION: { labelAr: 'دواء', labelEn: 'Medication', color: 'bg-orange-100 text-orange-800' },
};

const STATUS_COLORS: Record<string, string> = {
  ORDERED: 'bg-amber-100 text-amber-800',
  PLACED: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-cyan-100 text-cyan-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DISPENSED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  PICKED_UP: 'bg-teal-100 text-teal-800',
};

const RX_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING: { ar: 'معلقة', en: 'Pending' },
  VERIFIED: { ar: 'تم التحقق', en: 'Verified' },
  DISPENSED: { ar: 'تم الصرف', en: 'Dispensed' },
  PICKED_UP: { ar: 'استُلم', en: 'Picked Up' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
};

function getAge(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years}y`;
}

export default function PharmacyPatientLookup() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [expandedEncounter, setExpandedEncounter] = useState<string | null>(null);

  const { data, isValidating } = useSWR(
    query.length >= 2 ? `/api/pharmacy/patient-lookup?q=${encodeURIComponent(query)}` : null,
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shadow-sm">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {tr('بحث عن مريض', 'Patient Lookup')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {tr('عرض الوصفات والطلبات الطبية للمريض', 'View patient prescriptions and medical orders')}
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
                  'ابحث برقم الملف أو اسم المريض...',
                  'Search by MRN or patient name...'
                )}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searchInput.trim().length < 2}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {tr('بحث', 'Search')}
            </button>
          </div>
        </div>

        {/* Loading */}
        {isValidating && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="flex justify-center mb-2"><Clock className="h-6 w-6 text-muted-foreground" /></div>
            <p className="text-sm text-muted-foreground">{tr('جاري البحث...', 'Searching...')}</p>
          </div>
        ) : null}

        {/* No results */}
        {query && !isValidating && !patients.length ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <div className="flex justify-center mb-3"><User className="h-10 w-10 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground mb-1">
              {tr('لا توجد نتائج', 'No results found')}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr(
                'لم يتم العثور على مريض بهذا الاسم أو رقم الملف',
                'No patient found with this name or MRN'
              )}
            </p>
          </div>
        ) : null}

        {/* Results */}
        {patients.length > 0 ? (
          <div className="space-y-3">
            {patients.map((patient: any) => {
              const isExpanded = expandedPatient === patient.id;
              const totalOrders = patient.encounters?.reduce(
                (sum: number, enc: any) => sum + (enc.orders?.length || 0),
                0
              ) || 0;
              const pendingOrders = patient.encounters?.reduce(
                (sum: number, enc: any) =>
                  sum + (enc.orders?.filter((o: any) =>
                    ['ORDERED', 'PLACED', 'ACCEPTED', 'IN_PROGRESS'].includes(o.status)
                  ).length || 0),
                0
              ) || 0;
              const rxCount = patient.prescriptions?.length || 0;

              return (
                <div key={patient.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* Patient row */}
                  <button
                    onClick={() => setExpandedPatient(isExpanded ? null : patient.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{
                          background:
                            patient.gender === 'MALE'
                              ? 'linear-gradient(135deg, #6693f5, #3366e6)'
                              : 'linear-gradient(135deg, #e882b4, #d63384)',
                        }}
                      >
                        {(patient.fullName || '?')[0]}
                      </div>
                      <div className="text-start">
                        <div className="text-sm font-semibold text-foreground">{patient.fullName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {patient.mrn || '—'} · {getAge(patient.dob)} · {patient.gender === 'MALE' ? tr('ذكر', 'M') : tr('أنثى', 'F')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pendingOrders > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          {pendingOrders} {tr('طلبات معلقة', 'pending orders')}
                        </span>
                      ) : null}
                      {rxCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Pill className="h-3 w-3 inline" /> {rxCount}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded ? (
                    <div className="border-t border-border">
                      {/* Encounters */}
                      {patient.encounters?.length > 0 ? (
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            {tr('الزيارات', 'Encounters')} ({patient.encounters.length})
                          </h3>
                          <div className="space-y-2">
                            {patient.encounters.map((enc: any) => {
                              const encExpanded = expandedEncounter === enc.id;
                              return (
                                <div key={enc.id} className="border border-border/50 rounded-xl overflow-hidden">
                                  <button
                                    onClick={() => setExpandedEncounter(encExpanded ? null : enc.id)}
                                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 text-xs">
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-medium ${
                                          enc.status === 'CLOSED'
                                            ? 'bg-slate-100 text-slate-600'
                                            : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        {enc.encounterType} · {enc.status}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {enc.createdAt
                                          ? new Date(enc.createdAt).toLocaleDateString(
                                              language === 'ar' ? 'ar-SA' : 'en-US',
                                              { day: 'numeric', month: 'short' }
                                            )
                                          : '—'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {enc.orders?.length > 0 ? (
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                          {enc.orders.length} {tr('طلبات', 'orders')}
                                        </span>
                                      ) : null}
                                      <span className="text-muted-foreground text-[10px]">
                                        {encExpanded ? '▲' : '▼'}
                                      </span>
                                    </div>
                                  </button>

                                  {encExpanded && enc.orders?.length > 0 ? (
                                    <div className="border-t border-border/30 px-3 py-2 space-y-1.5 bg-muted/10">
                                      {enc.orders.map((order: any) => {
                                        const kindCfg = ORDER_KIND_LABELS[order.kind] || {
                                          labelAr: order.kind,
                                          labelEn: order.kind,
                                          color: 'bg-slate-100 text-slate-700',
                                        };
                                        const statusColor =
                                          STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-600';
                                        return (
                                          <div
                                            key={order.id}
                                            className="flex items-center justify-between py-1"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${kindCfg.color}`}
                                              >
                                                {tr(kindCfg.labelAr, kindCfg.labelEn)}
                                              </span>
                                              <span className="text-xs text-foreground font-medium">
                                                {order.orderName || order.orderNameAr || '—'}
                                              </span>
                                            </div>
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor}`}
                                            >
                                              {order.status}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}

                                  {encExpanded && (!enc.orders || enc.orders.length === 0) ? (
                                    <div className="border-t border-border/30 px-3 py-2 text-xs text-muted-foreground bg-muted/10">
                                      {tr('لا توجد طلبات', 'No orders')}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-xs text-muted-foreground">
                          {tr('لا توجد زيارات خلال آخر 30 يوم', 'No encounters in the last 30 days')}
                        </div>
                      )}

                      {/* Prescriptions */}
                      {patient.prescriptions?.length > 0 ? (
                        <div className="px-4 py-3 border-t border-border">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            <Pill className="h-3 w-3 inline" /> {tr('الوصفات الطبية', 'Prescriptions')} ({patient.prescriptions.length})
                          </h3>
                          <div className="space-y-1.5">
                            {patient.prescriptions.map((rx: any) => {
                              const statusColor = STATUS_COLORS[rx.status] || 'bg-slate-100 text-slate-600';
                              const statusLabel = RX_STATUS_LABELS[rx.status] || { ar: rx.status, en: rx.status };
                              return (
                                <div
                                  key={rx.id}
                                  className="flex items-center justify-between py-1 border-b border-border/20 last:border-0"
                                >
                                  <div>
                                    <span className="text-xs font-medium text-foreground">
                                      {language === 'ar' ? rx.medicationAr || rx.medication : rx.medication}
                                    </span>
                                    {rx.strength && (
                                      <span className="text-[11px] text-muted-foreground mx-1">
                                        {rx.strength}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                      · {rx.frequency} · {rx.duration}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground">x{rx.quantity}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor}`}>
                                      {tr(statusLabel.ar, statusLabel.en)}
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
            <div className="flex justify-center mb-3"><Pill className="h-10 w-10 text-muted-foreground" /></div>
            <p className="text-sm font-medium text-foreground mb-1">
              {tr('بحث عن مريض', 'Search for a Patient')}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr(
                'ابحث برقم الملف أو اسم المريض لعرض الطلبات والوصفات',
                'Search by MRN or patient name to view orders and prescriptions'
              )}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
