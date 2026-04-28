'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  X,
  CreditCard,
  Shield,
  Printer,
  CheckCircle,
  TestTube,
  Scan,
  Syringe,
  Pill,
  AlertCircle,
} from 'lucide-react';
import { PaymentMethods, type PaymentMethod } from './PaymentMethods';
import { InsuranceCheck, type InsuranceResult } from './InsuranceCheck';
import { DiscountCode, type DiscountResult } from './DiscountCode';
import type { InvoicePatient } from './InvoiceScreen';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const orderTypeConfig = {
  LAB: { icon: TestTube, color: 'text-purple-600 bg-purple-100' },
  RADIOLOGY: { icon: Scan, color: 'text-blue-600 bg-blue-100' },
  PROCEDURE: { icon: Syringe, color: 'text-green-600 bg-green-100' },
  MEDICATION: { icon: Pill, color: 'text-amber-600 bg-amber-100' },
};

interface Props {
  patientId: string;
  orderIds?: string[];
  onComplete: (invoiceId: string) => void;
  onCancel: () => void;
}

export function OrderInvoiceScreen({ patientId, orderIds, onComplete, onCancel }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [step, setStep] = useState<'orders' | 'insurance' | 'payment' | 'complete'>('orders');
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [insuranceResult, setInsuranceResult] = useState<InsuranceResult | null>(null);
  const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const { data: patientData } = useSWR(`/api/patients/${patientId}`, fetcher);
  const patient = (patientData?.patient || patientData || {}) as InvoicePatient;

  const { data: ordersData } = useSWR(
    `/api/billing/pending-orders?patientId=${patientId}&paymentStatus=PENDING_PAYMENT`,
    fetcher
  );
  const orders = ordersData?.items || [];

  useEffect(() => {
    if (orders.length > 0) {
      if (orderIds && orderIds.length > 0) {
        setSelectedOrders(new Set(orderIds));
      } else {
        setSelectedOrders(new Set(orders.map((o: any) => o.id)));
      }
    }
  }, [orders, orderIds]);

  const selectedOrdersList = orders.filter((o: any) => selectedOrders.has(o.id));
  const subtotal = selectedOrdersList.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);

  const insuranceDiscount = insuranceResult?.approved
    ? subtotal * (1 - insuranceResult.patientSharePercent / 100)
    : 0;

  const promoDiscount = discountResult?.valid
    ? discountResult.type === 'percentage'
      ? (subtotal - insuranceDiscount) * (discountResult.value / 100)
      : Math.min(discountResult.value, subtotal - insuranceDiscount)
    : 0;

  const total = Math.max(subtotal - insuranceDiscount - promoDiscount, 0);

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAll = () => {
    setSelectedOrders(new Set(orders.map((o: any) => o.id)));
  };

  const deselectAll = () => {
    setSelectedOrders(new Set());
  };

  const checkInsurance = async () => {
    if (!patient?.insurancePolicyNumber) {
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
          patientId,
          policyNumber: patient.insurancePolicyNumber,
          services: selectedOrdersList.map((o: any) => ({
            code: o.code,
            amount: o.totalPrice,
            type: o.type,
          })),
        }),
      });
      const data = await res.json();
      setInsuranceResult({
        approved: data.eligible,
        policyNumber: patient.insurancePolicyNumber,
        companyName: patient.insuranceCompanyName || tr('غير معروف', 'Unknown'),
        patientSharePercent: data.patientShare || 20,
        approvalNumber: data.approvalNumber,
        message: data.message,
      });
    } catch {
      setInsuranceResult({
        approved: false,
        policyNumber: patient.insurancePolicyNumber,
        companyName: patient.insuranceCompanyName || '',
        patientSharePercent: 100,
        message: tr('فشل التحقق من التأمين', 'Insurance verification failed'),
      });
    } finally {
      setLoading(false);
      setStep('payment');
    }
  };

  const processPayment = async () => {
    if (selectedOrders.size === 0) {
      alert(tr('يرجى اختيار أوردر واحد على الأقل', 'Please select at least one order'));
      return;
    }

    setLoading(true);
    try {
      const invoiceRes = await fetch('/api/billing/order-invoice', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          orderIds: Array.from(selectedOrders),
          subtotal,
          insuranceDiscount,
          insuranceApprovalNumber: insuranceResult?.approvalNumber,
          promoCode: discountResult?.code,
          promoDiscount,
          total,
          paymentMethod,
          paymentReference,
        }),
      });

      const invoiceData = await invoiceRes.json();
      if (!invoiceRes.ok) throw new Error(invoiceData.error || 'Failed to create invoice');
      setInvoiceId(invoiceData.invoiceId);

      const releaseRes = await fetch('/api/billing/release-orders', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedOrders),
          invoiceId: invoiceData.invoiceId,
          paymentMethod,
          paymentReference,
          amount: total,
        }),
      });

      if (!releaseRes.ok) {
        const releaseData = await releaseRes.json().catch(() => ({}));
        throw new Error(releaseData.error || 'Failed to release orders');
      }

      setStep('complete');
    } catch (error: any) {
      alert(tr('خطأ: ', 'Error: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-purple-700">
          <div className="flex items-center justify-between text-white">
            <div>
              <h2 className="text-lg font-semibold">{tr('فاتورة الإجراءات', 'Orders Invoice')}</h2>
              <p className="text-sm text-purple-100">
                {patient?.fullName || tr('مريض', 'Patient')} - {patient?.mrn || '\u2014'}
              </p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{tr('الأوردرات المعلقة', 'Pending Orders')} ({orders.length})</h3>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">
                    {tr('تحديد الكل', 'Select All')}
                  </button>
                  <span className="text-slate-300">|</span>
                  <button onClick={deselectAll} className="text-sm text-slate-500 hover:underline">
                    {tr('إلغاء التحديد', 'Deselect All')}
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>{tr('لا توجد أوردرات معلقة لهذا المريض', 'No pending orders for this patient')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orders.map((order: any) => {
                    const config =
                      orderTypeConfig[order.type as keyof typeof orderTypeConfig] || orderTypeConfig.LAB;
                    const Icon = config.icon;
                    const isSelected = selectedOrders.has(order.id);

                    return (
                      <div
                        key={order.id}
                        onClick={() => toggleOrder(order.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-5 h-5 rounded border-slate-300 text-purple-600"
                          />

                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>

                          <div className="flex-1">
                            <div className="font-medium">{order.nameAr || order.name}</div>
                            <div className="text-sm text-slate-500">
                              {order.code}
                              {order.priority === 'URGENT' && <span className="mr-2 text-red-600 inline-flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> {tr('عاجل', 'Urgent')}</span>}
                            </div>
                          </div>

                          <div className="text-left font-semibold">{order.totalPrice?.toFixed(2)} {tr('ر.س', 'SAR')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedOrders.size > 0 && (
                <DiscountCode subtotal={subtotal} onDiscountApplied={setDiscountResult} />
              )}
            </div>
          )}

          {step === 'insurance' && (
            <div className="space-y-4">
              <h3 className="font-semibold">{tr('التحقق من التأمين', 'Insurance Verification')}</h3>
              {patient?.insurancePolicyNumber ? (
                <InsuranceCheck
                  patient={patient}
                  services={selectedOrdersList.map((o: any) => ({
                    id: o.id,
                    code: o.code,
                    name: o.nameAr || o.name,
                    price: o.totalPrice,
                    quantity: 1,
                  }))}
                  result={insuranceResult}
                  onSkip={() => setStep('payment')}
                  loading={loading}
                />
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <p className="text-amber-800">{tr('لا يوجد تأمين - سيتم الدفع كاش', 'No insurance - Cash payment')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-semibold">{tr('الدفع', 'Payment')}</h3>

              {insuranceResult && insuranceResult.approved && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <Shield className="w-5 h-5" />
                    <span>{tr('التأمين يغطي', 'Insurance covers')} {100 - insuranceResult.patientSharePercent}%</span>
                  </div>
                  {insuranceResult.approvalNumber && (
                    <p className="text-sm text-green-600 mt-1">{tr('رقم الموافقة:', 'Approval Number:')} {insuranceResult.approvalNumber}</p>
                  )}
                </div>
              )}

              <PaymentMethods
                selectedMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
                reference={paymentReference}
                onReferenceChange={setPaymentReference}
                amount={total}
              />
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{tr('تم الدفع بنجاح!', 'Payment Successful!')}</h3>
              <p className="text-slate-500 mb-4">{tr('رقم الفاتورة:', 'Invoice Number:')} {invoiceId}</p>
              <p className="text-green-600 font-medium flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> {tr(`تم فتح ${selectedOrders.size} أوردر للتنفيذ`, `${selectedOrders.size} orders released for execution`)}</p>
            </div>
          )}
        </div>

        {step !== 'complete' && (
          <div className="border-t bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-slate-500">{selectedOrders.size} {tr('أوردر محدد', 'orders selected')}</div>
              <div className="text-left">
                {insuranceDiscount > 0 && (
                  <div className="text-sm text-green-600">{tr('خصم التأمين:', 'Insurance Discount:')} -{insuranceDiscount.toFixed(2)} {tr('ر.س', 'SAR')}</div>
                )}
                {promoDiscount > 0 && (
                  <div className="text-sm text-green-600">{tr('كود الخصم:', 'Promo Discount:')} -{promoDiscount.toFixed(2)} {tr('ر.س', 'SAR')}</div>
                )}
                <div className="text-xl font-bold text-blue-600">{tr('المطلوب:', 'Total Due:')} {total.toFixed(2)} {tr('ر.س', 'SAR')}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (step === 'orders') onCancel();
                  else if (step === 'insurance') setStep('orders');
                  else if (step === 'payment') setStep(patient?.insurancePolicyNumber ? 'insurance' : 'orders');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-white"
                disabled={loading}
              >
                {step === 'orders' ? tr('إلغاء', 'Cancel') : tr('رجوع', 'Back')}
              </button>

              <button
                onClick={() => {
                  if (step === 'orders') {
                    if (selectedOrders.size === 0) {
                      alert(tr('يرجى اختيار أوردر واحد على الأقل', 'Please select at least one order'));
                      return;
                    }
                    if (patient?.insurancePolicyNumber) {
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
                disabled={loading || (step === 'orders' && selectedOrders.size === 0)}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? (
                  tr('جاري المعالجة...', 'Processing...')
                ) : step === 'payment' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {tr('دفع', 'Pay')} {total.toFixed(2)} {tr('ر.س', 'SAR')}
                  </>
                ) : (
                  tr('التالي', 'Next')
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="border-t bg-slate-50 p-4 flex justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-white"
            >
              <Printer className="w-4 h-4" />
              {tr('طباعة', 'Print')}
            </button>
            <button
              onClick={() => onComplete(invoiceId!)}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              {tr('إنهاء', 'Finish')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
