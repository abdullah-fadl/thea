'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Tag } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

export interface DiscountResult {
  valid: boolean;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  message?: string;
}

interface Props {
  subtotal: number;
  onDiscountApplied: (result: DiscountResult | null) => void;
}

export function DiscountCode({ subtotal, onDiscountApplied }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscountResult | null>(null);
  const [error, setError] = useState('');

  const applyCode = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/billing/promo-codes/validate', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), subtotal }),
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        const discountResult: DiscountResult = {
          valid: true,
          code: code.trim(),
          type: data.type,
          value: data.value,
          message: data.message,
        };
        setResult(discountResult);
        onDiscountApplied(discountResult);
      } else {
        setError(data.message || tr('كود غير صالح', 'Invalid code'));
        setResult(null);
        onDiscountApplied(null);
      }
    } catch (err) {
      setError(tr('فشل في التحقق من الكود', 'Failed to validate code'));
      setResult(null);
      onDiscountApplied(null);
    } finally {
      setLoading(false);
    }
  };

  const removeCode = () => {
    setCode('');
    setResult(null);
    setError('');
    onDiscountApplied(null);
  };

  const discountAmount = result
    ? result.type === 'percentage'
      ? subtotal * (result.value / 100)
      : Math.min(result.value, subtotal)
    : 0;

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-5 h-5 text-slate-600" />
        <h4 className="font-medium text-slate-900">{tr('كود الخصم', 'Promo Code')}</h4>
      </div>

      {result ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <span className="font-medium text-green-800">{result.code}</span>
                <span className="text-sm text-green-600 mx-2">
                  ({result.type === 'percentage' ? `${result.value}%` : (language === 'ar' ? `${result.value} ر.س` : `SAR ${result.value}`)})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-green-700">
                -{language === 'ar' ? `${discountAmount.toFixed(2)} ر.س` : `SAR ${discountAmount.toFixed(2)}`}
              </span>
              <button onClick={removeCode} className="text-red-500 hover:text-red-700 text-sm">
                {tr('إزالة', 'Remove')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={tr('أدخل كود الخصم', 'Enter promo code')}
            className="flex-1 px-3 py-2 border rounded-lg"
            disabled={loading}
          />
          <button
            onClick={applyCode}
            disabled={loading || !code.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : tr('تطبيق', 'Apply')}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-600 text-sm">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
