'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/hooks/use-lang';

/**
 * Tenant Entitlements Page (DISABLED)
 * 
 * This page has been moved to Owner Console.
 * Tenant admins cannot manage entitlements - only Thea Owner can.
 * 
 * This page redirects to /owner if user is thea-owner,
 * or shows an access denied message if user is tenant-admin.
 */
export default function EntitlementsPage() {
  const router = useRouter();
  const { me } = useMe();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  useEffect(() => {
    if (!me) return;

    const userRole = me.user?.role;

    if (userRole === 'thea-owner') {
      // Redirect thea-owner to owner console
      router.push('/owner/tenants');
    }
  }, [me, router]);

  return (
    <div className="container mx-auto p-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>{tr('تم رفض الوصول', 'Access Denied')}</strong>
          <br />
          {tr('يمكن إدارة صلاحيات المستأجر فقط بواسطة مالك Thea.', 'Tenant entitlements can only be managed by Thea Owner.')}
          <br />
          <br />
          {tr('إذا كنت مالك Thea، سيتم توجيهك إلى وحدة المالك.', 'If you are a Thea Owner, you will be redirected to the Owner Console.')}
          <br />
          {tr('إذا كنت مدير مستأجر، يرجى التواصل مع مالك Thea لإدارة صلاحيات المنصة.', 'If you are a Tenant Admin, please contact your Thea Owner to manage platform entitlements.')}
        </AlertDescription>
      </Alert>
    </div>
  );
}
