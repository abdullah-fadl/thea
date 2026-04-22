import { Prisma } from '@prisma/client';
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PermissionsMatrix } from '@/components/admin/PermissionsMatrix';
import { Loader2, Plus, Edit, Trash2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { getPermissionsByCategory } from '@/lib/permissions';

interface RoleDefinition {
  key: string;
  label?: string | null;
  labelAr?: string | null;
  permissions: string[];
  source: 'builtin' | 'custom' | 'override';
}

const roleKeyPattern = /^[a-z0-9-_]+$/;

export default function AdminRolesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me, isLoading: meLoading, error: meError } = useMe();
  const isAdmin = me?.user?.role === 'admin' || me?.user?.role === 'thea-owner';

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    key: '',
    label: '',
    labelAr: '',
    permissions: [] as string[],
  });

  const permissionsByCategory = useMemo(() => getPermissionsByCategory(), []);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/roles', { credentials: 'include', cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const fetchedRoles: RoleDefinition[] = data.roles || [];
        // The API already returns merged builtin/custom roles and respects deleted builtins.
        // Avoid re-merging builtin roles client-side, otherwise "deleted" builtins reappear.
        setRoles(fetchedRoles);
      } else {
        throw new Error('Failed to load roles');
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to load roles',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [language, toast]);

  useEffect(() => {
    if (meLoading) return;
    if (meError || !me) {
      router.push('/login?redirect=/admin/roles');
      return;
    }
    if (me.user?.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'Admin access required.',
        variant: 'destructive',
      });
      router.push('/platforms');
      return;
    }
    fetchRoles();
  }, [fetchRoles, me, meError, meLoading, router, toast]);

  function resetForm() {
    setFormData({ key: '', label: '', labelAr: '', permissions: [] });
  }

  function openCreate() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEdit(role: RoleDefinition) {
    setEditingRole(role);
    setFormData({
      key: role.key,
      label: role.label || '',
      labelAr: role.labelAr || '',
      permissions: role.permissions || [],
    });
    setIsEditDialogOpen(true);
  }

  function handlePermissionToggle(permissionKey: string, checked: boolean) {
    setFormData((prev) => {
      if (checked) {
        return { ...prev, permissions: [...prev.permissions, permissionKey] };
      }
      return { ...prev, permissions: prev.permissions.filter((p) => p !== permissionKey) };
    });
  }

  function handleSelectAllCategory(category: string, checked: boolean) {
    const categoryPerms = permissionsByCategory[category] || [];
    const permKeys = categoryPerms.map((p) => p.key);
    setFormData((prev) => {
      if (checked) {
        return { ...prev, permissions: Array.from(new Set([...prev.permissions, ...permKeys])) };
      }
      return { ...prev, permissions: prev.permissions.filter((p) => !permKeys.includes(p)) };
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = formData.key.trim().toLowerCase();
    if (!key) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('مفتاح الدور مطلوب', 'Role key is required.'),
        variant: 'destructive',
      });
      const input = document.getElementById('role-key') as HTMLInputElement | null;
      input?.focus();
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!roleKeyPattern.test(key)) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('مفتاح الدور يجب أن يكون أحرف/أرقام/شرطات فقط', 'Role key must be lowercase letters, numbers, or hyphens.'),
        variant: 'destructive',
      });
      return;
    }
    if (formData.permissions.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('اختر صلاحية واحدة على الأقل', 'Select at least one permission.'),
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key,
          label: formData.label || undefined,
          labelAr: formData.labelAr || undefined,
          permissions: formData.permissions,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({} as Prisma.InputJsonValue));
        const code = typeof data?.code === 'string' ? data.code : '';

        if (code === 'ROLE_KEY_BLOCKED') {
          const blockedKey = typeof data?.key === 'string' ? data.key : key;
          throw new Error(
            tr(`مفتاح الدور غير مسموح: ${blockedKey}`, `Role key is not allowed: ${blockedKey}`)
          );
        }

        if (code === 'VALIDATION_ERROR' && Array.isArray(data?.details) && data.details.length) {
          const details = data.details
            .map((d: any) => {
              const path = Array.isArray(d?.path) ? d.path.join('.') : String(d?.path || '');
              const message = String(d?.message || 'Invalid value');
              return path ? `${path}: ${message}` : message;
            })
            .join('\n');
          throw new Error(details);
        }

        throw new Error(data?.error || 'Failed to create role');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: tr('تم حفظ الدور', 'Role saved'),
      });
      setIsDialogOpen(false);
      resetForm();
      await fetchRoles();
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to create role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;
    if (formData.permissions.length === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('اختر صلاحية واحدة على الأقل', 'Select at least one permission.'),
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${editingRole.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          label: formData.label || undefined,
          labelAr: formData.labelAr || undefined,
          permissions: formData.permissions,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update role');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: tr('تم تحديث الدور', 'Role updated'),
      });
      setIsEditDialogOpen(false);
      setEditingRole(null);
      resetForm();
      await fetchRoles();
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(role: RoleDefinition) {
    if (!isAdmin) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('الحذف متاح لحساب المسؤول فقط', 'Delete is restricted to the super admin.'),
        variant: 'destructive',
      });
      return;
    }
    if (role.key === 'admin') {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('لا يمكن حذف دور admin', 'Cannot delete admin role'),
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(tr('هل تريد حذف هذا الدور؟', 'Delete this role?'))) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${role.key}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete role');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: tr('تم حذف الدور', 'Role deleted'),
      });
      await fetchRoles();
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to delete role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSelectKey(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedKeys(() => {
      if (!checked) return new Set();
      return new Set(roles.filter((role) => role.key !== 'admin').map((role) => role.key));
    });
  }

  async function handleDeleteSelected() {
    if (!isAdmin) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('الحذف متاح لحساب المسؤول فقط', 'Delete is restricted to the super admin.'),
        variant: 'destructive',
      });
      return;
    }
    if (selectedKeys.size === 0) return;
    if (!confirm(tr('هل تريد حذف الأدوار المحددة؟', 'Delete selected roles?'))) return;
    setIsSaving(true);
    try {
      const keys = Array.from(selectedKeys).filter((key) => key !== 'admin');
      if (keys.length === 0) return;
      const results = await Promise.all(
        keys.map((key) =>
          fetch(`/api/admin/roles/${key}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        )
      );
      const failed = results.filter((res) => !res.ok);
      if (failed.length > 0) {
        const data = await failed[0].json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete one or more roles');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: tr('تم حذف الأدوار المحددة', 'Selected roles deleted'),
      });
      setSelectedKeys(new Set());
      await fetchRoles();
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to delete selected roles',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset(role: RoleDefinition) {
    if (!confirm(tr('إعادة الدور للقيم الافتراضية؟', 'Reset role to defaults?'))) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/roles/${role.key}?mode=reset`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reset role');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: tr('تمت إعادة الدور للقيم الافتراضية', 'Role reset to defaults'),
      });
      await fetchRoles();
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : 'Failed to reset role',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              {tr('رجوع', 'Back')}
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{tr('أدوار النظام', 'Roles & Pages')}</h1>
              <p className="text-muted-foreground">
                {tr('إدارة الأدوار والصلاحيات والصفحات لكل دور', 'Manage roles, permissions, and page access')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDeleteSelected}
            disabled={selectedKeys.size === 0 || isSaving || !isAdmin}
            title={
              !isAdmin
                ? tr('الحذف متاح لحساب المسؤول فقط', 'Delete is restricted to the super admin')
                : undefined
            }
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {tr('حذف المحدد', 'Delete Selected')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {tr('إضافة دور', 'Add Role')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('كل الأدوار', 'All Roles')}</CardTitle>
          <CardDescription>
            {tr('تعديل صلاحيات كل دور مع معاينة الصفحات', 'Edit permissions per role with page preview')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={roles.filter((r) => r.key !== 'admin').length > 0 && selectedKeys.size === roles.filter((r) => r.key !== 'admin').length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    aria-label={tr('تحديد الكل', 'Select all')}
                  />
                </TableHead>
                <TableHead>{tr('الدور', 'Role')}</TableHead>
                <TableHead>{tr('المصدر', 'Source')}</TableHead>
                <TableHead>{tr('الصلاحيات', 'Permissions')}</TableHead>
                <TableHead className="text-right">{tr('الإجراءات', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {tr('لا يوجد أدوار', 'No roles found')}
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.key}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(role.key)}
                        onChange={(e) => toggleSelectKey(role.key, e.target.checked)}
                        aria-label={tr('تحديد الدور', 'Select role')}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{tr(role.labelAr || role.label || role.key, role.label || role.key)}</span>
                        <span className="text-xs text-muted-foreground">{role.key}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{role.source}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {(role.permissions || []).length} {tr('صلاحية', 'permissions')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(role)}
                          disabled={isSaving || !isAdmin || role.key === 'admin'}
                          title={
                            !isAdmin
                              ? tr('الحذف متاح لحساب المسؤول فقط', 'Delete is restricted to the super admin')
                              : role.key === 'admin'
                                ? tr('لا يمكن حذف دور admin', 'Cannot delete admin role')
                              : role.source === 'builtin'
                                ? tr('سيتم إعادة الدور للوضع الافتراضي', 'This will reset the role to defaults')
                                : undefined
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {role.source === 'override' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleReset(role)} disabled={isSaving}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
          <form id="create-role-form" onSubmit={handleCreate} className="contents">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>{tr('إضافة دور', 'Create Role')}</DialogTitle>
              <DialogDescription>
                {tr('حدد الاسم والصلاحيات والصفحات لهذا الدور', 'Define role name and permissions')}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-key">
                      {tr('مفتاح الدور', 'Role Key')}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    <Input
                      id="role-key"
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                      placeholder="e.g. nurse, reception-auditor"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-label">{tr('الاسم (EN)', 'Label (EN)')}</Label>
                    <Input
                      id="role-label"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="Reception Auditor"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-label-ar">{tr('الاسم (AR)', 'Label (AR)')}</Label>
                  <Input
                    id="role-label-ar"
                    value={formData.labelAr}
                    onChange={(e) => setFormData({ ...formData, labelAr: e.target.value })}
                    placeholder="مدقق الاستقبال"
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>{tr('الصلاحيات', 'Permissions')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allPerms = Object.values(permissionsByCategory)
                          .flat()
                          .map((p) => p.key);
                        setFormData((prev) => ({ ...prev, permissions: allPerms }));
                      }}
                    >
                      {tr('تحديد الكل', 'Select All')}
                    </Button>
                  </div>

                  <PermissionsMatrix
                    permissionsByCategory={permissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الدور', 'Save Role')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
          <form id="edit-role-form" onSubmit={handleUpdate} className="contents">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
              <DialogTitle>{tr('تعديل الدور', 'Edit Role')}</DialogTitle>
              <DialogDescription>
                {tr('حدث الصلاحيات والصفحات لهذا الدور', 'Update permissions for this role')}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tr('مفتاح الدور', 'Role Key')}</Label>
                    <Input value={formData.key} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr('الاسم (EN)', 'Label (EN)')}</Label>
                    <Input
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      placeholder="Reception Auditor"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tr('الاسم (AR)', 'Label (AR)')}</Label>
                  <Input
                    value={formData.labelAr}
                    onChange={(e) => setFormData({ ...formData, labelAr: e.target.value })}
                    placeholder="مدقق الاستقبال"
                  />
                </div>

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label>{tr('الصلاحيات', 'Permissions')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allPerms = Object.values(permissionsByCategory)
                          .flat()
                          .map((p) => p.key);
                        setFormData((prev) => ({ ...prev, permissions: allPerms }));
                      }}
                    >
                      {tr('تحديد الكل', 'Select All')}
                    </Button>
                  </div>

                  <PermissionsMatrix
                    permissionsByCategory={permissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingRole(null);
                  resetForm();
                }}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? tr('جاري التحديث...', 'Updating...') : tr('تحديث الدور', 'Update Role')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
