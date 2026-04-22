/**
 * Move Organizational Node API
 *
 * Move a node to a new parent (drag & drop)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { moveOrgNode } from '@/lib/core/org/structure';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const moveNodeSchema = z.object({
  newParentId: z.string().nullable(),
});

/**
 * POST /api/structure/org/[nodeId]/move
 * Move a node to a new parent
 * Note: moveOrgNode function handles auth internally, but we wrap with withAuthTenant for consistency
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> | { nodeId: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  // Note: moveOrgNode also checks auth internally, but we want consistent auth flow
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const { nodeId } = resolvedParams;

      const body = await req.json();
      const v = validateBody(body, moveNodeSchema);
      if ('error' in v) return v.error;

      // moveOrgNode handles auth internally, but we've already authenticated via withAuthTenant
      // Pass the request so moveOrgNode can use it
      const result = await moveOrgNode(req, nodeId, v.data.newParentId);
      if (result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json({ node: result });
    } catch (error) {
      logger.error('POST error', { category: 'api', route: 'POST /api/structure/org/[nodeId]/move', error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }, { tenantScoped: true, permissionKey: 'structure.org.move' })(request);
}
