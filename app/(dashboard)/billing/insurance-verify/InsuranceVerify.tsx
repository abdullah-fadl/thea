'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';

export default function InsuranceVerify() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [patientId, setPatientId] = useState('');
  const [insuranceId, setInsuranceId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/nphies/eligibility', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, insuranceId }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: tr('فشل التحقق', 'Failed to verify') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">{tr('التحقق من أهلية التأمين', 'Insurance Eligibility Verification')}</h1>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {tr('رقم المريض', 'Patient ID')}
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground thea-input-focus"
              placeholder="pat_xxxx"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {tr('رقم التأمين', 'Insurance ID')}
            </label>
            <input
              type="text"
              value={insuranceId}
              onChange={(e) => setInsuranceId(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-xl bg-card text-foreground thea-input-focus"
              placeholder="ins_xxxx"
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={loading || !patientId || !insuranceId}
            className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? tr('جاري التحقق...', 'Verifying...') : tr('التحقق من NPHIES', 'Verify via NPHIES')}
          </button>
        </div>

        {result && (
          <div
            className={`mt-6 rounded-2xl border p-6 ${
              result.eligibility?.eligible
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-destructive/10 border-destructive/30'
            }`}
          >
            <h3 className="font-bold text-lg text-foreground mb-4">
              {result.eligibility?.eligible ? tr('مؤهل', 'Eligible') : tr('غير مؤهل', 'Not Eligible')}
            </h3>

            {result.eligibility?.eligible && (
              <div className="space-y-2 text-sm text-foreground">
                <div className="flex justify-between">
                  <span>{tr('التغطية نشطة:', 'Coverage Active:')}</span>
                  <span>{result.eligibility.coverageActive ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>
                </div>
                {result.eligibility.remainingBenefit && (
                  <div className="flex justify-between">
                    <span>{tr('المتبقي:', 'Remaining:')}</span>
                    <span>{result.eligibility.remainingBenefit.toLocaleString()} {tr('ر.س', 'SAR')}</span>
                  </div>
                )}
              </div>
            )}

            {result.eligibility?.errors && (
              <div className="mt-4 text-destructive">{result.eligibility.errors.join(', ')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
