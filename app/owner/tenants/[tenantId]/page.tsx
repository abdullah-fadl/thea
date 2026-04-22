'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Save, Loader2, AlertTriangle, UserPlus, Trash2, Ban, CheckCircle, Users, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface Tenant {
  tenantId: string;
  name?: string;
  orgTypeId?: string;
  orgTypeName?: string | null;
  sector?: string;
  countryCode?: string | null;
  orgTypeChangeCount?: number;
  status: 'active' | 'blocked';
  planType: 'demo' | 'paid';
  subscriptionEndsAt?: Date;
  maxUsers: number;
  userCount?: number;
  assignedUsers?: User[]; // Users assigned to this tenant
  availableUsers?: User[]; // Users available to be assigned (no tenantId)
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
    imdad: boolean;
  };
  integrations?: {
    samHealth?: {
      enabled: boolean;
      autoTriggerEnabled: boolean;
      severityThreshold: 'low' | 'medium' | 'high' | 'critical';
      engineTimeoutMs: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface OrganizationType {
  id: string;
  name: string;
  sector: string;
  countryCode?: string | null;
  status: 'ACTIVE' | 'DRAFT_PENDING_REVIEW' | 'REJECTED';
}

export default function TenantDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const tenantIdParam = params.tenantId as string | undefined;
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { confirm } = useConfirm();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAssignUsersOpen, setIsAssignUsersOpen] = useState(false);
  const [isMoveUserOpen, setIsMoveUserOpen] = useState(false);
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userToMove, setUserToMove] = useState<User | null>(null);
  const [moveToTenantId, setMoveToTenantId] = useState('');
  const [allTenants, setAllTenants] = useState<Array<{ tenantId: string; name?: string }>>([]);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [paramsLoaded, setParamsLoaded] = useState(false);


  // Validate and normalize tenantId - check for undefined, null, or empty string
  // Note: tenantIdParam might be undefined initially during SSR/hydration
  const tenantId = tenantIdParam && 
    tenantIdParam !== 'undefined' && 
    tenantIdParam !== 'null' && 
    typeof tenantIdParam === 'string' &&
    tenantIdParam.trim() !== '' 
    ? tenantIdParam.trim() 
    : null;

  // Debug logging (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TenantDetailsPage] tenantIdParam:', tenantIdParam, 'tenantId:', tenantId, 'paramsLoaded:', paramsLoaded);
    }
  }, [tenantIdParam, tenantId, paramsLoaded]);

  // Track when params are loaded
  // In Next.js App Router, params are available immediately, but we need to check if they're valid
  useEffect(() => {
    // Params are considered "loaded" when tenantIdParam is defined (even if it's an invalid value)
    // This allows us to distinguish between "still loading" and "loaded but invalid"
    if (tenantIdParam !== undefined) {
      setParamsLoaded(true);
    }
  }, [tenantIdParam]);

  // Redirect only after params are confirmed loaded and tenantId is invalid
  useEffect(() => {
    // Don't redirect until params are loaded
    if (!paramsLoaded) {
      return;
    }
    
    // Only redirect if tenantId is actually invalid (not just loading)
    // tenantId will be null if tenantIdParam is undefined, 'undefined', 'null', or empty
    if (!tenantId) {
      setIsLoading(false);
      // Use setTimeout to avoid redirect during render
      setTimeout(() => {
        toast({
          title: tr('مستأجر غير صالح', 'Invalid Tenant'),
          description: tr('معرّف المستأجر مطلوب', 'Tenant ID is required'),
          variant: 'destructive',
        });
        router.replace('/owner/tenants');
      }, 100);
      return;
    }
  }, [tenantId, paramsLoaded, router, toast]);

  // Fetch tenant data only if tenantId is valid and params are loaded
  useEffect(() => {
    // Wait for params to load
    if (!paramsLoaded) {
      return;
    }
    
    // Only fetch if tenantId is valid
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    
    // Fetch tenant data
    fetchTenant();
    fetchAllTenants();
    fetchOrgTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, paramsLoaded]);

  async function fetchAllTenants() {
    try {
      const response = await fetch('/api/owner/tenants', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAllTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    }
  }

  async function fetchOrgTypes() {
    try {
      const response = await fetch('/api/owner/org-types?status=ACTIVE', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOrgTypes(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch organization types:', error);
    }
  }

  async function fetchTenant() {
    if (!tenantId) {
      setIsLoading(false);
      setTenant(null);
      return;
    }
    setIsLoading(true);
    try {
      // Use encodeURIComponent to safely handle tenantId in URL
      const response = await fetch(`/api/owner/tenants/${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure entitlements exist (fallback to enabledPlatforms or default)
        const tenantData = data.tenant;
        if (!tenantData.entitlements && tenantData.enabledPlatforms) {
          tenantData.entitlements = {
            sam: tenantData.enabledPlatforms.sam || false,
            health: tenantData.enabledPlatforms.theaHealth || tenantData.enabledPlatforms.health || false,
            edrac: tenantData.enabledPlatforms.edrac || false,
            cvision: tenantData.enabledPlatforms.cvision || false,
            imdad: tenantData.enabledPlatforms.imdad || tenantData.enabledPlatforms.scm || false,
          };
        } else if (!tenantData.entitlements) {
          tenantData.entitlements = {
            sam: false,
            health: false,
            edrac: false,
            cvision: false,
            imdad: false,
          };
        }
        setTenant(tenantData);
      } else if (response.status === 403) {
        toast({
          title: tr('تم رفض الوصول', 'Access Denied'),
          description: tr('مطلوب صلاحية مالك ثيا', 'Thea Owner access required'),
          variant: 'destructive',
        });
        router.replace('/owner');
      } else if (response.status === 404) {
        toast({
          title: tr('المستأجر غير موجود', 'Tenant Not Found'),
          description: tr(`المستأجر "${tenantId}" غير موجود`, `Tenant "${tenantId}" does not exist`),
          variant: 'destructive',
        });
        setTenant(null);
        router.replace('/owner/tenants');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch tenant');
      }
    } catch (error) {
      console.error('Failed to fetch tenant:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تحميل تفاصيل المستأجر', 'Failed to load tenant details'),
        variant: 'destructive',
      });
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!tenant || !tenantId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tenant.name,
          status: tenant.status,
          planType: tenant.planType,
          maxUsers: tenant.maxUsers,
          subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString(),
        }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم تحديث المستأجر بنجاح', 'Tenant updated successfully'),
        });
        await fetchTenant();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tenant');
      }
    } catch (error) {
      console.error('Failed to save tenant:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تحديث المستأجر', 'Failed to update tenant'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAdmin() {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم إنشاء مدير المستأجر بنجاح', 'Tenant admin created successfully'),
        });
        setIsCreateAdminOpen(false);
        setAdminForm({ email: '', password: '', firstName: '', lastName: '' });
        await fetchTenant();
      } else {
        const error = await response.json();
        const errorMessage = error.details 
          ? `${error.error || 'Invalid request'}: ${JSON.stringify(error.details)}`
          : error.message || error.error || 'Failed to create admin';
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل إنشاء المدير', 'Failed to create admin'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTenant() {
    // Use tenant.tenantId from state, fallback to tenantId from params
    const targetTenantId = tenant?.tenantId || tenantId;
    console.log('[TenantDetailsPage] handleDeleteTenant called', {
      tenantId: tenant?.tenantId,
      tenantIdFromParams: tenantId,
      targetTenantId,
    });
    
    if (!targetTenantId) {
      console.error('[TenantDetailsPage] Tenant ID is missing');
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('معرّف المستأجر مفقود', 'Tenant ID is missing'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Encode tenantId for URL safety
      const encodedTenantId = encodeURIComponent(targetTenantId);
      const url = `/api/owner/tenants/${encodedTenantId}`;
      console.log('[TenantDetailsPage] Sending DELETE request to:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });

      console.log('[TenantDetailsPage] DELETE response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[TenantDetailsPage] Delete successful:', data);
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم حذف المستأجر بنجاح', 'Tenant deleted successfully'),
        });
        router.push('/owner/tenants');
      } else {
        const error = await response.json();
        console.error('[TenantDetailsPage] Delete failed:', error);
        throw new Error(error.error || error.message || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('[TenantDetailsPage] Failed to delete tenant:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل حذف المستأجر', 'Failed to delete tenant'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setIsDeleteOpen(false);
    }
  }

  function getDaysUntilExpiry(): number | null {
    if (!tenant?.subscriptionEndsAt) return null;
    const now = new Date();
    const expiry = new Date(tenant.subscriptionEndsAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getSubscriptionWarning() {
    const daysLeft = getDaysUntilExpiry();
    if (daysLeft === null) return null;
    if (daysLeft < 0) {
      return <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{tr(`انتهى الاشتراك منذ ${Math.abs(daysLeft)} يوم`, `Subscription expired ${Math.abs(daysLeft)} days ago`)}</AlertDescription>
      </Alert>;
    }
    if (daysLeft < 14) {
      return <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{tr(`ينتهي الاشتراك خلال ${daysLeft} يوم`, `Subscription expires in ${daysLeft} days`)}</AlertDescription>
      </Alert>;
    }
    return null;
  }

  async function handleAssignUsers() {
    if (selectedUserIds.length === 0) return;
    if (!tenant || !tenantId) return;

    // Check if assignment would exceed maxUsers
    const newCount = (tenant.userCount || 0) + selectedUserIds.length;
    if (newCount > tenant.maxUsers) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr(
          `لا يمكن تعيين ${selectedUserIds.length} مستخدم. الحد الأقصى ${tenant.maxUsers} مستخدم. الحالي: ${tenant.userCount || 0}`,
          `Cannot assign ${selectedUserIds.length} user(s). Maximum ${tenant.maxUsers} users allowed. Current: ${tenant.userCount || 0}`
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/tenants/${tenantId}/assign-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIds }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr(`تم تعيين ${data.assigned} مستخدم للمستأجر`, `Assigned ${data.assigned} user(s) to tenant`),
        });
        setSelectedUserIds([]);
        await fetchTenant();
        // Refresh tenants list to update counts
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to assign users');
      }
    } catch (error) {
      console.error('Failed to assign users:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تعيين المستخدمين', 'Failed to assign users'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!tenant) return;

    // Remove user from tenant (set tenantId to null)
    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTenantId: null }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تمت إزالة المستخدم من المستأجر', 'User removed from tenant'),
        });
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Failed to remove user:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل إزالة المستخدم', 'Failed to remove user'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveUser() {
    if (!userToMove || !moveToTenantId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userToMove.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toTenantId: moveToTenantId }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr(`تم نقل المستخدم إلى المستأجر ${moveToTenantId}`, `User moved to tenant ${moveToTenantId}`),
        });
        setIsMoveUserOpen(false);
        setUserToMove(null);
        setMoveToTenantId('');
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to move user');
      }
    } catch (error) {
      console.error('Failed to move user:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل نقل المستخدم', 'Failed to move user'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (!(await confirm(tr(`هل أنت متأكد من حذف المستخدم ${userEmail} نهائياً؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع البيانات المرتبطة.`, `Are you sure you want to permanently delete user ${userEmail}? This action cannot be undone and will delete all associated data.`)))) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/owner/users/${userId}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: data.message || tr('تم حذف المستخدم بنجاح', 'User deleted successfully'),
        });
        await fetchTenant();
        router.refresh();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل حذف المستخدم', 'Failed to delete user'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Early return if tenantId is invalid (will redirect via useEffect)
  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{tr('المستأجر غير موجود', 'Tenant not found')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const daysLeft = getDaysUntilExpiry();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tr('رجوع', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tenant.tenantId}</h1>
            <p className="text-muted-foreground">{tenant.name || tr('لم يتم تعيين اسم', 'No name set')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tenant.status === 'active' ? (
            <Button
              variant="outline"
              onClick={async () => {
                if (!tenantId) return;
                const response = await fetch(`/api/owner/tenants/${tenantId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'blocked' }),
                  credentials: 'include',
                });
                if (response.ok) {
                  await fetchTenant();
                  toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم حظر المستأجر', 'Tenant blocked') });
                }
              }}
            >
              <Ban className="h-4 w-4 mr-2" />
              {tr('حظر', 'Block')}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={async () => {
                if (!tenantId) return;
                const response = await fetch(`/api/owner/tenants/${tenantId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'active' }),
                  credentials: 'include',
                });
                if (response.ok) {
                  await fetchTenant();
                  toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم إلغاء حظر المستأجر', 'Tenant unblocked') });
                }
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {tr('إلغاء الحظر', 'Unblock')}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => {
              console.log('[TenantDetailsPage] Delete button clicked, opening dialog', {
                tenant: tenant?.tenantId,
                tenantId,
              });
              setIsDeleteOpen(true);
            }}
            disabled={!tenant}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {tr('حذف', 'Delete')}
          </Button>
        </div>
      </div>

      {getSubscriptionWarning()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
          <TabsTrigger value="entitlements">{tr('الصلاحيات', 'Entitlements')}</TabsTrigger>
          <TabsTrigger value="users">{tr('المستخدمون والحدود', 'Users & Limits')}</TabsTrigger>
          <TabsTrigger value="integrations">{tr('التكاملات', 'Integrations')}</TabsTrigger>
          <TabsTrigger value="actions">{tr('الإجراءات', 'Actions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('نظرة عامة على المستأجر', 'Tenant Overview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">{tr('الاسم', 'Name')}</Label>
                <Input
                  id="name"
                  value={tenant.name || ''}
                  onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">{tr('الحالة', 'Status')}</Label>
                <Select
                  value={tenant.status}
                  onValueChange={(value: 'active' | 'blocked') => setTenant({ ...tenant, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{tr('نشط', 'Active')}</SelectItem>
                    <SelectItem value="blocked">{tr('محظور', 'Blocked')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="planType">{tr('نوع الخطة', 'Plan Type')}</Label>
                <Select
                  value={tenant.planType}
                  onValueChange={(value: 'demo' | 'paid') => setTenant({ ...tenant, planType: value })}
                >
                  <SelectTrigger id="planType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">{tr('تجريبي', 'Demo')}</SelectItem>
                    <SelectItem value="paid">{tr('مدفوع', 'Paid')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxUsers">{tr('أقصى عدد مستخدمين', 'Max Users')}</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  min={1}
                  value={tenant.maxUsers}
                  onChange={(e) => setTenant({ ...tenant, maxUsers: parseInt(e.target.value) || 1 })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {tr('الحالي:', 'Current:')} {tenant.userCount || 0} / {tenant.maxUsers}
                </p>
              </div>
              <div>
                <Label htmlFor="subscriptionEndsAt">{tr('تاريخ انتهاء الاشتراك', 'Subscription Ends At')}</Label>
                <Input
                  id="subscriptionEndsAt"
                  type="datetime-local"
                  value={tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setTenant({ 
                    ...tenant, 
                    subscriptionEndsAt: e.target.value ? new Date(e.target.value) : undefined 
                  })}
                />
                {daysLeft !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {daysLeft > 0 ? tr(`${daysLeft} يوم متبقي`, `${daysLeft} days remaining`) : tr(`انتهى منذ ${Math.abs(daysLeft)} يوم`, `Expired ${Math.abs(daysLeft)} days ago`)}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {tr('جاري الحفظ...', 'Saving...')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {tr('حفظ التغييرات', 'Save Changes')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tr('الملف التنظيمي', 'Organization Profile')}</CardTitle>
              <CardDescription>{tr('نوع المنظمة مقفل بعد الإنشاء', 'Organization type is locked after creation')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>{tr('نوع المنظمة', 'Organization Type')}</Label>
                  <Input
                    value={
                      tenant.orgTypeName ||
                      orgTypes.find((orgType) => orgType.id === tenant.orgTypeId)?.name ||
                      tenant.orgTypeId ||
                      tr('غير محدد', 'Not set')
                    }
                    disabled
                  />
                </div>
                <div>
                  <Label>{tr('القطاع', 'Sector')}</Label>
                  <Input value={tenant.sector || tr('غير محدد', 'Not set')} disabled />
                </div>
                <div>
                  <Label>{tr('الدولة/المنطقة', 'Country/Region')}</Label>
                  <Input value={tenant.countryCode || tr('غير محدد', 'Not set')} disabled />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {tr('نوع المنظمة غير قابل للتغيير بعد إنشاء المستأجر.', 'Organization type is immutable after tenant creation.')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entitlements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('صلاحيات المنصة', 'Platform Entitlements')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['sam', 'health', 'edrac', 'cvision', 'imdad'].map((platform) => (
                <div key={platform} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium capitalize">{platform}</Label>
                  </div>
                  <Switch
                    checked={tenant.entitlements[platform as keyof typeof tenant.entitlements]}
                    onCheckedChange={async (checked) => {
                      if (!tenantId) return;
                      const newEntitlements = {
                        ...tenant.entitlements,
                        [platform]: checked,
                      };
                      const response = await fetch(`/api/owner/tenants/${tenantId}/entitlements`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ entitlements: newEntitlements }),
                        credentials: 'include',
                      });
                      if (response.ok) {
                        setTenant({ ...tenant, entitlements: newEntitlements });
                        toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم تحديث الصلاحيات', 'Entitlements updated') });
                      }
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{tr('المستخدمون', 'Users')}</CardTitle>
                  <CardDescription>
                    {tenant.userCount || 0} / {tenant.maxUsers} users
                  </CardDescription>
                </div>
                <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      {tr('إنشاء مدير', 'Create Admin')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{tr('إنشاء مدير مستأجر', 'Create Tenant Admin')}</DialogTitle>
                      <DialogDescription>
                        {tr('إنشاء مستخدم مدير لهذا المستأجر', 'Create an admin user for this tenant')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="adminEmail">{tr('البريد الإلكتروني *', 'Email *')}</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          value={adminForm.email}
                          onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="adminPassword">{tr('كلمة المرور *', 'Password *')}</Label>
                        <Input
                          id="adminPassword"
                          type="password"
                          value={adminForm.password}
                          onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                          minLength={6}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {tr('يجب أن تكون 6 أحرف على الأقل', 'Must be at least 6 characters')}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="adminFirstName">{tr('الاسم الأول *', 'First Name *')}</Label>
                          <Input
                            id="adminFirstName"
                            value={adminForm.firstName}
                            onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adminLastName">{tr('اسم العائلة *', 'Last Name *')}</Label>
                          <Input
                            id="adminLastName"
                            value={adminForm.lastName}
                            onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateAdminOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button 
                        onClick={handleCreateAdmin} 
                        disabled={
                          isSaving || 
                          !adminForm.email || 
                          !adminForm.password || 
                          adminForm.password.length < 6 ||
                          !adminForm.firstName ||
                          !adminForm.lastName
                        }
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {tr('جاري الإنشاء...', 'Creating...')}
                          </>
                        ) : (
                          tr('إنشاء', 'Create')
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('الاسم', 'Name')}</TableHead>
                    <TableHead>{tr('البريد الإلكتروني', 'Email')}</TableHead>
                    <TableHead>{tr('الدور', 'Role')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                    <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.assignedUsers && tenant.assignedUsers.length > 0 ? (
                    tenant.assignedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800">{tr('نشط', 'Active')}</Badge>
                          ) : (
                            <Badge variant="destructive">{tr('غير نشط', 'Inactive')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setUserToMove(user);
                                setIsMoveUserOpen(true);
                              }}
                            >
                              <ArrowRight className="h-4 w-4 mr-1" />
                              {tr('نقل', 'Move')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {tr('إزالة', 'Remove')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {tr('حذف', 'Delete')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {tr('لا يوجد مستخدمون معينون لهذا المستأجر', 'No users assigned to this tenant')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Assign Existing Users Panel */}
          <Card>
            <CardHeader>
              <CardTitle>{tr('تعيين مستخدمين حاليين', 'Assign Existing Users')}</CardTitle>
              <CardDescription>
                {tr('اختر مستخدمين لتعيينهم لهذا المستأجر. يشمل المستخدمين غير المعينين ومستخدمين من مستأجرين آخرين (سيتم نقلهم).', 'Select users to assign to this tenant. Includes unassigned users and users from other tenants (will be moved).')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.availableUsers && tenant.availableUsers.length > 0 ? (
                <>
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>{tr('الاسم', 'Name')}</TableHead>
                          <TableHead>{tr('البريد الإلكتروني', 'Email')}</TableHead>
                          <TableHead>{tr('الدور', 'Role')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenant.availableUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUserIds([...selectedUserIds, user.id]);
                                  } else {
                                    setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>{user.firstName} {user.lastName}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {tr(`${selectedUserIds.length} مستخدم محدد`, `${selectedUserIds.length} user(s) selected`)}
                      {tenant.userCount !== undefined && tenant.maxUsers && (
                        <span className="ml-2">
                          ({tr('الحالي:', 'Current:')} {tenant.userCount} / {tr('الأقصى:', 'Max:')} {tenant.maxUsers})
                        </span>
                      )}
                    </p>
                    <Button
                      onClick={handleAssignUsers}
                      disabled={selectedUserIds.length === 0 || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {tr('جاري التعيين...', 'Assigning...')}
                        </>
                      ) : (
                        <>
                          <Users className="h-4 w-4 mr-2" />
                          {tr('تعيين المستخدمين المحددين', 'Assign Selected Users')}
                        </>
                      )}
                    </Button>
                  </div>
                  {tenant.userCount !== undefined && tenant.maxUsers && 
                   (tenant.userCount + selectedUserIds.length) > tenant.maxUsers && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {tr(
                          `تعيين ${selectedUserIds.length} مستخدم سيتجاوز الحد الأقصى ${tenant.maxUsers} مستخدم. الحالي: ${tenant.userCount}، سيصبح: ${tenant.userCount + selectedUserIds.length}`,
                          `Assigning ${selectedUserIds.length} user(s) would exceed the maximum of ${tenant.maxUsers} users. Current: ${tenant.userCount}, Would be: ${tenant.userCount + selectedUserIds.length}`
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {tr('لا يوجد مستخدمون متاحون للتعيين. جميع المستخدمين معينون بالفعل لمستأجرين.', 'No available users to assign. All users are already assigned to tenants.')}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('إعدادات التكامل', 'Integration Settings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenant.integrations?.samHealth ? (
                <>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">{tr('التكامل مفعل', 'Integration Enabled')}</Label>
                    </div>
                    <Switch
                      checked={tenant.integrations.samHealth.enabled}
                      onCheckedChange={async (checked) => {
                        if (!tenantId) return;
                        const newIntegrations = {
                          samHealth: {
                            ...tenant.integrations!.samHealth!,
                            enabled: checked,
                          },
                        };
                        const response = await fetch(`/api/owner/tenants/${tenantId}/integrations`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newIntegrations),
                          credentials: 'include',
                        });
                        if (response.ok) {
                          setTenant({ ...tenant, integrations: newIntegrations });
                          toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم تحديث إعدادات التكامل', 'Integration settings updated') });
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">{tr('التشغيل التلقائي مفعل', 'Auto-Trigger Enabled')}</Label>
                    </div>
                    <Switch
                      checked={tenant.integrations.samHealth.autoTriggerEnabled}
                      onCheckedChange={async (checked) => {
                        if (!tenantId) return;
                        const newIntegrations = {
                          samHealth: {
                            ...tenant.integrations!.samHealth!,
                            autoTriggerEnabled: checked,
                          },
                        };
                        const response = await fetch(`/api/owner/tenants/${tenantId}/integrations`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newIntegrations),
                          credentials: 'include',
                        });
                        if (response.ok) {
                          setTenant({ ...tenant, integrations: newIntegrations });
                          toast({ title: tr('تم بنجاح', 'Success'), description: tr('تم تحديث إعدادات التكامل', 'Integration settings updated') });
                        }
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">{tr('لم يتم تهيئة إعدادات التكامل', 'No integration settings configured')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{tr('منطقة خطرة', 'Danger Zone')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {tr('حذف المستأجر سيحذف نهائياً جميع البيانات المرتبطة بما في ذلك المستخدمين والجلسات والأحداث السريرية.', 'Deleting a tenant will permanently delete all associated data including users, sessions, and clinical events.')}
                </AlertDescription>
              </Alert>
              <Dialog open={isDeleteOpen} onOpenChange={(open) => {
                console.log('[TenantDetailsPage] Delete dialog open changed:', open);
                setIsDeleteOpen(open);
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tr('حذف المستأجر', 'Delete Tenant')}</DialogTitle>
                    <DialogDescription>
                      {tr(`هل أنت متأكد من حذف المستأجر "${tenant?.tenantId || tenantId}"؟ لا يمكن التراجع عن هذا الإجراء.`, `Are you sure you want to delete tenant "${tenant?.tenantId || tenantId}"? This action cannot be undone.`)}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        console.log('[TenantDetailsPage] Cancel button clicked');
                        setIsDeleteOpen(false);
                      }}
                      disabled={isSaving}
                    >
                      {tr('إلغاء', 'Cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        console.log('[TenantDetailsPage] Delete button clicked');
                        handleDeleteTenant();
                      }}
                      disabled={isSaving || !tenant}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {tr('جاري الحذف...', 'Deleting...')}
                        </>
                      ) : (
                        tr('حذف المستأجر', 'Delete Tenant')
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Move User Dialog */}
      <Dialog open={isMoveUserOpen} onOpenChange={setIsMoveUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('نقل المستخدم', 'Move User')}</DialogTitle>
            <DialogDescription>
              {tr(`نقل ${userToMove?.firstName} ${userToMove?.lastName} (${userToMove?.email}) إلى مستأجر آخر`, `Move ${userToMove?.firstName} ${userToMove?.lastName} (${userToMove?.email}) to another tenant`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="moveToTenant">{tr('المستأجر الهدف', 'Target Tenant')}</Label>
              <Select value={moveToTenantId} onValueChange={setMoveToTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر المستأجر', 'Select tenant')} />
                </SelectTrigger>
                <SelectContent>
                  {allTenants
                    .filter(t => t.tenantId !== tenantId)
                    .map((t) => (
                      <SelectItem key={t.tenantId} value={t.tenantId}>
                        {t.tenantId} {t.name ? `(${t.name})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsMoveUserOpen(false);
              setUserToMove(null);
              setMoveToTenantId('');
            }}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleMoveUser} disabled={!moveToTenantId || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tr('جاري النقل...', 'Moving...')}
                </>
              ) : (
                tr('نقل المستخدم', 'Move User')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

