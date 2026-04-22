'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PermissionsMatrix } from '@/components/admin/PermissionsMatrix';
import { Plus, Edit, Trash2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPermissionsByCategory, getDefaultPermissionsForRole, getMergedPermissions, Permission } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { useMe } from '@/lib/hooks/useMe';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  staffId?: string;
  employeeNo?: string;
  permissions?: string[];
  isActive: boolean;
  groupId?: string;
  hospitalId?: string;
}

interface RoleDefinition {
  key: string;
  label?: string | null;
  labelAr?: string | null;
  permissions: string[];
  source: 'builtin' | 'custom' | 'override';
}


export default function Users() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const isMobile = useIsMobile();

  const DEPARTMENT_OPTIONS = [
    { key: 'laboratory', label: 'Laboratory', labelAr: '\u0645\u062e\u062a\u0628\u0631' },
    { key: 'radiology', label: 'Radiology', labelAr: '\u0623\u0634\u0639\u0629' },
    { key: 'operating-room', label: 'Procedures', labelAr: '\u0625\u062c\u0631\u0627\u0621\u0627\u062a' },
    { key: 'pharmacy', label: 'Pharmacy', labelAr: '\u0635\u064a\u062f\u0644\u064a\u0629' },
  ];

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'admin',
    department: '',
    departments: [] as string[],
    staffId: '',
    permissions: [] as string[],
  });
  const [originalPermissions, setOriginalPermissions] = useState<string[]>([]);
  const [staffIdError, setStaffIdError] = useState<string | null>(null);
  const [staffIdChecking, setStaffIdChecking] = useState(false);
  const [staffIdProvider, setStaffIdProvider] = useState<{ displayName?: string; email?: string; staffId?: string; employmentType?: string } | null>(null);

  const { platform: platformData } = usePlatform();
  const { me } = useMe();
  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health'
    ? platformData.platform
    : null;

  const myPermissions = me?.user?.permissions ?? [];
  const canEditUsers = myPermissions.includes('admin.users.edit');
  const canChangePassword = myPermissions.includes('admin.users.changePassword');
  const canCreateUsers = myPermissions.includes('admin.users.create');
  const canDeleteUsers = myPermissions.includes('admin.users.delete');

  const [changePasswordUser, setChangePasswordUser] = useState<User | null>(null);
  const [changePasswordValue, setChangePasswordValue] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Filter permissions by platform
  const getFilteredPermissionsByCategory = () => {
    const allPermissionsByCategory = getPermissionsByCategory();

    if (!platform) {
      // If no platform selected, show all permissions
      return allPermissionsByCategory;
    }

    // Define platform-specific permission categories
    const SAM_CATEGORIES = ['Document System', 'Account', 'Admin'];
    const HEALTH_CATEGORIES = ['Dashboard', 'Notifications', 'Hospital Core', 'OPD', 'Scheduling', 'ER', 'Patient Experience', 'IPD', 'Billing', 'Patients', 'Equipment (OPD)', 'Equipment (IPD)', 'Manpower & Nursing', 'Account', 'Admin'];

    const targetCategories = platform === 'sam' ? SAM_CATEGORIES : HEALTH_CATEGORIES;

    const filtered: Record<string, Permission[]> = {};
    Object.entries(allPermissionsByCategory).forEach(([category, permissions]) => {
      if (targetCategories.includes(category)) {
        filtered[category] = permissions;
      }
    });

    return filtered;
  };

  // Filter permissions by platform (recalculate when platform changes)
  const permissionsByCategory = useMemo(() => getFilteredPermissionsByCategory(), [platform]);

  // Password strength checks
  const pwChecks = useMemo(() => {
    const pw = formData.password || '';
    return [
      { ok: pw.length >= 12, en: '12+ characters', ar: '12+ حرف' },
      { ok: /[A-Z]/.test(pw), en: 'Uppercase letter', ar: 'حرف كبير' },
      { ok: /[a-z]/.test(pw), en: 'Lowercase letter', ar: 'حرف صغير' },
      { ok: /[0-9]/.test(pw), en: 'Number', ar: 'رقم' },
      { ok: /[!@#$%^&*(),.?":{}|<>]/.test(pw), en: 'Special character', ar: 'رمز خاص' },
    ];
  }, [formData.password]);
  const rolePermissionsByKey = useMemo(() => {
    return new Map(roleDefinitions.map((role) => [role.key, role.permissions || []]));
  }, [roleDefinitions]);
  const roleOptions = useMemo(() => {
    // Roles are sourced from /api/admin/roles (builtin + custom). Avoid client-side re-adding builtins.
    if (roleDefinitions.length > 0) return roleDefinitions;
    // Minimal fallback to keep UI usable if the fetch fails.
    return [
      {
        key: 'admin',
        permissions: getDefaultPermissionsForRole('admin'),
        source: 'builtin' as const,
        label: null,
        labelAr: null,
      },
    ];
  }, [roleDefinitions]);
  const getRolePermissions = useMemo(
    () => (roleKey: string) => rolePermissionsByKey.get(roleKey) || getDefaultPermissionsForRole(roleKey),
    [rolePermissionsByKey]
  );
  const visiblePermissionsByCategory = useMemo(() => {
    if (!formData.role) return permissionsByCategory;
    if (formData.role === 'admin') {
      return permissionsByCategory;
    }
    const allowedKeys = new Set([
          ...getRolePermissions(formData.role),
      ...(formData.permissions || []),
    ]);
    const filtered: Record<string, Permission[]> = {};
    Object.entries(permissionsByCategory).forEach(([category, permissions]) => {
      const scoped = permissions.filter((permission) => allowedKeys.has(permission.key));
      if (scoped.length) filtered[category] = scoped;
    });
    return filtered;
  }, [permissionsByCategory, formData.role, formData.permissions, getRolePermissions]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.email.toLowerCase().includes(query) ||
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query)) ||
      (user.staffId && user.staffId.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Update permissions when role changes (filter by platform)
  useEffect(() => {
    if (formData.role) {
      const defaultPerms = getRolePermissions(formData.role);
      // Filter default permissions to only include those available in current platform
      const platformPermKeys = Object.values(permissionsByCategory).flat().map(p => p.key);
      const filteredPerms = defaultPerms.filter(p => platformPermKeys.includes(p));
      setFormData(prev => ({ ...prev, permissions: filteredPerms }));
    }
  }, [formData.role, platform, getRolePermissions]);

  useEffect(() => {
    const staffId = String(formData.staffId || '').trim();
    const role = String(formData.role || '');
    if (!staffId || !role.toLowerCase().includes('doctor')) {
      setStaffIdError(null);
      setStaffIdProvider(null);
      return;
    }
    let active = true;
    setStaffIdChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/validate-staff-id?staffId=${encodeURIComponent(staffId)}`, { credentials: 'include' });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setStaffIdError(payload?.error || 'Unable to validate Staff ID');
          setStaffIdProvider(null);
        } else if (!payload.providerFound) {
          setStaffIdError('Staff ID not found in providers');
          setStaffIdProvider(null);
        } else if (payload.alreadyAssigned) {
          setStaffIdError(`Already assigned to ${payload.assignedTo || 'another user'}`);
          setStaffIdProvider(null);
        } else {
          setStaffIdError(null);
          const provider = payload.provider || (payload.providerName ? { displayName: payload.providerName } : null);
          setStaffIdProvider(provider);
          if (provider?.displayName || provider?.email) {
            setFormData((prev) => {
              const updates: Partial<typeof prev> = {};
              if (provider.email) updates.email = provider.email;
              if (provider.displayName) {
                const parts = String(provider.displayName).trim().split(/\s+/);
                updates.firstName = parts[0] || prev.firstName;
                updates.lastName = parts.length > 1 ? parts.slice(1).join(' ') : prev.lastName;
              }
              return { ...prev, ...updates };
            });
          }
        }
      } catch {
        if (active) {
          setStaffIdError('Unable to validate Staff ID');
          setStaffIdProvider(null);
        }
      } finally {
        if (active) setStaffIdChecking(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
      setStaffIdChecking(false);
    };
  }, [formData.staffId, formData.role]);

  function handlePermissionToggle(permissionKey: string, checked: boolean) {
    setFormData(prev => {
      if (checked) {
        return { ...prev, permissions: [...prev.permissions, permissionKey] };
      } else {
        return { ...prev, permissions: prev.permissions.filter(p => p !== permissionKey) };
      }
    });
  }

  function handleSelectAllCategory(category: string, checked: boolean) {
    const categoryPerms = visiblePermissionsByCategory[category] || [];
    const permKeys = categoryPerms.map(p => p.key);

    setFormData(prev => {
      if (checked) {
        // Add all category permissions
        const newPerms = Array.from(new Set([...prev.permissions, ...permKeys]));
        return { ...prev, permissions: newPerms };
      } else {
        // Remove all category permissions
        return { ...prev, permissions: prev.permissions.filter(p => !permKeys.includes(p)) };
      }
    });
  }

  useEffect(() => {
    fetchUsers();
    fetchRoleDefinitions();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }

  async function fetchRoleDefinitions() {
    try {
      const response = await fetch('/api/admin/roles', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRoleDefinitions(data.roles || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, departments: formData.departments }),
      });

      if (response.ok) {
        toast({
          title: tr('نجح', 'Success'),
          description: tr('تم إنشاء المستخدم بنجاح', 'User created successfully'),
        });
        setIsDialogOpen(false);
        await fetchUsers();
        // Reset form
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'admin',
          department: '',
          departments: [],
          staffId: '',
          permissions: getRolePermissions('admin'),
        });
      } else {
        const data = await response.json();
        // Show detailed validation errors
        let errorMsg = data.error || (language === 'ar' ? 'فشل إنشاء المستخدم' : 'Failed to create user');
        if (data.details && Array.isArray(data.details)) {
          const details = data.details.map((d: any) => `${d.path}: ${d.message}`).join('\n');
          errorMsg = details || errorMsg;
        }
        throw new Error(errorMsg);
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(tr('هل أنت متأكد من حذف هذا المستخدم؟', 'Are you sure you want to delete this user?'))) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: tr('نجح', 'Success'),
          description: tr('تم حذف المستخدم بنجاح', 'User deleted successfully'),
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || (language === 'ar' ? 'فشل حذف المستخدم' : 'Failed to delete user'));
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : (language === 'ar' ? 'فشل حذف المستخدم' : 'Failed to delete user'),
        variant: 'destructive',
      });
    }
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    const roleKey = String(user.role || '').toLowerCase();
    const userPerms = user.permissions?.length ? user.permissions : getRolePermissions(roleKey);
    setOriginalPermissions(userPerms);
    // Parse departments from the stored department string
    const depts = (user.department || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    const validDepts = depts.filter((d) => DEPARTMENT_OPTIONS.some((opt) => opt.key === d));
    setFormData({
      email: user.email,
      password: '', // Don't pre-fill password
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department || '',
      departments: validDepts,
      staffId: user.staffId || '',
      permissions: userPerms,
    });
    setIsEditDialogOpen(true);
  }

  function openChangePassword(user: User) {
    setChangePasswordUser(user);
    setChangePasswordValue('');
    setIsChangePasswordOpen(true);
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!changePasswordUser || !changePasswordValue.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${changePasswordUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: changePasswordValue }),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Failed to update password');
      }
      toast({
        title: tr('نجح', 'Success'),
        description: language === 'ar' ? 'تم تغيير الرمز بنجاح' : 'Password updated successfully',
      });
      setIsChangePasswordOpen(false);
      setChangePasswordUser(null);
      setChangePasswordValue('');
    } catch (err) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err instanceof Error ? err.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setIsLoading(true);

    try {
      // Preserve permissions that aren't visible in the UI (not in PERMISSIONS array)
      const mergedPermissions = getMergedPermissions(
        formData.permissions,
        originalPermissions,
        permissionsByCategory,
      );

      const updateData: any = {
        permissions: mergedPermissions,
        staffId: formData.staffId || undefined,
        department: formData.departments.join(', ') || undefined,
        departments: formData.departments,
      };

      // Only include password if provided
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: tr('نجح', 'Success'),
          description: tr('تم تحديث المستخدم بنجاح', 'User updated successfully'),
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
        await fetchUsers();
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'admin',
          department: '',
          departments: [],
          staffId: '',
          permissions: getRolePermissions('admin'),
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || (language === 'ar' ? 'فشل تحديث المستخدم' : 'Failed to update user'));
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleCreateUser() {
    setEditingUser(null);
    setIsEditDialogOpen(false);
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'admin',
      department: '',
      departments: [],
      staffId: '',
      permissions: getRolePermissions('admin'),
    });
    setOriginalPermissions([]);
    setIsDialogOpen(true);
  }

  // Convert users to card format for mobile
  const cardItems = filteredUsers.map((user) => ({
    id: user.id,
    title: `${user.firstName} ${user.lastName}`,
    subtitle: user.email,
    description: user.department || '-',
    badges: [
      {
        label: user.role,
        variant: (user.role === 'admin' ? 'default' : 'secondary') as 'default' | 'secondary',
      },
      {
        label: user.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive'),
        variant: (user.isActive ? 'default' : 'outline') as 'default' | 'outline',
      },
    ],
    metadata: [
      { label: tr('القسم', 'Department'), value: user.department || '-' },
      { label: tr('الرقم الوظيفي', 'Staff ID'), value: user.staffId || '-' },
      {
        label: tr('الصلاحيات', 'Permissions'),
        value: ['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase())
          ? (language === 'ar' ? 'جميع الصلاحيات' : 'All')
          : `${user.permissions?.length || 0} ${language === 'ar' ? 'صلاحية' : 'permissions'}`,
      },
    ],
    actions: [
      ...(canEditUsers
        ? [{
            label: tr('تعديل', 'Edit'),
            onClick: () => handleEdit(user),
            icon: <Edit className="h-4 w-4" />,
            variant: 'outline' as const,
          }]
        : []),
      ...(canChangePassword
        ? [{
            label: language === 'ar' ? 'تغيير الرمز' : 'Change password',
            onClick: () => openChangePassword(user),
            icon: <KeyRound className="h-4 w-4" />,
            variant: 'outline' as const,
          }]
        : []),
      ...(canDeleteUsers && !['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase())
        ? [{
            label: tr('حذف', 'Delete'),
            onClick: () => handleDelete(user.id),
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'destructive' as const,
          }]
        : []),
    ],
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{tr('إدارة المستخدمين', 'User Management')}</h1>
          <p className="text-muted-foreground">{tr('إدارة المستخدمين والأدوار', 'Manage users and roles')}</p>
        </div>
        {canCreateUsers && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl" onClick={handleCreateUser}>
              <Plus className="mr-2 h-4 w-4" />
              {tr('إضافة مستخدم', 'Add User')}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border relative z-10 bg-card">
              <DialogTitle>{tr('إنشاء مستخدم', 'Create User')}</DialogTitle>
              <DialogDescription>
                {tr('إضافة مستخدم جديد للنظام', 'Add a new user to the system')}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم الأول', 'First Name')}</span>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                    className="h-11 rounded-xl thea-input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('اسم العائلة', 'Last Name')}</span>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                    className="h-11 rounded-xl thea-input-focus"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="h-11 rounded-xl thea-input-focus"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور', 'Password')}</span>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="h-11 rounded-xl thea-input-focus"
                />
                {formData.password && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {pwChecks.map((c, i) => (
                      <span key={i} className={`text-xs flex items-center gap-1 ${c.ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {c.ok ? '✓' : '○'} {language === 'ar' ? c.ar : c.en}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</span>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    setFormData({ ...formData, role: value });
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {roleOptions.map((role) => {
                      const label =
                        language === 'ar'
                          ? role.labelAr || role.label || role.key
                          : role.label || role.key;
                      return (
                        <SelectItem key={role.key} value={role.key}>
                          {label}
                        </SelectItem>
                      );
                    })}
                    {/* owner roles are NOT exposed in admin UI */}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_OPTIONS.map((dept) => {
                    const checked = formData.departments.includes(dept.key);
                    return (
                      <label
                        key={dept.key}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer thea-transition-fast text-sm ${
                          checked
                            ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const newDepts = e.target.checked
                              ? [...formData.departments, dept.key]
                              : formData.departments.filter((d) => d !== dept.key);
                            setFormData({ ...formData, departments: newDepts, department: newDepts.join(', ') });
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        {language === 'ar' ? dept.labelAr : dept.label}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'اختر الأقسام التي يعمل فيها الموظف' : 'Select departments this user works in'}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرقم الوظيفي', 'Staff ID')}</span>
                <Input
                  id="staffId"
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData({ ...formData, staffId: e.target.value })
                  }
                  placeholder={tr('الرقم الوظيفي (اختياري)', 'Enter staff ID')}
                  className="rounded-xl thea-input-focus"
                />
                {staffIdChecking ? (
                  <div className="text-xs text-muted-foreground">Checking staff ID...</div>
                ) : staffIdError ? (
                  <div className="text-xs text-destructive">{staffIdError}</div>
                ) : staffIdProvider ? (
                  <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                    <span className="font-medium">{staffIdProvider.displayName || '—'}</span>
                    {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).length > 0 && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصلاحيات', 'Permissions')}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      // Select all permissions for current platform only
                      const allPlatformPermissions = Object.values(visiblePermissionsByCategory)
                        .flat()
                        .map(p => p.key);
                      setFormData(prev => ({
                        ...prev,
                        permissions: allPlatformPermissions,
                      }));
                    }}
                  >
                    {tr('تحديد الكل', 'Select All')}
                  </Button>
                </div>

                <PermissionsMatrix
                  permissionsByCategory={visiblePermissionsByCategory}
                  selectedPermissions={formData.permissions}
                  language={language}
                  onTogglePermission={handlePermissionToggle}
                  onToggleCategory={handleSelectAllCategory}
                />
              </div>
            </form>
            </div>
            <DialogFooter className="flex-shrink-0 border-t border-border px-6 py-4 relative z-10 bg-card">
              <Button type="submit" form="create-user-form" disabled={isLoading} className="rounded-xl">
                {isLoading ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء مستخدم', 'Create User')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
          <div className="pb-3">
            <h2 className="text-lg font-semibold text-foreground">{tr('إدارة المستخدمين', 'User Management')}</h2>
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? `إجمالي ${users.length} مستخدم`
                : `Total ${users.length} users`}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateUser} className="w-full min-h-[44px] rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                {tr('إضافة مستخدم', 'Add User')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-[95vw] max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
              <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border relative z-10 bg-card">
                <DialogTitle className="text-lg">{tr('إنشاء مستخدم', 'Create User')}</DialogTitle>
                <DialogDescription className="text-sm">
                  {tr('إضافة مستخدم جديد للنظام', 'Add a new user to the system')}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto overflow-x-hidden px-4" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم الأول', 'First Name')}</span>
                    <Input
                      id="mobile-firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                      className="h-11 w-full rounded-xl thea-input-focus"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('اسم العائلة', 'Last Name')}</span>
                    <Input
                      id="mobile-lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                      className="h-11 w-full rounded-xl thea-input-focus"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
                  <Input
                    id="mobile-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    className="h-11 w-full rounded-xl thea-input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور', 'Password')}</span>
                  <Input
                    id="mobile-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    className="h-11 w-full rounded-xl thea-input-focus"
                  />
                  {formData.password && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                      {pwChecks.map((c, i) => (
                        <span key={i} className={`text-xs flex items-center gap-1 ${c.ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {c.ok ? '✓' : '○'} {language === 'ar' ? c.ar : c.en}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</span>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => {
                      setFormData({ ...formData, role: value });
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {roleOptions.map((role) => {
                        const label =
                          language === 'ar'
                            ? role.labelAr || role.label || role.key
                            : role.label || role.key;
                        return (
                          <SelectItem key={role.key} value={role.key}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENT_OPTIONS.map((dept) => {
                      const checked = formData.departments.includes(dept.key);
                      return (
                        <label
                          key={dept.key}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer thea-transition-fast text-sm ${
                            checked
                              ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const newDepts = e.target.checked
                                ? [...formData.departments, dept.key]
                                : formData.departments.filter((d) => d !== dept.key);
                              setFormData({ ...formData, departments: newDepts, department: newDepts.join(', ') });
                            }}
                            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                          />
                          {language === 'ar' ? dept.labelAr : dept.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرقم الوظيفي', 'Staff ID')}</span>
                  <Input
                    id="mobile-staffId"
                    value={formData.staffId}
                    onChange={(e) =>
                      setFormData({ ...formData, staffId: e.target.value })
                    }
                    placeholder={tr('الرقم الوظيفي (اختياري)', 'Enter staff ID')}
                    className="h-11 w-full rounded-xl thea-input-focus"
                  />
                  {staffIdChecking ? (
                    <div className="text-xs text-muted-foreground">Checking staff ID...</div>
                  ) : staffIdError ? (
                    <div className="text-xs text-destructive">{staffIdError}</div>
                  ) : staffIdProvider ? (
                    <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                      <span className="font-medium">{staffIdProvider.displayName || '—'}</span>
                      {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).length > 0 && (
                        <span className="text-muted-foreground">
                          {' · '}
                          {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
                {/* Permissions section - simplified for mobile */}
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصلاحيات', 'Permissions')}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allPlatformPermissions = Object.values(visiblePermissionsByCategory)
                          .flat()
                          .map(p => p.key);
                        setFormData(prev => ({
                          ...prev,
                          permissions: allPlatformPermissions,
                        }));
                      }}
                      className="min-h-[44px] rounded-xl"
                    >
                      {tr('تحديد الكل', 'Select All')}
                    </Button>
                  </div>
                  <PermissionsMatrix
                    permissionsByCategory={visiblePermissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
                </div>
              </form>
              </div>
              <DialogFooter className="flex-shrink-0 border-t border-border px-4 py-3 relative z-10 bg-card">
                <Button type="submit" form="create-user-form" disabled={isLoading} className="w-full min-h-[44px] rounded-xl">
                  {isLoading ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء مستخدم', 'Create User')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden">
        <MobileSearchBar
          placeholderKey="common.search"
          queryParam="q"
          onSearch={setSearchQuery}
        />
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="rounded-2xl max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border relative z-10 bg-card">
              <DialogTitle>{tr('تعديل صلاحيات المستخدم', 'Edit User Permissions')}</DialogTitle>
              <DialogDescription>
                {tr('تحديث الصلاحيات', 'Update Permissions')} {editingUser?.firstName} {editingUser?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                  <Input
                    value={`${editingUser?.firstName || ''} ${editingUser?.lastName || ''}`.trim()}
                    disabled
                    className="rounded-xl thea-input-focus"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
                  <Input
                    value={editingUser?.email || ''}
                    disabled
                    className="rounded-xl thea-input-focus"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور الجديدة (اختياري)', 'New Password (optional)')}</span>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={tr('اتركها فارغة للإبقاء على الحالية', 'Leave empty to keep current')}
                  className="rounded-xl thea-input-focus"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_OPTIONS.map((dept) => {
                    const checked = formData.departments.includes(dept.key);
                    return (
                      <label
                        key={dept.key}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer thea-transition-fast text-sm ${
                          checked
                            ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const newDepts = e.target.checked
                              ? [...formData.departments, dept.key]
                              : formData.departments.filter((d) => d !== dept.key);
                            setFormData({ ...formData, departments: newDepts, department: newDepts.join(', ') });
                          }}
                          className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        {language === 'ar' ? dept.labelAr : dept.label}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الرقم الوظيفي', 'Staff ID')}</span>
                <Input
                  id="edit-staffId"
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData({ ...formData, staffId: e.target.value })
                  }
                  placeholder={tr('الرقم الوظيفي (اختياري)', 'Enter staff ID')}
                  className="rounded-xl thea-input-focus"
                />
                {staffIdChecking ? (
                  <div className="text-xs text-muted-foreground">Checking staff ID...</div>
                ) : staffIdError ? (
                  <div className="text-xs text-destructive">{staffIdError}</div>
                ) : staffIdProvider ? (
                  <div className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                    <span className="font-medium">{staffIdProvider.displayName || '—'}</span>
                    {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).length > 0 && (
                      <span className="text-muted-foreground">
                        {' · '}
                        {[staffIdProvider.staffId, staffIdProvider.email, staffIdProvider.employmentType].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصلاحيات', 'Permissions')}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      // Select all permissions for current platform only
                      const allPlatformPermissions = Object.values(visiblePermissionsByCategory)
                        .flat()
                        .map(p => p.key);
                      setFormData(prev => ({
                        ...prev,
                        permissions: allPlatformPermissions,
                      }));
                    }}
                  >
                    {tr('تحديد الكل', 'Select All')}
                  </Button>
                </div>

                  <PermissionsMatrix
                    permissionsByCategory={visiblePermissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
              </div>
              </form>
            </div>
            <DialogFooter className="flex-shrink-0 border-t border-border px-6 py-4 relative z-10 bg-card">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingUser(null);
                }}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                type="submit"
                form="edit-user-form"
                disabled={isLoading}
                className="rounded-xl"
              >
                {isLoading ? tr('جاري التحديث...', 'Updating...') : tr('تحديث المستخدم', 'Update User')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Change password dialog (admin / IT) */}
      <Dialog open={isChangePasswordOpen} onOpenChange={(open) => { if (!open) { setIsChangePasswordOpen(false); setChangePasswordUser(null); setChangePasswordValue(''); } }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تغيير رمز المستخدم' : 'Change user password'}</DialogTitle>
            <DialogDescription>
              {changePasswordUser
                ? (language === 'ar'
                  ? `تحديد رمز جديد لـ ${changePasswordUser.firstName} ${changePasswordUser.lastName}`
                  : `Set a new password for ${changePasswordUser.firstName} ${changePasswordUser.lastName}`)
                : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                {language === 'ar' ? 'الرمز الجديد' : 'New password'}
              </label>
              <Input
                id="new-password"
                type="password"
                value={changePasswordValue}
                onChange={(e) => setChangePasswordValue(e.target.value)}
                required
                minLength={12}
                className="h-11 rounded-xl thea-input-focus"
                placeholder={language === 'ar' ? '12+ حرف، أحرف كبيرة/صغيرة، أرقام، رموز' : '12+ chars, upper, lower, numbers, symbols'}
              />
              {changePasswordValue && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                  {pwChecks.map((c, i) => (
                    <span key={i} className={`text-xs flex items-center gap-1 ${c.ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {c.ok ? '✓' : '○'} {language === 'ar' ? c.ar : c.en}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => { setIsChangePasswordOpen(false); setChangePasswordUser(null); setChangePasswordValue(''); }}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isLoading || !changePasswordValue.trim()} className="rounded-xl">
                {isLoading ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ الرمز' : 'Save password')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mobile: Card List */}
      <div className="md:hidden">
        <MobileCardList
          items={cardItems}
          isLoading={isLoading}
          emptyMessage={language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
        />
      </div>

      {/* Desktop: Users Table */}
      <div className="hidden md:block rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{language === 'ar' ? 'جميع المستخدمين' : 'All Users'}</h2>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'عرض وإدارة جميع المستخدمين في النظام' : 'View and manage all users in the system'}
            </p>
          </div>
          {canCreateUsers && (
            <Button onClick={handleCreateUser} className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
            </Button>
          )}
        </div>

        {/* Scrollable table - min-width ensures no cut-off, overflow-x-auto enables horizontal scroll */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="min-w-[920px]">
        {/* Table Header - explicit column widths to prevent overlap and cut-off */}
        <div className="grid px-4 py-2 gap-4" style={{ gridTemplateColumns: '130px 200px 95px 100px 115px 85px 120px' }}>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الصلاحيات', 'Permissions')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراءات', 'Actions')}</span>
        </div>

        {/* Table Body */}
        {filteredUsers.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="grid px-4 py-3 gap-4 rounded-xl thea-hover-lift thea-transition-fast" style={{ gridTemplateColumns: '130px 200px 95px 100px 115px 85px 120px' }}>
              <div className="font-medium text-foreground min-w-0">
                <div className="truncate">{user.firstName} {user.lastName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.staffId ? `staffId=${user.staffId}` : ''}
                </div>
              </div>
              <div className="text-foreground self-center truncate" title={user.email}>{user.email}</div>
              <div className="self-center min-w-0 truncate" title={String(user.role)}>
                <span className="capitalize text-foreground">{user.role}</span>
              </div>
              <div className="text-foreground self-center min-w-0 truncate">{user.department || '-'}</div>
              <div className="self-center min-w-0">
                <span className="text-xs text-muted-foreground">
                  {['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase())
                    ? (language === 'ar' ? 'جميع الصلاحيات' : 'All')
                    : `${user.permissions?.length || 0} permissions`}
                </span>
              </div>
              <div className="self-center">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    user.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="self-center text-right">
                <div className="flex justify-end gap-2">
                  {canEditUsers && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleEdit(user)}
                      title={tr('تعديل', 'Edit')}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {canChangePassword && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openChangePassword(user)}
                      title={language === 'ar' ? 'تغيير الرمز' : 'Change password'}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  )}
                  {canDeleteUsers && !['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase()) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive hover:text-destructive"
                      onClick={() => handleDelete(user.id)}
                      title={tr('حذف', 'Delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
