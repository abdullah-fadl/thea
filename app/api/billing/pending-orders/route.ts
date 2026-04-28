import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RawOrder = Record<string, any>;

const TYPE_LABELS = new Set(['LAB', 'RADIOLOGY', 'PROCEDURE', 'MEDICATION']);

function normalizeOrder(order: RawOrder, type: string) {
  const orderType = String(type || '').toUpperCase();
  const code =
    order.testCode ||
    order.examCode ||
    order.orderCode ||
    order.code ||
    order.procedureCode ||
    order.serviceCode ||
    '';
  const name =
    order.testName ||
    order.examName ||
    order.orderName ||
    order.name ||
    order.procedureName ||
    order.serviceName ||
    '';
  const nameAr =
    order.testNameAr ||
    order.examNameAr ||
    order.orderNameAr ||
    order.nameAr ||
    order.procedureNameAr ||
    order.serviceNameAr ||
    null;
  const orderedAt = order.orderedAt || order.requestedAt || order.createdAt || order.updatedAt;
  const quantity = Number(order.quantity || 1) || 1;
  const meta = order.meta || {};

  return {
    id: String(order.id || ''),
    type: TYPE_LABELS.has(orderType) ? orderType : 'LAB',
    code: String(code || '').trim(),
    name: String(name || '').trim(),
    nameAr: nameAr ? String(nameAr || '').trim() : null,
    patientId: String(order.patientId || order.patientMasterId || '').trim(),
    patientName: order.patientName || meta.patientDisplay || meta.patientFullName || null,
    patientMrn: order.patientMrn || meta.mrn || null,
    encounterId: order.encounterId || order.encounterCoreId || null,
    orderedBy: order.orderedBy || order.createdByUserId || null,
    orderedByName: meta.orderedByName || meta.orderedByDisplay || null,
    orderedAt: orderedAt ? new Date(orderedAt).toISOString() : new Date().toISOString(),
    status: order.status || null,
    payment: meta.payment || null,
    price: Number(meta.price || meta.unitPrice || 0) || 0,
    quantity,
    totalPrice: Number(meta.totalPrice || 0) || 0,
    priority: order.priority || null,
    notes: order.notes || null,
  };
}

function isPendingPaymentStatus(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  return !normalized || normalized === 'PENDING_PAYMENT';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const patientId = params.get('patientId');
  const paymentStatus = String(params.get('paymentStatus') || 'PENDING_PAYMENT').toUpperCase();
  const typeFilter = params.get('type') ? String(params.get('type') || '').toUpperCase() : '';
  const search = String(params.get('search') || '').trim();

  const where: any = { tenantId };
  if (patientId) {
    where.patientMasterId = patientId;
  }

  // orders_hub is the primary source (legacy collections removed during Prisma migration)
  const hubOrders = await prisma.ordersHub.findMany({ where, take: 200 });

  const normalized = hubOrders.map((order: any) =>
    normalizeOrder(order, order.kind || order.orderType || order.type)
  );

  let filtered = normalized.filter((order) => {
    const status = String(order.payment?.status || '').toUpperCase();
    if (paymentStatus === 'PENDING_PAYMENT') {
      return isPendingPaymentStatus(status);
    }
    return status === paymentStatus;
  });

  if (typeFilter) {
    filtered = filtered.filter((order) => String(order.type || '').toUpperCase() === typeFilter);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter((order) => {
      return (
        String(order.patientName || '').toLowerCase().includes(searchLower) ||
        String(order.patientMrn || '').toLowerCase().includes(searchLower) ||
        String(order.name || '').toLowerCase().includes(searchLower) ||
        String(order.code || '').toLowerCase().includes(searchLower)
      );
    });
  }

  const missingPatientIds = Array.from(
    new Set(
      filtered
        .filter((order) => order.patientId && (!order.patientName || !order.patientMrn))
        .map((order) => String(order.patientId))
    )
  );
  const patients = missingPatientIds.length
    ? await prisma.patientMaster.findMany({
        where: { tenantId, id: { in: missingPatientIds } },
        select: { id: true, fullName: true, mrn: true },
      })
    : [];
  const patientById = patients.reduce<Record<string, any>>((acc, patient) => {
    acc[String(patient.id || '')] = patient;
    return acc;
  }, {});

  const codeSet = Array.from(
    new Set(filtered.map((order) => String(order.code || '').trim()).filter(Boolean))
  );
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidCodes = codeSet.filter((c) => UUID_RE.test(c));
  const nonUuidCodes = codeSet.filter((c) => !UUID_RE.test(c));
  const catalogConditions: any[] = [];
  if (nonUuidCodes.length) catalogConditions.push({ code: { in: nonUuidCodes } });
  if (uuidCodes.length) catalogConditions.push({ id: { in: uuidCodes } });
  const catalogs = catalogConditions.length
    ? await prisma.billingChargeCatalog.findMany({
        where: { tenantId, OR: catalogConditions },
        select: { id: true, code: true, name: true, basePrice: true },
      })
    : [];

  const catalogByCode = catalogs.reduce<Record<string, any>>((acc, item) => {
    acc[String(item.code || '').trim()] = item;
    acc[String(item.id || '').trim()] = item;
    return acc;
  }, {});

  const items = filtered
    .map((order) => {
      const patient = patientById[String(order.patientId || '')] || null;
      const catalog = catalogByCode[String(order.code || '').trim()];
      const unitPrice = order.price || Number(catalog?.basePrice || 0);
      const name = order.name || catalog?.name || '';
      const totalPrice = order.totalPrice || Number((unitPrice * (order.quantity || 1)).toFixed(2));
      return {
        ...order,
        patientName: order.patientName || patient?.fullName || null,
        patientMrn: order.patientMrn || patient?.mrn || null,
        name,
        price: unitPrice,
        totalPrice,
      };
    })
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.payment.view' }
);
