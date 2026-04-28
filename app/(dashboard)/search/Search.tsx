'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Search as SearchIcon,
  User,
  Stethoscope,
  Heart,
  FileText,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface PatientResult {
  patientMasterId: string;
  fullName: string;
  dob: string | null;
  age: number | null;
  gender: string | null;
  identifiers: {
    mrn: string | null;
    tempMrn: string | null;
    nationalId: string | null;
  };
}

interface Visit {
  id: string;
  encounterType: string;
  status: string;
  date: string;
  createdAt: string;
  specialtyName: string | null;
  clinicName: string | null;
  providerName: string | null;
}

function VisitDetailDialog({
  visit,
  patient,
  open,
  onOpenChange,
  tr,
  isRTL,
}: {
  visit: Visit | null;
  patient: PatientResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (ar: string, en: string) => string;
  isRTL: boolean;
}) {
  const encounterCoreId = visit?.id || '';

  const { data: opdData, isLoading: opdLoading } = useSWR(
    open && encounterCoreId ? `/api/opd/encounters/${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const { data: ordersData, isLoading: ordersLoading } = useSWR(
    open && encounterCoreId ? `/api/opd/encounters/${encodeURIComponent(encounterCoreId)}/orders` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  if (!visit || !patient || !open) return null;

  const opd = opdData?.opd || {};
  const nursingEntries = Array.isArray(opd.nursingEntries) ? opd.nursingEntries : [];
  const latestNursing = nursingEntries.length ? nursingEntries[nursingEntries.length - 1] : null;
  const vitals = latestNursing?.vitals || null;
  const painScore = latestNursing?.painScore;
  const nursingNote = latestNursing?.nursingNote;

  const doctorEntries = Array.isArray(opd.doctorEntries) ? opd.doctorEntries : [];
  const latestDoctor = doctorEntries.length ? doctorEntries[doctorEntries.length - 1] : null;

  const orders = Array.isArray(ordersData?.items) ? ordersData.items : [];
  const disposition = opd.disposition || null;

  const visitDate = visit.date || visit.createdAt;

  const deptColor = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'OPD') return 'bg-blue-100 text-blue-800';
    if (t === 'ER') return 'bg-red-100 text-red-800';
    if (t === 'IPD') return 'bg-purple-100 text-purple-800';
    return 'bg-muted text-muted-foreground';
  };

  const statusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'OPEN' || s === 'ACTIVE') return 'bg-emerald-100 text-emerald-800';
    return 'bg-muted text-muted-foreground';
  };

  const isLoading = opdLoading || ordersLoading;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => onOpenChange(false)} role="dialog" aria-modal="true" aria-label={tr('تفاصيل الزيارة', 'Visit Details')}>
      <div
        className="bg-card shadow-xl border border-border w-full max-h-[95vh] sm:max-h-[85vh] overflow-y-auto thea-scroll rounded-t-2xl sm:rounded-2xl sm:max-w-2xl"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">{tr('تفاصيل الزيارة', 'Visit Details')}</h3>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground thea-transition-fast" aria-label={tr('إغلاق', 'Close')}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Patient info bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-2xl bg-muted">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{patient.fullName}</span>
              <span className="text-sm text-muted-foreground">
                {patient.identifiers?.mrn || patient.identifiers?.tempMrn || '—'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${deptColor(visit.encounterType)}`}>{visit.encounterType}</span>
              <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${statusColor(visit.status)}`}>{visit.status}</span>
            </div>
          </div>

          {/* Visit metadata */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{tr('التاريخ', 'Date')}:</span>{' '}
              <span className="font-medium text-foreground">
                {visitDate ? new Date(visitDate).toLocaleDateString('en-GB') : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الوقت', 'Time')}:</span>{' '}
              <span className="font-medium text-foreground">
                {visitDate
                  ? new Date(visitDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('العيادة', 'Clinic')}:</span>{' '}
              <span className="font-medium text-foreground">{visit.clinicName || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{tr('الطبيب', 'Doctor')}:</span>{' '}
              <span className="font-medium text-foreground">{visit.providerName || '—'}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{tr('التخصص', 'Specialty')}:</span>{' '}
              <span className="font-medium text-foreground">{visit.specialtyName || '—'}</span>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (
            <div className="space-y-4">
              {/* Vitals */}
              {vitals && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Heart className="h-4 w-4 text-red-500" />
                    {tr('العلامات الحيوية', 'Vitals')}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {[
                      { label: 'BP', value: vitals.bp },
                      { label: 'HR', value: vitals.hr },
                      { label: 'Temp', value: vitals.temp },
                      { label: 'RR', value: vitals.rr },
                      { label: 'SpO2', value: vitals.spo2 },
                      { label: tr('الوزن', 'Weight'), value: vitals.weight },
                      { label: tr('الطول', 'Height'), value: vitals.height },
                      { label: 'BMI', value: vitals.bmi },
                      { label: tr('الألم', 'Pain'), value: painScore },
                    ]
                      .filter((v) => v.value != null && v.value !== '')
                      .map((v) => (
                        <div key={v.label} className="rounded-2xl border border-border bg-muted p-2 text-center">
                          <div className="text-[10px] text-muted-foreground uppercase">{v.label}</div>
                          <div className="text-sm font-medium text-foreground">{v.value}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Doctor Notes (SOAP) */}
              {latestDoctor && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-primary" />
                    {tr('ملاحظات الطبيب', 'Doctor Notes')}
                  </h4>
                  {latestDoctor.noteType === 'SOAP' ? (
                    <div className="space-y-2">
                      {[
                        { key: 'S', label: tr('شكوى', 'Subjective'), value: latestDoctor.subjective, color: 'border-blue-200 bg-blue-50' },
                        { key: 'O', label: tr('فحص', 'Objective'), value: latestDoctor.objective, color: 'border-green-200 bg-green-50' },
                        { key: 'A', label: tr('تقييم', 'Assessment'), value: latestDoctor.assessment, color: 'border-amber-200 bg-amber-50' },
                        { key: 'P', label: tr('خطة', 'Plan'), value: latestDoctor.plan, color: 'border-purple-200 bg-purple-50' },
                      ]
                        .filter((s) => s.value)
                        .map((s) => (
                          <div key={s.key} className={`rounded-2xl border p-3 ${s.color}`}>
                            <div className="text-xs font-semibold text-muted-foreground mb-1">
                              {s.key} — {s.label}
                            </div>
                            <div className="text-sm text-foreground whitespace-pre-line">{s.value}</div>
                          </div>
                        ))}
                    </div>
                  ) : latestDoctor.freeText ? (
                    <div className="rounded-2xl border border-border bg-muted p-3">
                      <div className="text-sm text-foreground whitespace-pre-line">{latestDoctor.freeText}</div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Nursing Notes */}
              {nursingNote && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {tr('ملاحظات التمريض', 'Nursing Notes')}
                  </h4>
                  <div className="rounded-2xl border border-border bg-muted p-3 text-sm text-foreground whitespace-pre-line">
                    {nursingNote}
                  </div>
                </div>
              )}

              {/* Orders */}
              {orders.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {tr('الطلبات', 'Orders')} ({orders.length})
                  </h4>
                  <div className="space-y-2">
                    {orders.map((order: any) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between rounded-2xl border border-border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">
                            {order.kind || '—'}
                          </span>
                          <span className="text-sm text-foreground">
                            {order.testName || order.name || order.description || '—'}
                          </span>
                        </div>
                        <span
                          className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${
                            order.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status || 'ORDERED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disposition */}
              {disposition && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {tr('التصرف', 'Disposition')}
                  </h4>
                  <div className="rounded-2xl border border-border bg-muted p-3 text-sm">
                    <div className="font-medium text-foreground">{disposition.type || '—'}</div>
                    {disposition.note && <div className="text-muted-foreground mt-1">{disposition.note}</div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Search() {
  const { isRTL, language } = useLang();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/search');
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [query, setQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const searchUrl =
    query.trim().length >= 2
      ? `/api/search/unified?q=${encodeURIComponent(query.trim())}&limit=10`
      : null;

  const { data: searchData, isLoading: searchLoading } = useSWR(
    hasPermission && !selectedPatient && searchUrl ? searchUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const patients: PatientResult[] = Array.isArray(searchData?.items) ? searchData.items : [];

  const { data: visitsData, isLoading: visitsLoading } = useSWR(
    hasPermission && selectedPatient?.patientMasterId
      ? `/api/patients/${encodeURIComponent(selectedPatient.patientMasterId)}/visits?limit=50`
      : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const visits: Visit[] = Array.isArray(visitsData?.items) ? visitsData.items : [];

  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const handleSelectPatient = (patient: PatientResult) => {
    setSelectedPatient(patient);
    setQuery('');
  };

  const handleBack = () => {
    setSelectedPatient(null);
    setSelectedVisit(null);
    setDialogOpen(false);
  };

  const handleVisitClick = (visit: Visit) => {
    setSelectedVisit(visit);
    setDialogOpen(true);
  };

  const deptBadge = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'OPD') return 'bg-blue-100 text-blue-800';
    if (t === 'ER') return 'bg-red-100 text-red-800';
    if (t === 'IPD') return 'bg-purple-100 text-purple-800';
    return 'bg-muted text-muted-foreground';
  };

  const statusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'OPEN' || s === 'ACTIVE') return 'bg-emerald-100 text-emerald-800';
    return 'bg-muted text-muted-foreground';
  };

  const formatGender = (g: string | null) => {
    if (!g) return '—';
    const upper = g.toUpperCase();
    if (upper === 'MALE') return tr('ذكر', 'Male');
    if (upper === 'FEMALE') return tr('أنثى', 'Female');
    return g;
  };

  // State B: Visit List
  if (selectedPatient) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 rounded-xl hover:bg-muted thea-transition-fast" aria-label={tr('رجوع', 'Go back')}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{selectedPatient.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedPatient.identifiers?.mrn || selectedPatient.identifiers?.tempMrn || '—'}
              {selectedPatient.age != null ? ` • ${selectedPatient.age} ${tr('سنة', 'y')}` : ''}
              {selectedPatient.gender ? ` • ${formatGender(selectedPatient.gender)}` : ''}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-foreground">{tr('الزيارات', 'Visits')}</h3>
            <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">{visits.length}</span>
          </div>
          <div className="p-5">
            {visitsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : visits.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {tr('لا توجد زيارات', 'No visits found')}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="hidden md:grid grid-cols-6 gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <div>{tr('التاريخ', 'Date')}</div>
                  <div>{tr('القسم', 'Dept')}</div>
                  <div>{tr('العيادة', 'Clinic')}</div>
                  <div>{tr('الطبيب', 'Doctor')}</div>
                  <div>{tr('الحالة', 'Status')}</div>
                  <div className="w-10" />
                </div>
                {visits.map((visit) => {
                  const visitDate = visit.date || visit.createdAt;
                  return (
                    <div
                      key={visit.id}
                      className="grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-3 px-3 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-muted/50 thea-transition-fast rounded-xl"
                      onClick={() => handleVisitClick(visit)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${visit.encounterType} ${tr('زيارة', 'visit')} - ${visit.status} - ${visit.clinicName || ''}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleVisitClick(visit); } }}
                    >
                      <div className="text-sm text-foreground">
                        {visitDate
                          ? `${new Date(visitDate).toLocaleDateString('en-GB')} ${new Date(visitDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                          : '—'}
                      </div>
                      <div>
                        <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${deptBadge(visit.encounterType)}`}>
                          {visit.encounterType}
                        </span>
                      </div>
                      <div className="text-sm text-foreground">{visit.clinicName || '—'}</div>
                      <div className="text-sm text-foreground">{visit.providerName || '—'}</div>
                      <div>
                        <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${statusBadge(visit.status)}`}>{visit.status}</span>
                      </div>
                      <div>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <VisitDetailDialog
          visit={selectedVisit}
          patient={selectedPatient}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          tr={tr}
          isRTL={isRTL}
        />
      </div>
    );
  }

  // State A: Search
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{tr('سجل المريض', 'Patient Records')}</h1>
        <p className="text-sm text-muted-foreground">{tr('ابحث عن مريض لعرض زياراته', 'Search for a patient to view their visits')}</p>
      </div>

      <div className="relative" role="search" aria-label={tr('بحث عن مريض', 'Patient search')}>
        <SearchIcon
          className="absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none"
          style={{ [isRTL ? 'right' : 'left']: '0.75rem' }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('اسم المريض أو رقم ملفه', 'Patient name or MRN')}
          aria-label={tr('بحث عن مريض بالاسم أو رقم الملف', 'Search for patient by name or MRN')}
          className={`w-full px-3 py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus ${isRTL ? 'pr-10' : 'pl-10'}`}
        />
      </div>

      {searchLoading && query.trim().length >= 2 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!searchLoading && query.trim().length >= 2 && patients.length > 0 && (
        <div aria-live="polite" aria-label={tr(`${patients.length} نتائج بحث`, `${patients.length} search results`)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {patients.map((patient) => (
            <div
              key={patient.patientMasterId || patient.fullName}
              className="rounded-2xl bg-card border border-border p-4 cursor-pointer thea-hover-lift thea-transition-fast"
              onClick={() => handleSelectPatient(patient)}
              role="button"
              tabIndex={0}
              aria-label={`${tr('عرض زيارات', 'View visits for')} ${patient.fullName}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectPatient(patient); } }}
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{patient.fullName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    MRN: {patient.identifiers?.mrn || patient.identifiers?.tempMrn || '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {patient.age != null ? `${patient.age} ${tr('سنة', 'y')}` : '—'}
                    {patient.gender ? ` • ${formatGender(patient.gender)}` : ''}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searchLoading && query.trim().length >= 2 && patients.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8" aria-live="polite" role="status">
          {tr('لا توجد نتائج', 'No results found')}
        </div>
      )}

      {query.trim().length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <SearchIcon className="h-10 w-10 mb-3" />
          <p className="text-sm">{tr('اكتب اسم المريض أو رقم ملفه للبحث', 'Type a patient name or MRN to search')}</p>
        </div>
      )}
    </div>
  );
}
