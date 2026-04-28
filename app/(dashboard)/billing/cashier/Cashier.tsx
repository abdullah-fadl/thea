'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Search, Receipt, Clock, CheckCircle, User } from 'lucide-react';
import { InvoiceScreen, InvoicePatient, InvoiceContext } from '@/components/billing/InvoiceScreen';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function Cashier() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [search, setSearch] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<InvoicePatient | null>(null);
  const [selectedContext, setSelectedContext] = useState<InvoiceContext | null>(null);

  const { data: pendingData, mutate } = useSWR('/api/billing/pending-payments?status=PENDING', fetcher, {
    refreshInterval: 10000,
  });

  const { data: recentInvoices } = useSWR('/api/billing/invoices/recent?limit=10', fetcher);

  const pendingPayments = Array.isArray(pendingData?.items) ? pendingData.items : [];
  const recentList = Array.isArray(recentInvoices?.items) ? recentInvoices.items : [];

  const filteredPending = useMemo(() => {
    if (!search.trim()) return pendingPayments;
    const q = search.trim().toLowerCase();
    return pendingPayments.filter((item: any) => {
      return (
        String(item.patientName || '').toLowerCase().includes(q) ||
        String(item.mrn || '').toLowerCase().includes(q)
      );
    });
  }, [pendingPayments, search]);

  const openInvoice = (item: any) => {
    const patient: InvoicePatient = {
      id: item.patientId,
      mrn: item.mrn,
      fullName: item.patientName,
      nationalId: item.nationalId,
      phone: item.phone,
      insurancePolicyNumber: item.insurancePolicyNumber,
      insuranceCompanyId: item.insuranceCompanyId,
      insuranceCompanyName: item.insuranceCompanyName,
    };

    const context: InvoiceContext = {
      type: item.type || 'visit',
      visitId: item.visitId,
      encounterId: item.encounterId,
      providerId: item.providerId,
      providerName: item.providerName,
      specialtyCode: item.specialtyCode,
      isFirstVisit: item.isFirstVisit,
    };

    setSelectedPatient(patient);
    setSelectedContext(context);
    setShowInvoice(true);
  };

  const handleInvoiceComplete = () => {
    setShowInvoice(false);
    setSelectedPatient(null);
    setSelectedContext(null);
    mutate();
  };

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('الكاشير', 'Cashier')}</h1>
            <p className="text-muted-foreground">{tr('إدارة الفواتير والمدفوعات', 'Manage invoices and payments')}</p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={tr('بحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-border rounded-xl thea-input-focus bg-card text-foreground"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold">{tr('بانتظار الدفع', 'Pending payment')}</h2>
                </div>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-sm rounded-full">
                  {filteredPending.length}
                </span>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filteredPending.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-300" />
                    <p>{tr('لا يوجد مرضى بانتظار الدفع', 'No patients pending payment')}</p>
                  </div>
                ) : (
                  filteredPending.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-4 thea-hover-lift thea-transition-fast cursor-pointer"
                      onClick={() => openInvoice(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{item.patientName}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.mrn} • {item.providerName}
                            </div>
                          </div>
                        </div>

                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">{item.appointmentTime}</div>
                          <div className="text-sm font-medium text-amber-600">
                            {item.serviceType === 'NEW' ? tr('استشارة أولى', 'First consultation') : tr('متابعة', 'Follow-up')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-card rounded-2xl border border-border">
              <div className="p-4 border-b flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-500" />
                <h2 className="font-semibold">{tr('آخر الفواتير', 'Recent invoices')}</h2>
              </div>

              <div className="divide-y max-h-[600px] overflow-y-auto">
                {recentList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p>{tr('لا توجد فواتير', 'No invoices')}</p>
                  </div>
                ) : (
                  recentList.map((invoice: any) => (
                    <div key={invoice.id} className="p-3 thea-hover-lift thea-transition-fast">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{invoice.patientName}</div>
                          <div className="text-xs text-muted-foreground">{invoice.invoiceNumber}</div>
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-green-600">
                            {Number(invoice.total || 0).toFixed(2)} {tr('ر.س', 'SAR')}
                          </div>
                          {invoice.createdAt && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(invoice.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
              <div className="text-sm text-green-100 mb-1">{tr('إجمالي اليوم', 'Today total')}</div>
              <div className="text-3xl font-bold">
                {recentList
                  .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0)
                  .toFixed(2)}
              </div>
              <div className="text-green-100">{tr('ريال سعودي', 'Saudi Riyal')}</div>
            </div>
          </div>
        </div>
      </div>

      {showInvoice && selectedPatient && selectedContext && (
        <InvoiceScreen
          patient={selectedPatient}
          context={selectedContext}
          onComplete={handleInvoiceComplete}
          onCancel={() => {
            setShowInvoice(false);
            setSelectedPatient(null);
            setSelectedContext(null);
          }}
        />
      )}
    </div>
  );
}
