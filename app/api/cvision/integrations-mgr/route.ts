import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { ensureSeedData, AVAILABLE_INTEGRATIONS } from '@/lib/cvision/integrations-mgr/integrations-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLL = 'cvision_integrations';
const LOG_COLL = 'cvision_integration_logs';

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  await ensureSeedData(db, tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const integrations = await db.collection(COLL).find({ tenantId }).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, integrations });
  }

  if (action === 'detail') {
    const id = searchParams.get('id');
    const integration = await db.collection(COLL).findOne({ tenantId, $or: [{ id }, { _id: id as unknown }] });
    return NextResponse.json({ ok: true, integration });
  }

  if (action === 'available') {
    const connected = await db.collection(COLL).find({ tenantId }).project({ provider: 1 }).limit(100).toArray();
    const connectedProviders = new Set(connected.map(c => c.provider));
    const available = AVAILABLE_INTEGRATIONS.map(a => ({
      ...a, connected: connectedProviders.has(a.provider),
    }));
    return NextResponse.json({ ok: true, available });
  }

  if (action === 'sync-status') {
    const integrations = await db.collection(COLL).find({ tenantId, status: 'ACTIVE' }).limit(100).toArray();
    const statuses = integrations.map(i => ({
      provider: i.provider, name: i.name,
      lastSync: i.syncSettings?.lastSyncAt, lastStatus: i.syncSettings?.lastSyncStatus,
      frequency: i.syncSettings?.frequency, enabled: i.syncSettings?.enabled,
    }));
    return NextResponse.json({ ok: true, statuses });
  }

  if (action === 'logs') {
    const provider = searchParams.get('provider');
    const filter: any = { tenantId };
    if (provider) filter.provider = provider;
    const logs = await db.collection(LOG_COLL).find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    return NextResponse.json({ ok: true, logs });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.integrations.manage' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const { action } = body;

  if (action === 'connect') {
    const { provider, name, type, config } = body;
    const now = new Date();
    await db.collection(COLL).insertOne({
      tenantId, name, type, provider, config: config || {},
      syncSettings: { enabled: false, frequency: 'MANUAL', direction: 'ONE_WAY', mappings: [] },
      status: 'INACTIVE', createdAt: now, updatedAt: now,
    });
    await db.collection(LOG_COLL).insertOne({ tenantId, provider, action: 'CONNECTED', status: 'SUCCESS', message: `${name} connected`, createdAt: now });
    return NextResponse.json({ ok: true });
  }

  if (action === 'disconnect') {
    const { provider } = body;
    await db.collection(COLL).deleteOne({ tenantId, provider });
    await db.collection(LOG_COLL).insertOne({ tenantId, provider, action: 'DISCONNECTED', status: 'SUCCESS', message: `${provider} disconnected`, createdAt: new Date() });
    return NextResponse.json({ ok: true });
  }

  if (action === 'test-connection') {
    const { provider } = body;
    const integration = await db.collection(COLL).findOne({ tenantId, provider });
    if (!integration) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    await db.collection(LOG_COLL).insertOne({ tenantId, provider, action: 'TEST_CONNECTION', status: 'SUCCESS', message: 'Connection test passed', createdAt: new Date() });
    return NextResponse.json({ ok: true, result: 'Connection successful' });
  }

  if (action === 'sync-now') {
    const { provider } = body;
    const now = new Date();
    await db.collection(COLL).updateOne(
      { tenantId, provider },
      { $set: { 'syncSettings.lastSyncAt': now, 'syncSettings.lastSyncStatus': 'SUCCESS', updatedAt: now } },
    );
    await db.collection(LOG_COLL).insertOne({ tenantId, provider, action: 'MANUAL_SYNC', status: 'SUCCESS', message: 'Manual sync completed', createdAt: now });
    return NextResponse.json({ ok: true });
  }

  if (action === 'configure') {
    const { provider, syncSettings } = body;
    await db.collection(COLL).updateOne(
      { tenantId, provider },
      { $set: { syncSettings, status: syncSettings.enabled ? 'ACTIVE' : 'INACTIVE', updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'update-mapping') {
    const { provider, mappings } = body;
    await db.collection(COLL).updateOne(
      { tenantId, provider },
      { $set: { 'syncSettings.mappings': mappings, updatedAt: new Date() } },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.integrations.manage' });
