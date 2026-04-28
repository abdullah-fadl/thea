'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/time/format';
import { useLang } from '@/hooks/use-lang';

type Appointment = {
  bookingId: string;
  clinicId?: string | null;
  resourceId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status?: string | null;
  encounterCoreId?: string | null;
};

type VisitStatus = {
  flowState: string | null;
  label: { ar: string; en: string } | null;
  step: number;
  totalSteps: number;
  queuePosition: number | null;
  estimatedWaitMin: number | null;
};

export default function PortalAppointmentsPage() {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [items, setItems] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [visitStatus, setVisitStatus] = useState<Record<string, VisitStatus>>({});
  const nextAppointment = items.find((item) => String(item.status || '').toUpperCase() === 'BOOKED');

  const fetchVisitStatus = useCallback(async (bookingId: string) => {
    try {
      const res = await fetch(`/api/portal/appointments/${encodeURIComponent(bookingId)}/status`, { credentials: 'include' });
      if (!res.ok) return;
      const data: VisitStatus = await res.json();
      setVisitStatus((prev) => ({ ...prev, [bookingId]: data }));
    } catch { /* ignore */ }
  }, []);

  const loadAppointments = async () => {
    const res = await fetch('/api/portal/appointments', { credentials: 'include' });
    if (res.status === 401) {
      router.replace('/p/login');
      return;
    }
    const data = await res.json();
    setItems(Array.isArray(data?.items) ? data.items : []);
  };

  useEffect(() => {
    void loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll live visit status every 30 seconds for active appointments
  useEffect(() => {
    const activeItems = items.filter((item) => {
      const s = String(item.status || '').toUpperCase();
      return item.encounterCoreId && s !== 'CANCELLED' && s !== 'COMPLETED';
    });
    if (activeItems.length === 0) return;
    activeItems.forEach((item) => fetchVisitStatus(item.bookingId));
    const interval = setInterval(() => {
      activeItems.forEach((item) => fetchVisitStatus(item.bookingId));
    }, 30_000);
    return () => clearInterval(interval);
  }, [items, fetchVisitStatus]);

  const arrive = async (bookingId: string) => {
    setError(null);
    const res = await fetch(`/api/portal/booking/${encodeURIComponent(bookingId)}/arrived`, { credentials: 'include', method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || tr('فشل تسجيل الوصول', 'Failed to mark arrival'));
      return;
    }
    await loadAppointments();
  };

  const cancelBooking = async (bookingId: string) => {
    setCancelling(bookingId);
    try {
      const res = await fetch(`/api/portal/booking/${encodeURIComponent(bookingId)}/cancel`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || tr('فشل إلغاء الموعد', 'Failed to cancel'));
      toast.success(tr('تم إلغاء الموعد بنجاح', 'Appointment cancelled successfully'));
      await loadAppointments();
      setCancelReason('');
    } catch (err: any) {
      toast.error(err?.message || tr('فشل إلغاء الموعد', 'Failed to cancel appointment'));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">{tr('مواعيدي', 'My Appointments')}</div>
        <div className="text-sm text-muted-foreground">{tr('المواعيد القادمة وإجراءات الوصول.', 'Upcoming appointments and arrival actions.')}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/p/book')}>
          {tr('حجز موعد جديد', 'Book New Appointment')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.push('/p/reports')}>
          {tr('عرض التقارير', 'View Reports')}
        </Button>
      </div>

      {nextAppointment ? (
        <div className="border rounded-md p-3 text-sm bg-emerald-50 border-emerald-100">
          <div className="font-medium">{tr('الموعد القادم', 'Next Appointment')}</div>
          <div className="text-emerald-700">{formatDateTime(nextAppointment.startAt, { timeZone: 'UTC' }) || '—'}</div>
        </div>
      ) : null}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {items.length === 0 && <div className="text-sm text-muted-foreground">{tr('لا توجد مواعيد قادمة.', 'No upcoming appointments.')}</div>}

      <div className="space-y-2">
        {items.map((item) => {
          const status = String(item.status || 'BOOKED').toUpperCase();
          const canArrive = status === 'BOOKED' || status === 'ARRIVED';
          // Cancel policy: no cancel less than 1 hour before appointment
          const tooLateToCancel = item.startAt
            ? new Date(item.startAt).getTime() - Date.now() < 60 * 60 * 1000
            : false;
          const canCancel = status === 'BOOKED' && !tooLateToCancel;
          const vs = visitStatus[item.bookingId];
          return (
            <div key={item.bookingId} className="border rounded-md p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
              <div>
                <div>{formatDateTime(item.startAt, { timeZone: 'UTC' }) || '—'}</div>
                <div className="mt-1">
                  <Badge variant={status === 'CANCELLED' ? 'destructive' : 'outline'}>{status}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={!canArrive} onClick={() => arrive(item.bookingId)}>
                  {tr('وصلت', 'I Arrived')}
                </Button>
                {canCancel ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={cancelling === item.bookingId}
                        onClick={() => setCancelReason('')}
                      >
                        {cancelling === item.bookingId ? tr('جاري الإلغاء...', 'Cancelling...') : tr('إلغاء', 'Cancel')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{tr('إلغاء الموعد؟', 'Cancel Appointment?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {tr('هل أنت متأكد من إلغاء موعدك في', 'Are you sure you want to cancel your appointment on')}{' '}
                          {formatDateTime(item.startAt, { timeZone: 'UTC' }) || '—'}{tr('؟', '?')}
                          <br />
                          {tr('لا يمكن التراجع عن هذا الإجراء.', 'This action cannot be undone.')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor={`cancel-reason-${item.bookingId}`}>{tr('السبب (اختياري)', 'Reason (optional)')}</Label>
                        <Textarea
                          id={`cancel-reason-${item.bookingId}`}
                          placeholder={tr('لماذا تريد الإلغاء؟', 'Why do you want to cancel?')}
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          rows={3}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{tr('لا، أبقِ الموعد', 'No, Keep Appointment')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelBooking(item.bookingId)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          {tr('نعم، إلغاء الموعد', 'Yes, Cancel Appointment')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                {status === 'BOOKED' && tooLateToCancel && (
                  <span className="text-xs text-amber-600">{tr('لا يمكن الإلغاء قبل أقل من ساعة', 'Cannot cancel less than 1 hour before')}</span>
                )}
              </div>
              </div>
              {/* Live visit status progress bar */}
              {vs && vs.flowState && vs.step > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{language === 'ar' ? (vs.label?.ar || vs.flowState) : (vs.label?.en || vs.flowState)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((vs.step / vs.totalSteps) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{tr('خطوة', 'Step')} {vs.step} {tr('من', 'of')} {vs.totalSteps}</span>
                    {vs.queuePosition != null && (
                      <span>{tr('الترتيب:', 'Position:')} {vs.queuePosition} {vs.estimatedWaitMin != null ? `(~${vs.estimatedWaitMin} ${tr('دقيقة', 'min')})` : ''}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
