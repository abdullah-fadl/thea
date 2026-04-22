'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout,
  CVisionMiniStat, CVisionStatsRow, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { MapPin, Plus, Building2, Users, Phone, Mail, ArrowLeft } from 'lucide-react';

const TYPES = ['HQ', 'BRANCH', 'REMOTE', 'WAREHOUSE', 'SITE'];

export default function BranchesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', nameAr: '', code: '', type: 'BRANCH', phone: '', email: '', managerName: '', molLicenseNumber: '', address: { street: '', city: '', region: '', postalCode: '', country: 'SA' } });

  // Fetch branches
  const { data: branchesRaw, isLoading: loading, refetch: refetchBranches } = useQuery({
    queryKey: cvisionKeys.branches.list({ action: 'list' }),
    queryFn: () => cvisionFetch('/api/cvision/branches', { params: { action: 'list' } }),
  });
  const branches: any[] = branchesRaw?.data || [];

  // Fetch branch stats when selected
  const { data: statsRaw } = useQuery({
    queryKey: cvisionKeys.branches.detail(selected?.branchId || ''),
    queryFn: () => cvisionFetch('/api/cvision/branches', { params: { action: 'stats', id: selected?.branchId } }),
    enabled: !!selected?.branchId,
  });
  const stats = statsRaw?.data ?? null;

  const selectBranch = (b: any) => {
    setSelected(b);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/branches', 'POST', { action: 'create', ...body }),
    onSuccess: () => {
      refetchBranches();
      setShowCreate(false);
      setForm({ name: '', nameAr: '', code: '', type: 'BRANCH', phone: '', email: '', managerName: '', molLicenseNumber: '', address: { street: '', city: '', region: '', postalCode: '', country: 'SA' } });
    },
  });
  const create = () => createMutation.mutate(form);

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate('/api/cvision/branches', 'POST', { action: 'deactivate', branchId: id }),
    onSuccess: () => { refetchBranches(); setSelected(null); },
  });
  const deactivate = (id: string) => deactivateMutation.mutate(id);

  const typeVariant = (t: string): 'info' | 'success' | 'purple' | 'muted' => t === 'HQ' ? 'info' : t === 'BRANCH' ? 'success' : t === 'REMOTE' ? 'purple' : 'muted';

  /* ── Detail View ── */
  if (selected) {
    return (
      <CVisionPageLayout style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => setSelected(null)}><ArrowLeft size={16} /></CVisionButton>
          <Building2 size={20} color={C.green} />
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{selected.name}</span>
          <CVisionBadge C={C} variant={typeVariant(selected.type)}>{selected.type}</CVisionBadge>
          <CVisionBadge C={C} variant={selected.isActive ? 'success' : 'muted'} dot>{selected.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('معلومات الفرع', 'Branch Info')}</span></CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: C.text }}>
                {selected.nameAr && <div><span style={{ color: C.textMuted }}>{tr('الاسم بالعربي', 'Arabic Name')}:</span> {selected.nameAr}</div>}
                {selected.code && <div><span style={{ color: C.textMuted }}>{tr('الرمز', 'Code')}:</span> {selected.code}</div>}
                {selected.address?.city && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} color={C.textMuted} />{[selected.address.street, selected.address.city, selected.address.region].filter(Boolean).join(', ')}</div>}
                {selected.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} color={C.textMuted} />{selected.phone}</div>}
                {selected.email && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} color={C.textMuted} />{selected.email}</div>}
                {selected.managerName && <div><span style={{ color: C.textMuted }}>{tr('المدير', 'Manager')}:</span> {selected.managerName}</div>}
                {selected.molLicenseNumber && <div><span style={{ color: C.textMuted }}>{tr('رخصة العمل', 'MOL License')}:</span> {selected.molLicenseNumber}</div>}
                {selected.workingHours && <div><span style={{ color: C.textMuted }}>{tr('ساعات العمل', 'Hours')}:</span> {selected.workingHours.start} - {selected.workingHours.end}</div>}
                {selected.workingDays && <div><span style={{ color: C.textMuted }}>{tr('أيام العمل', 'Days')}:</span> {selected.workingDays.join(', ')}</div>}
                <div style={{ paddingTop: 8 }}>
                  <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" onClick={() => deactivate(selected.branchId)}>
                    {tr('تعطيل', 'Deactivate')}
                  </CVisionButton>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color={C.textSecondary} />
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إحصائيات', 'Statistics')}</span>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {stats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ textAlign: 'center', padding: 12, background: C.bgSubtle, borderRadius: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{stats.headcount}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('موظفين', 'Employees')}</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: 12, background: C.bgSubtle, borderRadius: 10 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.purple }}>{stats.departmentCount}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{tr('أقسام', 'Departments')}</div>
                    </div>
                  </div>
                  {stats.departments?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>{tr('حسب القسم', 'By Department')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {stats.departments.map((d: any) => (
                          <div key={d._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.textSecondary }}>{d._id || tr('غير معين', 'Unassigned')}</span>
                            <span style={{ fontWeight: 500, color: C.text }}>{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 16, color: C.textMuted, fontSize: 13 }}>{tr('جاري تحميل الإحصائيات...', 'Loading stats...')}</div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </div>
      </CVisionPageLayout>
    );
  }

  /* ── List View ── */
  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('الفروع والمواقع', 'Branches & Locations')}
        titleEn="Branches & Locations"
        icon={MapPin}
        iconColor={C.green}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {tr('فرع جديد', 'New Branch')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C} style={{ marginBottom: 16, borderColor: C.green + '40' }}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('فرع جديد', 'New Branch')}</span></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('اسم الفرع', 'Branch name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('الاسم بالعربي', 'Arabic name')} value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('الرمز', 'Code (e.g. RUH-01)')} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <CVisionSelect C={C} value={form.type} onChange={v => setForm({ ...form, type: v })} options={TYPES.map(t => ({ value: t, label: t }))} />
                <CVisionInput C={C} placeholder={tr('الهاتف', 'Phone')} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('البريد', 'Email')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('الشارع', 'Street')} value={form.address.street} onChange={e => setForm({ ...form, address: { ...form.address, street: e.target.value } })} />
                <CVisionInput C={C} placeholder={tr('المدينة', 'City')} value={form.address.city} onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                <CVisionInput C={C} placeholder={tr('المنطقة', 'Region')} value={form.address.region} onChange={e => setForm({ ...form, address: { ...form.address, region: e.target.value } })} />
                <CVisionInput C={C} placeholder={tr('الرمز البريدي', 'Postal Code')} value={form.address.postalCode} onChange={e => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('اسم المدير', 'Manager name')} value={form.managerName} onChange={e => setForm({ ...form, managerName: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('رقم رخصة العمل', 'MOL License Number')} value={form.molLicenseNumber} onChange={e => setForm({ ...form, molLicenseNumber: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark} onClick={create} disabled={!form.name}>{tr('إنشاء', 'Create')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: C.textMuted, fontSize: 13 }}>{tr('جاري التحميل...', 'Loading branches...')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {branches.map(b => (
            <CVisionCard key={b.branchId} C={C} onClick={() => selectBranch(b)}>
              <CVisionCardBody style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color: C.text }}>{b.name}</div>
                    {b.nameAr && <div style={{ fontSize: 11, color: C.textMuted }}>{b.nameAr}</div>}
                  </div>
                  <CVisionBadge C={C} variant={typeVariant(b.type)}>{b.type}</CVisionBadge>
                </div>
                {b.address?.city && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: C.textSecondary }}>
                    <MapPin size={12} />{b.address.city}, {b.address.region || b.address.country}
                  </div>
                )}
                {b.managerName && <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>{tr('المدير', 'Manager')}: {b.managerName}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <CVisionBadge C={C} variant={b.isActive ? 'success' : 'muted'} dot>{b.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                  {b.code && <CVisionBadge C={C} variant="muted">{b.code}</CVisionBadge>}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
          {branches.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 13 }}>{tr('لا توجد فروع بعد', 'No branches configured yet.')}</div>}
        </div>
      )}
    </CVisionPageLayout>
  );
}
