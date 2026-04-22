'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Search,
  User,
  CreditCard,
  RefreshCw,
  CheckCircle,
  Clock,
  Plus,
  Calendar,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { OrderInvoiceScreen } from '@/components/billing/OrderInvoiceScreen';
import { AddOrderDialog } from './AddOrderDialog';
import { useLang } from '@/hooks/use-lang';
import { getAge, formatGender } from '@/lib/opd/ui-helpers';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Props ────────────────────────────────────────────────────────────────────

export interface DepartmentReceptionProps {
  departmentKey: string;
  kind: string;
  icon: LucideIcon;
  title: { ar: string; en: string };
  color: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DepartmentReception({
  departmentKey,
  kind,
  icon: DeptIcon,
  title,
  color,
}: DepartmentReceptionProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // ─── State ───────────────────────────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);

  // ─── Patient search ──────────────────────────────────────────────────────
  const shouldSearch = patientSearch.trim().length >= 2;
  const { data: patientResults, isLoading: searchLoading } = useSWR(
    shouldSearch ? `/api/patients/search?q=${encodeURIComponent(patientSearch.trim())}&limit=10` : null,
    fetcher,
    { dedupingInterval: 500 }
  );
  const patients = patientResults?.items || patientResults?.patients || [];

  // ─── Patient encounters ──────────────────────────────────────────────────
  const { data: encounterData } = useSWR(
    selectedPatient ? `/api/encounters/search?patientId=${selectedPatient.id}&status=ACTIVE&limit=10` : null,
    fetcher
  );
  const encounters = encounterData?.items || [];

  // ─── Pending orders for selected patient filtered by department kind ─────
  const { data: ordersData, mutate: mutateOrders, isLoading: ordersLoading } = useSWR(
    selectedPatient
      ? `/api/billing/pending-orders?patientId=${selectedPatient.id}&paymentStatus=PENDING_PAYMENT&type=${kind}`
      : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const orders = ordersData?.items || [];

  // ─── Stats ───────────────────────────────────────────────────────────────
  const totalAmount = orders.reduce((sum: number, o: any) => sum + (o.totalPrice || 0), 0);
  const orderIds = orders.map((o: any) => o.id);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSelectPatient = useCallback((patient: any) => {
    setSelectedPatient(patient);
    setSelectedEncounter(null);
    setPatientSearch('');
  }, []);

  const handleClearPatient = useCallback(() => {
    setSelectedPatient(null);
    setSelectedEncounter(null);
  }, []);

  const handleInvoiceComplete = useCallback(() => {
    setShowInvoice(false);
    mutateOrders();
  }, [mutateOrders]);

  const handleOrderAdded = useCallback(() => {
    setShowAddOrder(false);
    mutateOrders();
  }, [mutateOrders]);

  // ─── Color classes ───────────────────────────────────────────────────────
  const colorClasses: Record<string, { bg: string; text: string; light: string }> = {
    blue: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-100' },
    purple: { bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-100' },
    amber: { bg: 'bg-amber-600', text: 'text-amber-600', light: 'bg-amber-100' },
    green: { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-100' },
  };
  const cc = colorClasses[color] || colorClasses.blue;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 ${cc.light} rounded-2xl`}>
              <DeptIcon className={`w-6 h-6 ${cc.text}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {language === 'ar' ? title.ar : title.en}
              </h1>
              <p className="text-muted-foreground">
                {tr('بحث عن مريض وتحصيل الدفع', 'Search for patient and collect payment')}
              </p>
            </div>
          </div>
          {selectedPatient && (
            <button
              onClick={() => mutateOrders()}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl hover:bg-card"
            >
              <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              {tr('تحديث', 'Refresh')}
            </button>
          )}
        </div>

        {/* ── Patient Search ──────────────────────────────────────────────── */}
        {!selectedPatient ? (
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                {tr('بحث عن المريض', 'Search for patient')}
              </label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={tr(
                    'اكتب اسم المريض أو رقم الملف...',
                    'Type patient name or MRN...'
                  )}
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pr-11 pl-4 py-3 text-lg border border-border rounded-xl thea-input-focus bg-card text-foreground"
                  autoFocus
                />
              </div>

              {searchLoading && (
                <div className="mt-4 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />
                  {tr('جاري البحث...', 'Searching...')}
                </div>
              )}

              {shouldSearch && !searchLoading && patients.length === 0 && (
                <div className="mt-4 text-center text-muted-foreground py-6">
                  {tr('لا توجد نتائج', 'No results found')}
                </div>
              )}

              {patients.length > 0 && (
                <div className="mt-4 space-y-2">
                  {patients.map((patient: any) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full flex items-center gap-4 p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors text-start"
                    >
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {patient.fullName || patient.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {tr('ملف', 'MRN')}: {patient.mrn || '—'}
                          {patient.dob && ` • ${getAge(patient.dob)}`}
                          {patient.gender && ` • ${formatGender(patient.gender)}`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── Selected Patient Card ─────────────────────────────────────── */}
            <div className="bg-card rounded-2xl border border-border p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {selectedPatient.fullName || selectedPatient.name}
                    </h2>
                    <p className="text-muted-foreground">
                      {tr('ملف', 'MRN')}: {selectedPatient.mrn || '—'}
                      {selectedPatient.dob && ` • ${getAge(selectedPatient.dob)}`}
                      {selectedPatient.gender &&
                        ` • ${formatGender(selectedPatient.gender)}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearPatient}
                  className="px-4 py-2 border border-border rounded-xl hover:bg-muted text-sm"
                >
                  {tr('تغيير المريض', 'Change patient')}
                </button>
              </div>
            </div>

            {/* ── Stats Cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${cc.light} rounded-xl`}>
                    <DeptIcon className={`w-5 h-5 ${cc.text}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${cc.text}`}>{orders.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {tr('طلبات معلقة', 'Pending orders')}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`${cc.bg} rounded-2xl p-4 text-white`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalAmount.toFixed(0)}</p>
                    <p className="text-xs opacity-80">{tr('ر.س معلق', 'SAR pending')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-xl">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{encounters.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {tr('زيارات نشطة', 'Active visits')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Action Buttons ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-6">
              {orders.length > 0 && (
                <button
                  onClick={() => setShowInvoice(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 ${cc.bg} text-white rounded-xl hover:opacity-90 font-medium`}
                >
                  <CreditCard className="w-4 h-4" />
                  {tr('تحصيل الدفع', 'Collect Payment')} ({totalAmount.toFixed(0)} {tr('ر.س', 'SAR')})
                </button>
              )}

              {selectedPatient && encounters.length > 0 && (
                <button
                  onClick={() => setShowAddOrder(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl hover:bg-muted"
                >
                  <Plus className="w-4 h-4" />
                  {tr('إضافة كود', 'Add order')}
                </button>
              )}
            </div>

            {/* ── Orders List ────────────────────────────────────────────────── */}
            {orders.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {tr('لا توجد طلبات معلقة', 'No pending orders')}
                </h3>
                <p className="text-muted-foreground">
                  {tr(
                    'جميع الطلبات مدفوعة أو لا يوجد طلبات لهذا القسم',
                    'All orders are paid or no orders for this department'
                  )}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4 bg-muted/50 border-b border-border">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <DeptIcon className={`w-5 h-5 ${cc.text}`} />
                    {tr('الطلبات المعلقة', 'Pending Orders')}
                    <span className="text-sm text-muted-foreground font-normal">
                      ({orders.length})
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {orders.map((order: any) => (
                    <div
                      key={order.id}
                      className="p-4 flex items-center gap-4 thea-hover-lift thea-transition-fast"
                    >
                      <div className={`p-2 rounded-xl ${cc.light}`}>
                        <DeptIcon className={`w-5 h-5 ${cc.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {(language === 'ar' ? order.nameAr : null) || order.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.code}
                          {order.priority === 'URGENT' && (
                            <span className="mr-2 text-red-600 font-medium">
                              {' '}
                              {tr('عاجل', 'Urgent')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">
                          {order.totalPrice?.toFixed(2)} {tr('ر.س', 'SAR')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.orderedAt &&
                            new Date(order.orderedAt).toLocaleTimeString(
                              language === 'ar' ? 'ar-SA' : 'en-GB',
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Invoice Modal ──────────────────────────────────────────────────── */}
      {showInvoice && selectedPatient && (
        <OrderInvoiceScreen
          patientId={selectedPatient.id}
          orderIds={orderIds}
          onComplete={handleInvoiceComplete}
          onCancel={() => setShowInvoice(false)}
        />
      )}

      {/* ── Add Order Dialog ───────────────────────────────────────────────── */}
      {showAddOrder && selectedPatient && (
        <AddOrderDialog
          patientId={selectedPatient.id}
          encounterCoreId={selectedEncounter || encounters[0]?.encounter?.id || ''}
          departmentKey={departmentKey}
          kind={kind}
          onComplete={handleOrderAdded}
          onCancel={() => setShowAddOrder(false)}
        />
      )}
    </div>
  );
}
