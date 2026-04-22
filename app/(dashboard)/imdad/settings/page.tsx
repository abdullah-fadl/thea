'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Package,
  ShoppingCart,
  Bell,
  Loader2,
  Save,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Config key constants ──────────────────────────────────────────────────
const CONFIG_KEYS = {
  // General
  ORG_NAME: 'general.org_name',
  DEFAULT_CURRENCY: 'general.default_currency',
  FISCAL_YEAR_START: 'general.fiscal_year_start',
  PO_PREFIX: 'general.po_prefix',
  GRN_PREFIX: 'general.grn_prefix',
  REQ_PREFIX: 'general.req_prefix',
  INV_PREFIX: 'general.inv_prefix',
  // Inventory
  DEFAULT_REORDER_METHOD: 'inventory.default_reorder_method',
  LOW_STOCK_THRESHOLD: 'inventory.low_stock_threshold',
  EXPIRY_WARNING_DAYS: 'inventory.expiry_warning_days',
  ALLOW_NEGATIVE_STOCK: 'inventory.allow_negative_stock',
  // Procurement
  APPROVAL_THRESHOLD: 'procurement.approval_threshold',
  AUTO_APPROVE_BELOW: 'procurement.auto_approve_below_threshold',
  DEFAULT_PAYMENT_TERMS: 'procurement.default_payment_terms',
  REQUIRE_THREE_QUOTES: 'procurement.require_three_quotes',
  // Notifications
  ENABLE_EMAIL: 'notifications.enable_email',
  STOCK_LOW_ALERTS: 'notifications.stock_low_alerts',
  PO_APPROVAL_ALERTS: 'notifications.po_approval_alerts',
  MAINTENANCE_DUE_ALERTS: 'notifications.maintenance_due_alerts',
} as const;

// ── Types ─────────────────────────────────────────────────────────────────
type ConfigMap = Record<string, any>;

// ── Helpers ───────────────────────────────────────────────────────────────
function getVal<T>(configs: ConfigMap, key: string, fallback: T): T {
  if (key in configs && configs[key] !== undefined && configs[key] !== null) {
    return configs[key] as T;
  }
  return fallback;
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ImdadSettingsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [configs, setConfigs] = useState<ConfigMap>({});
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Draft state per section
  const [general, setGeneral] = useState({
    orgName: '',
    currency: 'SAR',
    fiscalYearStart: '1',
    poPrefix: 'PO-',
    grnPrefix: 'GRN-',
    reqPrefix: 'REQ-',
    invPrefix: 'INV-',
  });

  const [inventory, setInventory] = useState({
    reorderMethod: 'min_max',
    lowStockThreshold: '20',
    expiryWarningDays: '90',
    allowNegativeStock: false,
  });

  const [procurement, setProcurement] = useState({
    approvalThreshold: '50000',
    autoApproveBelow: true,
    defaultPaymentTerms: '30',
    requireThreeQuotes: true,
  });

  const [notifications, setNotifications] = useState({
    enableEmail: true,
    stockLowAlerts: true,
    poApprovalAlerts: true,
    maintenanceDueAlerts: true,
  });

  // ── Load config ─────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/imdad/admin/config?scope=ORGANIZATION');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const c: ConfigMap = json.configs ?? {};
      setConfigs(c);

      // Hydrate sections
      setGeneral({
        orgName: getVal(c, CONFIG_KEYS.ORG_NAME, ''),
        currency: getVal(c, CONFIG_KEYS.DEFAULT_CURRENCY, 'SAR'),
        fiscalYearStart: String(getVal(c, CONFIG_KEYS.FISCAL_YEAR_START, '1')),
        poPrefix: getVal(c, CONFIG_KEYS.PO_PREFIX, 'PO-'),
        grnPrefix: getVal(c, CONFIG_KEYS.GRN_PREFIX, 'GRN-'),
        reqPrefix: getVal(c, CONFIG_KEYS.REQ_PREFIX, 'REQ-'),
        invPrefix: getVal(c, CONFIG_KEYS.INV_PREFIX, 'INV-'),
      });

      setInventory({
        reorderMethod: getVal(c, CONFIG_KEYS.DEFAULT_REORDER_METHOD, 'min_max'),
        lowStockThreshold: String(getVal(c, CONFIG_KEYS.LOW_STOCK_THRESHOLD, '20')),
        expiryWarningDays: String(getVal(c, CONFIG_KEYS.EXPIRY_WARNING_DAYS, '90')),
        allowNegativeStock: getVal(c, CONFIG_KEYS.ALLOW_NEGATIVE_STOCK, false),
      });

      setProcurement({
        approvalThreshold: String(getVal(c, CONFIG_KEYS.APPROVAL_THRESHOLD, '50000')),
        autoApproveBelow: getVal(c, CONFIG_KEYS.AUTO_APPROVE_BELOW, true),
        defaultPaymentTerms: String(getVal(c, CONFIG_KEYS.DEFAULT_PAYMENT_TERMS, '30')),
        requireThreeQuotes: getVal(c, CONFIG_KEYS.REQUIRE_THREE_QUOTES, true),
      });

      setNotifications({
        enableEmail: getVal(c, CONFIG_KEYS.ENABLE_EMAIL, true),
        stockLowAlerts: getVal(c, CONFIG_KEYS.STOCK_LOW_ALERTS, true),
        poApprovalAlerts: getVal(c, CONFIG_KEYS.PO_APPROVAL_ALERTS, true),
        maintenanceDueAlerts: getVal(c, CONFIG_KEYS.MAINTENANCE_DUE_ALERTS, true),
      });
    } catch {
      // silently handle — page shows defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Save section ────────────────────────────────────────────────────────
  async function saveSection(section: string, data: Record<string, any>) {
    setSavingSection(section);
    try {
      const res = await fetch('/api/imdad/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: data, scope: 'ORGANIZATION' }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({
        title: tr('تم الحفظ بنجاح', 'Settings saved successfully'),
        variant: 'default',
      });
      // Refresh config
      await loadConfig();
    } catch {
      toast({
        title: tr('فشل الحفظ', 'Failed to save settings'),
        variant: 'destructive',
      });
    } finally {
      setSavingSection(null);
    }
  }

  function saveGeneral() {
    saveSection('general', {
      [CONFIG_KEYS.ORG_NAME]: general.orgName,
      [CONFIG_KEYS.DEFAULT_CURRENCY]: general.currency,
      [CONFIG_KEYS.FISCAL_YEAR_START]: Number(general.fiscalYearStart),
      [CONFIG_KEYS.PO_PREFIX]: general.poPrefix,
      [CONFIG_KEYS.GRN_PREFIX]: general.grnPrefix,
      [CONFIG_KEYS.REQ_PREFIX]: general.reqPrefix,
      [CONFIG_KEYS.INV_PREFIX]: general.invPrefix,
    });
  }

  function saveInventory() {
    saveSection('inventory', {
      [CONFIG_KEYS.DEFAULT_REORDER_METHOD]: inventory.reorderMethod,
      [CONFIG_KEYS.LOW_STOCK_THRESHOLD]: Number(inventory.lowStockThreshold),
      [CONFIG_KEYS.EXPIRY_WARNING_DAYS]: Number(inventory.expiryWarningDays),
      [CONFIG_KEYS.ALLOW_NEGATIVE_STOCK]: inventory.allowNegativeStock,
    });
  }

  function saveProcurement() {
    saveSection('procurement', {
      [CONFIG_KEYS.APPROVAL_THRESHOLD]: Number(procurement.approvalThreshold),
      [CONFIG_KEYS.AUTO_APPROVE_BELOW]: procurement.autoApproveBelow,
      [CONFIG_KEYS.DEFAULT_PAYMENT_TERMS]: Number(procurement.defaultPaymentTerms),
      [CONFIG_KEYS.REQUIRE_THREE_QUOTES]: procurement.requireThreeQuotes,
    });
  }

  function saveNotifications() {
    saveSection('notifications', {
      [CONFIG_KEYS.ENABLE_EMAIL]: notifications.enableEmail,
      [CONFIG_KEYS.STOCK_LOW_ALERTS]: notifications.stockLowAlerts,
      [CONFIG_KEYS.PO_APPROVAL_ALERTS]: notifications.poApprovalAlerts,
      [CONFIG_KEYS.MAINTENANCE_DUE_ALERTS]: notifications.maintenanceDueAlerts,
    });
  }

  // ── Months list ─────────────────────────────────────────────────────────
  const months = [
    { value: '1', ar: 'يناير', en: 'January' },
    { value: '2', ar: 'فبراير', en: 'February' },
    { value: '3', ar: 'مارس', en: 'March' },
    { value: '4', ar: 'أبريل', en: 'April' },
    { value: '5', ar: 'مايو', en: 'May' },
    { value: '6', ar: 'يونيو', en: 'June' },
    { value: '7', ar: 'يوليو', en: 'July' },
    { value: '8', ar: 'أغسطس', en: 'August' },
    { value: '9', ar: 'سبتمبر', en: 'September' },
    { value: '10', ar: 'أكتوبر', en: 'October' },
    { value: '11', ar: 'نوفمبر', en: 'November' },
    { value: '12', ar: 'ديسمبر', en: 'December' },
  ];

  const currencies = [
    { value: 'SAR', label: tr('ريال سعودي (SAR)', 'Saudi Riyal (SAR)') },
    { value: 'USD', label: tr('دولار أمريكي (USD)', 'US Dollar (USD)') },
    { value: 'EUR', label: tr('يورو (EUR)', 'Euro (EUR)') },
    { value: 'AED', label: tr('درهم إماراتي (AED)', 'UAE Dirham (AED)') },
  ];

  const reorderMethods = [
    { value: 'min_max', ar: 'حد أدنى / أقصى', en: 'Min/Max' },
    { value: 'reorder_point', ar: 'نقطة إعادة الطلب', en: 'Reorder Point' },
    { value: 'periodic', ar: 'دوري', en: 'Periodic Review' },
    { value: 'demand_driven', ar: 'حسب الطلب', en: 'Demand-Driven' },
  ];

  const paymentTerms = [
    { value: '0', ar: 'فوري', en: 'Immediate' },
    { value: '15', ar: '15 يوم', en: 'Net 15' },
    { value: '30', ar: '30 يوم', en: 'Net 30' },
    { value: '45', ar: '45 يوم', en: 'Net 45' },
    { value: '60', ar: '60 يوم', en: 'Net 60' },
    { value: '90', ar: '90 يوم', en: 'Net 90' },
  ];

  // ── Save button helper ──────────────────────────────────────────────────
  function SaveButton({ section, onClick }: { section: string; onClick: () => void }) {
    const isSaving = savingSection === section;
    return (
      <Button onClick={onClick} disabled={isSaving} className="gap-2">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {tr('حفظ', 'Save')}
      </Button>
    );
  }

  // ── Toggle row helper ───────────────────────────────────────────────────
  function ToggleRow({
    labelAr,
    labelEn,
    descAr,
    descEn,
    checked,
    onCheckedChange,
  }: {
    labelAr: string;
    labelEn: string;
    descAr: string;
    descEn: string;
    checked: boolean;
    onCheckedChange: (val: boolean) => void;
  }) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{tr(labelAr, labelEn)}</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tr(descAr, descEn)}
          </p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {tr('إعدادات إمداد', 'IMDAD Settings')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr(
            'إدارة إعدادات وتكوينات منصة إمداد',
            'Manage IMDAD platform settings and configurations'
          )}
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('عام', 'General')}</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('المخزون', 'Inventory')}</span>
          </TabsTrigger>
          <TabsTrigger value="procurement" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('المشتريات', 'Procurement')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('الإشعارات', 'Notifications')}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: General Settings ───────────────────────────────────────── */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{tr('الإعدادات العامة', 'General Settings')}</CardTitle>
              <CardDescription>
                {tr(
                  'إعدادات المنظمة الأساسية وصيغ الترقيم التلقائي',
                  'Basic organization settings and auto-numbering formats'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Organization Name */}
              <div className="space-y-2">
                <Label htmlFor="orgName">{tr('اسم المنظمة', 'Organization Name')}</Label>
                <Input
                  id="orgName"
                  value={general.orgName}
                  onChange={(e) => setGeneral((p) => ({ ...p, orgName: e.target.value }))}
                  placeholder={tr('أدخل اسم المنظمة', 'Enter organization name')}
                />
              </div>

              {/* Default Currency */}
              <div className="space-y-2">
                <Label>{tr('العملة الافتراضية', 'Default Currency')}</Label>
                <Select
                  value={general.currency}
                  onValueChange={(v) => setGeneral((p) => ({ ...p, currency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر العملة', 'Select currency')} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fiscal Year Start */}
              <div className="space-y-2">
                <Label>{tr('بداية السنة المالية', 'Fiscal Year Start Month')}</Label>
                <Select
                  value={general.fiscalYearStart}
                  onValueChange={(v) => setGeneral((p) => ({ ...p, fiscalYearStart: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر الشهر', 'Select month')} />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {tr(m.ar, m.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-numbering */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  {tr('صيغ الترقيم التلقائي', 'Auto-Numbering Formats')}
                </Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="poPrefix">
                      {tr('بادئة أمر الشراء', 'PO Prefix')}
                    </Label>
                    <Input
                      id="poPrefix"
                      value={general.poPrefix}
                      onChange={(e) => setGeneral((p) => ({ ...p, poPrefix: e.target.value }))}
                      placeholder="PO-"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grnPrefix">
                      {tr('بادئة إذن الاستلام', 'GRN Prefix')}
                    </Label>
                    <Input
                      id="grnPrefix"
                      value={general.grnPrefix}
                      onChange={(e) => setGeneral((p) => ({ ...p, grnPrefix: e.target.value }))}
                      placeholder="GRN-"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reqPrefix">
                      {tr('بادئة طلب الشراء', 'Requisition Prefix')}
                    </Label>
                    <Input
                      id="reqPrefix"
                      value={general.reqPrefix}
                      onChange={(e) => setGeneral((p) => ({ ...p, reqPrefix: e.target.value }))}
                      placeholder="REQ-"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invPrefix">
                      {tr('بادئة الفاتورة', 'Invoice Prefix')}
                    </Label>
                    <Input
                      id="invPrefix"
                      value={general.invPrefix}
                      onChange={(e) => setGeneral((p) => ({ ...p, invPrefix: e.target.value }))}
                      placeholder="INV-"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <SaveButton section="general" onClick={saveGeneral} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Inventory Settings ─────────────────────────────────────── */}
        <TabsContent value="inventory" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات المخزون', 'Inventory Settings')}</CardTitle>
              <CardDescription>
                {tr(
                  'إدارة حدود المخزون وطرق إعادة الطلب',
                  'Manage stock thresholds and reorder methods'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Reorder Method */}
              <div className="space-y-2">
                <Label>{tr('طريقة إعادة الطلب الافتراضية', 'Default Reorder Method')}</Label>
                <Select
                  value={inventory.reorderMethod}
                  onValueChange={(v) => setInventory((p) => ({ ...p, reorderMethod: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر الطريقة', 'Select method')} />
                  </SelectTrigger>
                  <SelectContent>
                    {reorderMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {tr(m.ar, m.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Low Stock Threshold */}
              <div className="space-y-2">
                <Label htmlFor="lowStock">
                  {tr('حد المخزون المنخفض (%)', 'Low Stock Threshold (%)')}
                </Label>
                <Input
                  id="lowStock"
                  type="number"
                  min="1"
                  max="100"
                  value={inventory.lowStockThreshold}
                  onChange={(e) =>
                    setInventory((p) => ({ ...p, lowStockThreshold: e.target.value }))
                  }
                  placeholder="20"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr(
                    'التنبيه عندما يصل المخزون إلى هذه النسبة من الحد الأقصى',
                    'Alert when stock reaches this percentage of maximum level'
                  )}
                </p>
              </div>

              {/* Expiry Warning Days */}
              <div className="space-y-2">
                <Label htmlFor="expiryDays">
                  {tr('أيام التحذير من انتهاء الصلاحية', 'Expiry Warning Days')}
                </Label>
                <Input
                  id="expiryDays"
                  type="number"
                  min="1"
                  max="365"
                  value={inventory.expiryWarningDays}
                  onChange={(e) =>
                    setInventory((p) => ({ ...p, expiryWarningDays: e.target.value }))
                  }
                  placeholder="90"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr(
                    'التنبيه قبل هذا العدد من الأيام من تاريخ انتهاء الصلاحية',
                    'Alert this many days before item expiry date'
                  )}
                </p>
              </div>

              {/* Allow Negative Stock */}
              <ToggleRow
                labelAr="السماح بالمخزون السالب"
                labelEn="Allow Negative Stock"
                descAr="السماح بالصرف حتى عندما يكون رصيد المخزون صفر"
                descEn="Allow dispensing even when stock balance is zero"
                checked={inventory.allowNegativeStock}
                onCheckedChange={(v) => setInventory((p) => ({ ...p, allowNegativeStock: v }))}
              />

              <div className="flex justify-end pt-4">
                <SaveButton section="inventory" onClick={saveInventory} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Procurement Settings ───────────────────────────────────── */}
        <TabsContent value="procurement" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات المشتريات', 'Procurement Settings')}</CardTitle>
              <CardDescription>
                {tr(
                  'إدارة حدود الموافقة وشروط الدفع',
                  'Manage approval thresholds and payment terms'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Approval Threshold */}
              <div className="space-y-2">
                <Label htmlFor="approvalThreshold">
                  {tr('حد مبلغ الموافقة (ريال)', 'Approval Threshold Amount (SAR)')}
                </Label>
                <Input
                  id="approvalThreshold"
                  type="number"
                  min="0"
                  value={procurement.approvalThreshold}
                  onChange={(e) =>
                    setProcurement((p) => ({ ...p, approvalThreshold: e.target.value }))
                  }
                  placeholder="50000"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tr(
                    'أوامر الشراء التي تتجاوز هذا المبلغ تتطلب موافقة إضافية',
                    'Purchase orders exceeding this amount require additional approval'
                  )}
                </p>
              </div>

              {/* Auto-approve */}
              <ToggleRow
                labelAr="الموافقة التلقائية تحت الحد"
                labelEn="Auto-Approve Below Threshold"
                descAr="الموافقة تلقائياً على أوامر الشراء التي لا تتجاوز حد الموافقة"
                descEn="Automatically approve purchase orders below the approval threshold"
                checked={procurement.autoApproveBelow}
                onCheckedChange={(v) => setProcurement((p) => ({ ...p, autoApproveBelow: v }))}
              />

              {/* Default Payment Terms */}
              <div className="space-y-2">
                <Label>{tr('شروط الدفع الافتراضية', 'Default Payment Terms')}</Label>
                <Select
                  value={procurement.defaultPaymentTerms}
                  onValueChange={(v) =>
                    setProcurement((p) => ({ ...p, defaultPaymentTerms: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={tr('اختر شروط الدفع', 'Select payment terms')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTerms.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {tr(t.ar, t.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Require Three Quotes */}
              <ToggleRow
                labelAr="طلب ثلاثة عروض أسعار"
                labelEn="Require Three Quotes"
                descAr="يجب تقديم ثلاثة عروض أسعار على الأقل لأوامر الشراء فوق الحد"
                descEn="Require at least three vendor quotes for purchase orders above the threshold"
                checked={procurement.requireThreeQuotes}
                onCheckedChange={(v) =>
                  setProcurement((p) => ({ ...p, requireThreeQuotes: v }))
                }
              />

              <div className="flex justify-end pt-4">
                <SaveButton section="procurement" onClick={saveProcurement} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Notification Settings ──────────────────────────────────── */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات الإشعارات', 'Notification Settings')}</CardTitle>
              <CardDescription>
                {tr(
                  'إدارة تنبيهات البريد الإلكتروني وإشعارات النظام',
                  'Manage email alerts and system notifications'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                labelAr="تفعيل إشعارات البريد الإلكتروني"
                labelEn="Enable Email Notifications"
                descAr="إرسال إشعارات عبر البريد الإلكتروني للأحداث المهمة"
                descEn="Send email notifications for important events"
                checked={notifications.enableEmail}
                onCheckedChange={(v) =>
                  setNotifications((p) => ({ ...p, enableEmail: v }))
                }
              />

              <ToggleRow
                labelAr="تنبيهات المخزون المنخفض"
                labelEn="Stock Low Alerts"
                descAr="إشعار عند انخفاض مستوى المخزون عن الحد المحدد"
                descEn="Notify when stock level falls below the configured threshold"
                checked={notifications.stockLowAlerts}
                onCheckedChange={(v) =>
                  setNotifications((p) => ({ ...p, stockLowAlerts: v }))
                }
              />

              <ToggleRow
                labelAr="تنبيهات موافقة أوامر الشراء"
                labelEn="PO Approval Alerts"
                descAr="إشعار عند وجود أوامر شراء تحتاج موافقة"
                descEn="Notify when purchase orders require approval"
                checked={notifications.poApprovalAlerts}
                onCheckedChange={(v) =>
                  setNotifications((p) => ({ ...p, poApprovalAlerts: v }))
                }
              />

              <ToggleRow
                labelAr="تنبيهات استحقاق الصيانة"
                labelEn="Maintenance Due Alerts"
                descAr="إشعار عند اقتراب موعد صيانة الأصول"
                descEn="Notify when asset maintenance is due"
                checked={notifications.maintenanceDueAlerts}
                onCheckedChange={(v) =>
                  setNotifications((p) => ({ ...p, maintenanceDueAlerts: v }))
                }
              />

              <div className="flex justify-end pt-4">
                <SaveButton section="notifications" onClick={saveNotifications} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
