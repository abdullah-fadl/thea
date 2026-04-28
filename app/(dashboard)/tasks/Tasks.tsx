'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Tasks() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/tasks');
  const [area, setArea] = useState<'ALL' | 'ER' | 'OPD' | 'IPD'>('ALL');
  const [status, setStatus] = useState('OPEN,CLAIMED,IN_PROGRESS');

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (area !== 'ALL') params.set('area', area);
    if (status) params.set('status', status);
    return `/api/tasks/queue?${params.toString()}`;
  }, [area, status]);

  const { data } = useSWR(hasPermission ? url : null, fetcher, { refreshInterval: 0 });
  const items = Array.isArray(data?.items) ? data.items : [];

  const userIds = Array.from(
    new Set(
      items
        .map((row: any) => [row.task?.assignedToUserId, row.task?.createdByUserId].filter(Boolean))
        .flat()
        .map((id: any) => String(id))
    )
  );
  const usersUrl = userIds.length ? `/api/tasks/users?ids=${encodeURIComponent(userIds.join(','))}` : null;
  const { data: usersData } = useSWR(hasPermission ? usersUrl : null, fetcher, { refreshInterval: 0 });
  const usersById = (Array.isArray(usersData?.items) ? usersData.items : []).reduce(
    (acc: Record<string, any>, item: any) => {
      acc[String(item.id || '')] = item;
      return acc;
    },
    {} as Record<string, any>
  );
  const displayName = (id?: string | null) => (id ? usersById[String(id)]?.display || id : '\u2014');

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-extrabold text-base">{tr('قائمة المهام', 'Tasks Queue')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{tr('المهام التشغيلية للتمريض', 'Operational nursing tasks')}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={area} onValueChange={(value) => setArea(value as 'ALL' | 'ER' | 'OPD' | 'IPD')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={tr('القسم', 'Area')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="ER">{tr('الطوارئ', 'ER')}</SelectItem>
                <SelectItem value="OPD">{tr('العيادات', 'OPD')}</SelectItem>
                <SelectItem value="IPD">{tr('التنويم', 'IPD')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder={tr('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">{tr('مفتوح', 'OPEN')}</SelectItem>
                <SelectItem value="CLAIMED">{tr('مطالب بها', 'CLAIMED')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{tr('قيد التنفيذ', 'IN_PROGRESS')}</SelectItem>
                <SelectItem value="OPEN,CLAIMED,IN_PROGRESS">{tr('مفتوح + مطالب بها + قيد التنفيذ', 'OPEN + CLAIMED + IN_PROGRESS')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Header row */}
          <div className="grid grid-cols-7 gap-4 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مطالب بها بواسطة', 'Claimed By')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('أنشئت بواسطة', 'Created By')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الزيارة', 'Encounter')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
          </div>
          {/* Body rows */}
          {items.length ? (
            items.map((row: any) => (
              <div key={row.task?.id} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <span className="text-sm text-foreground">{row.task?.title}</span>
                <span className="text-sm text-foreground">
                  <span className="inline-flex items-center rounded-full text-[11px] font-bold px-2.5 py-0.5 border border-border text-muted-foreground">{row.task?.status}</span>
                </span>
                <span className="text-xs text-foreground">{displayName(row.task?.assignedToUserId)}</span>
                <span className="text-xs text-foreground">{displayName(row.task?.createdByUserId)}</span>
                <span className="text-xs text-foreground">
                  {row.patient?.fullName ||
                    [row.patient?.firstName, row.patient?.lastName].filter(Boolean).join(' ') ||
                    tr('غير معروف', 'Unknown')}
                </span>
                <span className="text-xs text-foreground">{String(row.task?.encounterCoreId || '').slice(0, 8)}</span>
                <span className="text-sm text-foreground">
                  {row.deepLink ? (
                    <Button className="rounded-xl" size="sm" variant="outline" asChild>
                      <Link href={row.deepLink}>{tr('فتح', 'Open')}</Link>
                    </Button>
                  ) : null}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr('لا توجد مهام.', 'No tasks found.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
