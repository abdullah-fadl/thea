'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, DollarSign, Clock, ClipboardList, Loader2 } from 'lucide-react';

interface ProcurementKpi {
  openPOs: number;
  totalSpendMTD: number;
  pendingApprovals: number;
  avgLeadTimeDays: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorName: string;
  vendorNameAr?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  expectedDelivery?: string;
}

interface VendorSpend {
  vendorId: string;
  vendorName: string;
  vendorNameAr?: string;
  totalSpend: number;
  poCount: number;
}

export default function ProcurementReportPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<ProcurementKpi>({
    openPOs: 0,
    totalSpendMTD: 0,
    pendingApprovals: 0,
    avgLeadTimeDays: 0,
  });
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendorSpend, setVendorSpend] = useState<VendorSpend[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [kpiRes, poRes, vendorRes] = await Promise.all([
        fetch(`/api/imdad/analytics/kpi-snapshots${qs}`),
        fetch(`/api/imdad/procurement/purchase-orders${qs}`),
        fetch(`/api/imdad/procurement/vendors/spend${qs}`),
      ]);

      if (kpiRes.ok) {
        const data = await kpiRes.json();
        setKpi({
          openPOs: data.openPOs ?? 0,
          totalSpendMTD: data.totalSpendMTD ?? 0,
          pendingApprovals: data.pendingApprovals ?? 0,
          avgLeadTimeDays: data.avgLeadTimeDays ?? 0,
        });
      }

      if (poRes.ok) {
        const data = await poRes.json();
        setPurchaseOrders(data.items ?? data.purchaseOrders ?? data ?? []);
      }

      if (vendorRes.ok) {
        const data = await vendorRes.json();
        setVendorSpend(data.vendors ?? data ?? []);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const poStatusBreakdown = (() => {
    const counts: Record<string, number> = {};
    purchaseOrders.forEach((po) => {
      const s = po.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  })();

  const topVendors = [...vendorSpend]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);

  const recentPOs = [...purchaseOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  const poStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'received':
        return 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]';
      case 'pending':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'cancelled':
      case 'rejected':
        return 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]';
      case 'open':
      case 'sent':
        return 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const poStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return tr('معتمد', 'Approved');
      case 'completed': return tr('مكتمل', 'Completed');
      case 'received': return tr('مستلم', 'Received');
      case 'pending': return tr('معلق', 'Pending');
      case 'draft': return tr('مسودة', 'Draft');
      case 'cancelled': return tr('ملغي', 'Cancelled');
      case 'rejected': return tr('مرفوض', 'Rejected');
      case 'open': return tr('مفتوح', 'Open');
      case 'sent': return tr('مرسل', 'Sent');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4A017]" />
        <span className="ms-3 text-gray-500">{tr('جاري التحميل...', 'Loading...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('تقرير المشتريات', 'Procurement Report')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('تحليلات أوامر الشراء والموردين والإنفاق', 'Analytics on purchase orders, vendors, and spending')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {tr('من', 'From')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <label className="text-sm text-gray-600 dark:text-gray-400">
            {tr('إلى', 'To')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
            <option value="draft">{tr('مسودة', 'Draft')}</option>
            <option value="pending">{tr('معلق', 'Pending')}</option>
            <option value="approved">{tr('معتمد', 'Approved')}</option>
            <option value="sent">{tr('مرسل', 'Sent')}</option>
            <option value="received">{tr('مستلم', 'Received')}</option>
            <option value="completed">{tr('مكتمل', 'Completed')}</option>
            <option value="cancelled">{tr('ملغي', 'Cancelled')}</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A017]/10 dark:bg-[#C4960C]/20">
              <ShoppingCart className="h-6 w-6 text-[#D4A017] dark:text-[#E8A317]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('أوامر شراء مفتوحة', 'Open POs')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.openPOs.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6B8E23]/10 dark:bg-[#556B2F]/20">
              <DollarSign className="h-6 w-6 text-[#6B8E23] dark:text-[#9CB86B]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('إجمالي الإنفاق (الشهر)', 'Total Spend (MTD)')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.totalSpendMTD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
              <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('في انتظار الموافقة', 'Pending Approvals')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.pendingApprovals.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#556B2F]/10 dark:bg-[#4A5D23]/20">
              <Clock className="h-6 w-6 text-[#556B2F] dark:text-[#9CB86B]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('متوسط مدة التوريد', 'Avg Lead Time')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.avgLeadTimeDays.toLocaleString()} {tr('يوم', 'days')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('توزيع حالة أوامر الشراء', 'PO Status Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {poStatusBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {poStatusBreakdown.map(({ status, count }) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <Badge className={poStatusColor(status)}>{poStatusLabel(status)}</Badge>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Vendors by Spend */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('أعلى الموردين من حيث الإنفاق', 'Top Vendors by Spend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {topVendors.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('المورد', 'Vendor')}</TableHead>
                    <TableHead className="text-end">{tr('عدد أوامر الشراء', 'PO Count')}</TableHead>
                    <TableHead className="text-end">{tr('إجمالي الإنفاق', 'Total Spend')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topVendors.map((v) => (
                    <TableRow key={v.vendorId}>
                      <TableCell className="font-medium">
                        {language === 'ar' && v.vendorNameAr ? v.vendorNameAr : v.vendorName}
                      </TableCell>
                      <TableCell className="text-end">{v.poCount.toLocaleString()}</TableCell>
                      <TableCell className="text-end font-semibold">
                        {v.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Purchase Orders */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('أوامر الشراء الأخيرة', 'Recent Purchase Orders')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPOs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد أوامر شراء', 'No purchase orders found')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('رقم الأمر', 'PO Number')}</TableHead>
                    <TableHead>{tr('المورد', 'Vendor')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                    <TableHead className="text-end">{tr('المبلغ', 'Amount')}</TableHead>
                    <TableHead>{tr('تاريخ الإنشاء', 'Created')}</TableHead>
                    <TableHead>{tr('التسليم المتوقع', 'Expected Delivery')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPOs.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
                      <TableCell>
                        {language === 'ar' && po.vendorNameAr ? po.vendorNameAr : po.vendorName}
                      </TableCell>
                      <TableCell>
                        <Badge className={poStatusColor(po.status)}>{poStatusLabel(po.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-end font-semibold">
                        {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(po.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {po.expectedDelivery
                          ? new Date(po.expectedDelivery).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                          : tr('غير محدد', 'N/A')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
