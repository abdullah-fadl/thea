'use client';

import { Banknote, CreditCard, Smartphone, QrCode } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE' | 'BANK_TRANSFER';

interface Props {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  reference: string;
  onReferenceChange: (ref: string) => void;
  amount: number;
}

export function PaymentMethods({
  selectedMethod,
  onMethodChange,
  reference,
  onReferenceChange,
  amount,
}: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const methods: { value: PaymentMethod; icon: any; label: string; description: string }[] = [
    { value: 'CASH', icon: Banknote, label: tr('نقدي', 'Cash'), description: tr('الدفع نقدًا', 'Pay with cash') },
    { value: 'CARD', icon: CreditCard, label: tr('بطاقة', 'Card'), description: tr('بطاقة ائتمان / خصم', 'Credit / debit card') },
    { value: 'ONLINE', icon: Smartphone, label: tr('إلكتروني', 'Online'), description: tr('الدفع الإلكتروني', 'Online payment') },
    { value: 'BANK_TRANSFER', icon: QrCode, label: tr('تحويل بنكي', 'Bank Transfer'), description: tr('تحويل بنكي مباشر', 'Direct bank transfer') },
  ];
  const needsReference = selectedMethod !== 'CASH';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.value;

          return (
            <button
              key={method.value}
              onClick={() => onMethodChange(method.value)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon
                className={`w-8 h-8 mx-auto mb-2 ${
                  isSelected ? 'text-blue-600' : 'text-slate-400'
                }`}
              />
              <div className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                {method.label}
              </div>
              <div className="text-xs text-slate-500 mt-1">{method.description}</div>
            </button>
          );
        })}
      </div>

      {needsReference && (
        <div className="bg-slate-50 rounded-xl p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {selectedMethod === 'CARD' && tr('رقم مرجع البطاقة', 'Card Reference Number')}
            {selectedMethod === 'ONLINE' && tr('رقم مرجع الدفع', 'Payment Reference Number')}
            {selectedMethod === 'BANK_TRANSFER' && tr('رقم مرجع التحويل', 'Transfer Reference Number')}
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => onReferenceChange(e.target.value)}
            placeholder={tr('أدخل رقم المرجع', 'Enter reference number')}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      )}

      <div className="bg-blue-600 rounded-xl p-6 text-white text-center">
        <p className="text-sm text-blue-100 mb-1">{tr('المبلغ المطلوب', 'Amount Required')}</p>
        <p className="text-4xl font-bold">{amount.toFixed(2)}</p>
        <p className="text-blue-100">{tr('ريال سعودي', 'SAR')}</p>
      </div>
    </div>
  );
}
