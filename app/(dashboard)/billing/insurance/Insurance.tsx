'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const STATUSES = ['ACTIVE', 'INACTIVE'];
const RULE_TYPES = ['ELIGIBILITY_NOTE', 'PREAUTH_NOTE', 'COVERAGE_NOTE', 'BILLING_NOTE'];

export default function Insurance() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { hasPermission, isLoading } = useRoutePermission('/billing/insurance');

  const { data: payersData, mutate: mutatePayers } = useSWR(
    hasPermission ? '/api/billing/payers' : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const payers = Array.isArray(payersData?.items) ? payersData.items : [];

  const [payerFilter, setPayerFilter] = useState('');
  const filteredPayers = useMemo(() => {
    const q = payerFilter.trim().toLowerCase();
    if (!q) return payers;
    return payers.filter((payer: any) => String(payer.name || '').toLowerCase().includes(q) || String(payer.code || '').toLowerCase().includes(q));
  }, [payers, payerFilter]);

  const [payerDialogOpen, setPayerDialogOpen] = useState(false);
  const [payerEdit, setPayerEdit] = useState<any>(null);
  const [payerName, setPayerName] = useState('');
  const [payerCode, setPayerCode] = useState('');
  const [payerStatus, setPayerStatus] = useState('ACTIVE');
  const [payerSaving, setPayerSaving] = useState(false);

  const openPayerAdd = () => {
    setPayerEdit(null);
    setPayerName('');
    setPayerCode('');
    setPayerStatus('ACTIVE');
    setPayerDialogOpen(true);
  };
  const openPayerEdit = (payer: any) => {
    setPayerEdit(payer);
    setPayerName(payer.name || '');
    setPayerCode(payer.code || '');
    setPayerStatus(payer.status || 'ACTIVE');
    setPayerDialogOpen(true);
  };

  const savePayer = async () => {
    setPayerSaving(true);
    try {
      if (payerEdit?.id) {
        const res = await fetch(`/api/billing/payers/${payerEdit.id}/update`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payerName.trim(), status: payerStatus }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم تحديث الجهة الدافعة', 'Payer updated') });
      } else {
        const res = await fetch('/api/billing/payers', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payerName.trim(), code: payerCode.trim(), status: payerStatus }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إنشاء الجهة الدافعة', 'Payer created') });
      }
      setPayerDialogOpen(false);
      await mutatePayers();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setPayerSaving(false);
    }
  };

  const [selectedPayerId, setSelectedPayerId] = useState('');
  const plansUrl = selectedPayerId ? `/api/billing/plans?payerId=${encodeURIComponent(selectedPayerId)}` : null;
  const { data: plansData, mutate: mutatePlans } = useSWR(hasPermission && plansUrl ? plansUrl : null, fetcher, {
    refreshInterval: 0,
  });
  const plans = Array.isArray(plansData?.items) ? plansData.items : [];

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEdit, setPlanEdit] = useState<any>(null);
  const [planName, setPlanName] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [planStatus, setPlanStatus] = useState('ACTIVE');
  const [planSaving, setPlanSaving] = useState(false);

  const openPlanAdd = () => {
    setPlanEdit(null);
    setPlanName('');
    setPlanCode('');
    setPlanStatus('ACTIVE');
    setPlanDialogOpen(true);
  };
  const openPlanEdit = (plan: any) => {
    setPlanEdit(plan);
    setPlanName(plan.name || '');
    setPlanCode(plan.planCode || '');
    setPlanStatus(plan.status || 'ACTIVE');
    setPlanDialogOpen(true);
  };

  const savePlan = async () => {
    if (!selectedPayerId) return;
    setPlanSaving(true);
    try {
      if (planEdit?.id) {
        const res = await fetch(`/api/billing/plans/${planEdit.id}/update`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: planName.trim(), status: planStatus }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم تحديث الخطة', 'Plan updated') });
      } else {
        const res = await fetch('/api/billing/plans', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payerId: selectedPayerId, name: planName.trim(), planCode: planCode.trim(), status: planStatus }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إنشاء الخطة', 'Plan created') });
      }
      setPlanDialogOpen(false);
      await mutatePlans();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setPlanSaving(false);
    }
  };

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const rulesUrl = selectedPayerId ? `/api/billing/policy-rules?payerId=${encodeURIComponent(selectedPayerId)}${selectedPlanId ? `&planId=${encodeURIComponent(selectedPlanId)}` : ''}` : null;
  const { data: rulesData, mutate: mutateRules } = useSWR(hasPermission && rulesUrl ? rulesUrl : null, fetcher, {
    refreshInterval: 0,
  });
  const rules = Array.isArray(rulesData?.items) ? rulesData.items : [];

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleEdit, setRuleEdit] = useState<any>(null);
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleNotes, setRuleNotes] = useState('');
  const [ruleType, setRuleType] = useState('ELIGIBILITY_NOTE');
  const [ruleStatus, setRuleStatus] = useState('ACTIVE');
  const [ruleSaving, setRuleSaving] = useState(false);

  const openRuleAdd = () => {
    setRuleEdit(null);
    setRuleTitle('');
    setRuleNotes('');
    setRuleType('ELIGIBILITY_NOTE');
    setRuleStatus('ACTIVE');
    setRuleDialogOpen(true);
  };
  const openRuleEdit = (rule: any) => {
    setRuleEdit(rule);
    setRuleTitle(rule.title || '');
    setRuleNotes(rule.notes || '');
    setRuleType(rule.ruleType || 'ELIGIBILITY_NOTE');
    setRuleStatus(rule.status || 'ACTIVE');
    setRuleDialogOpen(true);
  };

  const saveRule = async () => {
    if (!selectedPayerId) return;
    setRuleSaving(true);
    try {
      if (ruleEdit?.id) {
        const res = await fetch(`/api/billing/policy-rules/${ruleEdit.id}/update`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: ruleTitle.trim(), notes: ruleNotes.trim(), ruleType, status: ruleStatus }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم تحديث القاعدة', 'Rule updated') });
      } else {
        const res = await fetch('/api/billing/policy-rules', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payerId: selectedPayerId,
            planId: selectedPlanId || undefined,
            ruleType,
            title: ruleTitle.trim(),
            notes: ruleNotes.trim(),
            status: ruleStatus,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed');
        toast({ title: payload.noOp ? tr('لا يوجد تغيير', 'No change') : tr('تم إنشاء القاعدة', 'Rule created') });
      }
      setRuleDialogOpen(false);
      await mutateRules();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setRuleSaving(false);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{tr('أساسيات التأمين', 'Insurance Foundations')}</h2>
          <p className="text-sm text-muted-foreground">{tr('بيانات رئيسية فقط — لا تقديم مطالبات.', 'Master data only — no claim submission.')}</p>
        </div>
        <div>
          <Tabs defaultValue="payers">
            <TabsList>
              <TabsTrigger value="payers">{tr('الجهات الدافعة', 'Payers')}</TabsTrigger>
              <TabsTrigger value="plans">{tr('الخطط', 'Plans')}</TabsTrigger>
              <TabsTrigger value="rules">{tr('قواعد السياسة', 'Policy Rules')}</TabsTrigger>
            </TabsList>

            <TabsContent value="payers">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Input
                    value={payerFilter}
                    onChange={(e) => setPayerFilter(e.target.value)}
                    placeholder={tr('بحث الجهات الدافعة', 'Search payers')}
                    className="max-w-xs rounded-xl thea-input-focus"
                  />
                  <Button className="rounded-xl" onClick={openPayerAdd}>{tr('إضافة جهة دافعة', 'Add Payer')}</Button>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-4 gap-4 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرمز', 'Code')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
                </div>
                {/* Table body */}
                <div className="space-y-1">
                  {filteredPayers.length ? (
                    filteredPayers.map((payer: any) => (
                      <div key={payer.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-foreground">{payer.code}</span>
                        <span className="text-sm text-foreground">{payer.name}</span>
                        <span className="text-sm text-foreground">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{payer.status}</span>
                        </span>
                        <span className="text-sm text-foreground">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openPayerEdit(payer)}>
                            {tr('تعديل', 'Edit')}
                          </Button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl">
                      <span className="text-sm text-muted-foreground col-span-4">
                        {tr('لم يتم العثور على جهات دافعة.', 'No payers found.')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="plans">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهة الدافعة', 'Payer')}</span>
                    <Select value={selectedPayerId} onValueChange={setSelectedPayerId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={tr('اختر الجهة الدافعة', 'Select payer')} />
                      </SelectTrigger>
                      <SelectContent>
                        {payers.map((payer: any) => (
                          <SelectItem key={payer.id} value={payer.id}>
                            {payer.name} ({payer.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end justify-end">
                    <Button className="rounded-xl" onClick={openPlanAdd} disabled={!selectedPayerId}>
                      {tr('إضافة خطة', 'Add Plan')}
                    </Button>
                  </div>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-4 gap-4 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الخطة', 'Plan Code')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
                </div>
                {/* Table body */}
                <div className="space-y-1">
                  {plans.length ? (
                    plans.map((plan: any) => (
                      <div key={plan.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-foreground">{plan.planCode}</span>
                        <span className="text-sm text-foreground">{plan.name}</span>
                        <span className="text-sm text-foreground">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{plan.status}</span>
                        </span>
                        <span className="text-sm text-foreground">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openPlanEdit(plan)}>
                            {tr('تعديل', 'Edit')}
                          </Button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl">
                      <span className="text-sm text-muted-foreground col-span-4">
                        {selectedPayerId ? tr('لم يتم العثور على خطط.', 'No plans found.') : tr('اختر جهة دافعة لعرض الخطط.', 'Select a payer to view plans.')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rules">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الجهة الدافعة', 'Payer')}</span>
                    <Select value={selectedPayerId} onValueChange={setSelectedPayerId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={tr('اختر الجهة الدافعة', 'Select payer')} />
                      </SelectTrigger>
                      <SelectContent>
                        {payers.map((payer: any) => (
                          <SelectItem key={payer.id} value={payer.id}>
                            {payer.name} ({payer.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الخطة (اختياري)', 'Plan (optional)')}</span>
                    <Select value={selectedPlanId || '__all__'} onValueChange={(v) => setSelectedPlanId(v === '__all__' ? '' : v)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder={tr('جميع الخطط', 'All plans')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{tr('جميع الخطط', 'All plans')}</SelectItem>
                        {plans.map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} ({plan.planCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button className="rounded-xl" onClick={openRuleAdd} disabled={!selectedPayerId}>
                    {tr('إضافة قاعدة', 'Add Rule')}
                  </Button>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-4 gap-4 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العنوان', 'Title')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></span>
                </div>
                {/* Table body */}
                <div className="space-y-1">
                  {rules.length ? (
                    rules.map((rule: any) => (
                      <div key={rule.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                        <span className="text-sm text-foreground">{rule.ruleType}</span>
                        <span className="text-sm text-foreground">{rule.title}</span>
                        <span className="text-sm text-foreground">
                          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">{rule.status}</span>
                        </span>
                        <span className="text-sm text-foreground">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openRuleEdit(rule)}>
                            {tr('تعديل', 'Edit')}
                          </Button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl">
                      <span className="text-sm text-muted-foreground col-span-4">
                        {selectedPayerId ? tr('لم يتم العثور على قواعد.', 'No rules found.') : tr('اختر جهة دافعة لعرض القواعد.', 'Select a payer to view rules.')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={payerDialogOpen} onOpenChange={setPayerDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{payerEdit ? tr('تعديل الجهة الدافعة', 'Edit Payer') : tr('إضافة جهة دافعة', 'Add Payer')}</DialogTitle>
            <DialogDescription>{tr('بيانات رئيسية فقط.', 'Master data only.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code</span>
              <Input className="rounded-xl thea-input-focus" value={payerCode} onChange={(e) => setPayerCode(e.target.value)} disabled={Boolean(payerEdit)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <Input className="rounded-xl thea-input-focus" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <Select value={payerStatus} onValueChange={setPayerStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPayerDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={savePayer} disabled={payerSaving}>
              {payerSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{planEdit ? tr('تعديل الخطة', 'Edit Plan') : tr('إضافة خطة', 'Add Plan')}</DialogTitle>
            <DialogDescription>{tr('بيانات رئيسية فقط.', 'Master data only.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رمز الخطة', 'Plan Code')}</span>
              <Input className="rounded-xl thea-input-focus" value={planCode} onChange={(e) => setPlanCode(e.target.value)} disabled={Boolean(planEdit)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
              <Input className="rounded-xl thea-input-focus" value={planName} onChange={(e) => setPlanName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <Select value={planStatus} onValueChange={setPlanStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPlanDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={savePlan} disabled={planSaving}>
              {planSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{ruleEdit ? tr('تعديل القاعدة', 'Edit Rule') : tr('إضافة قاعدة', 'Add Rule')}</DialogTitle>
            <DialogDescription>{tr('ملاحظات البيانات الوصفية فقط.', 'Metadata notes only.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('نوع القاعدة', 'Rule Type')}</span>
              <Select value={ruleType} onValueChange={setRuleType}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr('نوع القاعدة', 'Rule Type')} />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العنوان', 'Title')}</span>
              <Input className="rounded-xl thea-input-focus" value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ملاحظات', 'Notes')}</span>
              <Textarea className="rounded-xl thea-input-focus" value={ruleNotes} onChange={(e) => setRuleNotes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <Select value={ruleStatus} onValueChange={setRuleStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setRuleDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button className="rounded-xl" onClick={saveRule} disabled={ruleSaving}>
              {ruleSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
