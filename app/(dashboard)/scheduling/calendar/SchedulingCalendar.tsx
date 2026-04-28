'use client';

import { useState } from 'react';
import { AppointmentCalendar } from '@/components/scheduling/AppointmentCalendar';
import { AppointmentDetails } from '@/components/scheduling/AppointmentDetails';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

export default function SchedulingCalendar() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const handleSlotSelect = (start: Date, end: Date) => {
    router.push(
      `/opd/appointments/new?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
    );
  };

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/scheduling/appointments/${selectedAppointment.id}/status`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error(tr('فشل تحديث الحالة', 'Failed to update status'));

      toast({ title: tr('تم تحديث الحالة بنجاح', 'Status updated successfully') });
      setSelectedAppointment(null);
    } catch (error) {
      toast({ title: tr('خطأ في تحديث الحالة', 'Failed to update status'), variant: 'destructive' });
    }
  };

  const handleStartEncounter = () => {
    router.push(
      `/opd/encounter/new?patientId=${selectedAppointment.patientId}&appointmentId=${selectedAppointment.id}`
    );
  };

  const handleAppointmentDrop = async (id: string, newStart: Date, newEnd: Date) => {
    try {
      const res = await fetch(`/api/scheduling/appointments/${id}/reschedule`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: newStart.toISOString(),
          endAt: newEnd.toISOString(),
        }),
      });

      if (!res.ok) throw new Error(tr('فشل إعادة الجدولة', 'Failed to reschedule'));

      toast({ title: tr('تم إعادة جدولة الموعد', 'Appointment rescheduled') });
    } catch (error) {
      toast({ title: tr('خطأ في إعادة الجدولة', 'Failed to reschedule'), variant: 'destructive' });
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] p-6 rounded-2xl">
      <AppointmentCalendar
        onSlotSelect={handleSlotSelect}
        onAppointmentClick={handleAppointmentClick}
        onAppointmentDrop={handleAppointmentDrop}
      />

      {selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onStartEncounter={handleStartEncounter}
        />
      )}
    </div>
  );
}
