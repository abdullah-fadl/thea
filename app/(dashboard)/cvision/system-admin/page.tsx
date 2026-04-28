'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';
import type { BadgeVariant } from '@/components/cvision/ui/CVisionBadge';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Settings,
  Database,
  Palette,
  Mail,
  Globe,
  Activity,
  Server,
  HardDrive,
  Building2,
  Phone,
  AtSign,
  MapPin,
  Hash,
  Save,
  Loader2,
  RefreshCw,
  ToggleLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  BarChart3,
  Pencil,
  Sun,
  Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

// ===========================================================================
// Constants & Helpers
// ===========================================================================

const API = '/api/cvision/admin';

function apiGet(action: string, extra = '') {
  return cvisionFetch(`${API}?action=${action}${extra}`);
}

function apiPost(body: Record<string, unknown>) {
  return cvisionMutate(API, 'POST', body);
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatUptime(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

// ===========================================================================
// Reusable Field wrapper
// ===========================================================================

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500 }}>{label}</CVisionLabel>
      {children}
      {hint && (
        <p style={{ fontSize: 12, color: C.textMuted }}>{hint}</p>
      )}
    </div>
  );
}

// ===========================================================================
// Loading skeletons
// ===========================================================================

function FormSkeleton({ rows = 4 }: { rows?: number }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 96 }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%' }}  />
        </div>
      ))}
      <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 128, marginTop: 16 }}  />
    </div>
  );
}

function TableSkeleton({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%' }}  />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <CVisionSkeletonCard C={C} height={200} key={j} style={{ height: 32, flex: 1 }}  />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ count = 4 }: { count?: number }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16, padding: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <CVisionCard C={C} key={i}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 80 }}  />
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 64 }}  />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 12, width: 96, marginTop: 8 }}  />
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

// ===========================================================================
// Tab 1: Company Info
// ===========================================================================

function CompanyInfoTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    logo: '',
    crNumber: '',
    industry: '',
    size: '',
    address: '',
    phone: '',
    email: '',
  });

  const { data: settingsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'settings' }),
    queryFn: () => apiGet('settings'),
  });

  // Sync form when data loads
  const settingsData = settingsRaw as any | undefined;
  const loadedCompany = (settingsData?.company || (settingsData?.data as any)?.company) as Record<string, string> | undefined;
  if (loadedCompany && !form.name && loadedCompany.name) {
    setForm({
      name: loadedCompany.name || '',
      logo: loadedCompany.logo || '',
      crNumber: loadedCompany.crNumber || '',
      industry: loadedCompany.industry || '',
      size: loadedCompany.size || '',
      address: loadedCompany.address || '',
      phone: loadedCompany.phone || '',
      email: loadedCompany.email || '',
    });
  }

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPost({
        action: 'update-settings',
        section: 'company',
        data: form,
      });
      toast.success(tr('تم حفظ بيانات الشركة بنجاح', 'Company information saved successfully'));
    } catch (err: any) {
      toast.error(tr('فشل في حفظ بيانات الشركة', 'Failed to save company info'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FormSkeleton rows={8} />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Building2 style={{ height: 20, width: 20, color: C.gold }} />
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('بيانات الشركة', 'Company Information')}</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 20 }}>
        <Field label={tr('اسم الشركة', 'Company Name')}>
          <CVisionInput C={C}
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={tr('أدخل اسم الشركة', 'Enter company name')}
          />
        </Field>

        <Field label={tr('رابط الشعار', 'Logo URL')}>
          <CVisionInput C={C}
            value={form.logo}
            onChange={(e) => handleChange('logo', e.target.value)}
            placeholder="https://example.com/logo.png"
          />
        </Field>

        <Field label={tr('رقم السجل التجاري', 'CR Number')} hint={tr('رقم السجل التجاري', 'Commercial Registration number')}>
          <div style={{ position: 'relative' }}>
            <Hash style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              value={form.crNumber}
              onChange={(e) => handleChange('crNumber', e.target.value)}
              placeholder="1010XXXXXX"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </Field>

        <Field label={tr('القطاع', 'Industry')}>
          <CVisionInput C={C}
            value={form.industry}
            onChange={(e) => handleChange('industry', e.target.value)}
            placeholder={tr('مثال: رعاية صحية، تقنية', 'e.g. Healthcare, Technology')}
          />
        </Field>

        <Field label={tr('حجم الشركة', 'Company Size')}>
          <CVisionInput C={C}
            value={form.size}
            onChange={(e) => handleChange('size', e.target.value)}
            placeholder={tr('مثال: 50-100، 500+', 'e.g. 50-100, 500+')}
          />
        </Field>

        <Field label={tr('العنوان', 'Address')}>
          <div style={{ position: 'relative' }}>
            <MapPin style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder={tr('العنوان الكامل للشركة', 'Full company address')}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </Field>

        <Field label={tr('الهاتف', 'Phone')}>
          <div style={{ position: 'relative' }}>
            <Phone style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+966 XX XXX XXXX"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </Field>

        <Field label={tr('البريد الإلكتروني', 'Email')}>
          <div style={{ position: 'relative' }}>
            <AtSign style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="admin@company.com"
              style={{ paddingLeft: 36 }}
            />
          </div>
        </Field>
      </div>

      {form.logo && (
        <div style={{ marginTop: 8 }}>
          <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>{tr('معاينة الشعار', 'Logo Preview')}</CVisionLabel>
          <div style={{ padding: 16, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <img
              src={form.logo}
              alt={tr('شعار الشركة', 'Company logo')}
              style={{ height: 64 }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
        {saving ? (
          <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />
        ) : (
          <Save style={{ height: 16, width: 16, marginRight: 8 }} />
        )}
        {tr('حفظ بيانات الشركة', 'Save Company Info')}
      </CVisionButton>
    </div>
  );
}

// ===========================================================================
// Tab 2: Branding
// ===========================================================================

function BrandingTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState({
    primaryColor: '#2563EB',
    secondaryColor: '#1E293B',
    accentColor: '#F59E0B',
    darkMode: false,
  });

  const { data: brandRes, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'settings-branding' }),
    queryFn: () => apiGet('settings'),
  });
  const brandData = brandRes as any | undefined;
  const loadedBranding = (brandData?.branding || (brandData?.data as any)?.branding) as Record<string, string> | undefined;
  if (loadedBranding && branding.primaryColor === '#2563EB' && loadedBranding.primaryColor) {
    setBranding({
      primaryColor: loadedBranding.primaryColor || '#2563EB',
      secondaryColor: loadedBranding.secondaryColor || '#1E293B',
      accentColor: loadedBranding.accentColor || '#F59E0B',
      darkMode: !!loadedBranding.darkMode,
    });
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPost({
        action: 'update-branding',
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        darkMode: branding.darkMode,
      });
      toast.success(tr('تم حفظ الهوية البصرية بنجاح', 'Branding saved successfully'));
    } catch (err: any) {
      toast.error(tr('فشل في حفظ الهوية البصرية', 'Failed to save branding'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FormSkeleton rows={4} />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Palette style={{ height: 20, width: 20, color: C.gold }} />
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('الهوية البصرية', 'Branding')}</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 20 }}>
        <Field label={tr('اللون الأساسي', 'Primary Color')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{ height: 40, width: 40, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: branding.primaryColor }}
            />
            <CVisionInput C={C}
              value={branding.primaryColor}
              onChange={(e) =>
                setBranding((p) => ({ ...p, primaryColor: e.target.value }))
              }
              placeholder="#2563EB"
            />
          </div>
        </Field>

        <Field label={tr('اللون الثانوي', 'Secondary Color')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{ height: 40, width: 40, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: branding.secondaryColor }}
            />
            <CVisionInput C={C}
              value={branding.secondaryColor}
              onChange={(e) =>
                setBranding((p) => ({ ...p, secondaryColor: e.target.value }))
              }
              placeholder="#1E293B"
            />
          </div>
        </Field>

        <Field label={tr('لون التمييز', 'Accent Color')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{ height: 40, width: 40, borderRadius: 12, border: `1px solid ${C.border}`, backgroundColor: branding.accentColor }}
            />
            <CVisionInput C={C}
              value={branding.accentColor}
              onChange={(e) =>
                setBranding((p) => ({ ...p, accentColor: e.target.value }))
              }
              placeholder="#F59E0B"
            />
          </div>
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
        <input type="checkbox"
          checked={branding.darkMode}
          onChange={(e) =>
            setBranding((p) => ({ ...p, darkMode: e.target.checked }))
          }
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {branding.darkMode ? (
            <Moon style={{ height: 16, width: 16, color: C.textMuted }} />
          ) : (
            <Sun style={{ height: 16, width: 16, color: C.textMuted }} />
          )}
          <CVisionLabel C={C} style={{ fontSize: 13 }}>
            {branding.darkMode ? tr('الوضع الداكن مفعّل', 'Dark Mode Enabled') : tr('الوضع الفاتح', 'Light Mode')}
          </CVisionLabel>
        </div>
      </div>

      {/* Preview Section */}
      <div style={{ marginTop: 24 }}>
        <CVisionLabel C={C} style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, display: 'block' }}>{tr('معاينة', 'Preview')}</CVisionLabel>
        <CVisionCard C={C} style={{ overflow: 'hidden' }}>
          {/* Simulated navbar */}
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: branding.secondaryColor, color: '#fff' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>{tr('منصة CVision', 'CVision Platform')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{tr('لوحة التحكم', 'Dashboard')}</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{tr('الموظفون', 'Employees')}</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{tr('التقارير', 'Reports')}</span>
            </div>
          </div>

          {/* Content area */}
          <div
            style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, backgroundColor: branding.darkMode ? '#111827' : '#ffffff', color: branding.darkMode ? '#e5e7eb' : '#111827' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CVisionButton C={C} isDark={isDark}
                size="sm"
                style={{ backgroundColor: branding.primaryColor, color: '#fff' }}
              >
                {tr('إجراء أساسي', 'Primary Action')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark}
                size="sm"
                variant="outline"
                style={{
                  borderColor: branding.accentColor,
                  color: branding.accentColor,
                }}
              >
                {tr('إجراء ثانوي', 'Secondary Action')}
              </CVisionButton>
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <div
                style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: '50%', fontSize: 12, fontWeight: 500, backgroundColor: branding.primaryColor + '20', color: branding.primaryColor }}
              >
                {tr('نشط', 'Active')}
              </div>
              <div
                style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: '50%', fontSize: 12, fontWeight: 500, backgroundColor: branding.accentColor + '20', color: branding.accentColor }}
              >
                {tr('معلق', 'Pending')}
              </div>
            </div>

            <div
              style={{ height: 8, borderRadius: '50%', backgroundColor: branding.primaryColor + '30' }}
            >
              <div
                style={{ height: 8, borderRadius: '50%', backgroundColor: branding.primaryColor }}
              />
            </div>
          </div>
        </CVisionCard>
      </div>

      <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
        {saving ? (
          <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />
        ) : (
          <Save style={{ height: 16, width: 16, marginRight: 8 }} />
        )}
        {tr('حفظ الهوية البصرية', 'Save Branding')}
      </CVisionButton>
    </div>
  );
}

// ===========================================================================
// Tab 3: Modules
// ===========================================================================

interface ModuleItem {
  module: string;
  enabled: boolean;
  label: string;
}

function ModulesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: modRes, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'modules' }),
    queryFn: () => apiGet('modules'),
  });
  const modData = modRes as any | undefined;
  const loadedModules = ((modData?.data as any)?.items || modData?.items || []) as ModuleItem[];
  if (loadedModules.length > 0 && modules.length === 0) { setModules(loadedModules); }

  const handleToggle = async (mod: ModuleItem) => {
    try {
      setToggling(mod.module);
      await apiPost({
        action: 'toggle-module',
        module: mod.module,
        enabled: !mod.enabled,
      });
      setModules((prev) =>
        prev.map((m) =>
          m.module === mod.module ? { ...m, enabled: !m.enabled } : m
        )
      );
      toast.success(
        `${mod.label || mod.module} ${!mod.enabled ? tr('مفعّل', 'enabled') : tr('معطّل', 'disabled')}`
      );
    } catch (err: any) {
      toast.error(tr('فشل في تبديل حالة الوحدة', 'Failed to toggle module'), { description: err.message });
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <TableSkeleton rows={6} cols={3} />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToggleLeft style={{ height: 20, width: 20, color: C.gold }} />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('الوحدات', 'Modules')}</h3>
        </div>
        <CVisionBadge C={C} variant="secondary">{modules.length} {tr('وحدة', 'modules')}</CVisionBadge>
      </div>

      <CVisionCard C={C}>
        <CVisionTable C={C}>
          <CVisionTableHead C={C}>
              <CVisionTh C={C} className="w-[50%]">{tr('الوحدة', 'Module')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('تبديل', 'Toggle')}</CVisionTh>
          </CVisionTableHead>
          <CVisionTableBody>
            {modules.length === 0 && (
              <CVisionTr C={C}>
                <CVisionTd align="center" colSpan={3} style={{ paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                  {tr('لم يتم العثور على وحدات.', 'No modules found.')}
                </CVisionTd>
              </CVisionTr>
            )}
            {modules.map((mod) => (
              <CVisionTr C={C} key={mod.module}>
                <CVisionTd>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        mod.enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    />
                    <span style={{ fontWeight: 500 }}>{mod.label || mod.module}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      ({mod.module})
                    </span>
                  </div>
                </CVisionTd>
                <CVisionTd>
                  <CVisionBadge C={C} variant={mod.enabled ? 'default' : 'secondary'}>
                    {mod.enabled ? tr('مفعّل', 'Enabled') : tr('معطّل', 'Disabled')}
                  </CVisionBadge>
                </CVisionTd>
                <CVisionTd align="right">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                    {toggling === mod.module && (
                      <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', color: C.textMuted }} />
                    )}
                    <Checkbox
                      checked={mod.enabled}
                      onCheckedChange={() => handleToggle(mod)}
                      disabled={toggling === mod.module}
                    />
                  </div>
                </CVisionTd>
              </CVisionTr>
            ))}
          </CVisionTableBody>
        </CVisionTable>
      </CVisionCard>

      <p style={{ fontSize: 12, color: C.textMuted }}>
        {tr('تعطيل وحدة يخفيها من القائمة ويمنع الوصول إليها عبر الـ API لجميع المستخدمين.', 'Disabling a module hides it from the navigation and prevents API access for all users.')}
      </p>
    </div>
  );
}

// ===========================================================================
// Tab 4: Email Templates
// ===========================================================================

interface EmailTemplate {
  event: string;
  subject: string;
  body: string;
  enabled: boolean;
}

function useDefaultTemplateLabels() {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return {
    leave_approved: tr('تمت الموافقة على الإجازة', 'Leave Approved'),
    payslip_ready: tr('كشف الراتب جاهز', 'Payslip Ready'),
    contract_renewal: tr('تجديد العقد', 'Contract Renewal'),
    welcome: tr('بريد الترحيب', 'Welcome Email'),
  } as Record<string, string>;
}

function EmailTemplatesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const DEFAULT_TEMPLATE_LABELS = useDefaultTemplateLabels();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: tmplRes, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'email-templates' }),
    queryFn: () => apiGet('email-templates'),
  });
  const tmplData = tmplRes as any | undefined;
  const loadedTemplates = ((tmplData?.data as any)?.items || tmplData?.items || []) as EmailTemplate[];
  if (loadedTemplates.length > 0 && templates.length === 0) { setTemplates(loadedTemplates); }

  const openEdit = (tmpl: EmailTemplate) => {
    setEditTemplate({ ...tmpl });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editTemplate) return;
    try {
      setSaving(true);
      await apiPost({
        action: 'update-email-template',
        event: editTemplate.event,
        subject: editTemplate.subject,
        body: editTemplate.body,
        enabled: editTemplate.enabled,
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.event === editTemplate.event ? { ...editTemplate } : t
        )
      );
      toast.success(tr('تم تحديث قالب البريد', 'Email template updated'));
      setEditOpen(false);
      setEditTemplate(null);
    } catch (err: any) {
      toast.error(tr('فشل في حفظ القالب', 'Failed to save template'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TableSkeleton rows={4} cols={4} />;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Mail style={{ height: 20, width: 20, color: C.gold }} />
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('قوالب البريد الإلكتروني', 'Email Templates')}</h3>
      </div>

      <CVisionCard C={C}>
        <CVisionTable C={C}>
          <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('الحدث', 'Event')}</CVisionTh>
              <CVisionTh C={C}>{tr('الموضوع', 'Subject')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
          </CVisionTableHead>
          <CVisionTableBody>
            {templates.length === 0 && (
              <CVisionTr C={C}>
                <CVisionTd align="center" colSpan={4} style={{ paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                  {tr('لم يتم العثور على قوالب بريد.', 'No email templates found.')}
                </CVisionTd>
              </CVisionTr>
            )}
            {templates.map((tmpl) => (
              <CVisionTr C={C} key={tmpl.event}>
                <CVisionTd>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail style={{ height: 16, width: 16, color: C.textMuted }} />
                    <span style={{ fontWeight: 500 }}>
                      {DEFAULT_TEMPLATE_LABELS[tmpl.event] || tmpl.event}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 24 }}>
                    {tmpl.event}
                  </span>
                </CVisionTd>
                <CVisionTd>
                  <span style={{ fontSize: 13 }}>{tmpl.subject || '--'}</span>
                </CVisionTd>
                <CVisionTd>
                  <CVisionBadge C={C} variant={tmpl.enabled ? 'default' : 'secondary'}>
                    {tmpl.enabled ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                  </CVisionBadge>
                </CVisionTd>
                <CVisionTd align="right">
                  <CVisionButton C={C} isDark={isDark}
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(tmpl)}
                  >
                    <Pencil style={{ height: 16, width: 16, marginRight: 4 }} />
                    {tr('تعديل', 'Edit')}
                  </CVisionButton>
                </CVisionTd>
              </CVisionTr>
            ))}
          </CVisionTableBody>
        </CVisionTable>
      </CVisionCard>

      {/* Edit Email Template Dialog */}
      <CVisionDialog C={C} open={editOpen} onClose={() => setEditOpen(false)} title={tr('تعديل التكوين', 'Edit Configuration')} isDark={isDark}>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {tr(
                `تخصيص قالب البريد لحدث ${editTemplate ? DEFAULT_TEMPLATE_LABELS[editTemplate.event] || editTemplate.event : ''}.`,
                `Customize the email template for the ${editTemplate ? DEFAULT_TEMPLATE_LABELS[editTemplate.event] || editTemplate.event : ''} event.`
              )}
            </p>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8, flex: 1 }}>
            <Field label={tr('الحدث', 'Event')}>
              <CVisionInput C={C} value={editTemplate?.event || ''} disabled />
            </Field>

            <Field label={tr('الموضوع', 'Subject')}>
              <CVisionInput C={C}
                value={editTemplate?.subject || ''}
                onChange={(e) =>
                  setEditTemplate((prev) =>
                    prev ? { ...prev, subject: e.target.value } : prev
                  )
                }
                placeholder={tr('سطر موضوع البريد', 'Email subject line')}
              />
            </Field>

            <Field
              label={tr('المحتوى', 'Body')}
              hint={tr('يمكنك استخدام عناصر نائبة مثل {{employeeName}}، {{date}}، إلخ.', 'You can use placeholders like {{employeeName}}, {{date}}, etc.')}
            >
              <CVisionTextarea C={C}
                value={editTemplate?.body || ''}
                onChange={(e) =>
                  setEditTemplate((prev) =>
                    prev ? { ...prev, body: e.target.value } : prev
                  )
                }
                placeholder={tr('محتوى البريد الإلكتروني...', 'Email body content...')}
                rows={8}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Checkbox
                checked={editTemplate?.enabled ?? false}
                onCheckedChange={(checked) =>
                  setEditTemplate((prev) =>
                    prev ? { ...prev, enabled: !!checked } : prev
                  )
                }
              />
              <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('القالب مفعّل', 'Template enabled')}</CVisionLabel>
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark}
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditTemplate(null);
              }}
            >
              {tr('إلغاء', 'Cancel')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />
              ) : (
                <Save style={{ height: 16, width: 16, marginRight: 8 }} />
              )}
              {tr('حفظ القالب', 'Save Template')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===========================================================================
// Tab 5: Preferences
// ===========================================================================

function PreferencesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'en-US',
    calendarType: 'GREGORIAN',
    timezone: 'Asia/Riyadh',
    weekStart: 'SUN',
    currency: 'SAR',
    fiscalYearStart: '1',
  });

  const { data: prefRes, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'settings-prefs' }),
    queryFn: () => apiGet('settings'),
  });
  const prefData = prefRes as any | undefined;
  const loadedPrefs = (prefData?.preferences || (prefData?.data as any)?.preferences) as Record<string, string> | undefined;
  if (loadedPrefs && prefs.defaultLanguage === 'en' && loadedPrefs.defaultLanguage) {
    setPrefs({
      defaultLanguage: loadedPrefs.defaultLanguage || 'en',
      dateFormat: loadedPrefs.dateFormat || 'DD/MM/YYYY',
      numberFormat: loadedPrefs.numberFormat || 'en-US',
      calendarType: loadedPrefs.calendarType || 'GREGORIAN',
      timezone: loadedPrefs.timezone || 'Asia/Riyadh',
      weekStart: loadedPrefs.weekStart || 'SUN',
      currency: loadedPrefs.currency || 'SAR',
      fiscalYearStart: String(loadedPrefs.fiscalYearStart || '1'),
    });
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPost({
        action: 'update-preferences',
        defaultLanguage: prefs.defaultLanguage,
        dateFormat: prefs.dateFormat,
        numberFormat: prefs.numberFormat,
        calendarType: prefs.calendarType,
        timezone: prefs.timezone,
        weekStart: prefs.weekStart,
        currency: prefs.currency,
        fiscalYearStart: prefs.fiscalYearStart,
      });
      toast.success(tr('تم حفظ التفضيلات بنجاح', 'Preferences saved successfully'));
    } catch (err: any) {
      toast.error(tr('فشل في حفظ التفضيلات', 'Failed to save preferences'), { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FormSkeleton rows={7} />;

  const MONTHS = [
    { value: '1', label: tr('يناير', 'January') },
    { value: '2', label: tr('فبراير', 'February') },
    { value: '3', label: tr('مارس', 'March') },
    { value: '4', label: tr('أبريل', 'April') },
    { value: '5', label: tr('مايو', 'May') },
    { value: '6', label: tr('يونيو', 'June') },
    { value: '7', label: tr('يوليو', 'July') },
    { value: '8', label: tr('أغسطس', 'August') },
    { value: '9', label: tr('سبتمبر', 'September') },
    { value: '10', label: tr('أكتوبر', 'October') },
    { value: '11', label: tr('نوفمبر', 'November') },
    { value: '12', label: tr('ديسمبر', 'December') },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Globe style={{ height: 20, width: 20, color: C.gold }} />
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('التفضيلات', 'Preferences')}</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 20 }}>
        <Field label={tr('اللغة الافتراضية', 'Default Language')}>
          <CVisionSelect
                C={C}
                value={prefs.defaultLanguage || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, defaultLanguage: val }))}
                placeholder={tr('اختر اللغة', 'Select language')}
                options={[{ value: 'en', label: tr('الإنجليزية', 'English') }, { value: 'ar', label: tr('العربية', 'Arabic') }, { value: 'both', label: tr('كلاهما', 'Both') }]}
              />
        </Field>

        <Field label={tr('تنسيق التاريخ', 'Date Format')}>
          <CVisionSelect
                C={C}
                value={prefs.dateFormat || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, dateFormat: val }))}
                placeholder={tr('اختر التنسيق', 'Select format')}
                options={[{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]}
              />
        </Field>

        <Field label={tr('نوع التقويم', 'Calendar Type')}>
          <CVisionSelect
                C={C}
                value={prefs.calendarType || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, calendarType: val }))}
                placeholder={tr('اختر التقويم', 'Select calendar')}
                options={[{ value: 'GREGORIAN', label: tr('ميلادي', 'Gregorian') }, { value: 'HIJRI', label: tr('هجري', 'Hijri') }]}
              />
        </Field>

        <Field label={tr('المنطقة الزمنية', 'Timezone')}>
          <CVisionSelect
                C={C}
                value={prefs.timezone || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, timezone: val }))}
                placeholder={tr('اختر المنطقة الزمنية', 'Select timezone')}
                options={[{ value: 'Asia/Riyadh', label: tr('آسيا/الرياض (AST، UTC+3)', 'Asia/Riyadh (AST, UTC+3)') }, { value: 'Asia/Dubai', label: tr('آسيا/دبي (GST، UTC+4)', 'Asia/Dubai (GST, UTC+4)') }, { value: 'Asia/Bahrain', label: tr('آسيا/البحرين (AST، UTC+3)', 'Asia/Bahrain (AST, UTC+3)') }, { value: 'Europe/London', label: tr('أوروبا/لندن (GMT/BST)', 'Europe/London (GMT/BST)') }, { value: 'America/New_York', label: tr('أمريكا/نيويورك (EST/EDT)', 'America/New York (EST/EDT)') }, { value: 'UTC', label: 'UTC' }]}
              />
        </Field>

        <Field label={tr('بداية الأسبوع', 'Week Starts On')}>
          <CVisionSelect
                C={C}
                value={prefs.weekStart || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, weekStart: val }))}
                placeholder={tr('اختر اليوم', 'Select day')}
                options={[{ value: 'SUN', label: tr('الأحد', 'Sunday') }, { value: 'MON', label: tr('الاثنين', 'Monday') }, { value: 'SAT', label: tr('السبت', 'Saturday') }]}
              />
        </Field>

        <Field label={tr('العملة', 'Currency')}>
          <CVisionSelect
                C={C}
                value={prefs.currency || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, currency: val }))}
                placeholder={tr('اختر العملة', 'Select currency')}
                options={[{ value: 'SAR', label: tr('ر.س - ريال سعودي', 'SAR - Saudi Riyal') }, { value: 'USD', label: tr('د.أ - دولار أمريكي', 'USD - US Dollar') }, { value: 'EUR', label: tr('يورو', 'EUR - Euro') }]}
              />
        </Field>

        <Field label={tr('تنسيق الأرقام', 'Number Format')}>
          <CVisionSelect
                C={C}
                value={prefs.numberFormat || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, numberFormat: val }))}
                placeholder={tr('اختر التنسيق', 'Select format')}
                options={[{ value: 'en-US', label: tr('1,234.56 (إنجليزي)', '1,234.56 (English)') }, { value: 'ar-SA', label: tr('1,234.56 (عربي)', '1,234.56 (Arabic)') }, { value: 'de-DE', label: tr('1.234,56 (أوروبي)', '1.234,56 (European)') }]}
              />
        </Field>

        <Field label={tr('بداية السنة المالية', 'Fiscal Year Start')}>
          <CVisionSelect
                C={C}
                value={prefs.fiscalYearStart || undefined}
                onChange={(val) =>
              setPrefs((p) => ({ ...p, fiscalYearStart: val }))}
                placeholder={tr('اختر الشهر', 'Select month')}
                options={[...MONTHS.map((m) => (
                ({ value: m.value, label: m.label })
              ))]}
              />
        </Field>
      </div>

      <div style={{ borderRadius: 12, padding: 16, marginTop: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{tr('ملخص الإعدادات الحالية', 'Current Configuration Summary')}</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12 }}>
          <div>
            <span style={{ color: C.textMuted }}>{tr('اللغة:', 'Language:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.defaultLanguage}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('التنسيق:', 'Format:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.dateFormat}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('التقويم:', 'Calendar:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.calendarType}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('المنطقة الزمنية:', 'TZ:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.timezone}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('بداية الأسبوع:', 'Week Start:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.weekStart}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('العملة:', 'Currency:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.currency}</span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('السنة المالية:', 'Fiscal Year:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>
              {tr('الشهر', 'Month')} {prefs.fiscalYearStart}
            </span>
          </div>
          <div>
            <span style={{ color: C.textMuted }}>{tr('الأرقام:', 'Numbers:')}</span>{' '}
            <span style={{ fontWeight: 500 }}>{prefs.numberFormat}</span>
          </div>
        </div>
      </div>

      <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
        {saving ? (
          <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />
        ) : (
          <Save style={{ height: 16, width: 16, marginRight: 8 }} />
        )}
        {tr('حفظ التفضيلات', 'Save Preferences')}
      </CVisionButton>
    </div>
  );
}

// ===========================================================================
// Tab 6: System Health
// ===========================================================================

interface SystemHealthData {
  status: string;
  employees: number;
  collections: number;
  uptime: number;
  timestamp: string;
}

interface StorageCollectionData {
  collection: string;
  documents: number;
}

interface StorageData {
  collections: StorageCollectionData[];
  totalCollections: number;
}

interface UsageStatsData {
  totalEmployees: number;
  activeEmployees: number;
  departments: number;
  requests: number;
}

function SystemHealthTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: healthRes, isLoading: loadingHealth } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'system-health' }),
    queryFn: () => apiGet('system-health'),
  });
  const health: SystemHealthData | null = healthRes || null;

  const { data: storageRes, isLoading: loadingStorage } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'storage' }),
    queryFn: () => apiGet('storage'),
  });
  const storage: StorageData | null = storageRes || null;

  const { data: usageRes, isLoading: loadingUsage } = useQuery({
    queryKey: cvisionKeys.admin.settings.list({ action: 'usage-stats' }),
    queryFn: () => apiGet('usage-stats'),
  });
  const usage: UsageStatsData | null = usageRes || null;

  const loading = loadingHealth || loadingStorage || loadingUsage;

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: cvisionKeys.admin.settings.all });
    toast.success(tr('تم تحديث صحة النظام', 'System health refreshed'));
    setRefreshing(false);
  };

  if (loading) return <CardsSkeleton count={8} />;

  const statusColor =
    health?.status === 'HEALTHY'
      ? 'text-emerald-600 dark:text-emerald-400'
      : health?.status === 'DEGRADED'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const statusBadgeVariant =
    health?.status === 'HEALTHY'
      ? 'default'
      : health?.status === 'DEGRADED'
      ? 'secondary'
      : 'destructive';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header with refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity style={{ height: 20, width: 20, color: C.gold }} />
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('صحة النظام', 'System Health')}</h3>
        </div>
        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
          />
          {tr('تحديث', 'Refresh')}
        </CVisionButton>
      </div>

      {/* Health status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server style={{ height: 16, width: 16 }} />
              {tr('حالة النظام', 'System Status')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {health?.status === 'HEALTHY' ? (
                <CheckCircle2 className={`h-5 w-5 ${statusColor}`} />
              ) : (
                <AlertCircle className={`h-5 w-5 ${statusColor}`} />
              )}
              <CVisionBadge C={C} variant={statusBadgeVariant as BadgeVariant}>
                {health?.status || tr('غير معروف', 'UNKNOWN')}
              </CVisionBadge>
            </div>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users style={{ height: 16, width: 16 }} />
              {tr('الموظفون', 'Employees')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {health?.employees?.toLocaleString('en-SA') ?? '--'}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {tr('إجمالي السجلات', 'Total records')}
            </p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database style={{ height: 16, width: 16 }} />
              {tr('المجموعات', 'Collections')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {health?.collections?.toLocaleString('en-SA') ?? '--'}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {tr('مجموعات قاعدة البيانات', 'Database collections')}
            </p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ height: 16, width: 16 }} />
              {tr('وقت التشغيل', 'Uptime')}
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {formatUptime(health?.uptime)}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {tr('منذ آخر إعادة تشغيل', 'Since last restart')}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Last check timestamp */}
      {health?.timestamp && (
        <p style={{ fontSize: 12, color: C.textMuted }}>
          {tr('آخر فحص:', 'Last check:')} {formatDate(health.timestamp)}
        </p>
      )}

      {/* Usage Statistics */}
      {usage && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <BarChart3 style={{ height: 20, width: 20, color: C.gold }} />
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('إحصائيات الاستخدام', 'Usage Statistics')}</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي الموظفين', 'Total Employees')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {usage.totalEmployees?.toLocaleString('en-SA') ?? 0}
                </div>
              </CVisionCardBody>
            </CVisionCard>

            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الموظفون النشطون', 'Active Employees')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {usage.activeEmployees?.toLocaleString('en-SA') ?? 0}
                </div>
                {usage.totalEmployees > 0 && (
                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                    {Math.round(
                      (usage.activeEmployees / usage.totalEmployees) * 100
                    )}
                    % {tr('معدل النشاط', 'active rate')}
                  </p>
                )}
              </CVisionCardBody>
            </CVisionCard>

            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الأقسام', 'Departments')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {usage.departments?.toLocaleString('en-SA') ?? 0}
                </div>
              </CVisionCardBody>
            </CVisionCard>

            <CVisionCard C={C}>
              <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('طلبات API', 'API Requests')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {usage.requests?.toLocaleString('en-SA') ?? 0}
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  {tr('هذه الفترة', 'This period')}
                </p>
              </CVisionCardBody>
            </CVisionCard>
          </div>
        </>
      )}

      {/* Storage usage table */}
      {storage && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HardDrive style={{ height: 20, width: 20, color: C.gold }} />
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('استخدام التخزين', 'Storage Usage')}</h3>
            </div>
            <CVisionBadge C={C} variant="secondary">
              {storage.totalCollections} {tr('مجموعة', 'collections')}
            </CVisionBadge>
          </div>

          <CVisionCard C={C}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('المجموعة', 'Collection')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المستندات', 'Documents')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('النسبة', 'Proportion')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {(!storage.collections || storage.collections.length === 0) && (
                  <CVisionTr C={C}>
                    <CVisionTd align="center" colSpan={3}
                      style={{ paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                      {tr('لا تتوفر بيانات تخزين.', 'No storage data available.')}
                    </CVisionTd>
                  </CVisionTr>
                )}
                {storage.collections &&
                  storage.collections.map((col) => {
                    const totalDocs = storage.collections.reduce(
                      (sum, c) => sum + (c.documents || 0),
                      0
                    );
                    const pct =
                      totalDocs > 0
                        ? Math.round((col.documents / totalDocs) * 100)
                        : 0;
                    return (
                      <CVisionTr C={C} key={col.collection}>
                        <CVisionTd>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Database style={{ height: 14, width: 14, color: C.textMuted }} />
                            <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 13 }}>
                              {col.collection}
                            </span>
                          </div>
                        </CVisionTd>
                        <CVisionTd align="right">
                          {col.documents?.toLocaleString('en-SA') ?? 0}
                        </CVisionTd>
                        <CVisionTd align="right">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                            <div style={{ width: 64, height: 8, borderRadius: '50%', background: C.bgSubtle, overflow: 'hidden' }}>
                              <div
                                style={{ borderRadius: '50%', background: C.gold, width: `${pct}%` }}
                              />
                            </div>
                            <span style={{ fontSize: 12, color: C.textMuted, width: 32, textAlign: 'right' }}>
                              {pct}%
                            </span>
                          </div>
                        </CVisionTd>
                      </CVisionTr>
                    );
                  })}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCard>

          {storage.collections && storage.collections.length > 0 && (
            <div style={{ borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.textMuted }}>{tr('إجمالي المستندات عبر جميع المجموعات', 'Total documents across all collections')}</span>
                <span style={{ fontWeight: 700 }}>
                  {storage.collections
                    .reduce((sum, c) => sum + (c.documents || 0), 0)
                    .toLocaleString('en-SA')}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Main Page
// ===========================================================================

export default function SystemAdminPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const TAB_CONFIG = [
    {
      id: 'company',
      label: tr('بيانات الشركة', 'Company Info'),
      icon: Building2,
    },
    {
      id: 'branding',
      label: tr('الهوية البصرية', 'Branding'),
      icon: Palette,
    },
    {
      id: 'modules',
      label: tr('الوحدات', 'Modules'),
      icon: ToggleLeft,
    },
    {
      id: 'email-templates',
      label: tr('قوالب البريد', 'Email Templates'),
      icon: Mail,
    },
    {
      id: 'preferences',
      label: tr('التفضيلات', 'Preferences'),
      icon: Globe,
    },
    {
      id: 'system-health',
      label: tr('صحة النظام', 'System Health'),
      icon: Activity,
    },
  ] as const;

  return (
    <div style={{ background: C.bgCard }}>
      <div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 32, paddingBottom: 32 }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Settings style={{ height: 24, width: 24, color: C.gold }} />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            {tr('إدارة النظام', 'System Administration')}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, marginLeft: 36 }}>
          {tr(
            'إدارة إعدادات الشركة، الهوية البصرية، الوحدات، قوالب البريد، التفضيلات، وصحة النظام.',
            'Manage company settings, branding, modules, email templates, preferences, and system health.'
          )}
        </p>

        <CVisionTabs
          C={C}
          defaultTab="company"
          tabs={TAB_CONFIG.map((tab) => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon,
          }))}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, minHeight: '500px' }}>
            <CVisionTabContent tabId="company">
              <CompanyInfoTab />
            </CVisionTabContent>

            <CVisionTabContent tabId="branding">
              <BrandingTab />
            </CVisionTabContent>

            <CVisionTabContent tabId="modules">
              <ModulesTab />
            </CVisionTabContent>

            <CVisionTabContent tabId="email-templates">
              <EmailTemplatesTab />
            </CVisionTabContent>

            <CVisionTabContent tabId="preferences">
              <PreferencesTab />
            </CVisionTabContent>

            <CVisionTabContent tabId="system-health">
              <SystemHealthTab />
            </CVisionTabContent>
          </div>
        </CVisionTabs>
      </div>
    </div>
  );
}
