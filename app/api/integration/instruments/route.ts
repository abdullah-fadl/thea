import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { validateBody } from '@/lib/validation/helpers';

const instrumentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['lab_analyzer', 'imaging_modality', 'vitals_monitor', 'ecg']),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().optional(),
  department: z.string().min(1),
  protocol: z.enum(['HL7', 'ASTM', 'DICOM', 'FHIR', 'REST']),
  connectionType: z.enum(['tcp', 'http', 'serial', 'dicom_cstore']),
  host: z.string().optional(),
  port: z.number().optional(),
  aeTitle: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/integration/instruments?department=Hematology&type=lab_analyzer&status=ONLINE
 *
 * List registered instruments.
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sp = req.nextUrl.searchParams;

    const where: any = { tenantId };
    if (sp.get('department')) where.department = sp.get('department');
    if (sp.get('type')) where.type = sp.get('type');
    if (sp.get('status')) where.status = sp.get('status');

    const instruments = await prisma.instrument.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ instruments });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

/**
 * POST /api/integration/instruments
 * Body: { action: "create"|"update"|"delete", id?, ...instrumentData }
 *
 * CRUD for instrument registry.
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'create';

    if (action === 'delete' && body.id) {
      await prisma.instrument.deleteMany({
        where: { tenantId, id: body.id },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'update' && body.id) {
      const v = validateBody(body, instrumentSchema.partial());
      if ('error' in v) return v.error;
      const { name, type, manufacturer, model, serialNumber, department, protocol, connectionType, host, port, aeTitle, config } = v.data;

      const update: Record<string, unknown> = {};
      if (name !== undefined) update.name = name;
      if (type !== undefined) update.type = type;
      if (manufacturer !== undefined) update.manufacturer = manufacturer;
      if (model !== undefined) update.model = model;
      if (serialNumber !== undefined) update.serialNumber = serialNumber;
      if (department !== undefined) update.department = department;
      if (protocol !== undefined) update.protocol = protocol;
      if (connectionType !== undefined) update.connectionType = connectionType;
      if (host !== undefined) update.host = host;
      if (port !== undefined) update.port = port;
      if (aeTitle !== undefined) update.aeTitle = aeTitle;
      if (config !== undefined) update.config = config as Record<string, unknown>;

      await prisma.instrument.updateMany({
        where: { tenantId, id: body.id },
        data: update as Prisma.InputJsonValue,
      });

      return NextResponse.json({ success: true });
    }

    // Create
    const v = validateBody(body, instrumentSchema);
    if ('error' in v) return v.error;

    const instrument = await prisma.instrument.create({
      data: {
        tenantId,
        name: v.data.name,
        type: v.data.type,
        manufacturer: v.data.manufacturer,
        model: v.data.model,
        serialNumber: v.data.serialNumber || null,
        department: v.data.department,
        protocol: v.data.protocol,
        connectionType: v.data.connectionType,
        host: v.data.host || null,
        port: v.data.port || null,
        aeTitle: v.data.aeTitle || null,
        config: (v.data.config as any) || null,
        status: 'OFFLINE',
      },
    });

    return NextResponse.json({ success: true, instrument });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
