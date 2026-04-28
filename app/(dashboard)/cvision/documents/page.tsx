'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout, CVisionTabs, CVisionTabContent,
  CVisionDialog, CVisionDialogFooter, CVisionEmptyState,
  CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import type { CVisionTabItem } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  FileText, Search, AlertTriangle, HardDrive, Download,
  Trash2, Shield, FileImage, FileSpreadsheet, File,
} from 'lucide-react';

const api = (action: string, params?: Record<string, string>) => {
  return cvisionFetch<any>('/api/cvision/files', { params: { action, ...params } });
};
const post = (body: any) => cvisionMutate<any>('/api/cvision/files', 'POST', body);
const postExport = (body: any) => fetch('/api/cvision/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });

const catVariant: Record<string, 'info' | 'purple' | 'success' | 'warning' | 'danger' | 'muted'> = {
  NATIONAL_ID: 'info', PASSPORT: 'purple', CERTIFICATE: 'success', CONTRACT: 'warning',
  LETTER: 'info', PHOTO: 'danger', CV: 'purple', MEDICAL: 'danger',
  INSURANCE: 'warning', LICENSE: 'info', OTHER: 'muted',
};

const accessVariant: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  PUBLIC: 'success', INTERNAL: 'info', RESTRICTED: 'warning', CONFIDENTIAL: 'danger',
};

const fileIcon = (ext: string) => {
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  return File;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---- All Files Tab ---- */
function AllFilesTab({ C, isDark, tr }: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [filterCat, setFilterCat] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const filesQuery = useQuery({
    queryKey: cvisionKeys.documents.list({ action: 'list', category: filterCat }),
    queryFn: () => {
      const params: any = {};
      if (filterCat !== 'all') params.category = filterCat;
      return api('list', params);
    },
  });
  const loading = filesQuery.isLoading;
  useEffect(() => { if (filesQuery.data) setFiles(filesQuery.data.files || []); }, [filesQuery.data]);

  const filtered = searchQ
    ? files.filter(f => f.fileName?.toLowerCase().includes(searchQ.toLowerCase()) || f.recordName?.toLowerCase().includes(searchQ.toLowerCase()))
    : files;

  if (loading) return <><CVisionSkeletonStyles />{[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={56} style={{ marginBottom: 6 }} />)}</>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <CVisionInput C={C} placeholder={tr('بحث في الملفات...', 'Search files...')} icon={<Search size={14} />} value={searchQ} onChange={e => setSearchQ(e.target.value)} containerStyle={{ flex: 1, minWidth: 200 }} />
        <CVisionSelect C={C} value={filterCat} onChange={setFilterCat} style={{ width: 160 }}
          options={[{ value: 'all', label: tr('جميع الفئات', 'All Categories') }, ...['NATIONAL_ID','PASSPORT','CERTIFICATE','CONTRACT','LETTER','PHOTO','CV','MEDICAL','INSURANCE','LICENSE','OTHER'].map(c => ({ value: c, label: c.replace('_', ' ') }))]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(f => {
          const Icon = fileIcon(f.extension || '');
          const isExpiringSoon = f.hasExpiry && f.expiryDate && new Date(f.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const isExpired = f.hasExpiry && f.expiryDate && new Date(f.expiryDate) < new Date();
          return (
            <CVisionCard key={f.fileId} C={C} onClick={() => setSelected(f)}
              style={isExpired ? { borderColor: C.red + '40' } : isExpiringSoon ? { borderColor: C.orange + '40' } : undefined}
            >
              <CVisionCardBody style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon size={18} color={C.textMuted} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.originalName || f.fileName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMuted }}>
                    <span>{f.recordName}</span><span>&middot;</span><span>{formatSize(f.size || 0)}</span><span>&middot;</span><span>v{f.version || 1}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <CVisionBadge C={C} variant={catVariant[f.category] || 'muted'}>{f.category?.replace('_', ' ')}</CVisionBadge>
                  <CVisionBadge C={C} variant={accessVariant[f.accessLevel] || 'muted'}>{f.accessLevel}</CVisionBadge>
                  {isExpired && <CVisionBadge C={C} variant="danger">{tr('منتهي', 'EXPIRED')}</CVisionBadge>}
                  {isExpiringSoon && !isExpired && <CVisionBadge C={C} variant="warning">{tr('ينتهي قريبا', 'EXPIRING')}</CVisionBadge>}
                  {f.confidential && <Shield size={14} color={C.red} />}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      <CVisionDialog C={C} open={!!selected} onClose={() => setSelected(null)} title={selected?.originalName || selected?.fileName}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
              <div><span style={{ color: C.textMuted }}>{tr('رقم الملف', 'File ID')}:</span> <span style={{ color: C.text }}>{selected.fileId}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('النوع', 'Type')}:</span> <span style={{ color: C.text }}>{selected.mimeType}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الحجم', 'Size')}:</span> <span style={{ color: C.text }}>{formatSize(selected.size || 0)}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الإصدار', 'Version')}:</span> <span style={{ color: C.text }}>{selected.version}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الوحدة', 'Module')}:</span> <span style={{ color: C.text }}>{selected.module}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('السجل', 'Record')}:</span> <span style={{ color: C.text }}>{selected.recordName}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الفئة', 'Category')}:</span> <CVisionBadge C={C} variant={catVariant[selected.category] || 'muted'}>{selected.category}</CVisionBadge></div>
              <div><span style={{ color: C.textMuted }}>{tr('الوصول', 'Access')}:</span> <CVisionBadge C={C} variant={accessVariant[selected.accessLevel] || 'muted'}>{selected.accessLevel}</CVisionBadge></div>
              {selected.hasExpiry && <div style={{ gridColumn: 'span 2' }}><span style={{ color: C.textMuted }}>{tr('انتهاء الصلاحية', 'Expiry')}:</span> <span style={{ color: C.text }}>{new Date(selected.expiryDate).toLocaleDateString()}</span></div>}
              <div><span style={{ color: C.textMuted }}>{tr('الفحص', 'Scan')}:</span> <CVisionBadge C={C} variant="muted">{selected.scanStatus}</CVisionBadge></div>
              <div><span style={{ color: C.textMuted }}>OCR:</span> <span style={{ color: C.text }}>{selected.ocrProcessed ? tr('نعم', 'Yes') : tr('لا', 'No')}</span></div>
            </div>
            {selected.ocrText && <div style={{ fontSize: 11 }}><span style={{ color: C.textMuted }}>OCR:</span> <span style={{ background: C.bgSubtle, padding: '2px 6px', borderRadius: 6, color: C.text }}>{selected.ocrText}</span></div>}
            {selected.description && <p style={{ fontSize: 11, color: C.textMuted }}>{selected.description}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Download size={14} />}>{tr('تحميل', 'Download')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={async () => {
                await post({ action: 'delete', fileId: selected.fileId });
                toast.success(tr('تم حذف الملف', 'File deleted'));
                setSelected(null); filesQuery.refetch();
              }}>{tr('حذف', 'Delete')}</CVisionButton>
            </div>
          </div>
        )}
      </CVisionDialog>
    </div>
  );
}

/* ---- Expiring Files Tab ---- */
function ExpiringTab({ C, isDark, tr }: any) {
  const expiringQuery = useQuery({
    queryKey: cvisionKeys.documents.list({ action: 'expiring', days: '60' }),
    queryFn: () => api('expiring', { days: '60' }),
  });
  const files = expiringQuery.data?.files || [];
  const loading = expiringQuery.isLoading;

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={160} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {files.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 13 }}>{tr('لا توجد مستندات تنتهي صلاحيتها خلال 60 يوم', 'No expiring documents in the next 60 days')}</div>}
      {files.map(f => {
        const isExpired = new Date(f.expiryDate) < new Date();
        const daysLeft = Math.ceil((new Date(f.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <CVisionCard key={f.fileId} C={C} hover={false} style={{ borderColor: isExpired ? C.red + '40' : C.orange + '40' }}>
            <CVisionCardBody style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={16} color={isExpired ? C.red : C.orange} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{f.originalName || f.fileName}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{f.recordName} &middot; {f.category?.replace('_', ' ')}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isExpired ? C.red : C.orange }}>
                  {isExpired ? `${Math.abs(daysLeft)}${tr('ي متأخر', 'd overdue')}` : `${daysLeft}${tr('ي متبقي', 'd left')}`}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(f.expiryDate).toLocaleDateString()}</div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        );
      })}
    </div>
  );
}

/* ---- Storage Tab ---- */
function StorageTab({ C, isDark, tr }: any) {
  const storageQuery = useQuery({
    queryKey: cvisionKeys.documents.list({ action: 'storage-usage' }),
    queryFn: () => api('storage-usage'),
  });
  const usage = storageQuery.data || null;
  const loading = storageQuery.isLoading;

  if (loading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={160} /></>;
  if (!usage) return null;

  const pct = usage.usedPercentage || 0;
  const barColor = pct > 80 ? C.red : pct > 50 ? C.orange : C.green;

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      <CVisionCard C={C} hover={false}>
        <CVisionCardBody style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textMuted, marginBottom: 4 }}><HardDrive size={12} /> {tr('المساحة المستخدمة', 'Storage Used')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{formatSize(usage.totalSize || 0)}</div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 4, background: C.barTrack, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: barColor, width: `${pct}%`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{pct}% {tr('من', 'of')} {formatSize(usage.quota || 0)}</div>
        </CVisionCardBody>
      </CVisionCard>
      <CVisionCard C={C} hover={false}>
        <CVisionCardBody style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr('إجمالي الملفات', 'Total Files')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{usage.fileCount || 0}</div>
        </CVisionCardBody>
      </CVisionCard>
      <CVisionCard C={C} hover={false}>
        <CVisionCardBody style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr('المتبقي', 'Remaining')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{formatSize(usage.remaining || 0)}</div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

/* ---- Export Section ---- */
function ExportSection({ C, isDark, tr }: any) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'EXCEL' | 'CSV' | 'PDF') => {
    setExporting(true);
    try {
      const j = await api('list');
      const files = j.files || [];
      const res = await postExport({
        action: 'export-table', format, module: 'documents',
        title: tr('مكتبة المستندات', 'Document Library'), includeLetterhead: format === 'PDF',
        columns: [
          { field: 'fileId', header: tr('رقم الملف', 'File ID'), width: 12 },
          { field: 'originalName', header: tr('اسم الملف', 'File Name'), width: 30 },
          { field: 'recordName', header: tr('الموظف', 'Employee'), width: 20 },
          { field: 'category', header: tr('الفئة', 'Category'), width: 15 },
          { field: 'sizeFormatted', header: tr('الحجم', 'Size'), width: 10 },
          { field: 'expiryFormatted', header: tr('انتهاء الصلاحية', 'Expiry'), width: 15 },
        ],
        data: files.map((f: any) => ({ ...f, sizeFormatted: formatSize(f.size || 0), expiryFormatted: f.expiryDate ? new Date(f.expiryDate).toLocaleDateString() : '\u2014' })),
      });

      if (format !== 'PDF') {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `documents_${new Date().toISOString().slice(0, 10)}.${format === 'EXCEL' ? 'xml' : 'csv'}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
      }
      toast.success(tr(`تم التصدير كـ ${format}`, `Exported as ${format}`));
    } finally { setExporting(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<FileSpreadsheet size={14} />} onClick={() => handleExport('EXCEL')} disabled={exporting}>Excel</CVisionButton>
      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<FileText size={14} />} onClick={() => handleExport('CSV')} disabled={exporting}>CSV</CVisionButton>
      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<FileText size={14} />} onClick={() => handleExport('PDF')} disabled={exporting}>PDF</CVisionButton>
    </div>
  );
}

/* ---- Main Page ---- */
export default function DocumentsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [activeTab, setActiveTab] = useState('all');

  const tabs: CVisionTabItem[] = [
    { id: 'all', label: tr('جميع الملفات', 'All Files'), icon: <FileText size={14} /> },
    { id: 'expiring', label: tr('تنتهي قريبا', 'Expiring'), icon: <AlertTriangle size={14} /> },
    { id: 'storage', label: tr('التخزين', 'Storage'), icon: <HardDrive size={14} /> },
  ];

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('مكتبة المستندات', 'Document Library')}
        titleEn="Document Library"
        subtitle={tr('إدارة الملفات — ملفات، تتبع انتهاء الصلاحية، تخزين وبحث OCR', 'Files, expiry tracking, storage & OCR search')}
        icon={FileText}
        isRTL={isRTL}
        actions={<ExportSection C={C} isDark={isDark} tr={tr} />}
      />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />
      <div style={{ marginTop: 16 }}>
        <CVisionTabContent id="all" activeTab={activeTab}><AllFilesTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
        <CVisionTabContent id="expiring" activeTab={activeTab}><ExpiringTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
        <CVisionTabContent id="storage" activeTab={activeTab}><StorageTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      </div>
    </CVisionPageLayout>
  );
}
