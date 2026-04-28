'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Loader2, ArrowLeft, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface Tenant {
  id?: string;
  tenantId: string;
  name?: string;
  status: 'active' | 'blocked';
  planType: 'demo' | 'paid';
  subscriptionEndsAt?: Date;
  maxUsers: number;
  userCount?: number;
  entitlements: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
    imdad: boolean;
  };
  createdAt: string;
}

interface OrganizationType {
  id: string;
  name: string;
  sector: string;
  countryCode?: string | null;
  status: 'ACTIVE' | 'DRAFT_PENDING_REVIEW' | 'REJECTED';
}

export default function TenantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<Tenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [orgTypesAll, setOrgTypesAll] = useState<OrganizationType[]>([]);
  const [isLoadingOrgTypes, setIsLoadingOrgTypes] = useState(false);
  const [useCustomOrgType, setUseCustomOrgType] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: '',
    name: '',
    maxUsers: 10,
    planType: 'demo' as 'demo' | 'paid',
    status: 'active' as 'active' | 'blocked',
    orgTypeId: '',
    sector: '',
    countryCode: '',
    orgTypeDraftName: '',
    orgTypeDraftSector: '',
    orgTypeDraftCountryCode: '',
  });

  const sectorOptions = [
    'healthcare',
    'education',
    'government',
    'manufacturing',
    'logistics',
    'hospitality',
    'finance',
    'energy',
    'other',
  ];

  const countryOptions = [
    { code: 'SA', label: 'Saudi Arabia' },
    { code: 'AE', label: 'United Arab Emirates' },
    { code: 'QA', label: 'Qatar' },
    { code: 'KW', label: 'Kuwait' },
    { code: 'BH', label: 'Bahrain' },
    { code: 'OM', label: 'Oman' },
    { code: 'US', label: 'United States' },
    { code: 'UK', label: 'United Kingdom' },
    { code: 'EG', label: 'Egypt' },
    { code: 'IN', label: 'India' },
  ];

  useEffect(() => {
    fetchTenants();
    fetchOrgTypes();
    fetchAllOrgTypes();
  }, []);

  async function fetchOrgTypes() {
    setIsLoadingOrgTypes(true);
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
    } finally {
      setIsLoadingOrgTypes(false);
    }
  }

  async function fetchAllOrgTypes() {
    try {
      const response = await fetch('/api/owner/org-types', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOrgTypesAll(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch organization types list:', error);
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenants(tenants);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredTenants(
      tenants.filter(
        (tenant) =>
          String(tenant.tenantId || '').toLowerCase().includes(query) ||
          tenant.name?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, tenants]);

  async function fetchTenants() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/tenants', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const tenantsList = data.tenants || [];
        
        // Log for debugging
        console.log('[TenantsPage] Fetched tenants:', tenantsList.length, tenantsList);
        
        // Ensure all tenants have tenantId (use fallback if missing)
        const normalizedTenants = tenantsList.map((tenant: any) => ({
          ...tenant,
          tenantId: String(tenant.tenantId || tenant.id || `tenant-${tenant.id || 'unknown'}`),
        }));
        
        setTenants(normalizedTenants);
        setFilteredTenants(normalizedTenants);
      } else if (response.status === 403) {
        toast({
          title: tr('تم رفض الوصول', 'Access Denied'),
          description: tr('مطلوب صلاحية مالك ثيا', 'Thea Owner access required'),
          variant: 'destructive',
        });
        router.push('/owner');
      } else {
        throw new Error('Failed to fetch tenants');
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل المستأجرين', 'Failed to load tenants'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateTenant() {
    setIsCreating(true);
    try {
      const payload = {
        tenantId: formData.tenantId,
        name: formData.name,
        maxUsers: formData.maxUsers,
        planType: formData.planType,
        status: formData.status,
        sector: useCustomOrgType ? formData.orgTypeDraftSector : formData.sector,
        countryCode: useCustomOrgType ? formData.orgTypeDraftCountryCode : formData.countryCode,
        ...(useCustomOrgType
          ? {
              orgTypeDraftPayload: {
                name: formData.orgTypeDraftName,
                sector: formData.orgTypeDraftSector,
                countryCode: formData.orgTypeDraftCountryCode || null,
              },
            }
          : { orgTypeId: formData.orgTypeId }),
      };

      const response = await fetch('/api/owner/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم إنشاء المستأجر بنجاح', 'Tenant created successfully'),
        });
        setIsDialogOpen(false);
        setFormData({
          tenantId: '',
          name: '',
          maxUsers: 10,
          planType: 'demo',
          status: 'active',
          orgTypeId: '',
          sector: '',
          countryCode: '',
          orgTypeDraftName: '',
          orgTypeDraftSector: '',
          orgTypeDraftCountryCode: '',
        });
        setUseCustomOrgType(false);
        await fetchTenants();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Failed to create tenant:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل إنشاء المستأجر', 'Failed to create tenant'),
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  }

  function getEffectiveStatus(tenant: Tenant): 'active' | 'blocked' | 'expired' | 'expiring_soon' {
    if (tenant.status === 'blocked') return 'blocked';
    if (tenant.subscriptionEndsAt) {
      const endsAt = new Date(tenant.subscriptionEndsAt);
      const now = new Date();
      if (endsAt <= now) return 'expired';
      const daysLeft = (endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 7) return 'expiring_soon';
    }
    return 'active';
  }

  function getStatusBadge(tenant: Tenant) {
    const effective = getEffectiveStatus(tenant);
    if (effective === 'expired') {
      return (
        <Badge className="bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1 w-fit">
          <AlertTriangle className="h-3 w-3" />
          {tr('منتهي', 'Expired')}
        </Badge>
      );
    }
    if (effective === 'expiring_soon') {
      return (
        <Badge className="bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          {tr('ينتهي قريباً', 'Expiring')}
        </Badge>
      );
    }
    if (effective === 'active') {
      return <Badge className="bg-green-100 text-green-800 border border-green-300">{tr('نشط', 'Active')}</Badge>;
    }
    return <Badge variant="destructive">{tr('محظور', 'Blocked')}</Badge>;
  }

  function getPlanBadge(planType: string) {
    if (planType === 'paid') {
      return <Badge className="bg-blue-100 text-blue-800">{tr('مدفوع', 'Paid')}</Badge>;
    }
    return <Badge variant="outline">{tr('تجريبي', 'Demo')}</Badge>;
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tr('رجوع', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tr('المستأجرون', 'Tenants')}</h1>
            <p className="text-muted-foreground">{tr('إدارة جميع المستأجرين والاشتراكات', 'Manage all tenants and subscriptions')}</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {tr('مستأجر جديد', 'New Tenant')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tr('إنشاء مستأجر جديد', 'Create New Tenant')}</DialogTitle>
              <DialogDescription>
                {tr('إنشاء مستأجر جديد بالإعدادات الافتراضية', 'Create a new tenant with default settings')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tenantId">{tr('معرّف المستأجر *', 'Tenant ID *')}</Label>
                <Input
                  id="tenantId"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  placeholder={tr('مثال: tenant-123', 'e.g., tenant-123')}
                  className="bg-background text-foreground placeholder:text-foreground/75"
                />
              </div>
              <div>
                <Label htmlFor="name">{tr('الاسم', 'Name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={tr('اسم المستأجر (اختياري)', 'Optional tenant name')}
                  className="bg-background text-foreground placeholder:text-foreground/75"
                />
              </div>
              <div>
                <Label htmlFor="orgType">{tr('نوع المنظمة *', 'Organization Type *')}</Label>
                <select
                  id="orgType"
                  value={useCustomOrgType ? 'custom' : formData.orgTypeId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'custom') {
                      setUseCustomOrgType(true);
                      setFormData((prev) => ({
                        ...prev,
                        orgTypeId: '',
                        sector: '',
                        countryCode: '',
                      }));
                      return;
                    }
                    const selected = orgTypes.find((type) => type.id === value);
                    setUseCustomOrgType(false);
                    setFormData((prev) => ({
                      ...prev,
                      orgTypeId: value,
                      sector: selected?.sector || prev.sector,
                      countryCode: selected?.countryCode || prev.countryCode,
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                  disabled={isLoadingOrgTypes}
                >
                  <option value="" disabled>
                    {isLoadingOrgTypes ? tr('جاري تحميل أنواع المنظمات...', 'Loading organization types...') : tr('اختر نوع المنظمة', 'Select organization type')}
                  </option>
                  {orgTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                  <option value="custom">{tr('غير مدرج؟ أضف جديد...', 'Not listed? Add new…')}</option>
                </select>
              </div>
              {useCustomOrgType && (
                <div className="space-y-4 rounded-md border p-3">
                  <div>
                    <Label htmlFor="orgTypeDraftName">{tr('نوع منظمة جديد *', 'New Organization Type *')}</Label>
                    <Input
                      id="orgTypeDraftName"
                      value={formData.orgTypeDraftName}
                      onChange={(e) => setFormData({ ...formData, orgTypeDraftName: e.target.value })}
                      placeholder={tr('مثال: مستشفى، عيادة، مصنع', 'e.g., Hospital, Clinic, Factory')}
                      className="bg-background text-foreground placeholder:text-foreground/75"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgTypeDraftSector">{tr('القطاع *', 'Sector *')}</Label>
                    <select
                      id="orgTypeDraftSector"
                      value={formData.orgTypeDraftSector}
                      onChange={(e) => setFormData({ ...formData, orgTypeDraftSector: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                    >
                      <option value="" disabled>
                        {tr('اختر القطاع', 'Select sector')}
                      </option>
                      {sectorOptions.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="orgTypeDraftCountryCode">{tr('الدولة/المنطقة *', 'Country/Region *')}</Label>
                    <select
                      id="orgTypeDraftCountryCode"
                      value={formData.orgTypeDraftCountryCode}
                      onChange={(e) => setFormData({ ...formData, orgTypeDraftCountryCode: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                    >
                      <option value="" disabled>
                        {tr('اختر الدولة/المنطقة', 'Select country/region')}
                      </option>
                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {!useCustomOrgType && (
                <>
                  <div>
                    <Label htmlFor="sector">{tr('القطاع *', 'Sector *')}</Label>
                    <select
                      id="sector"
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                    >
                      <option value="" disabled>
                        {tr('اختر القطاع', 'Select sector')}
                      </option>
                      {sectorOptions.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="countryCode">{tr('الدولة/المنطقة *', 'Country/Region *')}</Label>
                    <select
                      id="countryCode"
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                    >
                      <option value="" disabled>
                        {tr('اختر الدولة/المنطقة', 'Select country/region')}
                      </option>
                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="maxUsers">{tr('أقصى عدد مستخدمين', 'Max Users')}</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  min={1}
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 10 })}
                  className="bg-background text-foreground placeholder:text-foreground/75"
                />
              </div>
              <div>
                <Label htmlFor="planType">{tr('نوع الخطة', 'Plan Type')}</Label>
                <select
                  id="planType"
                  value={formData.planType}
                  onChange={(e) => setFormData({ ...formData, planType: e.target.value as 'demo' | 'paid' })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground border-border"
                >
                  <option value="demo">{tr('تجريبي', 'Demo')}</option>
                  <option value="paid">{tr('مدفوع', 'Paid')}</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                onClick={handleCreateTenant}
                disabled={
                  !formData.tenantId ||
                  isCreating ||
                  (useCustomOrgType
                    ? !formData.orgTypeDraftName || !formData.orgTypeDraftSector || !formData.orgTypeDraftCountryCode
                    : !formData.orgTypeId || !formData.sector || !formData.countryCode)
                }
              >
                {isCreating ? (
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

      <Card>
        <CardHeader>
          <CardTitle>{tr('جميع المستأجرين', 'All Tenants')}</CardTitle>
          <CardDescription>{tr('عرض وإدارة اشتراكات المستأجرين', 'View and manage tenant subscriptions')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('البحث بمعرّف أو اسم المستأجر...', 'Search tenants by ID or name...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('معرّف المستأجر', 'Tenant ID')}</TableHead>
                  <TableHead>{tr('الاسم', 'Name')}</TableHead>
                  <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  <TableHead>{tr('الخطة', 'Plan')}</TableHead>
                  <TableHead>{tr('تاريخ الانتهاء', 'Expires')}</TableHead>
                  <TableHead>{tr('المستخدمون', 'Users')}</TableHead>
                  <TableHead>{tr('أقصى عدد', 'Max Users')}</TableHead>
                  <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {tenants.length > 0
                        ? tr('لا يوجد مستأجرون مطابقون للبحث', 'No tenants match your search')
                        : tr('لا يوجد مستأجرون', 'No tenants found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants
                    .filter((tenant) => {
                      // Filter out tenants without tenantId - they shouldn't be displayed
                      const hasTenantId = tenant.tenantId || tenant.id;
                      if (!hasTenantId) {
                        console.warn('Tenant missing tenantId:', tenant);
                      }
                      return !!hasTenantId;
                    })
                    .map((tenant, index) => {
                      const tenantId = tenant.tenantId || tenant.id;
                      const tenantKey = tenantId || `tenant-${index}`;
                      
                      return (
                        <TableRow key={tenantKey}>
                          <TableCell className="font-medium">{tenantId}</TableCell>
                          <TableCell>{tenant.name || '-'}</TableCell>
                          <TableCell>{getStatusBadge(tenant)}</TableCell>
                          <TableCell>{getPlanBadge(tenant.planType)}</TableCell>
                          <TableCell className="text-sm">
                            {tenant.subscriptionEndsAt ? (
                              (() => {
                                const endsAt = new Date(tenant.subscriptionEndsAt);
                                const now = new Date();
                                const isPast = endsAt <= now;
                                const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                  <span className={isPast ? 'text-orange-600 font-medium' : daysLeft <= 7 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                                    {isPast
                                      ? tr(`انتهى منذ ${Math.abs(daysLeft)} يوم`, `Expired ${Math.abs(daysLeft)}d ago`)
                                      : daysLeft === 0
                                      ? tr('ينتهي اليوم', 'Expires today')
                                      : tr(`${daysLeft} يوم متبقي`, `${daysLeft}d left`)}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{tenant.userCount || 0}</TableCell>
                          <TableCell>{tenant.maxUsers}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (tenantId) {
                                  router.push(`/owner/tenants/${tenantId}`);
                                } else {
                                  toast({
                                    title: tr('خطأ', 'Error'),
                                    description: tr('معرّف المستأجر مفقود', 'Tenant ID is missing'),
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              {tr('عرض', 'View')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('أنواع المنظمات', 'Organization Types')}</CardTitle>
          <CardDescription>{tr('مراجعة واعتماد أنواع المنظمات', 'Review and approve organization types')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الاسم', 'Name')}</TableHead>
                  <TableHead>{tr('القطاع', 'Sector')}</TableHead>
                  <TableHead>{tr('الدولة', 'Country')}</TableHead>
                  <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgTypesAll.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      {tr('لا توجد أنواع منظمات', 'No organization types found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  orgTypesAll.map((orgType) => (
                    <TableRow key={orgType.id}>
                      <TableCell className="font-medium">{orgType.name}</TableCell>
                      <TableCell>{orgType.sector}</TableCell>
                      <TableCell>{orgType.countryCode || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={orgType.status === 'ACTIVE' ? 'default' : 'outline'}>
                          {orgType.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {orgType.status === 'DRAFT_PENDING_REVIEW' ? (
                          <Button
                            size="sm"
                            onClick={async () => {
                              const response = await fetch(`/api/owner/org-types/${orgType.id}/approve`, {
                                method: 'POST',
                                credentials: 'include',
                              });
                              if (response.ok) {
                                toast({
                                  title: tr('تم بنجاح', 'Success'),
                                  description: tr('تمت الموافقة على نوع المنظمة', 'Organization type approved'),
                                });
                                await fetchOrgTypes();
                                await fetchAllOrgTypes();
                              } else {
                                toast({
                                  title: tr('خطأ', 'Error'),
                                  description: tr('فشلت الموافقة على نوع المنظمة', 'Failed to approve organization type'),
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            {tr('موافقة', 'Approve')}
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">{tr('تمت الموافقة', 'Approved')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

