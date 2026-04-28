'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Search,
  Clock,
  TestTube,
  Scan,
  Syringe,
  Pill,
  User,
  CreditCard,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { OrderInvoiceScreen } from '@/components/billing/OrderInvoiceScreen';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function PendingOrders() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const params = new URLSearchParams();
  params.set('paymentStatus', 'PENDING_PAYMENT');
  if (search) params.set('search', search);
  if (typeFilter) params.set('type', typeFilter);

  const { data, mutate, isLoading } = useSWR(`/api/billing/pending-orders?${params.toString()}`, fetcher, {
    refreshInterval: 15000,
  });

  const orders = data?.items || [];

  const orderTypeConfig = {
    LAB: { icon: TestTube, color: 'text-purple-600 bg-purple-100', label: tr('مختبر', 'Lab') },
    RADIOLOGY: { icon: Scan, color: 'text-blue-600 bg-blue-100', label: tr('أشعة', 'Radiology') },
    PROCEDURE: { icon: Syringe, color: 'text-green-600 bg-green-100', label: tr('إجراء', 'Procedure') },
    MEDICATION: { icon: Pill, color: 'text-amber-600 bg-amber-100', label: tr('دواء', 'Medication') },
  };

  const ordersByPatient = orders.reduce((acc: any, order: any) => {
    const patientId = order.patientId;
    if (!acc[patientId]) {
      acc[patientId] = {
        patientId,
        patientName: order.patientName || tr('مريض', 'Patient'),
        patientMrn: order.patientMrn || '—',
        orders: [],
        totalAmount: 0,
      };
    }
    acc[patientId].orders.push(order);
    acc[patientId].totalAmount += order.totalPrice || 0;
    return acc;
  }, {});

  const patientGroups = Object.values(ordersByPatient);

  const stats = {
    total: orders.length,
    lab: orders.filter((o: any) => o.type === 'LAB').length,
    radiology: orders.filter((o: any) => o.type === 'RADIOLOGY').length,
    procedure: orders.filter((o: any) => o.type === 'PROCEDURE').length,
    totalAmount: orders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0),
  };

  const handleOpenInvoice = (patientId: string) => {
    setSelectedPatient(patientId);
    setShowInvoice(true);
  };

  const handleInvoiceComplete = () => {
    setShowInvoice(false);
    setSelectedPatient(null);
    mutate();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('أوردرات بانتظار الدفع', 'Orders Pending Payment')}</h1>
            <p className="text-muted-foreground">{tr('إجراءات تحتاج تحصيل قبل التنفيذ', 'Procedures that require payment before execution')}</p>
          </div>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl hover:bg-card"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {tr('تحديث', 'Refresh')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-xl">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{tr('إجمالي الأوردرات', 'Total orders')}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <TestTube className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.lab}</p>
                <p className="text-xs text-muted-foreground">{tr('مختبر', 'Lab')}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Scan className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.radiology}</p>
                <p className="text-xs text-muted-foreground">{tr('أشعة', 'Radiology')}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Syringe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.procedure}</p>
                <p className="text-xs text-muted-foreground">{tr('إجراءات', 'Procedures')}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAmount.toFixed(0)}</p>
                <p className="text-xs text-blue-100">{tr('ر.س معلق', 'SAR pending')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={tr('بحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 border border-border rounded-xl thea-input-focus bg-card text-foreground"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-xl bg-card text-foreground"
            >
              <option value="">{tr('كل الأنواع', 'All types')}</option>
              <option value="LAB">{tr('مختبر', 'Lab')}</option>
              <option value="RADIOLOGY">{tr('أشعة', 'Radiology')}</option>
              <option value="PROCEDURE">{tr('إجراءات', 'Procedures')}</option>
              <option value="MEDICATION">{tr('أدوية', 'Medications')}</option>
            </select>
          </div>
        </div>

        {patientGroups.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">{tr('لا توجد أوردرات معلقة', 'No pending orders')}</h3>
            <p className="text-muted-foreground">{tr('جميع الإجراءات مدفوعة وجاهزة للتنفيذ', 'All procedures are paid and ready')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {patientGroups.map((group: { patientId: string; patientName: string; patientMrn: string; orders: Record<string, unknown>[]; totalAmount: number }) => (
              <div key={group.patientId} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{group.patientName}</h3>
                      <p className="text-sm text-muted-foreground">{tr('ملف', 'MRN')}: {group.patientMrn}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">{group.orders.length} {tr('أوردر', 'orders')}</p>
                      <p className="text-lg font-bold text-primary">{group.totalAmount.toFixed(2)} ر.س</p>
                    </div>
                    <button
                      onClick={() => handleOpenInvoice(group.patientId)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90"
                    >
                      <CreditCard className="w-4 h-4" />
                      {tr('تحصيل', 'Collect')}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {group.orders.map((order: { id: string; type: string; name: string; nameAr?: string; code: string; priority?: string; totalPrice?: number; orderedAt: string }) => {
                    const config =
                      orderTypeConfig[order.type as keyof typeof orderTypeConfig] || orderTypeConfig.LAB;
                    const Icon = config.icon;

                    return (
                      <div key={order.id} className="p-4 flex items-center gap-4 thea-hover-lift thea-transition-fast">
                        <div className={`p-2 rounded-xl ${config.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1">
                          <div className="font-medium text-foreground">{order.nameAr || order.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {order.code} • {config.label}
                            {order.priority === 'URGENT' && (
                              <span className="mr-2 text-red-600 font-medium">{tr('عاجل', 'Urgent')}</span>
                            )}
                          </div>
                        </div>

                        <div className="text-left">
                          <p className="font-semibold text-foreground">{order.totalPrice?.toFixed(2)} ر.س</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.orderedAt).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvoice && selectedPatient && (
        <OrderInvoiceScreen
          patientId={selectedPatient}
          onComplete={handleInvoiceComplete}
          onCancel={() => {
            setShowInvoice(false);
            setSelectedPatient(null);
          }}
        />
      )}
    </div>
  );
}
