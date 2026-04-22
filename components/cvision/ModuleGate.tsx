'use client';
import { type ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionCard, CVisionCardBody } from '@/components/cvision/ui';

interface ModuleGateProps {
  moduleKey: string;
  enabledModules?: string[];
  children: ReactNode;
}

export default function ModuleGate({ moduleKey, enabledModules, children }: ModuleGateProps) {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  if (enabledModules && !enabledModules.includes(moduleKey)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', padding: 24 }}>
        <CVisionCard C={C} hover={false} style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <CVisionCardBody style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: C.bgSubtle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldOff size={28} color={C.textMuted} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
              {tr('هذه الوحدة غير مفعّلة', 'Module Not Enabled')}
            </h2>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {tr(
                'هذه الوحدة غير مفعلة لمؤسستك. تواصل مع المسؤول لتفعيلها.',
                'This module is not enabled for your organization. Contact your administrator to activate it.'
              )}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    );
  }

  return <>{children}</>;
}
