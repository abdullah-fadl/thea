'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Zap, PlayCircle, Eye, Loader2 } from 'lucide-react';

const OPERATIONS = [
  { value: 'bulk_status_change', label: 'Status Change', labelAr: 'تغيير الحالة', params: ['newStatus'] },
  { value: 'bulk_department_transfer', label: 'Department Transfer', labelAr: 'نقل القسم', params: ['departmentId', 'departmentName'] },
  { value: 'bulk_salary_update', label: 'Salary Update', labelAr: 'تحديث الراتب', params: ['type', 'value'] },
  { value: 'bulk_leave_balance', label: 'Leave Balance', labelAr: 'رصيد الإجازات', params: ['leaveType', 'adjustment'] },
  { value: 'bulk_training_enroll', label: 'Training Enrollment', labelAr: 'تسجيل التدريب', params: ['courseId'] },
  { value: 'bulk_notification', label: 'Send Notification', labelAr: 'إرسال إشعار', params: ['title', 'body'] },
  { value: 'bulk_field_update', label: 'Field Update', labelAr: 'تحديث الحقل', params: ['field', 'value'] },
];

export default function BulkOperationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const [operation, setOperation] = useState('');
  const [targetIds, setTargetIds] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ['cvision', 'bulk', 'history'],
    queryFn: () => cvisionFetch<any>('/api/cvision/bulk', { params: { action: 'history' } }),
  });
  const history = historyData?.ok ? (historyData.data || []) : [];

  const ids = targetIds.split(/[,\n]/).map(s => s.trim()).filter(Boolean);

  const dryRun = async () => {
    setLoading(true); setResult(null);
    try {
      const d = await cvisionMutate<any>('/api/cvision/bulk', 'POST', { action: 'execute', operation, targetIds: ids, parameters: params, dryRun: true });
      setPreview(d.data);
    } catch {}
    setLoading(false);
  };

  const execute = async () => {
    setLoading(true);
    try {
      const d = await cvisionMutate<any>('/api/cvision/bulk', 'POST', { action: 'execute', operation, targetIds: ids, parameters: params, dryRun: false });
      setResult(d.data); setPreview(null);
      queryClient.invalidateQueries({ queryKey: ['cvision', 'bulk', 'history'] });
    } catch {}
    setLoading(false);
  };

  const opConfig = OPERATIONS.find(o => o.value === operation);

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('العمليات الجماعية', 'Bulk Operations')} titleEn="Bulk Operations" icon={Zap} iconColor={C.orange} isRTL={isRTL} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إعداد العملية', 'Configure Operation')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionSelect
              C={C}
              value={operation}
              onChange={v => { setOperation(v); setParams({}); setPreview(null); setResult(null); }}
              options={OPERATIONS.map(o => ({ value: o.value, label: tr(o.labelAr, o.label) }))}
              label={tr('العملية', 'Operation')}
            />

            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{tr('أرقام الموظفين', 'Employee IDs (comma or newline separated)')}</div>
              <textarea
                style={{
                  width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, fontSize: 13,
                  minHeight: 80, background: C.bgCard, color: C.text, resize: 'vertical',
                }}
                value={targetIds}
                onChange={e => setTargetIds(e.target.value)}
                placeholder="EMP-001, EMP-002, EMP-003"
              />
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{ids.length} {tr('موظف محدد', 'employee(s) selected')}</div>
            </div>

            {opConfig && opConfig.params.map(p => (
              <div key={p}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4, textTransform: 'capitalize' }}>{p.replace(/([A-Z])/g, ' $1')}</div>
                <CVisionInput C={C} value={params[p] || ''} onChange={(e: any) => setParams(prev => ({ ...prev, [p]: e.target.value }))} placeholder={p} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={dryRun} disabled={!operation || ids.length === 0 || loading} icon={<Eye size={14} />}>
                {tr('معاينة (تجربة)', 'Preview (Dry Run)')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={execute} disabled={!operation || ids.length === 0 || loading} icon={loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <PlayCircle size={14} />}>
                {tr('تنفيذ', 'Execute')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {preview && (
            <CVisionCard C={C} style={{ border: `1px solid ${C.blue}40` }}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>{tr('معاينة', 'Preview')}</span>
              </CVisionCardHeader>
              <CVisionCardBody style={{ fontSize: 13, color: C.text, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>{tr('العملية:', 'Operation:')}</strong> {preview.operation}</div>
                <div><strong>{tr('الأهداف:', 'Targets:')}</strong> {preview.targetCount}</div>
                <div><strong>{tr('سيتأثر:', 'Will Affect:')}</strong> {preview.affectedCount} {tr('سجل', 'records')}</div>
                <div><strong>{tr('المعاملات:', 'Parameters:')}</strong> {JSON.stringify(preview.parameters)}</div>
              </CVisionCardBody>
            </CVisionCard>
          )}
          {result && (
            <CVisionCard C={C} style={{ border: `1px solid ${result.failCount > 0 ? C.orange : C.green}40` }}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: result.failCount > 0 ? C.orange : C.green }}>
                  {result.failCount > 0 ? tr('نجاح جزئي', 'Partial Success') : tr('نجاح', 'Success')}
                </span>
              </CVisionCardHeader>
              <CVisionCardBody style={{ fontSize: 13, color: C.text, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>{tr('نجاح:', 'Success:')}</strong> {result.successCount}</div>
                <div><strong>{tr('فشل:', 'Failed:')}</strong> {result.failCount}</div>
                {result.errors?.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {result.errors.map((e: string, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: C.red }}>{e}</div>
                    ))}
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
      </div>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل العمليات', 'Operation History')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('العملية', 'Operation')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>{tr('نجاح', 'Success')}</CVisionTh>
              <CVisionTh C={C}>{tr('فشل', 'Failed')}</CVisionTh>
              <CVisionTh C={C}>{tr('بواسطة', 'By')}</CVisionTh>
              <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {history.map((h: any) => (
                <CVisionTr C={C} key={h.jobId}>
                  <CVisionTd style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>{h.operation}</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant={h.status === 'COMPLETED' ? 'success' : 'danger'}>{h.status}</CVisionBadge></CVisionTd>
                  <CVisionTd style={{ color: C.green, fontSize: 13 }}>{h.successCount}</CVisionTd>
                  <CVisionTd style={{ color: C.red, fontSize: 13 }}>{h.failCount}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted, fontSize: 13 }}>{h.executedByName}</CVisionTd>
                  <CVisionTd style={{ color: C.textMuted, fontSize: 13 }}>{h.startedAt ? new Date(h.startedAt).toLocaleDateString() : ''}</CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
