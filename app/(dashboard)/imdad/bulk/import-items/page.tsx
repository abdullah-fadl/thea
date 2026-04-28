'use client';

import { useState, useCallback, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useMutation } from '@tanstack/react-query';
import {
  Upload, FileUp, Download, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileText, Trash2,
} from 'lucide-react';

interface ParsedItem {
  code: string;
  name: string;
  nameAr?: string;
  itemType: string;
  organizationId: string;
  standardCost?: number;
  manufacturer?: string;
  [key: string]: any;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

const ITEM_TYPES = [
  'PHARMACEUTICAL', 'MEDICAL_SUPPLY', 'MEDICAL_DEVICE', 'LABORATORY',
  'SURGICAL', 'GENERAL', 'FOOD_SERVICE', 'MAINTENANCE',
  'IT_EQUIPMENT', 'FURNITURE', 'LINEN', 'CLEANING', 'IMPLANT', 'REAGENT',
];

const TEMPLATE_COLUMNS = [
  'code', 'name', 'nameAr', 'itemType', 'organizationId', 'description',
  'genericName', 'brandName', 'barcode', 'standardCost', 'manufacturer',
  'countryOfOrigin', 'isCritical', 'isControlled', 'requiresColdChain',
];

export default function BulkImportItemsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSV = (text: string): ParsedItem[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error(tr('الملف فارغ', 'File is empty'));
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const items: ParsedItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const val = values[idx] ?? '';
        if (val === '') return;
        if (['standardCost', 'lastPurchaseCost', 'taxRate'].includes(h)) {
          row[h] = parseFloat(val);
        } else if (['isCritical', 'isControlled', 'requiresColdChain', 'expiryTracked'].includes(h)) {
          row[h] = val.toLowerCase() === 'true' || val === '1';
        } else {
          row[h] = val;
        }
      });
      if (row.code && row.name) items.push(row as ParsedItem);
    }
    return items;
  };

  const handleFile = useCallback((file: File) => {
    setParseError('');
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const items = Array.isArray(data) ? data : data.items ?? [];
          setParsedItems(items);
        } else {
          setParsedItems(parseCSV(text));
        }
      } catch (err: any) {
        setParseError(err?.message || tr('فشل تحليل الملف', 'Failed to parse file'));
        setParsedItems([]);
      }
    };
    reader.readAsText(file);
  }, [language]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const importMutation = useMutation({
    mutationFn: async (items: ParsedItem[]) => {
      const res = await fetch('/api/imdad/bulk/import-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Import failed');
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: () => {
      setResult({ imported: 0, skipped: 0, errors: [{ row: -1, reason: tr('خطأ في الاتصال', 'Connection error') }] });
    },
  });

  const downloadTemplate = () => {
    const csv = TEMPLATE_COLUMNS.join(',') + '\nITEM-001,Sample Item,صنف تجريبي,GENERAL,ORG-UUID-HERE,,Generic,Brand,123456,10.00,Manufacturer,SA,false,false,false\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'imdad-items-template.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const clearFile = () => {
    setParsedItems([]);
    setFileName('');
    setParseError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewColumns = ['code', 'name', 'itemType', 'standardCost', 'manufacturer'];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4A017]/10 dark:bg-[#D4A017]/20">
            <Upload className="h-5 w-5 text-[#D4A017] dark:text-[#E8A317]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {tr('استيراد الأصناف بالجملة', 'Bulk Import Items')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('ارفع ملف CSV أو JSON لاستيراد أصناف جديدة', 'Upload a CSV or JSON file to import new items')}
            </p>
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Download className="h-4 w-4" />
          {tr('تحميل القالب', 'Download Template')}
        </button>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver
            ? 'border-[#D4A017] bg-[#D4A017]/5 dark:bg-[#D4A017]/10'
            : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          className="hidden"
        />
        <FileUp className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {tr('اسحب وأفلت ملف CSV أو JSON هنا', 'Drag and drop a CSV or JSON file here')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {tr('أو انقر للاستعراض — الحد الأقصى 500 صنف', 'or click to browse — max 500 items per batch')}
        </p>
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-center gap-2 rounded-lg border border-[#8B4513]/30 bg-[#8B4513]/5 p-3 dark:border-[#8B4513]/50 dark:bg-[#8B4513]/10">
          <XCircle className="h-4 w-4 text-[#8B4513] shrink-0" />
          <span className="text-sm text-[#8B4513] dark:text-[#CD853F]">{parseError}</span>
        </div>
      )}

      {/* File loaded + preview */}
      {parsedItems.length > 0 && (
        <>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
              <span className="rounded-full bg-[#D4A017]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4A017] dark:bg-[#D4A017]/20 dark:text-[#E8A317]">
                {tr(`${parsedItems.length} صنف`, `${parsedItems.length} items`)}
              </span>
            </div>
            <button onClick={clearFile} className="text-gray-400 hover:text-[#8B4513] transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Column mapping */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tr('الأعمدة المكتشفة', 'Detected Columns')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(parsedItems[0] || {}).map((col) => (
                <span key={col} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {tr('معاينة البيانات', 'Data Preview')}
                <span className="text-gray-400 ms-2">
                  ({tr(`أول ${Math.min(parsedItems.length, 10)} صنف`, `first ${Math.min(parsedItems.length, 10)} items`)})
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                    <th className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">#</th>
                    {previewColumns.map((col) => (
                      <th key={col} className="px-4 py-2 text-start font-medium text-gray-700 dark:text-gray-300">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedItems.slice(0, 10).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                      {previewColumns.map((col) => (
                        <td key={col} className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                          {String(item[col] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import button */}
          <div className="flex justify-end">
            <button
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate(parsedItems)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importMutation.isPending
                ? tr('جارٍ الاستيراد...', 'Importing...')
                : tr('استيراد الأصناف', 'Import Items')}
            </button>
          </div>
        </>
      )}

      {/* Result summary */}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr('نتائج الاستيراد', 'Import Results')}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#556B2F]/5 p-4 text-center dark:bg-[#556B2F]/10">
              <CheckCircle2 className="mx-auto h-6 w-6 text-[#556B2F] mb-1" />
              <div className="text-2xl font-bold text-[#556B2F] dark:text-[#9CB86B]">{result.imported}</div>
              <div className="text-xs text-[#556B2F] dark:text-[#9CB86B]">{tr('تم الاستيراد', 'Imported')}</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center dark:bg-amber-900/20">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-600 mb-1" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.skipped}</div>
              <div className="text-xs text-amber-600 dark:text-amber-500">{tr('تم تخطيه (مكرر)', 'Skipped (duplicates)')}</div>
            </div>
            <div className="rounded-lg bg-[#8B4513]/5 p-4 text-center dark:bg-[#8B4513]/10">
              <XCircle className="mx-auto h-6 w-6 text-[#8B4513] mb-1" />
              <div className="text-2xl font-bold text-[#8B4513] dark:text-[#CD853F]">{result.errors.length}</div>
              <div className="text-xs text-[#8B4513] dark:text-[#CD853F]">{tr('فشل', 'Failed')}</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-[#8B4513] dark:text-[#CD853F]">{tr('تفاصيل الأخطاء', 'Error Details')}</h4>
              <ul className="text-sm text-[#8B4513] dark:text-[#CD853F] space-y-1 list-disc list-inside max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    {err.row >= 0 ? `${tr('سطر', 'Row')} ${err.row + 1}: ` : ''}{err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
