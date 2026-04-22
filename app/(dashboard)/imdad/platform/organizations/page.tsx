'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, X, Building2 } from 'lucide-react';

interface Organization {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  type: string;
  region?: string;
  city?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  bedCount?: number;
  isActive: boolean;
  goLiveDate?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface OrgsResponse {
  items: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TYPE_OPTIONS = ['HOSPITAL', 'CLINIC', 'WAREHOUSE', 'GROUP'] as const;
const STATUS_OPTIONS = ['active', 'inactive'] as const;

function statusBadge(isActive: boolean) {
  return isActive
    ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    HOSPITAL: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
    CLINIC: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    WAREHOUSE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    GROUP: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]',
  };
  return map[type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

export default function OrganizationsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [items, setItems] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    code: '', name: '', nameAr: '', type: 'HOSPITAL' as string,
    region: '', city: '', address: '', timezone: '', currency: 'SAR',
    bedCount: 0, isActive: true,
  });

  const typeTr: Record<string, [string, string]> = {
    HOSPITAL: ['مستشفى', 'Hospital'],
    CLINIC: ['عيادة', 'Clinic'],
    WAREHOUSE: ['مستودع', 'Warehouse'],
    GROUP: ['مجموعة', 'Group'],
  };

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('isActive', statusFilter === 'active' ? 'true' : 'false');

      const res = await fetch(`/api/imdad/platform/organizations?${params}`);
      if (res.ok) {
        const json: OrgsResponse = await res.json();
        setItems(json.items ?? []);
        setTotal(json.total ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const totalPages = Math.ceil(total / limit) || 1;

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/imdad/platform/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          bedCount: form.bedCount || undefined,
          nameAr: form.nameAr || undefined,
          region: form.region || undefined,
          city: form.city || undefined,
          address: form.address || undefined,
          timezone: form.timezone || undefined,
          currency: form.currency || undefined,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm({ code: '', name: '', nameAr: '', type: 'HOSPITAL', region: '', city: '', address: '', timezone: '', currency: 'SAR', bedCount: 0, isActive: true });
        fetchOrgs();
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleRowClick = (org: Organization) => {
    setSelectedOrg(org);
    setSheetOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('المنظمات', 'Organizations')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة المنظمات والمستشفيات والعيادات', 'Manage organizations, hospitals, and clinics')}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {tr('إضافة منظمة', 'Add Organization')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={tr('بحث بالاسم أو الرمز...', 'Search by name or code...')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 ps-10 pe-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{tr(typeTr[t]?.[0] ?? t, typeTr[t]?.[1] ?? t)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الحالات', 'All Statuses')}</option>
          <option value="active">{tr('نشط', 'Active')}</option>
          <option value="inactive">{tr('غير نشط', 'Inactive')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {[
                tr('الرمز', 'Code'),
                tr('الاسم', 'Name'),
                tr('النوع', 'Type'),
                tr('المنطقة', 'Region'),
                tr('المدينة', 'City'),
                tr('عدد الأسرة', 'Bed Count'),
                tr('العملة', 'Currency'),
                tr('الحالة', 'Status'),
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('لا توجد منظمات', 'No organizations found')}
                </td>
              </tr>
            ) : (
              items.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => handleRowClick(org)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {org.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {language === 'ar' && org.nameAr ? org.nameAr : org.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadge(org.type)}`}>
                      {tr(typeTr[org.type]?.[0] ?? org.type, typeTr[org.type]?.[1] ?? org.type)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {org.region || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {org.city || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {org.bedCount ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {org.currency || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(org.isActive)}`}>
                      {org.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr(
              `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} من ${total}`,
              `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {tr(`${page} من ${totalPages}`, `${page} of ${totalPages}`)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 p-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCreateOpen(false)}>
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setCreateOpen(false)} className="absolute end-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {tr('إضافة منظمة جديدة', 'Add New Organization')}
            </h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('الرمز', 'Code')} *</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('النوع', 'Type')} *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]">
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{tr(typeTr[t]?.[0] ?? t, typeTr[t]?.[1] ?? t)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('الاسم (إنجليزي)', 'Name (English)')} *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('الاسم (عربي)', 'Name (Arabic)')}</label>
                <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('المنطقة', 'Region')}</label>
                  <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('المدينة', 'City')}</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('العنوان', 'Address')}</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('العملة', 'Currency')}</label>
                  <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} maxLength={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('عدد الأسرة', 'Bed Count')}</label>
                  <input type="number" value={form.bedCount} onChange={(e) => setForm({ ...form, bedCount: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('المنطقة الزمنية', 'Timezone')}</label>
                  <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Riyadh" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="org-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 text-[#D4A017] focus:ring-[#D4A017]" />
                <label htmlFor="org-active" className="text-sm text-gray-700 dark:text-gray-300">{tr('نشط', 'Active')}</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {tr('إلغاء', 'Cancel')}
              </button>
              <button onClick={handleCreate} disabled={saving || !form.code || !form.name} className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {sheetOpen && selectedOrg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setSheetOpen(false)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl dark:bg-gray-800"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('تفاصيل المنظمة', 'Organization Details')}
              </h2>
              <button onClick={() => setSheetOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#D4A017]/10 dark:bg-[#C4960C]/20">
                <Building2 className="h-6 w-6 text-[#D4A017] dark:text-[#E8A317]" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {language === 'ar' && selectedOrg.nameAr ? selectedOrg.nameAr : selectedOrg.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOrg.code}</p>
              </div>
            </div>
            <div className="space-y-4">
              {([
                [tr('النوع', 'Type'), tr(typeTr[selectedOrg.type]?.[0] ?? selectedOrg.type, typeTr[selectedOrg.type]?.[1] ?? selectedOrg.type)],
                [tr('الحالة', 'Status'), selectedOrg.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')],
                [tr('المنطقة', 'Region'), selectedOrg.region || '—'],
                [tr('المدينة', 'City'), selectedOrg.city || '—'],
                [tr('العنوان', 'Address'), selectedOrg.address || '—'],
                [tr('العملة', 'Currency'), selectedOrg.currency || '—'],
                [tr('عدد الأسرة', 'Bed Count'), String(selectedOrg.bedCount ?? '—')],
                [tr('المنطقة الزمنية', 'Timezone'), selectedOrg.timezone || '—'],
                [tr('تاريخ الإنشاء', 'Created'), selectedOrg.createdAt ? new Date(selectedOrg.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-gray-100 pb-2 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
