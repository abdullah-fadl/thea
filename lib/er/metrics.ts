export type MetricKey =
  | 'doorToTriage'
  | 'triageToBed'
  | 'bedToSeen'
  | 'seenToOrders'
  | 'ordersToResultsPending'
  | 'resultsPendingToDecision'
  | 'erLosAdmit';

export type MetricStats = {
  /** Number of encounters with both timestamps available for this metric. */
  count: number;
  /** Average duration in minutes (rounded to 1 decimal). */
  avgMin: number | null;
  /** p50 duration in minutes (rounded to 1 decimal). */
  p50Min: number | null;
  /** p90 duration in minutes (rounded to 1 decimal). */
  p90Min: number | null;
  /** SLA target in minutes (read-only). */
  slaTargetMin: number | null;
  /** % of samples breaching SLA target (0-100). */
  slaBreachPct: number | null;
};

export type ErMetricsResult = {
  range: { from: string; to: string };
  totalEncounters: number;
  metrics: Record<MetricKey, MetricStats>;
};

function toDate(value: any): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function diffMinutes(start: any, end: any): number | null {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return null;
  const ms = e.getTime() - s.getTime();
  if (ms < 0) return null;
  return ms / 60000;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const pct = Math.min(100, Math.max(0, p));
  const rank = Math.ceil((pct / 100) * sortedAsc.length);
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, rank - 1));
  return sortedAsc[idx] ?? null;
}

export function computeStats(samplesMinutes: number[], slaTargetMin: number | null): MetricStats {
  const cleaned = samplesMinutes.filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
  cleaned.sort((a, b) => a - b);

  const count = cleaned.length;
  if (count === 0) {
    return {
      count: 0,
      avgMin: null,
      p50Min: null,
      p90Min: null,
      slaTargetMin,
      slaBreachPct: slaTargetMin == null ? null : null,
    };
  }

  const sum = cleaned.reduce((acc, n) => acc + n, 0);
  const avg = sum / count;
  const p50 = percentileNearestRank(cleaned, 50);
  const p90 = percentileNearestRank(cleaned, 90);

  let breachPct: number | null = null;
  if (slaTargetMin != null) {
    const breaches = cleaned.filter((n) => n > slaTargetMin).length;
    breachPct = (breaches / count) * 100;
  }

  return {
    count,
    avgMin: round1(avg),
    p50Min: p50 == null ? null : round1(p50),
    p90Min: p90 == null ? null : round1(p90),
    slaTargetMin,
    slaBreachPct: breachPct == null ? null : round1(breachPct),
  };
}

export type ErEncounterMetricsInput = {
  // Encounter timestamps
  createdAt?: any;
  triageCompletedAt?: any; // derived from FIRST triage completion event
  bedAssignedAt?: any; // earliest assignedAt
  seenByDoctorAt?: any;
  ordersStartedAt?: any;
  resultsPendingAt?: any;
  decisionAt?: any;
  finalizedAt?: any; // derived from FIRST final status transition (preferred) or closedAt fallback only
  // Disposition
  dispositionType?: string | null; // ADMIT/DISCHARGE/TRANSFER
  finalStatus?: string | null; // ADMITTED/DISCHARGED/TRANSFERRED
};

const SLA_TARGETS_MIN = {
  doorToTriage: 10,
  bedToSeen: 15,
  erLosAdmit: 240,
} as const;

export function computeErMetrics(params: {
  from: Date;
  to: Date;
  encounters: ErEncounterMetricsInput[];
}): ErMetricsResult {
  const doorToTriage: number[] = [];
  const triageToBed: number[] = [];
  const bedToSeen: number[] = [];
  const seenToOrders: number[] = [];
  const ordersToResultsPending: number[] = [];
  const resultsPendingToDecision: number[] = [];
  const erLosAdmit: number[] = [];

  for (const e of params.encounters || []) {
    const d1 = diffMinutes(e.createdAt, e.triageCompletedAt);
    if (d1 != null) doorToTriage.push(d1);

    const d2 = diffMinutes(e.triageCompletedAt, e.bedAssignedAt);
    if (d2 != null) triageToBed.push(d2);

    const d3 = diffMinutes(e.bedAssignedAt, e.seenByDoctorAt);
    if (d3 != null) bedToSeen.push(d3);

    const d4 = diffMinutes(e.seenByDoctorAt, e.ordersStartedAt);
    if (d4 != null) seenToOrders.push(d4);

    const d5 = diffMinutes(e.ordersStartedAt, e.resultsPendingAt);
    if (d5 != null) ordersToResultsPending.push(d5);

    const d6 = diffMinutes(e.resultsPendingAt, e.decisionAt);
    if (d6 != null) resultsPendingToDecision.push(d6);

    const isAdmit =
      e.dispositionType === 'ADMIT' ||
      e.finalStatus === 'ADMITTED';
    const d7 = isAdmit ? diffMinutes(e.createdAt, e.finalizedAt) : null;
    if (d7 != null) erLosAdmit.push(d7);
  }

  return {
    range: { from: params.from.toISOString(), to: params.to.toISOString() },
    totalEncounters: params.encounters?.length || 0,
    metrics: {
      doorToTriage: computeStats(doorToTriage, SLA_TARGETS_MIN.doorToTriage),
      triageToBed: computeStats(triageToBed, null),
      bedToSeen: computeStats(bedToSeen, SLA_TARGETS_MIN.bedToSeen),
      seenToOrders: computeStats(seenToOrders, null),
      ordersToResultsPending: computeStats(ordersToResultsPending, null),
      resultsPendingToDecision: computeStats(resultsPendingToDecision, null),
      erLosAdmit: computeStats(erLosAdmit, SLA_TARGETS_MIN.erLosAdmit),
    },
  };
}

