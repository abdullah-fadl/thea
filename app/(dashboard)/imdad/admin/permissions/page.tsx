'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';

// ---------------------------------------------------------------------------
// Types (mirrored from server)
// ---------------------------------------------------------------------------

interface PermissionDef {
  nameEn: string;
  nameAr: string;
  description: string;
  module: string;
}

interface RoleTemplate {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  builtIn: boolean;
  permissions: string[];
}

interface ModuleLabel {
  nameEn: string;
  nameAr: string;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PermissionsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // ── State ────────────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<Record<string, PermissionDef>>({});
  const [moduleLabels, setModuleLabels] = useState<Record<string, ModuleLabel>>({});
  const [roles, setRoles] = useState<RoleTemplate[]>([]);
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / search
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create role dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRole, setNewRole] = useState({ key: '', nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '', permissions: [] as string[] });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [permRes, roleRes] = await Promise.all([
        fetch('/api/imdad/admin/permissions', { credentials: 'include' }),
        fetch('/api/imdad/admin/roles', { credentials: 'include' }),
      ]);

      if (!permRes.ok || !roleRes.ok) {
        throw new Error(tr('فشل في تحميل البيانات', 'Failed to load data'));
      }

      const permData = await permRes.json();
      const roleData = await roleRes.json();

      setPermissions(permData.permissions || {});
      setModuleLabels(permData.moduleLabels || {});
      setRoles(roleData.builtInRoles || []);
      setCustomRoles(roleData.customRoles || []);
    } catch (err: any) {
      setError(err.message || tr('حدث خطأ', 'An error occurred'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Derived Data ─────────────────────────────────────────────────────────
  const modules = useMemo(() => {
    const mods = new Set<string>();
    Object.values(permissions).forEach((p) => mods.add(p.module));
    return Array.from(mods).sort();
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    return Object.entries(permissions).filter(([key, perm]) => {
      if (selectedModule !== 'all' && perm.module !== selectedModule) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          key.toLowerCase().includes(q) ||
          perm.nameEn.toLowerCase().includes(q) ||
          perm.nameAr.includes(q)
        );
      }
      return true;
    });
  }, [permissions, selectedModule, searchQuery]);

  const allRoles = useMemo(() => {
    const builtIn = roles.map((r) => ({ ...r, source: 'built-in' as const }));
    const custom = customRoles.map((r: any) => ({
      key: r.key,
      nameEn: r.nameEn || r.key,
      nameAr: r.nameAr || r.key,
      descriptionEn: r.descriptionEn || '',
      descriptionAr: r.descriptionAr || '',
      builtIn: false,
      permissions: r.permissions || [],
      source: 'custom' as const,
    }));
    return [...builtIn, ...custom];
  }, [roles, customRoles]);

  // ── Create Role ──────────────────────────────────────────────────────────
  const handleCreateRole = async () => {
    if (!newRole.key || !newRole.nameEn || !newRole.nameAr || newRole.permissions.length === 0) {
      setToast({ type: 'error', message: tr('يرجى تعبئة جميع الحقول المطلوبة واختيار صلاحية واحدة على الأقل', 'Please fill all required fields and select at least one permission') });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/imdad/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newRole),
      });

      if (res.ok) {
        setToast({ type: 'success', message: tr('تم إنشاء الدور بنجاح', 'Role created successfully') });
        setShowCreateDialog(false);
        setNewRole({ key: '', nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '', permissions: [] });
        fetchData();
      } else {
        const errData = await res.json();
        setToast({ type: 'error', message: errData.error || tr('فشل في إنشاء الدور', 'Failed to create role') });
      }
    } catch {
      setToast({ type: 'error', message: tr('حدث خطأ أثناء الإنشاء', 'An error occurred while creating') });
    }
    setCreating(false);
  };

  const togglePermission = (permKey: string) => {
    setNewRole((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter((p) => p !== permKey)
        : [...prev.permissions, permKey],
    }));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6">
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          {tr('جارٍ التحميل...', 'Loading...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-6">
        <div className="bg-[#8B4513]/5 dark:bg-[#8B4513]/15 border border-[#8B4513]/30 dark:border-[#8B4513] rounded-lg p-4 text-[#8B4513] dark:text-[#A0522D]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 ${language === 'ar' ? 'left-4' : 'right-4'} z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-[#6B8E23]/10 text-[#556B2F] dark:bg-[#556B2F]/20 dark:text-[#9CB86B]'
              : 'bg-[#8B4513]/10 text-[#8B4513] dark:bg-[#8B4513]/20 dark:text-[#A0522D]'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr('مصفوفة الصلاحيات', 'Permissions Matrix')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tr(
              `${Object.keys(permissions).length} صلاحية في ${modules.length} وحدة — ${allRoles.length} دور`,
              `${Object.keys(permissions).length} permissions across ${modules.length} modules — ${allRoles.length} roles`
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-[#D4A017] text-white rounded-lg text-sm font-medium hover:bg-[#C4960C] transition-colors"
        >
          {tr('إنشاء دور مخصص', 'Create Custom Role')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={tr('بحث عن صلاحية...', 'Search permissions...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="all">{tr('جميع الوحدات', 'All Modules')}</option>
          {modules.map((mod) => (
            <option key={mod} value={mod}>
              {language === 'ar'
                ? moduleLabels[mod]?.nameAr || mod
                : moduleLabels[mod]?.nameEn || mod}
            </option>
          ))}
        </select>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {allRoles.map((role) => (
          <div
            key={role.key}
            className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4 space-y-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                {language === 'ar' ? role.nameAr : role.nameEn}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  role.builtIn
                    ? 'bg-[#D4A017]/10 text-[#D4A017] dark:bg-[#C4960C]/20 dark:text-[#E8A317]'
                    : 'bg-[#556B2F]/10 text-[#556B2F] dark:bg-[#4A5D23]/20 dark:text-[#9CB86B]'
                }`}
              >
                {role.builtIn ? tr('مدمج', 'Built-in') : tr('مخصص', 'Custom')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {language === 'ar' ? role.descriptionAr : role.descriptionEn}
            </p>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {tr(`${role.permissions.length} صلاحية`, `${role.permissions.length} permissions`)}
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-start px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800 min-w-[250px] z-10">
                  {tr('الصلاحية', 'Permission')}
                </th>
                <th className="text-start px-3 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[100px]">
                  {tr('الوحدة', 'Module')}
                </th>
                {allRoles.map((role) => (
                  <th
                    key={role.key}
                    className="text-center px-2 py-3 font-semibold text-gray-700 dark:text-gray-300 min-w-[90px]"
                    title={language === 'ar' ? role.nameAr : role.nameEn}
                  >
                    <div className="text-xs leading-tight truncate max-w-[80px] mx-auto">
                      {language === 'ar' ? role.nameAr : role.nameEn}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.map(([key, perm], idx) => (
                <tr
                  key={key}
                  className={`border-b dark:border-gray-800 ${
                    idx % 2 === 0
                      ? 'bg-white dark:bg-gray-900'
                      : 'bg-gray-50/50 dark:bg-gray-800/30'
                  }`}
                >
                  <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
                    <div className="font-medium text-gray-900 dark:text-white text-xs">
                      {language === 'ar' ? perm.nameAr : perm.nameEn}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                      {key}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {language === 'ar'
                        ? moduleLabels[perm.module]?.nameAr || perm.module
                        : moduleLabels[perm.module]?.nameEn || perm.module}
                    </span>
                  </td>
                  {allRoles.map((role) => {
                    const has = role.permissions.includes(key);
                    return (
                      <td key={role.key} className="text-center px-2 py-2.5">
                        {has ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#6B8E23]/10 dark:bg-[#556B2F]/30">
                            <svg
                              className="w-3 h-3 text-[#6B8E23] dark:text-[#9CB86B]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-800">
                            <span className="w-2 h-0.5 bg-gray-300 dark:bg-gray-600 rounded" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPermissions.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {tr('لا توجد صلاحيات مطابقة للبحث', 'No permissions match your search')}
          </div>
        )}
      </div>

      {/* Create Role Dialog (Modal) */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr('إنشاء دور مخصص', 'Create Custom Role')}
              </h2>
              <button
                onClick={() => setShowCreateDialog(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {tr('مفتاح الدور *', 'Role Key *')}
                </label>
                <input
                  type="text"
                  value={newRole.key}
                  onChange={(e) =>
                    setNewRole((prev) => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                  }
                  placeholder="imdad-custom-role"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white font-mono"
                />
              </div>

              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr('الاسم بالإنجليزية *', 'English Name *')}
                  </label>
                  <input
                    type="text"
                    value={newRole.nameEn}
                    onChange={(e) => setNewRole((prev) => ({ ...prev, nameEn: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr('الاسم بالعربية *', 'Arabic Name *')}
                  </label>
                  <input
                    type="text"
                    value={newRole.nameAr}
                    onChange={(e) => setNewRole((prev) => ({ ...prev, nameAr: e.target.value }))}
                    dir="rtl"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr('الوصف بالإنجليزية', 'English Description')}
                  </label>
                  <input
                    type="text"
                    value={newRole.descriptionEn}
                    onChange={(e) => setNewRole((prev) => ({ ...prev, descriptionEn: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr('الوصف بالعربية', 'Arabic Description')}
                  </label>
                  <input
                    type="text"
                    value={newRole.descriptionAr}
                    onChange={(e) => setNewRole((prev) => ({ ...prev, descriptionAr: e.target.value }))}
                    dir="rtl"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Permission Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tr('الصلاحيات *', 'Permissions *')}
                  </label>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {tr(`${newRole.permissions.length} محددة`, `${newRole.permissions.length} selected`)}
                  </span>
                </div>

                <div className="border dark:border-gray-700 rounded-lg max-h-[300px] overflow-y-auto">
                  {modules.map((mod) => {
                    const modPerms = Object.entries(permissions).filter(
                      ([, p]) => p.module === mod
                    );
                    const allChecked = modPerms.every(([k]) =>
                      newRole.permissions.includes(k)
                    );

                    return (
                      <div key={mod} className="border-b dark:border-gray-700 last:border-b-0">
                        {/* Module header */}
                        <button
                          type="button"
                          onClick={() => {
                            const modKeys = modPerms.map(([k]) => k);
                            if (allChecked) {
                              setNewRole((prev) => ({
                                ...prev,
                                permissions: prev.permissions.filter((p) => !modKeys.includes(p)),
                              }));
                            } else {
                              setNewRole((prev) => ({
                                ...prev,
                                permissions: [
                                  ...new Set([...prev.permissions, ...modKeys]),
                                ],
                              }));
                            }
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={allChecked}
                            readOnly
                            className="rounded border-gray-300 text-[#D4A017]"
                          />
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {language === 'ar'
                              ? moduleLabels[mod]?.nameAr || mod
                              : moduleLabels[mod]?.nameEn || mod}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            ({modPerms.length})
                          </span>
                        </button>

                        {/* Permission checkboxes */}
                        <div className="px-4 py-1">
                          {modPerms.map(([key, perm]) => (
                            <label
                              key={key}
                              className="flex items-center gap-2 py-1 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={newRole.permissions.includes(key)}
                                onChange={() => togglePermission(key)}
                                className="rounded border-gray-300 text-[#D4A017]"
                              />
                              <span className="text-xs text-gray-700 dark:text-gray-300">
                                {language === 'ar' ? perm.nameAr : perm.nameEn}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                {key}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleCreateRole}
                disabled={creating}
                className="px-4 py-2 bg-[#D4A017] text-white rounded-lg text-sm font-medium hover:bg-[#C4960C] disabled:opacity-50 transition-colors"
              >
                {creating
                  ? tr('جارٍ الإنشاء...', 'Creating...')
                  : tr('إنشاء الدور', 'Create Role')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
