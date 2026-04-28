'use client';

import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';

/**
 * Contextual help button that links to a specific help article.
 *
 * Usage:
 *   import { HelpButton } from '@/components/cvision/HelpButton';
 *   <HelpButton articleId="gosi-contributions" tooltip="Learn about GOSI rates" />
 *
 * Place next to complex sections (e.g., GOSI rates, Nitaqat bands,
 * payroll deductions) to give users quick access to relevant documentation.
 */
interface HelpButtonProps {
  articleId: string;
  tooltip?: string;
  size?: 'sm' | 'md';
}

export function HelpButton({ articleId, tooltip, size = 'sm' }: HelpButtonProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dim = size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs';
  const resolvedTooltip = tooltip || tr('مساعدة', 'Help');

  return (
    <Link
      href={`/cvision/help#${articleId}`}
      title={resolvedTooltip}
      className={`inline-flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition ${dim}`}
    >
      ?
    </Link>
  );
}
