'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';

/**
 * SAM Platform Layout Guard (Client Component)
 *
 * Client-side guard that checks SAM platform access by calling /api/auth/me.
 * Uses client-side router.replace() instead of server-side redirect() to avoid
 * the Next.js 14 "Cannot update component while rendering Router" crash that
 * occurs when server components call redirect() during client-side navigation.
 *
 * Auth is already enforced by middleware; this adds platform-specific checks.
 */
export default function SAMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [status, setStatus] = useState<'loading' | 'ok' | 'redirect'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setStatus('redirect');
            router.replace('/login?redirect=/sam');
          }
          return;
        }
        const data = await res.json();
        const role = (data.user?.role || '').toLowerCase();
        const isOwner = role === 'thea-owner' || role === 'thea_owner';
        const tenantId = data.user?.activeTenantId || data.tenantId;

        // Owner without selected tenant
        if (!tenantId && isOwner) {
          if (!cancelled) {
            setStatus('redirect');
            router.replace('/platforms?reason=select_tenant&platform=sam');
          }
          return;
        }

        if (!tenantId) {
          if (!cancelled) {
            setStatus('redirect');
            router.replace('/login?redirect=/sam');
          }
          return;
        }

        // Check SAM entitlement from entitlements
        const entitlements = data.user?.effectiveEntitlements || data.user?.tenantEntitlements || {};
        const hasSAM = !!entitlements.sam;

        // Owner and admin always have access; others need SAM entitlement
        if (!hasSAM && !isOwner && role !== 'admin' && role !== 'tenant-admin') {
          if (!cancelled) {
            setStatus('redirect');
            router.replace('/platforms?reason=not_entitled&platform=sam');
          }
          return;
        }

        if (!cancelled) {
          setStatus('ok');
        }
      } catch {
        if (!cancelled) {
          setStatus('redirect');
          router.replace('/login?redirect=/sam');
        }
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {tr('جاري التحقق من الصلاحيات...', 'Checking access...')}
        </div>
      </div>
    );
  }

  if (status === 'redirect') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {tr('جاري إعادة التوجيه...', 'Redirecting...')}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
