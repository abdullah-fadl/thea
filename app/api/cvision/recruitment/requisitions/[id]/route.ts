import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Job Requisition by ID API
 * GET /api/cvision/recruitment/requisitions/[id] - Get requisition
 * PUT /api/cvision/recruitment/requisitions/[id] - Update requisition
 * DELETE /api/cvision/recruitment/requisitions/[id] - Archive requisition
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
  computeChanges,
} from '@/lib/cvision/audit';
import { updateJobRequisitionSchema, approveRequisitionSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS, REQUISITION_STATUS_TRANSITIONS } from '@/lib/cvision/constants';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import type { CVisionJobRequisition, RequisitionStatus, RequisitionApproval, CVisionPositionSlot, CVisionBudgetedPosition } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';
import { checkSlotCapacity } from '@/lib/cvision/budget/slots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get requisition by ID
export const GET = withAuthTenant(
  async (request, { tenantId }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      const requisition = await findById(collection, tenantId, id);

      if (!requisition) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      // Get candidate count
      const candidateCollection = await getCVisionCollection(tenantId, 'candidates');
      const candidateCount = await candidateCollection.countDocuments(
        createTenantFilter(tenantId, { requisitionId: id })
      );

      // Get slot summary (PR-B) - handle gracefully if collection doesn't exist yet
      let slotSummary = {
        total: 0,
        vacant: 0,
        filled: 0,
        frozen: 0,
      };
      
      try {
        const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
          tenantId,
          'positionSlots'
        );
        const slots = await slotCollection
          .find(createTenantFilter(tenantId, { requisitionId: id }))
          .toArray();
        
        slotSummary = {
          total: slots.length,
          vacant: slots.filter(s => s.status === 'VACANT').length,
          filled: slots.filter(s => s.status === 'FILLED').length,
          frozen: slots.filter(s => s.status === 'FROZEN').length,
        };
      } catch (slotError: unknown) {
        // Collection might not exist yet - ignore and return empty summary
        logger.warn('[CVision Requisition GET] Could not load slots:', slotError instanceof Error ? slotError.message : String(slotError));
      }

      // PR-B: Ensure backward compatibility
      const headcountRequested = requisition.headcountRequested || requisition.headcount || 1;
      
      return NextResponse.json({
        success: true,
        requisition: { 
          ...requisition, 
          applicantCount: candidateCount,
          headcountRequested,
          // Ensure all PR-B fields exist (for backward compatibility)
          jobTitleId: requisition.jobTitleId || null,
          positionId: requisition.positionId || null,
        },
        slots: slotSummary,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Requisition GET]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// PUT - Update requisition or change status
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Debug: Log role for troubleshooting
      if (process.env.NODE_ENV === 'development') {
        logger.info('[Requisition PUT] Role check:', {
          role,
          userRole: user?.role,
          userId,
          tenantId,
          CVISION_ROLES_OWNER: CVISION_ROLES.OWNER,
        });
      }
      
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      const now = new Date();

      // Handle action-based status changes
      if (body.action) {
        let updateData: any = {
          updatedAt: now,
          updatedBy: userId,
        };
        let auditAction: string = 'requisition_update';
        let newStatus: RequisitionStatus | null = null;

        // Handle positionId update if provided (before status changes)
        if ((body as Record<string, unknown>).positionId !== undefined) {
          updateData.positionId = (body as Record<string, unknown>).positionId || null;
        }

        switch (body.action) {
          case 'submit':
            // Submit for approval
            if (existing.status !== 'DRAFT' && existing.status !== 'draft') {
              return NextResponse.json(
                { error: 'Can only submit draft requisitions' },
                { status: 400 }
              );
            }
            newStatus = 'PENDING_APPROVAL';
            auditAction = 'requisition_update';
            break;

          case 'approve': {
            // Approve requisition (supports multi-step approval chain)
            if (existing.status !== 'PENDING_APPROVAL' && existing.status !== 'pending_approval') {
              return NextResponse.json(
                { error: 'Can only approve pending requisitions' },
                { status: 400 }
              );
            }

            // Update approval chain - find the first pending step
            const approvalsRaw = Array.isArray(existing.approvals || existing.approvalsJson) ? existing.approvals || existing.approvalsJson : [];
            const approvals = [...approvalsRaw] as RequisitionApproval[];
            // Sort by stepOrder to process in order (fallback to array index)
            approvals.sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));

            const pendingApproval = approvals.find(a => a.status === 'pending');
            if (pendingApproval) {
              // Verify the current user is the assigned approver, or has HR admin/owner override
              const isAssignedApprover = pendingApproval.userId === userId;
              const callerRole = user?.role || role;
              const overrideRoles = [
                CVISION_ROLES.OWNER,
                CVISION_ROLES.THEA_OWNER,
                CVISION_ROLES.CVISION_ADMIN,
                CVISION_ROLES.HR_ADMIN,
              ];
              const hasOverride = overrideRoles.some(
                r => r === callerRole || r === role
              );

              if (!isAssignedApprover && !hasOverride) {
                return NextResponse.json(
                  {
                    error: 'You are not the assigned approver for this step',
                    currentStep: pendingApproval.stepLabel || pendingApproval.role,
                    assignedUserId: pendingApproval.userId,
                  },
                  { status: 403 }
                );
              }

              pendingApproval.userId = userId;
              pendingApproval.approved = true;
              pendingApproval.status = 'approved';
              pendingApproval.comment = body.comment;
              pendingApproval.decidedAt = now;
            }

            // Check if all steps are approved or if more are pending
            const remainingPending = approvals.filter(a => a.status === 'pending');
            if (remainingPending.length === 0) {
              // All steps approved - mark requisition as approved
              newStatus = 'APPROVED';
              updateData.approvedAt = now;
              updateData.approvedBy = userId;
            } else {
              // More steps remain - keep in pending_approval
              newStatus = null; // Don't change requisition status yet
            }

            updateData.approvals = approvals; // PG column is 'approvals', not 'approvalsJson'
            auditAction = 'requisition_approve';
            break;
          }

          case 'reject': {
            // Reject requisition (any step rejection rejects the whole chain)
            if (existing.status !== 'PENDING_APPROVAL' && existing.status !== 'pending_approval') {
              return NextResponse.json(
                { error: 'Can only reject pending requisitions' },
                { status: 400 }
              );
            }
            newStatus = 'REJECTED';
            updateData.statusReason = body.reason || body.comment;

            // Update approval chain
            const rejectApprovalsRaw = Array.isArray(existing.approvals || existing.approvalsJson) ? existing.approvals || existing.approvalsJson : [];
            const rejectApprovals = [...rejectApprovalsRaw] as RequisitionApproval[];
            rejectApprovals.sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));

            const pendingReject = rejectApprovals.find(a => a.status === 'pending');
            if (pendingReject) {
              pendingReject.userId = userId;
              pendingReject.approved = false;
              pendingReject.status = 'rejected';
              pendingReject.comment = body.comment;
              pendingReject.decidedAt = now;
            }

            // Mark all remaining pending steps as skipped (rejection short-circuits the chain)
            for (const step of rejectApprovals) {
              if (step.status === 'pending') {
                step.status = 'skipped';
                step.decidedAt = now;
              }
            }

            updateData.approvals = rejectApprovals; // PG column is 'approvals', not 'approvalsJson'
            auditAction = 'requisition_update';
            break;
          }

          case 'open':
            // Open requisition for candidates (PR-B: Creates PositionSlots)
            // Allow opening from DRAFT or APPROVED status
            if (!['DRAFT', 'APPROVED', 'draft', 'approved'].includes(existing.status)) {
              return NextResponse.json(
                { error: 'Can only open draft or approved requisitions' },
                { status: 400 }
              );
            }
            
            // Enforce RBAC: HR roles + OWNER (OWNER can do everything)
            // Check both the role parameter and user.role (sometimes they differ)
            const userRole = user?.role || role;
            const allowedRoles = [
              CVISION_ROLES.CVISION_ADMIN,
              CVISION_ROLES.HR_ADMIN,
              CVISION_ROLES.HR_MANAGER,
              CVISION_ROLES.OWNER, // 'owner'
              CVISION_ROLES.THEA_OWNER, // 'thea-owner' (platform superuser)
            ];
            
            // Normalize roles for comparison (case-insensitive, hyphen→underscore)
            const normalizedUserRole = userRole?.toLowerCase()?.trim()?.replace(/-/g, '_');
            const normalizedRole = role?.toLowerCase()?.trim()?.replace(/-/g, '_');
            const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase().replace(/-/g, '_'));
            
            const hasPermission = 
              normalizedAllowedRoles.includes(normalizedUserRole) ||
              normalizedAllowedRoles.includes(normalizedRole);
            
            if (!hasPermission) {
              logger.error('[Requisition Open] Permission denied:', {
                role,
                userRole,
                normalizedRole,
                normalizedUserRole,
                allowedRoles,
                userId,
                tenantId,
                actualUserRole: user?.role, // Check user role
              });
              return NextResponse.json(
                { 
                  error: 'Insufficient permissions. HR roles or Owner only.',
                  debug: process.env.NODE_ENV === 'development' ? {
                    receivedRole: role,
                    userRole,
                    normalizedRole,
                    normalizedUserRole,
                    allowedRoles,
                  } : undefined,
                },
                { status: 403 }
              );
            }
            
            // Require positionId (position template/budget)
            // Allow positionId from body if not set in requisition (for backward compatibility)
            const positionId = existing.positionId || (body as Record<string, unknown>).positionId;
            if (!positionId) {
              return NextResponse.json(
                {
                  error: 'Position is required to open a requisition',
                  code: 'POSITION_REQUIRED',
                  message: 'Please select a position before opening this requisition. You can edit the requisition and select a position, or provide positionId in the request body.',
                },
                { status: 400 }
              );
            }
            
            // If positionId was provided in body but not in requisition, update it
            if ((body as Record<string, unknown>).positionId && !existing.positionId) {
              updateData.positionId = (body as Record<string, unknown>).positionId;
            }

            // Require departmentId and jobTitleId (from requisition or position)
            const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
              tenantId,
              'budgetedPositions'
            );
            const positionBudget = await findById(positionCollection, tenantId, positionId);
            if (!positionBudget) {
              return NextResponse.json(
                { error: 'Position not found', code: 'POSITION_NOT_FOUND' },
                { status: 404 }
              );
            }

            const finalDeptId = existing.departmentId || positionBudget.departmentId;
            const finalJobTitleId = existing.jobTitleId || positionBudget.jobTitleId;
            if (!finalDeptId || !finalJobTitleId) {
              return NextResponse.json(
                {
                  error: 'Department and Job Title are required',
                  code: 'MISSING_TEMPLATE_FIELDS',
                },
                { status: 400 }
              );
            }

            // PR-B: Auto-create slots equal to position.budgetedHeadcount (VACANT)
            // Always use position.budgetedHeadcount for slot creation (not headcountRequested)
            const requiredSlots = positionBudget.budgetedHeadcount || 1;
            
            if (requiredSlots < 1) {
              return NextResponse.json(
                { error: 'Position budgetedHeadcount must be >= 1', code: 'INVALID_HEADCOUNT' },
                { status: 400 }
              );
            }
            
            // Check slot capacity using PositionSlots
            const slotCapacityCheck = await checkSlotCapacity(tenantId, positionId, requiredSlots);
            if (!slotCapacityCheck.allowed) {
              return NextResponse.json(
                {
                  error: 'No available slots for this position',
                  code: 'NO_BUDGET_SLOT',
                  message: slotCapacityCheck.reason,
                  availableSlots: slotCapacityCheck.availableSlots,
                  remaining: slotCapacityCheck.availableSlots,
                },
                { status: 409 }
              );
            }
            
            // Create PositionSlots (PR-B: Slot creation with idempotency guard)
            const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
              tenantId,
              'positionSlots'
            );
            
            // Idempotency: Check existing slots count for this requisition
            const existingSlots = await slotCollection.countDocuments(
              createTenantFilter(tenantId, { requisitionId: id })
            );

            if (existingSlots >= requiredSlots) {
              // Slots already exist and meet requirement - no-op (idempotent)
              logger.info('[Requisition Open] Slots already exist, skipping creation:', {
                requisitionId: id,
                existingSlotsCount: existingSlots,
                requiredSlots,
              });
            } else {
              // Create missing slots (idempotent: only create difference)
              const slotsToCreate = requiredSlots - existingSlots;
              const slots: CVisionPositionSlot[] = [];
              for (let i = 0; i < slotsToCreate; i++) {
                slots.push({
                  id: uuidv4(),
                  tenantId,
                  positionId,
                  requisitionId: id,
                  employeeId: null,
                  status: 'VACANT',
                  filledAt: null,
                  frozenAt: null,
                  notes: null,
                  createdAt: now,
                  updatedAt: now,
                  createdBy: userId,
                  updatedBy: userId,
                });
              }
              
              if (slots.length > 0) {
                await slotCollection.insertMany(slots);
                logger.info('[Requisition Open] Created slots:', {
                  requisitionId: id,
                  slotsCreated: slots.length,
                  existingSlots,
                  requiredSlots,
                  positionBudgetedHeadcount: positionBudget.budgetedHeadcount,
                });
                
                // Audit: CVISION_SLOTS_CREATED
                await logCVisionAudit(
                  createCVisionAuditContext({ userId, role, tenantId, user }, request),
                  'CVISION_SLOTS_CREATED',
                  'requisition',
                  {
                    resourceId: id,
                    metadata: {
                      requisitionId: id,
                      positionId,
                      slotsCreated: slots.length,
                      existingSlots,
                      totalSlots: requiredSlots,
                      positionBudgetedHeadcount: positionBudget.budgetedHeadcount,
                    },
                  }
                );
              }
            }
            
            // Update positionId if provided in body
            if ((body as Record<string, unknown>).positionId && (body as Record<string, unknown>).positionId !== existing.positionId) {
              updateData.positionId = (body as Record<string, unknown>).positionId;
            }
            
            // Update headcountRequested to match position.budgetedHeadcount for consistency
            updateData.headcountRequested = requiredSlots;
            
            newStatus = 'OPEN';
            updateData.openedAt = now;
            auditAction = 'CVISION_REQUISITION_OPENED';
            break;

          case 'close':
            // Close requisition (PR-B: Must have 0 VACANT slots)
            if (existing.status !== 'OPEN' && existing.status !== 'open') {
              return NextResponse.json(
                { error: 'Can only close open requisitions' },
                { status: 400 }
              );
            }

            // Check for VACANT slots
            const slotCollectionForClose = await getCVisionCollection<CVisionPositionSlot>(
              tenantId,
              'positionSlots'
            );
            const vacantSlotsCount = await slotCollectionForClose.countDocuments(
              createTenantFilter(tenantId, {
                requisitionId: id,
                status: 'VACANT',
              })
            );

            if (vacantSlotsCount > 0) {
              return NextResponse.json(
                {
                  error: 'Cannot close requisition with vacant slots',
                  code: 'HAS_VACANT_SLOTS',
                  vacantSlots: vacantSlotsCount,
                  message: `This requisition has ${vacantSlotsCount} vacant slot(s). All slots must be filled or cancelled before closing.`,
                },
                { status: 400 }
              );
            }

            newStatus = 'CLOSED';
            updateData.closingDate = now;
            updateData.statusReason = body.reason;
            auditAction = 'requisition_close';
            break;

          case 'cancel':
            // Cancel requisition (PR-B: Mark VACANT slots as FROZEN)
            if (existing.status === 'CLOSED' || existing.status === 'closed') {
              return NextResponse.json(
                { error: 'Cannot cancel a closed requisition' },
                { status: 400 }
              );
            }

            // Check for FILLED slots
            const slotCollectionForCancel = await getCVisionCollection<CVisionPositionSlot>(
              tenantId,
              'positionSlots'
            );
            const filledSlotsCount = await slotCollectionForCancel.countDocuments(
              createTenantFilter(tenantId, {
                requisitionId: id,
                status: 'FILLED',
              })
            );

            if (filledSlotsCount > 0) {
              return NextResponse.json(
                {
                  error: 'Cannot cancel requisition with filled slots',
                  code: 'HAS_FILLED_SLOTS',
                  filledSlots: filledSlotsCount,
                  message: `This requisition has ${filledSlotsCount} filled slot(s). Cannot cancel.`,
                },
                { status: 400 }
              );
            }

            // Mark VACANT slots as FROZEN and detach requisitionId
            await slotCollectionForCancel.updateMany(
              createTenantFilter(tenantId, {
                requisitionId: id,
                status: 'VACANT',
              }),
              {
                $set: {
                  status: 'FROZEN',
                  frozenAt: now,
                  requisitionId: null,
                  updatedAt: now,
                  updatedBy: userId,
                },
              }
            );

            newStatus = 'CANCELLED';
            updateData.statusReason = body.reason;
            auditAction = 'requisition_cancel';
            break;

          default:
            return NextResponse.json(
              { error: 'Invalid action' },
              { status: 400 }
            );
        }

        if (newStatus) {
          updateData.status = newStatus;
          updateData.statusChangedAt = now;
        }

        await collection.updateOne(
          createTenantFilter(tenantId, { id }),
          { $set: updateData }
        );

        await logCVisionAudit(
          createCVisionAuditContext({ userId, role, tenantId, user }, request),
          auditAction as any,
          'requisition',
          {
            resourceId: id,
            changes: {
              before: { status: existing.status },
              after: { status: newStatus },
            },
            metadata: { action: body.action, comment: body.comment },
          }
        );

        const updated = await findById(collection, tenantId, id);
        return NextResponse.json({ success: true, requisition: updated });
      }

      // Regular update
      const data = updateJobRequisitionSchema.parse(body);

      // Can only update draft requisitions
      if (existing.status !== 'DRAFT' && existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Can only update draft requisitions' },
          { status: 400 }
        );
      }

      // PR-B: Validate Draft requisition requirements
      // After update, Draft requisition must have departmentId + jobTitleId + positionId
      const finalDeptId = data.departmentId !== undefined ? data.departmentId : existing.departmentId;
      const finalJobTitleId = data.jobTitleId !== undefined ? data.jobTitleId : existing.jobTitleId;
      const finalPositionId = data.positionId !== undefined ? data.positionId : existing.positionId;

      if (!finalDeptId || !finalJobTitleId || !finalPositionId) {
        return NextResponse.json(
          {
            error: 'Draft requisitions require departmentId, jobTitleId, and positionId',
            code: 'MISSING_REQUIRED_FIELDS',
            missing: {
              departmentId: !finalDeptId,
              jobTitleId: !finalJobTitleId,
              positionId: !finalPositionId,
            },
          },
          { status: 400 }
        );
      }

      const updateData = {
        ...data,
        updatedAt: now,
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'requisition_update',
        'requisition',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, requisition: updated });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: (error as any).errors },
          { status: 400 }
        );
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Requisition PUT]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);

// DELETE - Archive requisition (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      // Archive instead of hard delete
      const now = new Date();
      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        {
          $set: {
            isArchived: true,
            deletedAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'requisition_update',
        'requisition',
        {
          resourceId: id,
          changes: { before: { isArchived: false }, after: { isArchived: true } },
        }
      );

      return NextResponse.json({ success: true, message: 'Requisition archived' });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Requisition DELETE]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
