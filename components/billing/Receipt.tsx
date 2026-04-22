'use client';

import { X, Printer } from 'lucide-react';
import { InvoicePatient } from './InvoiceScreen';
import { ServiceItem } from './ServiceSelector';
import { PaymentMethod } from './PaymentMethods';
import { useLang } from '@/hooks/use-lang';

interface Props {
  invoiceId: string;
  patient: InvoicePatient;
  services: ServiceItem[];
  subtotal: number;
  insuranceDiscount: number;
  insuranceCompany?: string;
  insuranceApproval?: string;
  promoDiscount: number;
  promoCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  onClose: () => void;
  onPrint: () => void;
}

function safeField(value: string | undefined | null): string {
  if (!value) return '---';
  try {
    const parsed = JSON.parse(value);
    if (parsed?.__enc) return '---';
  } catch { /* not JSON */ }
  return value;
}

export function ReceiptPreview({
  invoiceId,
  patient,
  services,
  subtotal,
  insuranceDiscount,
  insuranceCompany,
  insuranceApproval,
  promoDiscount,
  promoCode,
  total,
  paymentMethod,
  paymentReference,
  onClose,
  onPrint,
}: Props) {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const paymentMethodLabel: Record<PaymentMethod, string> = {
    CASH: tr('نقداً', 'Cash'),
    CARD: tr('بطاقة', 'Card'),
    ONLINE: tr('إلكتروني', 'Online'),
    BANK_TRANSFER: tr('تحويل بنكي', 'Bank Transfer'),
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto print:max-w-none print:rounded-none print:shadow-none">
        <div className="hidden print:block text-center py-4 border-b">
          <h1 className="text-2xl font-bold">Thea Health</h1>
          <p className="text-sm text-gray-500">{tr('فاتورة ضريبية مبسطة', 'Simplified Tax Invoice')}</p>
        </div>

        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h3 className="font-semibold">{tr('الفاتورة', 'Invoice')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="p-2 hover:bg-slate-100 rounded-lg">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center pb-4 border-b">
            <p className="text-sm text-slate-500">{tr('رقم الفاتورة', 'Invoice Number')}</p>
            <p className="text-xl font-bold font-mono">{invoiceId}</p>
            <p className="text-sm text-slate-500 mt-2">
              {new Date().toLocaleString(language === 'ar' ? 'ar-SA' : 'en-SA')}
            </p>
          </div>

          <div className="pb-4 border-b">
            <h4 className="text-sm text-slate-500 mb-2">{tr('بيانات المريض', 'Patient Details')}</h4>
            <p className="font-medium">{safeField(patient.fullName)}</p>
            <p className="text-sm text-slate-600">{tr('رقم الملف', 'MRN')}: {safeField(patient.mrn)}</p>
            {patient.nationalId && (
              <p className="text-sm text-slate-600">{tr('الهوية', 'National ID')}: {safeField(patient.nationalId)}</p>
            )}
          </div>

          <div className="pb-4 border-b">
            <h4 className="text-sm text-slate-500 mb-2">{tr('الخدمات', 'Services')}</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className={`${isRTL ? 'text-right' : 'text-left'} pb-2`}>{tr('الخدمة', 'Service')}</th>
                  <th className="text-center pb-2">{tr('الكمية', 'Qty')}</th>
                  <th className={`${isRTL ? 'text-left' : 'text-right'} pb-2`}>{tr('السعر', 'Price')}</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td className="py-1">{language === 'en' ? (service.nameEn || service.name) : service.name}</td>
                    <td className="py-1 text-center">{service.quantity}</td>
                    <td className={`py-1 ${isRTL ? 'text-left' : 'text-right'}`}>
                      {(service.price * service.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{tr('المجموع', 'Subtotal')}</span>
              <span>{language === 'ar' ? `${subtotal.toFixed(2)} ر.س` : `SAR ${subtotal.toFixed(2)}`}</span>
            </div>

            {insuranceDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{tr('خصم التأمين', 'Insurance Discount')} ({insuranceCompany})</span>
                <span>-{language === 'ar' ? `${insuranceDiscount.toFixed(2)} ر.س` : `SAR ${insuranceDiscount.toFixed(2)}`}</span>
              </div>
            )}

            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{tr('كود الخصم', 'Promo Code')} ({promoCode})</span>
                <span>-{language === 'ar' ? `${promoDiscount.toFixed(2)} ر.س` : `SAR ${promoDiscount.toFixed(2)}`}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>{tr('الإجمالي', 'Total')}</span>
              <span>{language === 'ar' ? `${total.toFixed(2)} ر.س` : `SAR ${total.toFixed(2)}`}</span>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-700">{tr('تم الدفع', 'Payment Received')}</span>
              <span className="font-medium text-green-700">
                {paymentMethodLabel[paymentMethod]}
              </span>
            </div>
            {paymentReference && (
              <div className="text-xs text-green-600">{tr('رقم المرجع', 'Reference')}: {paymentReference}</div>
            )}
            {insuranceApproval && (
              <div className="text-xs text-green-600">
                {tr('رقم موافقة التأمين', 'Insurance Approval')}: {insuranceApproval}
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-400 pt-4 border-t">
            <p>{tr('تشمل الأسعار ضريبة القيمة المضافة 15%', 'Prices include 15% VAT')}</p>
            <p className="mt-1">{tr('شكراً لزيارتكم', 'Thank you for your visit')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
