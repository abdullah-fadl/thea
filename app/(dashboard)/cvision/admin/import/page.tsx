'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

const MODULES = ['employees','departments','positions','payroll','leaves','loans','attendance','contracts'];

export default function ImportPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [module, setModule] = useState('employees');
  const [jobId, setJobId] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [errors, setErrors] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: historyData } = useQuery({
    queryKey: ['cvision', 'import', 'history'],
    queryFn: () => cvisionFetch<any>('/api/cvision/import', { params: { action: 'history' } }),
  });
  const history = historyData?.ok ? (historyData.data || []) : [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      const hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(','); const obj: any = {};
        hdrs.forEach((h, i) => { obj[h] = vals[i]?.trim().replace(/^"|"$/g, '') || ''; });
        return obj;
      });
      const d = await cvisionMutate<any>('/api/cvision/import', 'POST', { action: 'upload', module, fileName: file.name, headers: hdrs, rows });
      if (d.ok) { setJobId(d.data.jobId); setHeaders(d.data.headers); setPreview(d.data.previewRows); setTotalRows(d.data.totalRows); setStep(2); }
      else toast.error(d.error);
    } catch { toast.error(tr('فشل في تحليل الملف', 'Failed to parse file')); }
    setLoading(false);
  };

  const handleValidate = async () => {
    setLoading(true);
    const d = await cvisionMutate<any>('/api/cvision/import', 'POST', { action: 'validate', jobId, rows: preview });
    if (d.ok) { setErrors(d.data.errors || []); setStep(3); }
    setLoading(false);
  };

  const handleExecute = async () => {
    setLoading(true);
    const d = await cvisionMutate<any>('/api/cvision/import', 'POST', { action: 'execute', jobId, rows: preview, module });
    if (d.ok) { setResult(d.data); setStep(4); toast.success(tr(`تم استيراد ${d.data.success} صف`, `Imported ${d.data.success} rows`)); queryClient.invalidateQueries({ queryKey: ['cvision', 'import', 'history'] }); }
    setLoading(false);
  };

  const stepLabels = [tr('رفع', 'Upload'), tr('معاينة', 'Map'), tr('تحقق', 'Validate'), tr('استيراد', 'Import')];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('استيراد البيانات', 'Data Import')}
        titleEn="Data Import"
        icon={Upload}
        iconColor={C.blue}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => window.open(`/api/cvision/export?action=template&module=${module}`, '_blank')} icon={<Download size={14} />}>
            {tr('تحميل القالب', 'Download Template')}
          </CVisionButton>
        }
      />

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        {[1, 2, 3, 4].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, color: step >= s ? C.gold : C.textMuted, fontWeight: step >= s ? 600 : 400 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: step >= s ? C.gold : C.bgSubtle, color: step >= s ? '#fff' : C.textMuted }}>{s}</span>
            {stepLabels[s - 1]}
            {s < 4 && <span style={{ margin: '0 4px', color: C.textMuted }}>{'>'}</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('رفع الملف', 'Upload File')}</span>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tr('ملف CSV أو Excel', 'CSV or Excel file')}</div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionSelect C={C} value={module} onChange={setModule} options={MODULES.map(m => ({ value: m, label: m }))} label={tr('الوحدة', 'Module')} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 32, border: `2px dashed ${C.border}`, borderRadius: 12, cursor: 'pointer' }}>
              <FileSpreadsheet size={32} color={C.textMuted} />
              <div>
                <div style={{ fontWeight: 500, color: C.text }}>{tr('اضغط للرفع', 'Click to upload')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('ملفات CSV مدعومة', 'CSV files supported')}</div>
              </div>
              <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {step === 2 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معاينة', 'Preview')} ({totalRows} {tr('صف', 'rows')})</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                  {headers.map(h => <CVisionTh C={C} key={h}>{h}</CVisionTh>)}
                </CVisionTableHead>
                <CVisionTableBody>
                  {preview.map((r, i) => (
                    <CVisionTr C={C} key={i}>
                      {headers.map(h => <CVisionTd key={h} style={{ color: C.text, fontSize: 12 }}>{r[h]}</CVisionTd>)}
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <CVisionButton C={C} isDark={isDark} onClick={handleValidate} disabled={loading}>{tr('تحقق', 'Validate')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(1)}>{tr('رجوع', 'Back')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {step === 3 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نتائج التحقق', 'Validation Results')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            {errors.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, marginBottom: 12 }}>
                <CheckCircle2 size={20} />{tr('كل الصفوف صالحة', 'All rows valid')}
              </div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.red }}>
                    <AlertTriangle size={12} />{tr('صف', 'Row')} {e.row}: {e.field} — {e.error}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} onClick={handleExecute} disabled={loading}>{tr('تنفيذ الاستيراد', 'Execute Import')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStep(2)}>{tr('رجوع', 'Back')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {step === 4 && result && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('اكتمل الاستيراد', 'Import Complete')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{result.total}</div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('المجموع', 'Total')}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{result.success}</div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('نجاح', 'Success')}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{result.errors}</div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('أخطاء', 'Errors')}</div></div>
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setStep(1); setResult(null); setErrors([]); }}>{tr('استيراد جديد', 'New Import')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {history.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل الاستيراد', 'Import History')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map(h => (
              <div key={h.jobId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, borderBottom: `1px solid ${C.border}`, padding: '6px 0' }}>
                <CVisionBadge C={C} variant="muted">{h.module}</CVisionBadge>
                <span style={{ color: C.text }}>{h.fileName}</span>
                <span style={{ color: C.textMuted }}>{h.totalRows} {tr('صف', 'rows')}</span>
                <CVisionBadge C={C} variant={h.status === 'COMPLETED' ? 'success' : h.status === 'FAILED' ? 'danger' : 'warning'}>{h.status}</CVisionBadge>
                <span style={{ marginLeft: 'auto', color: C.textMuted }}>{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
