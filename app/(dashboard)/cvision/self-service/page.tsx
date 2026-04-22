'use client';
import { useQuery } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardBody,
  CVisionButton,
  CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { CalendarDays, CreditCard, FileText, GraduationCap, BellRing, Briefcase, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export default function SelfServicePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.selfService.list({ action: 'dashboard' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/self-service', { params: { action: 'dashboard' } }),
  });
  const data = rawData?.ok ? rawData.data : null;

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={40} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <CVisionSkeletonCard C={C} height={100} />
        <CVisionSkeletonCard C={C} height={100} />
        <CVisionSkeletonCard C={C} height={100} />
        <CVisionSkeletonCard C={C} height={100} />
      </div>
    </CVisionPageLayout>
  );

  const bal = data?.leaveBalance || {};
  const emp = data?.employee || {};
  const lastReq = data?.lastRequest;

  const quickActions = [
    { href: '/cvision/self-service/leaves', icon: CalendarDays, label: tr('طلب اجازة', 'Request Leave'), color: C.blue },
    { href: '/cvision/letters', icon: FileText, label: tr('طلب خطاب', 'Request Letter'), color: C.green },
    { href: '/cvision/self-service/requests', icon: CreditCard, label: tr('طلب سلفة', 'Request Loan'), color: C.orange },
    { href: '/cvision/training', icon: GraduationCap, label: tr('التدريب', 'Training'), color: C.purple },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('بوابة الخدمة الذاتية', 'Self-Service Portal')}
        titleEn={isRTL ? 'Self-Service Portal' : undefined}
        subtitle={`${emp.name || tr('موظف', 'Employee')} — ${emp.jobTitle || ''}, ${emp.department || ''}`}
        icon={LayoutGrid}
        isRTL={isRTL}
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('رصيد الاجازات (ايام)', 'Leave Balance (days)')} value={bal.remaining ?? bal.annual ?? 21} icon={CalendarDays} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('اشعارات غير مقروءة', 'Unread Notifications')} value={data?.unreadNotifications ?? 0} icon={BellRing} color={C.red} colorDim={C.redDim} />
        <CVisionCard C={C} style={{ flex: '1 1 140px' }}>
          <CVisionCardBody style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: C.orangeDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Briefcase size={18} color={C.orange} strokeWidth={1.8} />
            </div>
            <div>
              {lastReq ? (
                <>
                  <CVisionBadge C={C} variant={lastReq.status === 'APPROVED' ? 'success' : lastReq.status === 'REJECTED' ? 'danger' : 'warning'}>
                    {lastReq.status}
                  </CVisionBadge>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{lastReq.type}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('لا توجد طلبات اخيرة', 'No recent requests')}</div>
              )}
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionMiniStat C={C} label={tr('المستندات', 'Documents')} labelEn={isRTL ? 'Documents' : undefined} value={tr('عرض', 'View')} icon={FileText} color={C.green} colorDim={C.greenDim} />
      </CVisionStatsRow>

      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginTop: 8 }}>
        {tr('اجراءات سريعة', 'Quick Actions')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {quickActions.map(qa => (
          <Link key={qa.href} href={qa.href} style={{ textDecoration: 'none' }}>
            <CVisionCard C={C} hover style={{ cursor: 'pointer' }}>
              <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                <qa.icon size={22} color={qa.color} strokeWidth={1.6} />
                <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{qa.label}</span>
              </CVisionCardBody>
            </CVisionCard>
          </Link>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
