'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { FileText, Clock, Eye, CheckCircle, AlertTriangle } from 'lucide-react';

export interface RequestStats {
  total: number;
  open: number;
  inReview: number;
  completed: number;
  slaBreached: number;
}

interface StatsBarProps {
  stats: RequestStats;
  loading?: boolean;
}

const STAT_CONFIG = [
  { key: 'total', label: 'Total Requests', icon: FileText, border: 'border-blue-500', text: 'text-blue-700' },
  { key: 'open', label: 'Open / Pending', icon: Clock, border: 'border-amber-500', text: 'text-amber-700' },
  { key: 'inReview', label: 'In Review', icon: Eye, border: 'border-indigo-500', text: 'text-indigo-700' },
  { key: 'completed', label: 'Completed', icon: CheckCircle, border: 'border-green-500', text: 'text-green-700' },
  { key: 'slaBreached', label: 'SLA Breached', icon: AlertTriangle, border: 'border-red-500', text: 'text-red-700' },
] as const;

export function computeRequestStats(requests: any[]): RequestStats {
  return {
    total: requests.length,
    open: requests.filter(r => r.status === 'open' || r.status === 'escalated').length,
    inReview: requests.filter(r => r.status === 'in_review').length,
    completed: requests.filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'closed').length,
    slaBreached: requests.filter(r => r.slaBreached).length,
  };
}

export default function StatsBar({ stats, loading }: StatsBarProps) {
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
        const value = stats[cfg.key as keyof RequestStats];
        return (
          <div
            key={cfg.key}
            className={`border-l-4 ${cfg.border} bg-card rounded-r-lg p-3 border shadow-sm`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{cfg.label}</span>
            </div>
            <p className={`text-xl font-bold ${cfg.text}`}>
              {value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
