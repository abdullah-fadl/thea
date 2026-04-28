import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET  /api/pharmacy/controlled-substances
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  withAccessAudit(async (req: NextRequest, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const schedule = url.searchParams.get('schedule');
      const transactionType = url.searchParams.get('transactionType');
      const search = url.searchParams.get('search');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const discrepancyOnly = url.searchParams.get('discrepancyOnly') === 'true';

      const where: any = { tenantId };
      if (schedule) where.schedule = schedule;
      if (transactionType && transactionType !== 'ALL') where.transactionType = transactionType;
      if (discrepancyOnly) where.discrepancyFound = true;
      if (search) {
        where.OR = [
          { medication: { contains: search, mode: 'insensitive' } },
          { genericName: { contains: search, mode: 'insensitive' } },
          { patientName: { contains: search, mode: 'insensitive' } },
          { mrn: { contains: search, mode: 'insensitive' } },
          { performedByName: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
      }

      const logs = await prisma.pharmacyControlledSubstanceLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      // Summary counts (unfiltered for KPI)
      const allLogs = await prisma.pharmacyControlledSubstanceLog.findMany({
        where: { tenantId },
        select: {
          transactionType: true,
          discrepancyFound: true,
          witnessUserId: true,
        },
        take: 200,
      });

      const summary = {
        total: allLogs.length,
        discrepancies: 0,
        pendingWitness: 0,
        waste: 0,
        receive: 0,
        dispense: 0,
        returns: 0,
        adjust: 0,
        transfer: 0,
      };

      for (const l of allLogs) {
        if (l.discrepancyFound) summary.discrepancies++;
        if (l.transactionType === 'WASTE') {
          summary.waste++;
          if (!l.witnessUserId) summary.pendingWitness++;
        }
        if (l.transactionType === 'DISPENSE') {
          if (!l.witnessUserId) summary.pendingWitness++;
        }
        if (l.transactionType === 'RECEIVE') summary.receive++;
        if (l.transactionType === 'DISPENSE') summary.dispense++;
        if (l.transactionType === 'RETURN') summary.returns++;
        if (l.transactionType === 'ADJUST') summary.adjust++;
        if (l.transactionType === 'TRANSFER') summary.transfer++;
      }

      return NextResponse.json({ logs, summary });
    } catch (e: any) {
      logger.error('[Pharmacy controlled-substances GET]', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to fetch controlled substance logs' }, { status: 500 });
    }
  }, { resourceType: 'medication', sensitive: true, logResponseMeta: true }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'pharmacy.view' },
);

// ---------------------------------------------------------------------------
// POST  /api/pharmacy/controlled-substances
// ---------------------------------------------------------------------------
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId, user }) => {
    try {
      const body = await req.json();
      const userName = user?.displayName || (user as any)?.name || user?.email || null;

      // Required fields
      if (!body.medication) {
        return NextResponse.json({ error: 'medication is required' }, { status: 400 });
      }
      if (!body.transactionType) {
        return NextResponse.json({ error: 'transactionType is required' }, { status: 400 });
      }
      if (body.quantity === undefined || body.quantity === null) {
        return NextResponse.json({ error: 'quantity is required' }, { status: 400 });
      }

      const validTypes = ['RECEIVE', 'DISPENSE', 'WASTE', 'RETURN', 'ADJUST', 'TRANSFER'];
      if (!validTypes.includes(body.transactionType)) {
        return NextResponse.json(
          { error: `transactionType must be one of: ${validTypes.join(', ')}` },
          { status: 400 },
        );
      }

      // Waste and Dispense require witness for DEA compliance
      const requiresWitness = ['WASTE', 'DISPENSE'].includes(body.transactionType);
      if (requiresWitness && !body.witnessUserId && !body.witnessName) {
        return NextResponse.json(
          { error: 'Witness verification is required for controlled substance waste/dispensing' },
          { status: 400 },
        );
      }

      // Calculate balance
      const balanceBefore = body.balanceBefore ?? null;
      let balanceAfter = body.balanceAfter ?? null;
      if (balanceBefore !== null && balanceAfter === null) {
        const qty = Number(body.quantity) || 0;
        switch (body.transactionType) {
          case 'RECEIVE':
          case 'RETURN':
            balanceAfter = balanceBefore + qty;
            break;
          case 'DISPENSE':
          case 'WASTE':
          case 'TRANSFER':
            balanceAfter = Math.max(0, balanceBefore - qty);
            break;
          case 'ADJUST':
            balanceAfter = qty; // Adjustment sets absolute value
            break;
        }
      }

      // Discrepancy detection
      const discrepancyFound =
        body.discrepancyFound === true ||
        (balanceBefore !== null && balanceAfter !== null && body.expectedBalance !== undefined
          ? balanceAfter !== body.expectedBalance
          : false);

      const record = await prisma.pharmacyControlledSubstanceLog.create({
        data: {
          tenantId,
          medication: body.medication,
          genericName: body.genericName ?? null,
          schedule: body.schedule ?? null,
          strength: body.strength ?? null,
          form: body.form ?? null,
          transactionType: body.transactionType,
          quantity: Number(body.quantity),
          unit: body.unit ?? null,
          balanceBefore: balanceBefore !== null ? Number(balanceBefore) : null,
          balanceAfter: balanceAfter !== null ? Number(balanceAfter) : null,
          patientId: body.patientId ?? null,
          patientName: body.patientName ?? null,
          mrn: body.mrn ?? null,
          prescriptionId: body.prescriptionId ?? null,
          performedByUserId: userId,
          performedByName: userName,
          witnessUserId: body.witnessUserId ?? null,
          witnessName: body.witnessName ?? null,
          wasteMethod: body.wasteMethod ?? null,
          wasteAmount: body.wasteAmount != null ? Number(body.wasteAmount) : null,
          sourceLocation: body.sourceLocation ?? null,
          destinationLocation: body.destinationLocation ?? null,
          lotNumber: body.lotNumber ?? null,
          expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
          verifiedByUserId: body.verifiedByUserId ?? null,
          verifiedByName: body.verifiedByName ?? null,
          verifiedAt: body.verifiedByUserId ? new Date() : null,
          discrepancyFound,
          discrepancyNote: body.discrepancyNote ?? null,
          notes: body.notes ?? null,
        },
      });

      await createAuditLog(
        'pharmacy_controlled_substance',
        record.id,
        'CONTROLLED_SUBSTANCE_LOGGED',
        userId || 'system',
        user?.email,
        {
          medication: body.medication,
          transactionType: body.transactionType,
          quantity: body.quantity,
          discrepancyFound,
          witnessUserId: body.witnessUserId || null,
        },
        tenantId
      );

      logger.info('Controlled substance log created', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/pharmacy/controlled-substances',
        medication: body.medication,
        transactionType: body.transactionType,
        quantity: body.quantity,
        discrepancyFound,
      });

      return NextResponse.json({ log: record }, { status: 201 });
    } catch (e: any) {
      logger.error('[Pharmacy controlled-substances POST]', {
        category: 'api',
        error: e instanceof Error ? e : undefined,
      });
      return NextResponse.json({ error: 'Failed to create controlled substance log' }, { status: 500 });
    }
  },
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'pharmacy.dispense' },
);
