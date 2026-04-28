'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Calendar, Clock, User, CheckCircle, X } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface Props {
  encounterId: string;
  patientId: string;
  patientName: string;
  currentProviderId: string;
  currentProviderName: string;
  currentSpecialtyCode: string;
  onScheduled?: (appointmentId: string) => void;
  onCancel?: () => void;
}

export function FollowUpScheduler({
  encounterId,
  patientId,
  patientName,
  currentProviderId,
  currentProviderName,
  currentSpecialtyCode,
  onScheduled,
  onCancel,
}: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { alert: showAlert } = useConfirm();

  const [followUpType, setFollowUpType] = useState<'same-doctor' | 'same-specialty' | 'other'>('same-doctor');
  const [selectedSpecialty, setSelectedSpecialty] = useState(currentSpecialtyCode);
  const [selectedProvider, setSelectedProvider] = useState(currentProviderId);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [interval, setInterval] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { data: specialtiesData } = useSWR('/api/specialties', fetcher);
  const specialties = specialtiesData?.items || [];

  const { data: providersData } = useSWR(
    selectedSpecialty ? `/api/scheduling/resources?specialtyCode=${selectedSpecialty}&type=DOCTOR` : null,
    fetcher
  );
  const providers = providersData?.items || [];

  const { data: slotsData } = useSWR(
    selectedDate && selectedProvider
      ? `/api/scheduling/slots?resourceId=${selectedProvider}&date=${selectedDate}&status=AVAILABLE`
      : null,
    fetcher
  );
  const slots = slotsData?.items || [];

  const quickIntervals = [
    { label: tr('1 أسبوع', '1 Week'), days: 7 },
    { label: tr('2 أسبوع', '2 Weeks'), days: 14 },
    { label: tr('1 شهر', '1 Month'), days: 30 },
    { label: tr('3 شهور', '3 Months'), days: 90 },
    { label: tr('6 شهور', '6 Months'), days: 180 },
  ];

  const handleQuickInterval = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
    setInterval(`${days} ${tr('يوم', 'days')}`);
  };

  const handleSchedule = async () => {
    if (!selectedSlot) {
      await showAlert(tr('يرجى اختيار موعد', 'Please select an appointment'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/opd/booking/create', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: selectedProvider,
          slotIds: [selectedSlot],
          patientMasterId: patientId,
          bookingType: 'PATIENT',
          visitType: 'FU',
          reason: reason || tr('متابعة', 'Follow-up'),
          referringEncounterId: encounterId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to schedule');

      await fetch(`/api/opd/encounters/${encounterId}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUp: {
            scheduled: true,
            appointmentId: result.bookingId,
            scheduledDate: selectedDate,
            interval,
            reason,
          },
        }),
      });

      onScheduled?.(result.bookingId);

      // Trigger reminder generation for the new follow-up booking (fire-and-forget)
      fetch('/api/reminders/generate', { credentials: 'include', method: 'POST' }).catch(() => {});
    } catch (error: any) {
      alert(tr('خطأ: ', 'Error: ') + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">{tr('جدولة موعد متابعة', 'Schedule Follow-Up Appointment')}</h2>
              <p className="text-sm text-green-100">{patientName}</p>
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">{tr('نوع المتابعة', 'Follow-Up Type')}</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                setFollowUpType('same-doctor');
                setSelectedProvider(currentProviderId);
                setSelectedSpecialty(currentSpecialtyCode);
              }}
              className={`p-3 rounded-lg border-2 text-center ${
                followUpType === 'same-doctor' ? 'border-green-500 bg-green-50' : 'border-slate-200'
              }`}
            >
              <User className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{tr('نفس الطبيب', 'Same Doctor')}</div>
              <div className="text-xs text-slate-500">{currentProviderName}</div>
            </button>
            <button
              onClick={() => {
                setFollowUpType('same-specialty');
                setSelectedProvider('');
                setSelectedSpecialty(currentSpecialtyCode);
              }}
              className={`p-3 rounded-lg border-2 text-center ${
                followUpType === 'same-specialty' ? 'border-green-500 bg-green-50' : 'border-slate-200'
              }`}
            >
              <Clock className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{tr('نفس التخصص', 'Same Specialty')}</div>
              <div className="text-xs text-slate-500">{tr('أي طبيب', 'Any doctor')}</div>
            </button>
            <button
              onClick={() => {
                setFollowUpType('other');
                setSelectedProvider('');
                setSelectedSpecialty('');
              }}
              className={`p-3 rounded-lg border-2 text-center ${
                followUpType === 'other' ? 'border-green-500 bg-green-50' : 'border-slate-200'
              }`}
            >
              <Calendar className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">{tr('تخصص آخر', 'Other Specialty')}</div>
            </button>
          </div>
        </div>

        {followUpType === 'other' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{tr('التخصص', 'Specialty')}</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => {
                  setSelectedSpecialty(e.target.value);
                  setSelectedProvider('');
                }}
                className="w-full px-4 py-3 border rounded-xl"
              >
                <option value="">{tr('اختر التخصص', 'Select Specialty')}</option>
                {specialties.map((s: any) => (
                  <option key={s.code || s.id} value={s.code || s.id}>
                    {s.nameAr || s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{tr('الطبيب', 'Doctor')}</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                disabled={!selectedSpecialty}
              >
                <option value="">{tr('أي طبيب', 'Any Doctor')}</option>
                {providers.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr || p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {followUpType === 'same-specialty' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">الطبيب</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl"
            >
              <option value="">{tr('أي طبيب متاح', 'Any Available Doctor')}</option>
              {providers.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr || p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">{tr('الفترة', 'Interval')}</label>
          <div className="flex flex-wrap gap-2">
            {quickIntervals.map((qi) => (
              <button
                key={qi.days}
                onClick={() => handleQuickInterval(qi.days)}
                className={`px-4 py-2 rounded-lg border ${
                  interval === `${qi.days} يوم`
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 hover:border-green-300'
                }`}
              >
                {qi.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{tr('التاريخ', 'Date')}</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 border rounded-xl"
          />
        </div>

        {selectedDate && selectedProvider && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              {tr('المواعيد المتاحة', 'Available Slots')} ({slots.length})
            </label>
            {slots.length === 0 ? (
              <div className="text-center py-4 text-slate-500 bg-slate-50 rounded-xl">
                {tr('لا توجد مواعيد متاحة في هذا اليوم', 'No available slots on this day')}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((slot: any) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={`p-3 rounded-lg border text-center ${
                      selectedSlot === slot.id
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 hover:border-green-300'
                    }`}
                  >
                    {new Date(slot.startTime).toLocaleTimeString('ar-SA', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{tr('سبب المتابعة', 'Follow-Up Reason')}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr('مثال: متابعة نتائج الفحوصات...', 'e.g., Follow up on test results...')}
            className="w-full px-4 py-3 border rounded-xl"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between">
        <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-card">
          {tr('إلغاء', 'Cancel')}
        </button>
        <button
          onClick={handleSchedule}
          disabled={saving || !selectedSlot}
          className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? (
            tr('جاري الحجز...', 'Booking...')
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {tr('تأكيد الموعد', 'Confirm Appointment')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
