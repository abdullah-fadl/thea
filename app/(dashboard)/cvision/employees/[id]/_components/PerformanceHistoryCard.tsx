'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { Star, TrendingUp, TrendingDown, Minus, Inbox } from 'lucide-react';
import {
  RATING_BADGE_COLORS,
} from '@/lib/cvision/performance/performance-engine';

interface PerformanceHistoryCardProps {
  employeeId: string;
}

interface ReviewRecord {
  cycleId: string;
  cycleName?: string;
  year?: number;
  finalScore: number;
  rating: string;
  status: string;
}

// Map rating labels to RATING_BADGE_COLORS keys
function getRatingKey(rating: string): string {
  if (rating === 'Exceptional') return 'EXCEPTIONAL';
  if (rating === 'Exceeds Expectations') return 'EXCEEDS_EXPECTATIONS';
  if (rating === 'Meets Expectations') return 'MEETS_EXPECTATIONS';
  if (rating === 'Needs Improvement') return 'NEEDS_IMPROVEMENT';
  if (rating === 'Unsatisfactory') return 'UNSATISFACTORY';
  return '';
}

export default function PerformanceHistoryCard({
  employeeId,
}: PerformanceHistoryCardProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    async function fetchHistory() {
      try {
        const res = await fetch(
          `/api/cvision/performance?action=reviews&employeeId=${employeeId}`,
          { credentials: 'include', signal: ac.signal }
        );
        const data = await res.json();

        if (!res.ok) {
          setReviews([]);
          return;
        }

        // Filter to completed/acknowledged reviews with scores, take last 3
        const scored = (data.data?.items || data.data || [])
          .filter(
            (r: any) =>
              (r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED') &&
              r.finalScore > 0
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.completedAt || b.createdAt).getTime() -
              new Date(a.completedAt || a.createdAt).getTime()
          )
          .slice(0, 3);

        setReviews(scored);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }

    if (employeeId) fetchHistory();
    return () => ac.abort();
  }, [employeeId]);

  if (loading) {
    return (
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 160 }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ height: 64, width: '100%' }}  />
      </div>
    );
  }

  // Compute score trend
  let trendIcon = <Minus style={{ height: 16, width: 16, color: C.textMuted }} />;
  if (reviews.length >= 2) {
    const latest = reviews[0].finalScore;
    const previous = reviews[1].finalScore;
    if (latest > previous) {
      trendIcon = <TrendingUp style={{ height: 16, width: 16, color: C.green }} />;
    } else if (latest < previous) {
      trendIcon = <TrendingDown style={{ height: 16, width: 16, color: C.red }} />;
    }
  }

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Star style={{ height: 16, width: 16, color: C.orange }} />
          {tr('سجل الأداء', 'Performance History')}
        </h3>
        {reviews.length >= 2 && trendIcon}
      </div>

      {reviews.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>
          <Inbox style={{ height: 32, width: 32, marginBottom: 8 }} />
          <p style={{ fontSize: 12, color: C.textMuted }}>{tr('لا توجد مراجعات بعد', 'No reviews yet')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reviews.map((review, idx) => {
            const ratingKey = getRatingKey(review.rating);
            return (
              <div
                key={review.cycleId + '-' + idx}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', color: C.textMuted }}>
                    {review.finalScore.toFixed(2)}
                  </span>
                  <span style={{ color: C.textMuted }}>/</span>
                  <span style={{ color: C.textMuted }}>5.0</span>
                </div>
                <CVisionBadge C={C}
                  className={`text-xs ${
                    RATING_BADGE_COLORS[ratingKey] || ''
                  }`}
                >
                  {review.rating}
                </CVisionBadge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
