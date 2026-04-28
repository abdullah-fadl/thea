import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { isEnabled } from '@/lib/core/flags';
import { getMeasurements, compareToTarget } from '@/lib/outcomes/report';
import { getOutcome, listOutcomes } from '@/lib/outcomes/registry';
import { OutcomeMetricsDisabled, OutcomeNotFound, type PeriodGranularity } from '@/lib/outcomes/types';

// GET /api/outcomes/[key]
// Query params:
//   from         ISO date string — range start (required)
//   to           ISO date string — range end   (required)
//   granularity  'hour'|'day'|'week'|'month'|'quarter'|'year' (default: 'day')
//   dimensions   JSON string (optional)
//
// Auth: withAuthTenant + permission 'outcomes.read'
// Flag-gated: 404 when FF_OUTCOME_METRICS_ENABLED=false
//
// Sample response:
//   [
//     {
//       "periodStart": "2026-04-18T00:00:00.000Z",
//       "periodEnd":   "2026-04-19T00:00:00.000Z",
//       "value": 24.5,
//       "sampleSize": 38,
//       "target": 30,
//       "status": "on_target",
//       "delta": -5.5,
//       "percentDelta": -18.3
//     }
//   ]

const VALID_GRANULARITIES = new Set<PeriodGranularity>([
  'hour', 'day', 'week', 'month', 'quarter', 'year',
]);

export const GET = withAuthTenant(
  async (
    req: NextRequest,
    { tenantId }: { tenantId: string; [k: string]: unknown },
    params?: { [key: string]: string | string[] } | Promise<{ [key: string]: string | string[] }>,
  ) => {
    if (!isEnabled('FF_OUTCOME_METRICS_ENABLED')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const outcomeKey = resolvedParams?.key;
    if (!outcomeKey || typeof outcomeKey !== 'string') {
      return NextResponse.json({ error: 'Outcome key is required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const fromStr      = searchParams.get('from');
    const toStr        = searchParams.get('to');
    const granStr      = (searchParams.get('granularity') ?? 'day') as PeriodGranularity;
    const dimsStr      = searchParams.get('dimensions');

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: '"from" and "to" query params are required' }, { status: 400 });
    }

    const from = new Date(fromStr);
    const to   = new Date(toStr);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid date in "from" or "to"' }, { status: 400 });
    }
    if (from >= to) {
      return NextResponse.json({ error: '"from" must be before "to"' }, { status: 400 });
    }
    if (!VALID_GRANULARITIES.has(granStr)) {
      return NextResponse.json({ error: `Invalid granularity: ${granStr}` }, { status: 400 });
    }

    let dimensions: Record<string, unknown> | undefined;
    if (dimsStr) {
      try {
        dimensions = JSON.parse(dimsStr) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON in "dimensions"' }, { status: 400 });
      }
    }

    try {
      // Resolve outcome definition (throws OutcomeNotFound if unregistered)
      let definition;
      try {
        definition = getOutcome(outcomeKey);
      } catch (err) {
        if (err instanceof OutcomeNotFound) {
          return NextResponse.json({ error: `Outcome not found: ${outcomeKey}` }, { status: 404 });
        }
        throw err;
      }

      const measurements = await getMeasurements({
        outcomeKey,
        tenantId,
        range: { start: from, end: to },
        granularity: granStr,
        dimensions,
      });

      const body = measurements.map(m => {
        const comparison = compareToTarget(m, definition);
        return {
          periodStart:  m.periodStart,
          periodEnd:    m.periodEnd,
          value:        m.value,
          sampleSize:   m.sampleSize,
          target:       definition.target ?? null,
          status:       comparison.status,
          delta:        comparison.delta,
          percentDelta: comparison.percentDelta,
        };
      });

      return NextResponse.json(body);
    } catch (err) {
      if (err instanceof OutcomeMetricsDisabled) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      }
      throw err;
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'outcomes.read' },
);

// GET /api/outcomes (list all registered outcomes)
export { listOutcomes };
