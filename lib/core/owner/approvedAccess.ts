/**
 * Approved Access Management
 *
 * Manages time-limited, tenant-admin approved access for Thea Owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, isTheaOwner } from './separation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/db/prisma';
import { ApprovedAccessToken, isApprovedAccessTokenValid, canAccessPlatform } from '../models/ApprovedAccessToken';
import { logApprovedAccessEvent } from './approvedAccessAudit';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request access to a tenant (owner only)
 * Creates a pending request that tenant admin must approve
 */
export async function requestTenantAccess(
  ownerId: string,
  ownerEmail: string,
  tenantId: string,
  reason?: string,
  requestedDurationHours: number = 24
): Promise<ApprovedAccessToken> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + requestedDurationHours * 60 * 60 * 1000);

  const accessToken: ApprovedAccessToken = {
    id: uuidv4(),
    ownerId,
    ownerEmail,
    tenantId,
    requestedAt: now,
    status: 'pending',
    expiresAt,
    allowedPlatforms: {
      sam: true,
      health: true,
      edrac: true,
      cvision: true,
    },
    allowedActions: ['view', 'export'], // Read-only by default
    reason,
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  };

  await prisma.approvedAccessToken.create({
    data: {
      id: accessToken.id,
      ownerId,
      ownerEmail,
      tenantId,
      requestedAt: now,
      status: 'pending',
      expiresAt,
      allowedPlatforms: accessToken.allowedPlatforms,
      allowedActions: accessToken.allowedActions,
      reason,
      usageCount: 0,
    },
  });

  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_created',
    requestId: accessToken.id,
    ownerId,
    ownerEmail,
    tenantId,
    action: `Owner requested access to tenant ${tenantId}`,
    details: {
      reason,
      requestedDurationHours,
      expiresAt: accessToken.expiresAt,
    },
    success: true,
  });

  return accessToken;
}

/**
 * Approve access request (tenant admin only)
 */
export async function approveAccessRequest(
  requestId: string,
  approvedBy: string,
  approvedByEmail: string,
  notes?: string,
  customExpiresAt?: Date
): Promise<ApprovedAccessToken | null> {
  const request = await prisma.approvedAccessToken.findFirst({
    where: { id: requestId },
  });
  if (!request || request.status !== 'pending') {
    return null;
  }

  const now = new Date();
  const expiresAt = customExpiresAt || request.expiresAt;

  // Generate access token (JWT-like identifier)
  const accessTokenStr = `aat_${uuidv4()}`;

  await prisma.approvedAccessToken.update({
    where: { id: requestId },
    data: {
      status: 'approved',
      approvedAt: now,
      approvedBy,
      approvedByEmail,
      expiresAt,
      accessToken: accessTokenStr,
      notes,
    },
  });

  const approved = {
    ...request,
    status: 'approved' as const,
    approvedAt: now,
    approvedBy,
    approvedByEmail,
    expiresAt,
    accessToken: accessTokenStr,
    notes,
    updatedAt: now,
  } as unknown as ApprovedAccessToken;

  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_approved',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName || undefined,
    actorId: approvedBy,
    actorEmail: approvedByEmail,
    actorRole: 'tenant_admin',
    action: `Tenant admin approved access request`,
    details: {
      notes,
      expiresAt: approved.expiresAt,
    },
    success: true,
  });

  return approved;
}

/**
 * Reject access request (tenant admin only)
 */
export async function rejectAccessRequest(
  requestId: string,
  rejectedBy: string,
  rejectedByEmail: string,
  reason?: string
): Promise<boolean> {
  const request = await prisma.approvedAccessToken.findFirst({
    where: { id: requestId },
  });
  if (!request || request.status !== 'pending') {
    return false;
  }

  await prisma.approvedAccessToken.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      notes: reason,
    },
  });

  // Audit log
  await logApprovedAccessEvent({
    eventType: 'request_rejected',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName || undefined,
    actorId: rejectedBy,
    actorEmail: rejectedByEmail,
    actorRole: 'tenant_admin',
    action: `Tenant admin rejected access request`,
    details: {
      reason,
    },
    success: true,
  });

  return true;
}

/**
 * Revoke approved access (tenant admin or owner)
 */
export async function revokeAccess(
  requestId: string,
  revokedBy: string,
  reason?: string
): Promise<boolean> {
  const request = await prisma.approvedAccessToken.findFirst({
    where: { id: requestId },
  });
  if (!request || (request.status !== 'approved' && request.status !== 'pending')) {
    return false;
  }

  await prisma.approvedAccessToken.update({
    where: { id: requestId },
    data: {
      status: 'revoked',
      notes: reason,
    },
  });

  // Audit log
  await logApprovedAccessEvent({
    eventType: 'access_revoked',
    requestId,
    ownerId: request.ownerId,
    ownerEmail: request.ownerEmail,
    tenantId: request.tenantId,
    tenantName: request.tenantName || undefined,
    actorId: revokedBy,
    action: `Access revoked`,
    details: {
      reason,
    },
    success: true,
  });

  return true;
}

/**
 * Get active approved access token for owner and tenant
 */
export async function getActiveApprovedAccess(
  ownerId: string,
  tenantId: string
): Promise<ApprovedAccessToken | null> {
  const tokens = await prisma.approvedAccessToken.findMany({
    where: {
      ownerId,
      tenantId,
      status: 'approved',
    },
    orderBy: { expiresAt: 'desc' },
    take: 100,
  });

  // Find first valid (not expired) token
  for (const token of tokens) {
    const mapped = token as unknown as ApprovedAccessToken;
    if (isApprovedAccessTokenValid(mapped)) {
      return mapped;
    }
  }

  return null;
}

/**
 * Get approved access token by access token string
 */
export async function getApprovedAccessByToken(
  accessTokenStr: string
): Promise<ApprovedAccessToken | null> {
  const token = await prisma.approvedAccessToken.findFirst({
    where: {
      accessToken: accessTokenStr,
      status: 'approved',
    },
  });

  if (!token) return null;

  const mapped = token as unknown as ApprovedAccessToken;
  if (!isApprovedAccessTokenValid(mapped)) {
    return null;
  }

  return mapped;
}

/**
 * Record token usage (for audit)
 */
export async function recordTokenUsage(accessTokenStr: string, ipAddress?: string, userAgent?: string): Promise<void> {
  const token = await prisma.approvedAccessToken.findFirst({
    where: { accessToken: accessTokenStr },
  });
  if (!token) {
    return;
  }

  await prisma.approvedAccessToken.update({
    where: { id: token.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  });

  // Audit log
  await logApprovedAccessEvent({
    eventType: 'access_used',
    requestId: token.id,
    ownerId: token.ownerId,
    ownerEmail: token.ownerEmail,
    tenantId: token.tenantId,
    tenantName: token.tenantName || undefined,
    action: `Owner used approved access token`,
    details: {
      usageCount: token.usageCount + 1,
    },
    ipAddress,
    userAgent,
    success: true,
  });
}

/**
 * Get all pending requests for a tenant (tenant admin view)
 */
export async function getPendingRequestsForTenant(
  tenantId: string
): Promise<ApprovedAccessToken[]> {
  const rows = await prisma.approvedAccessToken.findMany({
    where: {
      tenantId,
      status: 'pending',
    },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  });
  return rows as unknown as ApprovedAccessToken[];
}

/**
 * Get all approved access tokens for an owner
 */
export async function getOwnerApprovedAccess(
  ownerId: string
): Promise<ApprovedAccessToken[]> {
  const rows = await prisma.approvedAccessToken.findMany({
    where: {
      ownerId,
      status: { in: ['approved', 'pending'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows as unknown as ApprovedAccessToken[];
}
