'use client';

import { getConfidenceLabel, getConfidenceColor, getConfidenceLevel } from '@/lib/ai/safety/confidence';
import { useLang } from '@/hooks/use-lang';

interface AiConfidenceBadgeProps {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Displays confidence level as a colored badge.
 * Shows on all AI suggestions.
 */
export default function AiConfidenceBadge({
  value,
  showLabel = true,
  size = 'sm',
  className = '',
}: AiConfidenceBadgeProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const level = getConfidenceLevel(value);
  const label = getConfidenceLabel(level);
  const color = getConfidenceColor(level);
  const percentage = Math.round(value * 100);

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${color} ${sizeClasses} ${className}`}
      title={tr(`الثقة: ${percentage}% (${label.ar})`, `Confidence: ${percentage}% (${label.en})`)}
    >
      <span className="font-bold">{percentage}%</span>
      {showLabel && <span>{tr(label.ar, label.en)}</span>}
    </span>
  );
}
