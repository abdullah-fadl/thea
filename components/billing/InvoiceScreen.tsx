'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  CreditCard,
  Receipt,
  Printer,
  CheckCircle,
  AlertCircle,
  Shield,
  Clock,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { getVisitTypeConfig } from '@/lib/opd/ui-config';
import { ServiceSelector, ServiceItem } from './ServiceSelector';
import { InsuranceCheck, InsuranceResult } from './InsuranceCheck';
import { DiscountCode, DiscountResult } from './DiscountCode';
import { PaymentMethods, PaymentMethod } from './PaymentMethods';
import { ReceiptPreview } from './Receipt';
import { buildVisitPricingKey, useVisitPricingCache } from './VisitPricingContext';

export interface InvoicePatient {
  id: string;
  mrn: string;
  fullName: string;
  nationalId?: string;
  phone?: string;
  insurancePolicyNumber?: string;
  insuranceCompanyId?: string;
  insuranceCompanyName?: string;
  insurancePlanId?: string;
  insuranceExpiryDate?: string;
}

export interface InvoiceContext {
  type: 'visit' | 'order' | 'procedure';
  visitId?: string;
  encounterId?: string;
  providerId?: string;
  providerName?: string;
  specialtyCode?: string;
  specialtyName?: string;
  visitPricing?: any;
  isFirstVisit?: boolean;
  clinicId?: string;
  resourceId?: string;
}

interface Props {
  patient: InvoicePatient;
  context: InvoiceContext;
  onComplete: (
    invoiceId: string,
    paymentStatus: 'PAID' | 'PENDING',
    paymentDetails?: { amount: number; method: PaymentMethod; reference?: string }
  ) => void;
  onCancel: () => void;
}

export function InvoiceScreen({ patient, context, onComplete, onCancel }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [step, setStep] = useState<'services' | 'insurance' | 'payment' | 'complete'>('services');
  const [loading, setLoading] = useState(false);

  const [consultationService, setConsultationService] = useState<ServiceItem | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [visitPricing, setVisitPricing] = useState<any | null>(context.visitPricing || null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [insuranceResult, setInsuranceResult] = useState<InsuranceResult | null>(null);
  const [skipInsurance, setSkipInsurance] = useState(false);

  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');

  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completed, setCompleted] = useState(false);

  const lineItems = useMemo(
    () => (consultationService ? [consultationService, ...services] : services),
    [consultationService, services]
  );
  const subtotal = lineItems.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const vatAmount = subtotal * 0.15;
  const totalWithVat = subtotal + vatAmount;

  const insuranceDiscount = insuranceResult?.approved
    ? totalWithVat * (1 - insuranceResult.patientSharePercent / 100)
    : 0;

  const promoDiscount = discountResult?.valid
    ? discountResult.type === 'percentage'
      ? (totalWithVat - insuranceDiscount) * (discountResult.value / 100)
      : Math.min(discountResult.value, totalWithVat - insuranceDiscount)
    : 0;

  const total = totalWithVat - insuranceDiscount - promoDiscount;
  const patientShare = total;
  const insurancePays = insuranceDiscount;

  const { getPricing, setPricing } = useVisitPricingCache();
  const pricingKey = useMemo(() => {
    if (!patient?.id || !context.providerId) return '';
    return buildVisitPricingKey({
      patientId: patient.id,
      doctorId: context.providerId,
      specialtyCode: context.specialtyCode,
    });
  }, [patient?.id, context.providerId, context.specialtyCode]);

  useEffect(() => {
    if (context.type !== 'visit' || !patient?.id || !context.providerId) return;
    if (visitPricing) {
      const pricingService: ServiceItem = {
        id: visitPricing.serviceCode,
        code: visitPricing.serviceCode,
        name: visitPricing.serviceName || visitPricing.serviceCode,
        nameEn: visitPricing.serviceNameEn || visitPricing.serviceName || visitPricing.serviceCode,
        price: visitPricing.price || 0,
        quantity: 1,
        category: 'CONSULTATION',
      };
      setConsultationService(pricingService);
      return;
    }
    setConsultationService(null);

    if (!pricingKey) return;
    const cached = getPricing(pricingKey);
    if (cached) {
      setVisitPricing(cached);
      setPricingError(null);
      return;
    }

    let active = true;
    setPricingLoading(true);
    setPricingError(null);
    fetch(
      `/api/billing/visit-pricing?patientId=${patient.id}&doctorId=${context.providerId}&specialtyCode=${
        context.specialtyCode || ''
      }`
    , { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.error) {
          setPricingError(data.error);
          return;
        }
        setPricing(pricingKey, data);
        setVisitPricing(data);
      })
      .catch((error) => {
        if (!active) return;
        setPricingError(String(error?.message || 'Failed to fetch visit pricing'));
      })
      .finally(() => {
        if (!active) return;
        setPricingLoading(false);
      });

    return () => {
      active = false;
    };
  }, [context, getPricing, patient, pricingKey, setPricing, visitPricing]);

  const checkInsurance = async () => {
    if (total <= 0) {
      await processPayment(true);
      return;
    }
    if (!patient.insurancePolicyNumber || skipInsurance) {
      setStep('payment');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/billing/eligibility', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          policyNumber: patient.insurancePolicyNumber,
          serviceDate: new Date().toISOString(),
          services: lineItems.map((s) => ({ code: s.code, amount: s.price })),
        }),
      });
      const data = await res.json();

      setInsuranceResult({
        approved: data.eligible,
        policyNumber: patient.insurancePolicyNumber,
        companyName: patient.insuranceCompanyName || tr('غير معروف', 'Unknown'),
        patientSharePercent: data.patientShare || 20,
        maxCoverage: data.maxCoverage,
        deductible: data.deductible || 0,
        approvalNumber: data.approvalNumber,
        message: data.message,
      });

      setStep('payment');
    } catch (error) {
      console.error('Insurance check failed:', error);
      setInsuranceResult({
        approved: false,
        policyNumber: patient.insurancePolicyNumber,
        companyName: patient.insuranceCompanyName || tr('غير معروف', 'Unknown'),
        patientSharePercent: 100,
        message: tr('فشل التحقق من التأمين', 'Insurance verification failed'),
      });
      setStep('payment');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (skipPaymentStep = false) => {
    setLoading(true);
    try {
      const invoiceRes = await fetch('/api/billing/invoice-draft', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          encounterId: context.encounterId,
          visitId: context.visitId,
          items: lineItems.map((s) => ({
            serviceCode: s.code,
            serviceName: s.name,
            quantity: s.quantity,
            unitPrice: s.price,
            totalPrice: s.price * s.quantity,
          })),
          subtotal,
          vatAmount,
          totalBeforeDiscounts: totalWithVat,
          insuranceDiscount,
          insuranceApprovalNumber: insuranceResult?.approvalNumber,
          promoCode: discountResult?.code,
          promoDiscount,
          total: patientShare,
          insuranceAmount: insurancePays,
          billingMeta: visitPricing
            ? {
                visitType: visitPricing.visitType,
                visitTypeCode: visitPricing.visitTypeCode,
                serviceCode: visitPricing.serviceCode,
                serviceName: visitPricing.serviceName,
                specialtyCode: context.specialtyCode,
                providerId: context.providerId,
                price: visitPricing.price,
                isFree: visitPricing.isFree,
                reason: visitPricing.reason,
              }
            : undefined,
        }),
      });

      const invoiceData = await invoiceRes.json();
      if (!invoiceRes.ok) throw new Error(invoiceData.error || 'Failed to create invoice');

      setInvoiceId(invoiceData.invoiceId);
      setInvoiceNumber(invoiceData.invoiceNumber || invoiceData.invoiceId);

      if (!skipPaymentStep) {
        const paymentRes = await fetch('/api/billing/payments', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoiceData.invoiceId,
            amount: patientShare,
            method: paymentMethod,
            reference: paymentReference,
            status: 'RECORDED',
            encounterCoreId: context.encounterId || context.visitId || undefined,
          }),
        });

        if (!paymentRes.ok) {
          const paymentData = await paymentRes.json();
          throw new Error(paymentData.error || 'Failed to process payment');
        }
      }

      setStep('complete');
      setShowReceipt(true);
      if (!completed) {
        setCompleted(true);
        onComplete(invoiceData.invoiceId, 'PAID', {
          amount: patientShare,
          method: paymentMethod,
          reference: paymentReference || undefined,
        });
      }
    } catch (error) {
      console.error('Payment failed:', error);
      toast({ title: tr('فشل في معالجة الدفع', 'Payment processing failed'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (invoiceId && !completed) {
      setCompleted(true);
      onComplete(invoiceId, 'PAID', {
        amount: patientShare,
        method: paymentMethod,
        reference: paymentReference || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3 text-white">
            <Receipt className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">{tr('فاتورة جديدة', 'New Invoice')}</h2>
              <p className="text-sm text-blue-100">
                {patient.fullName} - {patient.mrn}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/20 rounded-lg text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 p-4 bg-slate-50 border-b">
          {['services', 'insurance', 'payment', 'complete'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : idx < ['services', 'insurance', 'payment', 'complete'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {idx < ['services', 'insurance', 'payment', 'complete'].indexOf(step) ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < 3 && (
                <div
                  className={`w-12 h-1 mx-1 rounded ${
                    idx < ['services', 'insurance', 'payment', 'complete'].indexOf(step)
                      ? 'bg-green-500'
                      : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'services' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  1
                </span>
                {tr('اختيار الخدمات', 'Select Services')}
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-slate-900">{tr('الاستشارة التلقائية', 'Automatic Consultation')}</h4>
                </div>
                {pricingLoading ? (
                  <div className="text-sm text-slate-500">{tr('جاري تحميل التسعير...', 'Loading pricing...')}</div>
                ) : pricingError ? (
                  <div className="text-sm text-red-600">{pricingError}</div>
                ) : consultationService ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-slate-900">
                        {language === 'en' ? (consultationService.nameEn || consultationService.name) : consultationService.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {consultationService.code} •{' '}
                        {visitPricing?.visitTypeCode
                          ? (language === 'ar' ? getVisitTypeConfig(visitPricing.visitTypeCode).label : (getVisitTypeConfig(visitPricing.visitTypeCode).labelEn || getVisitTypeConfig(visitPricing.visitTypeCode).label))
                          : (visitPricing?.visitType === 'NEW' ? tr('زيارة جديدة', 'New visit') : visitPricing?.visitType === 'RETURN' ? tr('زيارة عودة', 'Return visit') : tr('متابعة', 'Follow-up'))}
                      </div>
                      {visitPricing?.reason && (
                        <div className="text-xs text-slate-500 mt-1">{visitPricing.reason}</div>
                      )}
                      {visitPricing?.service?.rules?.requiresApproval && (
                        <div className="mt-2 inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          {tr('يحتاج موافقة تأمين', 'Requires insurance approval')}
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      {visitPricing?.isFree ? (
                        <div className="text-green-600 font-bold">{tr('مجاني', 'Free')}</div>
                      ) : (
                        <div className="text-slate-900 font-bold">{language === 'ar' ? `${consultationService.price.toFixed(2)} ر.س` : `SAR ${consultationService.price.toFixed(2)}`}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">{tr('لا يوجد تسعير متاح للاستشارة.', 'No consultation pricing available.')}</div>
                )}
              </div>

              <ServiceSelector
                services={services}
                onServicesChange={setServices}
                specialtyCode={context.specialtyCode}
                providerId={context.providerId}
                language={language}
              />

              <DiscountCode subtotal={subtotal} onDiscountApplied={setDiscountResult} />
            </div>
          )}

          {step === 'insurance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  2
                </span>
                {tr('التحقق من التأمين', 'Insurance Check')}
              </h3>

              {patient.insurancePolicyNumber ? (
                <InsuranceCheck
                  patient={patient}
                  services={lineItems}
                  result={insuranceResult}
                  onSkip={() => {
                    setSkipInsurance(true);
                    setStep('payment');
                  }}
                  loading={loading}
                />
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-amber-800">{tr('لا يوجد تأمين مسجل', 'No insurance registered')}</p>
                      <p className="text-sm text-amber-600">{tr('سيتم الدفع كاش بالكامل', 'Payment will be full cash')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                  3
                </span>
                {tr('الدفع', 'Payment')}
              </h3>

              {insuranceResult && (
                <div
                  className={`p-4 rounded-xl border ${
                    insuranceResult.approved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Shield
                      className={`w-5 h-5 ${
                        insuranceResult.approved ? 'text-green-600' : 'text-red-600'
                      }`}
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          insuranceResult.approved ? 'text-green-800' : 'text-red-800'
                        }`}
                      >
                        {insuranceResult.approved ? tr('التأمين مقبول', 'Insurance approved') : tr('التأمين مرفوض', 'Insurance rejected')}
                      </p>
                      <p
                        className={`text-sm ${
                          insuranceResult.approved ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {insuranceResult.companyName} - {insuranceResult.policyNumber}
                      </p>
                      {insuranceResult.approvalNumber && (
                        <p className="text-xs text-green-600 mt-1">
                          {tr('رقم الموافقة', 'Approval number')}: {insuranceResult.approvalNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <PaymentMethods
                selectedMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
                reference={paymentReference}
                onReferenceChange={setPaymentReference}
                amount={patientShare}
              />
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{tr('تم الدفع بنجاح!', 'Payment successful!')}</h3>
              <p className="text-slate-500 mb-6">{tr('رقم الفاتورة', 'Invoice number')}: {invoiceNumber || invoiceId}</p>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowReceipt(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Printer className="w-4 h-4" />
                  {tr('طباعة الفاتورة', 'Print invoice')}
                </button>
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  {tr('إنهاء', 'Done')}
                </button>
              </div>
            </div>
          )}
        </div>

        {step !== 'complete' && (
          <div className="border-t bg-slate-50 p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">{tr('المجموع', 'Subtotal')}</p>
                <p className="text-lg font-bold text-slate-900">{language === 'ar' ? `${subtotal.toFixed(2)} ر.س` : `SAR ${subtotal.toFixed(2)}`}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-500">{tr('الضريبة (15%)', 'Tax (15%)')}</p>
                <p className="text-lg font-bold text-slate-900">{language === 'ar' ? `${vatAmount.toFixed(2)} ر.س` : `SAR ${vatAmount.toFixed(2)}`}</p>
              </div>
              {insuranceDiscount > 0 && (
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-slate-500">{tr('خصم التأمين', 'Insurance discount')}</p>
                  <p className="text-lg font-bold text-green-600">
                    -{language === 'ar' ? `${insuranceDiscount.toFixed(2)} ر.س` : `SAR ${insuranceDiscount.toFixed(2)}`}
                  </p>
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-slate-500">{tr('كود الخصم', 'Promo discount')}</p>
                  <p className="text-lg font-bold text-green-600">
                    -{language === 'ar' ? `${promoDiscount.toFixed(2)} ر.س` : `SAR ${promoDiscount.toFixed(2)}`}
                  </p>
                </div>
              )}
              <div className="bg-blue-600 rounded-lg p-3 text-white">
                <p className="text-xs text-blue-100">{tr('المطلوب من المريض', 'Patient amount')}</p>
                <p className="text-xl font-bold">{language === 'ar' ? `${patientShare.toFixed(2)} ر.س` : `SAR ${patientShare.toFixed(2)}`}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (step === 'services') onCancel();
                  else if (step === 'insurance') setStep('services');
                  else if (step === 'payment')
                    setStep(patient.insurancePolicyNumber ? 'insurance' : 'services');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-white"
                disabled={loading}
              >
                {step === 'services' ? tr('إلغاء', 'Cancel') : tr('رجوع', 'Back')}
              </button>

              <button
                onClick={() => {
                  if (step === 'services') {
                    if (!consultationService) {
                      alert(tr('يرجى تأكيد تسعير الاستشارة أولاً', 'Please confirm consultation pricing first'));
                      return;
                    }
                    if (total <= 0) {
                      processPayment(true);
                      return;
                    }
                    if (patient.insurancePolicyNumber && !skipInsurance) {
                      setStep('insurance');
                      checkInsurance();
                    } else {
                      setStep('payment');
                    }
                  } else if (step === 'insurance') {
                    setStep('payment');
                  } else if (step === 'payment') {
                    processPayment();
                  }
                }}
                disabled={loading || (step === 'services' && !consultationService)}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    {tr('جاري المعالجة...', 'Processing...')}
                  </>
                ) : step === 'payment' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {tr('تأكيد الدفع', 'Confirm payment')} ({language === 'ar' ? `${patientShare.toFixed(2)} ر.س` : `SAR ${patientShare.toFixed(2)}`})
                  </>
                ) : (
                  tr('التالي', 'Next')
                )}
              </button>
            </div>
          </div>
        )}

        {showReceipt && invoiceId && (
          <ReceiptPreview
            invoiceId={invoiceNumber || invoiceId}
            patient={patient}
            services={lineItems}
            subtotal={subtotal}
            insuranceDiscount={insuranceDiscount}
            insuranceCompany={insuranceResult?.companyName}
            insuranceApproval={insuranceResult?.approvalNumber}
            promoDiscount={promoDiscount}
            promoCode={discountResult?.code}
            total={patientShare}
            paymentMethod={paymentMethod}
            paymentReference={paymentReference}
            onClose={() => setShowReceipt(false)}
            onPrint={() => window.print()}
          />
        )}
      </div>
    </div>
  );
}
