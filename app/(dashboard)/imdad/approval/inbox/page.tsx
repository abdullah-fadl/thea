'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface ApprovalItem {
  stepId: string;
  documentType: string;
  entityId: string;
  amount: number;
  stepNumber: number;
  timeRemaining: string;
  submittedBy: string;
  delegated: boolean;
}

interface InboxResponse {
  items: ApprovalItem[];
  total: number;
  page: number;
  limit: number;
}

const DOCUMENT_TYPES = [
  { value: 'all', labelAr: 'الكل', labelEn: 'All' },
  { value: 'PURCHASE_ORDER', labelAr: 'أمر شراء', labelEn: 'Purchase Order' },
  { value: 'PURCHASE_REQUEST', labelAr: 'طلب شراء', labelEn: 'Purchase Request' },
  { value: 'INVOICE', labelAr: 'فاتورة', labelEn: 'Invoice' },
  { value: 'CONTRACT', labelAr: 'عقد', labelEn: 'Contract' },
  { value: 'RETURN', labelAr: 'مرتجع', labelEn: 'Return' },
];

const PAGE_LIMIT = 10;

export default function ApprovalInboxPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [deciding, setDeciding] = useState(false);

  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateStepId, setDelegateStepId] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');
  const [delegateReason, setDelegateReason] = useState('');
  const [delegating, setDelegating] = useState(false);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      if (filterType !== 'all') params.set('documentType', filterType);
      const res = await fetch(`/api/imdad/approval/inbox?${params}`);
      if (res.ok) {
        const data: InboxResponse = await res.json();
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch approval inbox', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const handleDecision = async (stepId: string, decision: 'APPROVED' | 'REJECTED') => {
    setDeciding(true);
    try {
      const res = await fetch('/api/imdad/approval/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, decision, comment: decisionComment }),
      });
      if (res.ok) {
        setDecisionComment('');
        setActiveStepId(null);
        fetchInbox();
      }
    } finally {
      setDeciding(false);
    }
  };

  const handleDelegate = async () => {
    if (!delegateUserId.trim()) return;
    setDelegating(true);
    try {
      const res = await fetch('/api/imdad/approval/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: delegateStepId,
          toUserId: delegateUserId,
          reason: delegateReason,
        }),
      });
      if (res.ok) {
        setDelegateOpen(false);
        setDelegateUserId('');
        setDelegateReason('');
        fetchInbox();
      }
    } finally {
      setDelegating(false);
    }
  };

  const openDelegate = (stepId: string) => {
    setDelegateStepId(stepId);
    setDelegateOpen(true);
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const docTypeLabel = (type: string) => {
    const found = DOCUMENT_TYPES.find((d) => d.value === type);
    return found ? tr(found.labelAr, found.labelEn) : type;
  };

  return (
    <div className="p-4 md:p-6 space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-xl font-bold">
            {tr('صندوق الموافقات', 'Approval Inbox')}
          </CardTitle>
          <div className="w-full sm:w-56">
            <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder={tr('تصفية حسب النوع', 'Filter by type')} />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {tr(dt.labelAr, dt.labelEn)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="ms-3 text-muted-foreground">
                {tr('جارٍ التحميل...', 'Loading...')}
              </span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <svg className="h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">{tr('لا توجد موافقات معلقة', 'No pending approvals')}</p>
              <p className="text-xs mt-1">{tr('أنت محدّث!', 'You are all caught up!')}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('نوع المستند', 'Document Type')}</TableHead>
                    <TableHead>{tr('معرّف الكيان', 'Entity ID')}</TableHead>
                    <TableHead className="text-end">{tr('المبلغ', 'Amount')}</TableHead>
                    <TableHead className="text-center">{tr('الخطوة', 'Step #')}</TableHead>
                    <TableHead>{tr('الوقت المتبقي', 'Time Remaining')}</TableHead>
                    <TableHead>{tr('مقدم الطلب', 'Submitted By')}</TableHead>
                    <TableHead className="text-center">{tr('الإجراءات', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.stepId}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {docTypeLabel(item.documentType)}
                          {item.delegated && (
                            <Badge variant="outline" className="border-[#D4A017] text-[#D4A017] bg-[#D4A017]/10">
                              {tr('مفوَّض', 'Delegated')}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.entityId}</TableCell>
                      <TableCell className="text-end">
                        {item.amount.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-SA', {
                          style: 'currency', currency: 'SAR',
                        })}
                      </TableCell>
                      <TableCell className="text-center">{item.stepNumber}</TableCell>
                      <TableCell>{item.timeRemaining}</TableCell>
                      <TableCell>{item.submittedBy}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <Input
                            className="w-24 h-7 text-xs"
                            placeholder={tr('تعليق', 'Comment')}
                            value={activeStepId === item.stepId ? decisionComment : ''}
                            onFocus={() => { setActiveStepId(item.stepId); setDecisionComment(''); }}
                            onChange={(e) => setDecisionComment(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            disabled={deciding}
                            onClick={() => handleDecision(item.stepId, 'APPROVED')}
                          >
                            {tr('موافقة', 'Approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={deciding}
                            onClick={() => handleDecision(item.stepId, 'REJECTED')}
                          >
                            {tr('رفض', 'Reject')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => openDelegate(item.stepId)}
                          >
                            {tr('تفويض', 'Delegate')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {tr(
                    `عرض ${(page - 1) * PAGE_LIMIT + 1}–${Math.min(page * PAGE_LIMIT, total)} من ${total}`,
                    `Showing ${(page - 1) * PAGE_LIMIT + 1}–${Math.min(page * PAGE_LIMIT, total)} of ${total}`,
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {tr('السابق', 'Previous')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {tr(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tr('التالي', 'Next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delegate Dialog */}
      <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
        <DialogContent className="sm:max-w-md" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('تفويض الموافقة', 'Delegate Approval')}</DialogTitle>
            <DialogDescription>
              {tr(
                'أدخل معرّف المستخدم المفوَّض إليه وسبب التفويض.',
                'Enter the delegate user ID and the reason for delegation.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">
                {tr('معرّف المستخدم', 'User ID')}
              </label>
              <Input
                className="mt-1"
                placeholder={tr('أدخل معرّف المستخدم', 'Enter user ID')}
                value={delegateUserId}
                onChange={(e) => setDelegateUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {tr('سبب التفويض', 'Reason')}
              </label>
              <Input
                className="mt-1"
                placeholder={tr('اختياري', 'Optional')}
                value={delegateReason}
                onChange={(e) => setDelegateReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDelegateOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleDelegate} disabled={delegating || !delegateUserId.trim()}>
              {delegating ? tr('جارٍ التفويض...', 'Delegating...') : tr('تفويض', 'Delegate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
