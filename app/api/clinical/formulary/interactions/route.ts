import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const interactionCheckSchema = z.object({
  drugIds: z.array(z.string().min(1)).min(2, 'At least 2 drugs required'),
});

// POST — Check interactions between multiple drugs
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const v = validateBody(body, interactionCheckSchema);
    if ('error' in v) return v.error;

    const drugs = await prisma.formularyDrug.findMany({
      where: { tenantId, id: { in: v.data.drugIds }, isActive: true },
    });

    if (drugs.length < 2) {
      return NextResponse.json({ hasInteractions: false, hasMajor: false, interactions: [] });
    }

    // Pairwise interaction check using stored interaction data
    const foundInteractions: Array<{
      drug1: string;
      drug1Ar: string;
      drug2: string;
      drug2Ar: string;
      severity: string;
      mechanism: string;
      clinicalEffect: string;
      clinicalEffectAr: string;
      management: string;
      managementAr: string;
    }> = [];

    const normalize = (s: string) => s.trim().toLowerCase();

    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const d1 = drugs[i];
        const d2 = drugs[j];
        const d1Interactions = Array.isArray(d1.interactions) ? d1.interactions as any[] : [];
        const d2Interactions = Array.isArray(d2.interactions) ? d2.interactions as any[] : [];

        // Check d1 interactions for d2
        for (const int of d1Interactions) {
          if (normalize(int.interactsWith || '') === normalize(d2.genericName)) {
            foundInteractions.push({
              drug1: d1.genericName,
              drug1Ar: d1.genericNameAr,
              drug2: d2.genericName,
              drug2Ar: d2.genericNameAr,
              severity: int.severity,
              mechanism: int.mechanism || '',
              clinicalEffect: int.clinicalEffect || '',
              clinicalEffectAr: int.clinicalEffectAr || '',
              management: int.management || '',
              managementAr: int.managementAr || '',
            });
          }
        }

        // Check d2 interactions for d1
        for (const int of d2Interactions) {
          if (normalize(int.interactsWith || '') === normalize(d1.genericName)) {
            const dup = foundInteractions.find(
              (x) =>
                (normalize(x.drug1) === normalize(d2.genericName) && normalize(x.drug2) === normalize(d1.genericName)) ||
                (normalize(x.drug1) === normalize(d1.genericName) && normalize(x.drug2) === normalize(d2.genericName))
            );
            if (!dup) {
              foundInteractions.push({
                drug1: d2.genericName,
                drug1Ar: d2.genericNameAr,
                drug2: d1.genericName,
                drug2Ar: d1.genericNameAr,
                severity: int.severity,
                mechanism: int.mechanism || '',
                clinicalEffect: int.clinicalEffect || '',
                clinicalEffectAr: int.clinicalEffectAr || '',
                management: int.management || '',
                managementAr: int.managementAr || '',
              });
            }
          }
        }
      }
    }

    const severityOrder: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
    foundInteractions.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return NextResponse.json({
      hasInteractions: foundInteractions.length > 0,
      hasMajor: foundInteractions.some((i) => i.severity === 'major'),
      interactions: foundInteractions,
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'formulary.view' }
);
