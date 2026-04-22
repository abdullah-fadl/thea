'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Bell, CheckCircle2, XCircle } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_TABS = ['OPEN', 'READ', 'CLOSED'] as const;

export default function Notifications() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading } = useRoutePermission('/notifications');

  const [status, setStatus] = useState<typeof STATUS_TABS[number]>('OPEN');
  const query = `/api/notifications/inbox?status=${status}&limit=50`;
  const { data, mutate } = useSWR(hasPermission ? query : null, fetcher, { refreshInterval: 0 });

  const items = Array.isArray(data?.items) ? data.items : [];
  const counts = data?.counts || { severity: {}, scope: {}, status: {} };

  const statusLabels: Record<typeof STATUS_TABS[number], string> = {
    OPEN: tr('مفتوح', 'Open'),
    READ: tr('تم الاطلاع', 'Read'),
    CLOSED: tr('مغلق', 'Closed'),
  };

  const summaryBadges = useMemo(() => {
    const severity = counts.severity || {};
    const scope = counts.scope || {};
    return {
      severity,
      scope,
    };
  }, [counts]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const handleAck = async (id: string) => {
    await fetch(`/api/notifications/${id}/ack`, { credentials: 'include', method: 'POST' });
    mutate();
  };

  const handleDismiss = async (id: string) => {
    await fetch(`/api/notifications/${id}/dismiss`, { credentials: 'include', method: 'POST' });
    mutate();
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('صندوق الإشعارات', 'Notifications Inbox')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('إشعارات تشغيلية للقراءة فقط.', 'Read-only operational notifications.')}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab}
                className="rounded-xl"
                variant={status === tab ? 'default' : 'outline'}
                onClick={() => setStatus(tab)}
              >
                {statusLabels[tab]}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(summaryBadges.severity || {}).map(([key, value]) => (
              <span key={`sev-${key}`} className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">
                {key}: {String(value)}
              </span>
            ))}
            {Object.entries(summaryBadges.scope || {}).map(([key, value]) => (
              <span key={`scope-${key}`} className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">
                {key}: {String(value)}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {items.length ? (
              items.map((item: any) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm thea-hover-lift thea-transition-fast">
                  <div className="flex items-start gap-3">
                    <Bell className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <div className="font-medium">{item.title || tr('إشعار', 'Notification')}</div>
                      <div className="text-xs text-muted-foreground">{item.message}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{item.severity || 'INFO'}</span>
                        <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 bg-muted text-muted-foreground">{item.scope || tr('النظام', 'SYSTEM')}</span>
                        <span className="text-muted-foreground">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : '\u2014'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {item.entity?.link ? (
                      <Button className="rounded-xl" size="sm" variant="outline" asChild>
                        <Link href={item.entity.link}>{tr('فتح', 'Open')}</Link>
                      </Button>
                    ) : null}
                    {status === 'OPEN' ? (
                      <>
                        <Button className="rounded-xl" size="sm" variant="outline" onClick={() => handleAck(item.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {tr('اطلاع', 'Ack')}
                        </Button>
                        <Button className="rounded-xl" size="sm" variant="outline" onClick={() => handleDismiss(item.id)}>
                          <XCircle className="h-4 w-4 mr-1" />
                          {tr('رفض', 'Dismiss')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{tr('لا توجد إشعارات.', 'No notifications.')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
