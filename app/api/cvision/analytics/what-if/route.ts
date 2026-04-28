import { logger } from '@/lib/monitoring/logger';
/**
 * CVision What-If Simulator API
 * GET  /api/cvision/analytics/what-if  - Current state, saved scenarios, single scenario
 * POST /api/cvision/analytics/what-if  - Simulate salary/headcount/allowance/overtime changes,
 *   custom chained simulations, compare scenarios, generate reports, delete scenarios
 *
 * Fetches live employee data, builds CurrentState via the what-if-simulator,
 * runs requested simulations, and optionally persists scenarios for later comparison.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionEmployee } from '@/lib/cvision/types';
import {
  buildCurrentState,
  simulateSalaryAdjustment,
  simulateHeadcountChange,
  simulateAllowanceChange,
  simulateOvertimeChange,
  compareScenarios,
  generateSimulationReport,
  type ScenarioType,
  type SalaryAdjustmentParams,
  type HeadcountChangeParams,
  type AllowanceChangeParams,
  type OvertimeChangeParams,
  type CurrentState,
  type SimulationResult,
} from '@/lib/cvision/analytics/what-if-simulator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Constants ──────────────────────────────────────────────────────────────

const SIMULATIONS_COLLECTION = 'cvision_simulations';

const VALID_SCOPES = ['ALL', 'DEPARTMENT', 'GRADE', 'INDIVIDUAL'];
const VALID_HEADCOUNT_ACTIONS = ['HIRE', 'TERMINATE', 'TRANSFER'];
const VALID_ALLOWANCE_ADJUSTMENT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'SET_VALUE'];
const VALID_OVERTIME_CHANGE_TYPES = ['REDUCE_BY_PERCENTAGE', 'SET_MAX_HOURS', 'ELIMINATE'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates a unique simulation ID.
 */
function generateId(): string {
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds employee name from a raw CVisionEmployee document.
 */
function empName(emp: any): string {
  return (
    emp.fullName ||
    `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
    emp.id
  );
}

/**
 * Fetches active/probation employees and builds the CurrentState from live data.
 * Shared by GET current-state and all POST simulation actions.
 */
async function fetchCurrentState(
  tenantId: string,
  departmentFilter?: string,
): Promise<CurrentState> {
  const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
  const empFilter: any = {
    status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
  };
  if (departmentFilter) empFilter.departmentId = departmentFilter;

  const employees = await empCol
    .find(createTenantFilter(tenantId, empFilter))
    .toArray();

  return buildCurrentState(
    employees.map(emp => ({
      id: emp.id,
      name: empName(emp),
      department: emp.departmentId || 'UNASSIGNED',
      grade: (emp as any).grade || (emp as any).jobLevel || 'UNGRADED',
      basicSalary: (emp as any).basicSalary || (emp as any).salary || 0,
      allowances: buildAllowances(emp),
      nationality: emp.nationality,
    })),
  );
}

/**
 * Extracts allowances from a CVisionEmployee document into the
 * { type, amount } array the simulator expects.
 */
function buildAllowances(emp: any): { type: string; amount: number }[] {
  const allowances: { type: string; amount: number }[] = [];

  if (emp.housingAllowance && emp.housingAllowance > 0) {
    allowances.push({ type: 'HOUSING', amount: emp.housingAllowance });
  }
  if (emp.transportAllowance && emp.transportAllowance > 0) {
    allowances.push({ type: 'TRANSPORT', amount: emp.transportAllowance });
  }
  if (emp.foodAllowance && emp.foodAllowance > 0) {
    allowances.push({ type: 'FOOD', amount: emp.foodAllowance });
  }

  // Check for an allowances map/array in metadata or top-level
  if (Array.isArray(emp.allowances)) {
    for (const a of emp.allowances) {
      if (a.type && typeof a.amount === 'number' && a.amount > 0) {
        // Avoid duplicating the known types above
        const exists = allowances.some(
          existing => existing.type.toUpperCase() === a.type.toUpperCase(),
        );
        if (!exists) allowances.push({ type: a.type, amount: a.amount });
      }
    }
  }

  return allowances;
}

/**
 * Returns a 400 response for missing required fields (bilingual).
 */
function missingFieldResponse(field: string) {
  return NextResponse.json(
    {
      success: false,
      error: `Missing required field: ${field}`,
    },
    { status: 400 },
  );
}

/**
 * Returns a 400 response for invalid field values (bilingual).
 */
function invalidValueResponse(field: string, allowed: string[]) {
  return NextResponse.json(
    {
      success: false,
      error: `Invalid value for ${field}. Allowed: ${allowed.join(', ')}`,
    },
    { status: 400 },
  );
}

/**
 * Optionally saves a simulation result to the cvision_simulations collection.
 * Only persists when a `scenarioName` is provided.
 */
async function maybeSaveScenario(
  db: any,
  tenantId: string,
  userId: string,
  scenarioName: string | undefined,
  scenarioType: ScenarioType,
  params: any,
  result: SimulationResult,
): Promise<string | null> {
  if (!scenarioName) return null;

  const doc = {
    id: generateId(),
    tenantId,
    name: scenarioName,
    type: scenarioType,
    params,
    result,
    createdAt: new Date(),
    createdBy: userId,
    updatedAt: new Date(),
  };

  await db.collection(SIMULATIONS_COLLECTION).insertOne(doc);
  return doc.id;
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);

      // ── action=current-state ─────────────────────────────────────────
      if (action === 'current-state') {
        const department = searchParams.get('department') || undefined;
        const currentState = await fetchCurrentState(tenantId, department);

        return NextResponse.json({
          success: true,
          data: {
            currentState,
            meta: {
              generatedAt: new Date().toISOString(),
              department: department || 'ALL',
              employeeCount: currentState.employees.length,
            },
          },
        });
      }

      // ── action=saved-scenarios ───────────────────────────────────────
      if (action === 'saved-scenarios') {
        const type = searchParams.get('type') as ScenarioType | null;
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
        const skip = parseInt(searchParams.get('skip') || '0', 10);

        const filter: any = { tenantId };
        if (type) filter.type = type;

        const col = db.collection(SIMULATIONS_COLLECTION);
        const [scenarios, total] = await Promise.all([
          col
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(Math.max(0, skip))
            .limit(limit)
            .project({
              _id: 0,
              id: 1,
              name: 1,
              type: 1,
              createdAt: 1,
              createdBy: 1,
              'result.impact': 1,
              'result.affectedEmployees': 1,
              'result.totalEmployees': 1,
              'result.summary': 1,
            })
            .toArray(),
          col.countDocuments(filter),
        ]);

        return NextResponse.json({
          success: true,
          data: { scenarios, total, limit, skip },
        });
      }

      // ── action=scenario (single by ID) ───────────────────────────────
      if (action === 'scenario') {
        const scenarioId = searchParams.get('id');
        if (!scenarioId) return missingFieldResponse('id');

        const doc = await db
          .collection(SIMULATIONS_COLLECTION)
          .findOne({ tenantId, id: scenarioId });

        if (!doc) {
          return NextResponse.json(
            {
              success: false,
              error: 'Scenario not found',
            },
            { status: 404 },
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            params: doc.params,
            result: doc.result,
            createdAt: doc.createdAt,
            createdBy: doc.createdBy,
          },
        });
      }

      // ── Default: API docs ────────────────────────────────────────────
      return NextResponse.json({
        success: true,
        api: 'CVision What-If Simulator API',
        version: '1.0',
        endpoints: {
          GET: {
            'current-state':
              'GET ?action=current-state&department=<optional> — live employee payroll snapshot',
            'saved-scenarios':
              'GET ?action=saved-scenarios&type=<optional>&limit=50&skip=0 — list saved simulations',
            scenario:
              'GET ?action=scenario&id=<scenarioId> — single saved scenario with full result',
          },
          POST: {
            'simulate-salary':
              'Simulate salary adjustments (percentage or fixed) for scoped employees',
            'simulate-headcount':
              'Simulate headcount changes (hire, terminate, transfer)',
            'simulate-allowance':
              'Simulate allowance changes (housing, transport, food, or all)',
            'simulate-overtime':
              'Simulate overtime cost changes (reduce, cap, or eliminate)',
            'simulate-custom':
              'Run chained simulations sequentially (result of one feeds into next)',
            compare:
              'Compare multiple scenarios by scenarioIds or inline results',
            'generate-report':
              'Generate structured bilingual report for a scenario',
            'delete-scenario':
              'Delete a saved scenario by ID',
          },
        },
      });
    } catch (err) {
      logger.error('[CVision What-If GET]', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ },
);

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);

      // ── action=simulate-salary ─────────────────────────────────────
      if (action === 'simulate-salary') {
        const {
          scope,
          department,
          grade,
          employeeIds,
          adjustmentType,
          adjustmentValue,
          effectiveDate,
          includeAllowances,
          scenarioName,
        } = body;

        // Validation
        if (!scope) return missingFieldResponse('scope');
        if (!VALID_SCOPES.includes(scope)) return invalidValueResponse('scope', VALID_SCOPES);
        if (scope === 'DEPARTMENT' && !department) return missingFieldResponse('department (required for DEPARTMENT scope)');
        if (scope === 'GRADE' && !grade) return missingFieldResponse('grade (required for GRADE scope)');
        if (scope === 'INDIVIDUAL' && (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0)) {
          return missingFieldResponse('employeeIds (required for INDIVIDUAL scope)');
        }
        if (!adjustmentType || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(adjustmentType)) {
          return invalidValueResponse('adjustmentType', ['PERCENTAGE', 'FIXED_AMOUNT']);
        }
        if (adjustmentValue === undefined || adjustmentValue === null || typeof adjustmentValue !== 'number') {
          return missingFieldResponse('adjustmentValue (number)');
        }

        const currentState = await fetchCurrentState(tenantId);

        const params: SalaryAdjustmentParams = {
          scope,
          department,
          grade,
          employeeIds,
          adjustmentType,
          adjustmentValue,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
          includeAllowances: includeAllowances ?? false,
        };

        const result = simulateSalaryAdjustment(currentState, params);

        const savedId = await maybeSaveScenario(
          db, tenantId, userId, scenarioName,
          'SALARY_ADJUSTMENT', params, result,
        );

        return NextResponse.json({
          success: true,
          data: {
            result,
            savedScenarioId: savedId,
          },
        });
      }

      // ── action=simulate-headcount ──────────────────────────────────
      if (action === 'simulate-headcount') {
        const {
          department,
          headcountAction,
          count,
          averageSalary,
          averageAllowances,
          transferToDepartment,
          effectiveDate,
          scenarioName,
        } = body;

        // Validation
        if (!department) return missingFieldResponse('department');
        if (!headcountAction) return missingFieldResponse('headcountAction');
        if (!VALID_HEADCOUNT_ACTIONS.includes(headcountAction)) {
          return invalidValueResponse('headcountAction', VALID_HEADCOUNT_ACTIONS);
        }
        if (!count || typeof count !== 'number' || count <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'count must be a positive number',
            },
            { status: 400 },
          );
        }
        if (headcountAction === 'TRANSFER' && !transferToDepartment) {
          return missingFieldResponse('transferToDepartment (required for TRANSFER action)');
        }

        const currentState = await fetchCurrentState(tenantId);

        const params: HeadcountChangeParams = {
          department,
          action: headcountAction,
          count,
          averageSalary,
          averageAllowances,
          transferToDepartment,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        };

        const result = simulateHeadcountChange(currentState, params);

        const savedId = await maybeSaveScenario(
          db, tenantId, userId, scenarioName,
          'HEADCOUNT_CHANGE', params, result,
        );

        return NextResponse.json({
          success: true,
          data: {
            result,
            savedScenarioId: savedId,
          },
        });
      }

      // ── action=simulate-allowance ──────────────────────────────────
      if (action === 'simulate-allowance') {
        const {
          allowanceType,
          scope,
          department,
          grade,
          adjustmentType,
          adjustmentValue,
          effectiveDate,
          scenarioName,
        } = body;

        // Validation
        if (!allowanceType) return missingFieldResponse('allowanceType');
        if (!scope) return missingFieldResponse('scope');
        if (!['ALL', 'DEPARTMENT', 'GRADE'].includes(scope)) {
          return invalidValueResponse('scope', ['ALL', 'DEPARTMENT', 'GRADE']);
        }
        if (scope === 'DEPARTMENT' && !department) return missingFieldResponse('department (required for DEPARTMENT scope)');
        if (scope === 'GRADE' && !grade) return missingFieldResponse('grade (required for GRADE scope)');
        if (!adjustmentType || !VALID_ALLOWANCE_ADJUSTMENT_TYPES.includes(adjustmentType)) {
          return invalidValueResponse('adjustmentType', VALID_ALLOWANCE_ADJUSTMENT_TYPES);
        }
        if (adjustmentValue === undefined || adjustmentValue === null || typeof adjustmentValue !== 'number') {
          return missingFieldResponse('adjustmentValue (number)');
        }

        const currentState = await fetchCurrentState(tenantId);

        const params: AllowanceChangeParams = {
          allowanceType,
          scope,
          department,
          grade,
          adjustmentType,
          adjustmentValue,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        };

        const result = simulateAllowanceChange(currentState, params);

        const savedId = await maybeSaveScenario(
          db, tenantId, userId, scenarioName,
          'ALLOWANCE_CHANGE', params, result,
        );

        return NextResponse.json({
          success: true,
          data: {
            result,
            savedScenarioId: savedId,
          },
        });
      }

      // ── action=simulate-overtime ───────────────────────────────────
      if (action === 'simulate-overtime') {
        const {
          scope,
          department,
          changeType,
          value,
          currentOvertimeCosts,
          effectiveDate,
          scenarioName,
        } = body;

        // Validation
        if (!scope) return missingFieldResponse('scope');
        if (!['ALL', 'DEPARTMENT'].includes(scope)) {
          return invalidValueResponse('scope', ['ALL', 'DEPARTMENT']);
        }
        if (scope === 'DEPARTMENT' && !department) return missingFieldResponse('department (required for DEPARTMENT scope)');
        if (!changeType) return missingFieldResponse('changeType');
        if (!VALID_OVERTIME_CHANGE_TYPES.includes(changeType)) {
          return invalidValueResponse('changeType', VALID_OVERTIME_CHANGE_TYPES);
        }
        if (changeType !== 'ELIMINATE' && (value === undefined || value === null)) {
          return missingFieldResponse('value (required for REDUCE_BY_PERCENTAGE and SET_MAX_HOURS)');
        }
        if (!currentOvertimeCosts || !Array.isArray(currentOvertimeCosts)) {
          return missingFieldResponse('currentOvertimeCosts (array of { department, monthlyCost })');
        }

        const currentState = await fetchCurrentState(tenantId);

        const params: OvertimeChangeParams = {
          scope,
          department,
          changeType,
          value,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        };

        const result = simulateOvertimeChange(
          currentState,
          params,
          currentOvertimeCosts,
        );

        const savedId = await maybeSaveScenario(
          db, tenantId, userId, scenarioName,
          'OVERTIME_CHANGE', params, result,
        );

        return NextResponse.json({
          success: true,
          data: {
            result,
            savedScenarioId: savedId,
          },
        });
      }

      // ── action=simulate-custom (chained) ───────────────────────────
      if (action === 'simulate-custom') {
        const { steps, scenarioName } = body;

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'steps must be a non-empty array of simulation steps',
            },
            { status: 400 },
          );
        }

        if (steps.length > 10) {
          return NextResponse.json(
            {
              success: false,
              error: 'Maximum 10 chained steps allowed',
            },
            { status: 400 },
          );
        }

        // Start with live employee data
        let currentState = await fetchCurrentState(tenantId);
        const chainResults: { step: number; type: string; result: SimulationResult }[] = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepType = step.type as string;
          let result: SimulationResult;

          try {
            switch (stepType) {
              case 'SALARY_ADJUSTMENT': {
                const params: SalaryAdjustmentParams = {
                  scope: step.scope || 'ALL',
                  department: step.department,
                  grade: step.grade,
                  employeeIds: step.employeeIds,
                  adjustmentType: step.adjustmentType || 'PERCENTAGE',
                  adjustmentValue: step.adjustmentValue || 0,
                  effectiveDate: step.effectiveDate ? new Date(step.effectiveDate) : new Date(),
                  includeAllowances: step.includeAllowances ?? false,
                };
                result = simulateSalaryAdjustment(currentState, params);
                break;
              }

              case 'HEADCOUNT_CHANGE': {
                const params: HeadcountChangeParams = {
                  department: step.department || 'GENERAL',
                  action: step.headcountAction || 'HIRE',
                  count: step.count || 1,
                  averageSalary: step.averageSalary,
                  averageAllowances: step.averageAllowances,
                  transferToDepartment: step.transferToDepartment,
                  effectiveDate: step.effectiveDate ? new Date(step.effectiveDate) : new Date(),
                };
                result = simulateHeadcountChange(currentState, params);
                break;
              }

              case 'ALLOWANCE_CHANGE': {
                const params: AllowanceChangeParams = {
                  allowanceType: step.allowanceType || 'ALL',
                  scope: step.scope || 'ALL',
                  department: step.department,
                  grade: step.grade,
                  adjustmentType: step.adjustmentType || 'PERCENTAGE',
                  adjustmentValue: step.adjustmentValue || 0,
                  effectiveDate: step.effectiveDate ? new Date(step.effectiveDate) : new Date(),
                };
                result = simulateAllowanceChange(currentState, params);
                break;
              }

              case 'OVERTIME_CHANGE': {
                const params: OvertimeChangeParams = {
                  scope: step.scope || 'ALL',
                  department: step.department,
                  changeType: step.changeType || 'REDUCE_BY_PERCENTAGE',
                  value: step.value,
                  effectiveDate: step.effectiveDate ? new Date(step.effectiveDate) : new Date(),
                };
                const overtimeCosts = step.currentOvertimeCosts || [];
                result = simulateOvertimeChange(currentState, params, overtimeCosts);
                break;
              }

              default:
                return NextResponse.json(
                  {
                    success: false,
                    error: `Unknown step type at index ${i}: ${stepType}. Allowed: SALARY_ADJUSTMENT, HEADCOUNT_CHANGE, ALLOWANCE_CHANGE, OVERTIME_CHANGE`,
                  },
                  { status: 400 },
                );
            }
          } catch (stepErr: any) {
            return NextResponse.json(
              {
                success: false,
                error: `Error in step ${i + 1} (${stepType}): ${stepErr.message || 'Unknown error'}`,
                completedSteps: chainResults,
              },
              { status: 400 },
            );
          }

          chainResults.push({ step: i + 1, type: stepType, result });

          // Rebuild CurrentState from projected state for the next step.
          // Use the projected snapshot to build a synthetic state for chaining.
          currentState = rebuildStateFromResult(currentState, result);
        }

        // The final result is the last step
        const finalResult = chainResults[chainResults.length - 1].result;

        const savedId = await maybeSaveScenario(
          db, tenantId, userId, scenarioName,
          'CUSTOM', { steps }, finalResult,
        );

        return NextResponse.json({
          success: true,
          data: {
            chainResults,
            finalResult,
            totalSteps: chainResults.length,
            savedScenarioId: savedId,
          },
        });
      }

      // ── action=compare ─────────────────────────────────────────────
      if (action === 'compare') {
        const { scenarioIds, inlineResults } = body;

        const results: SimulationResult[] = [];

        // Fetch saved scenarios by ID
        if (scenarioIds && Array.isArray(scenarioIds) && scenarioIds.length > 0) {
          const col = db.collection(SIMULATIONS_COLLECTION);
          const docs = await col
            .find({ tenantId, id: { $in: scenarioIds } })
            .toArray();

          for (const doc of docs) {
            if (doc.result) results.push(doc.result);
          }

          // Warn about missing scenarios
          const foundIds = docs.map((d: any) => d.id);
          const missingIds = scenarioIds.filter((id: string) => !foundIds.includes(id));
          if (missingIds.length > 0) {
            // Still proceed with the ones we found, but include a warning
            const comparison = compareScenarios(results);
            return NextResponse.json({
              success: true,
              data: {
                comparison,
                warnings: [`Scenarios not found: ${missingIds.join(', ')}`],
              },
            });
          }
        }

        // Accept inline results
        if (inlineResults && Array.isArray(inlineResults)) {
          results.push(...inlineResults);
        }

        if (results.length < 2) {
          return NextResponse.json(
            {
              success: false,
              error: 'At least 2 scenarios required for comparison. Provide scenarioIds and/or inlineResults.',
            },
            { status: 400 },
          );
        }

        const comparison = compareScenarios(results);

        return NextResponse.json({
          success: true,
          data: { comparison },
        });
      }

      // ── action=generate-report ─────────────────────────────────────
      if (action === 'generate-report') {
        const { scenarioId, inlineResult } = body;
        let result: SimulationResult | null = null;

        if (scenarioId) {
          const doc = await db
            .collection(SIMULATIONS_COLLECTION)
            .findOne({ tenantId, id: scenarioId });

          if (!doc) {
            return NextResponse.json(
              {
                success: false,
                error: 'Scenario not found',
              },
              { status: 404 },
            );
          }
          result = doc.result;
        } else if (inlineResult) {
          result = inlineResult;
        }

        if (!result) {
          return NextResponse.json(
            {
              success: false,
              error: 'Provide scenarioId or inlineResult',
            },
            { status: 400 },
          );
        }

        const report = generateSimulationReport(result);

        return NextResponse.json({
          success: true,
          data: { report },
        });
      }

      // ── action=delete-scenario ─────────────────────────────────────
      if (action === 'delete-scenario') {
        const { scenarioId } = body;

        if (!scenarioId) return missingFieldResponse('scenarioId');

        const col = db.collection(SIMULATIONS_COLLECTION);
        const existing = await col.findOne({ tenantId, id: scenarioId });

        if (!existing) {
          return NextResponse.json(
            {
              success: false,
              error: 'Scenario not found',
            },
            { status: 404 },
          );
        }

        await col.deleteOne({ tenantId, id: scenarioId });

        return NextResponse.json({
          success: true,
          data: {
            deleted: true,
            scenarioId,
            message: `Scenario "${existing.name}" deleted successfully`,
          },
        });
      }

      // ── Unknown action ─────────────────────────────────────────────
      return NextResponse.json(
        {
          success: false,
          error: `Unknown action: ${action}. Use simulate-salary, simulate-headcount, simulate-allowance, simulate-overtime, simulate-custom, compare, generate-report, or delete-scenario`,
        },
        { status: 400 },
      );
    } catch (err) {
      logger.error('[CVision What-If POST]', err);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 },
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE },
);

// ─── Internal: Rebuild State for Chaining ───────────────────────────────────

/**
 * After a simulation step, rebuild a CurrentState from the projected numbers.
 * This allows the next simulation in a chain to start from the projected outcome
 * of the previous step.
 *
 * For salary/allowance simulations, we scale each employee proportionally.
 * For headcount changes, we adjust the employee list.
 */
function rebuildStateFromResult(
  previousState: CurrentState,
  result: SimulationResult,
): CurrentState {
  // Simple approach: scale each employee's package proportionally to match
  // the projected total. This preserves relative salary distribution.
  const currentTotal = result.currentState.monthlyTotal;
  const projectedTotal = result.projectedState.monthlyTotal;
  const projectedHeadcount = result.projectedState.headcount;

  // If headcount changed, we need to handle employee list differently
  if (projectedHeadcount !== previousState.employees.length) {
    // Headcount decreased: remove employees with the lowest total package
    if (projectedHeadcount < previousState.employees.length) {
      const sorted = [...previousState.employees].sort(
        (a, b) => a.totalPackage - b.totalPackage,
      );
      const retained = sorted.slice(
        previousState.employees.length - projectedHeadcount,
      );

      // Scale remaining to match projected total
      const retainedTotal = retained.reduce((s, e) => s + e.totalPackage, 0);
      const scaleFactor = retainedTotal > 0 ? projectedTotal / retainedTotal : 1;

      return buildCurrentState(
        retained.map(e => ({
          id: e.id,
          name: e.name,
          department: e.department,
          grade: e.grade,
          basicSalary: Math.round(e.basicSalary * scaleFactor * 100) / 100,
          allowances: e.allowances.map(a => ({
            type: a.type,
            amount: Math.round(a.amount * scaleFactor * 100) / 100,
          })),
        })),
      );
    }

    // Headcount increased: duplicate the average employee for new slots
    const avgSalary = result.projectedState.averageSalary;
    const newCount = projectedHeadcount - previousState.employees.length;
    const existingMapped = previousState.employees.map(e => ({
      id: e.id,
      name: e.name,
      department: e.department,
      grade: e.grade,
      basicSalary: e.basicSalary,
      allowances: e.allowances,
    }));

    // Add synthetic employees for the new headcount
    for (let i = 0; i < newCount; i++) {
      existingMapped.push({
        id: `new_${i + 1}`,
        name: `New Employee ${i + 1}`,
        department: result.departmentImpact.find(d => d.headcountChange > 0)?.department || 'GENERAL',
        grade: 'UNGRADED',
        basicSalary: Math.round(avgSalary * 0.6 * 100) / 100, // Rough: 60% base, 40% allowances
        allowances: [
          { type: 'HOUSING', amount: Math.round(avgSalary * 0.25 * 100) / 100 },
          { type: 'TRANSPORT', amount: Math.round(avgSalary * 0.1 * 100) / 100 },
        ],
      });
    }

    return buildCurrentState(existingMapped);
  }

  // Same headcount: scale proportionally
  if (currentTotal === 0 || currentTotal === projectedTotal) {
    return previousState;
  }

  const scaleFactor = projectedTotal / currentTotal;

  return buildCurrentState(
    previousState.employees.map(e => ({
      id: e.id,
      name: e.name,
      department: e.department,
      grade: e.grade,
      basicSalary: Math.round(e.basicSalary * scaleFactor * 100) / 100,
      allowances: e.allowances.map(a => ({
        type: a.type,
        amount: Math.round(a.amount * scaleFactor * 100) / 100,
      })),
    })),
  );
}
