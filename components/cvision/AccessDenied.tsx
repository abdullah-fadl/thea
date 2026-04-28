'use client';
import { ShieldX, ArrowLeft, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionCard, CVisionCardBody, CVisionButton } from '@/components/cvision/ui';

interface AccessDeniedProps { message?: string; }

export default function AccessDenied({ message }: AccessDeniedProps) {
  const router = useRouter();
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 24,
      }}
    >
      <CVisionCard C={C} hover={false} style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <CVisionCardBody style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: C.redDim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldX size={32} color={C.red} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
            {tr('ليس لديك صلاحية الوصول', 'Access Denied')}
          </h2>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {message || tr(
              'ليس لديك الصلاحيات المطلوبة للوصول إلى هذه الصفحة. تواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.',
              'You don\'t have permission to access this page. Contact your system administrator if you believe this is an error.'
            )}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<ArrowLeft size={14} />} onClick={() => router.back()}>
              {tr('رجوع', 'Go Back')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="ghost" icon={<Mail size={14} />} onClick={() => { window.location.href = 'mailto:hr@company.com'; }}>
              {tr('تواصل مع HR', 'Contact HR')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}
