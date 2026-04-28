'use client';

import { useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';


interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  resourceId: string;
  resourceName: string;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  type: string;
  notes?: string;
}

interface CalendarProps {
  resourceId?: string;
  onSlotSelect?: (start: Date, end: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentDrop?: (id: string, newStart: Date, newEnd: Date) => void;
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const statusColors: Record<string, string> = {
  SCHEDULED: '#3B82F6',
  CONFIRMED: '#10B981',
  ARRIVED: '#8B5CF6',
  IN_PROGRESS: '#F59E0B',
  COMPLETED: '#6B7280',
  CANCELLED: '#EF4444',
  NO_SHOW: '#DC2626',
};

export function AppointmentCalendar({
  resourceId,
  onSlotSelect,
  onAppointmentClick,
  onAppointmentDrop,
}: CalendarProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const statusLabels: Record<string, string> = {
    SCHEDULED: tr('محجوز', 'Scheduled'),
    CONFIRMED: tr('مؤكد', 'Confirmed'),
    ARRIVED: tr('وصل', 'Arrived'),
    IN_PROGRESS: tr('قيد الفحص', 'In Progress'),
    COMPLETED: tr('مكتمل', 'Completed'),
    CANCELLED: tr('ملغي', 'Cancelled'),
    NO_SHOW: tr('لم يحضر', 'No Show'),
  };

  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'>('timeGridWeek');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedResource, setSelectedResource] = useState(resourceId || '');

  const { data: resourcesData } = useSWR('/api/scheduling/resources', fetcher);
  const { data: templatesData } = useSWR(
    selectedResource ? `/api/scheduling/templates?resourceId=${encodeURIComponent(selectedResource)}` : null,
    fetcher
  );

  const businessHours = (templatesData?.items || [])
    .filter((t: any) => String(t?.status || '').toUpperCase() === 'ACTIVE')
    .filter((t: any) => Array.isArray(t?.daysOfWeek) && t.daysOfWeek.length && t?.startTime && t?.endTime)
    .map((t: any) => ({
      daysOfWeek: t.daysOfWeek,
      startTime: String(t.startTime),
      endTime: String(t.endTime),
    }));

  const startDate = new Date(currentDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(currentDate);
  endDate.setDate(endDate.getDate() + 30);

  const params = new URLSearchParams({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });
  if (selectedResource) params.set('resourceId', selectedResource);

  const { data: appointmentsData, mutate } = useSWR(
    `/api/scheduling/appointments?${params.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const events = (appointmentsData?.items || []).map((apt: Appointment) => ({
    id: apt.id,
    title: apt.patientName,
    start: apt.startAt,
    end: apt.endAt,
    backgroundColor: statusColors[apt.status] || '#3B82F6',
    borderColor: statusColors[apt.status] || '#3B82F6',
    extendedProps: {
      ...apt,
    },
  }));

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    onSlotSelect?.(selectInfo.start, selectInfo.end);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    onAppointmentClick?.(clickInfo.event.extendedProps as Appointment);
  };

  const handleEventDrop = (dropInfo: EventDropArg) => {
    const start = dropInfo.event.start;
    const end = dropInfo.event.end || dropInfo.event.start;
    if (!start || !end) return;
    onAppointmentDrop?.(dropInfo.event.id, start, end);
  };

  const goToToday = () => {
    calendarRef.current?.getApi().today();
    setCurrentDate(new Date());
  };

  const goToPrev = () => {
    calendarRef.current?.getApi().prev();
    setCurrentDate(calendarRef.current?.getApi().getDate() || new Date());
  };

  const goToNext = () => {
    calendarRef.current?.getApi().next();
    setCurrentDate(calendarRef.current?.getApi().getDate() || new Date());
  };

  const changeView = (newView: typeof view) => {
    setView(newView);
    calendarRef.current?.getApi().changeView(newView);
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-slate-200">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={goToPrev} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium hover:bg-slate-100 rounded-lg">
              {tr('اليوم', 'Today')}
            </button>
            <button onClick={goToNext} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg font-semibold text-slate-900">
            {currentDate.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={selectedResource}
            onChange={(e) => setSelectedResource(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">{tr('كل الأطباء', 'All Doctors')}</option>
            {resourcesData?.items?.map((res: any) => (
              <option key={res.id} value={res.id}>
                {res.displayName || res.name || res.id}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => changeView('dayGridMonth')}
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'dayGridMonth' ? 'bg-card shadow-sm' : ''}`}
            >
              {tr('شهر', 'Month')}
            </button>
            <button
              onClick={() => changeView('timeGridWeek')}
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'timeGridWeek' ? 'bg-card shadow-sm' : ''}`}
            >
              {tr('أسبوع', 'Week')}
            </button>
            <button
              onClick={() => changeView('timeGridDay')}
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'timeGridDay' ? 'bg-card shadow-sm' : ''}`}
            >
              {tr('يوم', 'Day')}
            </button>
            <button
              onClick={() => changeView('listWeek')}
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'listWeek' ? 'bg-card shadow-sm' : ''}`}
            >
              {tr('قائمة', 'List')}
            </button>
          </div>

          <button onClick={() => mutate()} className="p-2 hover:bg-slate-100 rounded-lg" title={tr('تحديث', 'Refresh')}>
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={view}
          locale={language === 'ar' ? 'ar' : 'en'}
          direction={language === 'ar' ? 'rtl' : 'ltr'}
          headerToolbar={false}
          events={events}
          selectable
          selectMirror
          dayMaxEvents
          weekends
          editable
          droppable
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
            businessHours={businessHours.length ? businessHours : undefined}
            selectConstraint={businessHours.length && selectedResource ? 'businessHours' : undefined}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="01:00"
          allDaySlot={false}
          nowIndicator
          height="100%"
          eventContent={(eventInfo) => (
            <div className="p-1 overflow-hidden">
              <div className="font-medium text-xs truncate">{eventInfo.event.title}</div>
              <div className="text-xs opacity-80">{statusLabels[eventInfo.event.extendedProps.status]}</div>
            </div>
          )}
        />
      </div>

      <div className="flex items-center gap-4 p-4 border-t border-slate-200 bg-slate-50">
        {Object.entries(statusLabels)
          .slice(0, 5)
          .map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[key] }} />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
