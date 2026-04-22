'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { formatTimeRange } from '@/lib/time/format';
import { useLang } from '@/hooks/use-lang';

type Metadata = {
  facilities: Array<{ id: string; name: string }>;
  units: Array<{ id: string; name: string; facilityId?: string; code?: string | null }>;
  specialties: Array<{ id: string; name: string; code?: string | null }>;
  clinics: Array<{ id: string; name: string; unitId?: string; specialtyId?: string }>;
  providers: Array<{ id: string; displayName: string; specialtyIds: string[] }>;
  resources: Array<{ id: string; displayName: string; resourceRef?: any }>;
};

export default function PortalBookingPage() {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [facilityId, setFacilityId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portal/auth/me', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized');
      })
      .then(() => fetch('/api/portal/metadata', { credentials: 'include' }))
      .then((res) => res.json())
      .then((data) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(() => router.replace('/p/login'));
  }, [router]);

  const units = useMemo(() => {
    if (!metadata) return [];
    if (!facilityId) return metadata.units;
    return metadata.units.filter((unit) => String(unit.facilityId || '') === facilityId);
  }, [metadata, facilityId]);

  const clinics = useMemo(() => {
    if (!metadata) return [];
    if (!unitId) return metadata.clinics;
    return metadata.clinics.filter((clinic) => String(clinic.unitId || '') === unitId);
  }, [metadata, unitId]);

  const loadSlots = async () => {
    setError(null);
    setSuccess(null);
    if (!resourceId || !date) {
      setSlots([]);
      return;
    }
    const res = await fetch(`/api/portal/booking/slots?resourceId=${encodeURIComponent(resourceId)}&date=${encodeURIComponent(date)}`, { credentials: 'include' });
    const data = await res.json();
    setSlots(Array.isArray(data?.items) ? data.items : []);
  };

  useEffect(() => {
    void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, date]);

  const bookSlot = async (slotId: string) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/portal/booking/create', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId, clinicId, slotIds: [slotId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || tr('فشل الحجز', 'Booking failed'));
      setSuccess(tr('تم تأكيد الحجز.', 'Booking confirmed.'));
      router.push('/p/appointments');
    } catch (err: any) {
      setError(err?.message || tr('فشل الحجز', 'Booking failed'));
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">{tr('حجز موعد', 'Book Appointment')}</div>
        <div className="text-sm text-muted-foreground">{tr('اختر العيادة والطبيب لعرض الفترات المتاحة.', 'Select a clinic and doctor to view available slots.')}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>{tr('المستشفى', 'Hospital')}</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={facilityId}
            onChange={(event) => {
              setFacilityId(event.target.value);
              setUnitId('');
              setClinicId('');
            }}
          >
            <option value="">{tr('اختر المستشفى', 'Select hospital')}</option>
            {metadata?.facilities?.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>{tr('القسم', 'Department')}</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              setClinicId('');
            }}
          >
            <option value="">{tr('اختر القسم', 'Select department')}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>{tr('العيادة', 'Clinic')}</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={clinicId}
            onChange={(event) => setClinicId(event.target.value)}
          >
            <option value="">{tr('اختر العيادة', 'Select clinic')}</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>{tr('الطبيب', 'Doctor')}</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={resourceId}
            onChange={(event) => setResourceId(event.target.value)}
          >
            <option value="">{tr('اختر الطبيب', 'Select doctor')}</option>
            {metadata?.resources?.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.displayName || resource.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>{tr('التاريخ', 'Date')}</Label>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {success && <div className="text-sm text-green-600">{success}</div>}

      <div className="space-y-2">
        <div className="text-sm font-medium">{tr('الفترات المتاحة', 'Available Slots')}</div>
        {slots.length === 0 && <div className="text-sm text-muted-foreground">{tr('لا توجد فترات متاحة.', 'No slots available.')}</div>}
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
            <div>
              {formatTimeRange(slot.startAt, slot.endAt, 'UTC')}
            </div>
            <Button size="sm" disabled={!slot.isAvailable && slot.status !== 'OPEN'} onClick={() => bookSlot(slot.id)}>
              {tr('حجز', 'Book')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
