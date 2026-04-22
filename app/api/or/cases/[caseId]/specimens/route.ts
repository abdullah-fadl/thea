import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_TYPES = ['BIOPSY', 'EXCISION', 'RESECTION', 'FLUID', 'SWAB', 'CYTOLOGY', 'FROZEN_SECTION', 'OTHER'];
const VALID_DESTINATIONS = ['PATHOLOGY', 'MICROBIOLOGY', 'CYTOLOGY', 'HISTOLOGY', 'OTHER'];

/** GET /api/or/cases/[caseId]/specimens */
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params) => {
    try {
      const caseId = String((params as Record<string, string> | undefined)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      const specimens = await prisma.orSpecimenLog?.findMany?.({
        where: { tenantId, caseId },
        orderBy: { collectedAt: 'asc' },
        take: 100,
      }).catch(() => []) || [];

      return NextResponse.json({ specimens });
    } catch (e: unknown) {
      logger.error('[OR specimens GET]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to fetch specimens' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);

/** POST /api/or/cases/[caseId]/specimens */
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }, params) => {
    try {
      const caseId = String((params as Record<string, string> | undefined)?.caseId || '').trim();
      if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

      // Verify case
      const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
      if (!orCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

      const body = await req.json();
      const {
        specimenLabel, specimenType, site, destination, fixative,
        containerType, quantity = 1, collectedAt, handedToUserId,
        handedToName, notes,
      } = body;

      if (!specimenLabel?.trim()) {
        return NextResponse.json({ error: 'specimenLabel is required' }, { status: 400 });
      }
      if (!VALID_TYPES.includes(specimenType)) {
        return NextResponse.json({ error: `specimenType must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
      }
      if (!VALID_DESTINATIONS.includes(destination)) {
        return NextResponse.json({ error: `destination must be one of: ${VALID_DESTINATIONS.join(', ')}` }, { status: 400 });
      }

      const specimen = await prisma.orSpecimenLog?.create?.({
        data: {
          tenantId,
          caseId,
          patientMasterId: orCase.patientMasterId || null,
          specimenLabel: specimenLabel.trim(),
          specimenType,
          site: site || null,
          destination,
          fixative: fixative || null,
          containerType: containerType || null,
          quantity: Math.max(1, Number(quantity) || 1),
          collectedByUserId: userId,
          collectedByName: null,
          collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
          handedToUserId: handedToUserId || null,
          handedToName: handedToName || null,
          handedAt: handedToUserId || handedToName ? new Date() : null,
          notes: notes || null,
        },
      });

      return NextResponse.json({ specimen }, { status: 201 });
    } catch (e: unknown) {
      logger.error('[OR specimens POST]', { category: 'api', error: e instanceof Error ? e : undefined });
      return NextResponse.json({ error: 'Failed to create specimen' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.nursing.view' },
);
