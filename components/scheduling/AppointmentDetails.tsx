'use client';

import { useState } from 'react';
import { X, User, Clock, Phone, FileText, CheckCircle, XCircle, Play, UserCheck } from 'lucide-react';
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
  status: string;
  type: string;
  notes?: string;
}

interface Props {
  appointment: Appointment;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onStartEncounter: () => void;
}

const statusActions: Record<string, { labelAr: string; labelEn: string; next: string; icon: any; color: string }[]> = {
  SCHEDULED: [
    { labelAr: 'تأكيد', labelEn: 'Confirm', next: 'CONFIRMED', icon: CheckCircle, color: 'bg-green-600' },
    { labelAr: 'إلغاء', labelEn: 'Cancel', next: 'CANCELLED', icon: XCircle, color: 'bg-red-600' },
  ],
  CONFIRMED: [
    { labelAr: 'وصل', labelEn: 'Arrived', next: 'ARRIVED', icon: UserCheck, color: 'bg-purple-600' },
    { labelAr: 'لم يحضر', labelEn: 'No Show', next: 'NO_SHOW', icon: XCircle, color: 'bg-red-600' },
  ],
  ARRIVED: [{ labelAr: 'بدء الفحص', labelEn: 'Start Exam', next: 'IN_PROGRESS', icon: Play, color: 'bg-amber-600' }],
  IN_PROGRESS: [{ labelAr: 'إنهاء', labelEn: 'Complete', next: 'COMPLETED', icon: CheckCircle, color: 'bg-gray-600' }],
};

export function AppointmentDetails({ appointment, onClose, onStatusChange, onStartEncounter }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(false);

  const actions = statusActions[appointment.status] || [];

  const handleAction = async (nextStatus: string) => {
    setLoading(true);
    try {
      if (nextStatus === 'IN_PROGRESS') {
        onStartEncounter();
      } else {
        await onStatusChange(nextStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{tr('تفاصيل الموعد', 'Appointment Details')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">{appointment.patientName}</div>
              <div className="text-sm text-slate-500">ID: {appointment.patientId}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-medium">
                {new Date(appointment.startAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="text-sm text-slate-500">
                {new Date(appointment.startAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' - '}
                {new Date(appointment.endAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {appointment.patientPhone && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="font-medium">{appointment.patientPhone}</div>
                <a href={`tel:${appointment.patientPhone}`} className="text-sm text-blue-600 hover:underline">
                  {tr('اتصال', 'Call')}
                </a>
              </div>
            </div>
          )}

          {appointment.notes && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <div className="text-sm text-slate-600">{appointment.notes}</div>
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-sm text-slate-500">{tr('الطبيب', 'Doctor')}</div>
            <div className="font-medium">{appointment.resourceName}</div>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="p-4 border-t bg-slate-50 flex gap-2">
            {actions.map((action) => (
              <button
                key={action.next}
                onClick={() => handleAction(action.next)}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg ${action.color} hover:opacity-90 disabled:opacity-50`}
              >
                <action.icon className="w-4 h-4" />
                {language === 'ar' ? action.labelAr : action.labelEn}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
