import { logger } from '@/lib/monitoring/logger';
/**
 * CVision CV Inbox Batch Suggest API
 * POST /api/cvision/recruitment/cv-inbox/batches/:id/suggest - Suggest requisitions for all items (rule-based scoring)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCvInboxBatch, CVisionCvInboxItem, CVisionJobRequisition } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessCvInbox } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Tokenize text into keywords (deterministic: lowercase, split on non-letters, remove short tokens <3)
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace non-letters/numbers with spaces
    .split(/\s+/) // Split on whitespace
    .filter(token => token.length >= 3) // Remove tokens shorter than 3 characters
    .filter(Boolean); // Remove empty strings
}

/**
 * Calculate keyword match score between CV text and requisition
 * Returns score (0-100) based on keyword overlap
 * 
 * Scoring uses: requisition.title + jobTitle name + departmentName tokens
 */
async function calculateScore(
  cvText: string, 
  requisition: CVisionJobRequisition,
  tenantId: string
): Promise<number> {
  const cvTokens = new Set(tokenize(cvText));
  
  // Fetch jobTitle and department names for better matching
  let jobTitleName = '';
  let departmentName = '';
  
  try {
    if (requisition.jobTitleId) {
      const jobTitleCollection = await getCVisionCollection(tenantId, 'jobTitles');
      const jobTitle = await findById(jobTitleCollection, tenantId, requisition.jobTitleId);
      if (jobTitle && (jobTitle as Record<string, unknown>).name) {
        jobTitleName = (jobTitle as Record<string, unknown>).name as string;
      }
    }
    
    if (requisition.departmentId) {
      const departmentCollection = await getCVisionCollection(tenantId, 'departments');
      const department = await findById(departmentCollection, tenantId, requisition.departmentId);
      if (department && (department as Record<string, unknown>).name) {
        departmentName = (department as Record<string, unknown>).name as string;
      }
    }
  } catch (err) {
    // If lookup fails, continue with title only
    logger.warn('[CV Inbox Suggest] Failed to fetch jobTitle/department:', err);
  }
  
  // Build requisition text from title + jobTitle name + departmentName + description + skills + requirements
  const reqText = [
    requisition.title || '',
    jobTitleName,
    departmentName,
    requisition.description || '',
    Array.isArray(requisition.requirements) ? requisition.requirements.join(' ') : '',
    Array.isArray(requisition.skills) ? requisition.skills.join(' ') : '',
  ].join(' ').toLowerCase();
  
  const reqTokens = new Set(tokenize(reqText));
  
  // Count matching keywords
  let matches = 0;
  for (const token of cvTokens) {
    if (reqTokens.has(token)) {
      matches++;
    }
  }
  
  // Score = (matches / total unique tokens) * 100
  // Use harmonic mean to balance both sets
  const totalUniqueTokens = Math.max(cvTokens.size, reqTokens.size);
  if (totalUniqueTokens === 0) return 0;
  
  const score = (matches / totalUniqueTokens) * 100;
  return Math.min(100, Math.round(score * 100) / 100); // Round to 2 decimals, cap at 100
}

// POST - Suggest requisitions for all items
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Check permission (HR roles only - CV Inbox access)
      const cvInboxPolicy = canAccessCvInbox(ctx);
      const enforceResult = await enforce(cvInboxPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const resolvedParams = await params;
      const batchId = resolvedParams?.id as string;

      if (!batchId) {
        return NextResponse.json(
          { error: 'Batch ID is required' },
          { status: 400 }
        );
      }

      // Verify batch exists
      const batchCollection = await getCVisionCollection<CVisionCvInboxBatch>(
        tenantId,
        'cvInboxBatches'
      );
      const batch = await findById(batchCollection, tenantId, batchId);
      if (!batch) {
        return NextResponse.json(
          { error: 'Batch not found' },
          { status: 404 }
        );
      }

      const itemCollection = await getCVisionCollection<CVisionCvInboxItem>(
        tenantId,
        'cvInboxItems'
      );

      // Get all PARSED items (with extractedRawText, no parseError)
      const items = await itemCollection
        .find(createTenantFilter(tenantId, { 
          batchId, 
          status: 'PARSED',
          extractedRawText: { $exists: true, $ne: null },
          parseError: null, // Only items that parsed successfully
        }))
        .toArray();

      if (items.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No parsed items to suggest for',
          suggestedCount: 0,
        });
      }

      // Get all active requisitions
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      // Get only OPEN requisitions (strict requirement - status='open' lowercase)
      const requisitions = await requisitionCollection
        .find(createTenantFilter(tenantId, { 
          status: 'open', // Only OPEN requisitions for suggestions
        }))
        .toArray();

      if (requisitions.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No active requisitions available for matching',
          suggestedCount: 0,
        });
      }

      const now = new Date();
      let suggestedCount = 0;

      // Process each item
      for (const item of items) {
        if (!item.extractedRawText) continue;

        // Calculate scores for all requisitions
        const scores: Array<{ requisitionId: string; score: number }> = [];
        for (const req of requisitions) {
          const score = await calculateScore(item.extractedRawText, req, tenantId);
          if (score > 0) {
            scores.push({ requisitionId: req.id, score });
          }
        }

        // Sort by score descending and take top 3
        scores.sort((a, b) => b.score - a.score);
        const top3 = scores.slice(0, 3);

        if (top3.length > 0) {
          const suggestedIds = top3.map(s => s.requisitionId);
          const suggestedScores: Record<string, number> = {};
          top3.forEach(s => {
            suggestedScores[s.requisitionId] = s.score;
          });

          // Default assignedRequisitionId to top-1 suggestion (score > 0)
          const topSuggestionId = suggestedIds[0];

          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                suggestedRequisitionIdsJson: suggestedIds,
                suggestedScoresJson: suggestedScores,
                assignedRequisitionId: topSuggestionId, // Default to top-1
                status: 'SUGGESTED',
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
          suggestedCount++;
        } else {
          // No matches found - keep status as PARSED, clear suggestions
          await itemCollection.updateOne(
            createTenantFilter(tenantId, { id: item.id }),
            {
              $set: {
                suggestedRequisitionIdsJson: [],
                suggestedScoresJson: {},
                assignedRequisitionId: null,
                status: 'SUGGESTED', // Still mark as SUGGESTED even if no matches
                updatedAt: now,
                updatedBy: userId,
              },
            }
          );
        }
      }

      // Update batch suggestedCount (count all items with status SUGGESTED)
      const currentSuggestedCount = await itemCollection.countDocuments(
        createTenantFilter(tenantId, { 
          batchId, 
          status: 'SUGGESTED',
        })
      );

      await batchCollection.updateOne(
        createTenantFilter(tenantId, { id: batchId }),
        {
          $set: {
            suggestedCount: currentSuggestedCount,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'cv_inbox_batch_suggest',
        'cv_inbox_batch',
        {
          resourceId: batchId,
          changes: {
            after: {
              suggestedCount,
              totalItems: items.length,
            },
          },
        }
      );

      return NextResponse.json({
        success: true,
        suggestedCount: currentSuggestedCount,
        totalItems: items.length,
      });
    } catch (error: any) {
      logger.error('[CVision CV Inbox Batch Suggest POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
