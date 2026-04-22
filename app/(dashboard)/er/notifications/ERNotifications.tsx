'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { useToast } from '@/hooks/use-toast';

type ErNotification = {
  id: string;
  type: string;
  encounterId: string;
  visitNumber?: string | null;
  message: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  createdAt: string;
  readAt: string | null;
};

export default function ERNotifications() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { me } = useMe();
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/er/notifications');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });

  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
  const { data, isLoading: loading, mutate } = useSWR(
    hasPermission && canAccess ? '/api/er/notifications' : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const items: ErNotification[] = Array.isArray(data?.items) ? data.items : [];
  const unreadCount = Number(data?.unreadCount || 0);

  const markRead = async (id: string) => {
    try {
      const res = await fetch('/api/er/notifications/read', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/er/notifications/read-all', { credentials: 'include', method: 'POST' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    }
  };

  const severityStyle = (sev: string) => {
    if (sev === 'CRITICAL') return 'border-destructive/50 text-destructive bg-destructive/10';
    if (sev === 'WARN') return 'border-amber-500/50 text-amber-700 bg-amber-500/10';
    return 'border-border text-muted-foreground';
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  if (!canAccess) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-base font-bold text-foreground">{tr('تنبيهات الطوارئ', 'ER Alerts')}</h2>
              <p className="text-sm text-muted-foreground">{tr('الوصول مقتصر على أدوار المشرف/الإدارة.', 'Access is limited to charge/supervisor/admin roles.')}</p>
            </div>
            <div className="p-5 text-sm text-muted-foreground">{tr('محظور.', 'Forbidden.')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('تنبيهات الطوارئ', 'ER Alerts')}</h1>
            <p className="text-sm text-muted-foreground">{tr('تنبيهات تشغيلية داخل التطبيق (بدون إشعارات خارجية).', 'In-app operational alerts (no external notifications).')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">
              {tr('غير مقروءة', 'Unread')}: {unreadCount}
            </span>
            <button
              disabled={unreadCount === 0}
              onClick={markAllRead}
              className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast disabled:opacity-50"
            >
              {tr('تحديد الكل كمقروء', 'Mark all read')}
            </button>
          </div>
        </div>

        {/* Alerts Card */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('أحدث التنبيهات', 'Latest alerts')}</h2>
            <p className="text-sm text-muted-foreground">{tr('آخر 50 (تحديث مباشر).', 'Latest 50 (polling).')}</p>
          </div>
          <div className="p-5">
            {loading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل…', 'Loading…')}</div>}
            {!loading && items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">{tr('لا توجد تنبيهات.', 'No alerts.')}</div>
            )}
            {!loading && items.length > 0 && (
              <>
                {/* Header row */}
                <div className="hidden md:grid grid-cols-6 gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <div>{tr('الشدة', 'Severity')}</div>
                  <div>{tr('النوع', 'Type')}</div>
                  <div>{tr('الرسالة', 'Message')}</div>
                  <div>{tr('الوقت', 'Time')}</div>
                  <div>{tr('الحالة', 'Status')}</div>
                  <div className="text-right">{tr('إجراء', 'Action')}</div>
                </div>

                {/* Data rows */}
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`grid grid-cols-1 md:grid-cols-6 gap-2 md:gap-3 px-3 py-3 border-b border-border last:border-b-0 thea-transition-fast rounded-xl ${!n.readAt ? 'bg-muted/50' : ''}`}
                  >
                    <div>
                      <span className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 border ${severityStyle(n.severity)}`}>
                        {n.severity}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{n.type}</div>
                    <div className="text-sm text-foreground">
                      <div>{n.message}</div>
                      {n.encounterId && (
                        <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}: {n.visitNumber || 'ER-—'}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.readAt ? tr('مقروء', 'Read') : tr('غير مقروء', 'Unread')}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {n.encounterId && (
                        <Link
                          href={`/er/encounter/${n.encounterId}`}
                          className="px-3 py-1 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
                        >
                          {tr('فتح', 'Open')}
                        </Link>
                      )}
                      {!n.readAt && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="px-3 py-1 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
                        >
                          {tr('تحديد كمقروء', 'Mark read')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
