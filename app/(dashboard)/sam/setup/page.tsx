'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ORGANIZATION_TYPE_CATALOG } from '@/lib/organization/catalog';
import { MATURITY_STAGES } from '@/lib/sam/orgProfile';
import { useLang } from '@/hooks/use-lang';

type OrgProfileResponse = {
  profile: {
    organizationName: string;
    organizationType: string;
    organizationTypeLabel?: string;
    maturityStage: string;
    isPartOfGroup: boolean;
    groupId?: string | null;
    selectedStandards: string[];
    onboardingPhase: string;
  };
  setupComplete: boolean;
};

export default function SamSetupPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const returnToParam = searchParams?.get('returnTo');
  const returnTo =
    returnToParam && returnToParam.startsWith('/') ? returnToParam : null;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [organizationName, setOrganizationName] = useState('');
  const [orgTypeMode, setOrgTypeMode] = useState<'catalog' | 'custom'>('catalog');
  const [organizationType, setOrganizationType] = useState('');
  const [customOrganizationType, setCustomOrganizationType] = useState('');
  const [maturityStage, setMaturityStage] = useState('');
  const [isPartOfGroup, setIsPartOfGroup] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [standardsText, setStandardsText] = useState('');
  const [onboardingPhase, setOnboardingPhase] = useState('Foundation');

  const catalogOptions = useMemo(
    () => ORGANIZATION_TYPE_CATALOG.map((item) => ({ id: item.orgTypeId, label: item.displayName })),
    []
  );

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
        const profile = data.profile;
        setOrganizationName(profile.organizationName || '');
        setMaturityStage(profile.maturityStage || '');
        setIsPartOfGroup(Boolean(profile.isPartOfGroup));
        setGroupId(profile.groupId || '');
        setStandardsText((profile.selectedStandards || []).join(', '));
        setOnboardingPhase(profile.onboardingPhase || 'Foundation');

        const catalogMatch = catalogOptions.find((item) => item.id === profile.organizationType);
        if (catalogMatch) {
          setOrgTypeMode('catalog');
          setOrganizationType(catalogMatch.id);
          setCustomOrganizationType('');
        } else if (profile.organizationType && profile.organizationType !== 'unknown') {
          setOrgTypeMode('custom');
          setOrganizationType('');
          setCustomOrganizationType(profile.organizationTypeLabel || profile.organizationType);
        } else {
          setOrgTypeMode('catalog');
          setOrganizationType('');
          setCustomOrganizationType('');
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
  }, [catalogOptions]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const standards = standardsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const organizationTypeValue =
        orgTypeMode === 'custom' ? customOrganizationType.trim() : organizationType.trim();

      if (!organizationTypeValue) {
        throw new Error(tr('نوع المؤسسة مطلوب.', 'Organization type is required.'));
      }
      if (!maturityStage) {
        throw new Error(tr('مرحلة النضج مطلوبة.', 'Maturity stage is required.'));
      }

      const response = await fetch('/api/sam/org-profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: organizationName.trim() ? organizationName.trim() : undefined,
          organizationType: organizationTypeValue,
          maturityStage,
          isPartOfGroup,
          groupId: isPartOfGroup ? groupId.trim() : null,
          selectedStandards: standards,
          onboardingPhase,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || tr('فشل حفظ ملف المؤسسة', 'Failed to save organization profile'));
      }

      toast({
        title: tr('تم حفظ سياق المؤسسة', 'Organization context saved'),
        description: tr('سيستخدم SAM هذا السياق للتحليل والتوصيات.', 'SAM will use this context for analysis and recommendations.'),
      });
      router.replace(returnTo || '/sam/library');
    } catch (err: any) {
      setError(err?.message || tr('فشل حفظ ملف المؤسسة', 'Failed to save organization profile'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{tr('إعداد سياق المؤسسة', 'Set up your organization context')}</CardTitle>
          <CardDescription>
            {tr('يستخدم SAM هذا الملف لتخصيص التحليل وترتيب الفجوات والتوصية بالخطوات التالية.', 'SAM uses this profile to tailor analysis, prioritize gaps, and recommend next steps.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">{tr('جاري تحميل ملف المؤسسة...', 'Loading organization profile...')}</div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium">{tr('اسم المؤسسة', 'Organization name')}</label>
                <Input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder={tr('مثال: مجموعة الرياض الصحية', 'e.g. Northwind Holdings')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{tr('نوع المؤسسة', 'Organization type')}</label>
                <Select
                  value={orgTypeMode === 'catalog' ? organizationType : 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setOrgTypeMode('custom');
                      setOrganizationType('');
                    } else {
                      setOrgTypeMode('catalog');
                      setOrganizationType(value);
                      setCustomOrganizationType('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر نوع المؤسسة', 'Select organization type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">{tr('أخرى (مخصص)', 'Other (custom)')}</SelectItem>
                  </SelectContent>
                </Select>
                {orgTypeMode === 'custom' && (
                  <Input
                    value={customOrganizationType}
                    onChange={(event) => setCustomOrganizationType(event.target.value)}
                    placeholder={tr('صف نوع مؤسستك', 'Describe your organization type')}
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{tr('مرحلة النضج', 'Maturity stage')}</label>
                <Select value={maturityStage} onValueChange={setMaturityStage}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر مرحلة النضج', 'Select maturity stage')} />
                  </SelectTrigger>
                  <SelectContent>
                    {MATURITY_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{tr('جزء من مجموعة؟', 'Part of a group?')}</p>
                  <p className="text-xs text-muted-foreground">
                    {tr('فعّل إذا كانت السياسات أو المعايير مشتركة عبر مؤسسة أم.', 'Turn on if policies or standards are shared across a parent organization.')}
                  </p>
                </div>
                <Switch checked={isPartOfGroup} onCheckedChange={setIsPartOfGroup} />
              </div>

              {isPartOfGroup && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{tr('معرّف المجموعة', 'Group identifier')}</label>
                  <Input
                    value={groupId}
                    onChange={(event) => setGroupId(event.target.value)}
                    placeholder={tr('مثال: المقر-الرئيسي', 'e.g. global-hq')}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">{tr('المعايير والأطر', 'Standards & frameworks')}</label>
                <Input
                  value={standardsText}
                  onChange={(event) => setStandardsText(event.target.value)}
                  placeholder="ISO 9001, ISO 27001, SOC 2"
                />
                <p className="text-xs text-muted-foreground">
                  {tr('أضف عدة إدخالات مفصولة بفواصل.', 'Add multiple entries separated by commas.')}
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <CardFooter className="px-0">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ السياق', 'Save context')}
                </Button>
              </CardFooter>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
