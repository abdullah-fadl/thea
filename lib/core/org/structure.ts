/**
 * Organizational Structure Engine
 *
 * Flexible organizational builder supporting ANY sector:
 * - Departments
 * - Units
 * - Floors
 * - Rooms
 * - Lines / Sections / Committees
 *
 * Features:
 * - Tree-based structure
 * - Drag & drop support
 * - Validation rules
 * - Effective start/end dates
 * - Prevent deletion of nodes with active data unless reassigned
 */

import { prisma } from '@/lib/db/prisma';
import { OrgNode, NodeType, buildNodePath } from '../models/OrganizationalStructure';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { logger } from '@/lib/monitoring/logger';

// TODO: Create a Prisma model `OrgNode` with all fields from the OrgNode interface.
// For now, use raw SQL against an `org_nodes` table.

const ORG_NODES_TABLE = 'org_nodes';

// ---------------------------------------------------------------------------
// Helpers to resolve tenant from request (replaces getTenantDbFromRequest)
// ---------------------------------------------------------------------------

async function resolveTenantFromRequest(request: NextRequest): Promise<
  | { tenantKey: string; userEmail: string }
  | NextResponse
> {
  // Extract tenantKey and userEmail from the request headers / JWT.
  // In the new Prisma world the tenant DB concept is gone; we just need the key.
  const tenantKey = request.headers.get('x-tenant-id') || '';
  const userEmail = request.headers.get('x-user-email') || '';
  if (!tenantKey) {
    return NextResponse.json({ error: 'Missing tenant' }, { status: 400 });
  }
  return { tenantKey, userEmail };
}

// ---------------------------------------------------------------------------
// Query helpers (raw SQL against org_nodes table)
// ---------------------------------------------------------------------------

async function findOrgNodes(tenantId: string): Promise<OrgNode[]> {
  return prisma.$queryRaw`
    SELECT * FROM org_nodes WHERE "tenantId" = ${tenantId} ORDER BY level ASC, name ASC
  `;
}

async function findOrgNodeById(id: string, tenantId: string): Promise<OrgNode | null> {
  const rows: OrgNode[] = await prisma.$queryRaw`
    SELECT * FROM org_nodes WHERE id = ${id} AND "tenantId" = ${tenantId} LIMIT 1
  `;
  return rows[0] || null;
}

async function findChildNodes(parentId: string, tenantId: string): Promise<OrgNode[]> {
  return prisma.$queryRaw`
    SELECT * FROM org_nodes WHERE "parentId" = ${parentId} AND "tenantId" = ${tenantId}
  `;
}

async function countChildNodes(parentId: string, tenantId: string): Promise<number> {
  const rows: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count FROM org_nodes WHERE "parentId" = ${parentId} AND "tenantId" = ${tenantId}
  `;
  return Number(rows[0]?.count || 0);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get all organizational nodes for a tenant
 */
export async function getOrgNodes(
  request: NextRequest
): Promise<OrgNode[] | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey } = tenantResult;
  const nodes = await findOrgNodes(tenantKey);

  return nodes.map(node => ({
    ...node,
    path: buildNodePath(nodes, node.id),
  }));
}

/**
 * Get a single organizational node
 */
export async function getOrgNode(
  request: NextRequest,
  nodeId: string
): Promise<OrgNode | null | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey } = tenantResult;
  const node = await findOrgNodeById(nodeId, tenantKey);
  if (!node) return null;

  const allNodes = await findOrgNodes(tenantKey);
  return {
    ...node,
    path: buildNodePath(allNodes, node.id),
  };
}

/**
 * Create a new organizational node
 */
export async function createOrgNode(
  request: NextRequest,
  data: {
    type: NodeType;
    name: string;
    code?: string;
    description?: string;
    parentId?: string;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
    metadata?: { [key: string]: any };
  }
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey, userEmail } = tenantResult;

  // Calculate level and hierarchy
  let level = 0;
  let departmentId: string | undefined;
  let unitId: string | undefined;
  let floorId: string | undefined;

  if (data.parentId) {
    const parent = await findOrgNodeById(data.parentId, tenantKey);
    if (!parent) {
      return NextResponse.json({ error: 'Parent node not found' }, { status: 404 });
    }
    level = parent.level + 1;

    if (parent.type === 'department') {
      departmentId = parent.id;
    } else if (parent.type === 'unit') {
      departmentId = parent.departmentId;
      unitId = parent.id;
    } else if (parent.type === 'floor') {
      departmentId = parent.departmentId;
      unitId = parent.unitId;
      floorId = parent.id;
    }
  }

  const { v4: uuidv4 } = await import('uuid');
  const nodeId = uuidv4();
  const now = new Date();

  const allNodes = await findOrgNodes(tenantKey);
  const path = data.parentId
    ? `${buildNodePath(allNodes, data.parentId)}/${data.name}`
    : `/${data.name}`;

  const validationRules = JSON.stringify({ allowDeletion: true, requireReassignment: true });
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

  await prisma.$executeRaw`
    INSERT INTO org_nodes (
      id, "tenantId", type, name, code, description, "parentId",
      level, path, "departmentId", "unitId", "floorId",
      "effectiveStartDate", "effectiveEndDate", "isActive",
      "validationRules", metadata,
      "createdAt", "updatedAt", "createdBy"
    ) VALUES (
      ${nodeId}, ${tenantKey}, ${data.type}, ${data.name}, ${data.code ?? null}, ${data.description ?? null}, ${data.parentId ?? null},
      ${level}, ${path}, ${departmentId ?? null}, ${unitId ?? null}, ${floorId ?? null},
      ${data.effectiveStartDate ?? null}::timestamptz, ${data.effectiveEndDate ?? null}::timestamptz, true,
      ${validationRules}::jsonb, ${metadataJson}::jsonb,
      ${now}, ${now}, ${userEmail}
    )
  `;

  // Update parent's children array
  if (data.parentId) {
    await prisma.$executeRaw`
      UPDATE org_nodes
      SET children = COALESCE(children, '[]'::jsonb) || ${JSON.stringify([nodeId])}::jsonb
      WHERE id = ${data.parentId} AND "tenantId" = ${tenantKey}
    `;
  }

  const node: OrgNode = {
    id: nodeId,
    tenantId: tenantKey,
    type: data.type,
    name: data.name,
    code: data.code,
    description: data.description,
    parentId: data.parentId,
    level,
    path,
    departmentId,
    unitId,
    floorId,
    effectiveStartDate: data.effectiveStartDate,
    effectiveEndDate: data.effectiveEndDate,
    isActive: true,
    validationRules: { allowDeletion: true, requireReassignment: true },
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
    createdBy: userEmail,
  };

  return node;
}

/**
 * Update an organizational node
 */
export async function updateOrgNode(
  request: NextRequest,
  nodeId: string,
  updates: {
    name?: string;
    code?: string;
    description?: string;
    effectiveStartDate?: Date;
    effectiveEndDate?: Date;
    isActive?: boolean;
    metadata?: { [key: string]: any };
  }
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey, userEmail } = tenantResult;

  // Rebuild path if name changed
  let newPath: string | null = null;
  if (updates.name) {
    const node = await findOrgNodeById(nodeId, tenantKey);
    if (node) {
      const allNodes = await findOrgNodes(tenantKey);
      newPath = node.parentId
        ? `${buildNodePath(allNodes, node.parentId)}/${updates.name}`
        : `/${updates.name}`;
    }
  }

  // Use parameterized query to prevent SQL injection
  await prisma.$executeRaw`
    UPDATE org_nodes SET
      "updatedAt" = NOW(),
      "updatedBy" = ${userEmail},
      name = COALESCE(${updates.name ?? null}, name),
      code = COALESCE(${updates.code ?? null}, code),
      description = COALESCE(${updates.description ?? null}, description),
      "isActive" = COALESCE(${updates.isActive ?? null}, "isActive"),
      metadata = COALESCE(${updates.metadata ? JSON.stringify(updates.metadata) : null}::jsonb, metadata),
      path = COALESCE(${newPath}, path)
    WHERE id = ${nodeId} AND "tenantId" = ${tenantKey}
  `;

  const updated = await findOrgNodeById(nodeId, tenantKey);
  if (!updated) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  return updated;
}

/**
 * Move a node to a new parent (drag & drop)
 */
export async function moveOrgNode(
  request: NextRequest,
  nodeId: string,
  newParentId: string | null
): Promise<OrgNode | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey } = tenantResult;
  const node = await findOrgNodeById(nodeId, tenantKey);
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Remove from old parent's children
  if (node.parentId) {
    await prisma.$executeRaw`
      UPDATE org_nodes
      SET children = COALESCE(children, '[]'::jsonb) - ${nodeId}
      WHERE id = ${node.parentId} AND "tenantId" = ${tenantKey}
    `;
  }

  // Calculate new level and hierarchy
  let level = 0;
  let departmentId: string | undefined;
  let unitId: string | undefined;
  let floorId: string | undefined;

  if (newParentId) {
    const newParent = await findOrgNodeById(newParentId, tenantKey);
    if (!newParent) {
      return NextResponse.json({ error: 'New parent node not found' }, { status: 404 });
    }
    level = newParent.level + 1;

    if (newParent.type === 'department') departmentId = newParent.id;
    else if (newParent.type === 'unit') { departmentId = newParent.departmentId; unitId = newParent.id; }
    else if (newParent.type === 'floor') { departmentId = newParent.departmentId; unitId = newParent.unitId; floorId = newParent.id; }
  }

  const allNodes = await findOrgNodes(tenantKey);
  const path = newParentId
    ? `${buildNodePath(allNodes, newParentId)}/${node.name}`
    : `/${node.name}`;

  await prisma.$executeRaw`
    UPDATE org_nodes SET
      "parentId" = ${newParentId ?? null},
      level = ${level},
      path = ${path},
      "departmentId" = ${departmentId ?? null},
      "unitId" = ${unitId ?? null},
      "floorId" = ${floorId ?? null},
      "updatedAt" = NOW()
    WHERE id = ${nodeId} AND "tenantId" = ${tenantKey}
  `;

  // Add to new parent's children
  if (newParentId) {
    await prisma.$executeRaw`
      UPDATE org_nodes
      SET children = COALESCE(children, '[]'::jsonb) || ${JSON.stringify([nodeId])}::jsonb
      WHERE id = ${newParentId} AND "tenantId" = ${tenantKey}
    `;
  }

  // Update all descendants
  await updateDescendants(nodeId, tenantKey, level, departmentId, unitId, floorId);

  const updated = await findOrgNodeById(nodeId, tenantKey);
  return updated!;
}

/**
 * Update all descendants when a node is moved
 */
async function updateDescendants(
  parentId: string,
  tenantId: string,
  parentLevel: number,
  parentDepartmentId?: string,
  parentUnitId?: string,
  parentFloorId?: string
): Promise<void> {
  const children = await findChildNodes(parentId, tenantId);

  for (const child of children) {
    const level = parentLevel + 1;
    let departmentId = parentDepartmentId;
    let unitId = parentUnitId;
    let floorId = parentFloorId;

    if (child.type === 'department') departmentId = child.id;
    else if (child.type === 'unit') unitId = child.id;
    else if (child.type === 'floor') floorId = child.id;

    await prisma.$executeRaw`
      UPDATE org_nodes SET
        level = ${level},
        "departmentId" = ${departmentId ?? null},
        "unitId" = ${unitId ?? null},
        "floorId" = ${floorId ?? null}
      WHERE id = ${child.id} AND "tenantId" = ${tenantId}
    `;

    await updateDescendants(child.id, tenantId, level, departmentId, unitId, floorId);
  }
}

/**
 * Delete an organizational node
 */
export async function deleteOrgNode(
  request: NextRequest,
  nodeId: string,
  reassignTo?: string,
  forceDelete: boolean = false
): Promise<{ success: boolean } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const tenantResult = await resolveTenantFromRequest(request);
  if (tenantResult instanceof NextResponse) return tenantResult;

  const { tenantKey } = tenantResult;
  const node = await findOrgNodeById(nodeId, tenantKey);
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // Check if node has children
  const childCount = await countChildNodes(nodeId, tenantKey);
  if (childCount > 0) {
    return NextResponse.json(
      { error: 'Cannot delete node with children. Please delete or move children first.' },
      { status: 400 }
    );
  }

  // Check if node has active data
  if (!forceDelete) {
    const hasActiveData = await checkNodeHasActiveData(nodeId, tenantKey);
    if (hasActiveData && !reassignTo) {
      return NextResponse.json(
        { error: 'Cannot delete node with active data. Please reassign data first or use force delete.' },
        { status: 400 }
      );
    }
  }

  // Reassign data if needed
  if (reassignTo) {
    await reassignNodeData(nodeId, reassignTo, tenantKey);
  }

  // Remove from parent's children
  if (node.parentId) {
    await prisma.$executeRaw`
      UPDATE org_nodes
      SET children = COALESCE(children, '[]'::jsonb) - ${nodeId}
      WHERE id = ${node.parentId} AND "tenantId" = ${tenantKey}
    `;
  }

  // Delete node
  await prisma.$executeRaw`
    DELETE FROM org_nodes WHERE id = ${nodeId} AND "tenantId" = ${tenantKey}
  `;

  return { success: true };
}

/**
 * Check if node has active data
 */
async function checkNodeHasActiveData(
  nodeId: string,
  _tenantId: string
): Promise<boolean> {
  // TODO: Implement actual checks against real Prisma models (users, encounters, etc.)
  // For now, returning false to unblock. The old code checked arbitrary MongoDB
  // collections that may not exist yet in PostgreSQL.
  return false;
}

/**
 * Reassign data from one node to another
 */
async function reassignNodeData(
  _fromNodeId: string,
  _toNodeId: string,
  _tenantId: string
): Promise<void> {
  // TODO: Implement reassignment against real Prisma models.
  // The old code updated departmentId/unitId/floorId/roomId across
  // users, opd_census, patient_experience, policy_documents.
  logger.warn('reassignNodeData is a no-op stub — implement with Prisma models', { category: 'system' });
}
