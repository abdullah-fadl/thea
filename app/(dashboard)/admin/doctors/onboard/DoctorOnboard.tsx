'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

type Step = 1 | 2 | 3 | 4;

interface DoctorData {
  displayName: string;
  email: string;
  staffId: string;
  licenseNumber: string;
  nationalId: string;
  mobile: string;
  specialties: string[];
  consultationServiceCode?: string;
  level?: 'CONSULTANT' | 'SPECIALIST' | 'RESIDENT';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONSULTANT';
  primaryUnit: string;
  clinics: string[];
  roomIds: string[];
  canPrescribe: boolean;
  canRequestImaging: boolean;
  canPerformProcedures: boolean;
  workingDays: number[];
  startTime: string;
  endTime: string;
  appointmentDuration: number;
  breakStart: string;
  breakEnd: string;
  password: string;
  role: string;
  sendWelcomeEmail: boolean;
}

const INITIAL_DATA: DoctorData = {
  displayName: '',
  email: '',
  staffId: '',
  licenseNumber: '',
  nationalId: '',
  mobile: '',
  specialties: [],
  consultationServiceCode: '',
  level: 'CONSULTANT',
  employmentType: 'FULL_TIME',
  primaryUnit: '',
  clinics: [],
  roomIds: [],
  canPrescribe: true,
  canRequestImaging: true,
  canPerformProcedures: false,
  workingDays: [0, 1, 2, 3, 4],
  startTime: '08:00',
  endTime: '16:00',
  appointmentDuration: 15,
  breakStart: '',
  breakEnd: '',
  password: '',
  role: 'opd-doctor',
  sendWelcomeEmail: true,
};

const DRAFT_KEY = 'doctor_onboard_draft_v1';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...json };
  });

const dayLabels = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];

export default function DoctorOnboard() {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const getDayLabel = (id: number) =>
    [tr('الأحد', 'Sunday'), tr('الإثنين', 'Monday'), tr('الثلاثاء', 'Tuesday'), tr('الأربعاء', 'Wednesday'), tr('الخميس', 'Thursday'), tr('الجمعة', 'Friday'), tr('السبت', 'Saturday')][id] || String(id);
  const levelOptions = [
    { value: 'CONSULTANT', label: tr('استشاري', 'Consultant') },
    { value: 'SPECIALIST', label: tr('أخصائي', 'Specialist') },
    { value: 'RESIDENT', label: tr('مقيم', 'Resident') },
  ];
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<DoctorData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: unitsData } = useSWR('/api/clinical-infra/units', fetcher);
  const { data: clinicsData } = useSWR('/api/clinical-infra/clinics', fetcher);
  const { data: roomsData } = useSWR('/api/clinical-infra/rooms', fetcher);
  const { data: specsData } = useSWR('/api/clinical-infra/specialties', fetcher);
  const { data: consultServicesData } = useSWR('/api/catalogs/services?serviceType=CONSULTATION', fetcher);

  const units = Array.isArray(unitsData?.items) ? unitsData.items : [];
  const clinics = Array.isArray(clinicsData?.items) ? clinicsData.items : [];
  const rooms = Array.isArray(roomsData?.items) ? roomsData.items : [];
  const specialties = Array.isArray(specsData?.items) ? specsData.items : [];
  const consultationServices = Array.isArray(consultServicesData?.items) ? consultServicesData.items : [];

  const selectedSpecialtyCodes = useMemo(() => {
    const selectedIds = new Set(data.specialties.map((id) => String(id)));
    return specialties
      .filter((sp: any) => selectedIds.has(String(sp.id)))
      .map((sp: any) => String(sp.code || sp.id));
  }, [data.specialties, specialties]);

  const filteredConsultationServices = useMemo(() => {
    if (!selectedSpecialtyCodes.length) return consultationServices;
    return consultationServices.filter((service: any) =>
      selectedSpecialtyCodes.includes(String(service.specialtyCode || '').trim())
    );
  }, [consultationServices, selectedSpecialtyCodes]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore draft errors
    }
  }, []);

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      setError('Draft saved locally.');
    } catch {
      setError('Unable to save draft.');
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const generateStaffId = () => {
    const id = `DOC-${Date.now().toString(36).toUpperCase()}`;
    setData((prev) => ({ ...prev, staffId: id }));
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setData((prev) => ({ ...prev, password }));
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(data.password || '');
      setError('Password copied to clipboard.');
    } catch {
      setError('Unable to copy password.');
    }
  };

  const toggleSelection = (value: string, list: string[]) => {
    if (list.includes(value)) {
      return list.filter((v) => v !== value);
    }
    return [...list, value];
  };

  const validateStep = (s: Step): boolean => {
    const nextErrors: Record<string, string> = {};
    if (s === 1) {
      if (!data.displayName) nextErrors.displayName = 'Display name is required.';
      if (!data.email) nextErrors.email = 'Email is required.';
      if (!data.staffId) nextErrors.staffId = 'Staff ID is required.';
      if (!data.licenseNumber) nextErrors.licenseNumber = 'License number is required.';
    }
    if (s === 2) {
      if (!data.primaryUnit) nextErrors.primaryUnit = 'Primary unit is required.';
      if (!data.clinics.length) nextErrors.clinics = 'At least one clinic is required.';
    }
    if (s === 3) {
      if (!data.workingDays.length) nextErrors.workingDays = 'Select working days.';
      if (!data.startTime) nextErrors.startTime = 'Start time is required.';
      if (!data.endTime) nextErrors.endTime = 'End time is required.';
    }
    if (s === 4) {
      if (!data.password || data.password.length < 12) {
        nextErrors.password = 'Password must be at least 12 characters.';
      }
    }
    if (data.breakStart && !data.breakEnd) {
      nextErrors.breakEnd = 'Break end time is required.';
    }
    if (data.breakEnd && !data.breakStart) {
      nextErrors.breakStart = 'Break start time is required.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/doctors/onboard', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create doctor');
      }
      setSuccess(result);
      clearDraft();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const primaryUnitName = units.find((u: any) => String(u.id) === String(data.primaryUnit))?.name || data.primaryUnit;
    const clinicNames = data.clinics
      .map((id) => clinics.find((c: any) => String(c.id) === String(id))?.name || id)
      .filter(Boolean);
    const specialtyNames = data.specialties
      .map((id) => specialties.find((s: any) => String(s.id) === String(id))?.name || id)
      .filter(Boolean);
    return {
      primaryUnitName,
      clinicNames,
      specialtyNames,
    };
  }, [data, units, clinics, specialties]);

  if (success) {
    const loginUrl = `${window.location.origin}/login`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(loginUrl)}`;
    return (
      <div className="min-h-screen py-10">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{tr('تم إنشاء حساب الطبيب', 'Doctor account created')}</h1>
              <p className="text-muted-foreground mt-1">{tr('تظهر بيانات الدخول مرة واحدة. احفظها بشكل آمن.', 'Credentials are shown once. Save them securely.')}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <div className="text-sm text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</div>
                <div className="font-medium text-foreground">{success?.credentials?.email || data.email}</div>
                <div className="text-sm text-muted-foreground mt-3">{tr('كلمة المرور', 'Password')}</div>
                <div className="font-medium text-foreground">{success?.credentials?.password || data.password}</div>
                <div className="text-sm text-muted-foreground mt-3">{tr('رقم الموظف', 'Staff ID')}</div>
                <div className="font-medium text-foreground">{success?.credentials?.staffId || data.staffId}</div>
              </div>
              <div className="rounded-lg border border-border p-4 flex flex-col items-center justify-center">
                <div className="text-sm text-muted-foreground mb-3">{tr('رمز QR لأول تسجيل دخول', 'First login QR')}</div>
                <img src={qrUrl} alt="QR code for login" className="w-40 h-40" />
                <div className="text-xs text-muted-foreground mt-3 break-all text-center">{loginUrl}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSuccess(null);
                  setData(INITIAL_DATA);
                  setStep(1);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {tr('إضافة طبيب آخر', 'Add Another Doctor')}
              </button>
              <button
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/50"
              >
                {tr('عرض قائمة الأطباء', 'View Doctor List')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
            ))}
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('اسم العرض *', 'Display name *')}</label>
                <input
                  value={data.displayName}
                  onChange={(e) => setData((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                />
                {errors.displayName && <p className="text-sm text-red-600 mt-1">{errors.displayName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('البريد الإلكتروني *', 'Email *')}</label>
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => setData((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('رقم الموظف *', 'Staff ID *')}</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={data.staffId}
                    onChange={(e) => setData((prev) => ({ ...prev, staffId: e.target.value }))}
                    className="flex-1 rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  <button
                    type="button"
                    onClick={generateStaffId}
                    className="px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted/50"
                  >
                    {tr('توليد تلقائي', 'Auto-generate')}
                  </button>
                </div>
                {errors.staffId && <p className="text-sm text-red-600 mt-1">{errors.staffId}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('رقم الترخيص *', 'License number *')}</label>
                <input
                  value={data.licenseNumber}
                  onChange={(e) => setData((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                />
                {errors.licenseNumber && <p className="text-sm text-red-600 mt-1">{errors.licenseNumber}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('الهوية الوطنية', 'National ID')}</label>
                  <input
                    value={data.nationalId}
                    onChange={(e) => setData((prev) => ({ ...prev, nationalId: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('الجوال', 'Mobile')}</label>
                  <input
                    value={data.mobile}
                    onChange={(e) => setData((prev) => ({ ...prev, mobile: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('التخصصات', 'Specialties')}</label>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {specialties.map((sp: any) => (
                    <label key={sp.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.specialties.includes(String(sp.id))}
                        onChange={() =>
                          setData((prev) => ({
                            ...prev,
                            specialties: toggleSelection(String(sp.id), prev.specialties),
                          }))
                        }
                      />
                      <span>{sp.name || sp.id}</span>
                    </label>
                  ))}
                  {!specialties.length && <p className="text-sm text-muted-foreground">{tr('لا توجد تخصصات.', 'No specialties found.')}</p>}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('مستوى الطبيب', 'Doctor level')}</label>
                  <select
                    value={data.level || 'CONSULTANT'}
                    onChange={(e) =>
                      setData((prev) => ({ ...prev, level: e.target.value as DoctorData['level'] }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground"
                  >
                    {levelOptions.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('كود خدمة الاستشارة', 'Consultation service code')}</label>
                  <select
                    value={data.consultationServiceCode || ''}
                    onChange={(e) => setData((prev) => ({ ...prev, consultationServiceCode: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground"
                  >
                    <option value="">{tr('اختر الكود (اختياري)', 'Select code (optional)')}</option>
                    {filteredConsultationServices.map((service: any) => {
                      const label = service.nameAr || service.nameEn || service.name || service.code;
                      return (
                        <option key={service.id} value={service.code}>
                          {service.code} - {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('نوع التوظيف', 'Employment type')}</label>
                <select
                  value={data.employmentType}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, employmentType: e.target.value as DoctorData['employmentType'] }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground"
                >
                  <option value="FULL_TIME">{tr('دوام كامل', 'Full time')}</option>
                  <option value="PART_TIME">{tr('دوام جزئي', 'Part time')}</option>
                  <option value="CONSULTANT">{tr('استشاري', 'Consultant')}</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('الوحدة الأساسية *', 'Primary unit *')}</label>
                <select
                  value={data.primaryUnit}
                  onChange={(e) => setData((prev) => ({ ...prev, primaryUnit: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground"
                >
                  <option value="">{tr('اختر الوحدة', 'Select unit')}</option>
                  {units.map((u: any) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name || u.id}
                    </option>
                  ))}
                </select>
                {errors.primaryUnit && <p className="text-sm text-red-600 mt-1">{errors.primaryUnit}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('العيادات *', 'Clinics *')}</label>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {clinics.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.clinics.includes(String(c.id))}
                        onChange={() =>
                          setData((prev) => ({
                            ...prev,
                            clinics: toggleSelection(String(c.id), prev.clinics),
                          }))
                        }
                      />
                      <span>{c.name || c.id}</span>
                    </label>
                  ))}
                  {!clinics.length && <p className="text-sm text-muted-foreground">{tr('لا توجد عيادات.', 'No clinics found.')}</p>}
                </div>
                {errors.clinics && <p className="text-sm text-red-600 mt-1">{errors.clinics}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('الغرف', 'Rooms')}</label>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {rooms.map((r: any) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.roomIds.includes(String(r.id))}
                        onChange={() =>
                          setData((prev) => ({
                            ...prev,
                            roomIds: toggleSelection(String(r.id), prev.roomIds),
                          }))
                        }
                      />
                      <span>{r.name || r.id}</span>
                    </label>
                  ))}
                  {!rooms.length && <p className="text-sm text-muted-foreground">{tr('لا توجد غرف.', 'No rooms found.')}</p>}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.canPrescribe}
                    onChange={(e) => setData((prev) => ({ ...prev, canPrescribe: e.target.checked }))}
                  />
                  <span>{tr('يمكنه الوصف الطبي', 'Can prescribe')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.canRequestImaging}
                    onChange={(e) => setData((prev) => ({ ...prev, canRequestImaging: e.target.checked }))}
                  />
                  <span>{tr('يمكنه طلب التصوير', 'Can request imaging')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.canPerformProcedures}
                    onChange={(e) => setData((prev) => ({ ...prev, canPerformProcedures: e.target.checked }))}
                  />
                  <span>{tr('يمكنه إجراء العمليات', 'Can perform procedures')}</span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('أيام العمل *', 'Working days *')}</label>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {dayLabels.map((day) => (
                    <label key={day.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={data.workingDays.includes(day.id)}
                        onChange={() =>
                          setData((prev) => ({
                            ...prev,
                            workingDays: prev.workingDays.includes(day.id)
                              ? prev.workingDays.filter((d) => d !== day.id)
                              : [...prev.workingDays, day.id].sort(),
                          }))
                        }
                      />
                      <span>{getDayLabel(day.id)}</span>
                    </label>
                  ))}
                </div>
                {errors.workingDays && <p className="text-sm text-red-600 mt-1">{errors.workingDays}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('وقت البداية *', 'Start time *')}</label>
                  <input
                    type="time"
                    value={data.startTime}
                    onChange={(e) => setData((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  {errors.startTime && <p className="text-sm text-red-600 mt-1">{errors.startTime}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('وقت النهاية *', 'End time *')}</label>
                  <input
                    type="time"
                    value={data.endTime}
                    onChange={(e) => setData((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  {errors.endTime && <p className="text-sm text-red-600 mt-1">{errors.endTime}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('مدة الموعد', 'Appointment duration')}</label>
                  <select
                    value={data.appointmentDuration}
                    onChange={(e) => setData((prev) => ({ ...prev, appointmentDuration: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground"
                  >
                    {[10, 15, 20, 30].map((m) => (
                      <option key={m} value={m}>
                        {m} {tr('دقيقة', 'min')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('بداية الاستراحة', 'Break start')}</label>
                  <input
                    type="time"
                    value={data.breakStart}
                    onChange={(e) => setData((prev) => ({ ...prev, breakStart: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  {errors.breakStart && <p className="text-sm text-red-600 mt-1">{errors.breakStart}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('نهاية الاستراحة', 'Break end')}</label>
                  <input
                    type="time"
                    value={data.breakEnd}
                    onChange={(e) => setData((prev) => ({ ...prev, breakEnd: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  {errors.breakEnd && <p className="text-sm text-red-600 mt-1">{errors.breakEnd}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('البريد الإلكتروني', 'Email')}</label>
                <input
                  value={data.email}
                  disabled
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-muted/50 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{tr('كلمة المرور *', 'Password *')}</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={data.password}
                    onChange={(e) => setData((prev) => ({ ...prev, password: e.target.value }))}
                    className="flex-1 rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted/50"
                  >
                    {tr('توليد تلقائي', 'Auto-generate')}
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="px-3 py-2 rounded-xl border border-border text-foreground hover:bg-muted/50"
                  >
                    {tr('نسخ', 'Copy')}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground">{tr('الدور', 'Role')}</label>
                  <input
                    value={data.role}
                    onChange={(e) => setData((prev) => ({ ...prev, role: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 bg-card text-foreground thea-input-focus"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm mt-6">
                  <input
                    type="checkbox"
                    checked={data.sendWelcomeEmail}
                    onChange={(e) => setData((prev) => ({ ...prev, sendWelcomeEmail: e.target.checked }))}
                  />
                  <span>{tr('إرسال رسالة ترحيب', 'Send welcome email')}</span>
                </label>
              </div>
              <div className="rounded-lg border border-border p-4 bg-muted/50">
                <h3 className="text-sm font-semibold text-foreground mb-2">{tr('الملخص', 'Summary')}</h3>
                <div className="text-sm text-foreground space-y-1">
                  <div>{tr('الطبيب', 'Doctor')}: {data.displayName || '—'}</div>
                  <div>{tr('رقم الموظف', 'Staff ID')}: {data.staffId || '—'}</div>
                  <div>{tr('الوحدة الرئيسية', 'Primary unit')}: {summary.primaryUnitName || '—'}</div>
                  <div>{tr('العيادات', 'Clinics')}: {summary.clinicNames.length ? summary.clinicNames.join(', ') : '—'}</div>
                  <div>{tr('التخصصات', 'Specialties')}: {summary.specialtyNames.length ? summary.specialtyNames.join(', ') : '—'}</div>
                  <div>{tr('الجدول', 'Schedule')}: {data.startTime} - {data.endTime}</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-between mt-6 pt-6 border-t border-border gap-3">
            <button
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              disabled={step === 1}
              className="px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {tr('رجوع', 'Back')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={saveDraft}
                className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted/50"
              >
                {tr('حفظ كمسودة', 'Save as Draft')}
              </button>
              {step < 4 ? (
                <button
                  onClick={() => {
                    if (validateStep(step)) {
                      setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
                    }
                  }}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90"
                >
                  {tr('التالي', 'Next')}
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !validateStep(4)}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? tr('جارٍ الإنشاء...', 'Creating...') : tr('إنشاء حساب طبيب', 'Create Doctor Account')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
