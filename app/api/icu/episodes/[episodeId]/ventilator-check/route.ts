import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const checks = await prisma.icuVentilatorCheck.findMany({
      where: { episodeId, tenantId },
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ checks });
  }),
  { permissionKey: 'ipd.nursing.view' },
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
    const episodeId = String((params as Record<string, string>)?.episodeId || '').trim();
    if (!episodeId) return NextResponse.json({ error: 'Missing episodeId' }, { status: 400 });
    const body = await req.json();
    const check = await prisma.icuVentilatorCheck.create({
      data: {
        tenantId,
        episodeId,
        checkedAt: new Date(),
        checkedBy: body.checkedBy || userId,
        mode: body.mode || null,
        fio2: body.fio2 != null ? Number(body.fio2) : null,
        tidalVolume: body.tidalVolume != null ? Number(body.tidalVolume) : null,
        respiratoryRate: body.respiratoryRate != null ? Number(body.respiratoryRate) : null,
        peep: body.peep != null ? Number(body.peep) : null,
        pip: body.pip != null ? Number(body.pip) : null,
        pplat: body.pplat != null ? Number(body.pplat) : null,
        spo2: body.spo2 != null ? Number(body.spo2) : null,
        etco2: body.etco2 != null ? Number(body.etco2) : null,
        alarms: body.alarms ?? null,
      },
    });
    return NextResponse.json({ check }, { status: 201 });
  }),
  { permissionKey: 'ipd.nursing.write' },
);
