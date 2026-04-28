'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, AlertCircle, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  platformAccess?: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };
}

export default function PlatformAccessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/admin/users', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
          setFilteredUsers(data.users || []);
        } else if (response.status === 403) {
          toast({
            title: tr('تم رفض الوصول', 'Access Denied'),
            description: tr('مطلوب صلاحية المدير', 'Admin access required'),
            variant: 'destructive',
          });
          router.push('/admin');
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

    fetchUsers();
  }, [router, toast]);

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
          user.lastName.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, users]);

  async function handlePlatformAccessChange(
    userId: string,
    platform: 'sam' | 'health' | 'edrac' | 'cvision',
    enabled: boolean
  ) {
    setSavingUserId(userId);
    try {
      const user = users.find((u) => u.id === userId);
      const currentAccess = user?.platformAccess || {};
      const newAccess = {
        ...currentAccess,
        [platform]: enabled,
      };

      const response = await fetch(`/api/admin/users/${userId}/platform-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccess),
        credentials: 'include',
      });

      if (response.ok) {
        // Update local state
        setUsers(
          users.map((u) =>
            u.id === userId
              ? { ...u, platformAccess: newAccess }
              : u
          )
        );
        toast({
          title: tr('تم بنجاح', 'Success'),
          description: tr('تم تحديث صلاحيات وصول المستخدم للمنصة. يحتاج المستخدم لتسجيل الخروج وإعادة الدخول لتطبيق التغييرات.', 'User platform access updated. The user needs to log out and log back in for changes to take effect.'),
          duration: 5000,
        });
      } else {
        const error = await response.json();
        const errorMessage = error.details 
          ? `${error.error}: ${error.details}` 
          : error.error || tr('فشل تحديث صلاحيات وصول المنصة', 'Failed to update platform access');
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Failed to update platform access:', error);
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('فشل تحديث صلاحيات وصول المنصة', 'Failed to update platform access'),
        variant: 'destructive',
      });
    } finally {
      setSavingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{tr('صلاحيات وصول المستخدم للمنصات', 'User Platform Access')}</h1>
          <p className="text-muted-foreground">
            {tr('التحكم في المنصات التي يمكن لكل مستخدم الوصول إليها ضمن صلاحيات المستأجر', 'Control which platforms each user can access within tenant entitlements')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {tr('خروج', 'Logout')}
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>{tr('ملاحظة:', 'Note:')}</strong> {tr('تغييرات صلاحيات الوصول تتطلب تسجيل خروج المستخدم وإعادة الدخول لتطبيقها. يتم إنشاء رمز JWT عند تسجيل الدخول ويتضمن الصلاحيات.', 'Changes to platform access require the user to log out and log back in to take effect. The JWT token is created at login time and includes entitlements.')}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{tr('المستخدمون', 'Users')}</CardTitle>
          <CardDescription>
            {tr('تعيين صلاحيات المنصة لكل مستخدم. المستخدمون بدون صلاحيات محددة سيرثون صلاحيات المستأجر.', 'Set per-user platform access. Users without specific access will inherit tenant entitlements.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('البحث بالاسم أو البريد الإلكتروني...', 'Search users by name or email...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('المستخدم', 'User')}</TableHead>
                  <TableHead>{tr('الدور', 'Role')}</TableHead>
                  <TableHead className="text-center">SAM</TableHead>
                  <TableHead className="text-center">Health</TableHead>
                  <TableHead className="text-center">EDRAC</TableHead>
                  <TableHead className="text-center">CVision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {tr('لا يوجد مستخدمون', 'No users found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{user.role}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.sam ?? true}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'sam', checked)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.health ?? true}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'health', checked)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.edrac ?? false}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'edrac', checked)
                            }
                            disabled
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {savingUserId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <Switch
                            checked={user.platformAccess?.cvision ?? false}
                            onCheckedChange={(checked) =>
                              handlePlatformAccessChange(user.id, 'cvision', checked)
                            }
                            disabled
                          />
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

