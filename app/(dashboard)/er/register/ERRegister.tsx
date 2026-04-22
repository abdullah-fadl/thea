'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WristbandPrint } from '@/components/er/WristbandPrint';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';

type PatientResult = {
  id: string;
  fullName: string;
  status?: string | null;
  identifiers?: {
    nationalId?: string | null;
    iqama?: string | null;
    passport?: string | null;
  };
  gender: string;
  dob?: string | null;
};

export default function ERRegister() {
  const router = useRouter();
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/register');

  const [mode, setMode] = useState<'known' | 'unknown'>('known');
  const [arrivalMethod, setArrivalMethod] = useState('WALKIN');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [unknownGender, setUnknownGender] = useState('UNKNOWN');
  const [unknownAge, setUnknownAge] = useState('');
  const [unknownName, setUnknownName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupNationalId, setLookupNationalId] = useState('');
  const [lookupDob, setLookupDob] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [showWristbandPrint, setShowWristbandPrint] = useState(false);
  const [selectedPatientForWristband, setSelectedPatientForWristband] = useState<any>(null);

  useEffect(() => {
    if (!query.trim() || mode !== 'known') {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' });
        const data = await res.json();
        setSearchResults((data.items || []).map((item: any) => ({
          id: String(item.id || ''),
          fullName: item.fullName || 'Unknown',
          status: item.status || null,
          identifiers: item.identifiers || {},
          gender: item.gender || 'UNKNOWN',
          dob: item.dob || null,
        })));
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, mode]);

  const canSubmitKnown = useMemo(() => Boolean(selectedPatient), [selectedPatient]);
  const canSubmitUnknown = useMemo(() => Boolean(unknownGender), [unknownGender]);

  const safeReadJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      return { error: text || 'Request failed' };
    }
  };

  const handleKnownSubmit = async () => {
    if (!selectedPatient) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/er/encounters/known', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: selectedPatient.id,
          arrivalMethod,
          paymentStatus,
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || tr('فشل التسجيل', 'Failed to register'));
      setSuccess(tr('تم إنشاء الزيارة', 'Visit created'));
      router.push(`/er/triage/${data.encounter.id}`);
    } catch (err: any) {
      setError(err.message || tr('فشل التسجيل', 'Failed to register'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnknownSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/er/encounters/unknown', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: unknownGender,
          approxAge: unknownAge ? Number(unknownAge) : null,
          fullName: unknownName || null,
          arrivalMethod,
          paymentStatus,
        }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) throw new Error(data.error || tr('فشل التسجيل', 'Failed to register'));
      setSuccess(tr('تم تسجيل مجهول:', 'Unknown registered:') + ` ${data.patient.tempMrn}`);
      router.push(`/er/triage/${data.encounter.id}`);
    } catch (err: any) {
      setError(err.message || tr('فشل التسجيل', 'Failed to register'));
    } finally {
      setSubmitting(false);
    }
  };

  const runIdentityLookup = async () => {
    if (!lookupNationalId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const clientRequestId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `lookup-${Date.now()}`;
      const res = await fetch('/api/identity/lookup', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityType: 'NATIONAL_ID',
          identityValue: lookupNationalId,
          dob: lookupDob || undefined,
          contextArea: 'er',
          clientRequestId,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.code === 'DOB_REQUIRED' ? tr('تاريخ الميلاد مطلوب للتحقق.', 'DOB required for verified lookup.') : payload?.error || tr('فشل البحث', 'Lookup failed');
        throw new Error(msg);
      }
      setLookupResult(payload);
    } catch (err: any) {
      setLookupError(err?.message || tr('فشل البحث', 'Lookup failed'));
    } finally {
      setLookupLoading(false);
    }
  };

  if (isLoading || hasPermission === null) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">{tr('تسجيل سريع للطوارئ', 'ER Quick Registration')}</h1>
            <p className="text-sm text-muted-foreground">{tr('تسجيل سريع لوصول مرضى الطوارئ.', 'Speed-first registration for ER arrivals.')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              className="inline-flex items-center px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
              href="/search"
            >
              {tr('بحث موحد', 'Unified Search')}
            </Link>
            <button
              className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
              onClick={() => setLookupOpen(true)}
            >
              {tr('البحث الحكومي', 'Government Lookup')}
            </button>
            <button
              className={`px-4 py-2 rounded-xl font-bold thea-transition-fast ${mode === 'known' ? 'bg-primary text-white' : 'border border-border hover:bg-muted'}`}
              onClick={() => setMode('known')}
            >
              {tr('مريض معروف', 'Known Patient')}
            </button>
            <button
              className={`px-4 py-2 rounded-xl font-bold thea-transition-fast ${mode === 'unknown' ? 'bg-primary text-white' : 'border border-border hover:bg-muted'}`}
              onClick={() => setMode('unknown')}
            >
              {tr('تسجيل مجهول', 'Register Unknown')}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-extrabold text-base">{tr('تفاصيل الوصول', 'Arrival Details')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{tr('حدد طريقة الوصول وحالة الدفع.', 'Set method and payment status.')}</p>
          </div>
          <div className="p-5 grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('طريقة الوصول', 'Arrival Method')}</span>
              <div className="flex flex-wrap gap-2">
                {(['WALKIN', 'AMBULANCE', 'TRANSFER'] as const).map((method) => (
                  <button
                    key={method}
                    className={`px-4 py-2 rounded-xl font-bold thea-transition-fast ${arrivalMethod === method ? 'bg-primary text-white' : 'border border-border hover:bg-muted'}`}
                    onClick={() => setArrivalMethod(method)}
                  >
                    {method === 'WALKIN' ? tr('حضور شخصي', 'Walk-in') : method === 'AMBULANCE' ? tr('إسعاف', 'Ambulance') : tr('تحويل', 'Transfer')}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدفع', 'Payment')}</span>
              <div className="flex flex-wrap gap-2">
                {(['PENDING', 'INSURANCE', 'CASH'] as const).map((status) => (
                  <button
                    key={status}
                    className={`px-4 py-2 rounded-xl font-bold thea-transition-fast ${paymentStatus === status ? 'bg-primary text-white' : 'border border-border hover:bg-muted'}`}
                    onClick={() => setPaymentStatus(status)}
                  >
                    {status === 'PENDING' ? tr('معلّق', 'Pending') : status === 'INSURANCE' ? tr('تأمين', 'Insurance') : tr('نقدي', 'Cash')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {mode === 'known' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-extrabold text-base">{tr('مريض معروف', 'Known Patient')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tr('ابحث واختر مريضاً موثقاً ثم أنشئ زيارة الطوارئ.', 'Search and select a verified patient, then create the ER visit.')}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('بحث', 'Search')}</span>
                <input
                  className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast placeholder:text-muted-foreground"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPatient(null);
                  }}
                  placeholder={tr('الاسم أو المعرّف', 'Name or identifier')}
                />
                {isSearching && <p className="text-xs text-muted-foreground">{tr('جاري البحث...', 'Searching...')}</p>}
              </div>
              <div className="space-y-2">
                {searchResults.map((patient) => {
                  const isSelected = selectedPatient?.id === patient.id;
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                      className={cn(
                        'w-full text-left rounded-xl border px-4 py-3 thea-transition-fast thea-hover-lift',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                      )}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{patient.fullName}</span>
                    <span className="text-xs text-muted-foreground">{patient.id.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                    {patient.gender} {patient.status ? `\u2022 ${patient.status}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {patient.identifiers?.nationalId ||
                      patient.identifiers?.iqama ||
                      patient.identifiers?.passport ||
                      tr('لا توجد معرّفات', 'No identifiers')}
                      </div>
                    </button>
                  );
                })}
                {!isSearching && query.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">{tr('لم يتم العثور على نتائج.', 'No matches found.')}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                  disabled={!canSubmitKnown || submitting}
                  onClick={handleKnownSubmit}
                >
                  {tr('إنشاء زيارة', 'Create Visit')}
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  onClick={() => {
                    if (!selectedPatient) return;
                    setSelectedPatientForWristband({
                      patient: {
                        mrn: selectedPatient.id,
                        fullName: selectedPatient.fullName,
                        gender: selectedPatient.gender,
                        dateOfBirth: selectedPatient.dob || undefined,
                      },
                      encounter: {
                        id: selectedPatient.id,
                        arrivalTime: new Date().toISOString(),
                      },
                    });
                    setShowWristbandPrint(true);
                  }}
                >
                  {tr('طباعة سوار المعصم', 'Print Wristband')}
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'unknown' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-extrabold text-base">{tr('مريض مجهول', 'Unknown Patient')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tr('ينشئ رقم ملف مؤقت لاستقبال الطوارئ. يمكن ربطه بالملف الرئيسي لاحقاً.', 'Creates a temporary MRN for ER intake. Link to Patient Master later.')}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجنس', 'Gender')}</span>
                  <div className="flex flex-wrap gap-2">
                    {(['MALE', 'FEMALE', 'UNKNOWN'] as const).map((gender) => (
                      <button
                        key={gender}
                        className={`px-4 py-2 rounded-xl font-bold thea-transition-fast ${unknownGender === gender ? 'bg-primary text-white' : 'border border-border hover:bg-muted'}`}
                        onClick={() => setUnknownGender(gender)}
                      >
                        {gender === 'MALE' ? tr('ذكر', 'Male') : gender === 'FEMALE' ? tr('أنثى', 'Female') : tr('غير محدد', 'Unknown')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العمر التقريبي', 'Approx. Age')}</span>
                  <input
                    className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast placeholder:text-muted-foreground"
                    value={unknownAge}
                    onChange={(e) => setUnknownAge(e.target.value)}
                    placeholder={tr('اختياري', 'Optional')}
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم (اختياري)', 'Name (optional)')}</span>
                  <input
                    className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast placeholder:text-muted-foreground"
                    value={unknownName}
                    onChange={(e) => setUnknownName(e.target.value)}
                    placeholder={tr('اختياري', 'Optional')}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                  disabled={!canSubmitUnknown || submitting}
                  onClick={handleUnknownSubmit}
                >
                  {tr('تسجيل مجهول', 'Register Unknown')}
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  onClick={() => {
                    setSelectedPatientForWristband({
                      patient: {
                        mrn: `TEMP-${Date.now().toString().slice(-6)}`,
                        fullName: unknownName || 'Unknown Patient',
                        gender: unknownGender,
                      },
                      encounter: {
                        id: `temp-${Date.now()}`,
                        arrivalTime: new Date().toISOString(),
                      },
                    });
                    setShowWristbandPrint(true);
                  }}
                >
                  {tr('طباعة سوار المعصم', 'Print Wristband')}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
      </div>

      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('البحث الحكومي عن الهوية', 'Government Identity Lookup')}</DialogTitle>
            <DialogDescription>{tr('يسمح قسم الطوارئ بالبحث بدون تاريخ الميلاد (جزئي).', 'ER allows lookup without DOB (PARTIAL).')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الهوية الوطنية', 'National ID')}</span>
              <input
                className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast placeholder:text-muted-foreground"
                value={lookupNationalId}
                onChange={(e) => setLookupNationalId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ الميلاد (اختياري)', 'DOB (optional)')}</span>
              <input
                type="date"
                className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast"
                value={lookupDob}
                onChange={(e) => setLookupDob(e.target.value)}
              />
            </div>
            {lookupError ? <div className="text-xs text-destructive">{lookupError}</div> : null}
            {lookupResult ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                      lookupResult.matchLevel === 'VERIFIED'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {lookupResult.matchLevel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lookupResult.matchLevel === 'VERIFIED'
                        ? tr('تم التحقق من الهوية عبر البحث الحكومي.', 'Identity verified by government lookup.')
                        : lookupResult.matchLevel === 'PARTIAL'
                        ? tr('تاريخ الميلاد مفقود. تحقق لاحقاً بإدخال تاريخ الميلاد.', 'DOB missing. Verify later by entering DOB.')
                        : tr('لم يتم العثور على تطابق.', 'No match found.')}
                    </span>
                  </div>
                  {lookupResult.payload ? (
                    <div className="text-xs text-muted-foreground">
                      {lookupResult.payload.fullNameEn || lookupResult.payload.fullNameAr || '\u2014'} •{' '}
                      {lookupResult.payload.gender || '\u2014'} • {lookupResult.payload.dob || '\u2014'}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
              onClick={() => setLookupOpen(false)}
            >
              {tr('إغلاق', 'Close')}
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
              onClick={runIdentityLookup}
              disabled={lookupLoading || !lookupNationalId.trim()}
            >
              {lookupLoading ? tr('جاري البحث...', 'Looking up...') : tr('بحث', 'Lookup')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showWristbandPrint && selectedPatientForWristband && (
        <WristbandPrint
          patient={selectedPatientForWristband.patient}
          encounter={selectedPatientForWristband.encounter}
          onClose={() => {
            setShowWristbandPrint(false);
            setSelectedPatientForWristband(null);
          }}
        />
      )}
    </div>
  );
}
