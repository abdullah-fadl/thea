'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

function DemoLimitNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [quotaInfo, setQuotaInfo] = useState<{
    featureKey?: string;
    limit?: number;
    used?: number;
    scopeType?: 'user' | 'group';
  } | null>(null);

  useEffect(() => {
    // Try to get quota info from URL params (if redirected from API)
    const featureKey = searchParams.get('feature');
    const limit = searchParams.get('limit');
    const used = searchParams.get('used');
    const scopeType = searchParams.get('scopeType') as 'user' | 'group' | null;

    if (featureKey) {
      setQuotaInfo({
        featureKey,
        limit: limit ? parseInt(limit) : undefined,
        used: used ? parseInt(used) : undefined,
        scopeType: scopeType || undefined,
      });
    }
  }, [searchParams]);

  const handleContact = () => {
    // Open email client or contact form
    window.location.href = 'mailto:support@thea.com?subject=Demo Quota Limit Reached&body=I have reached the demo quota limit and would like to upgrade my account.';
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden shadow-elevation-4">
        <div className="px-5 py-4 border-b border-border text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-500" />
          </div>
          <h2 className="font-extrabold text-2xl">
            {tr('\u062a\u0645 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649', 'Demo Limit Reached')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('\u0644\u0642\u062f \u0648\u0635\u0644\u062a \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0645\u0633\u0645\u0648\u062d \u0628\u0647 \u0641\u064a \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a\u0629', 'You have reached the demo quota limit for this feature')}
          </p>
        </div>
        <div className="p-5 space-y-4">
          {quotaInfo && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {tr('\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062d\u0635\u0629', 'Quota Information')}
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-1">
                <div>
                  <span className="font-medium">
                    {tr('\u0627\u0644\u0645\u064a\u0632\u0629: ', 'Feature: ')}
                  </span>
                  {quotaInfo.featureKey}
                </div>
                {quotaInfo.limit !== undefined && quotaInfo.used !== undefined && (
                  <div>
                    <span className="font-medium">
                      {tr('\u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645: ', 'Usage: ')}
                    </span>
                    {quotaInfo.used} / {quotaInfo.limit}
                    {quotaInfo.scopeType && (
                      <span className="text-muted-foreground ml-2">
                        ({quotaInfo.scopeType === 'user'
                          ? tr('\u0645\u0633\u062a\u062e\u062f\u0645', 'user')
                          : tr('\u0645\u062c\u0645\u0648\u0639\u0629', 'group')})
                      </span>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              {tr('\u0644\u0644\u062a\u0631\u0642\u064a\u0629 \u0625\u0644\u0649 \u062d\u0633\u0627\u0628 \u0643\u0627\u0645\u0644 \u0648\u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0648\u0635\u0648\u0644 \u063a\u064a\u0631 \u0645\u062d\u062f\u0648\u062f\u060c \u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0646\u0627.', 'To upgrade to a full account and get unlimited access, please contact us.')}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleContact} className="w-full rounded-xl" size="lg">
              <Mail className="h-4 w-4 mr-2" />
              {tr('\u0627\u062a\u0635\u0644 \u0628\u0646\u0627', 'Contact Us')}
            </Button>
            <Button
              onClick={handleGoBack}
              variant="outline"
              className="w-full rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {tr('\u0631\u062c\u0648\u0639', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoLimit() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <DemoLimitNewContent />
    </Suspense>
  );
}
