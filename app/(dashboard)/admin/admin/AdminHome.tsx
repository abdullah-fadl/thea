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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

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
}

interface Group {
  id: string;
  name: string;
  code: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  groupId: string;
}

export default function AdminHome() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'admin',
    groupId: '',
    hospitalId: '',
    department: '',
    staffId: '',
  });

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    fetchHospitals();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        // Show all users (removed filter to show all users in tenant)
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
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

  async function fetchHospitals() {
    try {
      const response = await fetch('/api/admin/hospitals', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setHospitals(data.hospitals || []);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals:', error);
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
        body: JSON.stringify({
          ...formData,
          permissions: [],
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? '\u0646\u062c\u062d' : 'Success',
          description: language === 'ar' ? '\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u0646\u062c\u0627\u062d' : 'User created successfully',
        });
        setIsDialogOpen(false);
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'admin',
          groupId: '',
          hospitalId: '',
          department: '',
          staffId: '',
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || tr('فشل إنشاء المستخدم', 'Failed to create user'));
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل إنشاء المستخدم', 'Failed to create user'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(language === 'ar' ? '\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u061f' : 'Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? '\u0646\u062c\u062d' : 'Success',
          description: language === 'ar' ? '\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u0646\u062c\u0627\u062d' : 'User deleted successfully',
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || tr('فشل حذف المستخدم', 'Failed to delete user'));
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
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      groupId: user.groupId || '',
      hospitalId: user.hospitalId || '',
      department: user.department || '',
      staffId: user.staffId || '',
    });
    setIsEditDialogOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setIsLoading(true);

    try {
      const updateData: any = {
        groupId: formData.groupId && formData.groupId !== 'none' ? formData.groupId : undefined,
        hospitalId: formData.hospitalId && formData.hospitalId !== 'none' ? formData.hospitalId : undefined,
        department: formData.department || undefined,
        staffId: formData.staffId || undefined,
      };

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
          title: language === 'ar' ? '\u0646\u062c\u062d' : 'Success',
          description: language === 'ar' ? '\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u0646\u062c\u0627\u062d' : 'User updated successfully',
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || tr('فشل تحديث المستخدم', 'Failed to update user'));
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تحديث المستخدم', 'Failed to update user'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredHospitals = hospitals.filter(h => !formData.groupId || h.groupId === formData.groupId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0628\u062f\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0627\u062a/\u0645\u0633\u062a\u0634\u0641\u064a\u0627\u062a' : 'Admin - Users without Groups/Hospitals'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0630\u064a\u0646 \u0644\u0627 \u064a\u0645\u0644\u0643\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0629 \u0623\u0648 \u0645\u0633\u062a\u0634\u0641\u0649 - \u064a\u0645\u0643\u0646\u0643 \u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062d\u0630\u0641' : 'Users without group or hospital assignment - you can add or delete'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? '\u0625\u0636\u0627\u0641\u0629 \u0645\u0633\u062a\u062e\u062f\u0645' : 'Add User'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl rounded-2xl">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? '\u0625\u0636\u0627\u0641\u0629 \u0645\u0633\u062a\u062e\u062f\u0645 \u062c\u062f\u064a\u062f' : 'Create New User'}</DialogTitle>
              <DialogDescription>
                {language === 'ar' ? '\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u062f\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0629 \u0623\u0648 \u0645\u0633\u062a\u0634\u0641\u0649' : 'Create a user without group or hospital'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم الأول', 'First Name')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('اسم العائلة', 'Last Name')}</span>
                  <Input
                    className="rounded-xl thea-input-focus"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور', 'Password')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</span>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value, hospitalId: '' })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{tr('مدير', 'Admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsDialogOpen(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button type="submit" className="rounded-xl" disabled={isLoading}>
                  {isLoading ? (language === 'ar' ? '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0646\u0634\u0627\u0621...' : 'Creating...') : (language === 'ar' ? '\u0625\u0646\u0634\u0627\u0621' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{language === 'ar' ? '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0628\u062f\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0627\u062a/\u0645\u0633\u062a\u0634\u0641\u064a\u0627\u062a' : 'Users without Groups/Hospitals'}</h2>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? '\u0639\u0631\u0636 \u0648\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0627\u0644\u0630\u064a\u0646 \u0644\u0627 \u064a\u0645\u0644\u0643\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0629 \u0623\u0648 \u0645\u0633\u062a\u0634\u0641\u0649' : 'View and manage users without group or hospital assignment'}
          </p>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-6 gap-4 px-4 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{language === 'ar' ? '\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a' : 'Actions'}</span>
        </div>

        {/* Table Body */}
        <div className="space-y-1">
          {users.length === 0 ? (
            <div className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl">
              <div className="col-span-6 text-center text-muted-foreground">
                {language === 'ar' ? '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646 \u0628\u062f\u0648\u0646 \u0645\u062c\u0645\u0648\u0639\u0627\u062a/\u0645\u0633\u062a\u0634\u0641\u064a\u0627\u062a' : 'No users without groups/hospitals'}
              </div>
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="grid grid-cols-6 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                <div className="font-medium">
                  {user.firstName} {user.lastName}
                </div>
                <div>{user.email}</div>
                <div>
                  <span className="capitalize">{user.role}</span>
                </div>
                <div>{user.department || '-'}</div>
                <div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500'
                    }`}
                  >
                    {user.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleEdit(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? '\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645' : 'Edit User'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? '\u0642\u0645 \u0628\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 (\u064a\u0645\u0643\u0646\u0643 \u0625\u0636\u0627\u0641\u0629 \u0645\u062c\u0645\u0648\u0639\u0629/\u0645\u0633\u062a\u0634\u0641\u0649 \u0623\u0648 \u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645)' : 'Update user (you can add group/hospital or delete user)'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={`${editingUser?.firstName} ${editingUser?.lastName}`}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</span>
                <Input
                  className="rounded-xl thea-input-focus"
                  value={editingUser?.email}
                  disabled
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)' : 'Group (Optional)'}</span>
              <Select
                value={formData.groupId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, groupId: value === 'none' ? '' : value, hospitalId: '' })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={language === 'ar' ? '\u0627\u062e\u062a\u0631 \u0645\u062c\u0645\u0648\u0639\u0629' : 'Select group'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{language === 'ar' ? '\u0644\u0627 \u064a\u0648\u062c\u062f' : 'None'}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.groupId && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? '\u0627\u0644\u0645\u0633\u062a\u0634\u0641\u0649 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)' : 'Hospital (Optional)'}</span>
                <Select
                  value={formData.hospitalId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, hospitalId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={language === 'ar' ? '\u0627\u062e\u062a\u0631 \u0645\u0633\u062a\u0634\u0641\u0649' : 'Select hospital'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? '\u0644\u0627 \u064a\u0648\u062c\u062f' : 'None'}</SelectItem>
                    {filteredHospitals.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        {hospital.name} ({hospital.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? '\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062c\u062f\u064a\u062f\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)' : 'New Password (Optional)'}</span>
              <Input
                className="rounded-xl thea-input-focus"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" className="rounded-xl" disabled={isLoading}>
                {isLoading ? (language === 'ar' ? '\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u062f\u064a\u062b...' : 'Updating...') : (language === 'ar' ? '\u062a\u062d\u062f\u064a\u062b' : 'Update')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
