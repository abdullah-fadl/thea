export type LifecycleStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'UNDER_REVIEW'
  | 'EXPIRED'
  | 'ARCHIVED';

export interface LifecycleEvaluation {
  status: LifecycleStatus;
  nextReviewDate?: Date;
  daysUntilExpiry?: number;
  daysSinceExpiry?: number;
  daysUntilReview?: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export const evaluateLifecycle = (doc: any, now: Date = new Date()): LifecycleEvaluation => {
  const expiryDate = doc?.expiryDate ? new Date(doc.expiryDate) : undefined;
  const reviewCycleMonths = typeof doc?.reviewCycleMonths === 'number' ? doc.reviewCycleMonths : undefined;
  const nextReviewDate = doc?.nextReviewDate ? new Date(doc.nextReviewDate) : undefined;
  const effectiveDate = doc?.effectiveDate ? new Date(doc.effectiveDate) : undefined;
  const createdAt = doc?.createdAt ? new Date(doc.createdAt) : undefined;

  const resolvedNextReviewDate =
    nextReviewDate ||
    (reviewCycleMonths
      ? addMonths(effectiveDate || createdAt || now, reviewCycleMonths)
      : undefined);

  if (doc?.status === 'ARCHIVED' || doc?.archivedAt) {
    return { status: 'ARCHIVED', nextReviewDate: resolvedNextReviewDate };
  }

  if (expiryDate) {
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
    const daysSinceExpiry = Math.ceil((now.getTime() - expiryDate.getTime()) / MS_PER_DAY);
    if (daysSinceExpiry > 90) {
      return { status: 'ARCHIVED', nextReviewDate: resolvedNextReviewDate, daysSinceExpiry };
    }
    if (daysUntilExpiry < 0) {
      return { status: 'EXPIRED', nextReviewDate: resolvedNextReviewDate, daysSinceExpiry };
    }
    if (daysUntilExpiry <= 30) {
      return { status: 'EXPIRING_SOON', nextReviewDate: resolvedNextReviewDate, daysUntilExpiry };
    }
  }

  if (resolvedNextReviewDate) {
    const daysUntilReview = Math.ceil((resolvedNextReviewDate.getTime() - now.getTime()) / MS_PER_DAY);
    if (daysUntilReview <= 0) {
      return { status: 'UNDER_REVIEW', nextReviewDate: resolvedNextReviewDate, daysUntilReview };
    }
  }

  return { status: 'ACTIVE', nextReviewDate: resolvedNextReviewDate };
};
