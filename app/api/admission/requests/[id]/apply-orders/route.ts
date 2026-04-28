import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { applyOrdersSchema } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── POST /api/admission/requests/[id]/apply-orders ──────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      const body = await req.json();
      const parsed = applyOrdersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      // 1. Fetch request — must be ADMITTED
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }
      if (request.status !== 'ADMITTED' || !request.episodeId) {
        return NextResponse.json(
          { error: 'Patient must be admitted before applying orders' },
          { status: 409 }
        );
      }

      // 2. Resolve order items from template or direct items
      let orderItems: Array<{ kind: string; title: string; notes?: string }> = [];

      if (parsed.data.templateId) {
        const template = await prisma.admissionOrderTemplate.findFirst({
          where: { tenantId, id: parsed.data.templateId, isActive: true },
        });
        if (!template) {
          return NextResponse.json({ error: 'Order template not found or inactive' }, { status: 404 });
        }

        const templateItems = Array.isArray(template.items) ? template.items : [];
        orderItems = templateItems.map((item: any) => ({
          kind: item.kind || 'LAB',
          title: item.orderName || item.orderNameAr || '',
          notes: item.defaults?.notes || '',
        }));
      } else if (parsed.data.items && parsed.data.items.length > 0) {
        orderItems = parsed.data.items;
      } else {
        return NextResponse.json(
          { error: 'Either templateId or items array is required' },
          { status: 400 }
        );
      }

      if (orderItems.length === 0) {
        return NextResponse.json(
          { error: 'No order items to apply' },
          { status: 400 }
        );
      }

      // 3. Create IpdOrder for each item
      const createdOrders = [];
      for (const item of orderItems) {
        try {
          const order = await prisma.ipdOrder.create({
            data: {
              tenantId,
              episodeId: request.episodeId,
              encounterId: null,
              kind: item.kind,
              title: item.title,
              notes: item.notes || null,
              status: 'ORDERED',
              createdByUserId: userId,
            },
          });
          createdOrders.push(order);
        } catch (err) {
          logger.error('[apply-orders] Failed to create order:', item.title, err);
          // Continue creating remaining orders
        }
      }

      return NextResponse.json({
        success: true,
        ordersCreated: createdOrders.length,
        totalRequested: orderItems.length,
        orders: createdOrders,
      }, { status: 201 });
    } catch (err) {
      logger.error('[admission/requests/[id]/apply-orders] POST error:', err);
      return NextResponse.json({ error: 'Failed to apply orders' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
