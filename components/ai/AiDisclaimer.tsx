'use client';

import { ShieldAlert } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

interface AiDisclaimerProps {
  text?: string;
  variant?: 'inline' | 'banner';
  className?: string;
}

/**
 * Standard AI disclaimer component.
 * Must be shown on ALL AI-generated content.
 */
export default function AiDisclaimer({
  text,
  variant = 'inline',
  className = '',
}: AiDisclaimerProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const displayText = text || tr(
    'اقتراحات بمساعدة الذكاء الاصطناعي فقط — القرارات السريرية النهائية تعود للطبيب المعالج',
    'AI-assisted suggestions only — final clinical decisions rest with the treating physician'
  );

  if (variant === 'banner') {
    return (
      <div className={`flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 ${className}`}>
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{displayText}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground ${className}`}>
      <ShieldAlert className="w-3 h-3 shrink-0" />
      <span>{displayText}</span>
    </div>
  );
}
