'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Shield, AlertTriangle, Plus, Loader2, RefreshCw, LogOut, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const isRTL = language === 'ar';
  const { me, isLoading: meLoading, error } = useMe();
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    blockedTenants: 0,
    totalUsers: 0,
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (meLoading) return;

    if (error || !me) {
      router.push('/login?redirect=/owner');
      setIsLoading(false);
      return;
    }

    const userRole = me.user?.role;
    
    if (userRole === 'thea-owner') {
      setIsOwner(true);
      fetchStats();
    } else {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('مطلوب صلاحية مالك المنصة', 'Thea Owner access required'),
        variant: 'destructive',
      });
      router.push('/platforms');
    }
    setIsLoading(false);
  }, [me, meLoading, error, router, toast]);

  async function fetchStats() {
    try {
      const response = await fetch('/api/owner/tenants?stats=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
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

  async function handleChangePassword() {
    if (!currentPassword || !newPassword) {
      toast({ title: tr('خطأ', 'Error'), description: tr('ادخل الرمز الحالي والرمز الجديد', 'Enter current and new password'), variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: tr('خطأ', 'Error'), description: tr('الرمز الجديد لازم يكون 6 حروف على الأقل', 'New password must be at least 6 characters'), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: tr('خطأ', 'Error'), description: tr('الرمز الجديد وتأكيد الرمز مو متطابقين', 'New password and confirmation do not match'), variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/owner/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('نجح', 'Success'), description: tr('تم تغيير الرمز بنجاح', 'Password changed successfully') });
        setShowPasswordForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const msg = data.errorCode === 'invalid_current_password' ? tr('الرمز الحالي غير صحيح', 'Current password is incorrect') : (data.error || tr('فشل تغيير الرمز', 'Failed to change password'));
        toast({ title: tr('خطأ', 'Error'), description: msg, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال بالسيرفر', 'Connection to server failed'), variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{tr('لوحة تحكم المالك', 'Thea Owner Console')}</h1>
          <p className="text-muted-foreground">{tr('إدارة المستأجرين والاشتراكات وصلاحيات المنصة', 'Manage tenants, subscriptions, and platform access')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/platforms')}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {tr('العودة للمنصات', 'Back to Platforms')}
          </Button>
          <Button onClick={() => router.push('/owner/tenants')}>
            <Plus className="h-4 w-4 mr-2" />
            {tr('مستأجر جديد', 'New Tenant')}
          </Button>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {tr('تسجيل الخروج', 'Logout')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tr('إجمالي المستأجرين', 'Total Tenants')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tr('المستأجرون النشطون', 'Active Tenants')}</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tr('المستأجرون المحظورون', 'Blocked Tenants')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.blockedTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tr('إجمالي المستخدمين', 'Total Users')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/owner/tenants')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>{tr('إدارة المستأجرين', 'Manage Tenants')}</CardTitle>
            </div>
            <CardDescription>
              {tr('عرض وإدارة جميع المستأجرين', 'View and manage all tenants')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tr('إنشاء، تعديل، حظر، أو حذف المستأجرين', 'Create, edit, block, or delete tenants')}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/owner/users')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>{tr('جميع المستخدمين', 'All Users')}</CardTitle>
            </div>
            <CardDescription>
              {tr('عرض وإدارة جميع المستخدمين في النظام', 'View and manage all users in the system')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tr('بحث، عرض، وحذف المستخدمين عبر جميع المستأجرين', 'Search, view, and delete users across all tenants')}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/owner/setup')}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>{tr('مستأجر تطوير المالك', 'Owner Development Tenant')}</CardTitle>
            </div>
            <CardDescription>
              {tr('إعداد مستأجر مخصص للتطوير والاختبار', 'Setup dedicated tenant for development and testing')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tr('إنشاء مستأجر مع تفعيل جميع المنصات للتطوير المستقل', 'Create a tenant with all platforms enabled for independent development')}
            </p>
          </CardContent>
        </Card>

        <Card className={showPasswordForm ? '' : 'cursor-pointer hover:shadow-lg transition-shadow'} onClick={() => !showPasswordForm && setShowPasswordForm(true)}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary shrink-0" />
              <CardTitle>{tr('تغيير الرمز', 'Change Password')}</CardTitle>
            </div>
            <CardDescription>
              {tr('تغيير رمز الدخول لحساب الأونر', 'Change login password for the owner account')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showPasswordForm ? (
              <p className="text-sm text-muted-foreground">{tr('اضغط هنا لتغيير الرمز', 'Click here to change password')}</p>
            ) : (
              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label>{tr('الرمز الحالي', 'Current Password')}</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={tr('ادخل الرمز الحالي', 'Enter current password')}
                      className="pe-10"
                    />
                    <button type="button" className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tr('الرمز الجديد', 'New Password')}</Label>
                  <div className="relative">
                    <Input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={tr('ادخل الرمز الجديد', 'Enter new password')}
                      className="pe-10"
                    />
                    <button type="button" className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{tr('تأكيد الرمز الجديد', 'Confirm New Password')}</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={tr('أعد إدخال الرمز الجديد', 'Re-enter new password')}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleChangePassword} disabled={changingPassword} className="gap-2">
                    {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {tr('حفظ', 'Save')}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                    {tr('إلغاء', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

