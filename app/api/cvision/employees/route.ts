import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employees API
 * GET /api/cvision/employees - List employees
 * POST /api/cvision/employees - Create employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import type { Filter } from 'mongodb';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  paginatedList,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import {
  createEmployeeSchema,
  paginationSchema,
} from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';
import type { CVisionEmployee, CVisionEmployeeStatusHistory, EmployeeStatus, CVisionBaseRecord, CVisionBudgetedPosition, CVisionJobTitle } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canListEmployees, canWriteEmployee } from '@/lib/cvision/authz/policy';
import { hasTenantWideAccess } from '@/lib/cvision/authz/context';
import { CVISION_ROLES } from '@/lib/cvision/roles';
import { normalizeStatus, assertValidStatus } from '@/lib/cvision/employees/normalizeStatus';
import { onEmployeeCreated } from '@/lib/cvision/lifecycle';
import { SAUDI_CONTRACT_RULES, validateContract } from '@/lib/cvision/contracts';
import { emit } from '@/lib/events';
import { shadowEvaluate } from '@/lib/policy';
import { getEmployeeScopeFilter } from '@/lib/cvision/org/permission-engine';
import { filterEmployeeList } from '@/lib/cvision/auth/field-permissions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs'; // Ensure Node.js runtime (not Edge)

// GET - List employees
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Defensive guard: tenantId must be present
      if (!tenantId) {
        return NextResponse.json(
          { error: 'Tenant ID is required', code: 'MISSING_TENANT' },
          { status: 400 }
        );
      }

      // Build authz context with error handling
      let ctx;
      try {
        const ctxResult = await requireCtx(request);
        if (ctxResult instanceof NextResponse) {
          return ctxResult; // 401 or 403
        }
        ctx = ctxResult;
      } catch (authzError: unknown) {
        const ae = authzError instanceof Error ? authzError : { message: String(authzError), stack: undefined };
        logger.error('[CVision Employees GET] Authz context error', {
          tenantId,
          userId,
          error: ae.message,
          stack: ae.stack,
        });
        return NextResponse.json(
          { 
            error: 'Authorization error',
            message: ae.message || 'Failed to build authorization context',
            code: 'AUTHZ_ERROR'
          },
          { status: 500 }
        );
      }

      // Defensive guard: if role expects employee link but user has none
      // HR_MANAGER needs departmentIds to filter employees
      if (ctx.roles.includes(CVISION_ROLES.HR_MANAGER) && (!ctx.departmentIds || ctx.departmentIds.length === 0)) {
        logger.info('[CVision Employees GET] 403: HR_MANAGER without department scope', {
          tenantId,
          userId,
          roles: ctx.roles,
        });
        return NextResponse.json(
          { error: 'Missing employee link or department scope', code: 'MISSING_EMPLOYEE_LINK' },
          { status: 403 }
        );
      }

      // Enforce list policy
      const listPolicy = canListEmployees(ctx);
      const enforceResult = await enforce(listPolicy, request, ctx);
      if (enforceResult) {
        logger.info('[CVision Employees GET] 403: List policy denied', {
          tenantId,
          userId,
          roles: ctx.roles,
          policyReason: listPolicy.reason,
        });
        return enforceResult; // 403
      }

      void shadowEvaluate({ legacyDecision: 'allow', action: 'View', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id: tenantId, type: 'Thea::CvisionEmployee', attrs: { tenantId, organizationId: '', status: '' } } });

      const { searchParams } = new URL(request.url);

      // ===== Action: fix-missing-data =====
      const action = searchParams.get('action');
      if (action === 'fix-missing-data') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const now = new Date();

        // Find employees with ANY missing or out-of-sync fields
        const broken = await collection.find({
          tenantId,
          isArchived: { $ne: true },
          $or: [
            // employeeNo completely missing
            { employeeNo: { $exists: false } },
            { employeeNo: null },
            { employeeNo: '' },
            // employeeNo exists but employeeNumber alias missing
            { employeeNumber: { $exists: false }, employeeNo: { $exists: true, $ne: null } },
            { employeeNumber: null, employeeNo: { $exists: true, $ne: null } },
            { employeeNumber: '', employeeNo: { $exists: true, $ne: null } },
            // hiredAt completely missing
            { hiredAt: { $exists: false } },
            { hiredAt: null },
            // hiredAt exists but hireDate alias missing
            { hireDate: { $exists: false }, hiredAt: { $exists: true, $ne: null } },
            { hireDate: null, hiredAt: { $exists: true, $ne: null } },
          ],
        }).limit(5000).toArray();

        let fixed = 0;
        const details: any[] = [];

        for (const emp of broken) {
          const updates: any = { updatedAt: now, updatedBy: userId };
          const fixes: string[] = [];
          const empAny = emp as Record<string, unknown>;

          // Case 1: employeeNo completely missing → generate new + set both
          if (!emp.employeeNo) {
            const newNo = await generateSequenceNumber(tenantId, SEQUENCE_PREFIXES.employee);
            updates.employeeNo = newNo;
            updates.employeeNumber = newNo;
            fixes.push(`employeeNo → ${newNo}`);
          }
          // Case 2: employeeNo exists but employeeNumber missing → sync alias
          else if (!empAny.employeeNumber) {
            updates.employeeNumber = emp.employeeNo;
            fixes.push(`employeeNumber → ${emp.employeeNo}`);
          }

          // Case 3: hiredAt completely missing → derive + set both
          if (!emp.hiredAt) {
            const fallbackDate = empAny.hireDate
              ? new Date(empAny.hireDate as string)
              : (emp.createdAt || now);
            const hiredAtDate = new Date(fallbackDate as string | Date);
            updates.hiredAt = hiredAtDate;
            updates.hireDate = hiredAtDate;
            fixes.push(`hiredAt → ${hiredAtDate.toISOString()}`);
          }
          // Case 4: hiredAt exists but hireDate missing → sync alias
          else if (!empAny.hireDate) {
            updates.hireDate = emp.hiredAt;
            fixes.push(`hireDate → ${new Date(emp.hiredAt).toISOString()}`);
          }

          if (fixes.length > 0) {
            await collection.updateOne({ id: emp.id, tenantId }, { $set: updates });
            fixed++;
            details.push({
              id: emp.id,
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
              fixes,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Fixed ${fixed} employee(s)`,
          fixed,
          total: broken.length,
          details,
        });
      }

      // ===== Action: debug-employees =====
      if (action === 'debug-employees') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');

        const allEmps = await collection.find({
          tenantId,
          isArchived: { $ne: true },
        }).limit(5000).toArray();

        const employees = allEmps.map((emp) => ({
          id: emp.id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          employeeNo: emp.employeeNo || 'MISSING',
          employeeNumber: (emp as Record<string, unknown>).employeeNumber || 'MISSING',
          hiredAt: emp.hiredAt || 'MISSING',
          hireDate: (emp as Record<string, unknown>).hireDate || 'MISSING',
          status: emp.status,
          createdAt: emp.createdAt,
        }));

        return NextResponse.json({
          success: true,
          total: employees.length,
          missingEmployeeNo: employees.filter(e => e.employeeNo === 'MISSING').length,
          missingHiredAt: employees.filter(e => e.hiredAt === 'MISSING').length,
          employees,
        });
      }

      // ===== Action: debug-duplicates =====
      if (action === 'debug-duplicates') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');

        const allEmps = await collection.find({
          tenantId,
          isArchived: { $ne: true },
        }).limit(5000).toArray();

        // Helper to map employee for display
        const mapEmp = (emp: CVisionEmployee) => ({
          id: emp.id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeNo: emp.employeeNo || 'MISSING',
          email: emp.email || null,
          phone: emp.phone || null,
          status: emp.status,
          departmentId: emp.departmentId || null,
          unitId: (emp as unknown as Record<string, unknown>).unitId || null,
          createdAt: emp.createdAt,
        });

        // Group by Name (case-insensitive)
        const byName = new Map<string, CVisionEmployee[]>();
        // Group by Email (case-insensitive, skip nulls)
        const byEmail = new Map<string, CVisionEmployee[]>();
        // Group by Phone (skip nulls)
        const byPhone = new Map<string, CVisionEmployee[]>();
        // Group by EmployeeNo
        const byEmpNo = new Map<string, CVisionEmployee[]>();

        for (const emp of allEmps) {
          // Name grouping
          const nameKey = `${(emp.firstName || '').toLowerCase().trim()}|${(emp.lastName || '').toLowerCase().trim()}`;
          if (nameKey !== '|') {
            if (!byName.has(nameKey)) byName.set(nameKey, []);
            byName.get(nameKey)!.push(emp);
          }

          // Email grouping
          if (emp.email) {
            const emailKey = emp.email.toLowerCase().trim();
            if (!byEmail.has(emailKey)) byEmail.set(emailKey, []);
            byEmail.get(emailKey)!.push(emp);
          }

          // Phone grouping
          if (emp.phone) {
            const phoneKey = emp.phone.replace(/\s+/g, '').trim();
            if (phoneKey) {
              if (!byPhone.has(phoneKey)) byPhone.set(phoneKey, []);
              byPhone.get(phoneKey)!.push(emp);
            }
          }

          // EmployeeNo grouping
          if (emp.employeeNo) {
            if (!byEmpNo.has(emp.employeeNo)) byEmpNo.set(emp.employeeNo, []);
            byEmpNo.get(emp.employeeNo)!.push(emp);
          }
        }

        // Filter to duplicates only (2+ entries)
        const buildGroups = (map: Map<string, CVisionEmployee[]>) =>
          Array.from(map.entries())
            .filter(([, emps]) => emps.length > 1)
            .map(([key, emps]) => ({
              key,
              count: emps.length,
              employees: emps.map(mapEmp),
            }));

        const nameDups = buildGroups(byName);
        const emailDups = buildGroups(byEmail);
        const phoneDups = buildGroups(byPhone);
        const empNoDups = buildGroups(byEmpNo);

        return NextResponse.json({
          success: true,
          total: allEmps.length,
          duplicates: {
            byName: { count: nameDups.length, groups: nameDups },
            byEmail: { count: emailDups.length, groups: emailDups },
            byPhone: { count: phoneDups.length, groups: phoneDups },
            byEmployeeNo: { count: empNoDups.length, groups: empNoDups },
          },
        });
      }

      // ===== Action: archive-duplicates =====
      if (action === 'archive-duplicates') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const now = new Date();

        // Find all non-archived employees
        const allEmps = await collection.find({
          tenantId,
          isArchived: { $ne: true },
        }).limit(5000).toArray();

        // Group by name (case-insensitive)
        const byName = new Map<string, CVisionEmployee[]>();
        for (const emp of allEmps) {
          const nameKey = `${(emp.firstName || '').toLowerCase().trim()}|${(emp.lastName || '').toLowerCase().trim()}`;
          if (nameKey !== '|') {
            if (!byName.has(nameKey)) byName.set(nameKey, []);
            byName.get(nameKey)!.push(emp);
          }
        }

        let archived = 0;
        const details: any[] = [];

        for (const [key, emps] of byName.entries()) {
          if (emps.length <= 1) continue;

          // Find the "keeper" — prefer ACTIVE/PROBATION over RESIGNED/TERMINATED
          const statusPriority: Record<string, number> = { ACTIVE: 0, PROBATION: 1, RESIGNED: 2, TERMINATED: 3 };
          const sorted = [...emps].sort((a, b) => {
            const pa = statusPriority[a.status] ?? 99;
            const pb = statusPriority[b.status] ?? 99;
            if (pa !== pb) return pa - pb;
            // If same status, keep the most recent
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          });

          const keeper = sorted[0];
          const toArchive = sorted.slice(1);

          for (const dup of toArchive) {
            await collection.updateOne(
              { id: dup.id, tenantId },
              { $set: { isArchived: true, archivedAt: now, archivedBy: userId, updatedAt: now, updatedBy: userId } },
            );
            archived++;
            details.push({
              archivedId: dup.id,
              archivedName: `${dup.firstName} ${dup.lastName}`,
              archivedNo: dup.employeeNo,
              archivedStatus: dup.status,
              keptId: keeper.id,
              keptNo: keeper.employeeNo,
              keptStatus: keeper.status,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Archived ${archived} duplicate employee(s)`,
          archived,
          details,
        });
      }

      // ===== Action: find-employee =====
      if (action === 'find-employee') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const search = searchParams.get('search') || '';
        const empNo = searchParams.get('empNo') || '';

        const query: any = { tenantId, isArchived: { $ne: true } };
        if (empNo) {
          query.employeeNo = empNo;
        } else if (search) {
          const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'i');
          query.$or = [{ firstName: regex }, { lastName: regex }, { employeeNo: regex }];
        }

        const found = await collection.find(query).limit(20).toArray();
        // Resolve department names
        const deptIds = [...new Set(found.map(e => e.departmentId).filter(Boolean))];
        const deptNameMap: Record<string, string> = {};
        if (deptIds.length > 0) {
          const db = await getCVisionDb(tenantId);
          const depts = await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray();
          for (const d of depts) deptNameMap[d.id] = d.name || d.id;
        }
        return NextResponse.json({
          success: true,
          total: found.length,
          employees: found.map(e => ({
            id: e.id,
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            firstName: e.firstName, lastName: e.lastName,
            employeeNo: e.employeeNo,
            email: e.email,
            status: e.status,
            unitId: (e as Record<string, unknown>).unitId || null,
            departmentId: e.departmentId,
            departmentName: e.departmentId ? (deptNameMap[e.departmentId] || e.departmentId) : '',
            createdAt: e.createdAt,
          })),
        });
      }

      // ===== Action: archive-employee =====
      if (action === 'archive-employee') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) {
          return NextResponse.json({ success: false, error: 'employeeId is required' }, { status: 400 });
        }
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const emp = await collection.findOne({ id: employeeId, tenantId } as Filter<CVisionEmployee>);
        if (!emp) {
          return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
        }
        await collection.updateOne(
          { id: employeeId, tenantId } as Filter<CVisionEmployee>,
          { $set: { isArchived: true, archivedAt: new Date(), archivedBy: userId, updatedAt: new Date(), updatedBy: userId } as Partial<CVisionEmployee> },
        );
        return NextResponse.json({
          success: true,
          message: `Archived employee ${emp.firstName} ${emp.lastName} (${emp.employeeNo})`,
          archived: { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, employeeNo: emp.employeeNo, status: emp.status },
        });
      }

      // ===== Action: sync-employee-units =====
      if (action === 'sync-employee-units') {
        const collection = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const bpCollection = await getCVisionCollection<CVisionBudgetedPosition>(tenantId, 'budgetedPositions');
        const jtCollection = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
        const now = new Date();

        // 1. Fetch active employees without unitId
        const missingUnit = await collection.find({
          tenantId,
          isArchived: { $ne: true },
          status: { $in: ['ACTIVE', 'PROBATION'] },
          $or: [
            { unitId: { $exists: false } },
            { unitId: null },
            { unitId: '' },
          ],
        }).limit(5000).toArray();

        // 2a. Load BudgetedPositions with unitId → Map(jobTitleId|departmentId → unitId)
        const budgetedPositions = await bpCollection.find({
          tenantId,
          isActive: true,
          unitId: { $exists: true, $ne: null },
        }).limit(5000).toArray();

        const bpMap = new Map<string, string>();
        for (const bp of budgetedPositions) {
          if (bp.jobTitleId && bp.unitId && bp.departmentId) {
            const key = `${bp.jobTitleId}|${bp.departmentId}`;
            if (!bpMap.has(key)) {
              bpMap.set(key, bp.unitId);
            }
          }
        }

        // 2b. Load JobTitles with unitId → Map(jobTitleId → unitId)
        const jobTitles = await jtCollection.find({
          tenantId,
          isActive: true,
          unitId: { $exists: true, $ne: null },
        }).limit(5000).toArray();

        const jtMap = new Map<string, string>();
        for (const jt of jobTitles) {
          if (jt.id && (jt as Record<string, unknown>).unitId) {
            jtMap.set(jt.id, (jt as Record<string, unknown>).unitId as string);
          }
        }

        // 3. Resolve unitId for each employee
        let synced = 0;
        const details: any[] = [];
        const unresolvedEmployees: any[] = [];

        for (const emp of missingUnit) {
          let resolvedUnitId: string | null = null;
          let resolvedFrom: string | null = null;

          // Priority 1: BudgetedPosition (jobTitleId + departmentId match)
          if (emp.jobTitleId && emp.departmentId) {
            const bpKey = `${emp.jobTitleId}|${emp.departmentId}`;
            if (bpMap.has(bpKey)) {
              resolvedUnitId = bpMap.get(bpKey)!;
              resolvedFrom = 'budgetedPosition';
            }
          }

          // Priority 2: JobTitle (jobTitleId match)
          if (!resolvedUnitId && emp.jobTitleId && jtMap.has(emp.jobTitleId)) {
            resolvedUnitId = jtMap.get(emp.jobTitleId)!;
            resolvedFrom = 'jobTitle';
          }

          if (resolvedUnitId) {
            await collection.updateOne(
              { id: emp.id, tenantId },
              { $set: { unitId: resolvedUnitId, updatedAt: now, updatedBy: userId } },
            );
            synced++;
            details.push({
              id: emp.id,
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
              employeeNo: emp.employeeNo,
              jobTitleId: emp.jobTitleId,
              departmentId: emp.departmentId,
              resolvedUnitId,
              resolvedFrom,
            });
          } else {
            unresolvedEmployees.push({
              id: emp.id,
              name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
              employeeNo: emp.employeeNo,
              jobTitleId: emp.jobTitleId || 'MISSING',
              departmentId: emp.departmentId,
              positionId: emp.positionId || null,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Synced unitId for ${synced} employee(s) out of ${missingUnit.length} without unitId`,
          synced,
          total: missingUnit.length,
          unresolved: unresolvedEmployees.length,
          lookups: {
            budgetedPositionsWithUnit: budgetedPositions.length,
            jobTitlesWithUnit: jobTitles.length,
          },
          details,
          unresolvedEmployees,
        });
      }

      // Parse pagination params with error handling
      let params;
      try {
        params = paginationSchema.parse({
          page: searchParams.get('page'),
          limit: searchParams.get('limit'),
          search: searchParams.get('search'),
          sortBy: searchParams.get('sortBy') || 'lastName',
          sortOrder: searchParams.get('sortOrder'),
          includeDeleted: searchParams.get('includeDeleted'),
        });
      } catch (parseError: unknown) {
        const pe = parseError as Record<string, unknown>;
        logger.error('[CVision Employees GET] Pagination parse error', {
          tenantId,
          userId,
          error: pe.errors || pe.message,
        });
        return NextResponse.json(
          { 
            error: 'Invalid pagination parameters', 
            details: pe.errors || pe.message,
            code: 'VALIDATION_ERROR' 
          },
          { status: 400 }
        );
      }

      // Parse query params
      const includeArchived = searchParams.get('includeArchived') === '1';
      const departmentId = searchParams.get('departmentId');
      const statusesParam = searchParams.get('statuses'); // Comma-separated list (ONLY param for status filtering)

      // Get collection with error handling
      let collection;
      try {
        collection = await getCVisionCollection<CVisionEmployee>(
          tenantId,
          'employees'
        );
      } catch (dbError: unknown) {
        const dbe = dbError instanceof Error ? dbError : { message: String(dbError), stack: undefined };
        logger.error('[CVision Employees GET] Failed to get collection', {
          tenantId,
          userId,
          error: dbe.message,
          stack: dbe.stack,
        });
        return NextResponse.json(
          { 
            error: 'Database connection failed', 
            message: dbe.message || 'Failed to connect to database',
            code: 'DATABASE_ERROR'
          },
          { status: 500 }
        );
      }

      // Build additional filter
      const additionalFilter: any = {};
      
      // Status filtering logic:
      // - If statuses param provided, use it (comma-separated canonical values)
      // - If omitted => NO status filter (return ALL employees excluding archived)
      // - DO NOT default to ACTIVE-only
      let appliedStatuses: string[] | null = null;
      
      if (statusesParam) {
        // Parse comma-separated statuses and normalize to canonical uppercase
        const statusList = statusesParam.split(',').map(s => normalizeStatus(s.trim()));
        // Validate all statuses are canonical
        const validStatuses = statusList.filter(s => ['ACTIVE', 'PROBATION', 'RESIGNED', 'TERMINATED'].includes(s));
        if (validStatuses.length > 0) {
          additionalFilter.status = { $in: validStatuses };
          appliedStatuses = validStatuses;
        }
      }
      // If no statuses param, don't set status filter (return all)

      // Exclude archived unless includeArchived=1
      // Note: includeArchived is now the only archive filter (includeInactive removed)
      if (!includeArchived) {
        additionalFilter.isArchived = { $ne: true };
      }

      // Department filter
      if (departmentId) {
        additionalFilter.departmentId = departmentId;
      }

      // Unit filter
      const unitId = searchParams.get('unitId');
      if (unitId) {
        additionalFilter.unitId = unitId;
      }

      // Position filter
      const positionId = searchParams.get('positionId');
      if (positionId) {
        additionalFilter.positionId = positionId;
      }

      // Apply access control — use permission engine for manager-based scoping
      const hasTenantAccess = hasTenantWideAccess(ctx);
      let scopeFilter: any | null = null;
      
      if (!hasTenantAccess) {
        // Use the permission engine to resolve manager → reports hierarchy
        const managerScopeFilter = await getEmployeeScopeFilter(
          tenantId,
          userId,
          ctx.employeeId,
          ctx.cvisionRole,
        );

        if (managerScopeFilter) {
          scopeFilter = managerScopeFilter;
        } else if (ctx.departmentIds && ctx.departmentIds.length > 0) {
          // Fallback: department-based filter
          const orConditions: any[] = [
            { departmentId: { $in: ctx.departmentIds } },
          ];
          if (ctx.employeeId) {
            orConditions.push({ id: ctx.employeeId });
          }
          scopeFilter = { $or: orConditions };
        } else if (ctx.employeeId) {
          scopeFilter = { id: ctx.employeeId };
        } else {
          logger.info('[CVision Employees GET] 403: No department scope or employee link', {
            tenantId,
            userId,
            roles: ctx.roles,
            departmentIds: ctx.departmentIds,
            employeeId: ctx.employeeId,
          });
          return NextResponse.json(
            { error: 'No access scope: missing department or employee link', code: 'FORBIDDEN_SCOPE' },
            { status: 403 }
          );
        }
      }

      // Merge scope filter with additional filters
      // createTenantFilter will handle the MongoDB query structure correctly
      if (scopeFilter) {
        // If both have $or, combine with $and
        if (scopeFilter.$or && additionalFilter.$or) {
          const combinedFilter: any = {};
          // Copy all non-$or fields from additionalFilter
          Object.keys(additionalFilter).forEach(key => {
            if (key !== '$or' && key !== '$and') {
              combinedFilter[key] = additionalFilter[key];
            }
          });
          // Combine $or clauses with $and
          combinedFilter.$and = [
            { $or: additionalFilter.$or },
            { $or: scopeFilter.$or },
          ];
          // Copy any existing $and clauses
          if (additionalFilter.$and && Array.isArray(additionalFilter.$and)) {
            combinedFilter.$and.push(...additionalFilter.$and);
          }
          Object.assign(additionalFilter, combinedFilter);
        } else {
          // Simple merge - MongoDB will AND all conditions
          // createTenantFilter will handle the structure correctly
          Object.assign(additionalFilter, scopeFilter);
        }
      }

      // Log forensic info
      logger.info('[CVision Employees GET] Query details', {
        tenantId,
        userId,
        roles: ctx.roles,
        employeeId: ctx.employeeId,
        departmentIds: ctx.departmentIds,
        hasTenantAccess,
        filters: {
          status: additionalFilter.status,
          isArchived: additionalFilter.isArchived,
          departmentId: additionalFilter.departmentId,
          scopeFilter: scopeFilter ? 'applied' : 'none',
        },
        params: {
          page: params.page,
          limit: params.limit,
          search: params.search,
          includeArchived,
        },
      });

      // Execute paginated query with error handling
      let result;
      try {
        result = await paginatedList(
          collection,
          tenantId,
          params,
          Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
        );
        
        // Safety check: ensure result is defined
        if (!result) {
          throw new Error('paginatedList returned undefined');
        }
      } catch (dbError: unknown) {
        const dbe2 = dbError instanceof Error ? dbError : { message: String(dbError), stack: undefined };
        logger.error('[CVision Employees GET] Database query error', {
          tenantId,
          userId,
          error: dbe2.message,
          stack: dbe2.stack,
          filters: additionalFilter,
        });
        return NextResponse.json(
          { 
            error: 'Database query failed', 
            message: dbe2.message || 'Failed to query employees',
            code: 'DATABASE_ERROR' 
          },
          { status: 500 }
        );
      }

      // Normalize status values in response (compatibility layer for legacy data)
      // CRITICAL: Always use root fields (emp.status, emp.departmentId, emp.positionId) - canonical source of truth
      if (result && result.data && Array.isArray(result.data)) {
        result.data = result.data.map((emp: CVisionEmployee) => {
          // Consistency guard (dev-only): Check for divergence
          if (process.env.NODE_ENV === 'development') {
            // Note: We don't fetch profile sections here for performance, but the guard in GET /employees/:id will catch it
            // This is just normalization - root fields are always canonical
          }
          
          return {
            ...emp,
            status: normalizeStatus(emp.status), // Normalize to canonical for response
            // departmentId and positionId are already from root (canonical)
          };
        });
      }

      // Log result count with filter details (dev-only)
      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Employees GET] Result', {
          tenantId,
          userId,
          returnedCount: result.data?.length || 0,
          total: result.total,
          hasMore: result.hasMore,
          filters: {
            status: additionalFilter.status,
            includeArchived,
            departmentId,
            statuses: statusesParam,
          },
        });
      }

      // Build meta information for client (consistent response shape)
      const meta = {
        appliedStatuses: appliedStatuses, // null if no filter, array if filtered
        includeArchived,
        returnedCount: result?.data?.length || 0,
        total: result?.total || 0,
      };

      const rawData = result?.data || [];
      const cvisionRole = ctx?.cvisionRole || 'employee';
      const viewerEmpId = ctx?.employeeId;
      const filteredData = filterEmployeeList(rawData as Record<string, unknown>[], cvisionRole, viewerEmpId);

      // Enrich with department names (resolve UUIDs)
      const deptIdsToResolve = [...new Set(filteredData.map((e) => e.departmentId).filter(Boolean))];
      if (deptIdsToResolve.length > 0 && !filteredData.every((e) => e.departmentName)) {
        try {
          const db = await getCVisionDb(tenantId);
          const depts = await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIdsToResolve } }).project({ id: 1, name: 1 }).toArray();
          const deptLookup: Record<string, string> = {};
          for (const d of depts) deptLookup[d.id] = d.name || d.id;
          for (const emp of filteredData) {
            if (emp.departmentId && !emp.departmentName && deptLookup[emp.departmentId]) {
              emp.departmentName = deptLookup[emp.departmentId];
            }
          }
        } catch { /* non-critical */ }
      }

      return NextResponse.json({
        success: true,
        data: filteredData,
        total: result?.total || 0,
        page: result?.page || params.page,
        limit: result?.limit || params.limit,
        hasMore: result?.hasMore || false,
        meta,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : { message: String(error), stack: undefined, name: undefined };
      logger.error('[CVision Employees GET]', err.message, err.stack);

      // Handle specific error types
      if (err.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: (error as Record<string, unknown>).errors, code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      // Check if it's an authz error that wasn't caught
      if (err.message?.includes('FORBIDDEN') || err.message?.includes('UNAUTHORIZED')) {
        return NextResponse.json(
          { error: err.message || 'Access denied', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error', message: err.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Create employee  
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context with error handling
      let ctx;
      try {
        const ctxResult = await requireCtx(request);
        if (ctxResult instanceof NextResponse) {
          return ctxResult; // 401 or 403
        }
        ctx = ctxResult;
      } catch (authzError: unknown) {
        const ae2 = authzError instanceof Error ? authzError : { message: String(authzError), stack: undefined };
        logger.error('[CVision Employees POST] Authz context error', {
          tenantId,
          userId,
          error: ae2.message,
          stack: ae2.stack,
        });
        return NextResponse.json(
          { 
            error: 'Authorization error', 
            message: ae2.message || 'Failed to build authorization context',
            code: 'AUTHZ_ERROR'
          },
          { status: 500 }
        );
      }

      const body = await request.json();
      const data = createEmployeeSchema.parse(body);

      // Create a temporary employee object for policy check
      const tempEmployee = {
        id: '', // Will be generated
        tenantId,
        employeeNumber: '',
        ...data,
        status: data.status || 'probation',
        statusChangedAt: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      } as Record<string, unknown>;

      // Enforce write policy
      const writePolicy = canWriteEmployee(ctx, tempEmployee as any);
      const enforceResult = await enforce(writePolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const collection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      // Check email uniqueness
      const existingEmail = await collection.findOne(
        createTenantFilter(tenantId, { email: data.email })
      );
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Employee with this email already exists' },
          { status: 400 }
        );
      }

      // Validate department exists
      const deptCollection = await getCVisionCollection(tenantId, 'departments');
      const department = await deptCollection.findOne(
        createTenantFilter(tenantId, { id: data.departmentId })
      );
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 400 }
        );
      }

      // Validate job title exists and belongs to selected department
      interface JobTitleRecord extends CVisionBaseRecord {
        departmentId?: string;
        name?: string;
      }
      const jobTitleCollection = await getCVisionCollection<JobTitleRecord>(tenantId, 'jobTitles');
      const jobTitle = await jobTitleCollection.findOne(
        createTenantFilter(tenantId, { id: data.jobTitleId })
      );
      if (!jobTitle) {
        return NextResponse.json(
          { error: 'Job title not found', code: 'JOB_TITLE_NOT_FOUND' },
          { status: 400 }
        );
      }

      // PR-A: Validate job title belongs to selected department
      if (jobTitle.departmentId !== data.departmentId) {
        return NextResponse.json(
          {
            error: 'Job title must belong to selected department',
            code: 'DEPARTMENT_MISMATCH',
            details: {
              selectedDepartmentId: data.departmentId,
              jobTitleDepartmentId: jobTitle.departmentId,
            }
          },
          { status: 400 }
        );
      }

      // Validate positionId if provided — check both budgetedPositions (primary) and positionTypes (legacy)
      if (data.positionId) {
        const budgetedPosCollection = await getCVisionCollection(tenantId, 'budgetedPositions');
        let position = await budgetedPosCollection.findOne(
          createTenantFilter(tenantId, { id: data.positionId })
        );

        if (!position) {
          // Fallback to legacy positionTypes collection
          const legacyPosCollection = await getCVisionCollection(tenantId, 'positionTypes');
          position = await legacyPosCollection.findOne(
            createTenantFilter(tenantId, { id: data.positionId })
          );
        }

        if (!position) {
          return NextResponse.json(
            { error: 'Position not found' },
            { status: 400 }
          );
        }

        // For budgeted positions, verify departmentId matches directly
        if ((position as Record<string, unknown>).departmentId && (position as Record<string, unknown>).departmentId !== data.departmentId) {
          return NextResponse.json(
            { error: 'Position does not belong to the selected department' },
            { status: 400 }
          );
        }

        // For legacy positions without departmentId, check departmentPositions assignment
        if (!(position as Record<string, unknown>).departmentId) {
          const assignmentCollection = await getCVisionCollection(tenantId, 'departmentPositions');
          const assignment = await assignmentCollection.findOne(
            createTenantFilter(tenantId, {
              departmentId: data.departmentId,
              positionId: data.positionId,
              isActive: true,
            })
          );
          if (!assignment) {
            return NextResponse.json(
              { error: 'Position must be assigned to the selected department' },
              { status: 400 }
            );
          }
        }
      }

      // Generate employee number
      const employeeNumber = await generateSequenceNumber(
        tenantId,
        SEQUENCE_PREFIXES.employee
      );

      const now = new Date();
      
      // Enforce canonical status on creation (default to PROBATION)
      let canonicalStatus: EmployeeStatus;
      try {
        canonicalStatus = assertValidStatus(data.status || 'PROBATION') as EmployeeStatus;
      } catch (_statusError: unknown) {
        return NextResponse.json(
          { error: 'Invalid status', message: `Status must be one of: PROBATION, ACTIVE, RESIGNED, TERMINATED` },
          { status: 400 }
        );
      }

      // Build a PLAIN object with ONLY the fields that exist as PG columns.
      // This is the authoritative allowlist — the shim's stripUnknownColumns
      // relies on getKnownColumns() which can return null on DB hiccups,
      // letting non-existent columns through and causing INSERT failures.
      //
      // PG columns (cvision_employees): id, tenantId, employeeNo, nationalId,
      // firstName, lastName, firstNameAr, lastNameAr, fullName, email, phone,
      // dateOfBirth, gender, nationality, departmentId, unitId, jobTitleId,
      // positionId, gradeId, managerEmployeeId, branchId, workLocation,
      // nursingRole, status, statusEffectiveAt, statusReason, hiredAt,
      // probationEndDate, activatedAt, resignedAt, terminatedAt,
      // contractEndDate, userId, isActive, isArchived, address,
      // emergencyContact, metadata, createdAt, updatedAt, createdBy,
      // updatedBy, deletedAt
      const employeeRecord: any = {
        id: uuidv4(),
        tenantId,
        employeeNo: employeeNumber,
        nationalId: data.nationalId || null,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr || null,
        lastNameAr: data.lastNameAr || null,
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email || null,
        phone: data.phone || null,
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender ? (() => {
          // PG enum CvisionGender expects MALE/FEMALE/OTHER (uppercase)
          const g = String(data.gender).toUpperCase();
          const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'];
          return VALID_GENDERS.includes(g) ? g : 'OTHER';
        })() : null,
        nationality: data.nationality || null,
        departmentId: data.departmentId,
        unitId: data.unitId || null,
        jobTitleId: data.jobTitleId,
        positionId: data.positionId || null,
        gradeId: data.gradeId || null,
        managerEmployeeId: data.managerId || null,
        hiredAt: data.hireDate || now,
        probationEndDate: data.probationEndDate || null,
        contractEndDate: data.contractEndDate || null,
        status: canonicalStatus,
        statusEffectiveAt: now,
        address: data.address || null,
        emergencyContact: data.emergencyContact || null,
        metadata: data.metadata || null,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      };

      // Safety: cast to CVisionEmployee for downstream type compatibility
      const employee = employeeRecord as CVisionEmployee;

      const insertResult = await collection.insertOne(employeeRecord);
      if (!insertResult.acknowledged) {
        logger.error('[CVision Employees POST] INSERT failed silently', {
          employeeId: employee.id,
          tenantId,
          table: 'cvision_employees',
        });
        return NextResponse.json(
          { error: 'Failed to create employee record', code: 'INSERT_FAILED' },
          { status: 500 }
        );
      }

      // Create initial status history entry
      const historyCollection = await getCVisionCollection<CVisionEmployeeStatusHistory>(
        tenantId,
        'employeeStatusHistory'
      );
      await historyCollection.insertOne({
        id: uuidv4(),
        tenantId,
        employeeId: employee.id,
        fromStatus: null,
        toStatus: employee.status,
        reason: 'Initial hire',
        effectiveDate: employee.hiredAt || now,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });

      // Create default contract for new employee
      const contractCollection = await getCVisionCollection(tenantId, 'contracts');
      const contractCount = await contractCollection.countDocuments({ tenantId });
      const contractNumber = `CNT-${new Date().getFullYear()}-${String(contractCount + 1).padStart(5, '0')}`;

      // Calculate default probation end date (90 days)
      const probationEndDate = new Date(employee.hiredAt || now);
      probationEndDate.setDate(probationEndDate.getDate() + SAUDI_CONTRACT_RULES.PROBATION_MAX_DAYS);

      // Default salary values (will be updated when contract details are filled)
      const defaultBasicSalary = 0;
      const defaultHousingAllowance = 0;
      const defaultTransportAllowance = 0;

      // Only include fields that exist as columns in cvision_contracts PG table.
      // PG columns: id, tenantId, contractNo (NOT contractNumber), employeeId, type,
      // status, startDate, endDate, basicSalary, housingAllowance, transportAllowance,
      // otherAllowances, vacationDaysPerYear, isActive, renewedFromContractId,
      // terminationDate, terminationReason, createdAt, updatedAt, createdBy,
      // updatedBy, deletedAt
      //
      // NOT in PG (stripped): contractNumber → use contractNo, probationEndDate,
      //   workingHoursPerWeek, noticePeriodDays, renewalCount, signedAt,
      //   signedByEmployee, signedByEmployer, documentUrl, notes
      const defaultContract = {
        id: uuidv4(),
        tenantId,
        employeeId: employee.id,
        contractNo: contractNumber, // PG column is 'contractNo', not 'contractNumber'
        type: 'FIXED_TERM', // Default to fixed term with probation
        status: 'ACTIVE',
        startDate: employee.hiredAt || now,
        endDate: null, // Will be set when probation ends
        basicSalary: defaultBasicSalary,
        housingAllowance: defaultHousingAllowance,
        transportAllowance: defaultTransportAllowance,
        otherAllowances: 0,
        vacationDaysPerYear: 21,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        deletedAt: null,
      };

      const contractResult = await contractCollection.insertOne(defaultContract);
      if (!contractResult.acknowledged) {
        logger.warn('[CVision Employees POST] Contract INSERT failed; skipping metadata update', {
          employeeId: employee.id, tenantId, contractId: defaultContract.id,
        });
      }

      // Update employee metadata with contract reference (only if contract was created).
      // Note: currentContractId is not a PG column — store in metadata JSONB.
      // The canonical link is contract.employeeId, but metadata allows quick lookup.
      if (contractResult.acknowledged) {
        await collection.updateOne(
          { id: employee.id, tenantId },
          { $set: { metadata: { ...(employee.metadata || {}), currentContractId: defaultContract.id } } }
        );
      }

      // Audit log
      const contractId = contractResult.acknowledged ? defaultContract.id : null;
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_create',
        'employee',
        {
          resourceId: employee.id,
          changes: { after: { ...data, employeeNumber, contractId } },
        }
      );

      // Lifecycle: onboarding, leave balances, compensation, notifications, webhooks
      const lifecycleDb = await getCVisionDb(tenantId);
      onEmployeeCreated(lifecycleDb, tenantId, { ...employee, currentContractId: contractId }, userId)
        .catch(err => logger.error('[Lifecycle] onEmployeeCreated failed:', err));

      // Emit employee.hired@v1 — best-effort, never breaks the response.
      try {
        await emit({
          eventName: 'employee.hired',
          version: 1,
          tenantId,
          aggregate: 'employee',
          aggregateId: employee.id,
          payload: {
            employeeId: employee.id,
            tenantId,
            departmentId: employee.departmentId ?? null,
            jobTitleId: employee.jobTitleId ?? null,
            status: employee.status,
            hiredAt: (employee.hiredAt ? new Date(employee.hiredAt) : now).toISOString(),
          },
        });
      } catch (e) {
        logger.error('events.emit_failed', { category: 'cvision', eventName: 'employee.hired', error: e });
      }

      return NextResponse.json(
        { success: true, employee: { ...employee, currentContractId: contractId }, contract: contractResult.acknowledged ? defaultContract : null },
        { status: 201 }
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: (error as unknown as Record<string, unknown>).errors },
          { status: 400 }
        );
      }
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Employees POST]', msg);
      return NextResponse.json(
        { error: 'Internal server error', message: msg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);

