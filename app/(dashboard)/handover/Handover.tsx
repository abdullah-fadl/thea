'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Handover() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/handover');
  const { data } = useSWR(hasPermission ? '/api/handover/open' : null, fetcher, { refreshInterval: 0 });

  const open = Array.isArray(data?.open) ? data.open : [];
  const recent = Array.isArray(data?.recent) ? data.recent : [];

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-4">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('تسليماتي', 'My Handovers')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('التسليمات المفتوحة المسندة إليك', 'Open handovers assigned to you')}</p>
        </div>
        <div className="p-5">
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص', 'Summary')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ الإنشاء', 'Created')}</span>
          </div>
          {/* Body */}
          {open.length ? (
            open.map((item: any) => (
              <div key={item.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-sm text-foreground">{item.summary}</span>
                <span className="text-sm text-foreground">{item.fromRole}</span>
                <span>
                  <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{item.status}</span>
                </span>
                <span className="text-sm text-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr('لا توجد تسليمات مفتوحة.', 'No open handovers.')}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('المنتهية مؤخراً', 'Recently Finalized')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('آخر ٢٤ ساعة', 'Last 24 hours')}</p>
        </div>
        <div className="p-5">
          {/* Header */}
          <div className="grid grid-cols-3 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملخص', 'Summary')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تاريخ الإنهاء', 'Finalized')}</span>
          </div>
          {/* Body */}
          {recent.length ? (
            recent.map((item: any) => (
              <div key={item.id} className="grid grid-cols-3 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-sm text-foreground">{item.summary}</span>
                <span className="text-sm text-foreground">{item.fromRole}</span>
                <span className="text-sm text-foreground">
                  {item.finalizedAt ? new Date(item.finalizedAt).toLocaleString() : '—'}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr('لا توجد تسليمات حديثة.', 'No recent handovers.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
