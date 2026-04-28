'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface PreviewData {
  columns: string[];
  rows: any[][];
  totalRows: number;
}

export default function DataAdmin() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [file, setFile] = useState<File | null>(null);
  const [collection, setCollection] = useState('opd_census');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await previewFile(selectedFile);
    }
  }

  async function previewFile(file: File) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/data-import/preview', {
        credentials: 'include',
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  }

  async function handleImport() {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collection', collection);

      const response = await fetch('/api/admin/data-import', {
        credentials: 'include',
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr(`تم استيراد ${data.imported} سجل بنجاح`, `Imported ${data.imported} records successfully`),
        });
        setFile(null);
        setPreview(null);
      } else {
        throw new Error(data.error || tr('فشل الاستيراد', 'Import failed'));
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل الاستيراد', 'Import failed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleExport() {
    try {
      const response = await fetch(
        `/api/admin/data-export?collection=${collection}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collection}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: tr('نجاح', 'Success'),
          description: tr('تم تصدير البيانات بنجاح', 'Data exported successfully'),
        });
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل التصدير', 'Export failed'),
        variant: 'destructive',
      });
    }
  }

  const collectionLabels: Record<string, string> = {
    opd_census: tr('إحصاء العيادات الخارجية', 'OPD Census'),
    departments: tr('الأقسام', 'Departments'),
    clinics: tr('العيادات', 'Clinics'),
    equipment: tr('المعدات', 'Equipment'),
    equipment_mapping: tr('تخطيط المعدات', 'Equipment Mapping'),
    beds: tr('الأسرّة', 'Beds'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tr('إدارة البيانات', 'Data Admin')}</h1>
        <p className="text-muted-foreground">{tr('استيراد وتصدير البيانات بكميات كبيرة', 'Import and export data in bulk')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {tr('استيراد البيانات', 'Import Data')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tr('رفع ملفات Excel لاستيراد البيانات إلى المجموعات', 'Upload Excel files to import data into collections')}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المجموعة المستهدفة', 'Target Collection')}</span>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(collectionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملف Excel', 'Excel File')}</span>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="rounded-xl thea-input-focus"
              />
            </div>

            {preview && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {tr(`معاينة: ${preview.totalRows} صف`, `Preview: ${preview.totalRows} rows found`)}
                </p>
                <Button
                  onClick={handleImport}
                  disabled={isUploading}
                  className="w-full rounded-xl"
                >
                  {isUploading ? tr('جاري الاستيراد...', 'Importing...') : tr('استيراد البيانات', 'Import Data')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Export Section */}
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Download className="h-5 w-5" />
              {tr('تصدير البيانات', 'Export Data')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tr('تنزيل البيانات من المجموعات كملفات Excel', 'Download data from collections as Excel files')}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المجموعة المصدر', 'Source Collection')}</span>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(collectionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleExport} className="w-full rounded-xl">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {tr('تصدير إلى Excel', 'Export to Excel')}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      {preview && (
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {tr('معاينة البيانات', 'Data Preview')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tr(`عرض أول 5 صفوف من ${preview.totalRows} إجمالي`, `Showing first 5 rows of ${preview.totalRows} total`)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${preview.columns.length}, minmax(120px, 1fr))` }}>
                {preview.columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2"
                  >
                    {col}
                  </span>
                ))}
              </div>
              {/* Data Rows */}
              {preview.rows.slice(0, 5).map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className="grid thea-hover-lift thea-transition-fast rounded-xl"
                  style={{ gridTemplateColumns: `repeat(${preview.columns.length}, minmax(120px, 1fr))` }}
                >
                  {row.map((cell, cellIdx) => (
                    <span key={cellIdx} className="px-3 py-2 text-sm text-foreground">
                      {cell !== null && cell !== undefined ? String(cell) : '-'}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
