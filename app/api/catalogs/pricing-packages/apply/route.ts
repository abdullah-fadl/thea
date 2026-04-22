import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    packageId: z.string().min(1),
    encounterId: z.string().min(1),
    requestId: z.string().min(1),
    note: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const packageId = String(body.packageId || '').trim();
  const encounterId = String(body.encounterId || '').trim();
  const requestId = String(body.requestId || '').trim();
  const note = String(body.note || '').trim();

  const missing: string[] = [];
  if (!packageId) missing.push('packageId');
  if (!encounterId) missing.push('encounterId');
  if (!requestId) missing.push('requestId');
  if (missing.length) return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });

  const pkg = await prisma.pricingPackage.findFirst({
    where: { tenantId, id: packageId },
  });
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  if (pkg.status !== 'ACTIVE') return NextResponse.json({ error: 'Package inactive' }, { status: 409 });

  const existingApplication = await prisma.pricingPackageApplication.findFirst({
    where: { tenantId, requestId },
  });
  if (existingApplication) {
    return NextResponse.json({ application: existingApplication, noOp: true });
  }

  const now = new Date();
  const applicationData = {
    id: uuidv4(),
    tenantId,
    packageId,
    packageCode: pkg.code,
    packageName: pkg.name,
    encounterId,
    requestId,
    appliedPrice: pkg.fixedPrice,
    overridesCharges: true,
    note: note || null,
    createdAt: now,
    createdByUserId: userId || null,
    createdByEmail: user?.email || null,
  };

  let application;
  try {
    application = await prisma.pricingPackageApplication.create({ data: applicationData });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existingRecord = await prisma.pricingPackageApplication.findFirst({
        where: { tenantId, requestId },
      });
      if (existingRecord) {
        return NextResponse.json(
          { application: existingRecord, noOp: true },
          { headers: { 'x-idempotent-replay': '1' } }
        );
      }
    }
    throw err;
  }

  return NextResponse.json({ application });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
