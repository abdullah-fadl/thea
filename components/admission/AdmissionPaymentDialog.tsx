'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard, Building2, CheckCircle2, Printer, Loader2 } from 'lucide-react';

interface AdmissionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  patientName: string;
  mrn?: string;
  estimatedCost?: number;
  depositRequired?: number;
  depositCollected?: number;
  onSuccess?: () => void;
}

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';

interface ReceiptData {
  receiptNumber: string;
  date: string;
  patient: { name: string; mrn: string };
  items: Array<{ description: string; descriptionAr: string; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  reference: string;
  currency: string;
}

export default function AdmissionPaymentDialog({
  open,
  onOpenChange,
  requestId,
  patientName,
  mrn,
  estimatedCost,
  depositRequired = 0,
  depositCollected = 0,
  onSuccess,
}: AdmissionPaymentDialogProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [step, setStep] = useState<'payment' | 'receipt'>('payment');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState(String(Math.max(0, depositRequired - depositCollected)));
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const remaining = Math.max(0, depositRequired - depositCollected);

  const handleCollect = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admission/requests/${requestId}/collect-deposit`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          amount: Number(amount),
          reference: reference || undefined,
          currency: 'SAR',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr('فشل تحصيل الإيداع', 'Failed to collect deposit'));
        return;
      }

      setReceipt(data.receipt);
      setStep('receipt');
      onSuccess?.();
    } catch {
      setError(tr('خطأ في الاتصال', 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setStep('payment');
    setReceipt(null);
    setError('');
    onOpenChange(false);
  };

  const methods: Array<{ key: PaymentMethod; label: string; icon: typeof Banknote }> = [
    { key: 'CASH', label: tr('نقدي', 'Cash'), icon: Banknote },
    { key: 'CARD', label: tr('بطاقة', 'Card'), icon: CreditCard },
    { key: 'BANK_TRANSFER', label: tr('تحويل بنكي', 'Bank Transfer'), icon: Building2 },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {step === 'payment'
              ? tr('تحصيل إيداع القبول', 'Collect Admission Deposit')
              : tr('إيصال الإيداع', 'Deposit Receipt')}
          </DialogTitle>
        </DialogHeader>

        {step === 'payment' && (
          <div className="space-y-4">
            {/* Patient info */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="font-medium">{patientName}</div>
              {mrn && <div className="text-muted-foreground">{tr('رقم الملف', 'MRN')}: {mrn}</div>}
            </div>

            {/* Cost summary */}
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              {estimatedCost != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('التكلفة التقديرية', 'Estimated Cost')}</span>
                  <span>{estimatedCost.toLocaleString()} {tr('ر.س', 'SAR')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('الإيداع المطلوب', 'Deposit Required')}</span>
                <span className="font-medium">{depositRequired.toLocaleString()} {tr('ر.س', 'SAR')}</span>
              </div>
              {depositCollected > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>{tr('تم تحصيله', 'Already Collected')}</span>
                  <span>{depositCollected.toLocaleString()} {tr('ر.س', 'SAR')}</span>
                </div>
              )}
              {remaining > 0 && (
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>{tr('المتبقي', 'Remaining')}</span>
                  <span className="text-orange-600">{remaining.toLocaleString()} {tr('ر.س', 'SAR')}</span>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <Label className="text-sm font-medium mb-2 block">{tr('طريقة الدفع', 'Payment Method')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {methods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMethod(m.key)}
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs transition-colors ${
                        method === m.key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="deposit-amount" className="text-sm font-medium mb-1 block">
                {tr('المبلغ', 'Amount')} ({tr('ر.س', 'SAR')})
              </Label>
              <Input
                id="deposit-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(remaining)}
              />
            </div>

            {/* Reference (for non-cash) */}
            {method !== 'CASH' && (
              <div>
                <Label htmlFor="deposit-ref" className="text-sm font-medium mb-1 block">
                  {tr('رقم المرجع', 'Reference Number')}
                </Label>
                <Input
                  id="deposit-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={tr('رقم العملية أو الشيك', 'Transaction or check number')}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleCollect}
                disabled={loading || !amount || Number(amount) <= 0}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                {tr('تحصيل', 'Collect')} {amount ? `${Number(amount).toLocaleString()} ${tr('ر.س', 'SAR')}` : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'receipt' && receipt && (
          <div className="space-y-4">
            {/* Success indicator */}
            <div className="flex flex-col items-center gap-2 py-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-semibold text-green-700">
                {tr('تم تحصيل الإيداع بنجاح', 'Deposit Collected Successfully')}
              </p>
            </div>

            {/* Receipt details */}
            <div className="rounded-lg border p-4 space-y-3 text-sm" id="admission-receipt">
              <div className="text-center border-b pb-2">
                <div className="font-bold text-lg">{tr('إيصال إيداع', 'Deposit Receipt')}</div>
                <div className="text-muted-foreground">{receipt.receiptNumber}</div>
                <div className="text-muted-foreground text-xs">
                  {new Date(receipt.date).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                </div>
              </div>

              <div>
                <div className="font-medium">{receipt.patient.name}</div>
                {receipt.patient.mrn && (
                  <div className="text-muted-foreground">{tr('رقم الملف', 'MRN')}: {receipt.patient.mrn}</div>
                )}
              </div>

              <div className="border-t pt-2">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{language === 'ar' ? item.descriptionAr : item.description}</span>
                    <span className="font-medium">{item.amount.toLocaleString()} {receipt.currency}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-2 flex justify-between font-bold">
                <span>{tr('الإجمالي', 'Total')}</span>
                <span>{receipt.total.toLocaleString()} {receipt.currency}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                {tr('طريقة الدفع', 'Payment Method')}: {receipt.paymentMethod}
                {receipt.reference && ` | ${tr('المرجع', 'Ref')}: ${receipt.reference}`}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {tr('طباعة', 'Print')}
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                {tr('إغلاق', 'Close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
