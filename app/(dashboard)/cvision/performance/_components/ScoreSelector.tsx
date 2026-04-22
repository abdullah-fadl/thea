'use client';

import { cn } from '@/lib/utils';
import { SCORE_LABELS } from '@/lib/cvision/performance/performance-engine';

interface ScoreSelectorProps {
  value: number;
  onChange: (score: number) => void;
  disabled?: boolean;
}

const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-500 text-white hover:bg-red-600',
  2: 'bg-orange-500 text-white hover:bg-orange-600',
  3: 'bg-amber-500 text-white hover:bg-amber-600',
  4: 'bg-blue-500 text-white hover:bg-blue-600',
  5: 'bg-emerald-500 text-white hover:bg-emerald-600',
};

const INACTIVE_STYLE = 'bg-muted text-muted-foreground hover:bg-muted/80';

export default function ScoreSelector({
  value,
  onChange,
  disabled = false,
}: ScoreSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((score) => {
        const isActive = value === score;
        return (
          <button
            key={score}
            type="button"
            disabled={disabled}
            onClick={() => onChange(score)}
            title={SCORE_LABELS[score]}
            className={cn(
              'h-8 w-8 rounded text-xs font-semibold transition-colors',
              'flex items-center justify-center',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isActive ? SCORE_COLORS[score] : INACTIVE_STYLE
            )}
          >
            {score}
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-1.5 text-xs text-muted-foreground">
          {SCORE_LABELS[value]}
        </span>
      )}
    </div>
  );
}
