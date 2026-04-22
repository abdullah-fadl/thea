import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const updateMetadataSchema = z.object({
  departmentIds: z.array(z.string()).optional(),
  setting: z.enum(['IPD', 'OPD', 'Corporate', 'Shared', 'Unknown']).optional(),
  policyType: z.enum(['Clinical', 'Admin', 'HR', 'Quality', 'IC', 'Medication', 'Other', 'Unknown']).optional(),
  scope: z.enum(['HospitalWide', 'DepartmentOnly', 'UnitSpecific', 'Unknown']).optional(),
  tagsStatus: z.enum(['auto-approved', 'needs-review', 'approved']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;
      const body = await req.json();

      // Validate request body
      const validated = updateMetadataSchema.parse(body);

      // Get policy document
      const policy = await prisma.policyDocument.findFirst({
        where: { tenantId, id: policyId, isActive: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }

      // Build update object
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (validated.departmentIds !== undefined) {
        updateData.departmentIds = validated.departmentIds;
      }
      if (validated.setting !== undefined) {
        updateData.setting = validated.setting;
      }
      if (validated.policyType !== undefined) {
        updateData.policyType = validated.policyType;
      }
      if (validated.scope !== undefined) {
        updateData.scope = validated.scope;
      }
      if (validated.tagsStatus !== undefined) {
        updateData.tagsStatus = validated.tagsStatus;
      }

      // Update policy
      await prisma.policyDocument.updateMany({
        where: { tenantId, id: policyId },
        data: updateData,
      });

      // Fetch updated policy
      const updatedPolicy = await prisma.policyDocument.findFirst({
        where: { tenantId, id: policyId },
      });

    return NextResponse.json({
      success: true,
      policy: updatedPolicy,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Validation error' },
        { status: 400 }
      );
    }

    logger.error('Update metadata error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
  }),
  { tenantScoped: true, permissionKey: 'policies.update-metadata' })(request);
}
