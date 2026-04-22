'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, LayoutDashboard, Users, Link2, Loader2, Plus, Edit, Trash2, Building2, Database, Settings, FileText, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { Checkbox } from '@/components/ui/checkbox';
import { getPermissionsByCategory, getDefaultPermissionsForRole, Permission } from '@/lib/permissions';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  staffId?: string;
  permissions?: string[];
  isActive: boolean;
  groupId?: string;
  hospitalId?: string;
  platformAccess?: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };
}

interface RoleDefinition {
  key: string;
  label?: string | null;
  labelAr?: string | null;
  permissions: string[];
  source: 'builtin' | 'custom' | 'override';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // User Management states
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [tenantEntitlements, setTenantEntitlements] = useState<{ sam?: boolean; health?: boolean } | null>(null);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);

  // Enabled platforms for the new user (checkboxes)
  const [enabledPlatforms, setEnabledPlatforms] = useState<{ sam: boolean; health: boolean }>({
    sam: false,
    health: false,
  });
  
  // Selected platform for permissions configuration (dropdown)
  const [formPlatform, setFormPlatform] = useState<'sam' | 'health' | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'admin',
    department: '',
    staffId: '',
    permissions: [] as string[],
  });

  const { platform: platformData } = usePlatform();
  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health' 
    ? platformData.platform 
    : null;

  // Filter permissions by platform
  const getFilteredPermissionsByCategory = () => {
    const allPermissionsByCategory = getPermissionsByCategory();
    
    // Use formPlatform (selected platform for permissions) instead of platform (current user's platform)
    const selectedPlatform = formPlatform;
    
    if (!selectedPlatform) {
      return allPermissionsByCategory;
    }

    const SAM_CATEGORIES = ['Policy System', 'Account', 'Admin'];
    const HEALTH_CATEGORIES = ['Dashboard', 'Notifications', 'Hospital Core', 'OPD', 'Scheduling', 'ER', 'Patient Experience', 'IPD', 'Billing', 'Equipment (OPD)', 'Equipment (IPD)', 'Manpower & Nursing', 'Account', 'Admin'];

    const targetCategories = selectedPlatform === 'sam' ? SAM_CATEGORIES : HEALTH_CATEGORIES;
    
    const filtered: Record<string, Permission[]> = {};
    Object.entries(allPermissionsByCategory).forEach(([category, permissions]) => {
      if (targetCategories.includes(category)) {
        filtered[category] = permissions;
      }
    });
    
    return filtered;
  };

  const permissionsByCategory = useMemo(() => getFilteredPermissionsByCategory(), [formPlatform]);
  const rolePermissionsByKey = useMemo(() => {
    return new Map(roleDefinitions.map((role) => [role.key, role.permissions || []]));
  }, [roleDefinitions]);
  const roleOptions = useMemo(() => {
    if (roleDefinitions.length) return roleDefinitions;
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
  
  // Calculate enabled platforms count
  const enabledPlatformsCount = (enabledPlatforms.sam ? 1 : 0) + (enabledPlatforms.health ? 1 : 0);
  
  // Auto-select platform if only one is enabled
  useEffect(() => {
    if (enabledPlatformsCount === 1) {
      if (enabledPlatforms.sam) {
        setFormPlatform('sam');
      } else if (enabledPlatforms.health) {
        setFormPlatform('health');
      }
    } else if (enabledPlatformsCount === 0) {
      setFormPlatform(null);
    }
    // If multiple platforms are enabled, keep the current selection or default to first enabled
    else if (enabledPlatformsCount > 1 && !formPlatform) {
      if (enabledPlatforms.sam) {
        setFormPlatform('sam');
      } else if (enabledPlatforms.health) {
        setFormPlatform('health');
      }
    }
    // If current platform is disabled, switch to first enabled
    else if (enabledPlatformsCount > 1 && formPlatform) {
      if (formPlatform === 'sam' && !enabledPlatforms.sam) {
        setFormPlatform(enabledPlatforms.health ? 'health' : null);
      } else if (formPlatform === 'health' && !enabledPlatforms.health) {
        setFormPlatform(enabledPlatforms.sam ? 'sam' : null);
      }
    }
  }, [enabledPlatforms, enabledPlatformsCount, formPlatform]);

  useEffect(() => {
    if (formData.role) {
      const defaultPerms = getRolePermissions(formData.role);
      const platformPermKeys = Object.values(permissionsByCategory).flat().map(p => p.key);
      const filteredPerms = defaultPerms.filter(p => platformPermKeys.includes(p));
      setFormData(prev => ({ ...prev, permissions: filteredPerms }));
    }
  }, [formData.role, platform, permissionsByCategory, getRolePermissions]);

  // Update formData.permissions when platform changes in Edit Dialog
  useEffect(() => {
    if (isEditDialogOpen && editingUser && platform) {
      const roleKey = String(editingUser.role || '').toLowerCase();
      const allUserPermissions = editingUser.permissions?.length ? editingUser.permissions : getRolePermissions(roleKey);
      const allPermissionsByCategory = getPermissionsByCategory();
      const SAM_CATEGORIES = ['Policy System', 'Account', 'Admin'];
      const HEALTH_CATEGORIES = ['Dashboard', 'Notifications', 'Hospital Core', 'OPD', 'Scheduling', 'ER', 'Patient Experience', 'IPD', 'Billing', 'Equipment (OPD)', 'Equipment (IPD)', 'Manpower & Nursing', 'Account', 'Admin'];
      const targetCategories = platform === 'sam' ? SAM_CATEGORIES : HEALTH_CATEGORIES;
      
      const platformPermKeys = Object.entries(allPermissionsByCategory)
        .filter(([category]) => targetCategories.includes(category))
        .flatMap(([, permissions]) => permissions.map(p => p.key));
      
      const filteredPermissions = allUserPermissions.filter((perm: string) => platformPermKeys.includes(perm));
      setFormData(prev => ({ ...prev, permissions: filteredPermissions }));
    } else if (isEditDialogOpen && editingUser && !platform) {
      // If no platform selected, show all permissions
      const roleKey = String(editingUser.role || '').toLowerCase();
      const allUserPermissions = editingUser.permissions?.length ? editingUser.permissions : getRolePermissions(roleKey);
      setFormData(prev => ({ ...prev, permissions: allUserPermissions }));
    }
  }, [platform, isEditDialogOpen, editingUser]);

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
    const categoryPerms = permissionsByCategory[category] || [];
    const permKeys = categoryPerms.map(p => p.key);
    
    setFormData(prev => {
      if (checked) {
        const newPerms = Array.from(new Set([...prev.permissions, ...permKeys]));
        return { ...prev, permissions: newPerms };
      } else {
        return { ...prev, permissions: prev.permissions.filter(p => !permKeys.includes(p)) };
      }
    });
  }

  const { me, isLoading: meLoading, error: meError } = useMe();

  useEffect(() => {
    if (meLoading) return;

    if (meError || !me) {
      router.push('/login?redirect=/admin');
      setIsLoading(false);
      return;
    }

    const userRole = me.user?.role;
    
    if (userRole === 'admin') {
      setIsAdmin(true);
    } else {
      toast({
        title: 'Access Denied',
        description: 'Admin access required. Thea Owner should use /owner console.',
        variant: 'destructive',
      });
      router.push('/platforms');
    }
    setIsLoading(false);
  }, [me, meLoading, meError, router, toast]);

  useEffect(() => {
    fetchUsers();
    fetchRoleDefinitions();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });
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
      const response = await fetch('/api/admin/roles', {
        credentials: 'include',
      });
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
    
    // Validate that at least one platform is enabled
    if (enabledPlatformsCount === 0) {
      toast({
        title: tr('خطأ', 'Error'),
        description: language === 'ar' ? 'يجب تفعيل بلاتفورم واحد على الأقل' : 'At least one platform must be enabled',
        variant: 'destructive',
      });
      return;
    }
    
    setIsUserLoading(true);

    try {
      // Include platform access in the request
      // Explicitly set false for disabled platforms to ensure they show correctly in User Platform Access page
      const requestData = {
        ...formData,
        platformAccess: {
          sam: enabledPlatforms.sam ? true : false,
          health: enabledPlatforms.health ? true : false,
          edrac: false, // Not available in create dialog, default to false
          cvision: false, // Not available in create dialog, default to false
        },
      };
      
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('نجح', 'Success'),
          description: tr('تم إنشاء المستخدم بنجاح', 'User created successfully'),
        });
        setIsDialogOpen(false);
        await fetchUsers();
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'admin',
          department: '',
          staffId: '',
          permissions: getRolePermissions('admin'),
        });
        setEnabledPlatforms({ sam: false, health: false });
        setFormPlatform(null);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsUserLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(tr('هل أنت متأكد من حذف هذا المستخدم؟', 'Are you sure you want to delete this user?'))) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('نجح', 'Success'),
          description: tr('تم حذف المستخدم بنجاح', 'User deleted successfully'),
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل حذف المستخدم', 'Failed to delete user'),
        variant: 'destructive',
      });
    }
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    
    // Set enabled platforms based on user's platformAccess
    const platformAccess = user.platformAccess;
    const editEnabledPlatforms = {
      sam: platformAccess?.sam !== false, // true if true or undefined
      health: platformAccess?.health !== false, // true if true or undefined
    };
    setEnabledPlatforms(editEnabledPlatforms);
    
    // Set initial platform based on user's platformAccess
    // If user has only one platform enabled, set it as default
    let initialPlatform: 'sam' | 'health' | null = null;
    
    if (platformAccess) {
      // Check if platforms are explicitly disabled (false)
      // If undefined, treat as enabled (inherits from tenant)
      const hasSam = platformAccess.sam !== false; // true if true or undefined
      const hasHealth = platformAccess.health !== false; // true if true or undefined
      
      if (hasSam && !hasHealth) {
        // Only SAM enabled
        initialPlatform = 'sam';
      } else if (hasHealth && !hasSam) {
        // Only Health enabled
        initialPlatform = 'health';
      } else if (hasSam && hasHealth) {
        // Both enabled, try to get from cookie or default to first available
        const getCookie = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };
        const platformValue = getCookie('thea_last_platform');
        initialPlatform = platformValue === 'health' ? 'health' : 'sam';
      } else {
        // Neither enabled (both false)
        initialPlatform = null;
      }
    } else {
      // No platformAccess set, use cookie or default
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      const platformValue = getCookie('thea_last_platform');
      initialPlatform = platformValue === 'sam' || platformValue === 'health' ? platformValue : null;
    }
    
    setFormPlatform(initialPlatform);
    
    // Filter permissions based on initial platform
    const roleKey = String(user.role || '').toLowerCase();
    const allUserPermissions = user.permissions?.length ? user.permissions : getRolePermissions(roleKey);
    let filteredPermissions = allUserPermissions;
    
    if (initialPlatform) {
      const allPermissionsByCategory = getPermissionsByCategory();
      const SAM_CATEGORIES = ['Policy System', 'Account', 'Admin'];
      const HEALTH_CATEGORIES = ['Dashboard', 'Notifications', 'Hospital Core', 'OPD', 'Scheduling', 'ER', 'Patient Experience', 'IPD', 'Billing', 'Equipment (OPD)', 'Equipment (IPD)', 'Manpower & Nursing', 'Account', 'Admin'];
      const targetCategories = initialPlatform === 'sam' ? SAM_CATEGORIES : HEALTH_CATEGORIES;
      
      const platformPermKeys = Object.entries(allPermissionsByCategory)
        .filter(([category]) => targetCategories.includes(category))
        .flatMap(([, permissions]) => permissions.map(p => p.key));
      
      filteredPermissions = allUserPermissions.filter((perm: string) => platformPermKeys.includes(perm));
    }
    
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department || '',
      staffId: user.staffId || '',
      permissions: filteredPermissions,
    });
    
    setIsEditDialogOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsUserLoading(true);

    try {
      // Get all permissions from all platforms (not just current platform)
      const allPermissionsByCategory = getPermissionsByCategory();
      const allPlatformPermKeys = Object.values(allPermissionsByCategory).flat().map(p => p.key);
      
      // Get current platform-specific permissions
      const currentPlatformPermKeys = Object.values(permissionsByCategory).flat().map(p => p.key);
      
      // Get permissions from other platforms (preserve them)
      const otherPlatformPerms = (editingUser.permissions || []).filter(
        (perm: string) => perm && typeof perm === 'string' && !currentPlatformPermKeys.includes(perm)
      );
      
      // Merge: other platform permissions + current platform permissions from formData
      const currentPerms = Array.isArray(formData.permissions) ? formData.permissions : [];
      const allPermissions = Array.from(new Set([...otherPlatformPerms, ...currentPerms])).filter(
        (perm: string) => perm && typeof perm === 'string'
      );
      
      const updateData: any = {
        permissions: allPermissions,
      };
      
      // Only include staffId if it's not empty
      if (formData.staffId && formData.staffId.trim() !== '') {
        updateData.staffId = formData.staffId.trim();
      }
      
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        credentials: 'include',
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
          staffId: '',
          permissions: getRolePermissions('admin'),
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsUserLoading(false);
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
      staffId: '',
      permissions: getRolePermissions('admin'),
    });
    setEnabledPlatforms({ sam: false, health: false });
    setFormPlatform(null);
    setIsDialogOpen(true);
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تسجيل الخروج', 'Failed to logout'),
        variant: 'destructive',
      });
    }
  }

  function handleBack() {
    router.back();
  }

  function handleGoToPlatforms() {
    router.push('/platforms');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Tenant Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, platform access, and integration settings for your tenant</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToPlatforms}
            className="gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Platforms
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Quick Links - All Admin Pages */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">All Admin Pages</h2>
          <p className="text-muted-foreground mb-4">
            Access all administrative pages and settings
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Management */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/users')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Users</CardTitle>
              </div>
              <CardDescription>
                Manage tenant users and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View, create, edit, and delete users
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/roles')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Roles & Pages</CardTitle>
              </div>
              <CardDescription>
                Manage roles and page access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create roles and edit permissions per role
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/platform-access')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>User Platform Access</CardTitle>
              </div>
              <CardDescription>
                Control which platforms each user can access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Set per-user platform access within tenant entitlements
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/admin')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Admin Management</CardTitle>
              </div>
              <CardDescription>
                Manage admin users and roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure admin users and their permissions
              </p>
            </CardContent>
          </Card>

          {/* Structure & Data */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/structure-management')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Structure Management</CardTitle>
              </div>
              <CardDescription>
                Manage organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage departments, rooms, floors, units, operations, functions, and risk domains
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/data-admin')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Data Admin</CardTitle>
              </div>
              <CardDescription>
                Manage data imports and exports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Import, export, and manage system data
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/groups-hospitals')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Groups & Hospitals</CardTitle>
              </div>
              <CardDescription>
                Manage groups and hospitals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure groups and hospital settings
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/organization-profile')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Organization Profile</CardTitle>
              </div>
              <CardDescription>
                View organization type and baseline settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Review locked context and add overlay requirements
              </p>
            </CardContent>
          </Card>

          {/* Integration & Settings */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/integrations')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                <CardTitle>Integration Settings</CardTitle>
              </div>
              <CardDescription>
                Configure SAM ↔ Thea Health integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Enable/disable integration, auto-trigger, and severity thresholds
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/quotas')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle>Demo Quotas</CardTitle>
              </div>
              <CardDescription>
                Manage demo quota limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and view demo quota limits for features
              </p>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/delete-sample-data')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                <CardTitle>Delete Sample Data</CardTitle>
              </div>
              <CardDescription>
                Remove sample/test data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Delete sample data and test records
              </p>
            </CardContent>
          </Card>

          {/* Entitlements (Info Only - redirects to owner) */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed" onClick={() => {
            toast({
              title: 'Info',
              description: 'Tenant entitlements can only be managed by Thea Owner. Redirecting to Owner Console...',
            });
            router.push('/owner');
          }}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-muted-foreground">Tenant Entitlements</CardTitle>
              </div>
              <CardDescription>
                Platform access management (Thea Owner only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Only Thea Owner can manage tenant entitlements. Click to go to Owner Console.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Management Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{tr('إدارة المستخدمين', 'User Management')}</h2>
            <p className="text-muted-foreground">{tr('إدارة المستخدمين والأدوار', 'Manage users and roles')}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateUser}>
                <Plus className="mr-2 h-4 w-4" />
                {tr('إضافة مستخدم', 'Add User')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
              <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative z-10 bg-background">
                <DialogTitle>{tr('إنشاء مستخدم', 'Create User')}</DialogTitle>
                <DialogDescription>
                  {tr('إضافة مستخدم جديد للنظام', 'Add a new user to the system')}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{tr('الاسم الأول', 'First Name')}</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{tr('اسم العائلة', 'Last Name')}</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{tr('البريد الإلكتروني', 'Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tr('كلمة المرور', 'Password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{tr('الدور', 'Role')}</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => {
                      setFormData({ ...formData, role: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Label htmlFor="department">{tr('القسم', 'Department')}</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  />
                </div>
                
                {/* Enable Platforms Section */}
                <div className="space-y-3 border-t pt-4">
                  <Label>{language === 'ar' ? 'تفعيل البلاتفورمات المتاحة' : 'Enable Available Platforms'}</Label>
                  <div className="flex flex-col gap-3">
                    {tenantEntitlements?.sam !== false && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-sam"
                          checked={enabledPlatforms.sam}
                          onCheckedChange={(checked) => {
                            setEnabledPlatforms(prev => ({ ...prev, sam: checked === true }));
                          }}
                        />
                        <Label htmlFor="enable-sam" className="text-sm font-normal cursor-pointer">
                          SAM
                        </Label>
                      </div>
                    )}
                    {tenantEntitlements?.health !== false && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="enable-health"
                          checked={enabledPlatforms.health}
                          onCheckedChange={(checked) => {
                            setEnabledPlatforms(prev => ({ ...prev, health: checked === true }));
                          }}
                        />
                        <Label htmlFor="enable-health" className="text-sm font-normal cursor-pointer">
                          {language === 'ar' ? 'ثيا الصحة' : 'Thea Health'}
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Platform Selection for Permissions */}
                {enabledPlatformsCount > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="create-platform">
                      {language === 'ar' 
                        ? enabledPlatformsCount > 1 
                          ? 'اختر المنصة لتحديد الصلاحيات' 
                          : 'المنصة'
                        : enabledPlatformsCount > 1
                          ? 'Select Platform for Permissions'
                          : 'Platform'
                      }
                    </Label>
                    {enabledPlatformsCount > 1 ? (
                      <Select
                        value={formPlatform || ''}
                        onValueChange={(value) => {
                          setFormPlatform(value === 'sam' || value === 'health' ? value : null);
                        }}
                      >
                        <SelectTrigger id="create-platform">
                          <SelectValue placeholder={language === 'ar' ? 'اختر المنصة' : 'Select Platform'} />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledPlatforms.sam && (
                            <SelectItem value="sam">SAM</SelectItem>
                          )}
                          {enabledPlatforms.health && (
                            <SelectItem value="health">{language === 'ar' ? 'ثيا الصحة' : 'Thea Health'}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {enabledPlatforms.sam ? 'SAM' : enabledPlatforms.health ? (language === 'ar' ? 'ثيا الصحة' : 'Thea Health') : ''}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Permissions Section - Only show if at least one platform is enabled and selected */}
                {enabledPlatformsCount > 0 && formPlatform && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>{tr('الصلاحيات', 'Permissions')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allPlatformPermissions = Object.values(permissionsByCategory)
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
                    permissionsByCategory={permissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
                  </div>
                )}
              </form>
              </div>
              <DialogFooter className="flex-shrink-0 border-t px-6 py-4 relative z-10 bg-background">
                <Button type="submit" form="create-user-form" disabled={isUserLoading}>
                  {isUserLoading ? tr('جاري الإنشاء...', 'Creating...') : tr('إنشاء مستخدم', 'Create User')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        
        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
              <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative z-10 bg-background">
                <DialogTitle>{tr('تعديل صلاحيات المستخدم', 'Edit User Permissions')}</DialogTitle>
                <DialogDescription>
                  {tr('تحديث الصلاحيات', 'Update Permissions')} {editingUser?.firstName} {editingUser?.lastName}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tr('الاسم', 'Name')}</Label>
                    <Input
                      value={`${editingUser?.firstName} ${editingUser?.lastName}`}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr('البريد الإلكتروني', 'Email')}</Label>
                    <Input
                      value={editingUser?.email}
                      disabled
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-password">{tr('كلمة المرور الجديدة (اختياري)', 'New Password (optional)')}</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={tr('اتركها فارغة للإبقاء على الحالية', 'Leave empty to keep current')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-staffId">{tr('الرقم الوظيفي', 'Staff ID')}</Label>
                  <Input
                    id="edit-staffId"
                    value={formData.staffId}
                    onChange={(e) =>
                      setFormData({ ...formData, staffId: e.target.value })
                    }
                    placeholder={tr('الرقم الوظيفي (اختياري)', 'Staff ID (optional)')}
                  />
                </div>
                
                {/* Platform Selection for Permissions */}
                {enabledPlatformsCount > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <Label htmlFor="edit-platform">
                      {language === 'ar' 
                        ? enabledPlatformsCount > 1 
                          ? 'اختر المنصة لتحديد الصلاحيات' 
                          : 'المنصة'
                        : enabledPlatformsCount > 1
                          ? 'Select Platform for Permissions'
                          : 'Platform'
                      }
                    </Label>
                    {enabledPlatformsCount > 1 ? (
                      <Select
                        value={formPlatform || ''}
                        onValueChange={(value) => {
                          setFormPlatform(value === 'sam' || value === 'health' ? value : null);
                        }}
                      >
                        <SelectTrigger id="edit-platform">
                          <SelectValue placeholder={language === 'ar' ? 'اختر المنصة' : 'Select Platform'} />
                        </SelectTrigger>
                        <SelectContent>
                          {enabledPlatforms.sam && (
                            <SelectItem value="sam">SAM</SelectItem>
                          )}
                          {enabledPlatforms.health && (
                            <SelectItem value="health">{language === 'ar' ? 'ثيا الصحة' : 'Thea Health'}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {enabledPlatforms.sam ? 'SAM' : enabledPlatforms.health ? (language === 'ar' ? 'ثيا الصحة' : 'Thea Health') : ''}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Permissions Section - Only show if at least one platform is enabled and selected */}
                {enabledPlatformsCount > 0 && formPlatform && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>{tr('الصلاحيات', 'Permissions')}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allPlatformPermissions = Object.values(permissionsByCategory)
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
                    permissionsByCategory={permissionsByCategory}
                    selectedPermissions={formData.permissions}
                    language={language}
                    onTogglePermission={handlePermissionToggle}
                    onToggleCategory={handleSelectAllCategory}
                  />
                  </div>
                )}
              </form>
              </div>
              <DialogFooter className="flex-shrink-0 border-t px-6 py-4 relative z-10 bg-background">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingUser(null);
                    setEnabledPlatforms({ sam: false, health: false });
                    setFormPlatform(null);
                  }}
                >
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  form="edit-user-form"
                  disabled={isUserLoading}
                >
                  {isUserLoading ? tr('جاري التحديث...', 'Updating...') : tr('تحديث المستخدم', 'Update User')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{language === 'ar' ? 'جميع المستخدمين' : 'All Users'}</CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'عرض وإدارة جميع المستخدمين في النظام' : 'View and manage all users in the system'}
                </CardDescription>
              </div>
              <Button onClick={handleCreateUser}>
                <Plus className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[900px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">{tr('الاسم', 'Name')}</TableHead>
                  <TableHead className="w-[200px]">{tr('البريد الإلكتروني', 'Email')}</TableHead>
                  <TableHead className="w-[100px]">{tr('الدور', 'Role')}</TableHead>
                  <TableHead className="w-[100px]">{tr('القسم', 'Department')}</TableHead>
                  <TableHead className="w-[120px]">{tr('الصلاحيات', 'Permissions')}</TableHead>
                  <TableHead className="w-[90px]">{tr('الحالة', 'Status')}</TableHead>
                  <TableHead className="w-[100px] text-right">{tr('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium truncate" title={`${user.firstName} ${user.lastName}`}>
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell className="truncate" title={user.email}>{user.email}</TableCell>
                      <TableCell className="truncate" title={String(user.role)}>
                        <span className="capitalize">{user.role}</span>
                      </TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase())
                            ? (language === 'ar' ? 'جميع الصلاحيات' : 'All')
                            : `${user.permissions?.length || 0} permissions`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            disabled={['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase())}
                            title={['admin', 'thea-owner'].includes(String(user.role || '').toLowerCase()) ? (language === 'ar' ? 'لا يمكن حذف الأدمن' : 'Admin cannot be deleted') : undefined}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
