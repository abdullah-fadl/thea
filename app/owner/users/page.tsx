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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Search, Loader2, Trash2, AlertTriangle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId?: string;
  tenantName?: string;
  isActive: boolean;
  createdAt?: string;
}

export default function OwnerUsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [isChangeRoleDialogOpen, setIsChangeRoleDialogOpen] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query) ||
          (user.tenantId && user.tenantId.toLowerCase().includes(query))
      )
    );
  }, [searchQuery, users]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/users', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      } else if (response.status === 403) {
        toast({
          title: tr('تم رفض الوصول', 'Access Denied'),
          description: tr('مطلوب صلاحية مالك ثيا', 'Thea Owner access required'),
          variant: 'destructive',
        });
        router.push('/owner');
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('فشل تحميل المستخدمين', 'Failed to load users'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteClick(user: User) {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/owner/users/${userToDelete.id}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr(`تم حذف المستخدم ${userToDelete.email} بنجاح`, `User ${userToDelete.email} deleted successfully`),
        });
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
        await fetchUsers();
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
      setIsDeleting(false);
    }
  }

  function handleChangeRoleClick(user: User) {
    setUserToChangeRole(user);
    // Only supported role in this project is admin.
    setNewRole('admin');
    setIsChangeRoleDialogOpen(true);
  }

  async function handleChangeRoleConfirm() {
    if (!userToChangeRole || !newRole) return;

    setIsChangingRole(true);
    try {
      const response = await fetch(`/api/owner/users/${userToChangeRole.id}/change-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: data.message || tr('تم تغيير دور المستخدم بنجاح', 'User role changed successfully'),
        });
        setIsChangeRoleDialogOpen(false);
        setUserToChangeRole(null);
        setNewRole('');
        await fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to change user role');
      }
    } catch (error) {
      console.error('Failed to change role:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تغيير دور المستخدم', 'Failed to change user role'),
        variant: 'destructive',
      });
    } finally {
      setIsChangingRole(false);
    }
  }

  function getRoleBadge(role: string) {
    const roleColors: Record<string, string> = {
      'thea-owner': 'bg-purple-100 text-purple-800',
      'admin': 'bg-blue-100 text-blue-800',
    };
    return (
      <Badge className={roleColors[role] || 'bg-muted text-foreground'}>
        {role}
      </Badge>
    );
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
            <h1 className="text-3xl font-bold">{tr('جميع المستخدمين', 'All Users')}</h1>
            <p className="text-muted-foreground">{tr('عرض وإدارة جميع المستخدمين في النظام', 'View and manage all users in the system')}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('المستخدمون', 'Users')} ({users.length})</CardTitle>
          <CardDescription>
            {tr('جميع المستخدمين عبر جميع المستأجرين.', 'All users across all tenants.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('البحث بالبريد، الاسم، الدور، أو المستأجر...', 'Search by email, name, role, or tenant...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('الاسم', 'Name')}</TableHead>
                  <TableHead>{tr('البريد الإلكتروني', 'Email')}</TableHead>
                  <TableHead>{tr('الدور', 'Role')}</TableHead>
                  <TableHead>{tr('المستأجر', 'Tenant')}</TableHead>
                  <TableHead>{tr('الحالة', 'Status')}</TableHead>
                  <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {searchQuery ? tr('لا يوجد مستخدمون مطابقون للبحث', 'No users found matching your search') : tr('لا يوجد مستخدمون', 'No users found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.tenantName || user.tenantId ? (
                          <Badge variant="outline">{user.tenantName || user.tenantId}</Badge>
                        ) : (
                          <span className="text-muted-foreground">{tr('بدون مستأجر', 'No tenant')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge className="bg-green-100 text-green-800">{tr('نشط', 'Active')}</Badge>
                        ) : (
                          <Badge variant="destructive">{tr('غير نشط', 'Inactive')}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.role === 'thea-owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleChangeRoleClick(user)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {tr('تغيير الدور', 'Change Role')}
                            </Button>
                          )}
                          {user.role === 'thea-owner' ? (
                            <span className="text-muted-foreground text-sm">{tr('لا يمكن الحذف', 'Cannot delete')}</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(user)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {tr('حذف', 'Delete')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('حذف المستخدم', 'Delete User')}</DialogTitle>
            <DialogDescription>
              {tr('هل أنت متأكد من الحذف النهائي للمستخدم', 'Are you sure you want to permanently delete user')}{' '}
              <strong>{userToDelete?.email}</strong>?
              <br />
              <br />
              {tr('لا يمكن التراجع عن هذا الإجراء وسيحذف:', 'This action cannot be undone and will delete:')}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{tr('حساب المستخدم', 'The user account')}</li>
                <li>{tr('جميع جلسات المستخدم', 'All user sessions')}</li>
                <li>{tr('جميع سجلات التدقيق المتعلقة بهذا المستخدم', 'All audit logs related to this user')}</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeleting}
            >
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tr('جاري الحذف...', 'Deleting...')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tr('حذف المستخدم', 'Delete User')}
                </>
              )}
            </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleDialogOpen} onOpenChange={setIsChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('تغيير دور المستخدم', 'Change User Role')}</DialogTitle>
            <DialogDescription>
              {tr('تغيير دور المستخدم', 'Change role for user')} <strong>{userToChangeRole?.email}</strong>
              <br />
              <br />
              {tr('الدور الحالي:', 'Current role:')} <Badge className="bg-purple-100 text-purple-800">{userToChangeRole?.role}</Badge>
              <br />
              <br />
              {tr('بعد تغيير الدور، ستتمكن من حذف هذا المستخدم.', 'After changing the role, you will be able to delete this user.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{tr('الدور الجديد', 'New Role')}</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر الدور', 'Select role')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{tr('مدير', 'Admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsChangeRoleDialogOpen(false);
                setUserToChangeRole(null);
                setNewRole('');
              }}
              disabled={isChangingRole}
            >
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={handleChangeRoleConfirm}
              disabled={isChangingRole || !newRole || newRole === userToChangeRole?.role}
            >
              {isChangingRole ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {tr('جاري التغيير...', 'Changing...')}
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  {tr('تغيير الدور', 'Change Role')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

