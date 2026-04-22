'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ApprovalHistoryItem {
  id: string;
  documentType: string;
  entityId: string;
  amount: number;
  currency: string;
  status: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  decision: string;
  decidedBy: string;
  decidedAt: string;
  comment: string;
}

interface HistoryResponse {
  data: ApprovalHistoryItem[];
  total: number;
  totalPages: number;
  page: number;
}

const DOC_TYPES = [
  'PURCHASE_ORDER',
  'REQUISITION',
  'INVOICE',
  'GRN',
  'ADJUSTMENT',
  'TRANSFER',
] as const;

const STATUS_OPTIONS = ['APPROVED', 'REJECTED', 'ESCALATED'] as const;

export default function ApprovalHistoryPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [data, setData] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [statusFilter, setStatusFilter] = useState('all');
  const [docTypeFilter, setDocTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (docTypeFilter && docTypeFilter !== 'all') params.set('documentType', docTypeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/imdad/approval/history?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json: HistoryResponse = await res.json();
        setData(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 0);
      }
    } catch (err) {
      console.error('Failed to fetch approval history', err);
    }
    setLoading(false);
  }, [page, statusFilter, docTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const docTypeLabel = (dt: string) => {
    const map: Record<string, string> = {
      PURCHASE_ORDER: tr('أمر شراء', 'Purchase Order'),
      REQUISITION: tr('طلب شراء', 'Requisition'),
      INVOICE: tr('فاتورة', 'Invoice'),
      GRN: tr('سند استلام', 'GRN'),
      ADJUSTMENT: tr('تسوية', 'Adjustment'),
      TRANSFER: tr('تحويل', 'Transfer'),
    };
    return map[dt] || dt;
  };

  const statusVariant = (status: string) => {
    if (status === 'APPROVED') return 'default';
    if (status === 'REJECTED') return 'destructive';
    if (status === 'ESCALATED') return 'secondary';
    return 'outline';
  };

  const statusColor = (status: string) => {
    if (status === 'APPROVED') return 'bg-[#6B8E23]/10 text-[#6B8E23] dark:bg-[#6B8E23]/20 dark:text-[#9CB86B]';
    if (status === 'REJECTED') return 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#D2691E]';
    if (status === 'ESCALATED') return 'bg-[#E8A317]/10 text-[#E8A317] dark:bg-[#E8A317]/20 dark:text-[#E8A317]';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      APPROVED: tr('معتمد', 'Approved'),
      REJECTED: tr('مرفوض', 'Rejected'),
      ESCALATED: tr('مُصعّد', 'Escalated'),
    };
    return map[status] || status;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency = 'SAR') => {
    try {
      return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-4 md:p-6 space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {tr('سجل الموافقات', 'Approval History')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder={tr('جميع الحالات', 'All Statuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('جميع الحالات', 'All Statuses')}</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={docTypeFilter} onValueChange={(v) => { setDocTypeFilter(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder={tr('جميع أنواع المستندات', 'All Document Types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('جميع أنواع المستندات', 'All Document Types')}</SelectItem>
                {DOC_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>{docTypeLabel(dt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder={tr('من تاريخ', 'From Date')}
              title={tr('من تاريخ', 'From Date')}
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder={tr('إلى تاريخ', 'To Date')}
              title={tr('إلى تاريخ', 'To Date')}
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ms-3 text-sm text-muted-foreground">
                {tr('جارٍ التحميل...', 'Loading...')}
              </span>
            </div>
          )}

          {/* Empty State */}
          {!loading && data.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg">
                {tr('لا توجد سجلات موافقات', 'No approval records found')}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {tr('جرّب تعديل معايير البحث', 'Try adjusting your filters')}
              </p>
            </div>
          )}

          {/* Data Table */}
          {!loading && data.length > 0 && (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('نوع المستند', 'Document Type')}</TableHead>
                      <TableHead>{tr('معرّف الكيان', 'Entity ID')}</TableHead>
                      <TableHead>{tr('المبلغ', 'Amount')}</TableHead>
                      <TableHead>{tr('الحالة', 'Status')}</TableHead>
                      <TableHead>{tr('القرار', 'Decision')}</TableHead>
                      <TableHead>{tr('القرار بواسطة', 'Decided By')}</TableHead>
                      <TableHead>{tr('تاريخ القرار', 'Decided At')}</TableHead>
                      <TableHead>{tr('التعليق', 'Comment')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {docTypeLabel(row.documentType)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.entityId}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(row.amount, row.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColor(row.status)} variant={statusVariant(row.status) as 'default'}>
                            {statusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.decision || '\u2014'}
                        </TableCell>
                        <TableCell>
                          {row.decidedBy || '\u2014'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.decidedAt)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {row.comment || '\u2014'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    {tr(
                      `عرض ${data.length} من ${total} سجل`,
                      `Showing ${data.length} of ${total} records`
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      {tr('السابق', 'Previous')}
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      {tr(
                        `صفحة ${page} من ${totalPages}`,
                        `Page ${page} of ${totalPages}`
                      )}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      {tr('التالي', 'Next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
