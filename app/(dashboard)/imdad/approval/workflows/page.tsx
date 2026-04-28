'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface ApprovalRule {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  steps: { role: string; order: number }[];
}

interface ApprovalWorkflow {
  id: string;
  name: string;
  nameAr: string;
  documentType: string;
  isActive: boolean;
  rules: ApprovalRule[];
  createdAt: string;
  updatedAt: string;
}

const DOCUMENT_TYPES = [
  'PURCHASE_REQUISITION',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT',
  'INVOICE',
  'STOCK_ADJUSTMENT',
  'DISPOSAL',
  'TRANSFER',
] as const;

const DOC_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  PURCHASE_REQUISITION: { ar: 'طلب شراء', en: 'Purchase Requisition' },
  PURCHASE_ORDER: { ar: 'أمر شراء', en: 'Purchase Order' },
  GOODS_RECEIPT: { ar: 'استلام بضائع', en: 'Goods Receipt' },
  INVOICE: { ar: 'فاتورة', en: 'Invoice' },
  STOCK_ADJUSTMENT: { ar: 'تعديل مخزون', en: 'Stock Adjustment' },
  DISPOSAL: { ar: 'إتلاف', en: 'Disposal' },
  TRANSFER: { ar: 'تحويل', en: 'Transfer' },
};

export default function ApprovalWorkflowsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [rulesSheetOpen, setRulesSheetOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formDocType, setFormDocType] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imdad/approval/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(Array.isArray(data.data) ? data.data : Array.isArray(data.workflows) ? data.workflows : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const resetForm = () => {
    setFormName('');
    setFormNameAr('');
    setFormDocType('');
    setFormActive(true);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (wf: ApprovalWorkflow) => {
    setFormName(wf.name);
    setFormNameAr(wf.nameAr);
    setFormDocType(wf.documentType);
    setFormActive(wf.isActive);
    setEditingId(wf.id);
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName || !formDocType) return;
    setSubmitting(true);
    try {
      const body = {
        name: formName,
        nameAr: formNameAr,
        documentType: formDocType,
        isActive: formActive,
      };
      const res = editingId
        ? await fetch('/api/imdad/approval/workflows', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...body }),
          })
        : await fetch('/api/imdad/approval/workflows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (res.ok) {
        setCreateOpen(false);
        resetForm();
        fetchWorkflows();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/imdad/approval/workflows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchWorkflows();
    } catch {
      // silent
    }
  };

  const handleToggleActive = async (wf: ApprovalWorkflow) => {
    try {
      await fetch('/api/imdad/approval/workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wf.id, isActive: !wf.isActive }),
      });
      fetchWorkflows();
    } catch {
      // silent
    }
  };

  const openRules = (wf: ApprovalWorkflow) => {
    setSelectedWorkflow(wf);
    setRulesSheetOpen(true);
  };

  const docTypeLabel = (dt: string) => {
    const l = DOC_TYPE_LABELS[dt];
    return l ? tr(l.ar, l.en) : dt;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            {tr('جارٍ التحميل...', 'Loading...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tr('مسارات الموافقة', 'Approval Workflows')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة قوالب مسارات الموافقة للمستندات', 'Manage approval workflow templates for documents')}
          </p>
        </div>
        <Button onClick={openCreate}>
          {tr('إنشاء مسار', 'Create Workflow')}
        </Button>
      </div>

      {/* Empty state */}
      {workflows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              {tr('لا توجد مسارات موافقة بعد', 'No approval workflows yet')}
            </p>
            <Button variant="outline" className="mt-4" onClick={openCreate}>
              {tr('إنشاء أول مسار', 'Create your first workflow')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Workflow cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((wf) => (
          <Card key={wf.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-tight">
                  {language === 'ar' && wf.nameAr ? wf.nameAr : wf.name}
                </CardTitle>
                <Badge variant={wf.isActive ? 'default' : 'secondary'}>
                  {wf.isActive ? tr('مفعّل', 'Active') : tr('معطّل', 'Inactive')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">
                    {tr('نوع المستند', 'Document Type')}
                  </span>
                  <span className="font-medium">{docTypeLabel(wf.documentType)}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">
                    {tr('عدد القواعد', 'Rules')}
                  </span>
                  <span className="font-medium">
                    {wf.rules?.length ?? 0}
                  </span>
                </div>
                {wf.rules && wf.rules.length > 0 && (
                  <div className="pt-1 space-y-1">
                    {wf.rules.slice(0, 2).map((rule) => (
                      <div
                        key={rule.id}
                        className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1"
                      >
                        {tr('المبلغ', 'Amount')}: {rule.minAmount.toLocaleString()}
                        {rule.maxAmount ? ` – ${rule.maxAmount.toLocaleString()}` : '+'} ·{' '}
                        {rule.steps?.length ?? 0} {tr('خطوات', 'steps')}
                      </div>
                    ))}
                    {wf.rules.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{wf.rules.length - 2} {tr('قواعد أخرى', 'more rules')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <div className="flex items-center gap-2 flex-1">
                  <Switch
                    checked={wf.isActive}
                    onCheckedChange={() => handleToggleActive(wf)}
                    aria-label={tr('تبديل التفعيل', 'Toggle active')}
                  />
                  <span className="text-xs text-muted-foreground">
                    {wf.isActive ? tr('مفعّل', 'Active') : tr('معطّل', 'Inactive')}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openRules(wf)}>
                  {tr('القواعد', 'Rules')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(wf)}>
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(wf.id)}
                >
                  {tr('حذف', 'Delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? tr('تعديل مسار الموافقة', 'Edit Approval Workflow')
                : tr('إنشاء مسار موافقة', 'Create Approval Workflow')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tr('الاسم (إنجليزي)', 'Name (English)')}
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={tr('أدخل الاسم بالإنجليزية', 'Enter name in English')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tr('الاسم (عربي)', 'Name (Arabic)')}
              </label>
              <Input
                value={formNameAr}
                onChange={(e) => setFormNameAr(e.target.value)}
                placeholder={tr('أدخل الاسم بالعربية', 'Enter name in Arabic')}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tr('نوع المستند', 'Document Type')}
              </label>
              <Select value={formDocType} onValueChange={setFormDocType}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر نوع المستند', 'Select document type')} />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {docTypeLabel(dt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium">
                {tr('مفعّل', 'Active')}
              </label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !formName || !formDocType}>
              {submitting
                ? tr('جارٍ الحفظ...', 'Saving...')
                : editingId
                  ? tr('تحديث', 'Update')
                  : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Sheet */}
      <Sheet open={rulesSheetOpen} onOpenChange={setRulesSheetOpen}>
        <SheetContent side={language === 'ar' ? 'left' : 'right'} className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedWorkflow
                ? tr(
                    `قواعد: ${selectedWorkflow.nameAr || selectedWorkflow.name}`,
                    `Rules: ${selectedWorkflow.name}`
                  )
                : tr('القواعد', 'Rules')}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {selectedWorkflow && (!selectedWorkflow.rules || selectedWorkflow.rules.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {tr('لا توجد قواعد لهذا المسار', 'No rules for this workflow')}
              </p>
            )}
            {selectedWorkflow?.rules?.map((rule, idx) => (
              <Card key={rule.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {tr('القاعدة', 'Rule')} #{idx + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">
                      {tr('نطاق المبلغ', 'Amount Range')}
                    </span>
                    <span className="font-medium">
                      {rule.minAmount.toLocaleString()}
                      {rule.maxAmount ? ` – ${rule.maxAmount.toLocaleString()}` : '+'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {tr('خطوات الموافقة', 'Approval Steps')}
                    </span>
                    <div className="mt-2 space-y-1">
                      {rule.steps?.map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5"
                        >
                          <Badge variant="outline" className="text-xs">
                            {step.order}
                          </Badge>
                          <span className="text-sm">{step.role}</span>
                        </div>
                      ))}
                      {(!rule.steps || rule.steps.length === 0) && (
                        <p className="text-xs text-muted-foreground">
                          {tr('لا توجد خطوات', 'No steps defined')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
