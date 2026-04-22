'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import useSWR from 'swr';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function DowntimePack() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me, isLoading } = useMe();
  const activeTenantId = me?.tenantId || null;
  const { data: tenantUserData } = useSWR(activeTenantId ? '/api/access/tenant-user' : null, fetcher, {
    refreshInterval: 0,
  });
  const tenantRoles = Array.isArray(tenantUserData?.tenantUser?.roles)
    ? tenantUserData.tenantUser.roles.map((r: any) => String(r || '').toLowerCase())
    : [];
  const tenantIsAdminDev = tenantRoles.includes('admin') || tenantRoles.includes('dev');

  const isChargeOrDev = canAccessChargeConsole({
    email: me?.user?.email,
    tenantId: activeTenantId,
    role: me?.user?.role,
  });

  const allowed = tenantIsAdminDev || isChargeOrDev;

  const [episodeId, setEpisodeId] = useState('');
  const [patientId, setPatientId] = useState('');

  const links = useMemo(() => {
    const episode = String(episodeId || '').trim();
    const patient = String(patientId || '').trim();
    return {
      continuity: episode ? `/ipd/episode/${encodeURIComponent(episode)}/continuity` : null,
      journey: patient ? `/patient/${encodeURIComponent(patient)}/journey` : null,
      statement: '/billing/statement',
    };
  }, [episodeId, patientId]);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>;
  }

  if (!allowed) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="rounded-2xl border-destructive/40">
          <CardHeader>
            <CardTitle>{tr('غير مصرح', 'Forbidden')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tr('هذه الصفحة مخصصة للمشرف (Charge) أو admin/dev.', 'This page is restricted to Charge or admin/dev.')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = tr('حزمة الانقطاع (جاهزة للطباعة)', 'Downtime Pack (Print-ready)');

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Button onClick={() => window.print()}>{tr('طباعة', 'Print')}</Button>
      </div>

      <div className="mt-4 space-y-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{tr('تعليمات سريعة', 'Quick instructions')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              {tr('وضع الانقطاع: قراءة فقط. استخدم "طباعة الاستمرارية" للحفاظ على استمرارية الرعاية.', 'Offline mode: read-only. Use continuity print to maintain care continuity.')}
            </p>
            <p className="text-muted-foreground">
              {tr('ملاحظة: هذه الصفحة لا تقوم بأي حفظ/كتابة في قاعدة البيانات.', 'Note: this page performs no database writes.')}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl print:hidden">
          <CardHeader>
            <CardTitle className="text-base">{tr('اختصارات الروابط', 'Link shortcuts')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tr('Episode ID (اختياري)', 'Episode ID (optional)')}</Label>
              <Input value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} placeholder="e.g. EP-123" />
            </div>
            <div className="space-y-2">
              <Label>{tr('Patient ID (اختياري)', 'Patient ID (optional)')}</Label>
              <Input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="e.g. PT-456" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{tr('روابط الاستمرارية', 'Continuity links')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <div className="font-medium">{tr('طباعة الاستمرارية (IPD)', 'IPD Continuity Print')}</div>
              <div className="text-muted-foreground">
                {links.continuity || (tr('أدخل Episode ID لإنشاء الرابط', 'Enter Episode ID to generate link'))}
              </div>
              {links.continuity ? (
                <Link className="underline print:hidden" href={links.continuity}>
                  {tr('فتح', 'Open')}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground print:hidden">
                  {tr('الرابط غير متاح', 'Link unavailable')}
                </span>
              )}
            </div>
            <div>
              <div className="font-medium">{tr('رحلة المريض', 'Patient Journey')}</div>
              <div className="text-muted-foreground">
                {links.journey || (tr('أدخل Patient ID لإنشاء الرابط', 'Enter Patient ID to generate link'))}
              </div>
              {links.journey ? (
                <Link className="underline print:hidden" href={links.journey}>
                  {tr('فتح', 'Open')}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground print:hidden">
                  {tr('الرابط غير متاح', 'Link unavailable')}
                </span>
              )}
            </div>
            <div>
              <div className="font-medium">{tr('بحث كشف الفاتورة', 'Billing Statement Lookup')}</div>
              <div className="text-muted-foreground">{links.statement}</div>
              <Link className="underline print:hidden" href={links.statement}>
                {tr('فتح', 'Open')}
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{tr('نموذج حادث انقطاع (فارغ)', 'Downtime incident form (blank)')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="font-medium">{tr('بدأ في', 'Started at')}</div>
                <div className="border rounded-xl h-10 mt-1" />
              </div>
              <div>
                <div className="font-medium">{tr('انتهى في', 'Ended at')}</div>
                <div className="border rounded-xl h-10 mt-1" />
              </div>
            </div>
            <div>
              <div className="font-medium">{tr('ملاحظات', 'Notes')}</div>
              <div className="border rounded-xl h-24 mt-1" />
            </div>
            <div>
              <div className="font-medium">{tr('تمت الموافقة بواسطة', 'Approved by')}</div>
              <div className="border rounded-xl h-10 mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">{tr('نموذج تسليم مناوبة (فارغ)', 'Handover form (blank)')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="font-medium">{tr('من', 'From')}</div>
                <div className="border rounded-xl h-10 mt-1" />
              </div>
              <div>
                <div className="font-medium">{tr('إلى', 'To')}</div>
                <div className="border rounded-xl h-10 mt-1" />
              </div>
            </div>
            <div>
              <div className="font-medium">{tr('ملخص', 'Summary')}</div>
              <div className="border rounded-xl h-24 mt-1" />
            </div>
            <div>
              <div className="font-medium">{tr('مهام/أدوية/تنبيهات', 'Tasks / meds / alerts')}</div>
              <div className="border rounded-xl h-24 mt-1" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
