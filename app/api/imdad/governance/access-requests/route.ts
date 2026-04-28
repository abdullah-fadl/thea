import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { randomUUID } from 'crypto';

// POST: Submit access request
export const POST = withAuthTenant(async (req, { tenantId, userId, user }) => {
  const body = await req.json();
  const { featureRequested, featureRequestedAr, permissionScope, justification, justificationAr, lineManagerId, nextLevelManagerId } = body;

  if (!featureRequested || !permissionScope || !justification || !lineManagerId) {
    return NextResponse.json({ error: 'Missing required fields: featureRequested, permissionScope, justification, lineManagerId' }, { status: 400 });
  }

  const scopeLevel: Record<string, number> = { DEPARTMENT: 1, HOSPITAL: 2, CORPORATE: 3 };
  if (!scopeLevel[permissionScope]) {
    return NextResponse.json({ error: 'Invalid permissionScope. Must be DEPARTMENT, HOSPITAL, or CORPORATE' }, { status: 400 });
  }

  const needsNextLevel = permissionScope === 'HOSPITAL' || permissionScope === 'CORPORATE';
  if (needsNextLevel && !nextLevelManagerId) {
    return NextResponse.json({ error: 'Next level manager required for HOSPITAL or CORPORATE scope' }, { status: 400 });
  }

  const now = new Date();
  const requestData = {
    id: randomUUID(),
    tenantId,
    requestorId: userId,
    requestorNameEn: (user as any)?.nameEn || userId,
    requestorNameAr: (user as any)?.nameAr || userId,
    requestorRole: (user as any)?.role || 'unknown',
    featureRequested,
    featureRequestedAr: featureRequestedAr || featureRequested,
    permissionScope,
    justification,
    justificationAr: justificationAr || justification,
    lineManagerId,
    nextLevelManagerId: needsNextLevel ? nextLevelManagerId : null,
    status: 'PENDING',
    auditTrail: JSON.stringify([{ action: 'SUBMITTED', userId, timestamp: now.toISOString(), details: `Access request submitted for ${featureRequested} at ${permissionScope} scope` }]),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  await (prisma as any).imdadAccessRequest.create({ data: requestData });
  return NextResponse.json({ success: true, data: requestData }, { status: 201 });
}, { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.governance.request' });

// GET: List access requests
export const GET = withAuthTenant(async (req, { tenantId, userId }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const role = url.searchParams.get('role'); // 'requestor' | 'approver'

  const where: Record<string, unknown> = { tenantId, isDeleted: false };
  if (status) where.status = status;
  if (role === 'requestor') where.requestorId = userId;
  if (role === 'approver') {
    where.OR = [{ lineManagerId: userId }, { nextLevelManagerId: userId }];
  }

  const requests = await (prisma as any).imdadAccessRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ success: true, data: requests });
}, { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.governance.view' });

// PATCH: Approve or reject
export const PATCH = withAuthTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const { requestId, approved, comments } = body;

  if (!requestId || approved === undefined) {
    return NextResponse.json({ error: 'Missing requestId or approved' }, { status: 400 });
  }

  const request = await (prisma as any).imdadAccessRequest.findFirst({
    where: { id: requestId, tenantId, isDeleted: false },
  });
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const now = new Date();
  const isLineManager = request.lineManagerId === userId;
  const isNextLevel = request.nextLevelManagerId === userId;

  if (!isLineManager && !isNextLevel) {
    return NextResponse.json({ error: 'You are not authorized to approve this request' }, { status: 403 });
  }

  const update: Record<string, unknown> = { updatedAt: now };
  const existingTrail = typeof request.auditTrail === 'string' ? JSON.parse(request.auditTrail) : (request.auditTrail || []);
  const auditEntry = { action: approved ? 'APPROVED' : 'REJECTED', userId, timestamp: now.toISOString(), details: comments || (approved ? 'Approved' : 'Rejected') };
  existingTrail.push(auditEntry);
  update.auditTrail = JSON.stringify(existingTrail);

  if (isLineManager && request.status === 'PENDING') {
    if (!approved) {
      update.status = 'REJECTED';
      update.lineManagerApprovalJson = JSON.stringify({ approved: false, managerId: userId, timestamp: now.toISOString(), comments });
    } else {
      const needsNext = request.nextLevelManagerId;
      update.status = needsNext ? 'LINE_MANAGER_APPROVED' : 'APPROVED';
      update.lineManagerApprovalJson = JSON.stringify({ approved: true, managerId: userId, timestamp: now.toISOString(), comments });
    }
  } else if (isNextLevel && request.status === 'LINE_MANAGER_APPROVED') {
    update.status = approved ? 'APPROVED' : 'REJECTED';
    update.nextLevelApprovalJson = JSON.stringify({ approved, managerId: userId, timestamp: now.toISOString(), comments });
  } else {
    return NextResponse.json({ error: 'Invalid approval sequence' }, { status: 400 });
  }

  await (prisma as any).imdadAccessRequest.update({
    where: { id: requestId },
    data: update,
  });

  return NextResponse.json({ success: true, data: { ...request, ...update } });
}, { tenantScoped: true, platformKey: 'imdad', permissionKey: 'imdad.governance.approve' });
