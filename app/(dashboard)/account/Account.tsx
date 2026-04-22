'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';

interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
}

export default function Account() {
  const { me, isLoading: meLoading } = useMe();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const user = me?.user as UserInfo | null;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: tr('خطأ', 'Error'),
        description: tr('كلمات المرور غير متطابقة', 'Passwords do not match'),
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (response.ok) {
        toast({
          title: tr('نجاح', 'Success'),
          description: tr('تم تغيير كلمة المرور بنجاح', 'Password changed successfully'),
        });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await response.json();
        // Show detailed validation errors if available
        const detailMessage = data.message || data.error || tr('فشل تغيير كلمة المرور', 'Failed to change password');
        throw new Error(detailMessage);
      }
    } catch (error) {
      toast({
        title: tr('خطأ', 'Error'),
        description: error instanceof Error ? error.message : tr('خطأ', 'Error'),
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  if (meLoading || !user) {
    return <div className="text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold text-foreground">{tr('إعدادات الحساب', 'Account Settings')}</h1>
        <p className="text-muted-foreground">{tr('إدارة تفضيلات حسابك', 'Manage your account preferences')}</p>
      </div>

      <div className="md:hidden">
        <div className="rounded-2xl bg-card border border-border p-4">
          <h2 className="text-lg font-bold text-foreground">{tr('إعدادات الحساب', 'Account Settings')}</h2>
          <p className="text-sm text-muted-foreground">{tr('إدارة تفضيلات حسابك', 'Manage your account preferences')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Profile Information */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border text-center">
            <h3 className="font-bold text-foreground">{tr('معلومات الملف الشخصي', 'Profile Information')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{tr('تفاصيل حسابك', 'Your account details')}</p>
          </div>
          <div className="p-5 space-y-4 text-center">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الاسم', 'Name')}</label>
              <input
                value={`${user.firstName} ${user.lastName}`}
                disabled
                className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted text-foreground text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('البريد الإلكتروني', 'Email')}</label>
              <input value={user.email} disabled className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted text-foreground text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الدور', 'Role')}</label>
              <input value={user.role} disabled className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted text-foreground text-sm capitalize" />
            </div>
            {user.department && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('القسم', 'Department')}</label>
                <input value={user.department} disabled className="w-full px-3 py-2 rounded-xl border-[1.5px] border-border bg-muted text-foreground text-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border text-center">
            <h3 className="font-bold text-foreground">{tr('تغيير كلمة المرور', 'Change Password')}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{tr('تحديث كلمة المرور', 'Update your password')}</p>
          </div>
          <div className="p-5">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="oldPassword" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور الحالية', 'Current Password')}</label>
                <input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('كلمة المرور الجديدة', 'New Password')}</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تأكيد كلمة المرور الجديدة', 'Confirm New Password')}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus"
                />
              </div>
              <button type="submit" disabled={isChangingPassword} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 thea-transition-fast w-full md:w-auto min-h-[44px]">
                {isChangingPassword ? tr('جاري التغيير...', 'Changing...') : tr('تغيير كلمة المرور', 'Change Password')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
