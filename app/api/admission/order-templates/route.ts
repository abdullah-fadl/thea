import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createOrderTemplateSchema } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/admission/order-templates ──────────────────────────────────────
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = req.nextUrl;
      const departmentKey = url.searchParams.get('departmentKey');
      const diagnosisCode = url.searchParams.get('diagnosisCode');
      const isActive = url.searchParams.get('isActive');

      const where: Record<string, unknown> = { tenantId };
      if (departmentKey) where.departmentKey = departmentKey;
      if (diagnosisCode) where.diagnosisCode = { contains: diagnosisCode };
      if (isActive !== null && isActive !== undefined && isActive !== '') {
        where.isActive = isActive === 'true';
      }

      const items = await prisma.admissionOrderTemplate.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: 100,
      });

      return NextResponse.json({ items });
    } catch (err) {
      logger.error('[admission/order-templates] GET error:', err);
      return NextResponse.json({ error: 'Failed to fetch order templates' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.view' }
);

// ─── POST /api/admission/order-templates ─────────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await req.json();
      const parsed = createOrderTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // If isDefault, un-default others for same department
      if (data.isDefault) {
        try {
          const existing = await prisma.admissionOrderTemplate.findMany({
            where: { tenantId, departmentKey: data.departmentKey, isDefault: true },
          });
          for (const tmpl of existing) {
            await prisma.admissionOrderTemplate.update({
              where: { id: tmpl.id },
              data: { isDefault: false },
            });
          }
        } catch { /* ignore */ }
      }

      const template = await prisma.admissionOrderTemplate.create({
        data: {
          tenantId,
          name: data.name,
          nameAr: data.nameAr || null,
          departmentKey: data.departmentKey,
          diagnosisCode: data.diagnosisCode || null,
          items: data.items,
          isActive: true,
          isDefault: data.isDefault ?? false,
          createdBy: userId,
        },
      });

      return NextResponse.json({ success: true, template }, { status: 201 });
    } catch (err) {
      logger.error('[admission/order-templates] POST error:', err);
      return NextResponse.json({ error: 'Failed to create order template' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.admin' }
);
