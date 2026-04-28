import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/sam/evidence/upload — Upload evidence file (metadata + storage key)
 *
 * In production, file bytes would go to S3/blob storage.
 * This route stores metadata and generates a storage key reference.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, userId }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const referenceId = formData.get('referenceId') as string;
      const referenceType = formData.get('referenceType') as string;
      const title = formData.get('title') as string;
      const description = formData.get('description') as string | null;

      if (!referenceId || !referenceType || !title) {
        return NextResponse.json(
          { error: 'referenceId, referenceType, and title are required' },
          { status: 400 }
        );
      }

      const validTypes = ['FINDING', 'COMPLIANCE', 'RISK', 'AUDIT', 'CORRECTIVE_ACTION'];
      if (!validTypes.includes(referenceType)) {
        return NextResponse.json({ error: 'Invalid referenceType' }, { status: 400 });
      }

      let fileName: string | undefined;
      let fileType: string | undefined;
      let fileSize: number | undefined;
      let storageKey: string | undefined;

      if (file) {
        fileName = file.name;
        fileType = file.type;
        fileSize = file.size;
        // Generate storage key (in production, upload bytes to S3 here)
        storageKey = `sam/evidence/${tenantId}/${crypto.randomUUID()}-${file.name}`;
      }

      const evidence = await prisma.samEvidence.create({
        data: {
          tenantId,
          referenceId,
          referenceType,
          title,
          description: description || undefined,
          fileName,
          fileType,
          fileSize,
          storageKey,
          fileUrl: storageKey ? `/api/sam/evidence/download?key=${encodeURIComponent(storageKey)}` : undefined,
          uploadedBy: userId,
        },
      });

      return NextResponse.json({ evidence, storageKey }, { status: 201 });
    } catch (error: unknown) {
      logger.error('Evidence upload error:', { error });
      return NextResponse.json({ error: 'Failed to upload evidence' }, { status: 500 });
    }
  }),
  { platformKey: 'sam', tenantScoped: true }
);
