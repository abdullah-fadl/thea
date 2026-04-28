/**
 * Organizational Node API
 * 
 * Operations on individual nodes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import {
  getOrgNode,
  updateOrgNode,
  deleteOrgNode,
  moveOrgNode,
} from '@/lib/core/org/structure';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  effectiveStartDate: z.string().datetime().optional(),
  effectiveEndDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const moveNodeSchema = z.object({
  newParentId: z.string().nullable(),
});

const deleteNodeSchema = z.object({
  reassignTo: z.string().optional(),
});

/**
 * GET /api/structure/org/[nodeId]
 * Get a single organizational node
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> | { nodeId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { nodeId } = resolvedParams;

      const result = await getOrgNode(req, nodeId);
      if (result instanceof NextResponse) {
        return result;
      }

      if (!result) {
        return NextResponse.json(
          { error: 'Node not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ node: result });
    } catch (error) {
      logger.error('GET error', { category: 'api', route: 'GET /api/structure/org/[nodeId]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.org.read' })(request);
}

/**
 * PATCH /api/structure/org/[nodeId]
 * Update an organizational node
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> | { nodeId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { nodeId } = resolvedParams;

      const body = await req.json();
      const v = validateBody(body, updateNodeSchema);
      if ('error' in v) return v.error;

      const data = v.data;
      const result = await updateOrgNode(req, nodeId, {
        name: data.name,
        code: data.code,
        description: data.description,
        effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : undefined,
        effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : undefined,
        isActive: data.isActive,
        metadata: data.metadata,
      });

      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json({ node: result });
    } catch (error) {
      logger.error('PATCH error', { category: 'api', route: 'PATCH /api/structure/org/[nodeId]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.org.update' })(request);
}

/**
 * DELETE /api/structure/org/[nodeId]
 * Delete an organizational node
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> | { nodeId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { nodeId } = resolvedParams;

      const body = await req.json().catch(() => ({}));
      const v = validateBody(body, deleteNodeSchema);
      if ('error' in v) return v.error;

      // Allow force delete for specific departments (Emergency, Quality, Surgery)
      const forceDelete = body.forceDelete === true;
      const result = await deleteOrgNode(req, nodeId, v.data.reassignTo, forceDelete);
      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('DELETE error', { category: 'api', route: 'DELETE /api/structure/org/[nodeId]', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.org.delete' })(request);
}
