'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';

interface CreditNoteDialogProps {
  encounterCoreId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CREDIT_NOTE_TYPES = [
  { value: 'VOID_REFUND', labelAr: 'إلغاء وإسترداد', labelEn: 'Void & Refund' },
  { value: 'ADJUSTMENT', labelAr: 'تسوية', labelEn: 'Adjustment' },
  { value: 'PATIENT_REFUND', labelAr: 'إسترداد للمريض', labelEn: 'Patient Refund' },
  { value: 'INSURANCE_ADJUSTMENT', labelAr: 'تسوية تأمين', labelEn: 'Insurance Adjustment' },
] as const;

export default function CreditNoteDialog({ encounterCoreId, onClose, onSuccess }: CreditNoteDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [type, setType] = useState<string>('ADJUSTMENT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError(tr('السبب مطلوب', 'Reason is required'));
      return;
    }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError(tr('يرجى إدخال مبلغ صحيح', 'Please enter a valid amount'));
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/billing/credit-notes', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterCoreId, type, amount: amt, reason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Failed');
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || tr('حدث خطأ', 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {tr('إصدار إشعار دائن', 'Issue Credit Note')}
          </h2>
          <p className="text-blue-100 text-sm mt-0.5">
            {tr('تعديل أو إلغاء الفاتورة', 'Adjust or cancel the invoice')}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {tr('نوع الإشعار', 'Note Type')}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CREDIT_NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {language === 'ar' ? t.labelAr : t.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {tr('المبلغ (ريال)', 'Amount (SAR)')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {tr('السبب', 'Reason')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={tr('اذكر سبب الإشعار...', 'State the reason for this note...')}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-muted/30">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {submitting ? tr('جاري الإصدار...', 'Issuing...') : tr('إصدار الإشعار', 'Issue Note')}
          </button>
        </div>
      </div>
    </div>
  );
}
