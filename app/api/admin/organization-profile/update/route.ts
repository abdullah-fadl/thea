import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  requiredDocumentTypes: z.array(z.string()).optional(),
  glossary: z.record(z.string(), z.string()).optional(),
  guidanceDefaults: z.record(z.string(), z.any()).optional(),
  accreditationSets: z.array(z.string()).optional(),
});

export const POST = withAuthTenant(async (req, { tenantId, userId }) => {
  try {
    const v = validateBody(await req.json(), updateSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const inserts: { tenantId: string; type: string; payload: any; createdBy: string | undefined }[] = [];
    if (body.accreditationSets?.length) {
      inserts.push({
        tenantId: tenant.id,
        type: 'ACCREDITATION',
        payload: { items: body.accreditationSets },
        createdBy: userId,
      });
    }
    if (body.requiredDocumentTypes?.length) {
      inserts.push({
        tenantId: tenant.id,
        type: 'REQUIRED_DOCS',
        payload: { items: body.requiredDocumentTypes },
        createdBy: userId,
      });
    }
    if (body.glossary && Object.keys(body.glossary).length) {
      inserts.push({
        tenantId: tenant.id,
        type: 'GLOSSARY',
        payload: { entries: body.glossary },
        createdBy: userId,
      });
    }
    if (body.guidanceDefaults && Object.keys(body.guidanceDefaults).length) {
      inserts.push({
        tenantId: tenant.id,
        type: 'RULES',
        payload: { rules: body.guidanceDefaults },
        createdBy: userId,
      });
    }

    if (inserts.length) {
      await prisma.tenantContextOverlay.createMany({ data: inserts });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update organization profile' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
