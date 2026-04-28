'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i + 1 < current
                ? 'bg-emerald-500 text-white'
                : i + 1 === current
                ? 'bg-blue-600 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1 < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 ${i + 1 < current ? 'bg-emerald-500' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [step, setStep] = useState(1);

  // Step 1 — Provider & Clinic
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  // Step 2 — Date & Slot
  const [selectedDate, setSelectedDate] = useState(() => {
    const sp = searchParams.get('start');
    if (sp) {
      try {
        return new Date(sp).toISOString().slice(0, 10);
      } catch {
        // ignore
      }
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  // Step 3 — Patient
  const [patientQuery, setPatientQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Step 4 — Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Pre-populate resourceId from URL
  const urlResourceId = searchParams.get('resourceId') || '';

  // Metadata
  const { data: meta } = useSWR('/api/opd/booking/metadata', fetcher);
  const specialties: string[] = meta?.specialties ?? [];
  const clinics: any[] = meta?.clinics ?? [];
  const providers: any[] = meta?.providers ?? [];

  const filteredClinics = selectedSpecialty
    ? clinics.filter((c: any) => c.specialty === selectedSpecialty || !c.specialty)
    : clinics;

  const filteredProviders = providers.filter((p: any) => {
    const matchSpec = !selectedSpecialty || p.specialty === selectedSpecialty;
    const matchClinic = !selectedClinic || p.clinicId === selectedClinic;
    return matchSpec && matchClinic;
  });

  // Pre-select provider from URL
  useEffect(() => {
    if (urlResourceId && providers.length > 0 && !selectedProvider) {
      const found = providers.find((p: any) => p.id === urlResourceId || p.resourceId === urlResourceId);
      if (found) setSelectedProvider(found);
    }
  }, [urlResourceId, providers, selectedProvider]);

  // Slots
  const resourceId = selectedProvider?.id || selectedProvider?.resourceId || '';
  const slotsUrl =
    resourceId && selectedDate
      ? `/api/scheduling/slots?resourceId=${encodeURIComponent(resourceId)}&date=${selectedDate}`
      : null;
  const { data: slotsData } = useSWR(step === 2 ? slotsUrl : null, fetcher);
  const slots: any[] = slotsData?.slots ?? [];

  // Patient search debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(patientQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const patientSearchUrl =
    debouncedQuery.length >= 2
      ? `/api/patients/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`
      : null;
  const { data: patientResults } = useSWR(step === 3 ? patientSearchUrl : null, fetcher);
  const patients: any[] = patientResults?.patients ?? patientResults?.results ?? [];

  const handleSubmit = async () => {
    if (!selectedSlot || !selectedPatient || !resourceId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const clientRequestId = crypto.randomUUID();
      const res = await fetch('/api/opd/booking/create', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientRequestId,
          resourceId,
          slotId: selectedSlot.id,
          patientMasterId: selectedPatient.id || selectedPatient.patientMasterId,
          start: selectedSlot.start,
          end: selectedSlot.end,
          clinicId: selectedClinic || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Booking failed');
      router.push(`/opd/appointments?date=${selectedDate}`);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
          >
            ← {tr('رجوع', 'Back')}
          </button>
          <h1 className="text-2xl font-bold text-foreground">
            {tr('حجز موعد جديد', 'New Appointment')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr('اتبع الخطوات لحجز موعد', 'Follow the steps to book an appointment')}
          </p>
        </div>

        <StepIndicator current={step} total={4} />

        {/* Step 1 — Provider & Clinic */}
        {step === 1 && (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="text-base font-semibold">
              {tr('الخطوة ١ — الطبيب والعيادة', 'Step 1 — Provider & Clinic')}
            </h2>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('التخصص', 'Specialty')}
              </label>
              <select
                value={selectedSpecialty}
                onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedClinic(''); setSelectedProvider(null); }}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{tr('— اختر —', '— Select —')}</option>
                {specialties.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('العيادة', 'Clinic')}
              </label>
              <select
                value={selectedClinic}
                onChange={(e) => { setSelectedClinic(e.target.value); setSelectedProvider(null); }}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{tr('— اختر —', '— Select —')}</option>
                {filteredClinics.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || c.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('الطبيب / المختص', 'Provider / Doctor')}
              </label>
              <select
                value={selectedProvider?.id || ''}
                onChange={(e) => {
                  const p = filteredProviders.find((x: any) => x.id === e.target.value);
                  setSelectedProvider(p || null);
                }}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{tr('— اختر —', '— Select —')}</option>
                {filteredProviders.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name || p.id}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                disabled={!selectedProvider}
                onClick={() => setStep(2)}
                className="px-6 py-2 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-50"
              >
                {tr('التالي', 'Next')} →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Date & Slot */}
        {step === 2 && (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="text-base font-semibold">
              {tr('الخطوة ٢ — التاريخ والوقت', 'Step 2 — Date & Slot')}
            </h2>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('التاريخ', 'Date')}
              </label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {slotsData && slots.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {tr('لا توجد أوقات متاحة في هذا اليوم', 'No available slots on this day')}
              </div>
            )}

            {slots.length > 0 && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  {tr('اختر وقتاً', 'Select a slot')}
                </label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot: any) => {
                    const isBooked = slot.status === 'BOOKED' || slot.status === 'RESERVED';
                    const isSelected = selectedSlot?.id === slot.id;
                    const start = slot.start ? new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : slot.id;
                    return (
                      <button
                        key={slot.id}
                        disabled={isBooked}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isBooked
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {start}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted">
                ← {tr('السابق', 'Back')}
              </button>
              <button
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className="px-6 py-2 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-50"
              >
                {tr('التالي', 'Next')} →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Patient */}
        {step === 3 && (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="text-base font-semibold">
              {tr('الخطوة ٣ — المريض', 'Step 3 — Patient')}
            </h2>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {tr('بحث (الاسم، رقم الملف، الهوية، الجوال)', 'Search (name, MRN, ID, mobile)')}
              </label>
              <input
                type="text"
                value={patientQuery}
                onChange={(e) => { setPatientQuery(e.target.value); setSelectedPatient(null); }}
                placeholder={tr('ابدأ الكتابة...', 'Start typing...')}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {selectedPatient && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  {(selectedPatient.fullName || selectedPatient.name || '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{selectedPatient.fullName || selectedPatient.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedPatient.mrn || selectedPatient.patientMasterId}</div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}

            {!selectedPatient && debouncedQuery.length >= 2 && (
              <div className="rounded-xl border border-border overflow-hidden">
                {patients.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    {tr('لا توجد نتائج', 'No results')}
                  </div>
                ) : (
                  patients.map((p: any) => (
                    <button
                      key={p.id || p.patientMasterId}
                      onClick={() => setSelectedPatient(p)}
                      className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-0"
                    >
                      <div className="text-sm font-medium">{p.fullName || p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.mrn || p.patientMasterId} · {p.dateOfBirth || ''}</div>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted">
                ← {tr('السابق', 'Back')}
              </button>
              <button
                disabled={!selectedPatient}
                onClick={() => setStep(4)}
                className="px-6 py-2 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-50"
              >
                {tr('التالي', 'Next')} →
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Confirm */}
        {step === 4 && (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <h2 className="text-base font-semibold">
              {tr('الخطوة ٤ — تأكيد الحجز', 'Step 4 — Confirm Booking')}
            </h2>

            <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الطبيب', 'Provider')}</span>
                <span className="font-medium">{selectedProvider?.name || selectedProvider?.id}</span>
              </div>
              {selectedClinic && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('العيادة', 'Clinic')}</span>
                  <span className="font-medium">
                    {filteredClinics.find((c: any) => c.id === selectedClinic)?.name || selectedClinic}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('التاريخ', 'Date')}</span>
                <span className="font-medium">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الوقت', 'Time')}</span>
                <span className="font-medium">
                  {selectedSlot?.start
                    ? new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : selectedSlot?.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('المريض', 'Patient')}</span>
                <span className="font-medium">{selectedPatient?.fullName || selectedPatient?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('رقم الملف', 'MRN')}</span>
                <span className="font-medium">{selectedPatient?.mrn || selectedPatient?.patientMasterId}</span>
              </div>
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
                {submitError}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(3)} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted">
                ← {tr('السابق', 'Back')}
              </button>
              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="px-6 py-2 text-sm rounded-xl bg-blue-600 text-white disabled:opacity-50"
              >
                {submitting ? tr('جاري الحجز...', 'Booking...') : tr('تأكيد الحجز', 'Confirm Booking')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
