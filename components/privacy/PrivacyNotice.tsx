'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface PrivacyNoticeProps {
  compact?: boolean;
}

export function PrivacyNotice({ compact = false }: PrivacyNoticeProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (compact) {
    return (
      <p className="text-xs text-muted-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {tr('بالمتابعة، أنت توافق على', 'By proceeding, you agree to our')}{' '}
        <Link href="/p/privacy-policy" className="text-primary underline underline-offset-2 hover:text-primary/80">
          {tr('سياسة الخصوصية', 'Privacy Policy')}
        </Link>{' '}
        {tr('وفقاً لنظام حماية البيانات الشخصية.', 'in accordance with PDPL.')}
      </p>
    );
  }

  return (
    <div
      className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="p-2 rounded-lg bg-blue-100 text-blue-600 shrink-0">
        <Shield className="w-4 h-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {tr('إشعار الخصوصية', 'Privacy Notice')}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {tr(
            'نحن نحمي بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية (PDPL) في المملكة العربية السعودية. بالمتابعة، أنت توافق على جمع ومعالجة بياناتك الشخصية لأغراض تقديم الرعاية الصحية.',
            'We protect your personal data in accordance with the Saudi Personal Data Protection Law (PDPL). By proceeding, you agree to the collection and processing of your personal data for healthcare delivery purposes.'
          )}
        </p>
        <Link
          href="/p/privacy-policy"
          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 inline-block"
        >
          {tr('اقرأ سياسة الخصوصية الكاملة', 'Read the full Privacy Policy')}
        </Link>
      </div>
    </div>
  );
}
