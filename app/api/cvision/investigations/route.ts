import { logger } from '@/lib/monitoring/logger';
/**
 * Investigation Workflow & Salary Deduction API
 *
 * GET actions:
 *   list             — List investigations (filters: status, employeeId, department, type)
 *   detail           — Full investigation by investigationId
 *   stats            — Investigation statistics
 *   deductions       — Salary deductions (filters: status, employeeId, effectiveMonth)
 *   employee-history — All investigations for a given employee
 *   timeline         — Investigation timeline entries
 *
 * POST actions:
 *   create           — Create new investigation
 *   update-status    — Transition investigation status
 *   add-evidence     — Add evidence to investigation
 *   add-witness      — Add witness statement
 *   schedule-hearing — Schedule a hearing
 *   record-hearing   — Record hearing outcome
 *   make-decision    — Make decision with side effects (deduction, warning, etc.)
 *   file-appeal      — File an appeal
 *   close            — Close investigation
 *   apply-deduction  — Apply a pending salary deduction
 *   cancel-deduction — Cancel a pending salary deduction
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  createInvestigation,
  getInvestigation,
  listInvestigations,
  updateInvestigationStatus,
  addEvidence,
  addWitnessStatement,
  scheduleHearing,
  recordHearing,
  makeDecision,
  fileAppeal,
  listDeductions,
  applyDeduction,
  cancelDeduction,
  getInvestigationStats,
  calculateDeduction,
  checkMonthlyDeductionLimit,
  SAUDI_PENALTY_SCHEDULE,
  INCIDENT_TYPES,
} from '@/lib/cvision/disciplinary/investigation-engine';

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }: { tenantId: string }) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'list';

      switch (action) {
        case 'list': {
          const status = url.searchParams.get('status') || undefined;
          const employeeId = url.searchParams.get('employeeId') || undefined;
          const department = url.searchParams.get('department') || undefined;
          const type = url.searchParams.get('type') || undefined;
          const investigations = await listInvestigations(tenantId, { status, employeeId, department, type });
          return NextResponse.json({ investigations, total: investigations.length });
        }

        case 'detail': {
          const id = url.searchParams.get('id');
          if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
          const inv = await getInvestigation(tenantId, id);
          if (!inv) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
          return NextResponse.json({ investigation: inv });
        }

        case 'stats': {
          const stats = await getInvestigationStats(tenantId);
          return NextResponse.json({ stats });
        }

        case 'deductions': {
          const status = url.searchParams.get('status') || undefined;
          const employeeId = url.searchParams.get('employeeId') || undefined;
          const effectiveMonth = url.searchParams.get('effectiveMonth') || undefined;
          const deductions = await listDeductions(tenantId, { status, employeeId, effectiveMonth });
          return NextResponse.json({ deductions, total: deductions.length });
        }

        case 'employee-history': {
          const empId = url.searchParams.get('employeeId');
          if (!empId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });
          const investigations = await listInvestigations(tenantId, { employeeId: empId });
          return NextResponse.json({ investigations, total: investigations.length });
        }

        case 'timeline': {
          const id = url.searchParams.get('id');
          if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
          const inv = await getInvestigation(tenantId, id);
          if (!inv) return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
          return NextResponse.json({ timeline: inv.timeline, investigationId: inv.investigationId });
        }

        case 'penalty-schedule': {
          return NextResponse.json({
            penalties: SAUDI_PENALTY_SCHEDULE.penalties,
            terminationGrounds: SAUDI_PENALTY_SCHEDULE.terminationGrounds,
            maxDeductionDays: SAUDI_PENALTY_SCHEDULE.maxDeductionDaysPerIncident,
            maxMonthlyDeduction: `${SAUDI_PENALTY_SCHEDULE.maxMonthlyDeductionPct * 100}%`,
            incidentTypes: INCIDENT_TYPES,
          });
        }

        case 'calculate-deduction': {
          const basicSalary = parseFloat(url.searchParams.get('basicSalary') || '0');
          const housingAllowance = parseFloat(url.searchParams.get('housingAllowance') || '0');
          const type = (url.searchParams.get('type') || 'DAYS') as 'FIXED_AMOUNT' | 'PERCENTAGE' | 'DAYS';
          const amount = parseFloat(url.searchParams.get('amount') || '0');
          const days = parseInt(url.searchParams.get('days') || '0', 10);

          const calc = calculateDeduction({ basicSalary, housingAllowance, type, amount, days });
          return NextResponse.json({ calculation: calc });
        }

        case 'check-limit': {
          const empId = url.searchParams.get('employeeId');
          const month = url.searchParams.get('effectiveMonth');
          const addlAmount = parseFloat(url.searchParams.get('amount') || '0');
          if (!empId || !month) return NextResponse.json({ error: 'employeeId and effectiveMonth required' }, { status: 400 });
          const limit = await checkMonthlyDeductionLimit(tenantId, empId, month, addlAmount);
          return NextResponse.json({ limit });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[investigations GET]', err);
      return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.disciplinary.read' }
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const body = await request.json();
      const action = body.action;

      switch (action) {
        case 'create': {
          const inv = await createInvestigation(tenantId, body, userId);
          return NextResponse.json({ success: true, investigation: inv, message: `Investigation ${inv.investigationId} created.` });
        }

        case 'update-status': {
          if (!body.investigationId || !body.status) {
            return NextResponse.json({ error: 'investigationId and status required' }, { status: 400 });
          }
          const inv = await updateInvestigationStatus(tenantId, body.investigationId, body.status, userId, body.details);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'add-evidence': {
          if (!body.investigationId) return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
          const inv = await addEvidence(tenantId, body.investigationId, {
            type: body.evidenceType || 'OTHER',
            description: body.description || '',
            addedBy: userId,
          }, userId);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'add-witness': {
          if (!body.investigationId) return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
          const inv = await addWitnessStatement(tenantId, body.investigationId, {
            name: body.witnessName || '',
            employeeId: body.witnessEmployeeId,
            statement: body.statement || '',
            recordedBy: userId,
          }, userId);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'schedule-hearing': {
          if (!body.investigationId) return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
          const inv = await scheduleHearing(tenantId, body.investigationId, {
            scheduledDate: body.scheduledDate,
            scheduledTime: body.scheduledTime,
            location: body.location || '',
            attendees: body.attendees || [],
          }, userId);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'record-hearing': {
          if (!body.investigationId) return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
          const inv = await recordHearing(tenantId, body.investigationId, {
            employeeAttended: body.employeeAttended ?? false,
            employeeResponse: body.employeeResponse,
            hearingNotes: body.hearingNotes,
          }, userId);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'make-decision': {
          if (!body.investigationId || !body.outcome || !body.reasoning) {
            return NextResponse.json({ error: 'investigationId, outcome, and reasoning required' }, { status: 400 });
          }
          const result = await makeDecision(tenantId, body.investigationId, {
            outcome: body.outcome,
            reasoning: body.reasoning,
            decidedBy: userId,
            decidedByName: body.decidedByName || '',
            deduction: body.deduction,
            suspension: body.suspension,
          });
          return NextResponse.json({ success: true, investigation: result.investigation, sideEffects: result.sideEffects });
        }

        case 'file-appeal': {
          if (!body.investigationId || !body.reason) {
            return NextResponse.json({ error: 'investigationId and reason required' }, { status: 400 });
          }
          const inv = await fileAppeal(tenantId, body.investigationId, body.reason, userId);
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'close': {
          if (!body.investigationId) return NextResponse.json({ error: 'investigationId required' }, { status: 400 });
          const inv = await updateInvestigationStatus(tenantId, body.investigationId, 'CLOSED', userId, body.details || 'Investigation closed.');
          return NextResponse.json({ success: true, investigation: inv });
        }

        case 'apply-deduction': {
          if (!body.deductionId) return NextResponse.json({ error: 'deductionId required' }, { status: 400 });
          const ded = await applyDeduction(tenantId, body.deductionId, userId);
          return NextResponse.json({ success: true, deduction: ded, message: 'Deduction applied.' });
        }

        case 'cancel-deduction': {
          if (!body.deductionId || !body.reason) {
            return NextResponse.json({ error: 'deductionId and reason required' }, { status: 400 });
          }
          const ded = await cancelDeduction(tenantId, body.deductionId, userId, body.reason);
          return NextResponse.json({ success: true, deduction: ded, message: 'Deduction cancelled.' });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[investigations POST]', err);
      return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.disciplinary.write' }
);
