'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Delivery {
  id: string;
  deliveryNumber: string;
  purchaseOrderNumber?: string;
  vendorName: string;
  carrierName?: string;
  trackingNumber?: string;
  status: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  DELAYED: 'bg-red-100 text-red-800',
  OUT_FOR_DELIVERY: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  RECEIVED: 'bg-emerald-100 text-emerald-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-gray-200 text-gray-600',
};

export default function DeliveriesPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/imdad/procurement/deliveries?${params}`);
      const json = await res.json();
      setDeliveries(json.data || []);
      setTotalPages(json.totalPages || 1);
    } catch {
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  return (
    <div className="space-y-6 p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {tr('تتبع التسليم', 'Delivery Tracking')}
        </h1>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder={tr('بحث بالرقم أو التتبع...', 'Search by number or tracking...')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tr('الحالة', 'Status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            <SelectItem value="CREATED">{tr('تم الإنشاء', 'Created')}</SelectItem>
            <SelectItem value="IN_TRANSIT">{tr('قيد النقل', 'In Transit')}</SelectItem>
            <SelectItem value="DELAYED">{tr('متأخر', 'Delayed')}</SelectItem>
            <SelectItem value="OUT_FOR_DELIVERY">{tr('جاري التسليم', 'Out for Delivery')}</SelectItem>
            <SelectItem value="DELIVERED">{tr('تم التسليم', 'Delivered')}</SelectItem>
            <SelectItem value="RECEIVED">{tr('تم الاستلام', 'Received')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          {tr('جاري التحميل...', 'Loading...')}
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {tr('لا توجد شحنات', 'No deliveries found')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{d.deliveryNumber}</span>
                      <Badge className={STATUS_COLORS[d.status] || 'bg-gray-100'}>
                        {d.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tr('المورد', 'Vendor')}: {d.vendorName}
                      {d.purchaseOrderNumber && ` | ${tr('أمر الشراء', 'PO')}: ${d.purchaseOrderNumber}`}
                      {d.carrierName && ` | ${tr('الناقل', 'Carrier')}: ${d.carrierName}`}
                    </p>
                    {d.trackingNumber && (
                      <p className="text-xs text-muted-foreground">
                        {tr('رقم التتبع', 'Tracking')}: {d.trackingNumber}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {d.estimatedArrivalDate && (
                      <p>{tr('الوصول المتوقع', 'ETA')}: {new Date(d.estimatedArrivalDate).toLocaleDateString()}</p>
                    )}
                    {d.actualArrivalDate && (
                      <p>{tr('تم الوصول', 'Arrived')}: {new Date(d.actualArrivalDate).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {tr('السابق', 'Previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
          </span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {tr('التالي', 'Next')}
          </Button>
        </div>
      )}
    </div>
  );
}
