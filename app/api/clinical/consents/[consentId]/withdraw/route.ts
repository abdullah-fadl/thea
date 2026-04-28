import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { writeAccessLog, withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const url = req.nextUrl.pathname;
    const segments = url.split('/');
    // URL pattern: /api/clinical/consents/[consentId]/withdraw
    const consentId = segments[segments.length - 2];

    if (!consentId) {
      return NextResponse.json({ error: 'Missing consentId' }, { status: 400 });
    }

    let body: { reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'Withdrawal reason is required' }, { status: 400 });
    }

    // Find the consent and verify it belongs to this tenant
    const consent = await prisma.clinicalConsent.findFirst({
      where: { id: consentId, tenantId },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    if (consent.status === 'withdrawn') {
      return NextResponse.json({ error: 'Consent is already withdrawn' }, { status: 409 });
    }

    const now = new Date();
    const updated = await prisma.clinicalConsent.update({
      where: { id: consentId },
      data: {
        withdrawnAt: now,
        withdrawnBy: userId || null,
        withdrawalReason: reason,
        status: 'withdrawn',
      },
    });

    // Audit log the withdrawal
    await writeAccessLog({
      tenantId,
      actorUserId: userId || 'unknown',
      action: 'consent_withdrawal',
      resourceType: 'consent',
      resourceId: consentId,
      patientId: consent.patientId || undefined,
      metadata: {
        consentType: consent.consentType,
        encounterId: consent.encounterId,
        withdrawalReason: reason,
      },
    } as any);

    return NextResponse.json({ consent: updated });
  }), { resourceType: 'consent', action: 'consent_withdrawal', extractResourceId: (req) => { const parts = req.nextUrl.pathname.split('/'); const idx = parts.indexOf('consents'); return idx >= 0 ? parts[idx + 1] || null : null; } }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.registration' }
);
