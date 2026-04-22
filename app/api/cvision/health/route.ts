import { NextResponse } from 'next/server';
import { getHealthStatus, runBusinessAlerts, getAPIMetrics } from '@/lib/cvision/monitoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'health';

  if (action === 'health') {
    let db;
    try {
      const { getCVisionDb } = await import('@/lib/cvision/db');
      db = await getCVisionDb('_system');
    } catch { /* DB may be unavailable */ }

    const health = await getHealthStatus(db);
    const status = health.status === 'ok' ? 200 : 503;
    return NextResponse.json(health, { status });
  }

  if (action === 'metrics') {
    const minutes = parseInt(searchParams.get('minutes') || '60');
    return NextResponse.json({ ok: true, data: getAPIMetrics(minutes) });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
}
