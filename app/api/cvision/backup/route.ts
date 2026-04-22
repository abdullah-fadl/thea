import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import * as backup from '@/lib/cvision/backup/manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list-backups';

  if (action === 'list-backups') {
    const limit = parseInt(searchParams.get('limit') || '20');
    const data = await backup.listBackups(db, tenantId, limit);
    return NextResponse.json({ ok: true, data, total: data.length });
  }

  if (action === 'backup-detail') {
    const backupId = searchParams.get('backupId');
    if (!backupId) return NextResponse.json({ ok: false, error: 'backupId required' }, { status: 400 });
    const data = await backup.getBackupDetail(db, tenantId, backupId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'storage-usage') {
    const data = await backup.getStorageUsage(db, tenantId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.admin.manage' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const db = await getCVisionDb(tenantId);
  const body = await request.json();
  const action = body.action;

  if (action === 'trigger-backup') {
    const result = await backup.performBackup(db, tenantId);
    return NextResponse.json({ ok: true, data: result });
  }

  if (action === 'restore-backup') {
    if (!body.confirm) return NextResponse.json({ ok: false, error: 'Set confirm: true' }, { status: 400 });
    if (!body.backupId) return NextResponse.json({ ok: false, error: 'backupId required' }, { status: 400 });
    const result = await backup.restoreBackup(db, tenantId, body.backupId);
    return NextResponse.json({ ok: true, data: result });
  }

  if (action === 'cleanup') {
    const keep = body.keepCount || 10;
    const result = await backup.cleanupOldBackups(db, tenantId, keep);
    return NextResponse.json({ ok: true, data: result });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.admin.manage' });
