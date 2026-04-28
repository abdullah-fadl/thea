'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';

type TabKey = 'general' | 'inventory' | 'procurement' | 'approval' | 'notification';

interface ConfigField {
  key: string;
  labelAr: string;
  labelEn: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: { value: string; labelAr: string; labelEn: string }[];
}

const TAB_FIELDS: Record<TabKey, ConfigField[]> = {
  general: [
    { key: 'imdad.org.name', labelAr: 'اسم المنظمة', labelEn: 'Organization Name', type: 'text' },
    { key: 'imdad.org.currency', labelAr: 'العملة الافتراضية', labelEn: 'Default Currency', type: 'select', options: [
      { value: 'SAR', labelAr: 'ريال سعودي', labelEn: 'SAR' },
      { value: 'USD', labelAr: 'دولار أمريكي', labelEn: 'USD' },
      { value: 'EUR', labelAr: 'يورو', labelEn: 'EUR' },
    ]},
    { key: 'imdad.org.fiscalYearStart', labelAr: 'بداية السنة المالية', labelEn: 'Fiscal Year Start Month', type: 'select', options: Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1), labelAr: String(i + 1), labelEn: String(i + 1),
    }))},
    { key: 'imdad.org.timezone', labelAr: 'المنطقة الزمنية', labelEn: 'Timezone', type: 'text' },
    { key: 'imdad.org.dateFormat', labelAr: 'تنسيق التاريخ', labelEn: 'Date Format', type: 'select', options: [
      { value: 'YYYY-MM-DD', labelAr: 'YYYY-MM-DD', labelEn: 'YYYY-MM-DD' },
      { value: 'DD/MM/YYYY', labelAr: 'DD/MM/YYYY', labelEn: 'DD/MM/YYYY' },
      { value: 'MM/DD/YYYY', labelAr: 'MM/DD/YYYY', labelEn: 'MM/DD/YYYY' },
    ]},
  ],
  inventory: [
    { key: 'imdad.inv.autoReorder', labelAr: 'إعادة الطلب التلقائي', labelEn: 'Auto Reorder Enabled', type: 'boolean' },
    { key: 'imdad.inv.defaultReorderPoint', labelAr: 'نقطة إعادة الطلب الافتراضية', labelEn: 'Default Reorder Point', type: 'number' },
    { key: 'imdad.inv.defaultSafetyStock', labelAr: 'مخزون الأمان الافتراضي', labelEn: 'Default Safety Stock', type: 'number' },
    { key: 'imdad.inv.expiryAlertDays', labelAr: 'أيام تنبيه انتهاء الصلاحية', labelEn: 'Expiry Alert Days', type: 'number' },
    { key: 'imdad.inv.valuationMethod', labelAr: 'طريقة التقييم', labelEn: 'Valuation Method', type: 'select', options: [
      { value: 'FIFO', labelAr: 'الوارد أولاً يصرف أولاً', labelEn: 'FIFO' },
      { value: 'LIFO', labelAr: 'الوارد أخيراً يصرف أولاً', labelEn: 'LIFO' },
      { value: 'WAC', labelAr: 'المتوسط المرجح', labelEn: 'Weighted Average Cost' },
    ]},
    { key: 'imdad.inv.batchTracking', labelAr: 'تتبع الدُفعات', labelEn: 'Batch Tracking Enabled', type: 'boolean' },
  ],
  procurement: [
    { key: 'imdad.proc.requireThreeQuotes', labelAr: 'اشتراط ثلاثة عروض أسعار', labelEn: 'Require 3 Quotes', type: 'boolean' },
    { key: 'imdad.proc.defaultPaymentTerms', labelAr: 'شروط الدفع الافتراضية (أيام)', labelEn: 'Default Payment Terms (days)', type: 'number' },
    { key: 'imdad.proc.poPrefix', labelAr: 'بادئة أمر الشراء', labelEn: 'PO Number Prefix', type: 'text' },
    { key: 'imdad.proc.autoGRN', labelAr: 'إصدار GRN تلقائي', labelEn: 'Auto-generate GRN', type: 'boolean' },
    { key: 'imdad.proc.defaultDeliveryDays', labelAr: 'أيام التسليم الافتراضية', labelEn: 'Default Delivery Days', type: 'number' },
  ],
  approval: [
    { key: 'imdad.approval.poThreshold', labelAr: 'حد الموافقة على أوامر الشراء', labelEn: 'PO Approval Threshold', type: 'number' },
    { key: 'imdad.approval.requireDualApproval', labelAr: 'اشتراط موافقة مزدوجة', labelEn: 'Require Dual Approval', type: 'boolean' },
    { key: 'imdad.approval.autoApproveBelow', labelAr: 'موافقة تلقائية تحت المبلغ', labelEn: 'Auto-approve Below Amount', type: 'number' },
    { key: 'imdad.approval.escalationHours', labelAr: 'ساعات التصعيد', labelEn: 'Escalation Hours', type: 'number' },
  ],
  notification: [
    { key: 'imdad.notify.emailEnabled', labelAr: 'تفعيل البريد الإلكتروني', labelEn: 'Email Notifications', type: 'boolean' },
    { key: 'imdad.notify.smsEnabled', labelAr: 'تفعيل الرسائل النصية', labelEn: 'SMS Notifications', type: 'boolean' },
    { key: 'imdad.notify.lowStockAlert', labelAr: 'تنبيه المخزون المنخفض', labelEn: 'Low Stock Alerts', type: 'boolean' },
    { key: 'imdad.notify.expiryAlert', labelAr: 'تنبيه انتهاء الصلاحية', labelEn: 'Expiry Alerts', type: 'boolean' },
    { key: 'imdad.notify.poStatusChange', labelAr: 'تنبيه تغيير حالة أمر الشراء', labelEn: 'PO Status Change Alerts', type: 'boolean' },
    { key: 'imdad.notify.digestFrequency', labelAr: 'تكرار الملخص', labelEn: 'Digest Frequency', type: 'select', options: [
      { value: 'REALTIME', labelAr: 'فوري', labelEn: 'Real-time' },
      { value: 'HOURLY', labelAr: 'كل ساعة', labelEn: 'Hourly' },
      { value: 'DAILY', labelAr: 'يومي', labelEn: 'Daily' },
    ]},
  ],
};

export default function ConfigPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [configValues, setConfigValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const tabs: { key: TabKey; labelAr: string; labelEn: string }[] = [
    { key: 'general', labelAr: 'الإعدادات العامة', labelEn: 'General Settings' },
    { key: 'inventory', labelAr: 'إعدادات المخزون', labelEn: 'Inventory Config' },
    { key: 'procurement', labelAr: 'إعدادات المشتريات', labelEn: 'Procurement Config' },
    { key: 'approval', labelAr: 'إعدادات الموافقات', labelEn: 'Approval Config' },
    { key: 'notification', labelAr: 'إعدادات الإشعارات', labelEn: 'Notification Config' },
  ];

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imdad/admin/config?scope=ORGANIZATION', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setConfigValues(json.configs || {});
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleChange = (key: string, value: unknown) => {
    setConfigValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tabKeys = TAB_FIELDS[activeTab].map(f => f.key);
      const payload: Record<string, unknown> = {};
      for (const k of tabKeys) {
        if (configValues[k] !== undefined) payload[k] = configValues[k];
      }

      const res = await fetch('/api/imdad/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ configs: payload, scope: 'ORGANIZATION' }),
      });

      if (res.ok) {
        setToast({ type: 'success', message: tr('تم حفظ الإعدادات بنجاح', 'Settings saved successfully') });
      } else {
        setToast({ type: 'error', message: tr('فشل في حفظ الإعدادات', 'Failed to save settings') });
      }
    } catch {
      setToast({ type: 'error', message: tr('حدث خطأ أثناء الحفظ', 'An error occurred while saving') });
    }
    setSaving(false);
  };

  const renderField = (field: ConfigField) => {
    const value = configValues[field.key];
    const label = language === 'ar' ? field.labelAr : field.labelEn;

    if (field.type === 'boolean') {
      return (
        <label key={field.key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
          <button
            type="button"
            role="switch"
            aria-checked={!!value}
            onClick={() => handleChange(field.key, !value)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${value ? 'bg-[#D4A017]' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${value ? (language === 'ar' ? '-translate-x-5 mr-0.5' : 'translate-x-5 ml-0.5') : (language === 'ar' ? '-translate-x-0.5 mr-0.5' : 'translate-x-0.5 ml-0.5')}`} />
          </button>
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.key} className="py-3 border-b border-gray-100 dark:border-gray-800">
          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{label}</label>
          <select
            value={String(value || '')}
            onChange={e => handleChange(field.key, e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="">{tr('-- اختر --', '-- Select --')}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {language === 'ar' ? opt.labelAr : opt.labelEn}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={field.key} className="py-3 border-b border-gray-100 dark:border-gray-800">
        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{label}</label>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={e => handleChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
      </div>
    );
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {tr('إعدادات النظام', 'System Configuration')}
      </h1>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
            : 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#D4A017] text-[#D4A017] dark:text-[#E8A317] dark:border-[#E8A317]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {language === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </nav>
      </div>

      {/* Form */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border rounded-lg dark:border-gray-700 p-6">
          <div className="max-w-2xl">
            {TAB_FIELDS[activeTab].map(field => renderField(field))}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-[#D4A017] text-white rounded-lg text-sm font-medium hover:bg-[#C4960C] disabled:opacity-50 transition-colors"
            >
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ الإعدادات', 'Save Settings')}
            </button>
            <button
              onClick={fetchConfig}
              disabled={loading}
              className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {tr('إعادة تحميل', 'Reload')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
