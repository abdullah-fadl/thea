'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getOrganizationTypeLabel } from '@/lib/sam/orgProfile';
import { SamTopNav } from '@/components/sam/SamTopNav';
import { useLang } from '@/hooks/use-lang';

type OrgProfile = {
  organizationName: string;
  organizationType: string;
  organizationTypeLabel?: string;
  maturityStage: string;
  onboardingPhase: string;
  selectedStandards: string[];
};

type OrgProfileResponse = {
  profile: OrgProfile;
  setupComplete: boolean;
};

function SamContextHeader({
  profile,
  setupComplete,
  returnTo,
}: {
  profile: OrgProfile;
  setupComplete: boolean;
  returnTo: string | null;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const standards = profile.selectedStandards || [];
  const orgTypeLabel =
    profile.organizationTypeLabel || getOrganizationTypeLabel(profile.organizationType || '');
  const target = returnTo ? `/sam/setup?returnTo=${encodeURIComponent(returnTo)}` : '/sam/setup';

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase text-muted-foreground">{tr('سياق المؤسسة', 'Organization context')}</div>
          <div className="text-lg font-semibold">{profile.organizationName || tr('المؤسسة', 'Organization')}</div>
          <div className="text-sm text-muted-foreground">
            {orgTypeLabel} · {profile.maturityStage} · {tr('مرحلة', 'phase')} {profile.onboardingPhase}
          </div>
          {standards.length ? (
            <div className="flex flex-wrap gap-2">
              {standards.map((standard) => (
                <Badge key={standard} variant="secondary">
                  {standard}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{tr('لم يتم اختيار معايير', 'No standards selected')}</div>
          )}
          {!setupComplete && (
            <div className="text-xs text-amber-600">
              {tr('أكمل الإعداد لتفعيل التحليل المتوافق مع المؤسسة.', 'Finish setup to unlock organization-aware analysis.')}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(target)}>
          {tr('تعديل السياق', 'Edit context')}
        </Button>
      </CardContent>
    </Card>
  );
}

export function SamOrgProfileGate({ children }: { children: React.ReactNode }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [setupComplete, setSetupComplete] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSetupPage = useMemo(() => pathname?.startsWith('/sam/setup'), [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sam/org-profile', { credentials: 'include' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load organization profile');
        }
        const data = (await response.json()) as OrgProfileResponse;
        if (cancelled) return;
        setProfile(data.profile);
        setSetupComplete(Boolean(data.setupComplete));
        if (!data.setupComplete && !isSetupPage) {
          router.replace(`/sam/setup?returnTo=${encodeURIComponent(pathname || '/sam')}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || tr('فشل تحميل ملف المؤسسة', 'Failed to load organization profile'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isSetupPage, router, pathname, tr]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">{tr('جاري تحميل سياق المؤسسة...', 'Loading SAM context...')}</div>;
  }

  if (error) {
    return (
      <>
        <SamTopNav />
        <div className="text-sm text-destructive p-4">{error}</div>
        {children}
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <SamTopNav />
        {children}
      </>
    );
  }

  return (
    <>
      <SamContextHeader
        profile={profile}
        setupComplete={setupComplete}
        returnTo={pathname || '/sam'}
      />
      {!isSetupPage && <SamTopNav />}
      {children}
    </>
  );
}
