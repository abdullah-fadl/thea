'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionTabs, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Building2, Globe, LayoutGrid, Bell, Mail, Save } from 'lucide-react';

export default function SettingsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('company');

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/admin/settings'),
  });
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['cvision', 'admin-email-templates', 'list'],
    queryFn: () => cvisionFetch<any>('/api/cvision/admin/email-templates', { params: { action: 'list' } }),
  });

  const settings = settingsData?.ok ? settingsData.data : null;
  const templates = templatesData?.ok ? (templatesData.data || []) : [];
  const loading = settingsLoading || templatesLoading;

  const saveMutation = useMutation({
    mutationFn: ({ section, data }: { section: string; data: any }) =>
      cvisionMutate<any>('/api/cvision/admin/settings', 'POST', { action: 'update', [section]: data }),
    onSuccess: (d) => { d.ok ? toast.success(tr('تم الحفظ', 'Saved')) : toast.error(d.error || tr('فشل', 'Failed')); },
    onError: () => toast.error(tr('فشل', 'Failed')),
  });
  const saving = saveMutation.isPending;
  const save = (section: string, data: any) => saveMutation.mutate({ section, data });

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} /><CVisionSkeletonCard C={C} /></CVisionPageLayout>;
  if (!settings) return <CVisionPageLayout><div style={{ padding: 24, color: C.textMuted }}>{tr('لا توجد إعدادات', 'No settings found.')}</div></CVisionPageLayout>;

  const co = settings.company || {};
  const pr = settings.preferences || {};
  const mo = settings.modules || {};
  const no = settings.notifications || {};

  const tabs = [
    { key: 'company', label: tr('الشركة', 'Company'), icon: <Building2 size={14} /> },
    { key: 'prefs', label: tr('التفضيلات', 'Preferences'), icon: <Globe size={14} /> },
    { key: 'modules', label: tr('الوحدات', 'Modules'), icon: <LayoutGrid size={14} /> },
    { key: 'notif', label: tr('الإشعارات', 'Notifications'), icon: <Bell size={14} /> },
    { key: 'email', label: tr('قوالب البريد', 'Email Templates'), icon: <Mail size={14} /> },
  ];

  const companyFields = ['nameEn','nameAr','commercialRegistration','vatNumber','molNumber','gosiNumber','phone','email','address'];
  const prefFields = ['language','dateFormat','calendarType','currency','timezone','weekStartDay'];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('إعدادات النظام', 'System Settings')} titleEn="System Settings" icon={Building2} iconColor={C.blue} isRTL={isRTL} />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'company' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معلومات الشركة', 'Company Information')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {companyFields.map(f => (
                <div key={f}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: 'capitalize' }}>{f.replace(/([A-Z])/g,' $1')}</div>
                  <CVisionInput C={C} defaultValue={co[f] || ''} onBlur={(e: any) => { co[f] = e.target.value; }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} disabled={saving} onClick={() => save('company', co)} icon={<Save size={14} />}>
                {tr('حفظ معلومات الشركة', 'Save Company Info')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {activeTab === 'prefs' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التفضيلات', 'Preferences')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {prefFields.map(f => (
                <div key={f}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: 'capitalize' }}>{f.replace(/([A-Z])/g,' $1')}</div>
                  <CVisionInput C={C} defaultValue={pr[f] || ''} onBlur={(e: any) => { pr[f] = e.target.value; }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} disabled={saving} onClick={() => save('preferences', pr)} icon={<Save size={14} />}>
                {tr('حفظ التفضيلات', 'Save Preferences')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {activeTab === 'modules' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تفعيل الوحدات', 'Module Toggles')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {Object.entries(mo).map(([k, v]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
                  <input type="checkbox" defaultChecked={v as boolean} onChange={e => { mo[k] = e.target.checked; }} style={{ accentColor: C.blue }} />
                  <span style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} disabled={saving} onClick={() => save('modules', mo)} icon={<Save size={14} />}>
                {tr('حفظ الوحدات', 'Save Modules')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {activeTab === 'notif' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إعدادات الإشعارات', 'Notification Settings')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
              <input type="checkbox" defaultChecked={no.emailEnabled} onChange={e => { no.emailEnabled = e.target.checked; }} style={{ accentColor: C.blue }} />
              {tr('إشعارات البريد الإلكتروني', 'Email Notifications')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
              <input type="checkbox" defaultChecked={no.smsEnabled} onChange={e => { no.smsEnabled = e.target.checked; }} style={{ accentColor: C.blue }} />
              {tr('إشعارات الرسائل القصيرة', 'SMS Notifications')}
            </label>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr('مزود الرسائل', 'SMS Provider')}</div>
              <CVisionInput C={C} defaultValue={no.smsProvider} onBlur={(e: any) => { no.smsProvider = e.target.value; }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr('أيام التذكير (مفصولة بفواصل)', 'Reminder Days (comma-separated)')}</div>
              <CVisionInput C={C} defaultValue={(no.reminderDays || []).join(',')} onBlur={(e: any) => { no.reminderDays = e.target.value.split(',').map(Number).filter(Boolean); }} />
            </div>
            <CVisionButton C={C} isDark={isDark} disabled={saving} onClick={() => save('notifications', no)} icon={<Save size={14} />}>
              {tr('حفظ الإشعارات', 'Save Notifications')}
            </CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {activeTab === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {templates.map(t => (
            <CVisionCard C={C} key={t.key}>
              <CVisionCardBody style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <CVisionBadge C={C} variant="muted">{t.key}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{t.subject}</span>
                  <CVisionBadge C={C} variant={t.isActive ? 'success' : 'muted'}>{t.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{t.subjectAr}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {(t.variables || []).map((v: string) => (
                    <span key={v} style={{ fontSize: 9, background: C.bgSubtle, padding: '2px 4px', borderRadius: 4, fontFamily: 'monospace', color: C.textMuted }}>{`{{${v}}}`}</span>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}
    </CVisionPageLayout>
  );
}
