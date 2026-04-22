import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
export const dynamic = 'force-dynamic';
export const GET = withAuthTenant(
  async (req: NextRequest, { tenantId }, params: any) => {
    try {
      const order = await prisma.ivAdmixtureOrder.findFirst({ where: { id: params.orderId, tenantId } });
      if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const label = {
        patientId: order.patientId, drug: order.drug, diluent: order.diluent,
        concentration: order.finalConcentration ? order.finalConcentration + ' ' + (order.concentrationUnit || '') : order.drugDose + ' ' + order.drugDoseUnit + ' in ' + order.diluentVolume + 'mL',
        rate: order.infusionRate ? order.infusionRate + ' mL/hr' : null,
        bud: order.beyondUseDate, storage: order.storageCondition, batchId: order.batchId,
      };
      await prisma.ivAdmixtureOrder.update({ where: { id: params.orderId }, data: { labelPrinted: true } });
      return NextResponse.json({ label });
    } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
  },
  { permissionKey: 'pharmacy.iv-admixture.view' }
);
