'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/contexts/TenantContext';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { useLang } from '@/hooks/use-lang';

export function TenantOrgProfileGuard({ children }: { children: React.ReactNode }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { isLoading, error } = useTenantContext();
  const { me, isLoading: meLoading } = useMe();
  const { platform: platformData } = usePlatform();
  const router = useRouter();
  const pathname = usePathname();

  const isSetupPage = pathname?.startsWith('/admin/organization-profile');

  // Only require org profile when user has SAM entitlement AND is on SAM platform
  const hasSamEntitlement = !!(
    me?.effectiveEntitlements?.sam ?? me?.tenantEntitlements?.sam ?? false
  );
  const isOnSamPlatform =
    pathname?.startsWith('/sam') ||
    pathname?.startsWith('/platforms/sam') ||
    platformData?.platform === 'sam';

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">{tr('جاري تحميل الملف التنظيمي...', 'Loading organization profile...')}</div>
      </div>
    );
  }

  // When ORG_PROFILE_REQUIRED, wait for me to determine if user has SAM (needed for org profile)
  if (error === 'ORG_PROFILE_REQUIRED' && !isSetupPage) {
    if (meLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>
        </div>
      );
    }
    if (!hasSamEntitlement || !isOnSamPlatform) {
      // Thea Health only, or not on SAM — org profile is SAM-specific, skip guard
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold">{tr('الملف التنظيمي مطلوب', 'Organization profile required')}</h2>
          <p className="text-sm text-muted-foreground">
            {tr('حدد نوع المنظمة والقطاع والدولة لفتح المنصة.', 'Set your organization type, sector, and country to unlock the platform.')}
          </p>
          <Button onClick={() => router.push('/admin/organization-profile')}>
            {tr('الذهاب إلى الملف التنظيمي', 'Go to organization profile')}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
