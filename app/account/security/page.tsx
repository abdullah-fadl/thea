'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowRight } from 'lucide-react';

export default function AccountSecurityPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const searchParams = useSearchParams();
  const require2fa = searchParams.get('require2fa') === '1';

  const [skipping, setSkipping] = useState(false);

  // If 2FA is not required, redirect to platforms
  useEffect(() => {
    if (!require2fa) {
      router.push('/platforms');
    }
  }, [require2fa, router]);

  const handleSkip = async () => {
    setSkipping(true);
    // For now, redirect to platforms - 2FA setup will be enforced later
    router.push('/platforms');
  };

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-xl">
            {tr('المصادقة الثنائية مطلوبة', 'Two-Factor Authentication Required')}
          </CardTitle>
          <CardDescription>
            {tr(
              'حسابات المدراء تتطلب تفعيل المصادقة الثنائية لحماية النظام',
              'Admin accounts require 2FA to be enabled for system security'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {tr(
              'هذه الميزة قيد التطوير. يمكنك المتابعة مؤقتاً.',
              'This feature is under development. You can continue for now.'
            )}
          </p>
          <Button
            onClick={handleSkip}
            disabled={skipping}
            className="w-full gap-2"
          >
            {tr('متابعة للمنصات', 'Continue to Platforms')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
