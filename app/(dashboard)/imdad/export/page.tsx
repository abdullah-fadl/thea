'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Download, Package, ShoppingCart, Wrench, Loader2, CheckCircle, XCircle } from 'lucide-react';

type ExportFormat = 'JSON' | 'CSV';
type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExportCardState {
  organization: string;
  format: ExportFormat;
  status: string;
  dateFrom: string;
  dateTo: string;
  exportStatus: ExportStatus;
  errorMessage: string;
}

const INITIAL_STATE: ExportCardState = {
  organization: '',
  format: 'CSV',
  status: '',
  dateFrom: '',
  dateTo: '',
  exportStatus: 'idle',
  errorMessage: '',
};

export default function ExportPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [inventory, setInventory] = useState<ExportCardState>({ ...INITIAL_STATE });
  const [procurement, setProcurement] = useState<ExportCardState>({ ...INITIAL_STATE });
  const [assets, setAssets] = useState<ExportCardState>({ ...INITIAL_STATE });

  const statusOptions: Record<string, { value: string; label: [string, string] }[]> = {
    inventory: [
      { value: 'IN_STOCK', label: ['\u0645\u062A\u0648\u0641\u0631', 'In Stock'] },
      { value: 'LOW_STOCK', label: ['\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636', 'Low Stock'] },
      { value: 'OUT_OF_STOCK', label: ['\u0646\u0641\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Out of Stock'] },
      { value: 'EXPIRED', label: ['\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629', 'Expired'] },
    ],
    procurement: [
      { value: 'DRAFT', label: ['\u0645\u0633\u0648\u062F\u0629', 'Draft'] },
      { value: 'PENDING', label: ['\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631', 'Pending'] },
      { value: 'APPROVED', label: ['\u0645\u0639\u062A\u0645\u062F', 'Approved'] },
      { value: 'COMPLETED', label: ['\u0645\u0643\u062A\u0645\u0644', 'Completed'] },
      { value: 'CANCELLED', label: ['\u0645\u0644\u063A\u064A', 'Cancelled'] },
    ],
    assets: [
      { value: 'ACTIVE', label: ['\u0646\u0634\u0637', 'Active'] },
      { value: 'MAINTENANCE', label: ['\u0635\u064A\u0627\u0646\u0629', 'Maintenance'] },
      { value: 'DISPOSED', label: ['\u0645\u0633\u062A\u0628\u0639\u062F', 'Disposed'] },
      { value: 'TRANSFERRED', label: ['\u0645\u0646\u0642\u0648\u0644', 'Transferred'] },
    ],
  };

  const handleExport = async (
    type: 'inventory' | 'procurement' | 'assets',
    state: ExportCardState,
    setState: React.Dispatch<React.SetStateAction<ExportCardState>>
  ) => {
    setState(prev => ({ ...prev, exportStatus: 'loading', errorMessage: '' }));
    try {
      const params = new URLSearchParams();
      params.set('format', state.format.toLowerCase());
      if (state.organization) params.set('organizationId', state.organization);
      if (state.status) params.set('status', state.status);
      if (state.dateFrom) params.set('dateFrom', state.dateFrom);
      if (state.dateTo) params.set('dateTo', state.dateTo);

      const res = await fetch(`/api/imdad/export/${type}?${params}`, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.${state.format.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setState(prev => ({ ...prev, exportStatus: 'success' }));
      } else {
        setState(prev => ({ ...prev, exportStatus: 'error', errorMessage: tr('\u0641\u0634\u0644 \u0627\u0644\u062A\u0635\u062F\u064A\u0631', 'Export failed') }));
      }
    } catch {
      setState(prev => ({ ...prev, exportStatus: 'error', errorMessage: tr('\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644', 'Connection error') }));
    }
  };

  const renderExportCard = (
    type: 'inventory' | 'procurement' | 'assets',
    title: [string, string],
    description: [string, string],
    icon: React.ReactNode,
    iconBg: string,
    state: ExportCardState,
    setState: React.Dispatch<React.SetStateAction<ExportCardState>>
  ) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tr(title[0], title[1])}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr(description[0], description[1])}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('\u0627\u0644\u0645\u0646\u0638\u0645\u0629', 'Organization')}
          </label>
          <input
            type="text"
            value={state.organization}
            onChange={e => setState(prev => ({ ...prev, organization: e.target.value }))}
            placeholder={tr('\u0627\u062E\u062A\u064A\u0627\u0631\u064A', 'Optional')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('\u0627\u0644\u062A\u0646\u0633\u064A\u0642', 'Format')}
          </label>
          <select
            value={state.format}
            onChange={e => setState(prev => ({ ...prev, format: e.target.value as ExportFormat }))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="CSV">CSV</option>
            <option value="JSON">JSON</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}
          </label>
          <select
            value={state.status}
            onChange={e => setState(prev => ({ ...prev, status: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="">{tr('\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A', 'All Statuses')}</option>
            {statusOptions[type].map(opt => (
              <option key={opt.value} value={opt.value}>{tr(opt.label[0], opt.label[1])}</option>
            ))}
          </select>
        </div>

        {/* Date range placeholder */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0645\u0646', 'From')}
            </label>
            <input
              type="date"
              value={state.dateFrom}
              onChange={e => setState(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0625\u0644\u0649', 'To')}
            </label>
            <input
              type="date"
              value={state.dateTo}
              onChange={e => setState(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => handleExport(type, state, setState)}
          disabled={state.exportStatus === 'loading'}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state.exportStatus === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {state.exportStatus === 'loading'
            ? tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u0635\u062F\u064A\u0631...', 'Exporting...')
            : tr('\u062A\u0635\u062F\u064A\u0631', 'Download')}
        </button>
        {state.exportStatus === 'success' && (
          <span className="text-sm text-[#556B2F] dark:text-[#9CB86B] flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            {tr('\u062A\u0645 \u0627\u0644\u062A\u0635\u062F\u064A\u0631 \u0628\u0646\u062C\u0627\u062D', 'Exported successfully')}
          </span>
        )}
        {state.exportStatus === 'error' && (
          <span className="text-sm text-[#8B4513] dark:text-[#CD853F] flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            {state.errorMessage}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u062A\u0635\u062F\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A', 'Data Export')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr('\u062A\u0635\u062F\u064A\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0648\u0627\u0644\u0623\u0635\u0648\u0644 \u0628\u0635\u064A\u063A\u0629 JSON \u0623\u0648 CSV', 'Export inventory, procurement, and assets data in JSON or CSV format')}
        </p>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 gap-6">
        {renderExportCard(
          'inventory',
          ['\u0627\u0644\u0645\u062E\u0632\u0648\u0646', 'Inventory'],
          ['\u062A\u0635\u062F\u064A\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641', 'Export inventory items and stock data'],
          <Package className="h-5 w-5 text-[#D4A017] dark:text-[#E8A317]" />,
          'bg-[#D4A017]/10 dark:bg-[#D4A017]/20',
          inventory,
          setInventory
        )}

        {renderExportCard(
          'procurement',
          ['\u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A', 'Procurement'],
          ['\u062A\u0635\u062F\u064A\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646', 'Export purchase orders and vendor data'],
          <ShoppingCart className="h-5 w-5 text-[#556B2F] dark:text-[#9CB86B]" />,
          'bg-[#556B2F]/10 dark:bg-[#556B2F]/20',
          procurement,
          setProcurement
        )}

        {renderExportCard(
          'assets',
          ['\u0627\u0644\u0623\u0635\u0648\u0644', 'Assets'],
          ['\u062A\u0635\u062F\u064A\u0631 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0635\u0648\u0644 \u0648\u0627\u0644\u0645\u0639\u062F\u0627\u062A', 'Export assets and equipment data'],
          <Wrench className="h-5 w-5 text-[#4A5D23] dark:text-[#9CB86B]" />,
          'bg-[#4A5D23]/10 dark:bg-[#4A5D23]/20',
          assets,
          setAssets
        )}
      </div>
    </div>
  );
}
