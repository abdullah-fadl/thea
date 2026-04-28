import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Manpower → Recruitment Status API
 *
 * GET /api/cvision/manpower/recruitment-status
 * Returns which manpower positions have active job requisitions,
 * enabling the Manpower page to show recruitment linkage.
 *
 * POST /api/cvision/manpower/recruitment-status?action=fix-duplicates
 * Fixes duplicate requisition numbers by reassigning new unique numbers.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Filter, Document } from 'mongodb';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection, createTenantFilter, generateSequenceNumber } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const reqCol = await getCVisionCollection(tenantId, 'jobRequisitions');

      const activeReqs = await reqCol.find(createTenantFilter(tenantId, {
        status: { $regex: /^(open|approved|active|published|draft)$/i },
        isArchived: { $ne: true },
        deletedAt: { $exists: false },
      })).toArray();

      // Build lookup: positionId → requisition info, and fallback by title+dept
      const byPosition = new Map<string, any>();
      const byTitleDept = new Map<string, any>();

      for (const r of activeReqs) {
        const doc = r as Record<string, unknown>;
        const info = {
          requisitionId: doc.id,
          requisitionNumber: doc.requisitionNumber,
          title: doc.title,
          status: doc.status,
          departmentId: doc.departmentId,
          departmentName: doc.departmentName,
          headcount: (doc.headcountRequested as number) || (doc.headcount as number) || 1,
          applicantCount: (doc.applicantCount as number) || 0,
          createdAt: doc.createdAt,
          source: doc.manpowerLink ? 'MANPOWER_PLAN' : 'MANUAL',
        };

        if (doc.positionId) {
          byPosition.set(doc.positionId as string, info);
        }

        const titleKey = `${((doc.departmentId as string) || '').toLowerCase()}::${((doc.title as string) || '').toLowerCase().trim()}`;
        if (!byTitleDept.has(titleKey)) {
          byTitleDept.set(titleKey, info);
        }
      }

      return NextResponse.json({
        success: true,
        byPosition: Object.fromEntries(byPosition),
        byTitleDept: Object.fromEntries(byTitleDept),
        totalActiveRequisitions: activeReqs.length,
      });
    } catch (error: unknown) {
      logger.error('[Manpower Recruitment Status]', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.read' },
);

/**
 * POST handler: Fix duplicate JR numbers and sync sequence counter
 */
export const POST = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      if (action === 'fix-duplicates') {
        const reqCol = await getCVisionCollection(tenantId, 'jobRequisitions');
        const allReqs = await reqCol.find(createTenantFilter(tenantId)).limit(5000).toArray();

        // Find duplicates: group by requisitionNumber
        const byNumber = new Map<string, Document[]>();
        for (const r of allReqs) {
          const num = (r as Record<string, unknown>).requisitionNumber as string;
          if (!byNumber.has(num)) byNumber.set(num, []);
          byNumber.get(num)!.push(r);
        }

        const fixes: string[] = [];
        for (const [num, reqs] of byNumber.entries()) {
          if (reqs.length <= 1) continue;

          // Keep the oldest one, reassign newer ones
          const sorted = reqs.sort((a, b) =>
            new Date((a as Record<string, unknown>).createdAt as string || 0).getTime() - new Date((b as Record<string, unknown>).createdAt as string || 0).getTime()
          );

          for (let i = 1; i < sorted.length; i++) {
            // Generate a new unique number
            let newNumber = await generateSequenceNumber(tenantId, SEQUENCE_PREFIXES.requisition);
            // Verify uniqueness
            for (let attempt = 0; attempt < 10; attempt++) {
              const existing = await reqCol.findOne(createTenantFilter(tenantId, { requisitionNumber: newNumber } as Filter<Document>));
              if (!existing) break;
              newNumber = await generateSequenceNumber(tenantId, SEQUENCE_PREFIXES.requisition);
            }

            await reqCol.updateOne(
              { tenantId, _id: sorted[i]._id },
              { $set: { requisitionNumber: newNumber, updatedAt: new Date() } }
            );
            fixes.push(`${num} (${(sorted[i] as Record<string, unknown>).title}) → ${newNumber}`);
          }
        }

        // Also sync the sequence counter to be above the max existing number
        const maxNumReq = allReqs.reduce((max: number, r) => {
          const match = (((r as Record<string, unknown>).requisitionNumber as string) || '').match(/JR-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);

        // Sync the sequence counter — PG columns: entityType (unique key), prefix (NOT NULL), currentValue
        const { getTenantDbByKey } = await import('@/lib/cvision/infra');
        const db = await getTenantDbByKey(tenantId);
        const syncValue = Math.max(maxNumReq, allReqs.length) + fixes.length;
        await db.collection('cvision_sequences').updateOne(
          { tenantId, entityType: 'JR' },
          { $set: { currentValue: syncValue, prefix: 'JR', entityType: 'JR' } },
          { upsert: true }
        );

        return NextResponse.json({
          success: true,
          message: `Fixed ${fixes.length} duplicate(s). Sequence synced to ${Math.max(maxNumReq, allReqs.length) + fixes.length}.`,
          fixes,
        });
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: unknown) {
      logger.error('[Recruitment Status Fix]', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.manpower.write' },
);
