import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const patientId = String(req.nextUrl.searchParams.get('patientId') || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId, id: patientId },
  });
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  // Check for insurance from patient_insurance table (primary source)
  const insurance = await prisma.patientInsurance.findFirst({
    where: { tenantId, patientId, isPrimary: true },
    orderBy: { createdAt: 'desc' },
  });

  const provider = insurance?.payerName || insurance?.insurerName || (patient as any).insuranceProvider || null;
  const policyNumber = insurance?.policyNumber || (patient as any).insurancePolicyNumber || null;
  const expiry = insurance?.expiryDate
    ? new Date(insurance.expiryDate)
    : (patient as any).insuranceExpiryDate
    ? new Date((patient as any).insuranceExpiryDate)
    : null;

  if (!provider || !policyNumber) {
    return NextResponse.json({
      valid: false,
      status: 'MISSING',
      provider,
      policyNumber,
      expiresAt: expiry ? expiry.toISOString() : null,
      reason: 'No insurance information on file',
    });
  }

  if (expiry && expiry.getTime() < Date.now()) {
    return NextResponse.json({
      valid: false,
      status: 'EXPIRED',
      provider,
      policyNumber,
      expiresAt: expiry.toISOString(),
      reason: 'Insurance policy expired',
    });
  }

  return NextResponse.json({
    valid: true,
    status: 'ACTIVE',
    provider,
    policyNumber,
    expiresAt: expiry ? expiry.toISOString() : null,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.registration' }
);
