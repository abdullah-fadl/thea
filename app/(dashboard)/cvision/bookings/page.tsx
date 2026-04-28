'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  CalendarDays, Clock, User, Video, MapPin, CheckCircle2, XCircle,
  ChevronRight, Plus, Settings, Calendar, AlertTriangle, FileText,
  Trash2, RefreshCw
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function fetchBook(action: string, params: Record<string, string> = {}) {
  return cvisionFetch<any>('/api/cvision/bookings', { params: { action, ...params } });
}
function postBook(body: Record<string, any>) {
  return cvisionMutate<any>('/api/cvision/bookings', 'POST', body);
}

function getStatusBadge(tr: (ar: string, en: string) => string): Record<string, { color: string; label: string }> {
  return {
    PENDING:     { color: 'bg-yellow-100 text-yellow-700', label: tr('معلق', 'Pending') },
    CONFIRMED:   { color: 'bg-green-100 text-green-700',   label: tr('مؤكد', 'Confirmed') },
    CANCELLED:   { color: 'bg-red-100 text-red-700',       label: tr('ملغي', 'Cancelled') },
    COMPLETED:   { color: 'bg-blue-100 text-blue-700',     label: tr('مكتمل', 'Completed') },
    NO_SHOW:     { color: 'bg-gray-100 text-gray-700',     label: tr('لم يحضر', 'No Show') },
    RESCHEDULED: { color: 'bg-purple-100 text-purple-700', label: tr('أعيد جدولته', 'Rescheduled') },
  };
}

function getPurposes(tr: (ar: string, en: string) => string) {
  return [
    { value: 'ONE_ON_ONE',         label: tr('اجتماع فردي', 'One-on-One') },
    { value: 'PERFORMANCE_REVIEW', label: tr('مراجعة الأداء', 'Performance Review') },
    { value: 'CAREER_DISCUSSION',  label: tr('مناقشة مهنية', 'Career Discussion') },
    { value: 'CONCERN',            label: tr('رفع ملاحظة', 'Raise a Concern') },
    { value: 'LEAVE_DISCUSSION',   label: tr('مناقشة الإجازات', 'Leave Discussion') },
    { value: 'SALARY_REVIEW',      label: tr('مراجعة الراتب', 'Salary Review') },
    { value: 'DISCIPLINARY',       label: tr('إجراء تأديبي', 'Disciplinary') },
    { value: 'OTHER',              label: tr('أخرى', 'Other') },
  ];
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════

export default function BookingsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [tab, setTab] = useState('book');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Appointments</h1>
        <p style={{ fontSize: 13, color: C.textMuted }}>Book time with your manager or manage your availability</p>
      </div>

      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'book', label: tr('حجز موعد', 'Book Appointment'), icon: <CalendarDays size={14} /> },
          { id: 'my', label: tr('مواعيدي', 'My Appointments'), icon: <Calendar size={14} /> },
          { id: 'manage', label: tr('إدارة التوفر', 'Manage Availability'), icon: <Settings size={14} /> },
        ]}
      >
        <CVisionTabContent tabId="book"><BookTab /></CVisionTabContent>
        <CVisionTabContent tabId="my"><MyAppointmentsTab /></CVisionTabContent>
        <CVisionTabContent tabId="manage"><ManageAvailabilityTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — Book Appointment (wizard)
// ═══════════════════════════════════════════════════════════════════════════

function BookTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [step, setStep] = useState(1);
  const [managers, setManagers] = useState<any[]>([]);
  const [dates, setDates] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selections
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [purpose, setPurpose] = useState('ONE_ON_ONE');
  const [notes, setNotes] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<any>(null);

  // Employee info for the booking
  const [employees, setEmployees] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      const [mgrs, emps] = await Promise.all([
        fetchBook('bookable-managers', {}),
        fetch('/api/cvision/employees?statuses=ACTIVE,PROBATION&limit=200', { credentials: 'include', signal: ac.signal }).then(r => r.json()),
      ]);
      setManagers(mgrs.data?.items || mgrs.data || []);
      const empList = emps.data || emps.items || [];
      setEmployees(empList);
      if (empList.length > 0) setCurrentUser(empList[0]);
      setLoading(false);
    })().catch(() => {});
    return () => ac.abort();
  }, []);

  async function selectManager(m: any) {
    setSelectedManager(m);
    setSelectedDate('');
    setSelectedSlot(null);
    setStep(2);
    const res = await fetchBook('available-dates', { managerId: m.managerId });
    setDates(res.data?.items || res.data || []);
  }

  async function selectDate(d: string) {
    setSelectedDate(d);
    setSelectedSlot(null);
    setStep(3);
    const res = await fetchBook('available-slots', { managerId: selectedManager.managerId, date: d });
    setSlots(res.data?.slots || []);
  }

  function selectSlot(s: any) {
    setSelectedSlot(s);
    setStep(4);
  }

  async function handleBook() {
    if (!selectedManager || !selectedDate || !selectedSlot) return;
    setBooking(true);
    const empName = currentUser
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Employee'
      : 'Employee';
    const res = await postBook({
      action: 'book',
      managerId: selectedManager.managerId,
      managerName: selectedManager.managerName,
      employeeId: currentUser?.id || '',
      employeeName: empName,
      department: selectedManager.department,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      duration: 30,
      purpose,
      notes: notes || undefined,
      location: isVirtual ? 'Virtual' : location || undefined,
      isVirtual,
      meetingLink: isVirtual ? meetingLink || undefined : undefined,
    });
    setBooking(false);
    if (res.success) setBooked(res.data);
  }

  function reset() {
    setStep(1);
    setSelectedManager(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setPurpose('ONE_ON_ONE');
    setNotes('');
    setIsVirtual(false);
    setLocation('');
    setMeetingLink('');
    setBooked(null);
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, width: '100%' }}  />)}</div>;

  // Success screen
  if (booked) {
    return (
      <div style={{ marginTop: 24, maxWidth: 512 }}>
        <CVisionCard C={C} style={{ background: C.greenDim }}>
          <CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CheckCircle2 size={48} style={{ color: C.green }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Appointment Booked!</h3>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, color: C.textMuted }}>
              <p><strong>{booked.managerName}</strong></p>
              <p>{formatDate(booked.date)} at {formatTime(booked.startTime)} – {formatTime(booked.endTime)}</p>
              <p>{booked.purposeLabel}</p>
              <CVisionBadge C={C} className={getStatusBadge(tr)[booked.status]?.color}>{getStatusBadge(tr)[booked.status]?.label}</CVisionBadge>
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={reset} variant="outline" style={{ marginTop: 16 }}>Book Another</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        {[
          { n: 1, l: 'Manager' }, { n: 2, l: 'Date' },
          { n: 3, l: 'Time' }, { n: 4, l: 'Details' },
        ].map(({ n, l }) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= n ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
            }`}>{n}</span>
            <span className={step >= n ? 'font-medium' : 'text-muted-foreground'}>{l}</span>
            {n < 4 && <ChevronRight size={12} style={{ color: C.textMuted }} />}
          </div>
        ))}
      </div>

      {/* STEP 1 — Select manager */}
      {step >= 1 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Step 1: Select Manager</h3>
          {managers.length === 0 && (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
              No managers have set up availability yet. Ask your manager to configure their booking slots.
            </CVisionCardBody></CVisionCard>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
            {managers.map(m => {
              const isSelected = selectedManager?.managerId === m.managerId;
              const avail = m.totalSlotsThisWeek;
              return (
                <button key={m.managerId} onClick={() => selectManager(m)}
                  className={`text-left rounded-lg border p-3 transition hover:shadow-sm ${
                    isSelected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'hover:border-gray-300'
                  }`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <User size={14} style={{ color: C.textMuted }} />
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{m.managerName || 'Manager'}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{m.department || 'Department'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12 }}>
                    <span className={`w-2 h-2 rounded-full ${avail > 3 ? 'bg-green-500' : avail > 0 ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                    <span>{avail > 0 ? `${avail} slots this week` : 'No slots this week'}</span>
                  </div>
                  {m.nextAvailable && (
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Next: {formatDate(m.nextAvailable)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2 — Select date */}
      {step >= 2 && selectedManager && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Step 2: Select Date</h3>
          {dates.length === 0 && <p style={{ fontSize: 13, color: C.textMuted }}>Loading dates…</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {dates.map(d => {
              const isSelected = selectedDate === d.date;
              const avail = d.slotsAvailable;
              const blocked = d.isBlocked;
              return (
                <button key={d.date} disabled={avail === 0 || blocked}
                  onClick={() => selectDate(d.date)}
                  className={`rounded-lg border p-2 text-center transition ${
                    isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : blocked ? 'bg-gray-100 opacity-50 cursor-not-allowed'
                    : avail === 0 ? 'opacity-40 cursor-not-allowed'
                    : 'hover:border-gray-300 hover:shadow-sm'
                  }`}>
                  <p style={{ color: C.textMuted }}>{d.dayName.slice(0, 3)}</p>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{new Date(d.date + 'T00:00:00').getDate()}</p>
                  {blocked ? (
                    <span style={{ color: C.red }}>Blocked</span>
                  ) : (
                    <span className={`text-[10px] ${avail > 2 ? 'text-green-600' : avail > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {avail > 0 ? `${avail} slot${avail > 1 ? 's' : ''}` : 'Full'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3 — Select time */}
      {step >= 3 && selectedDate && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Step 3: Select Time</h3>
          {slots.length === 0 && <p style={{ fontSize: 13, color: C.textMuted }}>No slots available for this day.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {slots.map((s: any, i: number) => {
              const isSelected = selectedSlot?.startTime === s.startTime;
              return (
                <button key={i} disabled={!s.available}
                  onClick={() => s.available && selectSlot(s)}
                  className={`rounded-lg border px-4 py-2 text-sm transition ${
                    isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 font-medium'
                    : !s.available ? 'opacity-40 cursor-not-allowed line-through'
                    : 'hover:border-gray-300 hover:shadow-sm'
                  }`}>
                  <Clock size={12} style={{ marginRight: 4 }} />
                  {formatTime(s.startTime)}
                  {!s.available && <XCircle size={10} style={{ marginLeft: 4, color: C.red }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4 — Details & book */}
      {step >= 4 && selectedSlot && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Step 4: Appointment Details</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {selectedManager.managerName} · {formatDate(selectedDate)} · {formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Purpose</CVisionLabel>
              <CVisionSelect
                C={C}
                value={purpose}
                onChange={setPurpose}
                options={getPurposes(tr).map(p => ({ value: p.value, label: p.label }))}
              />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Notes (optional)</CVisionLabel>
              <CVisionTextarea C={C} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What you'd like to discuss…" style={{ minHeight: '60px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="loc" checked={!isVirtual} onChange={() => setIsVirtual(false)} /> <MapPin size={12} /> In-Person
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="loc" checked={isVirtual} onChange={() => setIsVirtual(true)} /> <Video size={12} /> Virtual
              </label>
            </div>
            {!isVirtual && (
              <CVisionInput C={C} value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (e.g. Office 301)" />
            )}
            {isVirtual && (
              <CVisionInput C={C} value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="Meeting link (Teams/Zoom)" />
            )}
            <div style={{ paddingTop: 8, display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} onClick={handleBook} disabled={booking}>
                <CalendarDays size={14} style={{ marginRight: 4 }} /> {booking ? 'Booking…' : 'Book Appointment'}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={reset}>Start Over</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — My Appointments
// ═══════════════════════════════════════════════════════════════════════════

function MyAppointmentsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [completeDialog, setCompleteDialog] = useState<any>(null);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [newFollowUp, setNewFollowUp] = useState('');

  const myAptsQuery = useQuery({
    queryKey: cvisionKeys.bookings.list({ action: 'my-appointments' }),
    queryFn: () => fetchBook('my-appointments'),
  });
  const pastQuery = useQuery({
    queryKey: cvisionKeys.bookings.list({ action: 'past-appointments' }),
    queryFn: () => fetchBook('past-appointments'),
  });
  const mgrQuery = useQuery({
    queryKey: cvisionKeys.bookings.list({ action: 'manager-appointments' }),
    queryFn: () => fetchBook('manager-appointments'),
  });

  const upcoming = myAptsQuery.data?.data?.items || myAptsQuery.data?.data || [];
  const past = pastQuery.data?.data?.items || pastQuery.data?.data || [];
  const myIds = new Set(upcoming.map((a: any) => a.id || a.appointmentId));
  const managerApts = (mgrQuery.data?.data?.items || mgrQuery.data?.data || [])
    .filter((a: any) => ['PENDING', 'CONFIRMED'].includes(a.status))
    .filter((a: any) => !myIds.has(a.id) && !myIds.has(a.appointmentId))
    .map((a: any) => ({ ...a, _isManagerView: true }));
  const loading = myAptsQuery.isLoading || pastQuery.isLoading || mgrQuery.isLoading;
  const load = useCallback(() => { myAptsQuery.refetch(); pastQuery.refetch(); mgrQuery.refetch(); }, [myAptsQuery, pastQuery, mgrQuery]);

  async function handleConfirm(id: string) {
    await postBook({ action: 'confirm', appointmentId: id });
    load();
  }

  async function handleCancel() {
    if (!cancelDialog) return;
    await postBook({ action: 'cancel', appointmentId: cancelDialog.appointmentId || cancelDialog.id, reason: cancelReason });
    setCancelDialog(null);
    setCancelReason('');
    load();
  }

  async function handleComplete() {
    if (!completeDialog) return;
    await postBook({
      action: 'complete',
      appointmentId: completeDialog.appointmentId || completeDialog.id,
      meetingNotes,
      followUpActions: followUps.length > 0 ? followUps : undefined,
    });
    setCompleteDialog(null);
    setMeetingNotes('');
    setFollowUps([]);
    load();
  }

  function addFollowUp() {
    if (!newFollowUp.trim()) return;
    setFollowUps(prev => [...prev, newFollowUp.trim()]);
    setNewFollowUp('');
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, width: '100%' }}  />)}</div>;

  // Group upcoming by date
  const grouped = new Map<string, any[]>();
  for (const apt of upcoming) {
    const list = grouped.get(apt.date) || [];
    list.push(apt);
    grouped.set(apt.date, list);
  }

  // Group manager apts by date
  const mgrGrouped = new Map<string, any[]>();
  for (const apt of managerApts) {
    const list = mgrGrouped.get(apt.date) || [];
    list.push(apt);
    mgrGrouped.set(apt.date, list);
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Incoming requests (as manager) — shown first since they need action */}
      {managerApts.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Incoming Requests
            {managerApts.some(a => a.status === 'PENDING') && (
              <CVisionBadge C={C} style={{ background: C.orangeDim, color: C.orange, paddingLeft: 6, paddingRight: 6 }} variant="secondary">
                {managerApts.filter(a => a.status === 'PENDING').length} pending
              </CVisionBadge>
            )}
          </h3>
          {[...mgrGrouped.entries()].map(([date, apts]) => (
            <div key={`mgr-${date}`} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{formatDate(date)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {apts.map(apt => (
                  <AppointmentCard key={apt.id || apt.appointmentId} apt={apt}
                    isManager
                    onConfirm={() => handleConfirm(apt.appointmentId || apt.id)}
                    onCancel={() => setCancelDialog(apt)}
                    onComplete={() => { setCompleteDialog(apt); setMeetingNotes(''); setFollowUps([]); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming (my bookings) */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Upcoming</h3>
        {upcoming.length === 0 && managerApts.length === 0 && (
          <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
            No upcoming appointments. Book one from the first tab.
          </CVisionCardBody></CVisionCard>
        )}
        {[...grouped.entries()].map(([date, apts]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{formatDate(date)}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {apts.map(apt => (
                <AppointmentCard key={apt.id} apt={apt}
                  onCancel={() => setCancelDialog(apt)}
                  onComplete={() => { setCompleteDialog(apt); setMeetingNotes(''); setFollowUps([]); }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Past</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}`, color: C.textMuted, fontSize: 12 }}>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Date</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>With</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Purpose</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Status</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Notes</th>
              </tr></thead>
              <tbody>
                {past.map(a => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, whiteSpace: 'nowrap' }}>{formatDate(a.date)}</td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{a.managerName}</td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{a.purposeLabel || a.purpose}</td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}><CVisionBadge C={C} className={getStatusBadge(tr)[a.status]?.color} variant="secondary">{getStatusBadge(tr)[a.status]?.label}</CVisionBadge></td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.meetingNotes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <CVisionDialog C={C} open={!!cancelDialog} onClose={() => setCancelDialog(null)} title="Cancel Booking" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Provide a reason for cancelling this appointment.</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              Cancel your appointment with <strong>{cancelDialog?.managerName}</strong> on {cancelDialog ? formatDate(cancelDialog.date) : ''}?
            </p>
            <CVisionTextarea C={C} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation…" style={{ minHeight: '60px' }} />
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCancelDialog(null)}>Keep</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleCancel}>Cancel Appointment</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Complete dialog */}
      <CVisionDialog C={C} open={!!completeDialog} onClose={() => setCompleteDialog(null)} title="Complete Booking" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Add meeting notes and follow-up actions to complete this appointment.</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              Meeting with <strong>{completeDialog?.employeeName || completeDialog?.managerName}</strong> on {completeDialog ? formatDate(completeDialog.date) : ''}
            </p>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Meeting Notes</CVisionLabel>
              <CVisionTextarea C={C} value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Summary of what was discussed…" style={{ minHeight: '80px' }} />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Follow-up Actions</CVisionLabel>
              {followUps.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 12, background: C.bgSubtle, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, flex: 1 }}>{f}</span>
                  <button onClick={() => setFollowUps(prev => prev.filter((_, j) => j !== i))} style={{ color: C.textMuted }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <CVisionInput C={C} value={newFollowUp} onChange={e => setNewFollowUp(e.target.value)} placeholder="Add follow-up…"
                  style={{ height: 32, fontSize: 13 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFollowUp(); } }} />
                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 32 }} onClick={addFollowUp}><Plus size={12} /></CVisionButton>
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCompleteDialog(null)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleComplete}><CheckCircle2 size={14} style={{ marginRight: 4 }} /> Save &amp; Complete</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

function AppointmentCard({ apt, onCancel, onComplete, onConfirm, isManager }: {
  apt: any;
  onCancel: () => void;
  onComplete: () => void;
  onConfirm?: () => void;
  isManager?: boolean;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const badges = getStatusBadge(tr);
  const badge = badges[apt.status] || badges.PENDING;
  return (
    <CVisionCard C={C}>
      <CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CVisionBadge C={C} className={badge.color} variant="secondary">{badge.label}</CVisionBadge>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{formatTime(apt.startTime)} – {formatTime(apt.endTime)}</span>
            </div>
            <p style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><User size={12} style={{ color: C.textMuted }} /> {isManager ? 'From' : 'With'}: <strong>{isManager ? (apt.employeeName || apt.bookedByName || 'Employee') : apt.managerName}</strong></p>
            <p style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}><FileText size={11} /> {apt.purposeLabel || apt.purpose}</p>
            {apt.location && <p style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>{apt.isVirtual ? <Video size={11} /> : <MapPin size={11} />} {apt.location}</p>}
            {apt.notes && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{apt.notes}</p>}
            {apt.status === 'PENDING' && !isManager && <p style={{ fontSize: 12, color: C.orange, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Awaiting confirmation</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {apt.isVirtual && apt.meetingLink && (
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} asChild>
                <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer"><Video size={11} style={{ marginRight: 4 }} /> Join</a>
              </CVisionButton>
            )}
            {apt.status === 'PENDING' && isManager && onConfirm && (
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12, color: C.green }} onClick={onConfirm}>
                <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Confirm
              </CVisionButton>
            )}
            {(apt.status === 'CONFIRMED') && (
              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={onComplete}>
                <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Complete
              </CVisionButton>
            )}
            {['PENDING', 'CONFIRMED'].includes(apt.status) && (
              <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12, color: C.red }} onClick={onCancel}>
                <XCircle size={11} style={{ marginRight: 4 }} /> {apt.status === 'PENDING' && isManager ? 'Decline' : 'Cancel'}
              </CVisionButton>
            )}
          </div>
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — Manage Availability (managers)
// ═══════════════════════════════════════════════════════════════════════════

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function ManageAvailabilityTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [avail, setAvail] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [managerApts, setManagerApts] = useState<any[]>([]);
  const [editSlots, setEditSlots] = useState(false);

  // Editable state
  const [slots, setSlots] = useState<any[]>([]);
  const [autoApprove, setAutoApprove] = useState(true);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(14);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const [employees, setEmployees] = useState<any[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<any>(null);
  const [completeDialog, setCompleteDialog] = useState<any>(null);
  const [meetingNotes, setMeetingNotes] = useState('');

  const availQuery = useQuery({
    queryKey: cvisionKeys.bookings.list({ action: 'availability-manage' }),
    queryFn: async () => {
      const [av, apts, emps] = await Promise.all([
        fetchBook('availability'),
        fetchBook('manager-appointments'),
        cvisionFetch<any>('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION', limit: '200' } }),
      ]);
      return { av, apts, emps };
    },
  });

  const loading = availQuery.isLoading;
  useEffect(() => {
    if (!availQuery.data) return;
    const { av, apts, emps } = availQuery.data;
    setAvail(av.data || null);
    setManagerApts((apts.data?.items || apts.data || []).filter((a: any) => ['PENDING', 'CONFIRMED'].includes(a.status)));
    setEmployees(emps.data || emps.items || []);
    if (av.data) {
      setSlots(av.data.weeklySlots || []);
      setAutoApprove(av.data.autoApprove ?? true);
      setBufferMinutes(av.data.bufferMinutes ?? 15);
      setMaxAdvanceDays(av.data.maxAdvanceDays ?? 14);
    } else {
      setSlots([
        { day: 0, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
        { day: 1, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
        { day: 2, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
        { day: 3, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 },
      ]);
    }
  }, [availQuery.data]);
  const load = useCallback(() => availQuery.refetch(), [availQuery]);

  async function saveAvailability() {
    setSaving(true);
    const me = employees[0];
    await postBook({
      action: 'set-availability',
      managerName: me ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : '',
      department: me?.departmentId || '',
      weeklySlots: slots,
      autoApprove,
      bufferMinutes,
      maxAdvanceDays,
    });
    setSaving(false);
    setEditSlots(false);
    load();
  }

  async function blockDateAction() {
    if (!newBlockDate) return;
    await postBook({ action: 'block-date', date: newBlockDate, reason: newBlockReason || undefined });
    setNewBlockDate('');
    setNewBlockReason('');
    load();
  }

  async function unblockDateAction(date: string) {
    await postBook({ action: 'unblock-date', date });
    load();
  }

  async function confirmApt(id: string) {
    await postBook({ action: 'confirm', appointmentId: id });
    load();
  }

  async function cancelApt(id: string) {
    await postBook({ action: 'cancel', appointmentId: id, reason: 'Declined by manager' });
    load();
  }

  async function handleComplete() {
    if (!completeDialog) return;
    await postBook({ action: 'complete', appointmentId: completeDialog.appointmentId || completeDialog.id, meetingNotes });
    setCompleteDialog(null);
    setMeetingNotes('');
    load();
  }

  function updateSlot(idx: number, field: string, value: any) {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }

  function toggleDay(day: number) {
    const exists = slots.some(s => s.day === day);
    if (exists) {
      setSlots(prev => prev.filter(s => s.day !== day));
    } else {
      setSlots(prev => [...prev, { day, startTime: '09:00', endTime: '11:00', slotDuration: 30, maxBookings: 1 }].sort((a, b) => a.day - b.day));
    }
  }

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1,2,3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 80, width: '100%' }}  />)}</div>;

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Weekly schedule */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Weekly Schedule</div>
            <CVisionButton C={C} isDark={isDark} size="sm" variant={editSlots ? 'default' : 'outline'} onClick={() => { if (editSlots) saveAvailability(); else setEditSlots(true); }}>
              {editSlots ? (saving ? 'Saving…' : 'Save Changes') : 'Edit Slots'}
            </CVisionButton>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, width: 96 }}>Day</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Available</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Start</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>End</th>
                <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Duration</th>
              </tr></thead>
              <tbody>
                {DAY_LABELS.map((label, dayIdx) => {
                  const slotIdx = slots.findIndex(s => s.day === dayIdx);
                  const slot = slotIdx >= 0 ? slots[slotIdx] : null;
                  return (
                    <tr key={dayIdx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{label}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                        {editSlots ? (
                          <input type="checkbox" checked={!!slot} onChange={() => toggleDay(dayIdx)} style={{ borderRadius: 6 }} />
                        ) : (
                          <span className={slot ? 'text-green-600' : 'text-gray-400'}>{slot ? '✓' : '—'}</span>
                        )}
                      </td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                        {slot ? (
                          editSlots ? <CVisionInput C={C} type="time" value={slot.startTime} onChange={e => updateSlot(slotIdx, 'startTime', e.target.value)} style={{ width: 112, height: 28, fontSize: 12 }} />
                          : slot.startTime
                        ) : '—'}
                      </td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                        {slot ? (
                          editSlots ? <CVisionInput C={C} type="time" value={slot.endTime} onChange={e => updateSlot(slotIdx, 'endTime', e.target.value)} style={{ width: 112, height: 28, fontSize: 12 }} />
                          : slot.endTime
                        ) : '—'}
                      </td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                        {slot ? (
                          editSlots ? (
                            <CVisionSelect
                C={C}
                value={String(slot.slotDuration)}
                options={[15, 20, 30, 45, 60].map(d => ({ value: String(d), label: `${d} min` }))}
                style={{ width: 96, height: 28, fontSize: 12 }}
              />
                          ) : `${slot.slotDuration} min`
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Settings */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Settings</div></CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} style={{ borderRadius: 6 }} />
            Auto-approve bookings (no confirmation needed)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CVisionLabel C={C} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Buffer between appointments:</CVisionLabel>
            <CVisionSelect
                C={C}
                value={String(bufferMinutes)}
                options={[0, 5, 10, 15, 20, 30].map(m => ({ value: String(m), label: `${m} min` }))}
                style={{ width: 96, height: 32 }}
              />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CVisionLabel C={C} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Max advance booking:</CVisionLabel>
            <CVisionSelect
                C={C}
                value={String(maxAdvanceDays)}
                options={[7, 14, 21, 30, 60].map(d => ({ value: String(d), label: `${d} days` }))}
                style={{ width: 96, height: 32 }}
              />
          </div>
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={saveAvailability} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </CVisionButton>
        </CVisionCardBody>
      </CVisionCard>

      {/* Blocked dates */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Blocked Dates</div></CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(avail?.blockedDates || []).length === 0 && <p style={{ fontSize: 13, color: C.textMuted }}>No blocked dates.</p>}
          {(avail?.blockedDates || []).map((b: any) => (
            <div key={b.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
              <span>{formatDate(b.date)} {b.reason && <span style={{ color: C.textMuted }}>— {b.reason}</span>}</span>
              <button onClick={() => unblockDateAction(b.date)} style={{ color: C.textMuted }}><Trash2 size={14} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Date</CVisionLabel><CVisionInput C={C} type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} style={{ height: 32, fontSize: 13 }} /></div>
            <div style={{ flex: 1 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Reason (optional)</CVisionLabel><CVisionInput C={C} value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} placeholder="e.g. Annual leave" style={{ height: 32, fontSize: 13 }} /></div>
            <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 32 }} onClick={blockDateAction} disabled={!newBlockDate}><Plus size={12} style={{ marginRight: 4 }} /> Block</CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Manager's bookings */}
      {managerApts.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Upcoming Bookings (as Manager)</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Employee</th>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Date</th>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Time</th>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Purpose</th>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Status</th>
                  <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>Actions</th>
                </tr></thead>
                <tbody>
                  {managerApts.map(a => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{a.employeeName}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, whiteSpace: 'nowrap' }}>{formatDate(a.date)}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8, whiteSpace: 'nowrap' }}>{formatTime(a.startTime)}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>{a.purposeLabel || a.purpose}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}><CVisionBadge C={C} className={getStatusBadge(tr)[a.status]?.color} variant="secondary">{getStatusBadge(tr)[a.status]?.label}</CVisionBadge></td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {a.status === 'PENDING' && (
                            <>
                              <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 24, fontSize: 12, paddingLeft: 8, paddingRight: 8 }} onClick={() => confirmApt(a.appointmentId || a.id)}>
                                <CheckCircle2 size={10} style={{ marginRight: 2 }} /> Confirm
                              </CVisionButton>
                              <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 24, fontSize: 12, paddingLeft: 8, paddingRight: 8, color: C.red }} onClick={() => cancelApt(a.appointmentId || a.id)}>
                                Decline
                              </CVisionButton>
                            </>
                          )}
                          {a.status === 'CONFIRMED' && (
                            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 24, fontSize: 12, paddingLeft: 8, paddingRight: 8 }} onClick={() => { setCompleteDialog(a); setMeetingNotes(''); }}>
                              <CheckCircle2 size={10} style={{ marginRight: 2 }} /> Complete
                            </CVisionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Complete dialog */}
      <CVisionDialog C={C} open={!!completeDialog} onClose={() => setCompleteDialog(null)} title="Complete Booking" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Record notes from the completed meeting.</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>Meeting with <strong>{completeDialog?.employeeName}</strong></p>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Meeting Notes</CVisionLabel>
              <CVisionTextarea C={C} value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Summary of discussion…" style={{ minHeight: '80px' }} />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCompleteDialog(null)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleComplete}><CheckCircle2 size={14} style={{ marginRight: 4 }} /> Save &amp; Complete</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
