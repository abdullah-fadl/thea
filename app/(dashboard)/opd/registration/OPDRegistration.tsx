'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Search,
  User,
  UserPlus,
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  CheckCircle,
  AlertCircle,
  CreditCard,
  ChevronDown,
  ChevronLeft,
  Info,
  Zap,
} from 'lucide-react';
import { InvoiceScreen, InvoicePatient, InvoiceContext } from '@/components/billing/InvoiceScreen';
import { buildVisitPricingKey, useVisitPricingCache, VisitPricingProvider } from '@/components/billing/VisitPricingContext';
import { useLang } from '@/hooks/use-lang';
import { getVisitTypeConfig, SOURCE_TYPE_CONFIG } from '@/lib/opd/ui-config';

const VISIT_TYPES_FOR_SELECTOR = ['FVH', 'FVC', 'FU', 'RV'] as const;

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/** Format date as YYYY-MM-DD using local date (avoids UTC timezone off-by-one) */
const toDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface Patient {
  id: string;
  mrn?: string;
  fileNumber?: string;
  fullName?: string;
  firstNameAr?: string;
  middleNameAr?: string;
  lastNameAr?: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  iqama?: string;
  phone?: string;
  insurancePolicyNumber?: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  insurancePlanId?: string;
  insuranceExpiryDate?: string;
}

interface Appointment {
  id: string;
  slotStart: string;
  slotEnd?: string;
  status: string;
  resourceId: string;
  resourceName?: string;
  specialtyCode?: string;
  specialtyName?: string;
  clinicId?: string;
  clinicName?: string;
  visitType?: string;
}

type VisitMode = 'appointment' | 'walkin';

export default function OPDRegistration() {
  const router = useRouter();
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const [visitMode, setVisitMode] = useState<VisitMode>('walkin');
  const [walkinSchedule, setWalkinSchedule] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateOnly(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedVisitType, setSelectedVisitType] = useState('FVC');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const [showInvoice, setShowInvoice] = useState(false);
  const [invoicePatient, setInvoicePatient] = useState<InvoicePatient | null>(null);
  const [invoiceContext, setInvoiceContext] = useState<InvoiceContext | null>(null);

  const { data: specialtiesData } = useSWR('/api/specialties', fetcher);
  const specialties = specialtiesData?.items || specialtiesData?.specialties || [];

  const { data: clinicsData } = useSWR(
    selectedSpecialty ? `/api/clinics?specialtyCode=${selectedSpecialty}` : null,
    fetcher
  );
  const clinics = clinicsData?.items || clinicsData?.clinics || [];

  const { data: doctorsData } = useSWR(
    selectedSpecialty && selectedDate
      ? `/api/scheduling/resources?specialtyCode=${selectedSpecialty}${selectedClinic ? `&clinicId=${selectedClinic}` : ''}&type=PROVIDER&date=${selectedDate}`
      : null,
    fetcher
  );
  const doctors = doctorsData?.items || doctorsData?.resources || [];

  const { data: slotsData } = useSWR(
    selectedDoctor && selectedDoctor !== 'ANY' && selectedDate
      ? `/api/scheduling/slots?resourceId=${selectedDoctor}&date=${selectedDate}`
      : null,
    fetcher
  );
  const slots = slotsData?.items || [];

  const { getPricing, setPricing } = useVisitPricingCache();
  const [pricingPreview, setPricingPreview] = useState<any | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set('q', searchQuery.trim());
      params.set('limit', '10');
      const res = await fetch(`/api/patients/search?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      setSearchResults(data.items || data.patients || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setLoadingAppointments(true);
    try {
      const today = toDateOnly(new Date());
      const res = await fetch(`/api/opd/booking/by-patient?patientId=${patient.id}&date=${today}`, { credentials: 'include' });
      const data = await res.json();
      const appointments = data.items || data.appointments || [];
      const activeAppointments = appointments.filter((a: Appointment) =>
        ['ACTIVE', 'CONFIRMED', 'BOOKED', 'SCHEDULED'].includes(a.status)
      );
      setTodayAppointments(activeAppointments);
      if (activeAppointments.length === 1) {
        handleSelectAppointment(activeAppointments[0]);
      } else if (activeAppointments.length === 0) {
        setVisitMode('walkin');
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      setTodayAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleSelectAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setVisitMode('appointment');
    setSelectedSpecialty(appointment.specialtyCode || '');
    setSelectedClinic(appointment.clinicId || '');
    setSelectedDoctor(appointment.resourceId || '');
    setSelectedDate(appointment.slotStart ? appointment.slotStart.split('T')[0] : selectedDate);
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setTodayAppointments([]);
    setSelectedAppointment(null);
    setVisitMode('walkin');
    setWalkinSchedule(false);
    setSelectedSpecialty('');
    setSelectedClinic('');
    setSelectedDoctor('');
    setSelectedDate(toDateOnly(new Date()));
    setSelectedSlot(null);
    setSelectedVisitType('FVC');
    setChiefComplaint('');
    setPricingPreview(null);
    setPricingError(null);
  };

  const getPatientName = (patient: Patient) => {
    return (
      patient.fullName ||
      [patient.firstNameAr, patient.middleNameAr, patient.lastNameAr].filter(Boolean).join(' ') ||
      [patient.firstName, patient.lastName].filter(Boolean).join(' ') ||
      tr('مريض', 'Patient')
    );
  };

  const getSelectedSpecialtyName = () => {
    const specialty = specialties.find((s: any) => s.code === selectedSpecialty || s.id === selectedSpecialty);
    return specialty?.nameAr || specialty?.name || selectedAppointment?.specialtyName || '';
  };

  const getSelectedDoctorName = () => {
    if (selectedDoctor === 'ANY') return tr('أي طبيب متاح', 'Any available doctor');
    const doctor = doctors.find((d: any) => d.id === selectedDoctor);
    return doctor?.nameAr || doctor?.name || doctor?.displayName || selectedAppointment?.resourceName || '';
  };

  const getDoctorStatus = (doctor: any) => {
    const now = new Date();
    const todayStr = toDateOnly(now);
    if (selectedDate !== todayStr) return 'scheduled';
    const endTime = doctor?.schedule?.endTime;
    if (endTime) {
      const [h, m] = String(endTime).split(':').map(Number);
      if (!Number.isNaN(h)) {
        const endDate = new Date();
        endDate.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
        if (now > endDate) return 'finished';
      }
    }
    const startTime = doctor?.schedule?.startTime;
    if (startTime) {
      const [h, m] = String(startTime).split(':').map(Number);
      if (!Number.isNaN(h)) {
        const startDate = new Date();
        startDate.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
        if (now < startDate) return 'not_started';
      }
    }
    const availableSlots = Number(doctor?.availableSlots || 0);
    const waitingCount = Number(doctor?.waitingCount || 0);
    const inConsultation = Number(doctor?.inConsultationCount || 0);
    if (availableSlots === 0 && waitingCount >= 5) return 'busy';
    if (availableSlots === 0 && inConsultation > 0) return 'busy';
    if (availableSlots === 0) return 'busy';
    return 'available';
  };

  const effectiveDoctorId = useMemo(() => {
    if (selectedDoctor === 'ANY') {
      return doctors.find((doc: any) => getDoctorStatus(doc) === 'available')?.id || '';
    }
    return selectedDoctor;
  }, [selectedDoctor, doctors, selectedDate]);

  useEffect(() => {
    if (!selectedPatient || !effectiveDoctorId) {
      setPricingPreview(null);
      setPricingError(null);
      return;
    }
    const key = buildVisitPricingKey({ patientId: selectedPatient.id, doctorId: effectiveDoctorId, specialtyCode: selectedSpecialty });
    const cached = getPricing(key);
    if (cached) {
      setPricingPreview(cached);
      setPricingError(null);
      return;
    }
    let active = true;
    setPricingLoading(true);
    setPricingError(null);
    fetch(`/api/billing/visit-pricing?patientId=${selectedPatient.id}&doctorId=${effectiveDoctorId}&specialtyCode=${selectedSpecialty}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.error) { setPricingError(data.error); setPricingPreview(null); return; }
        setPricing(key, data);
        setPricingPreview(data);
      })
      .catch((err) => {
        if (!active) return;
        setPricingError(String(err?.message || tr('فشل تحميل التسعير', 'Failed to load pricing')));
        setPricingPreview(null);
      })
      .finally(() => { if (!active) return; setPricingLoading(false); });
    return () => { active = false; };
  }, [selectedPatient, selectedSpecialty, effectiveDoctorId, getPricing, setPricing]);

  useEffect(() => {
    if (pricingPreview?.visitTypeCode && (VISIT_TYPES_FOR_SELECTOR as readonly string[]).includes(pricingPreview.visitTypeCode)) {
      setSelectedVisitType(pricingPreview.visitTypeCode);
    }
  }, [pricingPreview?.visitTypeCode]);

  const handleOpenVisit = async () => {
    if (!selectedPatient) return;
    if (visitMode === 'walkin' && !selectedSpecialty) { alert(tr('يرجى اختيار التخصص', 'Please select a specialty')); return; }
    if (visitMode === 'walkin' && !selectedDoctor) { alert(tr('يرجى اختيار الطبيب', 'Please select a doctor')); return; }
    if (visitMode === 'walkin' && selectedDoctor === 'ANY' && !effectiveDoctorId) { alert(tr('لا يوجد طبيب متاح في هذا التاريخ', 'No doctor available on this date')); return; }

    const patient: InvoicePatient = {
      id: selectedPatient.id,
      mrn: selectedPatient.mrn || selectedPatient.fileNumber || '—',
      fullName: getPatientName(selectedPatient),
      nationalId: selectedPatient.nationalId || selectedPatient.iqama,
      phone: selectedPatient.phone,
      insurancePolicyNumber: selectedPatient.insurancePolicyNumber,
      insuranceCompanyId: selectedPatient.insuranceCompanyId,
      insuranceCompanyName: selectedPatient.insuranceCompanyName,
      insurancePlanId: selectedPatient.insurancePlanId,
      insuranceExpiryDate: selectedPatient.insuranceExpiryDate,
    };

    const pricingKey = buildVisitPricingKey({
      patientId: selectedPatient.id,
      doctorId: effectiveDoctorId || selectedAppointment?.resourceId || '',
      specialtyCode: selectedSpecialty || selectedAppointment?.specialtyCode,
    });
    let pricing = getPricing(pricingKey);
    if (!pricing && effectiveDoctorId) {
      try {
        const res = await fetch(`/api/billing/visit-pricing?patientId=${selectedPatient.id}&doctorId=${effectiveDoctorId}&specialtyCode=${selectedSpecialty || ''}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && !data?.error) { setPricing(pricingKey, data); pricing = data; }
      } catch (error) { console.error('Failed to fetch visit pricing:', error); }
    }

    const context: InvoiceContext = {
      type: 'visit',
      visitId: selectedAppointment?.id,
      encounterId: undefined,
      providerId: effectiveDoctorId || selectedAppointment?.resourceId,
      providerName: getSelectedDoctorName(),
      specialtyCode: selectedSpecialty || selectedAppointment?.specialtyCode,
      specialtyName: getSelectedSpecialtyName(),
      visitPricing: pricing || undefined,
    };

    setInvoicePatient(patient);
    setInvoiceContext(context);
    setShowInvoice(true);
  };

  const handleInvoiceComplete = async (
    invoiceId: string,
    paymentStatus: 'PAID' | 'PENDING',
    paymentDetails?: { amount: number; method: any; reference?: string }
  ) => {
    try {
      const pricingKey = buildVisitPricingKey({
        patientId: selectedPatient!.id,
        doctorId: effectiveDoctorId || selectedAppointment?.resourceId || '',
        specialtyCode: selectedSpecialty || selectedAppointment?.specialtyCode,
      });
      const pricing = getPricing(pricingKey) || pricingPreview;
      const billingMeta = pricing ? {
        visitType: pricing.visitType,
        visitTypeCode: pricing.visitTypeCode,
        serviceCode: pricing.serviceCode,
        serviceName: pricing.serviceName,
        specialtyCode: selectedSpecialty || selectedAppointment?.specialtyCode,
        providerId: effectiveDoctorId || selectedAppointment?.resourceId,
        price: pricing.price,
        isFree: pricing.isFree,
        reason: pricing.reason,
      } : undefined;
      const paymentServiceType = pricing?.visitType === 'FOLLOW_UP' ? 'FOLLOW_UP' : 'CONSULTATION';

      if (selectedAppointment) {
        const checkInRes = await fetch('/api/opd/booking/check-in', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: selectedAppointment.id,
            billingMeta,
            source: { system: 'REGISTRATION', type: 'APPOINTMENT' },
            payment: { status: paymentStatus, serviceType: paymentServiceType, invoiceId, amount: paymentDetails?.amount, method: paymentDetails?.method, reference: paymentDetails?.reference },
          }),
        });
        const checkInPayload = await checkInRes.json().catch(() => ({}));
        if (!checkInRes.ok) throw new Error(checkInPayload?.error || checkInPayload?.message || tr('فشل تسجيل الحضور', 'Check-in failed'));
      } else {
        // Single atomic call — walk-in API auto-creates encounter + booking together
        const walkInRes = await fetch('/api/opd/booking/walk-in', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientMasterId: selectedPatient!.id,
            clinicId: selectedClinic,
            resourceId: effectiveDoctorId,
            specialtyCode: selectedSpecialty,
            chiefComplaint,
            priority: priority === 'urgent' ? 'URGENT' : 'NORMAL',
            billingMeta,
            payment: { status: paymentStatus, serviceType: paymentServiceType, invoiceId, amount: paymentDetails?.amount, method: paymentDetails?.method, reference: paymentDetails?.reference },
          }),
        });
        const walkInPayload = await walkInRes.json().catch(() => ({}));
        if (!walkInRes.ok) throw new Error(walkInPayload?.error || tr('فشل تسجيل الزيارة', 'Walk-in registration failed'));
      }
      router.push('/opd/waiting-list');
    } catch (error) {
      console.error('Failed to complete visit:', error);
      alert(tr('حدث خطأ في فتح الزيارة', 'An error occurred while opening visit'));
    } finally {
      setShowInvoice(false);
    }
  };

  return (
    <VisitPricingProvider>
      <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">{tr('تسجيل زيارة جديدة', 'Register new visit')}</h1>
          <p className="text-muted-foreground">{tr('البحث عن المريض وفتح زيارة', 'Search patient and open visit')}</p>
        </div>

        {/* Step 1: Patient Search */}
        <div className="rounded-2xl bg-card border border-border p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-semibold">1</div>
            <h2 className="text-lg font-semibold text-foreground">{tr('البحث عن المريض', 'Search patient')}</h2>
          </div>

          {!selectedPatient ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={tr('ابحث بالاسم أو رقم الملف أو الهوية...', 'Search by name, file number, or ID...')}
                    className={`w-full py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus ${
                      isRTL ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'
                    }`}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || searchQuery.length < 2}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 font-semibold thea-transition-fast"
                >
                  {isSearching ? tr('جاري البحث...', 'Searching...') : tr('بحث', 'Search')}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div dir={language === 'en' ? 'ltr' : undefined} className="mt-4 rounded-2xl border border-border overflow-hidden">
                  <div className="p-3 bg-muted border-b border-border text-sm text-muted-foreground">
                    {language === 'ar' ? `${searchResults.length} نتيجة` : `${searchResults.length} results`}
                  </div>
                  <div className="divide-y divide-border">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className={`w-full p-4 hover:bg-muted/50 flex items-center gap-3 thea-transition-fast ${language === 'en' ? 'text-left' : 'text-right'}`}
                      >
                        <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-primary/80 to-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground font-semibold text-lg">{getPatientName(patient)[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground">{getPatientName(patient)}</div>
                          <div className="text-sm text-muted-foreground">
                            {patient.mrn && `${tr('ملف', 'MRN')}: ${String(patient.mrn).replace(/^MRN-?/i, '')}`}
                            {patient.nationalId && ` • ${tr('هوية', 'ID')}: ${patient.nationalId}`}
                            {patient.iqama && ` • ${tr('إقامة', 'Iqama')}: ${patient.iqama}`}
                          </div>
                        </div>
                        <ChevronLeft className={`w-5 h-5 shrink-0 text-muted-foreground ${language === 'en' ? 'rotate-180' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-center">
                <button onClick={() => router.push('/registration')} className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-2 thea-transition-fast">
                  <UserPlus className="w-4 h-4" />
                  {tr('مريض غير موجود؟ تسجيل مريض جديد', 'Patient not found? Register new patient')}
                </button>
              </div>
            </>
          ) : (
            <div dir={language === 'en' ? 'ltr' : undefined} className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-3 ${language === 'en' ? 'text-left' : ''}`}>
                  <div className="w-12 h-12 shrink-0 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-lg">{getPatientName(selectedPatient)[0]}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{getPatientName(selectedPatient)}</div>
                    <div className="text-sm text-muted-foreground">
                      {tr('ملف', 'MRN')}: {(selectedPatient.mrn || selectedPatient.fileNumber || '—').replace(/^MRN-?/i, '')}
                      {selectedPatient.phone && ` • ${selectedPatient.phone}`}
                    </div>
                  </div>
                </div>
                <button onClick={handleClearPatient} className="text-primary hover:text-primary/80 text-sm font-medium shrink-0 thea-transition-fast">{tr('تغيير', 'Change')}</button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3 text-center">{tr('اكتب الاسم بالعربي أو الإنجليزي أو رقم الملف', 'Type name in Arabic/English or file number')}</p>
        </div>

        {/* Step 2: Appointments */}
        {selectedPatient && (
          <div className="rounded-2xl bg-card border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-semibold">2</div>
              <h2 className="text-lg font-semibold text-foreground">{tr('مواعيد اليوم', "Today's appointments")}</h2>
            </div>

            {loadingAppointments ? (
              <div className="text-center py-6 text-muted-foreground">{tr('جاري التحقق من المواعيد...', 'Checking appointments...')}</div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    onClick={() => handleSelectAppointment(appointment)}
                    className={`w-full p-4 rounded-2xl border-2 text-right thea-transition-fast ${
                      selectedAppointment?.id === appointment.id ? 'border-emerald-500 bg-emerald-50' : 'border-border hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-100 rounded-xl"><Calendar className="w-6 h-6 text-emerald-600" /></div>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{appointment.resourceName || 'طبيب'}</div>
                        <div className="text-sm text-muted-foreground">{appointment.specialtyName || appointment.specialtyCode}{appointment.clinicName && ` • ${appointment.clinicName}`}</div>
                        <div className="text-sm text-emerald-600 font-medium mt-1">
                          <Clock className="h-3.5 w-3.5 inline mr-1" />{new Date(appointment.slotStart).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {selectedAppointment?.id === appointment.id && <CheckCircle className="w-6 h-6 text-emerald-600" />}
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => { setSelectedAppointment(null); setVisitMode('walkin'); }}
                  className={`w-full p-4 rounded-2xl border-2 text-right thea-transition-fast ${
                    visitMode === 'walkin' && !selectedAppointment ? 'border-amber-500 bg-amber-50' : 'border-dashed border-border hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl"><Clock className="w-6 h-6 text-amber-600" /></div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{tr('زيارة بدون موعد (انتظار)', 'Walk-in visit (waiting)')}</div>
                      <div className="text-sm text-muted-foreground">{tr('تسجيل في قائمة الانتظار', 'Register in waiting list')}</div>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">{tr('لا يوجد موعد اليوم', 'No appointment today')}</p>
                    <p className="text-sm text-amber-600">{tr('سيتم تسجيل المريض في قائمة الانتظار', 'Patient will be added to waiting list')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Doctor & Slot selection */}
        {selectedPatient && visitMode === 'walkin' && !selectedAppointment && (
          <div className="rounded-2xl bg-card border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-semibold">3</div>
              <h2 className="text-lg font-semibold text-foreground">{tr('اختيار التاريخ والطبيب', 'Select date and doctor')}</h2>
            </div>

            <div className="space-y-6">
              {/* Entry mode cards */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">{tr('نوع الدخول', 'Entry mode')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => { setWalkinSchedule(false); setSelectedSlot(null); }}
                    className={`p-4 rounded-2xl border-2 text-right thea-transition-fast ${!walkinSchedule ? 'border-amber-500 bg-amber-50' : 'border-border hover:border-amber-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${!walkinSchedule ? 'bg-amber-100' : 'bg-muted'}`}>
                        <Clock className={`w-5 h-5 ${!walkinSchedule ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{tr('انتظار مباشر', 'Direct queue')}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{tr('إضافة لقائمة الانتظار فوراً', 'Add to waiting list immediately')}</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setWalkinSchedule(true)}
                    className={`p-4 rounded-2xl border-2 text-right thea-transition-fast ${walkinSchedule ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${walkinSchedule ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Calendar className={`w-5 h-5 ${walkinSchedule ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{tr('اختيار موعد', 'Pick a slot')}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{tr('اختيار وقت محدد للمريض', 'Pick a specific time for patient')}</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Visit type selector - auto-detected from pricing, manual override for walk-in */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{tr('نوع الزيارة', 'Visit type')}</label>
                <div className="flex flex-wrap gap-2">
                  {VISIT_TYPES_FOR_SELECTOR.map((key) => {
                    const cfg = getVisitTypeConfig(key);
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedVisitType(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border thea-transition-fast ${
                          selectedVisitType === key ? `${cfg.color} border-transparent ring-2 ring-primary/30` : 'bg-card border-border text-muted-foreground hover:border-border'
                        }`}
                      >
                        {language === 'ar' ? cfg.label : (cfg.labelEn || cfg.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specialty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    التخصص <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Stethoscope className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <select
                      value={selectedSpecialty}
                      onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedClinic(''); setSelectedDoctor(''); setSelectedSlot(null); }}
                      className="w-full pr-12 pl-10 py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground appearance-none thea-input-focus text-right"
                    >
                      <option value="">{tr('اختر التخصص', 'Select specialty')}</option>
                      {specialties.map((specialty: any) => (
                        <option key={specialty.id || specialty.code} value={specialty.code || specialty.id}>{specialty.nameAr || specialty.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {walkinSchedule && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{tr('التاريخ', 'Date')}</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedDoctor(''); setSelectedSlot(null); }}
                    min={toDateOnly(new Date())}
                    className="w-full md:w-64 px-4 py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus"
                  />
                </div>
              )}

              {/* Clinic */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  العيادة <span className="text-muted-foreground">(اختياري)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <select
                    value={selectedClinic}
                    onChange={(e) => { setSelectedClinic(e.target.value); setSelectedDoctor(''); setSelectedSlot(null); }}
                    disabled={!selectedSpecialty}
                    className="w-full pr-12 pl-10 py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground appearance-none thea-input-focus disabled:bg-muted disabled:text-muted-foreground text-right"
                  >
                    <option value="">{tr('كل العيادات', 'All clinics')}</option>
                    {clinics.map((clinic: any) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.nameAr || clinic.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Doctor + Slot grid */}
              {selectedSpecialty && (
                <div className={`grid gap-6 ${walkinSchedule ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">{tr('الأطباء المتاحين', 'Available doctors')}</label>
                    <div className="space-y-2 max-h-80 overflow-y-auto thea-scroll">
                      <button
                        onClick={() => { setSelectedDoctor('ANY'); setSelectedSlot(null); }}
                        className={`w-full p-3 rounded-2xl border text-right thea-transition-fast ${selectedDoctor === 'ANY' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{tr('أي طبيب متاح', 'Any available doctor')}</span>
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{tr('أول موعد متاح', 'First available slot')}</span>
                        </div>
                      </button>

                      {doctors.map((doctor: any) => {
                        const status = getDoctorStatus(doctor);
                        const statusConfig = {
                          available: { label: tr('متاح', 'Available'), color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
                          busy: { label: tr('مشغول', 'Busy'), color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
                          finished: { label: tr('انتهى الدوام', 'Shift ended'), color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
                          not_started: { label: tr('لم يبدأ', 'Not started'), color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
                          scheduled: { label: tr('متاح', 'Available'), color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
                        }[status];

                        return (
                          <button
                            key={doctor.id}
                            onClick={() => { setSelectedDoctor(doctor.id); setSelectedSlot(null); }}
                            disabled={status === 'finished'}
                            className={`w-full p-3 rounded-2xl border text-right thea-transition-fast ${
                              selectedDoctor === doctor.id ? 'border-primary bg-primary/5' : status === 'finished' ? 'border-border bg-muted opacity-60 cursor-not-allowed' : 'border-border hover:border-primary/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                                <div>
                                  <div className="font-medium text-foreground">{doctor.nameAr || doctor.name || doctor.displayName}</div>
                                  <div className="text-xs text-muted-foreground">{doctor.schedule?.startTime} - {doctor.schedule?.endTime}</div>
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${statusConfig.color}`}>{statusConfig.label}</span>
                            </div>
                          </button>
                        );
                      })}

                      {doctors.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">{tr('لا يوجد أطباء اليوم لهذه العيادة', 'No doctors available today for this clinic')}</div>
                      )}
                    </div>
                  </div>

                  {walkinSchedule && (
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                        {selectedDoctor === 'ANY' ? tr('أول موعد متاح', 'First available slot') : tr('المواعيد المتاحة', 'Available slots')}
                      </label>

                      {!selectedDoctor ? (
                        <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">{tr('اختر طبيب لعرض المواعيد', 'Select a doctor to view slots')}</div>
                      ) : selectedDoctor === 'ANY' ? (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                          <div className="text-emerald-700 font-medium">{tr('سيتم اختيار أول موعد متاح تلقائياً', 'First available slot will be selected automatically')}</div>
                          <div className="text-sm text-emerald-600 mt-1">{tr('مع أي طبيب متاح في العيادة', 'With any available doctor in clinic')}</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto thea-scroll">
                          {slots.map((slot: any) => {
                            const startValue = slot.startAt || slot.startTime || slot.start || slot.slotStart;
                            const slotTime = startValue ? new Date(startValue) : null;
                            const now = new Date();
                            const todayStr = toDateOnly(now);
                            const isTodaySlot = selectedDate === todayStr;
                            const isPastSlot = isTodaySlot && slotTime && slotTime < now;
                            const isBooked = slot.reservation || ['BOOKED','RESERVED','CONFIRMED'].includes(String(slot.status||'').toUpperCase());
                            const isAvailable = !isPastSlot && !isBooked && (['OPEN', 'AVAILABLE'].includes(String(slot.status || '').toUpperCase()) || (!slot.status && !slot.reservation));
                            const time = slotTime ? slotTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Riyadh' }) : '—';

                            return (
                              <button
                                key={slot.id}
                                onClick={() => isAvailable && setSelectedSlot(slot.id)}
                                disabled={!isAvailable}
                                className={`p-3 rounded-xl text-center text-sm font-medium thea-transition-fast ${
                                  selectedSlot === slot.id ? 'bg-primary text-primary-foreground'
                                    : isPastSlot ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : isBooked ? 'bg-red-50 text-red-300 cursor-not-allowed border border-red-100'
                                    : isAvailable ? 'bg-card border border-border hover:border-primary/30 hover:bg-primary/5'
                                    : 'bg-muted text-muted-foreground cursor-not-allowed line-through'
                                }`}
                              >
                                <span>{time}</span>
                                {isPastSlot && <span className="block text-[10px] mt-0.5">{tr('انتهى', 'Past')}</span>}
                                {isBooked && <span className="block text-[10px] mt-0.5 text-red-400">{slot.reservation?.patientName?.split(' ')[0] || tr('محجوز', 'Booked')}</span>}
                              </button>
                            );
                          })}
                          {slots.length === 0 && (
                            <div className="col-span-3 sm:col-span-4 text-center py-8 text-muted-foreground">{tr('لا توجد مواعيد لهذا الطبيب', 'No slots for this doctor')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Visit details */}
        {selectedPatient && (selectedAppointment || (selectedDoctor && (selectedDoctor === 'ANY' || !walkinSchedule || selectedSlot))) && (
          <div className="rounded-2xl bg-card border border-border p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-semibold">{visitMode === 'walkin' ? '4' : '3'}</div>
              <h2 className="text-lg font-semibold text-foreground">{tr('تفاصيل الزيارة', 'Visit details')}</h2>
            </div>

            {/* Pricing preview */}
            <div className="mb-6">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">{tr('معاينة التسعير', 'Pricing preview')}</label>
              {!selectedDoctor ? (
                <div className="border-2 border-dashed border-border rounded-2xl p-4 text-center text-muted-foreground">{tr('اختر طبيباً لعرض التسعير', 'Select doctor to preview pricing')}</div>
              ) : pricingLoading ? (
                <div className="rounded-2xl border border-border p-4 text-muted-foreground">{tr('جاري تحميل التسعير...', 'Loading pricing...')}</div>
              ) : pricingError ? (
                <div className="rounded-2xl border border-red-200 p-4 text-red-600">{pricingError}</div>
              ) : pricingPreview ? (
                <div className="rounded-2xl border border-border p-4 bg-muted">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">
                        {language === 'en' ? (pricingPreview.serviceNameEn || pricingPreview.serviceName) : (pricingPreview.serviceNameAr || pricingPreview.serviceName)}
                      </div>
                      <div className="text-sm text-muted-foreground">{tr('كود', 'Code')}: {pricingPreview.serviceCode}</div>
                      {pricingPreview.visitTypeCode && (
                        <span className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getVisitTypeConfig(pricingPreview.visitTypeCode).color}`}>
                          {language === 'ar' ? getVisitTypeConfig(pricingPreview.visitTypeCode).label : (getVisitTypeConfig(pricingPreview.visitTypeCode).labelEn || getVisitTypeConfig(pricingPreview.visitTypeCode).label)}
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      {pricingPreview.isFree ? (
                        <div className="text-emerald-600 font-bold">{tr('مجاني', 'Free')}</div>
                      ) : (
                        <div className="text-foreground font-bold">{language === 'ar' ? `${pricingPreview.price} ر.س` : `SAR ${pricingPreview.price}`}</div>
                      )}
                    </div>
                  </div>
                  {pricingPreview.reason && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      {pricingPreview.reason}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-2xl p-4 text-center text-muted-foreground">{tr('لم يتم العثور على تسعير', 'No pricing found')}</div>
              )}
            </div>

            {/* Chief complaint */}
            <div className="mb-6">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{tr('الشكوى الرئيسية (اختياري)', 'Chief complaint (optional)')}</label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder={tr('سبب الزيارة...', 'Reason for visit...')}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus resize-none"
              />
            </div>

            {/* Priority */}
            {visitMode === 'walkin' && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">{tr('الأولوية', 'Priority')}</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setPriority('normal')}
                    className={`flex-1 p-3 rounded-2xl border-2 text-center thea-transition-fast ${priority === 'normal' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-border'}`}
                  >
                    {tr('عادي', 'Normal')}
                  </button>
                  <button
                    onClick={() => setPriority('urgent')}
                    className={`flex-1 p-3 rounded-2xl border-2 text-center thea-transition-fast ${priority === 'urgent' ? 'border-red-500 bg-red-50 text-red-700' : 'border-border'}`}
                  >
                    <><Zap className="h-3.5 w-3.5 inline" /> {tr('عاجل', 'Urgent')}</>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit button */}
        {selectedPatient && (selectedAppointment || selectedSpecialty) && (
          <button
            onClick={handleOpenVisit}
            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 thea-transition-fast flex items-center justify-center gap-3 min-h-[44px]"
          >
            <CreditCard className="w-6 h-6" />
            {tr('فتح الزيارة والفاتورة', 'Open visit and invoice')}
          </button>
        )}
      </div>

      {showInvoice && invoicePatient && invoiceContext && (
        <InvoiceScreen
          patient={invoicePatient}
          context={invoiceContext}
          onComplete={handleInvoiceComplete}
          onCancel={() => setShowInvoice(false)}
        />
      )}
      </div>
    </VisitPricingProvider>
  );
}
