'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ArrowUpDown,
  FileText,
  Beaker,
  Shield,
} from 'lucide-react';
import { getReferenceRange } from '@/lib/lab/referenceRanges';
import { getPanelByCode, TUBE_COLORS, type TubeColor } from '@/lib/lab/panels';
import { formatTAT, getCurrentStage, type LabTimestamps } from '@/lib/lab/tatTracking';
import type { ValidationResult } from '@/lib/lab/autoValidation';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

interface LabTest {
  id: string;
  specimenId?: string;
  orderId: string;
  patientName: string;
  mrn: string;
  patientId?: string;
  testCode: string;
  testName: string;
  testNameAr?: string;
  parameters: TestParameter[];
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  status: string;
  collectedAt?: string;
  orderedAt?: string;
  gender?: string;
}

interface TestParameter {
  code: string;
  name: string;
  nameAr?: string;
  unit: string;
  referenceRange: {
    low?: number;
    high?: number;
    text?: string;
  };
}

interface ResultEntry {
  parameterId: string;
  value: string;
  flag: string;
  unit?: string;
  previousValue?: number;
  deltaPercent?: number;
  comment?: string;
}

type ViewMode = 'single' | 'panel';

export default function LabResults() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [results, setResults] = useState<Record<string, ResultEntry>>({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [comments, setComments] = useState('');
  const [autoValidationResults, setAutoValidationResults] = useState<Record<string, ValidationResult> | null>(null);
  const [validating, setValidating] = useState(false);
  const [previousResults, setPreviousResults] = useState<Record<string, number>>({});

  const { data, mutate } = useSWR('/api/lab/worklist?status=COLLECTED,RECEIVED,IN_PROGRESS', fetcher, {
    refreshInterval: 30000,
  });

  const tests: LabTest[] = Array.isArray(data?.tests) ? data.tests : [];

  // Detect if selected test is part of a panel
  const panelInfo = selectedTest ? getPanelByCode(selectedTest.testCode) : undefined;

  // Fetch previous results for delta check when test is selected
  useEffect(() => {
    if (!selectedTest?.patientId) {
      setPreviousResults({});
      return;
    }
    // Fetch previous lab results for this patient
    fetch(`/api/lab/worklist?status=COMPLETED,VERIFIED&patientId=${selectedTest.patientId}&limit=1`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const prev: Record<string, number> = {};
        const prevTests = data?.tests ?? [];
        for (const t of prevTests) {
          if (Array.isArray(t.parameters)) {
            for (const p of t.parameters) {
              const code = String(p.code || p.parameterId || '').toUpperCase();
              const val = Number(p.value);
              if (code && !Number.isNaN(val)) prev[code] = val;
            }
          }
        }
        setPreviousResults(prev);
      })
      .catch(() => setPreviousResults({}));
  }, [selectedTest?.patientId, selectedTest?.id]);

  const calculateFlag = useCallback((value: number, param: TestParameter): string => {
    const ref = getReferenceRange(param.code) || param.referenceRange;
    const low = (ref && 'normalRange' in ref) ? ref.normalRange.min : param.referenceRange?.low;
    const high = (ref && 'normalRange' in ref) ? ref.normalRange.max : param.referenceRange?.high;

    if (low !== undefined && value < low * 0.5) return 'CRITICAL_LOW';
    if (high !== undefined && value > high * 2) return 'CRITICAL_HIGH';
    if (low !== undefined && value < low) return 'LOW';
    if (high !== undefined && value > high) return 'HIGH';
    return 'NORMAL';
  }, []);

  const handleValueChange = useCallback((param: TestParameter, value: string) => {
    const numValue = parseFloat(value);
    const flag = !Number.isNaN(numValue) ? calculateFlag(numValue, param) : 'NORMAL';

    // Delta check
    const prevVal = previousResults[param.code.toUpperCase()];
    let deltaPercent: number | undefined;
    if (prevVal !== undefined && !Number.isNaN(numValue) && prevVal !== 0) {
      deltaPercent = Math.abs(((numValue - prevVal) / prevVal) * 100);
    }

    setResults((prev) => ({
      ...prev,
      [param.code]: {
        parameterId: param.code,
        value,
        flag,
        unit: param.unit,
        previousValue: prevVal,
        deltaPercent,
        comment: prev[param.code]?.comment ?? '',
      },
    }));
  }, [calculateFlag, previousResults]);

  const handleCommentChange = useCallback((paramCode: string, comment: string) => {
    setResults((prev) => ({
      ...prev,
      [paramCode]: {
        ...prev[paramCode],
        comment,
      },
    }));
  }, []);

  const runAutoValidation = async () => {
    if (!selectedTest) return;
    setValidating(true);
    try {
      const resultsToValidate = Object.values(results)
        .filter((r) => r.value.trim() !== '')
        .map((r) => ({
          testCode: r.parameterId,
          value: Number(r.value),
          unit: r.unit,
        }));

      if (resultsToValidate.length === 0) return;

      const res = await fetch('/api/lab/auto-validate', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedTest.orderId || selectedTest.id,
          results: resultsToValidate,
          gender: selectedTest.gender,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAutoValidationResults(data.validations);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async (isFinal: boolean) => {
    if (!selectedTest) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lab/results/save', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: selectedTest.id,
          orderId: selectedTest.orderId || selectedTest.id,
          results: Object.values(results).map((r) => ({
            ...r,
            previousValue: r.previousValue,
            deltaPercent: r.deltaPercent,
          })),
          status: isFinal ? 'COMPLETED' : 'IN_PROGRESS',
          comments,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      mutate();
      if (isFinal) {
        setSelectedTest(null);
        setResults({});
        setComments('');
        setAutoValidationResults(null);
      }
    } catch {
      toast({ title: tr('\u0641\u0634\u0644 \u0641\u064A \u062D\u0641\u0638 \u0627\u0644\u0646\u062A\u0627\u0626\u062C', 'Failed to save results'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasCritical = Object.values(results).some((r) => r.flag.includes('CRITICAL'));
  const hasHighDelta = Object.values(results).some((r) => (r.deltaPercent ?? 0) > 50);
  const filledCount = Object.values(results).filter((r) => r.value.trim() !== '').length;
  const totalParams = selectedTest?.parameters?.length ?? 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('\u0625\u062F\u062E\u0627\u0644 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0645\u062E\u062A\u0628\u0631', 'Lab Results Entry')}</h1>
            <p className="text-muted-foreground">{tr('\u0625\u062F\u062E\u0627\u0644 \u0648\u062A\u062D\u0642\u0642 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A', 'Enter and verify test results')}</p>
          </div>
          {selectedTest && (
            <div className="flex gap-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  viewMode === 'single' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Beaker className="w-4 h-4 inline-block mr-1" />
                {tr('\u0641\u0631\u062F\u064A', 'Single')}
              </button>
              <button
                onClick={() => setViewMode('panel')}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  viewMode === 'panel' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <FileText className="w-4 h-4 inline-block mr-1" />
                {tr('\u0644\u0648\u062D\u0629', 'Panel')}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Worklist */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="font-bold text-foreground">{tr('\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0639\u0645\u0644', 'Worklist')}</h2>
                <p className="text-sm text-muted-foreground">{tests.length} {tr('\u0641\u062D\u0635', 'tests')}</p>
              </div>

              <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                {tests.map((test) => (
                  <button
                    key={test.id}
                    onClick={() => {
                      setSelectedTest(test);
                      setResults({});
                      setComments('');
                      setAutoValidationResults(null);
                    }}
                    className={`w-full p-4 text-right thea-hover-lift ${
                      selectedTest?.id === test.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          test.priority === 'STAT'
                            ? 'bg-red-100 text-red-700'
                            : test.priority === 'URGENT'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {test.priority}
                      </span>
                      <span className="text-xs text-muted-foreground/60">{test.specimenId || test.orderId}</span>
                    </div>
                    <div className="font-medium text-foreground">{test.patientName}</div>
                    <div className="text-sm text-muted-foreground">{test.testNameAr || test.testName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">
                        {test.orderedAt ? new Date(test.orderedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                      {test.status && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            test.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : test.status === 'RECEIVED'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {test.status}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Entry */}
          <div className="lg:col-span-2">
            {selectedTest ? (
              <div className="bg-card rounded-2xl border border-border">
                {/* Header */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-foreground">{selectedTest.testNameAr || selectedTest.testName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedTest.patientName} {'\u2022'} MRN: {selectedTest.mrn}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {panelInfo && (
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${TUBE_COLORS[panelInfo.tubeType as TubeColor]?.bg ?? 'bg-muted'} ${TUBE_COLORS[panelInfo.tubeType as TubeColor]?.text ?? 'text-foreground'}`}
                        >
                          {language === 'ar' ? panelInfo.tubeLabel.ar : panelInfo.tubeLabel.en}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground/60">{selectedTest.specimenId}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${totalParams > 0 ? (filledCount / totalParams) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{filledCount}/{totalParams}</span>
                  </div>
                </div>

                {/* Parameters table */}
                <div className="p-4 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-right text-sm text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">{tr('\u0627\u0644\u0641\u062D\u0635', 'Test')}</th>
                        <th className="pb-2 font-medium">{tr('\u0627\u0644\u0646\u062A\u064A\u062C\u0629', 'Result')}</th>
                        <th className="pb-2 font-medium">{tr('\u0627\u0644\u0648\u062D\u062F\u0629', 'Unit')}</th>
                        <th className="pb-2 font-medium">{tr('\u0627\u0644\u0645\u0631\u062C\u0639', 'Reference')}</th>
                        <th className="pb-2 font-medium">{tr('\u0627\u0644\u062D\u0627\u0644\u0629', 'Status')}</th>
                        <th className="pb-2 font-medium">
                          <ArrowUpDown className="w-3 h-3 inline" /> Delta
                        </th>
                        {viewMode === 'panel' && <th className="pb-2 font-medium">{tr('\u0645\u0644\u0627\u062D\u0638\u0629', 'Comment')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTest.parameters || []).map((param) => {
                        const entry = results[param.code];
                        const flag = entry?.flag || 'NORMAL';
                        const prevVal = previousResults[param.code.toUpperCase()];
                        const deltaP = entry?.deltaPercent;
                        const highDelta = (deltaP ?? 0) > 50;

                        // Enrich reference from our ranges
                        const enrichedRef = getReferenceRange(param.code);
                        const refText = enrichedRef
                          ? `${enrichedRef.normalRange.min} - ${enrichedRef.normalRange.max}`
                          : param.referenceRange?.text || `${param.referenceRange?.low ?? ''} - ${param.referenceRange?.high ?? ''}`;

                        return (
                          <tr key={param.code} className="border-b border-border/50">
                            <td className="py-3">
                              <div className="font-medium">{param.nameAr || param.name}</div>
                              <div className="text-xs text-muted-foreground/60">{param.code}</div>
                            </td>
                            <td className="py-3">
                              <input
                                type="text"
                                value={entry?.value || ''}
                                onChange={(e) => handleValueChange(param, e.target.value)}
                                className={`w-24 px-2 py-1 border rounded-xl text-center font-mono thea-input-focus ${
                                  flag.includes('CRITICAL')
                                    ? 'border-red-500 bg-red-50'
                                    : flag !== 'NORMAL'
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-border'
                                }`}
                              />
                            </td>
                            <td className="py-3 text-muted-foreground text-sm">{param.unit}</td>
                            <td className="py-3 text-muted-foreground text-sm">{refText}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                                  flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH'
                                    ? 'bg-red-100 text-red-700 animate-pulse'
                                    : flag === 'LOW'
                                    ? 'bg-blue-100 text-blue-700'
                                    : flag === 'HIGH'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {flag === 'NORMAL'
                                  ? tr('\u0637\u0628\u064A\u0639\u064A', 'Normal')
                                  : flag === 'LOW'
                                  ? tr('\u2193 \u0645\u0646\u062E\u0641\u0636', '\u2193 Low')
                                  : flag === 'HIGH'
                                  ? tr('\u2191 \u0645\u0631\u062A\u0641\u0639', '\u2191 High')
                                  : flag === 'CRITICAL_LOW'
                                  ? tr('\u26A0 \u062D\u0631\u062C \u2193', '\u26A0 Critical Low')
                                  : tr('\u26A0 \u062D\u0631\u062C \u2191', '\u26A0 Critical High')}
                              </span>
                            </td>
                            <td className="py-3">
                              {prevVal !== undefined ? (
                                <div className={`text-xs ${highDelta ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                                  <div>{tr('\u0633\u0627\u0628\u0642', 'Prev')}: {prevVal}</div>
                                  {deltaP !== undefined && (
                                    <div>{highDelta ? '\u26A0' : ''} {deltaP.toFixed(0)}%</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </td>
                            {viewMode === 'panel' && (
                              <td className="py-3">
                                <input
                                  type="text"
                                  placeholder="..."
                                  value={entry?.comment || ''}
                                  onChange={(e) => handleCommentChange(param.code, e.target.value)}
                                  className="w-28 px-2 py-1 border border-border rounded-lg text-xs thea-input-focus"
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Critical value alert */}
                {hasCritical && (
                  <div className="mx-4 mb-4 p-4 bg-red-100 border-2 border-red-500 rounded-2xl">
                    <div className="flex items-center gap-2 text-red-800 font-bold">
                      <AlertTriangle className="w-5 h-5" />
                      {tr('\u0642\u064A\u0645\u0629 \u062D\u0631\u062C\u0629! \u064A\u062C\u0628 \u0625\u0628\u0644\u0627\u063A \u0627\u0644\u0637\u0628\u064A\u0628 \u0641\u0648\u0631\u0627\u064B', 'Critical value! Physician must be notified immediately')}
                    </div>
                  </div>
                )}

                {/* Delta check warning */}
                {hasHighDelta && !hasCritical && (
                  <div className="mx-4 mb-4 p-3 bg-amber-50 border border-amber-300 rounded-2xl">
                    <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                      <ArrowUpDown className="w-4 h-4" />
                      {tr('\u062A\u063A\u064A\u0631 \u0643\u0628\u064A\u0631 \u0639\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u2014 \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642', 'Significant change from previous result \u2014 please verify')}
                    </div>
                  </div>
                )}

                {/* Auto-validation results */}
                {autoValidationResults && (
                  <div className="mx-4 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                    <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                      <Shield className="w-4 h-4" />
                      {tr('\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A', 'Auto-Validation Results')}
                    </h3>
                    <div className="space-y-1">
                      {Object.entries(autoValidationResults).map(([code, result]: [string, any]) => (
                        <div key={code} className="flex items-center justify-between text-xs">
                          <span className="font-medium">{code}</span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              result.action === 'auto_verify'
                                ? 'bg-green-100 text-green-700'
                                : result.action === 'flag_critical'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {result.action === 'auto_verify'
                              ? tr('\u062A\u062D\u0642\u0642 \u062A\u0644\u0642\u0627\u0626\u064A', 'Auto-verified')
                              : result.action === 'flag_critical'
                              ? tr('\u062D\u0631\u062C', 'Critical')
                              : tr('\u0645\u0631\u0627\u062C\u0639\u0629', 'Review')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="mx-4 mb-4">
                  <textarea
                    placeholder={tr('\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0639\u0627\u0645\u0629...', 'General comments...')}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm thea-input-focus resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <button
                    onClick={runAutoValidation}
                    disabled={validating || filledCount === 0}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-xl disabled:opacity-40"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {tr('\u062A\u062D\u0642\u0642 \u062A\u0644\u0642\u0627\u0626\u064A', 'Auto-validate')}
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSave(false)}
                      disabled={saving}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm"
                    >
                      {tr('\u062D\u0641\u0638 \u0643\u0645\u0633\u0648\u062F\u0629', 'Save Draft')}
                    </button>
                    <button
                      onClick={() => handleSave(true)}
                      disabled={saving}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 text-sm flex items-center gap-1.5"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {saving ? tr('\u062C\u0627\u0631\u064A \u0627\u0644\u062D\u0641\u0638...', 'Saving...') : tr('\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0646\u062A\u064A\u062C\u0629', 'Release Result')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
                <Beaker className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>{tr('\u0627\u062E\u062A\u0631 \u0641\u062D\u0635\u0627\u064B \u0645\u0646 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0644\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0646\u062A\u0627\u0626\u062C', 'Select a test from the worklist to enter results')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
