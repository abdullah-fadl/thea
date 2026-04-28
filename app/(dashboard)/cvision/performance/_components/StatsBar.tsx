'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import {
  Users,
  Clock,
  FileEdit,
  UserCheck,
  CheckCircle,
} from 'lucide-react';

export interface PerformanceStats {
  total: number;
  notStarted: number;
  selfReview: number;
  managerReview: number;
  completed: number;
}

export function computePerformanceStats(
  reviews: { status: string }[]
): PerformanceStats {
  const stats: PerformanceStats = {
    total: reviews.length,
    notStarted: 0,
    selfReview: 0,
    managerReview: 0,
    completed: 0,
  };

  for (const r of reviews) {
    switch (r.status) {
      case 'NOT_STARTED':
        stats.notStarted++;
        break;
      case 'SELF_REVIEW':
        stats.selfReview++;
        break;
      case 'MANAGER_REVIEW':
      case 'CALIBRATION':
        stats.managerReview++;
        break;
      case 'COMPLETED':
      case 'ACKNOWLEDGED':
        stats.completed++;
        break;
    }
  }
  return stats;
}

interface StatsBarProps {
  stats: PerformanceStats;
  loading: boolean;
}

const STAT_CARDS = [
  {
    key: 'total' as const,
    label: 'Total Reviews',
    icon: Users,
    border: 'border-l-blue-500',
    iconColor: 'text-blue-500',
  },
  {
    key: 'notStarted' as const,
    label: 'Awaiting Self-Review',
    icon: Clock,
    border: 'border-l-amber-500',
    iconColor: 'text-amber-500',
  },
  {
    key: 'selfReview' as const,
    label: 'Awaiting Manager Review',
    icon: FileEdit,
    border: 'border-l-indigo-500',
    iconColor: 'text-indigo-500',
  },
  {
    key: 'managerReview' as const,
    label: 'In Calibration',
    icon: UserCheck,
    border: 'border-l-purple-500',
    iconColor: 'text-purple-500',
  },
  {
    key: 'completed' as const,
    label: 'Completed',
    icon: CheckCircle,
    border: 'border-l-green-500',
    iconColor: 'text-green-500',
  },
];

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
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className={`rounded-lg border border-l-4 ${card.border} bg-card p-3`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted }}>{card.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{stats[card.key]}</p>
              </div>
              <Icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
