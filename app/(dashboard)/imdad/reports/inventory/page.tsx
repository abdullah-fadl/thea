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
import { Package, TrendingDown, AlertTriangle, Clock, Loader2 } from 'lucide-react';

interface KpiSnapshot {
  totalItems: number;
  totalStockValue: number;
  lowStockItems: number;
  expiringSoon: number;
}

interface InventoryItem {
  id: string;
  name: string;
  nameAr?: string;
  sku: string;
  category: string;
  categoryAr?: string;
  status: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  reorderPoint: number;
  expiryDate?: string;
}

interface StockStatusBreakdown {
  status: string;
  count: number;
}

export default function InventoryReportPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KpiSnapshot>({
    totalItems: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    expiringSoon: 0,
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [kpiRes, itemsRes] = await Promise.all([
        fetch(`/api/imdad/analytics/kpi-snapshots${qs}`),
        fetch(`/api/imdad/inventory/items?limit=100${qs ? '&' + params.toString() : ''}`),
      ]);

      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        setKpi({
          totalItems: kpiData.totalItems ?? 0,
          totalStockValue: kpiData.totalStockValue ?? 0,
          lowStockItems: kpiData.lowStockItems ?? 0,
          expiringSoon: kpiData.expiringSoon ?? 0,
        });
      }

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setItems(itemsData.items ?? itemsData ?? []);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived data
  const stockStatusBreakdown: StockStatusBreakdown[] = (() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const s = item.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  })();

  const topByValue = [...items]
    .sort((a, b) => (b.totalValue ?? b.quantity * b.unitCost) - (a.totalValue ?? a.quantity * a.unitCost))
    .slice(0, 10);

  const belowReorder = items.filter((item) => item.quantity < item.reorderPoint);

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_stock':
      case 'active':
        return 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]';
      case 'low_stock':
      case 'low':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'out_of_stock':
      case 'depleted':
        return 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const statusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in_stock':
      case 'active':
        return tr('متوفر', 'In Stock');
      case 'low_stock':
      case 'low':
        return tr('منخفض', 'Low Stock');
      case 'out_of_stock':
      case 'depleted':
        return tr('نفذ', 'Out of Stock');
      default:
        return status;
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
            {tr('تقرير المخزون', 'Inventory Report')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('تحليلات شاملة لحالة المخزون والأصناف', 'Comprehensive analytics on inventory status and items')}
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4A017]/10 dark:bg-[#C4960C]/20">
              <Package className="h-6 w-6 text-[#D4A017] dark:text-[#E8A317]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('إجمالي الأصناف', 'Total Items')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.totalItems.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6B8E23]/10 dark:bg-[#556B2F]/20">
              <TrendingDown className="h-6 w-6 text-[#6B8E23] dark:text-[#9CB86B]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('قيمة المخزون الإجمالية', 'Total Stock Value')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/20">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('أصناف منخفضة المخزون', 'Low Stock Items')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.lowStockItems.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B4513]/10 dark:bg-[#8B4513]/20">
              <Clock className="h-6 w-6 text-[#8B4513] dark:text-[#A0522D]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr('قريبة الانتهاء', 'Expiring Soon')}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.expiringSoon.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('توزيع حالة المخزون', 'Stock Status Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stockStatusBreakdown.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {stockStatusBreakdown.map(({ status, count }) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <Badge className={statusColor(status)}>{statusLabel(status)}</Badge>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 10 Items by Value */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('أعلى 10 أصناف من حيث القيمة', 'Top 10 Items by Value')}</CardTitle>
        </CardHeader>
        <CardContent>
          {topByValue.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('لا توجد بيانات', 'No data available')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الصنف', 'Item')}</TableHead>
                    <TableHead>{tr('الرمز', 'SKU')}</TableHead>
                    <TableHead>{tr('الفئة', 'Category')}</TableHead>
                    <TableHead className="text-end">{tr('الكمية', 'Quantity')}</TableHead>
                    <TableHead className="text-end">{tr('سعر الوحدة', 'Unit Cost')}</TableHead>
                    <TableHead className="text-end">{tr('القيمة الإجمالية', 'Total Value')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topByValue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' && item.nameAr ? item.nameAr : item.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>
                        {language === 'ar' && item.categoryAr ? item.categoryAr : item.category}
                      </TableCell>
                      <TableCell className="text-end">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-end">
                        {item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-end font-semibold">
                        {(item.totalValue ?? item.quantity * item.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(item.status)}>{statusLabel(item.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Below Reorder Point */}
      <Card>
        <CardHeader>
          <CardTitle>{tr('أصناف تحت نقطة إعادة الطلب', 'Items Below Reorder Point')}</CardTitle>
        </CardHeader>
        <CardContent>
          {belowReorder.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('جميع الأصناف فوق نقطة إعادة الطلب', 'All items are above reorder point')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الصنف', 'Item')}</TableHead>
                    <TableHead>{tr('الرمز', 'SKU')}</TableHead>
                    <TableHead className="text-end">{tr('الكمية الحالية', 'Current Qty')}</TableHead>
                    <TableHead className="text-end">{tr('نقطة إعادة الطلب', 'Reorder Point')}</TableHead>
                    <TableHead className="text-end">{tr('العجز', 'Deficit')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {belowReorder.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {language === 'ar' && item.nameAr ? item.nameAr : item.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="text-end">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-end">{item.reorderPoint.toLocaleString()}</TableCell>
                      <TableCell className="text-end font-semibold text-[#8B4513]">
                        {(item.reorderPoint - item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColor(item.status)}>{statusLabel(item.status)}</Badge>
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
