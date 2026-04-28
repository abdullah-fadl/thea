'use client';

import React, { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { TheaKpiCard } from '@/components/thea-ui/TheaKpiCard';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar, Scissors, RefreshCw, AlertTriangle, Users, Clock,
  Plus, ChevronLeft, ChevronRight, Activity, X,
  Percent, Siren, LayoutGrid, ListFilter,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// Operating hours
const OP_START_HOUR = 6;
const OP_END_HOUR = 22;
const HOURS = Array.from({ length: OP_END_HOUR - OP_START_HOUR }, (_, i) => OP_START_HOUR + i);

// Color mapping
function priorityColor(priority: string, status: string): string {
  if (status === 'COMPLETED') return 'bg-muted border-gray-400 text-foreground';
  if (status === 'IN_PROGRESS') return 'bg-green-200 border-green-500 text-green-900';
  if (priority === 'EMERGENCY') return 'bg-red-200 border-red-500 text-red-900';
  if (priority === 'URGENT') return 'bg-orange-200 border-orange-500 text-orange-900';
  return 'bg-blue-200 border-blue-500 text-blue-900'; // ELECTIVE
}

function priorityBadge(priority: string, tr: (a: string, e: string) => string): { label: string; className: string } {
  if (priority === 'EMERGENCY') return { label: tr('طوارئ', 'EMER'), className: 'bg-red-600 text-white' };
  if (priority === 'URGENT') return { label: tr('عاجل', 'URG'), className: 'bg-orange-500 text-white' };
  return { label: tr('اختياري', 'ELEC'), className: 'bg-blue-500 text-white' };
}

interface ScheduledCase {
  id: string;
  orderId: string;
  patientName: string;
  procedureName: string;
  status: string;
  currentStep: string | null;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  estimatedDurationMin: number | null;
  roomName: string;
  priority: string;
  caseType: string;
  surgeonName: string;
  anesthesiologistName: string;
  asaClass: string;
}

interface UnscheduledCase {
  id: string;
  patientName: string;
  procedureName: string;
  priority: string;
  surgeonName: string;
  estimatedDurationMin: number | null;
  createdAt: string;
}

interface Room {
  name: string;
  type: string;
  status: string;
}

export default function ORScheduleBoard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedCaseForSchedule, setSelectedCaseForSchedule] = useState<UnscheduledCase | null>(null);
  const [saving, setSaving] = useState(false);

  // Schedule form
  const [schedForm, setSchedForm] = useState({
    roomName: '', startHour: '8', startMin: '00',
    durationMin: '120', priority: 'ELECTIVE', surgeonName: '', anesthesiologistName: '', asaClass: '',
  });

  // Data fetching
  const { data: scheduleData, mutate: mutateSchedule } = useSWR(
    `/api/or/schedule?date=${selectedDate}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const { data: roomsData } = useSWR('/api/or/schedule/rooms', fetcher);

  const scheduled: ScheduledCase[] = scheduleData?.scheduled || [];
  const unscheduled: UnscheduledCase[] = scheduleData?.unscheduled || [];
  const rooms: Room[] = roomsData?.rooms || [];
  const conflicts = scheduleData?.conflicts || [];
  const kpis = scheduleData?.kpis || { totalCases: 0, roomsActive: 0, emergencies: 0, utilization: 0 };

  // Rooms to display (from rooms API or from cases)
  const displayRooms = useMemo(() => {
    const caseRooms = [...new Set(scheduled.map((c) => c.roomName).filter(Boolean))];
    const allRooms = [...new Set([...rooms.map((r) => r.name), ...caseRooms])].sort();
    if (roomFilter !== 'ALL') return allRooms.filter((r) => r === roomFilter);
    return allRooms;
  }, [rooms, scheduled, roomFilter]);

  // Navigate date
  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Handle schedule
  const handleSchedule = useCallback(async () => {
    if (!selectedCaseForSchedule || !schedForm.roomName) return;
    setSaving(true);
    try {
      const dateObj = new Date(selectedDate);
      const startH = parseInt(schedForm.startHour, 10);
      const startM = parseInt(schedForm.startMin, 10);
      const durMin = parseInt(schedForm.durationMin, 10) || 120;

      const startTime = new Date(dateObj);
      startTime.setHours(startH, startM, 0, 0);
      const endTime = new Date(startTime.getTime() + durMin * 60000);

      const res = await fetch('/api/or/schedule', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseForSchedule.id,
          scheduledDate: selectedDate,
          scheduledStartTime: startTime.toISOString(),
          scheduledEndTime: endTime.toISOString(),
          estimatedDurationMin: durMin,
          roomName: schedForm.roomName,
          priority: schedForm.priority,
          surgeonName: schedForm.surgeonName || selectedCaseForSchedule.surgeonName || '',
          anesthesiologistName: schedForm.anesthesiologistName || '',
          asaClass: schedForm.asaClass || '',
        }),
      });

      if (res.status === 409) {
        const err = await res.json();
        toast({
          title: tr('تعارض في المواعيد!', 'Schedule Conflict!'),
          description: tr('يوجد تعارض مع عملية أخرى', `Conflicts with: ${err.conflictsWith?.[0]?.procedureName || 'another case'}`),
          variant: 'destructive',
        });
        return;
      }
      if (!res.ok) throw new Error('Failed');

      toast({ title: tr('تم جدولة العملية', 'Case scheduled successfully') });
      setScheduleDialogOpen(false);
      setSelectedCaseForSchedule(null);
      mutateSchedule();
    } catch {
      toast({ title: tr('خطأ في الجدولة', 'Schedule error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedCaseForSchedule, schedForm, selectedDate, toast, tr, mutateSchedule]);

  // Open schedule dialog
  const openScheduleDialog = (c: UnscheduledCase) => {
    setSelectedCaseForSchedule(c);
    setSchedForm({
      roomName: rooms[0]?.name || 'Theater 1',
      startHour: '8', startMin: '00',
      durationMin: String(c.estimatedDurationMin || 120),
      priority: c.priority || 'ELECTIVE',
      surgeonName: c.surgeonName || '',
      anesthesiologistName: '', asaClass: '',
    });
    setScheduleDialogOpen(true);
  };

  // Format time for display
  function fmtTime(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Calculate position on timeline (left % and width %)
  function timelinePos(startStr: string, endStr: string): { left: string; width: string } {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();
    const opStartMin = OP_START_HOUR * 60;
    const totalRange = (OP_END_HOUR - OP_START_HOUR) * 60;
    const leftPct = Math.max(0, ((startMin - opStartMin) / totalRange) * 100);
    const widthPct = Math.max(2, ((endMin - startMin) / totalRange) * 100);
    return { left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` };
  }

  // Day label
  const dayLabel = useMemo(() => {
    const d = new Date(selectedDate);
    const today = new Date().toISOString().slice(0, 10);
    const isToday = selectedDate === today;
    const dayName = d.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
    return `${dayName}${isToday ? ` (${tr('اليوم', 'Today')})` : ''} — ${selectedDate}`;
  }, [selectedDate, language, tr]);

  return (
    <div className="p-4 space-y-4 max-w-[1800px] mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Scissors className="w-6 h-6 text-blue-600" />
          {tr('لوحة جدولة غرف العمليات', 'OR Scheduling Board')}
        </h1>
        <button onClick={() => mutateSchedule()} className="p-2 border rounded hover:bg-muted/50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <TheaKpiCard
          label={tr('عمليات اليوم', "Today's Cases")}
          value={kpis.totalCases}
          icon={<Scissors className="w-5 h-5 text-blue-600" />}
        />
        <TheaKpiCard
          label={tr('غرف نشطة', 'Rooms Active')}
          value={kpis.roomsActive}
          icon={<LayoutGrid className="w-5 h-5 text-green-600" />}
        />
        <TheaKpiCard
          label={tr('طوارئ', 'Emergencies')}
          value={kpis.emergencies}
          icon={<Siren className="w-5 h-5 text-red-600" />}
        />
        <TheaKpiCard
          label={tr('نسبة الاستخدام', 'Utilization')}
          value={`${kpis.utilization}%`}
          icon={<Percent className="w-5 h-5 text-purple-600" />}
        />
      </div>

      {/* Date Navigation + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 border rounded-lg">
          <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-muted/50 rounded-l-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1.5 text-sm border-x" />
          <button onClick={() => navigateDate(1)} className="p-2 hover:bg-muted/50 rounded-r-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm font-medium text-muted-foreground">{dayLabel}</span>
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm ml-auto">
          <option value="ALL">{tr('كل الغرف', 'All Rooms')}</option>
          {rooms.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
      </div>

      {/* Conflict Warning */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-red-800">{tr('تعارض في المواعيد!', 'Schedule Conflicts Detected!')}</p>
            {conflicts.map((c: any, i: number) => (
              <p key={i} className="text-xs text-red-600">
                {c.room}: {c.case1Name} ↔ {c.case2Name}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Main Content: Timeline + Unscheduled Panel */}
      <div className="flex gap-4">
        {/* Timeline Grid */}
        <div className="flex-1 border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            {/* Hour Headers */}
            <div className="flex border-b bg-muted/50">
              <div className="w-[140px] shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r">
                {tr('الغرفة', 'Room')}
              </div>
              <div className="flex-1 relative" style={{ minWidth: HOURS.length * 60 }}>
                <div className="flex">
                  {HOURS.map((h) => (
                    <div key={h} className="text-center text-[10px] text-muted-foreground font-medium border-l py-1"
                      style={{ width: `${100 / HOURS.length}%` }}>
                      {`${h.toString().padStart(2, '0')}:00`}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Room Rows */}
            {displayRooms.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {tr('لا توجد غرف مجدولة', 'No rooms scheduled')}
              </div>
            )}
            {displayRooms.map((roomName) => {
              const roomCases = scheduled.filter((c) => c.roomName === roomName);
              const room = rooms.find((r) => r.name === roomName);
              return (
                <div key={roomName} className="flex border-b hover:bg-muted/50/50 group" style={{ minHeight: 56 }}>
                  {/* Room Label */}
                  <div className="w-[140px] shrink-0 px-3 py-2 border-r bg-card">
                    <div className="font-semibold text-xs">{roomName}</div>
                    {room && <div className="text-[10px] text-muted-foreground">{room.type}</div>}
                    <div className={`text-[10px] mt-0.5 ${room?.status === 'in-use' ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {room?.status === 'in-use' ? tr('قيد الاستخدام', 'In Use') : tr('متاح', 'Available')}
                    </div>
                  </div>
                  {/* Timeline area */}
                  <div className="flex-1 relative" style={{ minWidth: HOURS.length * 60 }}>
                    {/* Hour grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOURS.map((h) => (
                        <div key={h} className="border-l border-border" style={{ width: `${100 / HOURS.length}%` }} />
                      ))}
                    </div>
                    {/* Case blocks */}
                    {roomCases.map((c) => {
                      if (!c.scheduledStartTime || !c.scheduledEndTime) return null;
                      const pos = timelinePos(c.scheduledStartTime, c.scheduledEndTime);
                      const badge = priorityBadge(c.priority, tr);
                      return (
                        <div key={c.id}
                          className={`absolute top-1 bottom-1 rounded border-l-4 px-1.5 py-0.5 overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${priorityColor(c.priority, c.status)}`}
                          style={{ left: pos.left, width: pos.width, minWidth: 60 }}
                          onClick={() => window.location.href = `/or/cases/${c.id}`}
                          title={`${c.procedureName} — ${c.patientName} (${fmtTime(c.scheduledStartTime)}-${fmtTime(c.scheduledEndTime)})`}>
                          <div className="flex items-center gap-1">
                            <span className={`px-1 rounded text-[9px] font-bold ${badge.className}`}>{badge.label}</span>
                            <span className="text-[10px] font-bold truncate">{c.procedureName || tr('عملية', 'Procedure')}</span>
                          </div>
                          <div className="text-[9px] truncate">{c.patientName}</div>
                          <div className="text-[9px] text-muted-foreground truncate">
                            {fmtTime(c.scheduledStartTime)}-{fmtTime(c.scheduledEndTime)}
                            {c.surgeonName && ` • ${c.surgeonName}`}
                          </div>
                          {c.status === 'IN_PROGRESS' && (
                            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unscheduled Cases Panel */}
        <div className="w-[280px] shrink-0 border rounded-lg overflow-hidden">
          <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 border-b flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {tr('بانتظار الجدولة', 'Awaiting Schedule')} ({unscheduled.length})
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
            {unscheduled.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {tr('لا توجد عمليات بانتظار الجدولة', 'No cases awaiting schedule')}
              </p>
            )}
            {unscheduled.map((c) => {
              const badge = priorityBadge(c.priority, tr);
              return (
                <div key={c.id} className="p-2 border-b hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => openScheduleDialog(c)}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className={`px-1 rounded text-[9px] font-bold ${badge.className}`}>{badge.label}</span>
                    <span className="text-xs font-semibold truncate">{c.procedureName || tr('عملية', 'Procedure')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.patientName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.surgeonName && `${tr('جراح:', 'Surgeon:')} ${c.surgeonName}`}
                    {c.estimatedDurationMin && ` • ${c.estimatedDurationMin} ${tr('د', 'min')}`}
                  </div>
                  <div className="mt-1">
                    <button className="flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">
                      <Plus className="w-3 h-3" /> {tr('جدولة', 'Schedule')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-500" />
          {tr('اختياري', 'Elective')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-200 border border-orange-500" />
          {tr('عاجل', 'Urgent')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-500" />
          {tr('طوارئ', 'Emergency')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-500" />
          {tr('قيد التنفيذ', 'In Progress')}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted border border-gray-400" />
          {tr('مكتمل', 'Completed')}
        </span>
      </div>

      {/* Schedule Dialog */}
      {scheduleDialogOpen && selectedCaseForSchedule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setScheduleDialogOpen(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{tr('جدولة عملية', 'Schedule Case')}</h3>
              <button onClick={() => setScheduleDialogOpen(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Case Info */}
            <div className="bg-muted/50 rounded p-3 mb-4 text-sm">
              <p className="font-semibold">{selectedCaseForSchedule.procedureName || tr('عملية', 'Procedure')}</p>
              <p className="text-muted-foreground">{selectedCaseForSchedule.patientName}</p>
              {selectedCaseForSchedule.surgeonName && (
                <p className="text-muted-foreground">{tr('الجراح:', 'Surgeon:')} {selectedCaseForSchedule.surgeonName}</p>
              )}
            </div>

            <div className="space-y-3">
              {/* Room */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('الغرفة', 'Room')}</label>
                <select value={schedForm.roomName} onChange={(e) => setSchedForm((p) => ({ ...p, roomName: e.target.value }))}
                  className="w-full border rounded p-2 text-sm">
                  {rooms.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.type})</option>)}
                </select>
              </div>

              {/* Time */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('الساعة', 'Start Hour')}</label>
                  <select value={schedForm.startHour} onChange={(e) => setSchedForm((p) => ({ ...p, startHour: e.target.value }))}
                    className="w-full border rounded p-2 text-sm">
                    {HOURS.map((h) => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('الدقيقة', 'Start Min')}</label>
                  <select value={schedForm.startMin} onChange={(e) => setSchedForm((p) => ({ ...p, startMin: e.target.value }))}
                    className="w-full border rounded p-2 text-sm">
                    {['00', '15', '30', '45'].map((m) => <option key={m} value={m}>:{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('المدة (دقيقة)', 'Duration (min)')}</label>
                  <input type="number" value={schedForm.durationMin}
                    onChange={(e) => setSchedForm((p) => ({ ...p, durationMin: e.target.value }))}
                    className="w-full border rounded p-2 text-sm" min={15} max={720} step={15} />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('الأولوية', 'Priority')}</label>
                <div className="flex gap-2">
                  {[
                    { value: 'ELECTIVE', label: tr('اختياري', 'Elective'), className: 'border-blue-400 text-blue-700' },
                    { value: 'URGENT', label: tr('عاجل', 'Urgent'), className: 'border-orange-400 text-orange-700' },
                    { value: 'EMERGENCY', label: tr('طوارئ', 'Emergency'), className: 'border-red-400 text-red-700' },
                  ].map((opt) => (
                    <button key={opt.value}
                      onClick={() => setSchedForm((p) => ({ ...p, priority: opt.value }))}
                      className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium transition
                        ${schedForm.priority === opt.value ? `${opt.className} bg-opacity-10 border-2` : 'border-border text-muted-foreground'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Surgeon & Anesthesiologist */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('الجراح', 'Surgeon')}</label>
                  <input type="text" value={schedForm.surgeonName}
                    onChange={(e) => setSchedForm((p) => ({ ...p, surgeonName: e.target.value }))}
                    className="w-full border rounded p-2 text-sm" placeholder={tr('اسم الجراح', 'Surgeon name')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('طبيب التخدير', 'Anesthesiologist')}</label>
                  <input type="text" value={schedForm.anesthesiologistName}
                    onChange={(e) => setSchedForm((p) => ({ ...p, anesthesiologistName: e.target.value }))}
                    className="w-full border rounded p-2 text-sm" placeholder={tr('اسم طبيب التخدير', 'Anesthesiologist name')} />
                </div>
              </div>

              {/* ASA Class */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{tr('تصنيف ASA', 'ASA Class')}</label>
                <select value={schedForm.asaClass} onChange={(e) => setSchedForm((p) => ({ ...p, asaClass: e.target.value }))}
                  className="w-full border rounded p-2 text-sm">
                  <option value="">{tr('اختر...', 'Select...')}</option>
                  <option value="ASA I">ASA I — {tr('صحي', 'Healthy')}</option>
                  <option value="ASA II">ASA II — {tr('مرض جهازي خفيف', 'Mild systemic')}</option>
                  <option value="ASA III">ASA III — {tr('مرض جهازي شديد', 'Severe systemic')}</option>
                  <option value="ASA IV">ASA IV — {tr('تهديد للحياة', 'Life-threatening')}</option>
                  <option value="ASA V">ASA V — {tr('توقع الوفاة', 'Moribund')}</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setScheduleDialogOpen(false)}
                  className="px-4 py-2 border rounded text-sm">{tr('إلغاء', 'Cancel')}</button>
                <button onClick={handleSchedule} disabled={saving || !schedForm.roomName}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? tr('جاري...', 'Saving...') : tr('تأكيد الجدولة', 'Confirm Schedule')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
