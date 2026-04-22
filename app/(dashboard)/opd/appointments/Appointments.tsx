'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';
import { safeUUID } from '@/lib/utils/uuid';
import { toast } from '@/hooks/use-toast';
import { formatTimeRange } from '@/lib/time/format';
import { InvoiceScreen, InvoicePatient, InvoiceContext } from '@/components/billing/InvoiceScreen';
import type { PaymentMethod } from '@/components/billing/PaymentMethods';
import { WalkInDialog } from '@/components/billing/WalkInDialog';
import { Calendar as CalendarIcon, UserPlus, X, RefreshCw, MessageSquare, CheckSquare, BarChart3, CheckCircle2, ClipboardList, Ban, Users, Lock, Search, AlertTriangle, CreditCard, CalendarDays } from 'lucide-react';
import dynamic from 'next/dynamic';
const BulkBookingActions = dynamic(() => import('@/components/opd/BulkBookingActions'), { ssr: false });
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAge } from '@/lib/opd/ui-helpers';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((res) => res.json());

type BookingType = 'PATIENT' | 'BLOCK';
type SearchType = 'mrn' | 'nationalId' | 'mobile' | 'name';

const DISPLAY_TZ = 'Asia/Riyadh' as const;

/** Format Date to YYYY-MM-DD using local date (avoids timezone off-by-one) */
const toDateOnly = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
/** Parse YYYY-MM-DD to Date at local midnight */
const fromDateOnly = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatBookingRange = (startAt?: string | null, endAt?: string | null) =>
  formatTimeRange(startAt, endAt, DISPLAY_TZ);

const formatSlotTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TZ,
  });
};

function getRiyadhHour(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const hh = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: DISPLAY_TZ }).format(d);
  const n = Number(hh);
  return Number.isFinite(n) ? n : null;
}

const isToday = (dateStr: string | Date): boolean => {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const isPastDate = (dateStr: string | Date): boolean => {
  const date = new Date(dateStr);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isFutureDate = (dateStr: string | Date): boolean => {
  const date = new Date(dateStr);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date > today;
};

const getAppointmentDateStatus = (dateStr: string | Date): 'today' | 'past' | 'future' => {
  if (isToday(dateStr)) return 'today';
  if (isPastDate(dateStr)) return 'past';
  return 'future';
};

const formatRelativeDate = (dateStr: string | Date, language: 'ar' | 'en' = 'en'): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return language === 'ar' ? 'اليوم' : 'Today';
  if (diffDays === 1) return language === 'ar' ? 'غداً' : 'Tomorrow';
  if (diffDays === -1) return language === 'ar' ? 'أمس' : 'Yesterday';
  if (diffDays > 1) return language === 'ar' ? `بعد ${diffDays} أيام` : `In ${diffDays} days`;
  if (diffDays < -1) return language === 'ar' ? `قبل ${Math.abs(diffDays)} أيام` : `${Math.abs(diffDays)} days ago`;
  return '';
};

function slotStatus(slot: any): 'OPEN' | 'BOOKED' | 'HELD' | 'BLOCKED' {
  if (slot.status === 'BLOCKED') return 'BLOCKED';
  if (slot.reservation?.reservationType === 'HOLD') return 'HELD';
  if (slot.reservation) return 'BOOKED';
  return 'OPEN';
}

/** True if slot start time has passed (cannot book past slots) */
function isSlotInPast(slot: any): boolean {
  const start = slot?.startAt ? new Date(slot.startAt).getTime() : 0;
  return start > 0 && start < Date.now();
}

/** Slot is bookable only if OPEN and not in the past */
function isSlotBookable(slot: any): boolean {
  return slotStatus(slot) === 'OPEN' && !isSlotInPast(slot);
}

function bookingStatus(b: any): string {
  if (b.bookingType === 'BLOCK') return 'BLOCKED';
  if (b.status === 'NO_SHOW' || b.opd?.arrivalState === 'NO_SHOW') return 'NO_SHOW';
  if (b.encounter?.status === 'CLOSED' || b.opd?.status === 'COMPLETED') return 'COMPLETED';
  if (b.opd?.arrivalState === 'LEFT') return 'LEFT';
  if (b.opd?.opdFlowState && ['IN_DOCTOR', 'IN_NURSING'].includes(b.opd.opdFlowState)) return 'IN_PROGRESS';
  // CHECKED_IN overrides PENDING_PAYMENT: if encounter exists the patient physically arrived
  if (b.encounterCoreId) return 'CHECKED_IN';
  if (b.payment?.status === 'PENDING' || b.status === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  return 'BOOKED';
}

const STATUS_CONFIG: Record<string, { color: string; dot: string; labelAr: string; labelEn: string }> = {
  BOOKED: { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', labelAr: 'محجوز', labelEn: 'Booked' },
  PENDING_PAYMENT: { color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', labelAr: 'بانتظار الدفع', labelEn: 'Pending Payment' },
  CHECKED_IN: { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', labelAr: 'وصل', labelEn: 'Checked In' },
  IN_PROGRESS: { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', labelAr: 'جاري', labelEn: 'In Progress' },
  COMPLETED: { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', labelAr: 'مكتمل', labelEn: 'Completed' },
  NO_SHOW: { color: 'bg-red-100 text-red-700', dot: 'bg-red-500', labelAr: 'لم يحضر', labelEn: 'No Show' },
  LEFT: { color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', labelAr: 'غادر', labelEn: 'Left' },
  BLOCKED: { color: 'bg-red-100 text-red-700', dot: 'bg-red-500', labelAr: 'محظور', labelEn: 'Blocked' },
};

const SLOT_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  BOOKED: 'bg-blue-50 border-blue-200',
  HELD: 'bg-amber-50 border-amber-200',
  BLOCKED: 'bg-red-50 border-red-200',
};

export default function Appointments() {
  const { isRTL, language } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/opd/appointments');
  const { me } = useMe();
  const userPermissions: string[] = me?.user?.permissions ?? [];
  const userRole: string = me?.user?.role ?? '';
  // Reception roles + admin can create/cancel bookings
  const BOOKING_ROLES = ['admin', 'reception', 'reception-staff', 'reception-supervisor', 'reception-admin', 'opd-reception'];
  const canBook = BOOKING_ROLES.includes(userRole) || userPermissions.includes('opd.booking.create');
  const canCancel = BOOKING_ROLES.includes(userRole) || userPermissions.includes('opd.booking.cancel') || userPermissions.includes('opd.booking.create');
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = toDateOnly(new Date());
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const urlDate = searchParams.get('date');
  const urlResourceId = searchParams.get('resourceId') || '';

  const [specialtyId, setSpecialtyId] = useState('');
  const [resourceId, setResourceId] = useState(urlResourceId);
  const [clinicId, setClinicId] = useState('');
  const [date, setDate] = useState(urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : today);
  const [dateOpen, setDateOpen] = useState(false);

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [anchorSlotId, setAnchorSlotId] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<BookingType>('PATIENT');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const [searchType, setSearchType] = useState<SearchType>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [showInvoice, setShowInvoice] = useState(false);
  const [invoicePatient, setInvoicePatient] = useState<InvoicePatient | null>(null);
  const [invoiceContext, setInvoiceContext] = useState<InvoiceContext | null>(null);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [walkInPatient, setWalkInPatient] = useState<any | null>(null);
  const [showWalkInAssign, setShowWalkInAssign] = useState(false);
  const [walkInClinicId, setWalkInClinicId] = useState('');
  const [walkInSpecialtyId, setWalkInSpecialtyId] = useState('');
  const [walkInResourceId, setWalkInResourceId] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [reschedulePatient, setReschedulePatient] = useState<any | null>(null);
  const [highlightBookingId, setHighlightBookingId] = useState<string | null>(null);
  const [sendingSmsFor, setSendingSmsFor] = useState<string | null>(null);

  const { data: metadata } = useSWR(hasPermission ? '/api/opd/booking/metadata' : null, fetcher);
  const specialties = Array.isArray(metadata?.specialties) ? metadata.specialties : [];
  const clinics = Array.isArray(metadata?.clinics) ? metadata.clinics : [];
  const providers = Array.isArray(metadata?.providers) ? metadata.providers : [];

  const { data: slotsData, mutate: mutateSlots } = useSWR(
    resourceId && date ? `/api/opd/booking/slots?resourceId=${resourceId}&date=${date}` : null,
    fetcher
  );
  const slots = Array.isArray(slotsData?.items) ? slotsData.items : [];

  const { data: summaryData, mutate } = useSWR(
    resourceId && date ? `/api/opd/booking/list?resourceId=${resourceId}&date=${date}` : null,
    fetcher
  );
  const bookings = Array.isArray(summaryData?.items) ? summaryData.items : [];

  const { data: templatesData } = useSWR(
    resourceId ? `/api/scheduling/templates?resourceId=${resourceId}` : null,
    fetcher
  );
  const templates = Array.isArray(templatesData?.items) ? templatesData.items : [];

  // Hierarchy: Clinic → Specialty → Doctor
  const specialtiesUnderClinic = useMemo(() => {
    if (!clinicId) return [];
    const clinic = clinics.find((c: any) => c.id === clinicId);
    if (!clinic?.specialtyId) return specialties;
    return specialties.filter((s: any) => s.id === clinic.specialtyId);
  }, [clinics, clinicId, specialties]);

  const filteredProviders = useMemo(() => {
    if (!clinicId || !specialtyId) return [];
    const primary = (p: any) => p.primaryClinicId;
    const parallel = (p: any) => Array.isArray(p.parallelClinicIds) ? p.parallelClinicIds : [];
    const hasAssignment = (p: any) => primary(p) || parallel(p).length > 0;
    const worksAtClinic = (p: any) =>
      hasAssignment(p) ? primary(p) === clinicId || parallel(p).includes(clinicId) : true;
    const specialtyIds = (p: any) => (Array.isArray(p.specialtyIds) ? p.specialtyIds : []);
    const hasSpecialty = (p: any) => specialtyIds(p).some((id: string) => String(id) === String(specialtyId));

    return providers.filter((provider: any) => {
      const matchSpecialty = hasSpecialty(provider);
      const matchClinic = worksAtClinic(provider);
      // Show when: (has specialty AND works at clinic) OR (works at clinic with no specialtyIds - incomplete profile fallback)
      return matchClinic && (matchSpecialty || specialtyIds(provider).length === 0);
    });
  }, [providers, clinicId, specialtyId]);

  const walkInSpecialties = useMemo(() => {
    if (!walkInClinicId) return specialties;
    const clinic = clinics.find((c: any) => c.id === walkInClinicId);
    if (!clinic?.specialtyId) return specialties;
    const filtered = specialties.filter((s: any) => s.id === clinic.specialtyId);
    // Auto-select if only one specialty matches
    if (filtered.length === 1 && walkInSpecialtyId !== filtered[0].id) {
      setTimeout(() => setWalkInSpecialtyId(filtered[0].id), 0);
    }
    return filtered;
  }, [clinics, walkInClinicId, specialties, walkInSpecialtyId]);

  const walkInProviders = useMemo(() => {
    const effSpec = walkInSpecialtyId || (walkInSpecialties.length === 1 ? walkInSpecialties[0].id : '');
    if (!walkInClinicId || !effSpec) return [];
    return providers.filter((p: any) => {
      const primary = p.primaryClinicId;
      const parallel = Array.isArray(p.parallelClinicIds) ? p.parallelClinicIds : [];
      const hasAssignment = primary || parallel.length > 0;
      const worksAtClinic = hasAssignment ? (primary === walkInClinicId || parallel.includes(walkInClinicId)) : true;
      const specIds = Array.isArray(p.specialtyIds) ? p.specialtyIds : [];
      const matchSpec = specIds.some((id: string) => String(id) === String(effSpec));
      return worksAtClinic && (matchSpec || specIds.length === 0);
    });
  }, [providers, walkInClinicId, walkInSpecialtyId, walkInSpecialties]);

  const activeTemplates = useMemo(
    () => templates.filter((t: any) => String(t.status || '').toUpperCase() === 'ACTIVE'),
    [templates]
  );

  const normalizeDateOnly = (input: string | Date) => {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const normalizeDays = (days: any) =>
    Array.isArray(days)
      ? days
          .map((d: any) => Number(d))
          .filter((d: number) => Number.isFinite(d) && d >= 0 && d <= 6)
      : [];

  const isDateAvailable = (value: Date) => {
    if (!resourceId) return false;
    if (!activeTemplates.length) return false;
    const day = value.getDay();
    const target = normalizeDateOnly(value);
    if (!target) return false;
    return activeTemplates.some((t: any) => {
      const days = normalizeDays(t.daysOfWeek);
      if (!days.includes(day)) return false;
      const from = t.effectiveFrom ? normalizeDateOnly(t.effectiveFrom) : null;
      const to = t.effectiveTo ? normalizeDateOnly(t.effectiveTo) : null;
      if (from && target < from) return false;
      if (to && target > to) return false;
      return true;
    });
  };

  const findNextAvailableDate = (start: Date) => {
    const next = new Date(start);
    next.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i += 1) {
      if (isDateAvailable(next)) return next;
      next.setDate(next.getDate() + 1);
    }
    return null;
  };

  // URL prefilling: when resourceId comes from URL and clinic not yet set, derive clinic + specialty from provider
  useEffect(() => {
    if (!urlResourceId || clinicId || !providers.length || !clinics.length) return;
    const provider = providers.find((p: any) => p.resourceId === urlResourceId);
    if (!provider) return;
    const targetClinicId = provider.primaryClinicId || provider.parallelClinicIds?.[0];
    if (!targetClinicId) return;
    const clinic = clinics.find((c: any) => c.id === targetClinicId);
    const targetSpecialtyId = clinic?.specialtyId || provider.specialtyIds?.[0];
    setClinicId(targetClinicId);
    if (targetSpecialtyId) setSpecialtyId(targetSpecialtyId);
  }, [clinicId, urlResourceId, providers.length, clinics.length]);

  // Doctor's schedule: when logged-in user is a doctor (has myResource), auto-select their schedule
  const myResource = metadata?.myResource;
  useEffect(() => {
    if (!myResource?.resourceId || urlResourceId) return; // Skip if URL already has resourceId
    if (myResource.clinicId) setClinicId(myResource.clinicId);
    if (myResource.specialtyId) setSpecialtyId(myResource.specialtyId);
    setResourceId(myResource.resourceId);
  }, [myResource?.resourceId, myResource?.clinicId, myResource?.specialtyId, urlResourceId]);

  useEffect(() => {
    setSelectedSlots([]);
    setAnchorSlotId(null);
  }, [resourceId, date]);

  useEffect(() => {
    if (!resourceId) return;
    const current = new Date(date);
    if (Number.isNaN(current.getTime()) || isDateAvailable(current)) return;
    const next = findNextAvailableDate(current);
    if (next) {
      setDate(toDateOnly(next));
      toast({ title: tr('تم اختيار أول يوم متاح', 'First available day selected') });
    }
  }, [resourceId, templates, date]);

  const sortedSlots = useMemo(() => {
    return [...slots].sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
  }, [slots]);

  const slotsByHour = useMemo(() => {
    const groups: Record<number, any[]> = {};
    sortedSlots.forEach((slot: any) => {
      const hour = getRiyadhHour(String(slot.startAt || ''));
      if (hour === null) return;
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(slot);
    });
    return groups;
  }, [sortedSlots]);

  const patientBookings = useMemo(
    () =>
      [...bookings]
        .filter((b: any) => b.bookingType === 'PATIENT')
        .sort((a: any, b: any) => String(a.startAt || '').localeCompare(String(b.startAt || ''))),
    [bookings]
  );

  const blockBookings = useMemo(() => bookings.filter((b: any) => b.bookingType === 'BLOCK'), [bookings]);

  const bookingBySlotId = useMemo(() => {
    const m: Record<string, any> = {};
    for (const b of bookings) {
      for (const sid of b.slotIds || []) {
        m[String(sid)] = b;
      }
    }
    return m;
  }, [bookings]);

  const formatBookingTooltip = (b: any) => {
    if (!b) return '';
    const created = b.createdAt ? new Date(b.createdAt) : null;
    const dateStr = created ? toDateOnly(created) : '';
    const timeStr = created ? created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: DISPLAY_TZ }) : '';
    const empName = (b.createdByName || b.createdBy || '').trim();
    const staffId = (b.createdByStaffId || '').trim();
    const parts: string[] = [];
    if (empName) parts.push(`${tr('الموظف', 'Employee')}: ${empName}`);
    if (staffId) parts.push(`${tr('الرقم الوظيفي', 'Staff ID')}: ${staffId}`);
    if (dateStr && timeStr) parts.push(`${tr('وقت الحجز', 'Booked at')}: ${dateStr} ${timeStr}`);
    return parts.join('\n');
  };

  const stats = useMemo(() => {
    const total = sortedSlots.length;
    const open = sortedSlots.filter((s: any) => slotStatus(s) === 'OPEN').length;
    const booked = sortedSlots.filter((s: any) => slotStatus(s) === 'BOOKED').length;
    const blocked = sortedSlots.filter((s: any) => slotStatus(s) === 'BLOCKED').length;
    const held = sortedSlots.filter((s: any) => slotStatus(s) === 'HELD').length;
    const patients = patientBookings.length;
    const checkedIn = patientBookings.filter((b: any) => bookingStatus(b) !== 'BOOKED').length;
    return { total, open, booked, blocked, held, patients, checkedIn };
  }, [sortedSlots, patientBookings]);

  const handleSlotClick = (slot: any, index: number, shiftKey: boolean) => {
    if (!isSlotBookable(slot)) {
      const booking = bookingBySlotId[slot.id];
      if (booking?.id) scrollToBooking(booking.id);
      return;
    }
    // Block booking actions for users without opd.booking.create permission
    if (!canBook) return;

    if (shiftKey && anchorSlotId) {
      const anchorIndex = sortedSlots.findIndex((s) => s.id === anchorSlotId);
      if (anchorIndex >= 0) {
        const [start, end] = anchorIndex < index ? [anchorIndex, index] : [index, anchorIndex];
        const rangeIds = sortedSlots
          .slice(start, end + 1)
          .filter((s) => isSlotBookable(s))
          .map((s) => s.id);
        setSelectedSlots(rangeIds);
        return;
      }
    }

    setAnchorSlotId(slot.id);
    setSelectedSlots((prev) => {
      if (prev.includes(slot.id)) return prev.filter((id) => id !== slot.id);
      return [...prev, slot.id];
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: tr('أدخل قيمة للبحث', 'Enter a search value') });
      return;
    }
    setSearching(true);
    setSelectedPatient(null);
    try {
      const params = new URLSearchParams();
      if (searchType === 'mrn') params.set('mrn', searchQuery.trim());
      if (searchType === 'nationalId') params.set('nationalId', searchQuery.trim());
      if (searchType === 'mobile') params.set('mobile', searchQuery.trim());
      if (searchType === 'name') params.set('q', searchQuery.trim());
      params.set('limit', '20');
      const res = await fetch(`/api/patients/search?${params.toString()}`, { credentials: 'include' });
      const payload = await res.json();
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل البحث', 'Search failed') });
        return;
      }
      if (payload?.code === 'NO_MATCH_MOBILE') {
        toast({ title: tr('لم يتم العثور على مطابقة لرقم الجوال', 'No mobile matches found') });
      }
      setSearchResults(Array.isArray(payload?.items) ? payload.items : []);
    } finally {
      setSearching(false);
    }
  };

  const submitBooking = async () => {
    if (bookingType === 'PATIENT' && !selectedPatient) {
      toast({ title: tr('اختر مريضاً', 'Select a patient') });
      return;
    }
    if (!clinicId) {
      toast({ title: tr('اختر عيادة', 'Select a clinic') });
      return;
    }
    if (bookingType === 'BLOCK' && !blockReason.trim()) {
      toast({ title: tr('سبب الحظر مطلوب', 'Block reason is required') });
      return;
    }
    const pastSlots = selectedSlots.filter((id) => {
      const s = sortedSlots.find((x) => x.id === id);
      return s && isSlotInPast(s);
    });
    if (pastSlots.length > 0) {
      toast({ title: tr('لا يمكن الحجز للفترات الماضية', 'Cannot book past time slots'), variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/opd/booking/create', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId,
          clinicId,
          bookingType,
          slotIds: selectedSlots,
          patientMasterId: bookingType === 'PATIENT' ? selectedPatient?.id : undefined,
          reason: bookingType === 'BLOCK' ? blockReason.trim() : undefined,
          clientRequestId: safeUUID(),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast({ title: payload?.error || tr('فشل الحجز', 'Booking failed') });
        return;
      }
      toast({ title: tr('تم إنشاء الحجز', 'Booking created') });
      setConfirmOpen(false);
      setSelectedSlots([]);
      setAnchorSlotId(null);
      setBlockReason('');
      setSearchResults([]);
      setSearchQuery('');
      setSelectedPatient(null);
      setReschedulePatient(null);
      mutateSlots();
      mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (booking: any) => {
    const appointmentDate = booking.slotStart || booking.startAt || booking.date;
    if (!appointmentDate) {
      toast({ title: tr('خطأ', 'Error'), description: tr('لا يوجد تاريخ للموعد', 'Appointment date is missing'), variant: 'destructive' });
      return;
    }

    const dateStatus = getAppointmentDateStatus(appointmentDate);

    if (dateStatus === 'future') {
      toast({
        title: tr('لا يمكن تسجيل الحضور', 'Cannot check in'),
        description: language === 'ar'
          ? `الموعد ${formatRelativeDate(appointmentDate, language)}. يرجى الانتظار حتى يوم الموعد.`
          : `Appointment is ${formatRelativeDate(appointmentDate, language)}. Please wait until appointment day.`,
        variant: 'destructive',
      });
      return;
    }

    if (dateStatus === 'past') {
      toast({
        title: tr('انتهى الموعد', 'Appointment has passed'),
        description: language === 'ar'
          ? `هذا الموعد كان ${formatRelativeDate(appointmentDate, language)} ولا يمكن تسجيل الحضور.`
          : `This appointment was ${formatRelativeDate(appointmentDate, language)} and cannot be checked in.`,
        variant: 'destructive',
      });
      const markNoShow = confirm(tr('هل تريد تسجيل المريض كـ "لم يحضر"؟', 'Mark patient as no-show?'));
      if (markNoShow) {
        await handleMarkNoShow(booking.id);
      }
      return;
    }

    setProcessing(true);
    try {
      const patientId = String(booking.patientMasterId || booking.patient?.id || '').trim();
      if (!patientId) throw new Error('Missing patient id');

      let patientData = booking.patient || null;
      if (!patientData) {
        try {
          const patientRes = await fetch(`/api/patient-profile/${patientId}`, { credentials: 'include' });
          if (patientRes.ok) {
            const patientPayload = await patientRes.json().catch(() => ({}));
            patientData = patientPayload?.patient || null;
          } else if (patientRes.status === 404) {
            const fallbackRes = await fetch(`/api/patients/${patientId}`, { credentials: 'include' });
            if (fallbackRes.ok) {
              const fallbackPayload = await fallbackRes.json().catch(() => ({}));
              patientData = fallbackPayload?.patient || fallbackPayload || null;
            }
          } else {
            const patientPayload = await patientRes.json().catch(() => ({}));
            throw new Error(patientPayload?.error || 'Failed to load patient');
          }
        } catch (error) {
          console.error('Failed to load patient profile:', error);
          toast({ title: tr('تعذّر جلب بيانات المريض', 'Failed to load patient profile'), variant: 'destructive' });
        }
      }

      let isFirstVisit = true;
      try {
        const visitHistoryRes = await fetch(
          `/api/patients/${patientId}/visits/count?providerId=${encodeURIComponent(String(booking.resourceId || ''))}`
        , { credentials: 'include' });
        if (visitHistoryRes.ok) {
          const visitHistory = await visitHistoryRes.json().catch(() => ({}));
          isFirstVisit = (visitHistory.count || 0) === 0;
        }
      } catch (error) {
        console.error('Failed to load visit history:', error);
      }

      const patient: InvoicePatient = {
        id: patientId,
        mrn: patientData?.mrn || patientData?.fileNumber || patientData?.links?.find((link: any) => link?.mrn)?.mrn || '—',
        fullName: patientData?.fullName || [patientData?.firstNameAr, patientData?.middleNameAr, patientData?.lastNameAr].filter(Boolean).join(' ') || [patientData?.firstName, patientData?.middleName, patientData?.lastName].filter(Boolean).join(' ') || tr('غير معروف', 'Unknown'),
        nationalId: patientData?.nationalId || patientData?.identifiers?.nationalId,
        phone: patientData?.phone,
        insurancePolicyNumber: patientData?.insurancePolicyNumber,
        insuranceCompanyId: patientData?.insuranceCompanyId,
        insuranceCompanyName: patientData?.insuranceCompanyName,
        insurancePlanId: patientData?.insurancePlanId,
        insuranceExpiryDate: patientData?.insuranceExpiryDate,
      };

      const context: InvoiceContext = {
        type: 'visit',
        visitId: booking.visitId || booking.encounterCoreId || undefined,
        encounterId: booking.encounterCoreId || undefined,
        providerId: booking.resourceId,
        providerName: booking.resourceName,
        specialtyCode: booking.specialtyCode,
        specialtyName: booking.specialtyName,
        isFirstVisit,
      };

      if (booking.status !== 'PENDING_PAYMENT') {
        try {
          await fetch(`/api/opd/booking/${booking.id}/status`, {
            credentials: 'include',
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PENDING_PAYMENT' }),
          });
          mutate();
        } catch (error) {
          console.error('Failed to set pending payment:', error);
        }
      }

      setInvoicePatient(patient);
      setInvoiceContext(context);
      setPendingBookingId(booking.id);
      setShowInvoice(true);
    } catch (err: any) {
      toast({ title: err?.message || tr('فشل تجهيز الفاتورة', 'Failed to prepare invoice'), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkNoShow = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/opd/booking/${bookingId}/status`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'NO_SHOW' }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast({ title: tr('تم تسجيل عدم الحضور', 'No-show recorded') });
      mutate();
    } catch (error) {
      toast({ title: tr('خطأ في تحديث الحالة', 'Status update failed'), variant: 'destructive' });
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    if (!canCancel) return;
    setCancelBookingId(bookingId);
    setCancelReason('');
    setCancelOpen(true);
  };

  const handleReschedule = async (booking: any) => {
    const patient = booking.patient;
    if (!patient) {
      toast({ title: tr('بيانات المريض غير متوفرة', 'Patient data not available'), variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch('/api/opd/booking/cancel', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, reason: tr('تأجيل الموعد', 'Rescheduled') }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || tr('فشل الإلغاء', 'Cancel failed'));
      }
      toast({ title: tr('تم إلغاء الموعد السابق — اختر فترات جديدة للحجز', 'Previous booking cancelled — select new slots to rebook') });
      setReschedulePatient(patient);
      setSelectedPatient(patient);
      setSelectedSlots([]);
      setAnchorSlotId(null);
      setBookingType('PATIENT');
      mutate();
      mutateSlots();
    } catch (err: any) {
      toast({ title: err?.message || tr('فشل التأجيل', 'Reschedule failed'), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendConfirmation = async (booking: any) => {
    setSendingSmsFor(booking.id);
    try {
      const res = await fetch(`/api/opd/booking/${booking.id}/send-confirmation`, {
        credentials: 'include',
        method: 'POST',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || tr('فشل الإرسال', 'Send failed'));
      toast({ title: tr('تم إرسال رسالة التأكيد بنجاح', 'Confirmation SMS sent successfully') });
    } catch (err: any) {
      toast({ title: err?.message || tr('فشل إرسال الرسالة', 'Failed to send SMS'), variant: 'destructive' });
    } finally {
      setSendingSmsFor(null);
    }
  };

  const scrollToBooking = (bookingId: string) => {
    setHighlightBookingId(bookingId);
    const el = document.getElementById(`booking-${bookingId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => setHighlightBookingId(null), 2000);
  };

  const handleWalkIn = async (patient: any, isNewPatient: boolean) => {
    if (isNewPatient) {
      router.push('/opd/registration?walkin=true');
      return;
    }

    // Step 1 done (patient selected) → show assignment step
    setWalkInPatient(patient);
    setShowWalkIn(false);
    setWalkInClinicId(clinicId || '');
    setWalkInSpecialtyId(specialtyId || '');
    setWalkInResourceId(resourceId || '');
    setShowWalkInAssign(true);
  };

  const handleWalkInAssignConfirm = async () => {
    if (!walkInPatient || !walkInClinicId || !walkInResourceId) {
      toast({ title: tr('يجب اختيار القسم والدكتور', 'Please select clinic and doctor'), variant: 'destructive' as const });
      return;
    }

    setProcessing(true);
    try {
      const patient = walkInPatient;
      const patientData: InvoicePatient = {
        id: patient.id,
        mrn: patient.mrn || patient.fileNumber || '—',
        fullName: patient.fullName || [patient.firstNameAr, patient.middleNameAr, patient.lastNameAr].filter(Boolean).join(' ') || tr('مريض', 'Patient'),
        nationalId: patient.nationalId,
        phone: patient.phone,
        insurancePolicyNumber: patient.insurancePolicyNumber,
        insuranceCompanyId: patient.insuranceCompanyId,
        insuranceCompanyName: patient.insuranceCompanyName,
        insurancePlanId: patient.insurancePlanId,
        insuranceExpiryDate: patient.insuranceExpiryDate,
      };

      let isFirstVisit = true;
      try {
        const visitHistoryRes = await fetch(`/api/patients/${patient.id}/visits/count`, { credentials: 'include' });
        const visitHistory = await visitHistoryRes.json().catch(() => ({}));
        isFirstVisit = (visitHistory.count || 0) === 0;
      } catch {
        isFirstVisit = true;
      }

      const selectedProvider = providers.find((p: any) => p.resourceId === walkInResourceId);
      const selectedClinic = clinics.find((c: any) => c.id === walkInClinicId);
      const selectedSpec = specialties.find((s: any) => s.id === walkInSpecialtyId);

      const context: InvoiceContext = {
        type: 'visit',
        isFirstVisit,
        clinicId: walkInClinicId,
        resourceId: walkInResourceId,
        providerId: walkInResourceId,
        providerName: selectedProvider?.name || selectedProvider?.nameAr || '',
        specialtyCode: selectedSpec?.code || '',
        specialtyName: selectedSpec?.name || selectedSpec?.nameAr || '',
      };

      setInvoicePatient(patientData);
      setInvoiceContext(context);
      setPendingBookingId(null);
      setShowWalkInAssign(false);
      setShowInvoice(true);
    } catch (err: any) {
      toast({ title: err?.message || tr('خطأ', 'Error'), variant: 'destructive' as const });
    } finally {
      setProcessing(false);
    }
  };

  const handleInvoiceComplete = async (
    invoiceId: string,
    paymentStatus: 'PAID' | 'PENDING',
    paymentDetails?: { amount: number; method: PaymentMethod; reference?: string }
  ) => {
    try {
      const serviceType = invoiceContext?.isFirstVisit ? 'CONSULTATION' : 'FOLLOW_UP';
      const method = paymentDetails?.method === 'BANK_TRANSFER' ? 'ONLINE' : paymentDetails?.method;

      if (pendingBookingId) {
        const res = await fetch('/api/opd/booking/check-in', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: pendingBookingId,
            payment: { status: paymentStatus, serviceType, paidAt: new Date().toISOString(), amount: paymentDetails?.amount, method, reference: paymentDetails?.reference, invoiceId },
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || payload?.message || tr('فشل تسجيل الوصول', 'Check-in failed'));
        toast({ title: tr('تم تسجيل الوصول والدفع بنجاح', 'Check-in and payment completed') });
      } else if (invoicePatient) {
        const res = await fetch('/api/opd/booking/walk-in', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientMasterId: invoicePatient.id,
            clinicId: invoiceContext?.clinicId || null,
            resourceId: invoiceContext?.resourceId || null,
            priority: 'NORMAL',
            payment: { status: paymentStatus, serviceType, paidAt: new Date().toISOString(), amount: paymentDetails?.amount, method, reference: paymentDetails?.reference, invoiceId },
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || 'Failed to add to waiting list');
        toast({ title: tr('تم إضافة المريض لقائمة الانتظار', 'Patient added to waiting list') });
      }

      mutate();
    } catch (error: any) {
      toast({ title: error?.message || 'خطأ في تسجيل الوصول', variant: 'destructive' });
    } finally {
      setShowInvoice(false);
      setInvoicePatient(null);
      setInvoiceContext(null);
      setPendingBookingId(null);
    }
  };

  const handleInvoiceCancel = () => {
    setShowInvoice(false);
    setInvoicePatient(null);
    setInvoiceContext(null);
    setPendingBookingId(null);
  };

  const submitCancel = async () => {
    if (!cancelReason.trim()) {
      toast({ title: tr('سبب الإلغاء مطلوب', 'Cancel reason is required') });
      return;
    }
    if (!cancelBookingId) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/opd/booking/cancel', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancelBookingId, reason: cancelReason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || tr('فشل الإلغاء', 'Cancel failed'));
      toast({ title: tr('تم إلغاء الحجز بنجاح', 'Booking cancelled successfully') });
      setCancelOpen(false);
      setCancelReason('');
      setCancelBookingId(null);
      mutate();
    } catch (err: any) {
      toast({ title: err?.message || tr('فشل الإلغاء', 'Cancel failed'), variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-background">
      {/* Header — sits close to TheaHeader (shell uses pt-0 for this page) */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">{tr('مواعيد العيادات الخارجية', 'OPD Appointments')}</h1>
                <p className="text-xs text-muted-foreground">{tr('إدارة الجداول، حجز المرضى، حظر الفترات', 'Manage schedules, bookings, and blocked slots')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulk(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold thea-transition-fast ${
                  showBulk
                    ? 'bg-slate-700 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                {tr('إجراءات جماعية', 'Bulk Actions')}
              </button>
              <button
                onClick={() => setShowWalkIn(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-xs font-semibold thea-transition-fast"
              >
                <UserPlus className="w-4 h-4" />
                {tr('مريض بدون موعد', 'Walk-in patient')}
              </button>
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted">
                {[
                  { key: 'grid', label: tr('⊞ شبكة', '⊞ Grid') },
                  { key: 'list', label: tr('☰ قائمة', '☰ List') },
                ].map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setViewMode(v.key as 'grid' | 'list')}
                    className={`px-3 py-1.5 text-xs rounded-xl thea-transition-fast ${
                      viewMode === v.key ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Bulk Actions Panel */}
        {showBulk && (
          <BulkBookingActions
            bookings={slots
              .filter((s: any) => s.booking)
              .map((s: any) => ({
                id: s.booking.id,
                patientName: s.booking.patientName,
                date: s.booking.date,
                time: s.startTime,
                status: s.booking.status,
              }))}
            onComplete={() => { mutateSlots(); setShowBulk(false); }}
          />
        )}

        {/* Filters */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                {tr('العيادة', 'Clinic')}
              </label>
              <select
                value={clinicId}
                onChange={(e) => {
                  const val = e.target.value;
                  setClinicId(val);
                  setSpecialtyId('');
                  setResourceId('');
                  if (val) {
                    const clinic = clinics.find((c: any) => c.id === val);
                    if (clinic?.specialtyId) setSpecialtyId(clinic.specialtyId);
                  }
                }}
                className="w-full px-3 py-2 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus"
              >
                <option value="">{tr('اختر العيادة', 'Select clinic')}</option>
                {clinics.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                {tr('التخصص', 'Specialty')}
              </label>
              <select
                value={specialtyId}
                onChange={(e) => { setSpecialtyId(e.target.value); setResourceId(''); }}
                disabled={!clinicId}
                className="w-full px-3 py-2 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{tr('اختر التخصص', 'Select specialty')}</option>
                {specialtiesUnderClinic.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                {tr('الطبيب', 'Doctor')}
              </label>
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                disabled={!specialtyId}
                className="w-full px-3 py-2 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{tr('اختر الطبيب', 'Select doctor')}</option>
                {filteredProviders.map((p: any) => (
                  <option key={p.resourceId} value={p.resourceId}>{p.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                {tr('التاريخ', 'Date')}
              </label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full px-3 py-2 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus flex items-center justify-between">
                    <span>{date || tr('اختر التاريخ', 'Select date')}</span>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={date ? fromDateOnly(date) : undefined}
                    onSelect={(value) => {
                      if (!value) return;
                      if (resourceId && !isDateAvailable(value)) return;
                      setDate(toDateOnly(value));
                      setDateOpen(false);
                    }}
                    disabled={resourceId ? (value) => !isDateAvailable(value) : () => false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Stats KPIs */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: tr('إجمالي الفترات', 'Total slots'), value: stats.total, icon: 'chart', bg: 'bg-muted' },
            { label: tr('متاح', 'Open'), value: stats.open, icon: 'check', bg: 'bg-emerald-50' },
            { label: tr('محجوز', 'Booked'), value: stats.booked, icon: 'clipboard', bg: 'bg-blue-50' },
            { label: tr('محظور', 'Blocked'), value: stats.blocked, icon: 'ban', bg: 'bg-red-50' },
            { label: tr('مرضى', 'Patients'), value: stats.patients, icon: 'users', bg: 'bg-indigo-50' },
            { label: tr('تم الحضور', 'Checked in'), value: stats.checkedIn, icon: 'checksq', bg: 'bg-purple-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} rounded-2xl border border-border px-3 py-2.5 text-center`}>
              <div className="text-lg flex justify-center">{kpi.icon === 'chart' ? <BarChart3 className="h-5 w-5" /> : kpi.icon === 'check' ? <CheckCircle2 className="h-5 w-5" /> : kpi.icon === 'clipboard' ? <ClipboardList className="h-5 w-5" /> : kpi.icon === 'ban' ? <Ban className="h-5 w-5" /> : kpi.icon === 'users' ? <Users className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}</div>
              <div className="text-xl font-bold text-foreground">{kpi.value}</div>
              <div className="text-[10px] text-muted-foreground font-medium">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Reschedule banner */}
        {reschedulePatient && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">
                {tr('تأجيل موعد', 'Rescheduling')}: {reschedulePatient.fullName || tr('مريض', 'Patient')}
              </span>
              <span className="text-xs text-blue-600">{tr('— اختر فترات جديدة', '— select new slots')}</span>
            </div>
            <button onClick={() => { setReschedulePatient(null); setSelectedPatient(null); }} className="text-xs text-blue-600 hover:text-blue-800 thea-transition-fast">
              {tr('✕ إلغاء التأجيل', '✕ Cancel reschedule')}
            </button>
          </div>
        )}

        {/* Selection bar */}
        {/* Read-only notice for non-booking roles */}
        {!canBook && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Lock className="h-4 w-4" />
            <span className="font-medium">{tr('صلاحية عرض فقط — لا يمكنك الحجز أو الإلغاء', 'View only — you do not have booking permissions')}</span>
          </div>
        )}

        {canBook && selectedSlots.length > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {language === 'ar' ? `${selectedSlots.length} فترة محددة` : `${selectedSlots.length} slot${selectedSlots.length !== 1 ? 's' : ''} selected`}
              </span>
              <div className="flex gap-1">
                {selectedSlots.slice(0, 4).map((id) => {
                  const slot = sortedSlots.find((s) => s.id === id);
                  return slot ? (
                    <span key={id} className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary rounded-xl font-mono">
                      {formatSlotTime(slot.startAt)}
                    </span>
                  ) : null;
                })}
                {selectedSlots.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{selectedSlots.length - 4} {tr('أخرى', 'more')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted">
                {[
                  { key: 'PATIENT', label: tr('مريض', 'Patient') },
                  { key: 'BLOCK', label: tr('حظر', 'Block') },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setBookingType(opt.key as BookingType)}
                    className={`px-3 py-1.5 text-xs rounded-xl thea-transition-fast ${
                      bookingType === opt.key ? 'bg-card text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setConfirmOpen(true)} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 thea-transition-fast">
                {tr('حجز →', 'Book →')}
              </button>
              <button onClick={() => { setSelectedSlots([]); setAnchorSlotId(null); }} className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground thea-transition-fast">
                {tr('✕ مسح', '✕ Clear')}
              </button>
            </div>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Slots panel */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{tr('الفترات الزمنية', 'Time slots')}</span>
                  <span className="text-xs text-muted-foreground">({sortedSlots.length} {tr('فترات', 'slots')})</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-300" /> {tr('متاح', 'Open')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-200 border border-blue-300" /> {tr('محجوز', 'Booked')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-300" /> {tr('محجوز مؤقت', 'Held')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 border border-red-300" /> {tr('محظور', 'Blocked')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-primary border border-primary" /> {tr('محدد', 'Selected')}</span>
                </div>
              </div>

              <div className="p-4">
                {viewMode === 'grid' ? (
                  <div className="space-y-1">
                    {Object.keys(slotsByHour).sort((a, b) => Number(a) - Number(b)).map((hour) => {
                      const hourSlots = slotsByHour[Number(hour)];
                      return (
                        <div key={hour} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground w-10 text-right shrink-0">{String(hour).padStart(2, '0')}:00</span>
                          <div className="flex gap-1 flex-1">
                            {hourSlots.map((slot: any) => {
                              const status = slotStatus(slot);
                              const bookable = isSlotBookable(slot);
                              const isSelected = selectedSlots.includes(slot.id);
                              const booking = bookingBySlotId[slot.id];
                              const bStatus = booking ? bookingStatus(booking) : null;
                              const patientName = booking?.patient?.fullName;
                              const firstName = patientName ? patientName.split(' ')[0] : '';
                              const isBooked = status === 'BOOKED';
                              const isCheckedIn = bStatus === 'CHECKED_IN' || bStatus === 'IN_PROGRESS' || bStatus === 'COMPLETED';
                              const isNoShow = bStatus === 'NO_SHOW';
                              const slotTitle = [
                                `${formatSlotTime(slot.startAt)} · ${bookable ? status : tr('وقت مضى', 'Past')}`,
                                isBooked && patientName ? `${tr('المريض', 'Patient')}: ${patientName}` : '',
                                isBooked && booking ? formatBookingTooltip(booking) : '',
                              ].filter(Boolean).join('\n');
                              const isClickable = bookable || isBooked;

                              const bookedBg = isCheckedIn
                                ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                                : isNoShow
                                ? 'bg-red-50 border-red-300 hover:bg-red-100'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100';

                              const timeColor = isCheckedIn
                                ? 'text-emerald-500/70'
                                : isNoShow
                                ? 'text-red-400/70'
                                : 'text-blue-500/70';

                              // A slot is truly clickable only if user can book (for empty slots) or it's booked (scroll to booking)
                              const effectiveClickable = isClickable && (isBooked || canBook);
                              return (
                                <button
                                  key={slot.id}
                                  onClick={(e) => handleSlotClick(slot, sortedSlots.indexOf(slot), e.shiftKey)}
                                  disabled={!effectiveClickable}
                                  className={`flex-1 rounded-xl border text-[10px] font-medium thea-transition-fast px-1 flex flex-col items-center justify-center ${
                                    isBooked && !isSelected ? 'h-12' : 'h-9'
                                  } ${
                                    isSelected ? 'bg-primary border-primary text-primary-foreground ring-2 ring-primary/30' : isBooked ? `${bookedBg} cursor-pointer` : bookable && canBook ? SLOT_COLORS[status] : 'bg-muted/50 border-muted cursor-not-allowed opacity-60'
                                  } ${effectiveClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                  title={slotTitle}
                                >
                                  {isSelected ? '✓' : status === 'BLOCKED' ? '✕' : isBooked ? (
                                    <>
                                      <span className="truncate w-full text-center text-[9px] font-semibold leading-tight">{firstName || '●'}</span>
                                      <span className={`text-[8px] leading-tight ${timeColor}`}>{formatSlotTime(slot.startAt)}</span>
                                    </>
                                  ) : status === 'HELD' ? '◌' : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[500px] overflow-y-auto thea-scroll">
                    {sortedSlots.map((slot: any, i: number) => {
                      const status = slotStatus(slot);
                      const bookable = isSlotBookable(slot);
                      const isSelected = selectedSlots.includes(slot.id);
                      const booking = bookingBySlotId[slot.id];
                      const bStatus = booking ? bookingStatus(booking) : null;
                      const patientName = booking?.patient?.fullName;
                      const isCheckedIn = bStatus === 'CHECKED_IN' || bStatus === 'IN_PROGRESS' || bStatus === 'COMPLETED';
                      const isNoShow = bStatus === 'NO_SHOW';
                      const slotTitle = [
                        `${formatBookingRange(slot.startAt, slot.endAt)} · ${bookable ? status : tr('وقت مضى', 'Past')}`,
                        status === 'BOOKED' && patientName ? `${tr('المريض', 'Patient')}: ${patientName}` : '',
                        status === 'BOOKED' && booking ? formatBookingTooltip(booking) : '',
                      ].filter(Boolean).join('\n');

                      const dotColor = status === 'OPEN' ? 'bg-emerald-500'
                        : isCheckedIn ? 'bg-emerald-500'
                        : isNoShow ? 'bg-red-500'
                        : status === 'BOOKED' ? 'bg-blue-500'
                        : status === 'HELD' ? 'bg-amber-500'
                        : 'bg-red-500';

                      const badgeColor = bookable && status === 'OPEN' ? 'bg-emerald-100 text-emerald-700'
                        : !bookable && status === 'OPEN' ? 'bg-muted text-muted-foreground'
                        : isCheckedIn ? 'bg-emerald-100 text-emerald-700'
                        : isNoShow ? 'bg-red-100 text-red-700'
                        : status === 'BOOKED' ? 'bg-blue-100 text-blue-700'
                        : status === 'HELD' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700';

                      const badgeLabel = !bookable && status === 'OPEN' ? tr('مضى', 'Past')
                        : bStatus && bStatus !== 'BOOKED' ? bStatus
                        : status;

                      return (
                        <div
                          key={slot.id}
                          onClick={(e) => bookable && canBook && handleSlotClick(slot, i, e.shiftKey)}
                          title={slotTitle}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm thea-transition-fast ${
                            isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : bookable && canBook ? 'border-border hover:border-primary/30 cursor-pointer' : 'border-border opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                            <span className="font-mono text-xs">{formatBookingRange(slot.startAt, slot.endAt)}</span>
                            {status === 'BOOKED' && patientName && <span className="text-xs font-medium text-foreground truncate">{patientName}</span>}
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sortedSlots.length === 0 && (
                  <div className="text-center py-10">
                    <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <div className="text-sm text-muted-foreground">{tr('لا توجد فترات لهذا التاريخ', 'No slots for this date')}</div>
                    <div className="text-xs text-muted-foreground">{tr('اختر طبيب وتاريخ لعرض الفترات المتاحة', 'Select doctor and date to view available slots')}</div>
                  </div>
                )}

                <div className="mt-3 text-[10px] text-muted-foreground">
                  {tr('اضغط لتحديد الفترات. Shift+اضغط لتحديد مجموعة.', 'Click to select slots. Shift+click to select a range.')}
                </div>
              </div>
            </div>
          </div>

          {/* Bookings sidebar */}
          <div>
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">{tr('حجوزات اليوم', "Today's bookings")}</span>
                <span className="text-xs text-muted-foreground ml-2">{language === 'ar' ? `${patientBookings.length} مريض` : `${patientBookings.length} patients`}</span>
              </div>

              <div className="divide-y divide-border max-h-[500px] overflow-y-auto thea-scroll">
                {patientBookings.map((b: any) => {
                  const status = bookingStatus(b);
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.BOOKED;
                  const patient = b.patient || {};
                  const age = getAge(patient.dob);
                  const visitId = b.encounter?.id || b.encounterCoreId;
                  const appointmentDate = b.slotStart || b.startAt || b.date;
                  const dateStatus = appointmentDate ? getAppointmentDateStatus(appointmentDate) : 'today';
                  const dateBadge = appointmentDate
                    ? dateStatus === 'future'
                      ? { label: formatRelativeDate(appointmentDate, language), color: 'bg-blue-100 text-blue-700' }
                      : dateStatus === 'past'
                      ? { label: formatRelativeDate(appointmentDate, language), color: 'bg-red-100 text-red-700' }
                      : { label: tr('اليوم', 'Today'), color: 'bg-emerald-100 text-emerald-700' }
                    : null;

                  const isBookingActive = b.status === 'ACTIVE';
                  const isCheckedIn = b.checkedInAt || b.status === 'CHECKED_IN' || b.status === 'ARRIVED' || status === 'CHECKED_IN' || status === 'IN_PROGRESS' || status === 'COMPLETED';
                  const isNoShow = b.status === 'NO_SHOW' || status === 'NO_SHOW';

                  return (
                    <div key={b.id} id={`booking-${b.id}`} className={`px-4 py-3 hover:bg-muted/50 thea-transition-fast ${highlightBookingId === b.id ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${patient.gender === 'MALE' ? 'bg-blue-500' : patient.gender === 'FEMALE' ? 'bg-pink-500' : 'bg-muted-foreground'}`}>
                          {(patient.fullName || '?')[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{patient.fullName || tr('غير معروف', 'Unknown')}</span>
                            {b.visitType && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{b.visitType}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {formatBookingRange(b.startAt, b.endAt)}
                            {age !== null && ` · ${age}y`}
                            {b.slotIds?.length > 1 && ` · ${b.slotIds.length} ${tr('فترات', 'slots')}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>{language === 'ar' ? cfg.labelAr : cfg.labelEn}</span>
                          {dateBadge && <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${dateBadge.color}`}>{dateBadge.label}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 ml-11 flex-wrap">
                        {(() => {
                          const invoicePaid = b.invoice?.status === 'PAID' || b.invoice?.status === 'ISSUED';
                          const alreadyCheckedIn = !!(b.checkedInAt || b.encounterCoreId);
                          const isPendingPayment = !invoicePaid && !alreadyCheckedIn && (b.status === 'PENDING_PAYMENT' || b.payment?.status === 'PENDING');

                          if (isNoShow) {
                            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">{tr('✕ لم يحضر', '✕ No Show')}</span>;
                          }
                          if (isCheckedIn) {
                            return (
                              <>
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">{tr('✓ تم الحضور', '✓ Checked in')}</span>
                                {isPendingPayment && (
                                  <button onClick={() => handleCheckIn(b)} className="px-2.5 py-1 rounded-xl bg-amber-500 text-white text-[10px] font-medium hover:bg-amber-600 thea-transition-fast">{tr('إكمال الدفع', 'Complete payment')}</button>
                                )}
                              </>
                            );
                          }
                          if (isPendingPayment) {
                            return <button onClick={() => handleCheckIn(b)} className="px-2.5 py-1 rounded-xl bg-amber-500 text-white text-[10px] font-medium hover:bg-amber-600 thea-transition-fast">{tr('إكمال الدفع', 'Complete payment')}</button>;
                          }
                          if (dateStatus === 'future') {
                            return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{formatRelativeDate(appointmentDate, language)}</span>;
                          }
                          if (dateStatus === 'past') {
                            return (
                              <>
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">{tr('فات الموعد', 'Missed')}</span>
                                <button onClick={() => handleMarkNoShow(b.id)} className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-xl text-xs thea-transition-fast">{tr('لم يحضر', 'No Show')}</button>
                              </>
                            );
                          }
                          if (dateStatus === 'today' && isBookingActive) {
                            return <button onClick={() => handleCheckIn(b)} disabled={processing} className="px-2.5 py-1 rounded-xl bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 disabled:opacity-50 thea-transition-fast">{tr('تسجيل الوصول', 'Check-in')}</button>;
                          }
                          return null;
                        })()}

                        {isBookingActive && !isCheckedIn && (
                          <>
                            {canCancel && (
                            <button
                              onClick={() => handleCancelBooking(b.id)}
                              disabled={processing}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium text-red-600 hover:bg-red-50 border border-red-200 thea-transition-fast disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              {tr('إلغاء', 'Cancel')}
                            </button>
                            )}
                            {canBook && (
                            <button
                              onClick={() => handleReschedule(b)}
                              disabled={processing}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 thea-transition-fast disabled:opacity-50"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {tr('تأجيل', 'Reschedule')}
                            </button>
                            )}
                            <button
                              onClick={() => handleSendConfirmation(b)}
                              disabled={sendingSmsFor === b.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium text-emerald-600 hover:bg-emerald-50 border border-emerald-200 thea-transition-fast disabled:opacity-50"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {sendingSmsFor === b.id ? tr('جاري الإرسال...', 'Sending...') : tr('تأكيد SMS', 'Confirm SMS')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {blockBookings.map((b: any) => (
                  <div key={b.id} className="px-4 py-3 bg-red-50/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Ban className="h-4 w-4 text-red-600" /></div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-red-800">{tr('محظور', 'Blocked')}</div>
                        <div className="text-[10px] text-red-600">{formatBookingRange(b.startAt, b.endAt)} · {b.reason || tr('بدون سبب', 'No reason')}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {patientBookings.length === 0 && blockBookings.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-2xl mb-1">📭</div>
                    <div className="text-xs text-muted-foreground">{tr('لا توجد حجوزات بعد', 'No bookings yet')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div dir={language === 'en' ? 'ltr' : undefined} className="bg-card rounded-2xl shadow-xl border border-border max-w-lg w-full max-h-[85vh] overflow-y-auto thea-scroll" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-foreground">
                {bookingType === 'PATIENT' ? tr('حجز مريض', 'Book patient') : tr('حظر فترات', 'Block slots')}
              </h3>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{tr('الفترات المحددة', 'Selected slots')} ({selectedSlots.length})</div>
                <div className="flex flex-wrap gap-1">
                  {selectedSlots.map((id) => {
                    const slot = sortedSlots.find((s) => s.id === id);
                    return slot ? (
                      <span key={id} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-xl font-mono">{formatBookingRange(slot.startAt, slot.endAt)}</span>
                    ) : null;
                  })}
                </div>
              </div>

              {bookingType === 'BLOCK' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">{tr('سبب الحظر *', 'Block reason *')}</label>
                  <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder={tr('مثال: استراحة غداء، اجتماع...', 'e.g. Lunch break, Meeting...')} className="w-full px-3 py-2.5 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus" />
                </div>
              )}

              {bookingType === 'PATIENT' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البحث عن مريض', 'Search patient')}</div>
                  <div className="flex gap-2">
                    <select value={searchType} onChange={(e) => setSearchType(e.target.value as SearchType)} className="px-2 py-2 text-xs rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus">
                      <option value="name">{tr('الاسم', 'Name')}</option>
                      <option value="mrn">{tr('رقم الملف', 'MRN')}</option>
                      <option value="nationalId">{tr('الهوية الوطنية', 'National ID')}</option>
                      <option value="mobile">{tr('الجوال', 'Mobile')}</option>
                    </select>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder={tr('بحث...', 'Search...')} className="flex-1 px-3 py-2 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus" />
                    <button onClick={handleSearch} disabled={searching} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 thea-transition-fast">{searching ? '...' : <Search className="h-4 w-4" />}</button>
                  </div>

                  {selectedPatient && (
                    <div dir={language === 'en' ? 'ltr' : undefined} className="flex items-center gap-3 rounded-2xl bg-primary/5 p-3 border border-primary/20">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedPatient.gender === 'MALE' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                        {(selectedPatient.fullName || '?')[0]}
                      </div>
                      <div className={`flex-1 min-w-0 ${language === 'en' ? 'text-left' : ''}`}>
                        <div className="text-sm font-semibold text-foreground">{selectedPatient.fullName || tr('غير معروف', 'Unknown')}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {(() => {
                            const rawMrn = selectedPatient.mrn || (selectedPatient.links as Record<string, unknown>)?.mrn;
                            const mrn = typeof rawMrn === 'string' ? rawMrn.replace(/^MRN-?/i, '') : '';
                            const rawId = selectedPatient.nationalId ?? (selectedPatient.identifiers as Record<string, unknown>)?.nationalId ?? (selectedPatient.identifiers as Record<string, unknown>)?.iqama;
                            const idNum = typeof rawId === 'string' ? rawId : '';
                            return [mrn && `${tr('ملف', 'MRN')}: ${mrn}`, idNum && `${tr('رقم الهوية', 'National ID')}: ${idNum}`].filter(Boolean).join(' · ');
                          })()}
                        </div>
                      </div>
                      <button onClick={() => setSelectedPatient(null)} className="text-xs text-primary hover:underline shrink-0">{tr('تغيير', 'Change')}</button>
                    </div>
                  )}

                  {!selectedPatient && searchResults.length > 0 && (
                    <div dir={language === 'en' ? 'ltr' : undefined} className="space-y-1 max-h-40 overflow-y-auto thea-scroll">
                      {searchResults.map((p) => {
                        const rawMrn = p.mrn || (p.links as Record<string, unknown>)?.mrn;
                        const mrn = typeof rawMrn === 'string' ? rawMrn.replace(/^MRN-?/i, '') : '';
                        const rawId = p.nationalId ?? (p.identifiers as Record<string, unknown>)?.nationalId ?? (p.identifiers as Record<string, unknown>)?.iqama;
                        const idNum = typeof rawId === 'string' ? rawId : '';
                        return (
                          <button key={p.id} onClick={() => setSelectedPatient(p)} className={`w-full rounded-xl border border-border p-2 hover:border-primary/30 hover:bg-primary/5 thea-transition-fast ${language === 'en' ? 'text-left' : ''}`}>
                            <div className="text-sm font-medium text-foreground">{p.fullName || tr('غير معروف', 'Unknown')}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {[mrn && `${tr('ملف', 'MRN')}: ${mrn}`, idNum && `${tr('رقم الهوية', 'National ID')}: ${idNum}`].filter(Boolean).join(' · ')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/50 flex items-center justify-end gap-2 rounded-b-2xl">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted thea-transition-fast">{tr('إلغاء', 'Cancel')}</button>
              <button onClick={submitBooking} disabled={submitting} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 thea-transition-fast">
                {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('تأكيد الحجز', 'Confirm booking')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelOpen(false)}>
          <div className="bg-card rounded-2xl shadow-xl border border-border max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-base font-bold text-foreground">{tr('إلغاء الحجز', 'Cancel booking')}</h3>
            </div>
            <div className="px-5 py-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">{tr('السبب *', 'Reason *')}</label>
              <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={tr('سبب الإلغاء...', 'Cancel reason...')} className="w-full px-3 py-2.5 text-sm rounded-xl border-[1.5px] border-border bg-background text-foreground thea-input-focus" />
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/50 flex justify-end gap-2 rounded-b-2xl">
              <button onClick={() => setCancelOpen(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-muted thea-transition-fast">{tr('رجوع', 'Back')}</button>
              <button onClick={submitCancel} disabled={processing} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 thea-transition-fast">
                {processing ? tr('جاري الإلغاء...', 'Cancelling...') : tr('تأكيد الإلغاء', 'Confirm cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWalkIn && <WalkInDialog onSelectPatient={handleWalkIn} onClose={() => setShowWalkIn(false)} />}

      {/* Walk-in Step 2: Assign clinic/specialty/doctor */}
      {showWalkInAssign && walkInPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-primary to-primary/80">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h2 className="font-bold text-base">{tr('تعيين الطبيب', 'Assign Doctor')}</h2>
                  <p className="text-xs text-white/80 mt-0.5">
                    {walkInPatient.fullName || walkInPatient.firstName || '—'} · {walkInPatient.mrn || '—'}
                  </p>
                </div>
                <button onClick={() => { setShowWalkInAssign(false); setWalkInPatient(null); }} className="p-1 hover:bg-white/20 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Clinic */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{tr('العيادة', 'Clinic')} *</label>
                <select
                  value={walkInClinicId}
                  onChange={(e) => { setWalkInClinicId(e.target.value); setWalkInSpecialtyId(''); setWalkInResourceId(''); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{tr('اختر العيادة...', 'Select clinic...')}</option>
                  {clinics.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name || c.nameAr}</option>
                  ))}
                </select>
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{tr('التخصص', 'Specialty')} *</label>
                <select
                  value={walkInSpecialtyId}
                  onChange={(e) => { setWalkInSpecialtyId(e.target.value); setWalkInResourceId(''); }}
                  disabled={!walkInClinicId}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  <option value="">{tr('اختر التخصص...', 'Select specialty...')}</option>
                  {walkInSpecialties.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name || s.nameAr}</option>
                  ))}
                </select>
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{tr('الطبيب', 'Doctor')} *</label>
                <select
                  value={walkInResourceId}
                  onChange={(e) => setWalkInResourceId(e.target.value)}
                  disabled={!walkInSpecialtyId}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                >
                  <option value="">{tr('اختر الطبيب...', 'Select doctor...')}</option>
                  {walkInProviders.map((p: any) => (
                    <option key={p.resourceId} value={p.resourceId}>{p.displayName || p.name || p.nameAr || '—'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t bg-muted/30 flex items-center gap-3">
              <button
                onClick={() => { setShowWalkInAssign(false); setWalkInPatient(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleWalkInAssignConfirm}
                disabled={!walkInClinicId || !walkInResourceId || processing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? tr('جاري التحميل...', 'Loading...') : tr('التالي — الفاتورة', 'Next — Invoice')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoice && invoicePatient && invoiceContext && (
        <InvoiceScreen patient={invoicePatient} context={invoiceContext} onComplete={handleInvoiceComplete} onCancel={handleInvoiceCancel} />
      )}
    </div>
  );
}
