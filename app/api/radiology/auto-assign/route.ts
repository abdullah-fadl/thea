import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const autoAssignSchema = z.object({
  studyIds: z.array(z.string().min(1)).optional(),
  strategy: z.enum(['round-robin', 'workload-balanced', 'subspecialty-match']).default('round-robin'),
});

interface AssignmentResult {
  studyId: string;
  assignedTo: string;
  assignedToName: string;
  reason: string;
}

/**
 * POST /api/radiology/auto-assign
 *
 * Auto-assign unread radiology studies to available radiologists.
 * Supports three strategies:
 *   - round-robin:         Distribute evenly in sequential order
 *   - workload-balanced:   Assign to radiologist with fewest active studies
 *   - subspecialty-match:  Match modality to provider specialty when possible
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, autoAssignSchema);
    if ('error' in v) return v.error;

    const { studyIds, strategy } = v.data;

    // 1. Get available radiologists from clinical infra providers
    //    Filter by specialty that includes radiology
    const providers = await prisma.clinicalInfraProvider.findMany({
      where: {
        tenantId,
        isArchived: false,
        OR: [
          { specialtyCode: { contains: 'radiology', mode: 'insensitive' } },
          { specialtyCode: { contains: 'RAD', mode: 'insensitive' } },
          { specialtyCode: 'RADIOLOGY' },
        ],
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        specialtyCode: true,
      },
    });

    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: 'NO_RADIOLOGISTS',
          message: 'No available radiologists found / لا يوجد أطباء أشعة متاحون',
        },
        { status: 400 }
      );
    }

    // 2. Fetch unassigned studies (from ordersHub, radiology kind)
    const studyFilter: Record<string, any> = {
      tenantId,
      departmentKey: 'radiology',
      kind: 'RADIOLOGY',
      status: { in: ['ORDERED', 'SCHEDULED', 'IN_PROGRESS'] },
    };

    // If specific study IDs provided, filter to those
    if (studyIds && studyIds.length > 0) {
      studyFilter.id = { in: studyIds };
    }

    const studies = await prisma.ordersHub.findMany({
      where: studyFilter,
      orderBy: [
        { priority: 'desc' },
        { orderedAt: 'asc' },
      ],
      take: 200,
    });

    // Filter out already-assigned studies (radiologistId in meta)
    const unassignedStudies = studies.filter((s: any) => {
      const meta = (s.meta || {}) as Record<string, any>;
      return !meta.assignedRadiologistId;
    });

    if (unassignedStudies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unassigned studies found / لا توجد دراسات غير مُسندة',
        assignments: [],
        totalAssigned: 0,
      });
    }

    // 3. Assign based on strategy
    const assignments: AssignmentResult[] = [];

    switch (strategy) {
      case 'round-robin': {
        for (let i = 0; i < unassignedStudies.length; i++) {
          const provider = providers[i % providers.length];
          assignments.push({
            studyId: unassignedStudies[i].id,
            assignedTo: provider.id,
            assignedToName: provider.displayName,
            reason: `Round-robin assignment (position ${i % providers.length + 1}/${providers.length})`,
          });
        }
        break;
      }

      case 'workload-balanced': {
        // Count current active assignments per radiologist
        const workloadCounts = new Map<string, number>();
        for (const p of providers) {
          workloadCounts.set(p.id, 0);
        }

        // Count existing assignments in active studies
        const allActiveStudies = await prisma.ordersHub.findMany({
          where: {
            tenantId,
            departmentKey: 'radiology',
            kind: 'RADIOLOGY',
            status: { in: ['ORDERED', 'SCHEDULED', 'IN_PROGRESS'] },
          },
          select: { id: true, meta: true },
        });

        for (const s of allActiveStudies) {
          const meta = (s.meta || {}) as Record<string, any>;
          const assignedId = meta.assignedRadiologistId;
          if (assignedId && workloadCounts.has(assignedId)) {
            workloadCounts.set(assignedId, (workloadCounts.get(assignedId) || 0) + 1);
          }
        }

        for (const study of unassignedStudies) {
          // Find provider with the least workload
          let minProvider = providers[0];
          let minCount = workloadCounts.get(providers[0].id) || 0;

          for (const p of providers) {
            const count = workloadCounts.get(p.id) || 0;
            if (count < minCount) {
              minCount = count;
              minProvider = p;
            }
          }

          assignments.push({
            studyId: study.id,
            assignedTo: minProvider.id,
            assignedToName: minProvider.displayName,
            reason: `Workload-balanced (current load: ${minCount})`,
          });

          // Increment count for the assigned provider
          workloadCounts.set(minProvider.id, (workloadCounts.get(minProvider.id) || 0) + 1);
        }
        break;
      }

      case 'subspecialty-match': {
        // Build specialty-modality mapping from provider profiles
        const providerProfiles = await prisma.clinicalInfraProviderProfile.findMany({
          where: {
            tenantId,
            providerId: { in: providers.map((p) => p.id) },
          },
          select: {
            providerId: true,
            specialtyIds: true,
            level: true,
          },
        });

        const profileMap = new Map<string, any>();
        for (const profile of providerProfiles) {
          profileMap.set(profile.providerId, profile);
        }

        // Assign by modality match, fall back to round-robin
        let fallbackIndex = 0;

        for (const study of unassignedStudies) {
          const meta = (study.meta || {}) as Record<string, any>;
          const studyModality = (meta.modality || '').toUpperCase();

          // Try to find a provider whose specialty matches the modality
          let matchedProvider = null;

          if (studyModality) {
            for (const p of providers) {
              const profile = profileMap.get(p.id);
              const specialties = profile?.specialtyIds || [];
              const specialtyCode = (p.specialtyCode || '').toUpperCase();

              // Check if specialty aligns with modality
              const modalitySpecialtyMap: Record<string, string[]> = {
                'CT': ['CT', 'BODY_IMAGING', 'NEURORADIOLOGY', 'COMPUTED_TOMOGRAPHY'],
                'MRI': ['MRI', 'BODY_IMAGING', 'NEURORADIOLOGY', 'MAGNETIC_RESONANCE'],
                'US': ['US', 'ULTRASOUND', 'OB_GYN_IMAGING'],
                'XR': ['XR', 'GENERAL_RADIOLOGY', 'CHEST_IMAGING', 'MSK'],
                'NM': ['NM', 'NUCLEAR_MEDICINE'],
                'FLUORO': ['FLUORO', 'FLUOROSCOPY', 'GI_IMAGING'],
              };

              const matchingSpecialties = modalitySpecialtyMap[studyModality] || [];
              const hasMatch = matchingSpecialties.some((ms) =>
                specialtyCode.includes(ms) ||
                specialties.some((sid: string) => sid.toUpperCase().includes(ms))
              );

              if (hasMatch) {
                matchedProvider = p;
                break;
              }
            }
          }

          // Fall back to round-robin if no specialty match
          const assignedProvider = matchedProvider || providers[fallbackIndex % providers.length];
          if (!matchedProvider) fallbackIndex++;

          assignments.push({
            studyId: study.id,
            assignedTo: assignedProvider.id,
            assignedToName: assignedProvider.displayName,
            reason: matchedProvider
              ? `Subspecialty match (${studyModality})`
              : `Round-robin fallback (no ${studyModality} specialist)`,
          });
        }
        break;
      }
    }

    // 4. Persist assignments in ordersHub meta
    const updatePromises = assignments.map((a) => {
      const study = unassignedStudies.find((s) => s.id === a.studyId);
      const currentMeta = ((study?.meta || {}) as Record<string, any>);
      return prisma.ordersHub.update({
        where: { id: a.studyId },
        data: {
          meta: {
            ...currentMeta,
            assignedRadiologistId: a.assignedTo,
            assignedRadiologistName: a.assignedToName,
            assignedAt: new Date().toISOString(),
            assignmentStrategy: strategy,
          },
        },
      });
    });

    await Promise.all(updatePromises);

    // 5. Audit trail
    await createAuditLog(
      'RadiologyAutoAssign',
      'batch',
      'STUDIES_AUTO_ASSIGNED',
      userId,
      user?.email || undefined,
      {
        strategy,
        totalAssigned: assignments.length,
        providerCount: providers.length,
        studyIds: assignments.map((a) => a.studyId),
      },
      tenantId,
      req
    );

    logger.info('Radiology studies auto-assigned', {
      category: 'api',
      tenantId,
      userId,
      route: '/api/radiology/auto-assign',
      strategy,
      totalAssigned: assignments.length,
      providerCount: providers.length,
    });

    return NextResponse.json({
      success: true,
      strategy,
      assignments,
      totalAssigned: assignments.length,
      availableRadiologists: providers.length,
    });
  }),
  { tenantScoped: true, permissionKey: 'radiology.view' }
);
