/**
 * CVision Audit Log Viewer API
 *
 * GET  ?action=list          — paginated + filters
 * GET  ?action=stats&days=N  — aggregated stats
 * GET  ?action=user-trail    — all operations for a user
 * GET  ?action=resource      — all operations on a resource
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function canRead(ctx: any): boolean {
  const rolePerms: string[] = CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || [];
  return ctx.isOwner || rolePerms.includes(CVISION_PERMISSIONS.AUDIT_READ) || rolePerms.includes(CVISION_PERMISSIONS.CONFIG_WRITE);
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;

  if (!canRead(ctx)) {
    return deny('INSUFFICIENT_PERMISSION', 'Requires AUDIT_READ or CONFIG_WRITE');
  }

  const col = await getCVisionCollection<any>(tenantId, 'auditLogs');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'list') {
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const filter: any = { tenantId };
    const userIdParam = searchParams.get('userId');
    const actionType = searchParams.get('actionType');
    const cvModule = searchParams.get('module');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');

    if (userIdParam) filter.actorUserId = userIdParam;
    if (actionType) filter.action = actionType;
    if (cvModule) filter.resourceType = cvModule;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { action: { $regex: escaped, $options: 'i' } },
        { resourceType: { $regex: escaped, $options: 'i' } },
        { resourceId: { $regex: escaped, $options: 'i' } },
        { actorEmail: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json({ ok: true, data, total, page, pages: Math.ceil(total / limit) });
  }

  if (action === 'stats') {
    const days = parseInt(searchParams.get('days') || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { tenantId, createdAt: { $gte: since } } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          denials: [{ $match: { success: false } }, { $count: 'count' }],
          byModule: [{ $group: { _id: '$resourceType', count: { $sum: 1 } } }, { $sort: { count: -1 as const } }],
          byAction: [{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 as const } }],
          topUsers: [
            { $group: { _id: { userId: '$actorUserId', email: '$actorEmail', role: '$actorRole' }, count: { $sum: 1 } } },
            { $sort: { count: -1 as const } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const [result] = await col.aggregate(pipeline).toArray();
    return NextResponse.json({
      ok: true,
      data: {
        total: result.total?.[0]?.count || 0,
        denials: result.denials?.[0]?.count || 0,
        byModule: result.byModule || [],
        byAction: result.byAction || [],
        topUsers: ((result as any).topUsers || []).map((u: any) => ({ ...u._id, count: u.count })),
        days,
      },
    });
  }

  if (action === 'user-trail') {
    const targetUser = searchParams.get('userId');
    if (!targetUser) return NextResponse.json({ ok: false, error: 'userId required' }, { status: 400 });
    const data = await col.find({ tenantId, actorUserId: targetUser }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'resource') {
    const resourceId = searchParams.get('resourceId');
    if (!resourceId) return NextResponse.json({ ok: false, error: 'resourceId required' }, { status: 400 });
    const data = await col.find({ tenantId, resourceId }).sort({ createdAt: -1 }).limit(200).toArray();
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.audit.read' });
