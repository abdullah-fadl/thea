'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Search, ShieldCheck, FileText, ChevronLeft, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface GtinResult {
  gtin: string;
  productName: string;
  productNameAr?: string;
  manufacturer: string;
  registrationNumber: string;
  status: string;
  expiryDate?: string;
}

interface ComplianceResult {
  licenseNumber: string;
  facilityName: string;
  status: string;
  validUntil: string;
  violations: number;
}

interface SfdaLog {
  id: string;
  requestType: string;
  referenceType?: string;
  referenceId?: string;
  isSuccess: boolean;
  errorMessage?: string;
  httpStatusCode?: number;
  requestedAt: string;
}

const REPORT_TYPES = ['DISPENSE', 'RECEIPT', 'RETURN', 'RECALL'] as const;

export default function SfdaIntegrationPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // GTIN verification
  const [gtinInput, setGtinInput] = useState('');
  const [gtinResult, setGtinResult] = useState<GtinResult | null>(null);
  const [gtinLoading, setGtinLoading] = useState(false);
  const [gtinError, setGtinError] = useState('');

  // Compliance check
  const [licenseInput, setLicenseInput] = useState('');
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');

  // Movement report
  const [reportType, setReportType] = useState<string>('DISPENSE');
  const [reportGtin, setReportGtin] = useState('');
  const [reportQuantity, setReportQuantity] = useState('');
  const [reportBatchNumber, setReportBatchNumber] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState('');

  // Logs
  const [logs, setLogs] = useState<SfdaLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const logsLimit = 15;

  const formatDate = (d: string) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const reportTypeTr: Record<string, [string, string]> = {
    DISPENSE: ['\u0635\u0631\u0641', 'Dispense'],
    RECEIPT: ['\u0627\u0633\u062A\u0644\u0627\u0645', 'Receipt'],
    RETURN: ['\u0625\u0631\u062C\u0627\u0639', 'Return'],
    RECALL: ['\u0627\u0633\u062A\u0631\u062C\u0627\u0639', 'Recall'],
  };

  const actionTr: Record<string, [string, string]> = {
    GTIN_VERIFY: ['\u062A\u062D\u0642\u0642 GTIN', 'GTIN Verify'],
    COMPLIANCE_CHECK: ['\u0641\u062D\u0635 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644', 'Compliance Check'],
    MOVEMENT_REPORT: ['\u062A\u0642\u0631\u064A\u0631 \u062D\u0631\u0643\u0629', 'Movement Report'],
  };

  const verifyGtin = async () => {
    if (!gtinInput.trim()) return;
    setGtinLoading(true);
    setGtinError('');
    setGtinResult(null);
    try {
      const res = await fetch('/api/imdad/integrations/sfda/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: gtinInput.trim(), lookupType: 'gtin' }),
      });
      if (res.ok) {
        const json = await res.json();
        setGtinResult(json.data);
      } else {
        setGtinError(tr('\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 GTIN', 'Failed to verify GTIN'));
      }
    } catch {
      setGtinError(tr('\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644', 'Connection error'));
    }
    setGtinLoading(false);
  };

  const checkCompliance = async () => {
    if (!licenseInput.trim()) return;
    setComplianceLoading(true);
    setComplianceError('');
    setComplianceResult(null);
    try {
      const res = await fetch(`/api/imdad/integrations/sfda/compliance?licenseNumber=${encodeURIComponent(licenseInput)}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setComplianceResult(json.data);
      } else {
        setComplianceError(tr('\u0641\u0634\u0644 \u0641\u062D\u0635 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644', 'Failed to check compliance'));
      }
    } catch {
      setComplianceError(tr('\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644', 'Connection error'));
    }
    setComplianceLoading(false);
  };

  const submitReport = async () => {
    if (!reportGtin || !reportQuantity) return;
    setReportSubmitting(true);
    setReportError('');
    setReportSuccess(false);
    try {
      const res = await fetch('/api/imdad/integrations/sfda/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportType: reportType.toLowerCase(),
          gtin: reportGtin,
          quantity: Number(reportQuantity),
          batchNumber: reportBatchNumber || undefined,
          serialNumber: 'N/A',
          facilityLicense: 'N/A',
          unitOfMeasure: 'EACH',
          ...(reportType === 'DISPENSE' ? {
            expiryDate: new Date().toISOString(),
            patientReference: 'N/A',
            prescriberLicense: 'N/A',
            pharmacistLicense: 'N/A',
            dispensedAt: new Date().toISOString(),
          } : reportType === 'RECEIPT' ? {
            expiryDate: new Date().toISOString(),
            serialNumbers: ['N/A'],
            supplierGln: 'N/A',
            purchaseOrderNumber: 'N/A',
            grnNumber: 'N/A',
            receivedAt: new Date().toISOString(),
          } : reportType === 'RETURN' ? {
            returnReason: 'OTHER' as const,
            returnedAt: new Date().toISOString(),
          } : {
            affectedBatches: [reportBatchNumber || 'N/A'],
            recallClass: 'CLASS_III' as const,
            reason: reportNotes || 'Recall',
            reasonAr: reportNotes || 'استرجاع',
            instructions: 'Return to supplier',
            instructionsAr: 'إرجاع إلى المورد',
            recallInitiatedAt: new Date().toISOString(),
            quantityAffected: Number(reportQuantity),
          }),
        }),
      });
      if (res.ok) {
        setReportSuccess(true);
        setReportGtin('');
        setReportQuantity('');
        setReportBatchNumber('');
        setReportNotes('');
        fetchLogs();
      } else {
        setReportError(tr('\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631', 'Failed to submit report'));
      }
    } catch {
      setReportError(tr('\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644', 'Connection error'));
    }
    setReportSubmitting(false);
  };

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(logsPage), limit: String(logsLimit) });
      const res = await fetch(`/api/imdad/quality/sfda-logs?${params}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        setLogsTotal(json.total || 0);
      }
    } catch (err) {
      console.error(err);
    }
    setLogsLoading(false);
  }, [logsPage]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const logsTotalPages = Math.ceil(logsTotal / logsLimit) || 1;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('\u062A\u0643\u0627\u0645\u0644 SFDA', 'SFDA Integration')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr('\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644 \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062D\u0631\u0643\u0629 \u0639\u0628\u0631 \u0647\u064A\u0626\u0629 \u0627\u0644\u063A\u0630\u0627\u0621 \u0648\u0627\u0644\u062F\u0648\u0627\u0621', 'Product verification, compliance checks, and movement reports via SFDA')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GTIN Verification */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-[#D4A017] dark:text-[#E8A317]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr('\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 GTIN', 'GTIN Verification')}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('\u062A\u062D\u0642\u0642 \u0645\u0646 \u0631\u0642\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u0639\u0627\u0644\u0645\u064A \u0639\u0628\u0631 \u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A SFDA', 'Verify Global Trade Item Number against SFDA database')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={gtinInput}
              onChange={e => setGtinInput(e.target.value)}
              placeholder={tr('\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 GTIN', 'Enter GTIN number')}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
            />
            <button
              onClick={verifyGtin}
              disabled={gtinLoading || !gtinInput.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {gtinLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr('\u062A\u062D\u0642\u0642', 'Verify')}
            </button>
          </div>
          {gtinError && <p className="text-sm text-[#8B4513] dark:text-[#CD853F]">{gtinError}</p>}
          {gtinResult && (
            <div className="rounded-lg border border-[#556B2F]/30 bg-[#556B2F]/5 p-4 dark:border-[#556B2F]/50 dark:bg-[#556B2F]/10 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#556B2F] dark:text-[#9CB86B]" />
                <span className="text-sm font-medium text-[#556B2F] dark:text-[#9CB86B]">
                  {tr('\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u062A\u062C', 'Product Found')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C', 'Product Name')}: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {language === 'ar' && gtinResult.productNameAr ? gtinResult.productNameAr : gtinResult.productName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0627\u0644\u0645\u0635\u0646\u0639', 'Manufacturer')}: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{gtinResult.manufacturer}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0631\u0642\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644', 'Reg. Number')}: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{gtinResult.registrationNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}: </span>
                  <span className={`font-medium ${gtinResult.status === 'REGISTERED' ? 'text-[#556B2F] dark:text-[#9CB86B]' : 'text-[#8B4513] dark:text-[#CD853F]'}`}>
                    {gtinResult.status === 'REGISTERED' ? tr('\u0645\u0633\u062C\u0644', 'Registered') : gtinResult.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#556B2F] dark:text-[#9CB86B]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr('\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644', 'Compliance Status')}
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('\u0641\u062D\u0635 \u062D\u0627\u0644\u0629 \u0627\u0645\u062A\u062B\u0627\u0644 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0644\u062F\u0649 SFDA', 'Check facility compliance status with SFDA')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={licenseInput}
              onChange={e => setLicenseInput(e.target.value)}
              placeholder={tr('\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u062A\u0631\u062E\u064A\u0635', 'Enter license number')}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
            />
            <button
              onClick={checkCompliance}
              disabled={complianceLoading || !licenseInput.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#556B2F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4A5D23] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {complianceLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr('\u0641\u062D\u0635', 'Check')}
            </button>
          </div>
          {complianceError && <p className="text-sm text-[#8B4513] dark:text-[#CD853F]">{complianceError}</p>}
          {complianceResult && (
            <div className={`rounded-lg border p-4 space-y-2 ${
              complianceResult.status === 'COMPLIANT'
                ? 'border-[#556B2F]/30 bg-[#556B2F]/5 dark:border-[#556B2F]/50 dark:bg-[#556B2F]/10'
                : 'border-[#8B4513]/30 bg-[#8B4513]/5 dark:border-[#8B4513]/50 dark:bg-[#8B4513]/10'
            }`}>
              <div className="flex items-center gap-2">
                {complianceResult.status === 'COMPLIANT' ? (
                  <CheckCircle className="h-4 w-4 text-[#556B2F] dark:text-[#9CB86B]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#8B4513] dark:text-[#CD853F]" />
                )}
                <span className={`text-sm font-medium ${
                  complianceResult.status === 'COMPLIANT' ? 'text-[#556B2F] dark:text-[#9CB86B]' : 'text-[#8B4513] dark:text-[#CD853F]'
                }`}>
                  {complianceResult.status === 'COMPLIANT' ? tr('\u0645\u0645\u062A\u062B\u0644', 'Compliant') : tr('\u063A\u064A\u0631 \u0645\u0645\u062A\u062B\u0644', 'Non-Compliant')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629', 'Facility Name')}: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{complianceResult.facilityName}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0635\u0627\u0644\u062D \u062D\u062A\u0649', 'Valid Until')}: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(complianceResult.validUntil)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{tr('\u0627\u0644\u0645\u062E\u0627\u0644\u0641\u0627\u062A', 'Violations')}: </span>
                  <span className={`font-medium ${complianceResult.violations > 0 ? 'text-[#8B4513] dark:text-[#CD853F]' : 'text-[#556B2F] dark:text-[#9CB86B]'}`}>
                    {complianceResult.violations}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Movement Reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#4A5D23] dark:text-[#9CB86B]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr('\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u062D\u0631\u0643\u0629', 'Movement Reports')}
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr('\u0625\u0631\u0633\u0627\u0644 \u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0635\u0631\u0641 \u0648\u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0627\u0644\u0625\u0631\u062C\u0627\u0639 \u0648\u0627\u0644\u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0625\u0644\u0649 SFDA', 'Submit dispense, receipt, return, and recall reports to SFDA')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0646\u0648\u0639 \u0627\u0644\u062A\u0642\u0631\u064A\u0631', 'Report Type')}
            </label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {REPORT_TYPES.map(rt => (
                <option key={rt} value={rt}>{tr(reportTypeTr[rt]?.[0] ?? rt, reportTypeTr[rt]?.[1] ?? rt)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0631\u0642\u0645 GTIN', 'GTIN Number')}
            </label>
            <input
              type="text"
              value={reportGtin}
              onChange={e => setReportGtin(e.target.value)}
              placeholder={tr('\u0631\u0642\u0645 GTIN', 'GTIN')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0627\u0644\u0643\u0645\u064A\u0629', 'Quantity')}
            </label>
            <input
              type="number"
              value={reportQuantity}
              onChange={e => setReportQuantity(e.target.value)}
              placeholder={tr('\u0627\u0644\u0643\u0645\u064A\u0629', 'Quantity')}
              min="1"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {tr('\u0631\u0642\u0645 \u0627\u0644\u062F\u0641\u0639\u0629', 'Batch Number')}
            </label>
            <input
              type="text"
              value={reportBatchNumber}
              onChange={e => setReportBatchNumber(e.target.value)}
              placeholder={tr('\u0627\u062E\u062A\u064A\u0627\u0631\u064A', 'Optional')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A', 'Notes')}
          </label>
          <textarea
            value={reportNotes}
            onChange={e => setReportNotes(e.target.value)}
            rows={2}
            placeholder={tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)', 'Additional notes (optional)')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={submitReport}
            disabled={reportSubmitting || !reportGtin || !reportQuantity}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4A5D23] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d4d1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reportSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr('\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631', 'Submit Report')}
          </button>
          {reportSuccess && (
            <span className="text-sm text-[#556B2F] dark:text-[#9CB86B] flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {tr('\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0646\u062C\u0627\u062D', 'Submitted successfully')}
            </span>
          )}
          {reportError && (
            <span className="text-sm text-[#8B4513] dark:text-[#CD853F] flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              {reportError}
            </span>
          )}
        </div>
      </div>

      {/* SFDA Logs */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tr('\u0633\u062C\u0644\u0627\u062A SFDA', 'SFDA Logs')}
        </h2>

        {logsLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {tr('\u062C\u0627\u0631\u064D \u0627\u0644\u062A\u062D\u0645\u064A\u0644...', 'Loading...')}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {tr('\u0644\u0627 \u062A\u0648\u062C\u062F \u0633\u062C\u0644\u0627\u062A', 'No logs found')}
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-xl border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {[
                    tr('\u0627\u0644\u0625\u062C\u0631\u0627\u0621', 'Action'),
                    tr('\u0627\u0644\u0645\u0631\u062C\u0639', 'Reference'),
                    tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status'),
                    tr('\u0627\u0644\u0631\u0633\u0627\u0644\u0629', 'Message'),
                    tr('\u0627\u0644\u062A\u0627\u0631\u064A\u062E', 'Date'),
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {log.requestType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono">
                      {log.referenceType || '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        log.isSuccess
                          ? 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
                          : 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#CD853F]'
                      }`}>
                        {log.isSuccess ? tr('\u0646\u062C\u0627\u062D', 'Success') : tr('\u0641\u0634\u0644', 'Failed')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[300px] truncate">{log.errorMessage || '\u2014'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(log.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Logs Pagination */}
        {logsTotal > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {tr(`\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${logsTotal}`, `Total: ${logsTotal}`)}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                disabled={logsPage <= 1}
                className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {tr(`${logsPage} \u0645\u0646 ${logsTotalPages}`, `${logsPage} of ${logsTotalPages}`)}
              </span>
              <button
                onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))}
                disabled={logsPage >= logsTotalPages}
                className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
