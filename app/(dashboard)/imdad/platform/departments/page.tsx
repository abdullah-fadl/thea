'use client';

import { useLang } from '@/hooks/use-lang';
import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, X, Building, Pencil, Trash2 } from 'lucide-react';

interface Organization {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  type?: string;
  organizationId: string;
  parentId?: string;
  costCenterId?: string;
  isActive: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: { departmentUsers: number };
}

interface DeptResponse {
  items: Department[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEPT_TYPE_OPTIONS = ['CLINICAL', 'SUPPORT', 'ADMINISTRATIVE', 'PHARMACY', 'LAB', 'RADIOLOGY'] as const;

function statusBadge(isActive: boolean) {
  return isActive
    ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

function deptTypeBadge(type: string) {
  const map: Record<string, string> = {
    CLINICAL: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
    SUPPORT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    ADMINISTRATIVE: 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]',
    PHARMACY: 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]',
    LAB: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
    RADIOLOGY: 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]',
  };
  return map[type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
}

export default function DepartmentsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [items, setItems] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '', name: '', nameAr: '', type: '' as string,
    organizationId: '', costCenterId: '', isActive: true,
  });

  const deptTypeTr: Record<string, [string, string]> = {
    CLINICAL: ['سريري', 'Clinical'],
    SUPPORT: ['دعم', 'Support'],
    ADMINISTRATIVE: ['إداري', 'Administrative'],
    PHARMACY: ['صيدلية', 'Pharmacy'],
    LAB: ['مختبر', 'Lab'],
    RADIOLOGY: ['أشعة', 'Radiology'],
  };

  // Fetch organizations for the filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/imdad/platform/organizations?limit=100');
        if (res.ok) {
          const json = await res.json();
          setOrgs(json.items ?? []);
        }
      } catch { /* silent */ }
    })();
  }, []);

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (orgFilter) params.set('organizationId', orgFilter);
      if (statusFilter) params.set('isActive', statusFilter === 'active' ? 'true' : 'false');

      const res = await fetch(`/api/imdad/platform/departments?${params}`);
      if (res.ok) {
        const json: DeptResponse = await res.json();
        setItems(json.items ?? []);
        setTotal(json.total ?? 0);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [page, search, orgFilter, statusFilter]);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const totalPages = Math.ceil(total / limit) || 1;

  const orgNameById = (id: string) => {
    const org = orgs.find((o) => o.id === id);
    if (!org) return id.slice(0, 8) + '...';
    return language === 'ar' && org.nameAr ? org.nameAr : org.name;
  };

  const openCreate = () => {
    setEditDept(null);
    setForm({ code: '', name: '', nameAr: '', type: '', organizationId: orgs[0]?.id ?? '', costCenterId: '', isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditDept(dept);
    setForm({
      code: dept.code,
      name: dept.name,
      nameAr: dept.nameAr || '',
      type: dept.type || '',
      organizationId: dept.organizationId,
      costCenterId: dept.costCenterId || '',
      isActive: dept.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editDept) {
        // PUT update
        const res = await fetch(`/api/imdad/platform/departments/${editDept.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: editDept.version,
            code: form.code,
            name: form.name,
            nameAr: form.nameAr || null,
            type: form.type || null,
            costCenterId: form.costCenterId || null,
            isActive: form.isActive,
          }),
        });
        if (res.ok) { setDialogOpen(false); fetchDepts(); }
      } else {
        // POST create
        const res = await fetch('/api/imdad/platform/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: form.organizationId,
            code: form.code,
            name: form.name,
            nameAr: form.nameAr || undefined,
            type: form.type || undefined,
            costCenterId: form.costCenterId || undefined,
            isActive: form.isActive,
          }),
        });
        if (res.ok) { setDialogOpen(false); fetchDepts(); }
      }
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(tr('هل أنت متأكد من حذف هذا القسم؟', 'Are you sure you want to delete this department?'))) return;
    setDeleting(dept.id);
    try {
      const res = await fetch(`/api/imdad/platform/departments/${dept.id}`, { method: 'DELETE' });
      if (res.ok) fetchDepts();
    } catch { /* silent */ } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('الأقسام', 'Departments')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr('إدارة الأقسام التنظيمية لمنصة إمداد', 'Manage organizational departments for IMDAD')}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#D4A017] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#C4960C] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {tr('إضافة قسم', 'Add Department')}
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
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع المنظمات', 'All Organizations')}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{language === 'ar' && o.nameAr ? o.nameAr : o.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{tr('جميع الأنواع', 'All Types')}</option>
          {DEPT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{tr(deptTypeTr[t]?.[0] ?? t, deptTypeTr[t]?.[1] ?? t)}</option>
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
                tr('المنظمة', 'Organization'),
                tr('عدد المستخدمين', 'Staff Count'),
                tr('الحالة', 'Status'),
                tr('الإجراءات', 'Actions'),
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
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {tr('لا توجد أقسام', 'No departments found')}
                </td>
              </tr>
            ) : (
              items.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {dept.code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {language === 'ar' && dept.nameAr ? dept.nameAr : dept.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {dept.type ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${deptTypeBadge(dept.type)}`}>
                        {tr(deptTypeTr[dept.type]?.[0] ?? dept.type, deptTypeTr[dept.type]?.[1] ?? dept.type)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {orgNameById(dept.organizationId)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {dept._count?.departmentUsers ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(dept.isActive)}`}>
                      {dept.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(dept)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#D4A017] dark:hover:bg-gray-700 dark:hover:text-[#E8A317]"
                        title={tr('تعديل', 'Edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        disabled={deleting === dept.id}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#8B4513] disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-[#A0522D]"
                        title={tr('حذف', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

      {/* Create / Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setDialogOpen(false)} className="absolute end-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editDept ? tr('تعديل القسم', 'Edit Department') : tr('إضافة قسم جديد', 'Add New Department')}
            </h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {!editDept && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('المنظمة', 'Organization')} *</label>
                  <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]">
                    <option value="">{tr('اختر المنظمة', 'Select Organization')}</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{language === 'ar' && o.nameAr ? o.nameAr : o.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('الرمز', 'Code')} *</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('النوع', 'Type')}</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]">
                    <option value="">{tr('بدون تحديد', 'None')}</option>
                    {DEPT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{tr(deptTypeTr[t]?.[0] ?? t, deptTypeTr[t]?.[1] ?? t)}</option>)}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('مركز التكلفة', 'Cost Center')}</label>
                <input value={form.costCenterId} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })} placeholder={tr('معرف مركز التكلفة (UUID)', 'Cost Center ID (UUID)')} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="dept-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 text-[#D4A017] focus:ring-[#D4A017]" />
                <label htmlFor="dept-active" className="text-sm text-gray-700 dark:text-gray-300">{tr('نشط', 'Active')}</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.name || (!editDept && !form.organizationId)}
                className="rounded-lg bg-[#D4A017] px-4 py-2 text-sm font-medium text-white hover:bg-[#C4960C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? tr('جاري الحفظ...', 'Saving...') : editDept ? tr('تحديث', 'Update') : tr('إنشاء', 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
