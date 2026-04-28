'use client';

import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { InvoicePatient } from './InvoiceScreen';
import { ServiceItem } from './ServiceSelector';
import { useLang } from '@/hooks/use-lang';

export interface InsuranceResult {
  approved: boolean;
  policyNumber: string;
  companyName: string;
  patientSharePercent: number;
  maxCoverage?: number;
  deductible?: number;
  approvalNumber?: string;
  message?: string;
}

interface Props {
  patient: InvoicePatient;
  services: ServiceItem[];
  result: InsuranceResult | null;
  onSkip: () => void;
  loading: boolean;
}

export function InsuranceCheck({ patient, services, result, onSkip, loading }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const subtotal = services.reduce((sum, s) => sum + s.price * s.quantity, 0);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
        <Loader2 className="w-10 h-10 text-blue-600 mx-auto mb-3 animate-spin" />
        <p className="font-medium text-blue-800">{tr('جاري التحقق من التأمين...', 'Verifying insurance...')}</p>
        <p className="text-sm text-blue-600">{tr('يرجى الانتظار', 'Please wait')}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div
        className={`rounded-xl border-2 overflow-hidden ${
          result.approved ? 'border-green-300' : 'border-red-300'
        }`}
      >
        <div className={`p-4 ${result.approved ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            {result.approved ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
            <div>
              <h4 className={`font-semibold ${result.approved ? 'text-green-800' : 'text-red-800'}`}>
                {result.approved ? tr('تمت الموافقة', 'Approved') : tr('تم الرفض', 'Rejected')}
              </h4>
              <p className={`text-sm ${result.approved ? 'text-green-600' : 'text-red-600'}`}>
                {result.companyName}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{tr('رقم البوليصة', 'Policy Number')}</span>
            <span className="font-medium">{result.policyNumber}</span>
          </div>

          {result.approved && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{tr('نسبة المريض', 'Patient Share')}</span>
                <span className="font-medium">{result.patientSharePercent}%</span>
              </div>

              {result.approvalNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{tr('رقم الموافقة', 'Approval Number')}</span>
                  <span className="font-medium text-green-600">{result.approvalNumber}</span>
                </div>
              )}

              <div className="pt-3 border-t mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">{tr('المبلغ الإجمالي', 'Total Amount')}</span>
                  <span>{subtotal.toFixed(2)} {tr('ر.س', 'SAR')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">{tr('يغطيه التأمين', 'Insurance Coverage')}</span>
                  <span className="text-green-600">
                    -{(subtotal * (1 - result.patientSharePercent / 100)).toFixed(2)} {tr('ر.س', 'SAR')}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{tr('على المريض', 'Patient Owes')}</span>
                  <span className="text-blue-600">
                    {(subtotal * result.patientSharePercent / 100).toFixed(2)} {tr('ر.س', 'SAR')}
                  </span>
                </div>
              </div>
            </>
          )}

          {result.message && (
            <div
              className={`text-sm p-2 rounded ${
                result.approved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h4 className="font-semibold text-slate-900">{tr('بيانات التأمين', 'Insurance Details')}</h4>
          <p className="text-sm text-slate-500">{patient.insuranceCompanyName}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{tr('رقم البوليصة', 'Policy Number')}</span>
          <span className="font-medium">{patient.insurancePolicyNumber}</span>
        </div>
        {patient.insuranceExpiryDate && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{tr('تاريخ الانتهاء', 'Expiry Date')}</span>
            <span className="font-medium">
              {new Date(patient.insuranceExpiryDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onSkip}
        className="w-full py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
      >
        {tr('تخطي التأمين (دفع كاش)', 'Skip Insurance (Cash Payment)')}
      </button>
    </div>
  );
}
