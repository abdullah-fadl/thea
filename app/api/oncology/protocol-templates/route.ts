import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError, NotFoundError } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// GET  /api/oncology/protocol-templates
// ---------------------------------------------------------------------------
// Fetches protocol templates. Supports:
//   ?cancerType=BREAST
//   ?status=ACTIVE
//   ?isGlobal=true
//   ?search=FOLFOX
// Returns both global templates and tenant-specific ones.

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const { searchParams } = new URL(req.url);
    const cancerType = searchParams.get('cancerType');
    const status = searchParams.get('status') ?? 'ACTIVE';
    const isGlobalParam = searchParams.get('isGlobal');
    const search = searchParams.get('search');

    // Build filter: show tenant-specific templates + global ones
    const conditions: any[] = [];

    // Tenant-specific templates
    const tenantFilter: any = { tenantId, status };
    if (cancerType) tenantFilter.cancerType = cancerType;
    if (search) tenantFilter.name = { contains: search, mode: 'insensitive' };
    conditions.push(tenantFilter);

    // Global templates (available to all tenants)
    if (isGlobalParam !== 'false') {
      const globalFilter: any = { isGlobal: true, status };
      if (cancerType) globalFilter.cancerType = cancerType;
      if (search) globalFilter.name = { contains: search, mode: 'insensitive' };
      conditions.push(globalFilter);
    }

    const templates = await prisma.chemoProtocolTemplate.findMany({
      where: { OR: conditions },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
      take: 200,
    });

    return NextResponse.json({ templates });
  }),
  { permissionKey: 'oncology.view' },
);

// ---------------------------------------------------------------------------
// POST  /api/oncology/protocol-templates
// ---------------------------------------------------------------------------
// Create a new custom protocol template for this tenant.

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    const body = await req.json();

    // Validation
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new BadRequestError('Protocol name is required');
    }
    if (!body.cancerType || typeof body.cancerType !== 'string') {
      throw new BadRequestError('Cancer type is required');
    }
    if (!body.drugs || !Array.isArray(body.drugs) || body.drugs.length === 0) {
      throw new BadRequestError('At least one drug is required');
    }

    // Validate each drug entry
    for (const drug of body.drugs) {
      if (!drug.name || drug.dose == null || !drug.route) {
        throw new BadRequestError('Each drug must have name, dose, and route');
      }
    }

    const validIntents = ['CURATIVE', 'NEOADJUVANT', 'ADJUVANT', 'PALLIATIVE', 'MAINTENANCE'];
    const intent = validIntents.includes(body.intent) ? body.intent : 'CURATIVE';

    const validRisks = ['HIGH', 'MODERATE', 'LOW', 'MINIMAL'];
    const emetogenicRisk = validRisks.includes(body.emetogenicRisk) ? body.emetogenicRisk : null;

    const template = await prisma.chemoProtocolTemplate.create({
      data: {
        tenantId,
        name: body.name.trim(),
        cancerType: body.cancerType,
        intent,
        emetogenicRisk,
        totalCyclesDefault: body.totalCyclesDefault != null ? Number(body.totalCyclesDefault) : null,
        cycleLengthDays: body.cycleLengthDays != null ? Number(body.cycleLengthDays) : null,
        drugs: body.drugs,
        premedications: body.premedications ?? null,
        hydration: body.hydration ?? null,
        doseModifications: body.doseModifications ?? null,
        supportiveCare: body.supportiveCare ?? null,
        references: body.references ?? null,
        isGlobal: false, // Tenant-created templates are never global
        status: 'ACTIVE',
        createdBy: userId,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  }),
  { permissionKey: 'oncology.manage' },
);

// ---------------------------------------------------------------------------
// PUT  /api/oncology/protocol-templates
// ---------------------------------------------------------------------------
// Update an existing template (by id in body).
// Supports full update or status change (ACTIVE/ARCHIVED).

export const PUT = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    const body = await req.json();

    if (!body.id || typeof body.id !== 'string') {
      throw new BadRequestError('Template id is required');
    }

    // Verify template exists and belongs to this tenant
    const existing = await prisma.chemoProtocolTemplate.findFirst({
      where: { id: body.id, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Protocol template not found');
    }

    if (existing.isGlobal) {
      throw new BadRequestError('Global templates cannot be modified');
    }

    // Build update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.cancerType !== undefined) updateData.cancerType = body.cancerType;
    if (body.intent !== undefined) {
      const validIntents = ['CURATIVE', 'NEOADJUVANT', 'ADJUVANT', 'PALLIATIVE', 'MAINTENANCE'];
      if (validIntents.includes(body.intent)) updateData.intent = body.intent;
    }
    if (body.emetogenicRisk !== undefined) {
      const validRisks = ['HIGH', 'MODERATE', 'LOW', 'MINIMAL'];
      if (validRisks.includes(body.emetogenicRisk)) updateData.emetogenicRisk = body.emetogenicRisk;
    }
    if (body.status !== undefined) {
      const validStatuses = ['ACTIVE', 'ARCHIVED'];
      if (validStatuses.includes(body.status)) updateData.status = body.status;
    }
    if (body.totalCyclesDefault !== undefined) updateData.totalCyclesDefault = body.totalCyclesDefault != null ? Number(body.totalCyclesDefault) : null;
    if (body.cycleLengthDays !== undefined) updateData.cycleLengthDays = body.cycleLengthDays != null ? Number(body.cycleLengthDays) : null;
    if (body.drugs !== undefined) {
      if (!Array.isArray(body.drugs) || body.drugs.length === 0) {
        throw new BadRequestError('At least one drug is required');
      }
      updateData.drugs = body.drugs;
    }
    if (body.premedications !== undefined) updateData.premedications = body.premedications;
    if (body.hydration !== undefined) updateData.hydration = body.hydration;
    if (body.doseModifications !== undefined) updateData.doseModifications = body.doseModifications;
    if (body.supportiveCare !== undefined) updateData.supportiveCare = body.supportiveCare;
    if (body.references !== undefined) updateData.references = body.references;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const template = await prisma.chemoProtocolTemplate.update({
      where: { id: body.id },
      data: updateData,
    });

    return NextResponse.json({ template });
  }),
  { permissionKey: 'oncology.manage' },
);
