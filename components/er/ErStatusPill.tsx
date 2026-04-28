import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const WAITING = new Set(['REGISTERED', 'TRIAGE_IN_PROGRESS', 'TRIAGE_COMPLETED', 'TRIAGED', 'WAITING_BED']);
const SEEN = new Set(['SEEN_BY_DOCTOR']);
const ORDERS = new Set(['ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'IN_BED']);
const DISPOSITION = new Set(['DECISION', 'DISCHARGED', 'ADMITTED', 'TRANSFERRED']);
const DEATH = new Set(['DEATH']);
const CRITICAL = new Set(['CRITICAL', 'ESCALATION']);

type ErStatusPillProps = {
  status?: string | null;
  critical?: boolean;
  className?: string;
};

const toneForStatus = (status: string, critical?: boolean) => {
  if (critical) return 'critical';
  const normalized = status.trim().toUpperCase();
  if (DEATH.has(normalized)) return 'death';
  if (CRITICAL.has(normalized)) return 'critical';
  if (DISPOSITION.has(normalized)) return 'disposition';
  if (ORDERS.has(normalized)) return 'orders';
  if (SEEN.has(normalized)) return 'seen';
  if (WAITING.has(normalized)) return 'waiting';
  return 'neutral';
};

export function ErStatusPill({ status, critical, className }: ErStatusPillProps) {
  const label = status || '—';
  const tone = status ? toneForStatus(status, critical) : 'neutral';
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        tone === 'waiting' && 'border-muted-foreground/30 bg-muted text-foreground',
        tone === 'seen' && 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
        tone === 'orders' && 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        tone === 'disposition' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        tone === 'death' && 'border-slate-900/50 bg-slate-900/10 text-slate-900 dark:border-slate-100/50 dark:bg-slate-100/10 dark:text-slate-100',
        tone === 'critical' && 'border-destructive/50 bg-destructive/10 text-destructive',
        className
      )}
    >
      {label}
    </Badge>
  );
}
