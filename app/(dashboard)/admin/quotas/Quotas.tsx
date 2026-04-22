'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface Quota {
  id: string;
  scopeType: 'group' | 'user';
  scopeId: string;
  featureKey: string;
  limit: number;
  used: number;
  status: 'active' | 'locked';
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Group {
  id: string;
  name: string;
  code: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export default function Quotas() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [formData, setFormData] = useState({
    scopeType: 'group' as 'group' | 'user',
    scopeId: '',
    featureKeys: [] as string[], // Changed to array for multi-select
    limit: '',
    status: 'active' as 'active' | 'locked',
    startsAt: '',
    endsAt: '',
  });

  const featureKeys = [
    { value: 'policy.search', label: 'Document Search' },
    { value: 'policy.view', label: 'Document View' },
    { value: 'policy.export', label: 'Document Export' },
  ];

  useEffect(() => {
    fetchQuotas();
    fetchGroups();
    fetchUsers();
  }, []);

  async function fetchQuotas() {
    try {
      const response = await fetch('/api/admin/quotas', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setQuotas(data.quotas || []);
      }
    } catch (error) {
      console.error('Failed to fetch quotas:', error);
    }
  }

  async function fetchGroups() {
    try {
      const response = await fetch('/api/admin/groups', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation: At least one feature must be selected
    if (formData.featureKeys.length === 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب اختيار ميزة واحدة على الأقل' : 'Please select at least one feature',
        variant: 'destructive',
      });
      return;
    }

    // Validation: At least Limit or End Date must be provided
    const hasLimit = formData.limit && parseInt(formData.limit) > 0;
    const hasEndDate = formData.endsAt && formData.endsAt.trim() !== '';

    if (!hasLimit && !hasEndDate) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)' : 'Please provide either Limit or End Date (or both)',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create a quota for each selected feature
      const quotaPromises = formData.featureKeys.map(async (featureKey) => {
        const quotaData: any = {
          scopeType: formData.scopeType,
          scopeId: formData.scopeId,
          featureKey: featureKey,
          status: formData.status,
        };

        // Add limit if provided
        if (hasLimit) {
          quotaData.limit = parseInt(formData.limit);
        } else {
          // If no limit, set a very high default (or handle differently)
          quotaData.limit = 999999;
        }

        // Add endsAt if provided
        if (hasEndDate) {
          quotaData.endsAt = new Date(formData.endsAt).toISOString();
        }

        // Add startsAt if provided
        if (formData.startsAt && formData.startsAt.trim() !== '') {
          quotaData.startsAt = new Date(formData.startsAt).toISOString();
        }

        const response = await fetch('/api/admin/quotas', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quotaData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to create quota for ${featureKey}`);
        }

        return response.json();
      });

      await Promise.all(quotaPromises);

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar'
          ? `تم إنشاء ${formData.featureKeys.length} حصة بنجاح`
          : `Successfully created ${formData.featureKeys.length} quota(s)`,
      });
      setIsDialogOpen(false);
      fetchQuotas();
      setFormData({
        scopeType: 'group',
        scopeId: '',
        featureKeys: [],
        limit: '',
        status: 'active',
        startsAt: '',
        endsAt: '',
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create quota',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuota) return;

    // Validation: At least Limit or End Date must be provided
    const hasLimit = formData.limit && formData.limit.trim() !== '' && parseInt(formData.limit) > 0;
    const hasEndDate = formData.endsAt && formData.endsAt.trim() !== '';

    // Check current quota to see if it already has limit or endsAt
    const currentHasLimit = editingQuota.limit && editingQuota.limit > 0 && editingQuota.limit < 999999;
    const currentHasEndDate = editingQuota.endsAt;

    // Determine what will remain after update
    const willHaveLimit = hasLimit || (!hasLimit && formData.limit === '' && currentHasLimit);
    const willHaveEndDate = hasEndDate || (!hasEndDate && formData.endsAt === '' && currentHasEndDate);

    // Must have at least one constraint
    if (!willHaveLimit && !willHaveEndDate) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar'
          ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)'
          : 'Must provide either Limit or End Date (or both)',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updateData: any = {};

      // Only send limit if it's being updated (provided and different from current)
      if (hasLimit) {
        const limitValue = parseInt(formData.limit);
        if (limitValue !== editingQuota.limit) {
          updateData.limit = limitValue;
        }
      }
      // If limit is empty string, don't send it (keep current)

      if (formData.status) updateData.status = formData.status;

      // Handle endsAt - can be set or removed (null)
      if (formData.endsAt && formData.endsAt.trim() !== '') {
        const newEndsAt = new Date(formData.endsAt).toISOString();
        const currentEndsAt = editingQuota.endsAt ? new Date(editingQuota.endsAt).toISOString() : null;
        if (newEndsAt !== currentEndsAt) {
          updateData.endsAt = newEndsAt;
        }
      } else if (formData.endsAt === '' && editingQuota.endsAt) {
        // Remove endsAt by setting to null
        updateData.endsAt = null;
      }
      // If endsAt is empty and current is also empty, don't send it

      const response = await fetch(`/api/admin/quotas/${editingQuota.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث الحصة بنجاح' : 'Quota updated successfully',
        });
        setIsEditDialogOpen(false);
        setEditingQuota(null);
        fetchQuotas();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update quota');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update quota',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(quota: Quota) {
    setEditingQuota(quota);
    setFormData({
      scopeType: quota.scopeType,
      scopeId: quota.scopeId,
      featureKeys: [quota.featureKey], // Single feature for edit (can't change feature in edit)
      limit: quota.limit ? quota.limit.toString() : '',
      status: quota.status,
      startsAt: quota.startsAt || '',
      endsAt: quota.endsAt ? new Date(quota.endsAt).toISOString().slice(0, 16) : '', // Format for datetime-local input
    });
    setIsEditDialogOpen(true);
  }

  function getScopeName(scopeType: string, scopeId: string): string {
    if (scopeType === 'group') {
      const group = groups.find(g => g.id === scopeId);
      return group ? group.name : scopeId;
    } else {
      const user = users.find(u => u.id === scopeId);
      return user ? `${user.firstName} ${user.lastName} (${user.email})` : scopeId;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {language === 'ar' ? 'إدارة الحصص' : 'Demo Quota Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'إدارة حصص النسخة التجريبية للمستخدمين والمجموعات' : 'Manage demo quotas for users and groups'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إضافة حصة' : 'Create Quota'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إنشاء حصة جديدة' : 'Create New Quota'}</DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'قم بإنشاء حصة تجريبية للمستخدمين أو المجموعات' : 'Create a demo quota for users or groups'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'نوع النطاق' : 'Scope Type'}</span>
                <Select
                  value={formData.scopeType}
                  onValueChange={(value: 'group' | 'user') => {
                    setFormData({ ...formData, scopeType: value, scopeId: '' });
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">{language === 'ar' ? 'مجموعة' : 'Group'}</SelectItem>
                    <SelectItem value="user">{language === 'ar' ? 'مستخدم' : 'User'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formData.scopeType === 'group'
                    ? (language === 'ar' ? 'المجموعة' : 'Group')
                    : (language === 'ar' ? 'المستخدم' : 'User')}
                </span>
                <Select
                  value={formData.scopeId}
                  onValueChange={(value) => setFormData({ ...formData, scopeId: value })}
                  required
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={formData.scopeType === 'group' ? (language === 'ar' ? 'اختر مجموعة' : 'Select group') : (language === 'ar' ? 'اختر مستخدم' : 'Select user')} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.scopeType === 'group'
                      ? groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} ({group.code})
                          </SelectItem>
                        ))
                      : users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} ({user.email})
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الميزات (يمكن اختيار أكثر من واحد)' : 'Features (can select multiple)'}</span>
                <div className="border border-border rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  {featureKeys.map((fk) => (
                    <div key={fk.value} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`feature-new-${fk.value}`}
                        checked={formData.featureKeys.includes(fk.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              featureKeys: [...formData.featureKeys, fk.value],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              featureKeys: formData.featureKeys.filter(key => key !== fk.value),
                            });
                          }
                        }}
                      />
                      <span
                        className="text-sm font-normal cursor-pointer flex-1 text-foreground"
                        onClick={() => {
                          const isChecked = formData.featureKeys.includes(fk.value);
                          if (isChecked) {
                            setFormData({
                              ...formData,
                              featureKeys: formData.featureKeys.filter(key => key !== fk.value),
                            });
                          } else {
                            setFormData({
                              ...formData,
                              featureKeys: [...formData.featureKeys, fk.value],
                            });
                          }
                        }}
                      >
                        {fk.label}
                      </span>
                    </div>
                  ))}
                </div>
                {formData.featureKeys.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'يرجى اختيار ميزة واحدة على الأقل' : 'Please select at least one feature'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحد الأقصى (اختياري)' : 'Limit (Optional)'}</span>
                <Input
                  type="number"
                  min="1"
                  value={formData.limit}
                  onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                  placeholder={language === 'ar' ? 'أدخل الحد الأقصى أو اتركه فارغاً' : 'Enter limit or leave empty'}
                  className="rounded-xl thea-input-focus"
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)'
                    : 'Must provide either Limit or End Date (or both)'}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</span>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'active' | 'locked') => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                    <SelectItem value="locked">{language === 'ar' ? 'مقفل' : 'Locked'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'End Date (Optional)'}</span>
                <Input
                  type="datetime-local"
                  value={formData.endsAt}
                  onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                  placeholder={language === 'ar' ? 'اختر تاريخ الانتهاء أو اتركه فارغاً' : 'Select end date or leave empty'}
                  className="rounded-xl thea-input-focus"
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)'
                    : 'Must provide either Limit or End Date (or both)'}
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsDialogOpen(false)}
                >
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isLoading} className="rounded-xl">
                  {isLoading ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">{language === 'ar' ? 'الحصص' : 'Quotas'}</h2>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'عرض وإدارة جميع الحصص' : 'View and manage all quotas'}
        </p>

        {/* Table header */}
        <div className="grid grid-cols-7 gap-4 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'النطاق' : 'Scope'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الميزة' : 'Feature'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحد الأقصى' : 'Limit'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'المستخدم' : 'Used'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'المتاح' : 'Available'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</span>
        </div>

        {/* Table rows */}
        {quotas.map((quota) => (
          <div key={quota.id} className="grid grid-cols-7 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
            <div>
              <div className="font-medium text-foreground">
                {quota.scopeType === 'group'
                  ? (language === 'ar' ? 'مجموعة: ' : 'Group: ')
                  : (language === 'ar' ? 'مستخدم: ' : 'User: ')}
                {getScopeName(quota.scopeType, quota.scopeId)}
              </div>
            </div>
            <span className="text-foreground">{quota.featureKey}</span>
            <span className="text-foreground">
              {quota.limit && quota.limit < 999999 ? quota.limit : (language === 'ar' ? 'غير محدد' : 'Unlimited')}
            </span>
            <span className="text-foreground">{quota.used}</span>
            <span className="text-foreground">
              {quota.limit && quota.limit < 999999
                ? Math.max(0, quota.limit - quota.used)
                : (language === 'ar' ? 'غير محدود' : 'Unlimited')}
            </span>
            <div>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  quota.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {quota.status === 'active'
                  ? (language === 'ar' ? 'نشط' : 'Active')
                  : (language === 'ar' ? 'مقفل' : 'Locked')}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => handleEdit(quota)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل الحصة' : 'Edit Quota'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث الحصة' : 'Update quota settings'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحد الأقصى (اختياري)' : 'Limit (Optional)'}</span>
              <Input
                type="number"
                min="1"
                value={formData.limit}
                onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل الحد الأقصى أو اتركه فارغاً' : 'Enter limit or leave empty'}
                className="rounded-xl thea-input-focus"
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)'
                  : 'Must provide either Limit or End Date (or both)'}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</span>
              <Select
                value={formData.status}
                onValueChange={(value: 'active' | 'locked') => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                  <SelectItem value="locked">{language === 'ar' ? 'مقفل' : 'Locked'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'End Date (Optional)'}</span>
              <Input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                placeholder={language === 'ar' ? 'اختر تاريخ الانتهاء أو اتركه فارغاً' : 'Select end date or leave empty'}
                className="rounded-xl thea-input-focus"
              />
              <p className="text-xs text-muted-foreground">
                {language === 'ar'
                  ? 'يجب تحديد الحد الأقصى أو تاريخ الانتهاء (أو كليهما)'
                  : 'Must provide either Limit or End Date (or both)'}
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingQuota(null);
                }}
              >
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl">
                {isLoading ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
