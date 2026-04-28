'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wallet,
  CreditCard,
  Building2,
  Smartphone,
  Receipt,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type OutstandingInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  paid: number;
  remaining: number;
  status: string;
  issuedAt: string;
  description: string;
};

type PaymentHistoryItem = {
  paymentId: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  createdAt: string;
  invoiceId: string | null;
};

type PaymentConfirmation = {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
};

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  CREDIT_CARD: { ar: 'بطاقة ائتمان', en: 'Credit Card' },
  BANK_TRANSFER: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
  APPLE_PAY: { ar: 'Apple Pay', en: 'Apple Pay' },
  CASH: { ar: 'نقدي', en: 'Cash' },
  CHECK: { ar: 'شيك', en: 'Check' },
  INSURANCE: { ar: 'تأمين', en: 'Insurance' },
};

export default function PortalBilling() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const isRTL = language === 'ar';

  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<OutstandingInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [paying, setPaying] = useState(false);
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR('/api/portal/billing/outstanding', fetcher, {
    refreshInterval: 15000,
  });

  const items: OutstandingInvoice[] = Array.isArray(data?.items) ? data.items : [];
  const totalOutstanding: number = data?.totalOutstanding || 0;
  const paymentHistory: PaymentHistoryItem[] = Array.isArray(data?.paymentHistory) ? data.paymentHistory : [];

  const openPayDialog = (invoice: OutstandingInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('CREDIT_CARD');
    setPayError(null);
    setConfirmation(null);
    setShowPayDialog(true);
  };

  const handlePay = async () => {
    if (!selectedInvoice) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch('/api/portal/billing/pay', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice.invoiceId,
          amount: selectedInvoice.remaining,
          paymentMethod,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.error || tr('فشل الدفع', 'Payment failed'));
      }
      setConfirmation(result.payment);
      mutate();
    } catch (err: any) {
      setPayError(err?.message || tr('فشل الدفع', 'Payment failed'));
    } finally {
      setPaying(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
          <Wallet className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{tr('الفواتير والدفع', 'Billing & Payments')}</h1>
          <p className="text-sm text-muted-foreground">{tr('عرض الفواتير والدفع الإلكتروني', 'View bills and pay online')}</p>
        </div>
      </div>

      {/* Outstanding Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-6">
          <div className="text-sm text-emerald-700 dark:text-emerald-400 mb-1">{tr('المبلغ المستحق', 'Outstanding Balance')}</div>
          {isLoading ? (
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-500 mt-2" />
          ) : (
            <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-300">
              {formatCurrency(totalOutstanding)}
            </div>
          )}
          {items.length > 0 && (
            <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
              {items.length} {tr('فاتورة مستحقة', 'outstanding invoice(s)')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Invoices */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{tr('الفواتير المستحقة', 'Outstanding Invoices')}</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-muted-foreground">{tr('لا توجد فواتير مستحقة', 'No outstanding invoices')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((inv) => (
              <Card key={inv.invoiceId} className="hover:shadow-sm transition">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {inv.status === 'ISSUED' ? tr('صادرة', 'Issued') : tr('مسودة', 'Draft')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(inv.issuedAt)}</span>
                        <span>{tr('الإجمالي', 'Total')}: {formatCurrency(inv.total)}</span>
                        {inv.paid > 0 && <span>{tr('المدفوع', 'Paid')}: {formatCurrency(inv.paid)}</span>}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-bold text-base text-red-600 dark:text-red-400">
                        {formatCurrency(inv.remaining)}
                      </div>
                      <Button size="sm" className="mt-1" onClick={() => openPayDialog(inv)}>
                        {tr('ادفع الآن', 'Pay Now')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Payment History */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{tr('سجل المدفوعات', 'Payment History')}</h2>
        {paymentHistory.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{tr('لا توجد مدفوعات سابقة', 'No payment history')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {paymentHistory.map((p) => (
              <Card key={p.paymentId}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{formatCurrency(p.amount)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{formatDate(p.createdAt)}</span>
                          <span>{tr(METHOD_LABELS[p.method]?.ar || p.method, METHOD_LABELS[p.method]?.en || p.method)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <Badge variant="outline" className="text-xs text-green-600">
                        {tr('مسجل', 'Recorded')}
                      </Badge>
                      {p.reference && (
                        <div className="text-xs text-muted-foreground mt-0.5">{p.reference}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* =========== PAY DIALOG =========== */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {confirmation ? tr('تأكيد الدفع', 'Payment Confirmation') : tr('الدفع الآن', 'Pay Now')}
            </DialogTitle>
          </DialogHeader>

          {confirmation ? (
            /* Confirmation screen */
            <div className="space-y-5 py-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-green-700 dark:text-green-400">
                  {tr('تم الدفع بنجاح', 'Payment Successful')}
                </h3>
              </div>

              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('رقم الإيصال', 'Receipt No.')}</span>
                    <span className="font-mono font-medium">{confirmation.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('المبلغ', 'Amount')}</span>
                    <span className="font-bold">{formatCurrency(confirmation.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('طريقة الدفع', 'Method')}</span>
                    <span>{tr(METHOD_LABELS[confirmation.method]?.ar || confirmation.method, METHOD_LABELS[confirmation.method]?.en || confirmation.method)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tr('التاريخ', 'Date')}</span>
                    <span>{formatDate(confirmation.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" onClick={() => setShowPayDialog(false)}>
                {tr('إغلاق', 'Close')}
              </Button>
            </div>
          ) : (
            /* Payment form */
            <div className="space-y-5 py-2">
              {selectedInvoice && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{tr('رقم الفاتورة', 'Invoice')}</span>
                      <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{tr('المبلغ المستحق', 'Amount Due')}</span>
                      <span className="font-bold text-lg">{formatCurrency(selectedInvoice.remaining)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div>
                <Label className="mb-2 block">{tr('طريقة الدفع', 'Payment Method')}</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT_CARD">
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        {tr('بطاقة ائتمان', 'Credit Card')}
                      </span>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {tr('تحويل بنكي', 'Bank Transfer')}
                      </span>
                    </SelectItem>
                    <SelectItem value="APPLE_PAY">
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Apple Pay
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payError && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  {payError}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayDialog(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button className="flex-1" onClick={handlePay} disabled={paying}>
                  {paying ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {tr('تأكيد الدفع', 'Confirm Payment')} - {selectedInvoice ? formatCurrency(selectedInvoice.remaining) : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
