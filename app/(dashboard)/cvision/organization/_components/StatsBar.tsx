'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { Building2, Layers, Briefcase, Target, TrendingUp } from 'lucide-react';

import type { OrgStatsData } from './types';

interface OrgStatsBarProps {
  stats: OrgStatsData;
  loading?: boolean;
}

const STAT_CONFIG = [
  { key: 'departments', labelAr: 'الأقسام', labelEn: 'Departments', icon: Building2, border: 'border-blue-500', text: 'text-blue-700' },
  { key: 'units', labelAr: 'الوحدات', labelEn: 'Units', icon: Layers, border: 'border-indigo-500', text: 'text-indigo-700' },
  { key: 'jobTitles', labelAr: 'المسميات الوظيفية', labelEn: 'Job Titles', icon: Briefcase, border: 'border-purple-500', text: 'text-purple-700' },
  { key: 'totalPositions', labelAr: 'إجمالي الوظائف', labelEn: 'Total Positions', icon: Target, border: 'border-orange-500', text: 'text-orange-700' },
  { key: 'avgDeptSize', labelAr: 'متوسط حجم القسم', labelEn: 'Avg Dept Size', icon: TrendingUp, border: 'border-cyan-500', text: 'text-cyan-700' },
] as const;

export default function OrgStatsBar({ stats, loading }: OrgStatsBarProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CVisionSkeletonCard C={C} height={200} key={i} style={{ borderRadius: 12 }}  />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {STAT_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        const value = stats[cfg.key as keyof OrgStatsData];
        return (
          <div
            key={cfg.key}
            className={`border-l-4 ${cfg.border} bg-card rounded-r-lg p-3 border shadow-sm`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{tr(cfg.labelAr, cfg.labelEn)}</span>
            </div>
            <p className={`text-xl font-bold ${cfg.text}`}>{value}</p>
          </div>
        );
      })}
    </div>
  );
}
