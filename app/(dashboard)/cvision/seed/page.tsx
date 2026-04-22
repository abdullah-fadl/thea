'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Database, Trash2, Play, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function SeedDataPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [lastResult, setLastResult] = useState<any>(null);

  const { data: statusData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.seed.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/seed', { params: { action: 'seed-status' } }),
  });
  const status = statusData?.ok ? statusData : null;

  const generateMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/seed', 'POST', { action: 'generate-demo', force: true }),
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(tr('تم إنشاء البيانات التجريبية بنجاح', 'Demo data generated successfully'));
        setLastResult(data.summary);
        queryClient.invalidateQueries({ queryKey: cvisionKeys.seed.all });
      } else {
        toast.error(data.error || tr('فشل الإنشاء', 'Generation failed'));
      }
    },
    onError: () => toast.error(tr('خطأ في الشبكة', 'Network error')),
  });
  const generating = generateMutation.isPending;

  const clearMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/seed', 'POST', { action: 'clear-all', confirm: true }),
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(tr('تم مسح جميع البيانات', 'All data cleared'));
        setLastResult(null);
        queryClient.invalidateQueries({ queryKey: cvisionKeys.seed.all });
      } else {
        toast.error(data.error || tr('فشل المسح', 'Clear failed'));
      }
    },
    onError: () => toast.error(tr('خطأ في الشبكة', 'Network error')),
  });
  const clearing = clearMutation.isPending;

  const handleGenerate = () => generateMutation.mutate();
  const handleClear = () => {
    if (!window.confirm(tr('سيتم حذف جميع بيانات CVision لمنشأتك نهائيا. هل أنت متأكد؟', 'This will permanently delete ALL CVision data for your tenant. Are you sure?'))) return;
    clearMutation.mutate();
  };

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonCard C={C} height={40} style={{ maxWidth: 300 }} />
        <CVisionSkeletonCard C={C} height={160} />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout style={{ maxWidth: 720 }}>
      <CVisionPageHeader C={C} title={tr('مدير البيانات التجريبية', 'Demo Data Manager')} titleEn="Demo Data Manager" icon={Database} isRTL={isRTL}
        subtitle={tr('إنشاء أو مسح بيانات تجريبية للاختبار والعروض', 'Generate or clear sample data for testing and demos.')}
      />

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={18} color={C.gold} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('حالة البيانات الحالية', 'Current Data Status')}</span>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            {status?.hasData ? tr('البيانات التجريبية موجودة في النظام.', 'Demo data is present in the system.') : tr('لم يتم العثور على بيانات تجريبية.', 'No demo data found.')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {status?.hasData ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CVisionBadge C={C} variant="muted">{tr('الموظفون', 'Employees')}: {status.counts.employees}</CVisionBadge>
              <CVisionBadge C={C} variant="muted">{tr('الحضور', 'Attendance')}: {status.counts.attendance}</CVisionBadge>
              <CVisionBadge C={C} variant="muted">{tr('الأقسام', 'Departments')}: {status.counts.departments}</CVisionBadge>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 13 }}>
              <AlertTriangle size={16} color={C.orange} />
              <span>{tr('لم يتم العثور على بيانات. أنشئ بيانات تجريبية للبدء.', 'No data found. Generate demo data to get started.')}</span>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={18} color={C.green} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء بيانات تجريبية', 'Generate Demo Data')}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {tr('ينشئ 50 موظف مع 6 أشهر من السجلات', 'Creates 50 employees with 6 months of history including attendance, leaves, payroll, jobs, and candidates.')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleGenerate} loading={generating} style={{ width: '100%' }}
              icon={generating ? undefined : <Play size={14} />}
            >
              {generating ? tr('جاري الإنشاء...', 'Generating...') : tr('إنشاء البيانات التجريبية', 'Generate Demo Data')}
            </CVisionButton>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trash2 size={18} color={C.red} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مسح جميع البيانات', 'Clear All Data')}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {tr('يحذف جميع بيانات CVision لهذه المنشأة نهائيا.', 'Permanently removes all CVision data for this tenant. This action cannot be undone.')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleClear} loading={clearing} disabled={!status?.hasData}
              style={{ width: '100%' }} icon={clearing ? undefined : <Trash2 size={14} />}
            >
              {clearing ? tr('جاري المسح...', 'Clearing...') : tr('مسح جميع البيانات', 'Clear All Data')}
            </CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {lastResult && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} color={C.green} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نتيجة آخر إنشاء', 'Last Generation Result')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              {Object.entries(lastResult).map(([key, val]) => (
                <div key={key} style={{ background: C.bgSubtle, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{val as number}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, textTransform: 'capitalize' }}>{key}</div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
