import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PolicyDocument } from '@/lib/models/Policy';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const POLICIES_DIR = env.POLICIES_DIR;

function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer as Buffer).digest('hex');
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role }) => {
  try {
    logger.info('Bulk upload request received');
    logger.info('User role:', { role, userId, tenantId });

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedPolicies: Array<{
      id: string;
      documentId: string;
      filename: string;
      status: string;
      aiTags?: Record<string, unknown>;
      tagsStatus?: string;
    }> = [];

    for (const file of files) {
      try {
        if (file.type !== 'application/pdf') {
          logger.warn(`Skipping non-PDF file: ${file.name}`);
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pdfHeader = buffer.toString('ascii', 0, 4);
        if (pdfHeader !== '%PDF') {
          logger.warn(`Skipping invalid PDF: ${file.name}`);
          continue;
        }

        const fileHash = calculateFileHash(buffer);

        // Check for duplicate by original filename
        const existing = await prisma.policyDocument.findFirst({
          where: { tenantId, originalFileName: file.name, isActive: true },
        });

        if (existing) {
          logger.warn(`Duplicate file skipped: ${file.name}`);
          continue;
        }

        const year = new Date().getFullYear();
        const documentId = `POL-${year}-${uuidv4().substring(0, 8).toUpperCase()}`;
        const policyId = uuidv4();

        const yearDir = path.join(POLICIES_DIR, year.toString());
        if (!fs.existsSync(yearDir)) {
          fs.mkdirSync(yearDir, { recursive: true });
        }

        const sanitizedFileName = sanitizeFileName(file.name);
        const storedFileName = `${documentId}-${sanitizedFileName}`;
        const filePath = path.join(yearDir, storedFileName);

        fs.writeFileSync(filePath, buffer as Buffer);

        const policyTitle = file.name.replace('.pdf', '').replace(/_/g, ' ');

        const document = {
          id: policyId,
          documentId,
          title: policyTitle,
          originalFileName: file.name,
          storedFileName,
          filePath,
          fileSize: buffer.length,
          fileHash,
          mimeType: 'application/pdf',
          totalPages: 0,
          processingStatus: 'pending',
          storageYear: year,
          createdAt: new Date(),
          updatedAt: new Date(),
          uploadedBy: userId || 'system',
          tenantId,
          isActive: true,
          tagsStatus: 'needs-review',
        };

        await prisma.policyDocument.create({ data: document });

        // Upload to thea-engine service via Next.js proxy (async, non-blocking)
        setTimeout(async () => {
          try {
            const proxyFormData = new FormData();
            const fileBlob = new Blob([buffer], { type: 'application/pdf' });
            proxyFormData.append('files', fileBlob, file.name);
            proxyFormData.append('tenantId', tenantId);
            proxyFormData.append('uploaderUserId', userId || 'system');

            const ingestResponse = await fetch(`${req.nextUrl.origin}/api/sam/thea-engine/ingest`, {
              method: 'POST',
              headers: {
                'Cookie': req.headers.get('Cookie') || '',
              },
              body: proxyFormData,
            });

            if (ingestResponse.ok) {
              const ingestData = await ingestResponse.json();
              logger.info(`Policy ${file.name} ingested into thea-engine, jobs: ${ingestData.jobs?.length || 0}`);
            } else {
              const errorText = await ingestResponse.text().catch(() => 'Unknown error');
              logger.warn(`Failed to ingest policy ${file.name} into thea-engine: ${ingestResponse.status} - ${errorText}`);
            }
          } catch (ingestError) {
            logger.error(`Error ingesting policy ${file.name} into thea-engine:`, { ingestError });
          }

          // Trigger AI tagging in background
          fetch(`${req.nextUrl.origin}/api/policies/${policyId}/suggest-tags`, {
            method: 'POST',
            headers: {
              'Cookie': req.headers.get('Cookie') || '',
            },
          }).catch(err => {
            logger.error(`Failed to trigger AI tagging for ${policyId}:`, { error: err });
          });
        }, 100);

        uploadedPolicies.push({
          id: policyId,
          documentId,
          filename: file.name,
          status: 'uploaded',
          tagsStatus: 'needs-review',
        });
      } catch (fileError: unknown) {
        logger.error(`Error processing file ${file.name}:`, { fileError });
      }
    }

    return NextResponse.json({
      success: true,
      policies: uploadedPolicies,
      reviewQueueCount: uploadedPolicies.filter(p => p.tagsStatus === 'needs-review').length,
    });
  } catch (error) {
    logger.error('Bulk upload error:', { error: error });
    // [SEC-10]
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'policies.bulk-upload' });
