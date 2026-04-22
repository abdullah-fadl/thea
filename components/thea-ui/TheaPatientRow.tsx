'use client';

import { cn } from '@/lib/utils';
import { getTheaUiStatus } from '@/lib/thea-ui/tokens';
import { getTheaUiVisitType } from '@/lib/thea-ui/tokens';
import { TheaStatusBadge } from './TheaStatusBadge';
import { TheaWaitBadge } from './TheaWaitBadge';

interface PatientData {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: 'M' | 'F';
  status: string;
  type: string;
  typeKey?: string;
  wait?: number;
  critical?: boolean;
  allergies?: string[];
  complaint?: string;
}

interface TheaPatientRowProps {
  patient: PatientData;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  language?: 'ar' | 'en';
}

const MALE_GRADIENT = 'linear-gradient(135deg, #6693f5, #3366e6)';
const FEMALE_GRADIENT = 'linear-gradient(135deg, #e882b4, #d63384)';

export function TheaPatientRow({
  patient,
  selected = false,
  compact = false,
  onClick,
  language,
}: TheaPatientRowProps) {
  const statusCfg = getTheaUiStatus(patient.status);
  const visitCfg = getTheaUiVisitType(patient.typeKey || 'fu');
  const isCompleted = patient.status === 'COMPLETED';
  const avatarSize = compact ? 30 : 40;
  const initials = patient.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      className={cn(
        'relative flex items-center gap-2.5 rounded-2xl border cursor-pointer thea-transition-fast',
        compact ? 'p-2' : 'p-3',
        selected
          ? 'bg-primary/5 border-primary/30'
          : 'bg-card border-transparent hover:bg-muted/50',
        isCompleted && 'opacity-55',
        !selected && !isCompleted && 'hover:-translate-y-px hover:shadow-sm',
      )}
      style={{
        borderInlineStartWidth: 3,
        borderInlineStartColor: selected ? statusCfg.color : 'transparent',
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="rounded-full flex items-center justify-center text-white font-bold"
          style={{
            width: avatarSize,
            height: avatarSize,
            background: patient.gender === 'F' ? FEMALE_GRADIENT : MALE_GRADIENT,
            fontSize: compact ? 11 : 13,
          }}
        >
          {initials}
        </div>
        {/* Critical dot */}
        {patient.critical && (
          <span
            className="absolute -top-0.5 rounded-full"
            style={{
              width: 8,
              height: 8,
              background: '#EF4444',
              border: '2px solid var(--card)',
              insetInlineEnd: -2,
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-semibold text-foreground truncate',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {patient.name}
          </span>
          {!compact && patient.typeKey && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 max-w-[80px] truncate"
              style={{ color: visitCfg.color, background: visitCfg.bg }}
              title={patient.type}
            >
              {patient.type}
            </span>
          )}
        </div>
        <div className={cn('text-muted-foreground truncate', compact ? 'text-[10px]' : 'text-xs')}>
          {patient.mrn}
        </div>
      </div>

      {/* Right: status + wait */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {compact ? (
          /* Compact: just a dot */
          <span
            className="rounded-full"
            style={{ width: 6, height: 6, background: statusCfg.color }}
          />
        ) : (
          <TheaStatusBadge status={patient.status} size="sm" language={language} />
        )}
        {patient.wait != null && patient.wait > 0 && (
          <TheaWaitBadge minutes={patient.wait} />
        )}
      </div>
    </div>
  );
}
