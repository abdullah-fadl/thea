'use client';
import { useQuery } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardBody,
  CVisionBadge,
  CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionEmptyState, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { FileText, Inbox } from 'lucide-react';

export default function RequestsPage() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.selfService.list({ action: 'my-requests' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/self-service', { params: { action: 'my-requests' } }),
  });
  const requests = rawData?.ok ? (rawData.data || []) : [];

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const statusVariant = (s: string) => {
    if (s === 'APPROVED') return 'success' as const;
    if (s === 'REJECTED') return 'danger' as const;
    if (s === 'IN_PROGRESS') return 'info' as const;
    if (s === 'CANCELLED') return 'muted' as const;
    if (s === 'RETURNED') return 'warning' as const;
    return 'default' as const;
  };

  const stepColor = (action: string) => {
    if (action === 'APPROVED') return { bg: C.greenDim, color: C.green };
    if (action === 'REJECTED') return { bg: C.redDim, color: C.red };
    return { bg: C.bgSubtle, color: C.textMuted };
  };

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('طلباتي', 'My Requests')}
        titleEn={isRTL ? 'My Requests' : undefined}
        icon={FileText}
        isRTL={isRTL}
      />

      {requests.length === 0 ? (
        <CVisionEmptyState C={C} icon={Inbox} title={tr('لا توجد طلبات', 'No requests found.')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map((r: any) => (
            <CVisionCard key={r.instanceId} C={C} hover>
              <CVisionCardBody style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant="muted">{r.resourceType}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{r.workflowName || r.resourceType}</span>
                  <CVisionBadge C={C} variant={statusVariant(r.status)}>{r.status}</CVisionBadge>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>
                    {tr('الخطوة', 'Step')} {r.currentStep}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {new Date(r.startedAt).toLocaleDateString()}
                </div>
                {r.stepHistory && r.stepHistory.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {r.stepHistory.map((s: any, i: number) => {
                      const sc = stepColor(s.action);
                      return (
                        <span
                          key={i}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: sc.bg,
                            color: sc.color,
                            fontWeight: 500,
                          }}
                        >
                          {s.stepName || `${tr('خطوة', 'Step')} ${s.stepNumber}`} {s.action ? `(${s.action})` : '...'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}
    </CVisionPageLayout>
  );
}
