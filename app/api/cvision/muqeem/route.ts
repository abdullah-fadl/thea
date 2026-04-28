import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Muqeem — Iqama & Visa Management API
 *
 * GET  /api/cvision/muqeem?action=...  — Read operations
 * POST /api/cvision/muqeem              — Write operations (body.action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import {
  type IqamaRecord,
  type MuqeemAlert,
  type ExitReentryVisa,
  type Dependent,
  type MuqeemAlertType,
  type AlertSeverity,
  daysUntilExpiry,
  getDocumentStatus,
  getAlertSeverity,
  generateAlerts,
  calculateAnnualCost,
  validateIqamaNumber,
  getNitaqatImpact,
  getRenewalRecommendation,
  formatCurrency,
  ALERT_THRESHOLDS,
  IQAMA_RENEWAL_COSTS,
  NATIONALITIES,
} from '@/lib/cvision/muqeem/muqeem-engine';
import { isSaudiEmployee, SAUDI_NATIONALITY_VALUES } from '@/lib/cvision/saudi-utils';
import type { CVisionEmployee, CVisionDepartment, CVisionMuqeemRecord, CVisionMuqeemAlert } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper: admin/owner role check
const ADMIN_ROLES = ['admin', 'hr-admin', 'thea-owner', 'owner'];

/**
 * Normalize a free-text nationality value to a 2-letter code used in NATIONALITIES map.
 * Falls back to first 2 chars uppercased if no match is found.
 */
function normalizeNationalityCode(raw: string): string {
  const val = raw.trim().toLowerCase();
  // Exact ISO code match
  const upper = raw.trim().toUpperCase();
  if (NATIONALITIES[upper]) return upper;
  // Full-name / Arabic match against NATIONALITIES
  for (const [code, info] of Object.entries(NATIONALITIES)) {
    if (info.label.toLowerCase() === val) return code;
  }
  // Common long-form matches
  const LONG_FORM: Record<string, string> = {
    'saudi arabia': 'SA', 'egypt': 'EG', 'pakistan': 'PK', 'india': 'IN',
    'philippines': 'PH', 'bangladesh': 'BD', 'jordan': 'JO', 'syria': 'SY',
    'yemen': 'YE', 'sudan': 'SD', 'lebanon': 'LB', 'united states': 'US',
    'united kingdom': 'GB', 'مصري': 'EG', 'باكستاني': 'PK', 'هندي': 'IN',
    'فلبيني': 'PH', 'بنغلاديشي': 'BD', 'أردني': 'JO', 'سوري': 'SY',
    'يمني': 'YE', 'سوداني': 'SD', 'لبناني': 'LB',
  };
  if (LONG_FORM[val]) return LONG_FORM[val];
  // Fallback: return uppercased first 2 chars
  return upper.substring(0, 2) || 'XX';
}

// =============================================================================
// Seed Data — Auto-populate when collection is empty
// =============================================================================

async function seedMuqeemData(tenantId: string, userId: string) {
  const db = await getCVisionDb(tenantId);
  const recordsColl = db.collection('cvision_muqeem_records');
  const alertsColl = db.collection('cvision_muqeem_alerts');

  // ---- ONE-TIME CLEANUP: detect & purge bad legacy data ----
  // If records exist, check if any are for Saudi employees or duplicates.
  // If contaminated → wipe everything and re-seed cleanly.
  const existingCount = await recordsColl.countDocuments({ tenantId });
  if (existingCount > 0) {
    const allExisting = await recordsColl.find({ tenantId }).limit(5000).toArray() as unknown as IqamaRecord[];

    // Check 1: Any Saudi nationality records? (should never exist)
    const hasSaudiRecords = allExisting.some((r: IqamaRecord) => {
      const nat = (r.nationality || '').trim().toLowerCase();
      return (SAUDI_NATIONALITY_VALUES as readonly string[]).includes(nat) || r.nationality === 'SA';
    });

    // Check 2: Any duplicate employeeIds?
    const employeeIdSet = new Set<string>();
    let hasDuplicates = false;
    for (const r of allExisting) {
      if (employeeIdSet.has(r.employeeId)) { hasDuplicates = true; break; }
      employeeIdSet.add(r.employeeId);
    }

    // Check 3: Any iqama numbers NOT starting with "2"?
    const hasBadIqamas = allExisting.some((r: IqamaRecord) =>
      r.iqamaNumber && !r.iqamaNumber.startsWith('2')
    );

    if (hasSaudiRecords || hasDuplicates || hasBadIqamas) {
      logger.info(`[Muqeem Seed] Cleaning contaminated data: saudis=${hasSaudiRecords}, duplicates=${hasDuplicates}, badIqamas=${hasBadIqamas}`);
      await recordsColl.deleteMany({ tenantId });
      await alertsColl.deleteMany({ tenantId });
      // Fall through to re-seed below
    } else {
      return { seeded: false };
    }
  }

  // Fetch ALL employees, then filter out Saudis using the robust checker
  const empColl = db.collection('cvision_employees');
  const allEmployees = await empColl
    .find({
      tenantId,
      status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
      isArchived: { $ne: true },
    })
    .limit(5000)
    .toArray();

  const now = new Date();

  // Use the robust isSaudiEmployee helper to filter
  let nonSaudiEmployees = allEmployees.filter((e) => {
    // Must have a nationality and NOT be Saudi
    const nat = ((e as unknown as CVisionEmployee).nationality || '').trim();
    if (!nat) return false; // skip employees with no nationality set
    return !isSaudiEmployee(e);
  });

  if (nonSaudiEmployees.length === 0) {
    // Create sample non-Saudi employees so the system has data to work with
    logger.info('[Muqeem Seed] No foreign employees found — creating sample foreign employees');
    const sampleForeign: Array<Pick<CVisionEmployee, 'id' | 'tenantId' | 'employeeNo' | 'firstName' | 'lastName' | 'nationality' | 'nationalId' | 'status' | 'isArchived' | 'departmentId' | 'email'> & { position: string; createdAt: string; updatedAt: string }> = [
      {
        id: uuidv4(), tenantId, employeeNo: 'EMP-F001',
        firstName: 'Omar', lastName: 'Ali',
        nationality: 'Egyptian', nationalId: '2098765432',
        status: 'ACTIVE', isArchived: false,
        departmentId: allEmployees[0]?.departmentId || 'DEPT-001',
        position: 'Software Engineer', email: 'omar.ali@cvision.sa',
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
      {
        id: uuidv4(), tenantId, employeeNo: 'EMP-F002',
        firstName: 'Maria', lastName: 'Santos',
        nationality: 'Filipino', nationalId: '2087654321',
        status: 'ACTIVE', isArchived: false,
        departmentId: allEmployees[1]?.departmentId || allEmployees[0]?.departmentId || 'DEPT-001',
        position: 'HR Specialist', email: 'maria.santos@cvision.sa',
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
      {
        id: uuidv4(), tenantId, employeeNo: 'EMP-F003',
        firstName: 'Ahmed', lastName: 'Hassan',
        nationality: 'Sudanese', nationalId: '2076543210',
        status: 'ACTIVE', isArchived: false,
        departmentId: allEmployees[2]?.departmentId || allEmployees[0]?.departmentId || 'DEPT-001',
        position: 'Accountant', email: 'ahmed.hassan@cvision.sa',
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
      {
        id: uuidv4(), tenantId, employeeNo: 'EMP-F004',
        firstName: 'Rajesh', lastName: 'Kumar',
        nationality: 'Indian', nationalId: '2065432109',
        status: 'ACTIVE', isArchived: false,
        departmentId: allEmployees[0]?.departmentId || 'DEPT-001',
        position: 'IT Support', email: 'rajesh.kumar@cvision.sa',
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
    ];

    await empColl.insertMany(sampleForeign);
    nonSaudiEmployees.push(...sampleForeign);
  }

  // Fetch departments for name lookups
  const deptColl = db.collection('cvision_departments');
  const departments = await deptColl.find({ tenantId }).limit(5000).toArray();
  const deptMap = new Map<string, string>();
  for (const d of departments) deptMap.set(d.id, d.name || d.code || d.id);

  const records: IqamaRecord[] = [];

  // Scenario templates: vary expiry dates for realistic data
  const scenarios = [
    { iqamaDaysLeft: 21, passportDaysLeft: 300, insuranceDaysLeft: 120, hasDeps: true, hasExitReentry: true, absher: 'VERIFIED' as const },
    { iqamaDaysLeft: 220, passportDaysLeft: 45, insuranceDaysLeft: 200, hasDeps: false, hasExitReentry: false, absher: 'NOT_CHECKED' as const },
    { iqamaDaysLeft: 68, passportDaysLeft: 400, insuranceDaysLeft: 55, hasDeps: true, hasExitReentry: true, absher: 'VERIFIED' as const },
    { iqamaDaysLeft: 180, passportDaysLeft: 500, insuranceDaysLeft: 300, hasDeps: false, hasExitReentry: false, absher: 'VERIFIED' as const },
  ];

  const insuranceProviders = ['Bupa Arabia', 'Tawuniya', 'MedGulf', 'AXA Cooperative'];

  for (let i = 0; i < nonSaudiEmployees.length; i++) {
    const emp = nonSaudiEmployees[i];

    // Safety: skip if this employee already has a record (prevents duplicates)
    const existingRecord = await recordsColl.findOne({ employeeId: emp.id, tenantId });
    if (existingRecord) continue;

    const scenario = scenarios[i % scenarios.length];
    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    const dept = deptMap.get(emp.departmentId) || emp.departmentId || 'Unknown';

    // Normalize nationality to 2-letter code for storage
    const rawNat = (emp.nationality || '').trim();
    const nat = normalizeNationalityCode(rawNat);

    const iqamaExpiry = new Date(now.getTime() + scenario.iqamaDaysLeft * 86400000);
    const iqamaIssue = new Date(iqamaExpiry.getTime() - 365 * 86400000);
    const passportExpiry = new Date(now.getTime() + scenario.passportDaysLeft * 86400000);
    const passportIssue = new Date(passportExpiry.getTime() - 5 * 365 * 86400000);
    const insuranceExpiry = new Date(now.getTime() + scenario.insuranceDaysLeft * 86400000);

    // Use obviously fake ID numbers prefixed with FAKE- so they can never be
    // confused with real Iqama or passport numbers.
    const fakeSeq = () => String(i).padStart(3, '0') + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const iqamaNum = `FAKE-IQM-${fakeSeq()}`;

    const dependents: Dependent[] = [];
    if (scenario.hasDeps) {
      dependents.push({
        id: uuidv4(),
        name: `${empName} (Spouse)`,
        relationship: 'SPOUSE',
        iqamaNumber: `FAKE-IQM-${fakeSeq()}`,
        iqamaExpiryDate: iqamaExpiry.toISOString(),
        dateOfBirth: '1990-01-15',
        passportNumber: `FAKE-PP-${fakeSeq()}`,
      });
      dependents.push({
        id: uuidv4(),
        name: `${empName} (${i % 2 === 0 ? 'Son' : 'Daughter'})`,
        relationship: i % 2 === 0 ? 'SON' : 'DAUGHTER',
        iqamaNumber: `FAKE-IQM-${fakeSeq()}`,
        iqamaExpiryDate: iqamaExpiry.toISOString(),
        dateOfBirth: '2015-06-20',
        passportNumber: `FAKE-PP-${fakeSeq()}`,
      });
    }

    const exitReentryVisas: ExitReentryVisa[] = [];
    if (scenario.hasExitReentry) {
      // One that has already been used (returned)
      const erIssueDate = new Date(now.getTime() - 60 * 86400000);
      const erExpiryDate = new Date(erIssueDate.getTime() + 90 * 86400000);
      exitReentryVisas.push({
        id: uuidv4(),
        type: 'SINGLE',
        visaNumber: `ER-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
        issueDate: erIssueDate.toISOString(),
        expiryDate: erExpiryDate.toISOString(),
        duration: 90,
        departureDate: new Date(now.getTime() - 45 * 86400000).toISOString(),
        returnDate: new Date(now.getTime() - 15 * 86400000).toISOString(),
        destination: 'Egypt',
        status: 'RETURNED',
      });

      // For employee index 2 (the "currently abroad" scenario), add an active one
      if (i % scenarios.length === 2) {
        const activeErIssue = new Date(now.getTime() - 10 * 86400000);
        const activeErExpiry = new Date(activeErIssue.getTime() + 30 * 86400000);
        exitReentryVisas.push({
          id: uuidv4(),
          type: 'SINGLE',
          visaNumber: `ER-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
          issueDate: activeErIssue.toISOString(),
          expiryDate: activeErExpiry.toISOString(),
          duration: 30,
          departureDate: new Date(now.getTime() - 7 * 86400000).toISOString(),
          returnDate: null,
          destination: 'Jordan',
          status: 'DEPARTED',
        });
      }
    }

    const baseCost = IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT;
    const depsCost = dependents.length * IQAMA_RENEWAL_COSTS.DEPENDENT;

    const record: IqamaRecord = {
      _id: uuidv4(),
      tenantId,
      employeeId: emp.id,
      employeeName: empName,
      department: dept,
      nationality: nat,
      iqamaNumber: iqamaNum,
      iqamaIssueDate: iqamaIssue.toISOString(),
      iqamaExpiryDate: iqamaExpiry.toISOString(),
      iqamaStatus: getDocumentStatus(iqamaExpiry),
      passportNumber: `P${Math.floor(1000000 + Math.random() * 9000000)}`,
      passportIssueDate: passportIssue.toISOString(),
      passportExpiryDate: passportExpiry.toISOString(),
      passportStatus: getDocumentStatus(passportExpiry),
      visaType: 'WORK',
      visaNumber: `WV-${now.getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`,
      visaIssueDate: iqamaIssue.toISOString(),
      visaExpiryDate: iqamaExpiry.toISOString(),
      visaStatus: getDocumentStatus(iqamaExpiry),
      exitReentryVisas,
      lastAbsherCheck: scenario.absher === 'VERIFIED' ? new Date(now.getTime() - 7 * 86400000).toISOString() : null,
      absherStatus: scenario.absher,
      absherNotes: scenario.absher === 'VERIFIED' ? 'All data matches — verified via Absher' : null,
      insuranceProvider: insuranceProviders[i % insuranceProviders.length],
      insuranceNumber: `INS-${Math.floor(100000 + Math.random() * 900000)}`,
      insuranceExpiryDate: insuranceExpiry.toISOString(),
      iqamaRenewalCost: IQAMA_RENEWAL_COSTS.EMPLOYEE,
      visaCost: 0,
      insuranceCost: 2500,
      totalAnnualCost: baseCost + depsCost,
      sponsorName: 'CVision Technologies',
      sponsorId: '1010XXXXXX',
      dependents,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    records.push(record);
  }

  if (records.length > 0) {
    await recordsColl.insertMany(records);
  }

  // Generate initial alerts
  const alerts = generateAlerts(records);
  if (alerts.length > 0) {
    await alertsColl.insertMany(alerts.map((a) => ({ ...a, _id: uuidv4() })));
  }

  return { seeded: true, recordsCreated: records.length, alertsCreated: alerts.length };
}

// =============================================================================
// GET — Read operations
// =============================================================================

export const GET = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'dashboard';
      const db = await getCVisionDb(tenantId);

      // Auto-seed on first access
      await seedMuqeemData(tenantId, userId);

      const recordsColl = db.collection('cvision_muqeem_records');
      const alertsColl = db.collection('cvision_muqeem_alerts');

      // ---------------------------------------------------------------
      // ACTION: dashboard — Overview statistics
      // ---------------------------------------------------------------
      if (action === 'dashboard') {
        // ---- Count ACTUAL foreign employees from cvision_employees ----
        const empColl = db.collection('cvision_employees');
        const allActiveEmps = await empColl
          .find({
            tenantId,
            status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            isArchived: { $ne: true },
          })
          .limit(5000)
          .toArray() as unknown as CVisionEmployee[];
        const actualForeignCount = allActiveEmps.filter((e: CVisionEmployee) => {
          const nat = (e.nationality || '').trim();
          return nat && !isSaudiEmployee(e);
        }).length;

        // ---- Process muqeem records (should only be non-Saudi) ----
        const allRecords = await recordsColl.find({ tenantId }).limit(5000).toArray() as unknown as IqamaRecord[];

        // Count by iqama status (recalculate dynamically)
        let validCount = 0;
        let expiringSoonCount = 0;
        let expiredCount = 0;
        let totalAnnualCost = 0;
        let upcomingRenewalCost = 0;

        const nationalityMap: Record<string, number> = {};
        const departmentMap: Record<string, number> = {};
        let absherVerified = 0;
        let absherPending = 0;
        let absherMismatch = 0;
        let departedCount = 0;

        for (const rec of allRecords) {
          // Skip any Saudi records that may have been created before the fix
          const recNat = (rec.nationality || '').trim().toLowerCase();
          if ((SAUDI_NATIONALITY_VALUES as readonly string[]).includes(recNat) || rec.nationality === 'SA') continue;

          const status = getDocumentStatus(rec.iqamaExpiryDate);
          if (status === 'VALID') validCount++;
          else if (status === 'EXPIRING_SOON') expiringSoonCount++;
          else expiredCount++;

          totalAnnualCost += calculateAnnualCost(rec);

          const days = daysUntilExpiry(rec.iqamaExpiryDate);
          if (days >= 0 && days <= 90) {
            upcomingRenewalCost += IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT +
              (rec.dependents?.length || 0) * IQAMA_RENEWAL_COSTS.DEPENDENT;
          }

          // Nationality breakdown — exclude Saudi (should not appear)
          const nat = rec.nationality || 'UNKNOWN';
          nationalityMap[nat] = (nationalityMap[nat] || 0) + 1;

          // Department breakdown
          const dept = rec.department || 'Unknown';
          departmentMap[dept] = (departmentMap[dept] || 0) + 1;

          // Absher stats
          if (rec.absherStatus === 'VERIFIED') absherVerified++;
          else if (rec.absherStatus === 'PENDING') absherPending++;
          else if (rec.absherStatus === 'MISMATCH') absherMismatch++;

          // Active exit/reentry
          for (const erv of (rec.exitReentryVisas || [])) {
            if (erv.status === 'DEPARTED') departedCount++;
          }
        }

        // Filter out any remaining Saudi entries from nationality breakdown
        const nationalityBreakdown = Object.entries(nationalityMap)
          .filter(([code]) => {
            const cl = code.toLowerCase();
            return !(SAUDI_NATIONALITY_VALUES as readonly string[]).includes(cl) && code !== 'SA';
          })
          .map(([code, count]) => ({
            code,
            name: NATIONALITIES[code]?.label || code,
            count,
          })).sort((a, b) => b.count - a.count);

        const departmentBreakdown = Object.entries(departmentMap).map(([name, count]) => ({
          name,
          count,
        })).sort((a, b) => b.count - a.count);

        return NextResponse.json({
          success: true,
          data: {
            // Use actual count from cvision_employees, NOT from muqeem records
            totalForeignEmployees: actualForeignCount,
            iqamaStatus: { valid: validCount, expiringSoon: expiringSoonCount, expired: expiredCount },
            activeDepartures: departedCount,
            costs: {
              totalAnnualCost,
              totalAnnualCostFormatted: formatCurrency(totalAnnualCost),
              upcomingRenewalCost,
              upcomingRenewalCostFormatted: formatCurrency(upcomingRenewalCost),
            },
            nationalityBreakdown,
            departmentBreakdown,
            absherStats: { verified: absherVerified, pending: absherPending, mismatch: absherMismatch },
          },
        });
      }

      // ---------------------------------------------------------------
      // ACTION: list — Paginated list with filters
      // ---------------------------------------------------------------
      if (action === 'list') {
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
        const skip = (page - 1) * limit;

        const status = searchParams.get('status');
        const nationality = searchParams.get('nationality');
        const department = searchParams.get('department');
        const expiringWithin = searchParams.get('expiringWithin');
        const search = searchParams.get('search');

        const query: any = { tenantId };

        if (nationality) query.nationality = nationality.toUpperCase();
        if (department) {
          const escapedDept = department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          query.department = { $regex: escapedDept, $options: 'i' };
        }
        if (search) {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          query.$or = [
            { employeeName: { $regex: escapedSearch, $options: 'i' } },
            { iqamaNumber: { $regex: escapedSearch, $options: 'i' } },
          ];
        }

        if (expiringWithin) {
          const withinDays = parseInt(expiringWithin);
          const futureDate = new Date(Date.now() + withinDays * 86400000);
          query.iqamaExpiryDate = { $lte: futureDate.toISOString(), $gte: new Date().toISOString() };
        }

        const totalCount = await recordsColl.countDocuments(query);
        const rawRecords = await recordsColl
          .find(query)
          .sort({ iqamaExpiryDate: 1 })
          .skip(skip)
          .limit(limit)
          .toArray() as unknown as IqamaRecord[];

        // Dynamically enrich with daysRemaining and current status
        let records = rawRecords.map((rec) => {
          const days = daysUntilExpiry(rec.iqamaExpiryDate);
          const currentStatus = getDocumentStatus(rec.iqamaExpiryDate);
          return { ...rec, daysRemaining: Math.max(days, 0), currentStatus };
        });

        // Apply post-filter for status (since we compute it dynamically)
        if (status) {
          records = records.filter((r) => r.currentStatus === status.toUpperCase());
        }

        return NextResponse.json({
          success: true,
          data: records,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
        });
      }

      // ---------------------------------------------------------------
      // ACTION: detail — Single record
      // ---------------------------------------------------------------
      if (action === 'detail') {
        const employeeId = searchParams.get('employeeId');
        const id = searchParams.get('id');

        if (!employeeId && !id) {
          return NextResponse.json({ error: 'employeeId or id is required' }, { status: 400 });
        }

        const query: any = { tenantId };
        if (employeeId) query.employeeId = employeeId;
        else query._id = id;

        const record = await recordsColl.findOne(query) as unknown as IqamaRecord | null;
        if (!record) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const days = daysUntilExpiry(record.iqamaExpiryDate);
        const recommendation = getRenewalRecommendation(record);

        return NextResponse.json({
          success: true,
          data: {
            ...record,
            daysRemaining: Math.max(days, 0),
            currentStatus: getDocumentStatus(record.iqamaExpiryDate),
            recommendation,
          },
        });
      }

      // ---------------------------------------------------------------
      // ACTION: alerts — Alert list with filters
      // ---------------------------------------------------------------
      if (action === 'alerts') {
        const type = searchParams.get('type') as MuqeemAlertType | null;
        const severity = searchParams.get('severity') as AlertSeverity | null;
        const isRead = searchParams.get('isRead');
        const isResolved = searchParams.get('isResolved');

        const query: any = { tenantId };
        if (type) query.type = type;
        if (severity) query.severity = severity;
        if (isRead !== null && isRead !== undefined && isRead !== '') query.isRead = isRead === 'true';
        if (isResolved !== null && isResolved !== undefined && isResolved !== '') {
          query.isResolved = isResolved === 'true';
        } else {
          // Default: only unresolved
          query.isResolved = false;
        }

        const alerts = await alertsColl
          .find(query)
          .sort({ daysRemaining: 1 })
          .limit(200)
          .toArray();

        return NextResponse.json({ success: true, data: alerts, total: alerts.length });
      }

      // ---------------------------------------------------------------
      // ACTION: exit-reentry — All exit/re-entry visas
      // ---------------------------------------------------------------
      if (action === 'exit-reentry') {
        const visaStatus = searchParams.get('visaStatus');

        const allRecords = await recordsColl
          .find({ tenantId, 'exitReentryVisas.0': { $exists: true } })
          .limit(5000)
          .toArray() as unknown as IqamaRecord[];

        const flatVisas: Array<ExitReentryVisa & { employeeId: string; employeeName: string; department: string; nationality: string; iqamaNumber: string; daysRemaining: number }> = [];
        for (const rec of allRecords) {
          for (const erv of (rec.exitReentryVisas || [])) {
            if (visaStatus && erv.status !== visaStatus.toUpperCase()) continue;
            flatVisas.push({
              ...erv,
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              department: rec.department,
              nationality: rec.nationality,
              iqamaNumber: rec.iqamaNumber,
              daysRemaining: Math.max(daysUntilExpiry(erv.expiryDate), 0),
            });
          }
        }

        flatVisas.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

        return NextResponse.json({ success: true, data: flatVisas, total: flatVisas.length });
      }

      // ---------------------------------------------------------------
      // ACTION: expiring — Records expiring within N days
      // ---------------------------------------------------------------
      if (action === 'expiring') {
        const days = parseInt(searchParams.get('days') || '90');
        const futureDate = new Date(Date.now() + days * 86400000);

        const expiring = await recordsColl
          .find({
            tenantId,
            iqamaExpiryDate: { $lte: futureDate.toISOString(), $gte: new Date().toISOString() },
          })
          .sort({ iqamaExpiryDate: 1 })
          .limit(5000)
          .toArray() as unknown as IqamaRecord[];

        const enriched = expiring.map((rec) => {
          const daysLeft = daysUntilExpiry(rec.iqamaExpiryDate);
          const cost = calculateAnnualCost(rec);
          return {
            employeeId: rec.employeeId,
            employeeName: rec.employeeName,
            department: rec.department,
            nationality: rec.nationality,
            iqamaNumber: rec.iqamaNumber,
            iqamaExpiryDate: rec.iqamaExpiryDate,
            daysRemaining: Math.max(daysLeft, 0),
            severity: getAlertSeverity(daysLeft),
            renewalCostEstimate: cost,
            renewalCostFormatted: formatCurrency(cost),
          };
        });

        return NextResponse.json({ success: true, data: enriched, total: enriched.length });
      }

      // ---------------------------------------------------------------
      // ACTION: compliance — Compliance check
      // ---------------------------------------------------------------
      if (action === 'compliance') {
        const allRecords = await recordsColl.find({ tenantId }).limit(5000).toArray() as unknown as IqamaRecord[];

        // Find non-Saudi employees without a muqeem record
        const empColl = db.collection('cvision_employees');
        const allEmps = await empColl
          .find({
            tenantId,
            status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            isArchived: { $ne: true },
          })
          .limit(5000)
          .toArray() as unknown as CVisionEmployee[];

        const nonSaudiEmps = allEmps.filter((e: CVisionEmployee) => {
          const nat = (e.nationality || '').trim();
          return nat && !isSaudiEmployee(e);
        });

        const recordedIds = new Set(allRecords.map((r: IqamaRecord) => r.employeeId));

        const issues: Array<{ type: string; severity: string; employeeId: string; employeeName: string; message: string; recommendation: string }> = [];
        let compliantCount = 0;

        // Check for missing muqeem records
        for (const emp of nonSaudiEmps) {
          if (!recordedIds.has(emp.id)) {
            const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            issues.push({
              type: 'MISSING_RECORD',
              severity: 'CRITICAL',
              employeeId: emp.id,
              employeeName: empName,
              message: `Non-Saudi employee has no Muqeem record`,
              recommendation: 'Create iqama record immediately',
            });
          }
        }

        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

        for (const rec of allRecords) {
          let isCompliant = true;

          // Expired iqama
          if (daysUntilExpiry(rec.iqamaExpiryDate) < 0) {
            isCompliant = false;
            issues.push({
              type: 'EXPIRED_IQAMA',
              severity: 'CRITICAL',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `Iqama ${rec.iqamaNumber} has expired`,
              recommendation: 'Renew iqama immediately to avoid MOL fines',
            });
          }

          // Expired passport
          if (daysUntilExpiry(rec.passportExpiryDate) < 0) {
            isCompliant = false;
            issues.push({
              type: 'EXPIRED_PASSPORT',
              severity: 'CRITICAL',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `Passport ${rec.passportNumber} has expired`,
              recommendation: 'Contact employee embassy for passport renewal',
            });
          }

          // Missing insurance
          if (!rec.insuranceNumber || !rec.insuranceExpiryDate) {
            isCompliant = false;
            issues.push({
              type: 'MISSING_INSURANCE',
              severity: 'URGENT',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `No medical insurance on file`,
              recommendation: 'Arrange medical insurance — required by CCHI',
            });
          } else if (daysUntilExpiry(rec.insuranceExpiryDate) < 0) {
            isCompliant = false;
            issues.push({
              type: 'EXPIRED_INSURANCE',
              severity: 'URGENT',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `Insurance ${rec.insuranceNumber} has expired`,
              recommendation: 'Renew medical insurance',
            });
          }

          // Absher not verified or stale (> 90 days)
          if (rec.absherStatus !== 'VERIFIED') {
            isCompliant = false;
            issues.push({
              type: 'ABSHER_NOT_VERIFIED',
              severity: 'WARNING',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `Absher status: ${rec.absherStatus}`,
              recommendation: 'Verify employee data on Absher',
            });
          } else if (rec.lastAbsherCheck && rec.lastAbsherCheck < ninetyDaysAgo) {
            issues.push({
              type: 'ABSHER_STALE',
              severity: 'INFO',
              employeeId: rec.employeeId,
              employeeName: rec.employeeName,
              message: `Last Absher check was over 90 days ago`,
              recommendation: 'Re-verify on Absher',
            });
          }

          if (isCompliant) compliantCount++;
        }

        const totalChecked = allRecords.length + (nonSaudiEmps.length - allRecords.length);
        const complianceScore = totalChecked > 0 ? Math.round((compliantCount / totalChecked) * 100) : 100;

        issues.sort((a, b) => {
          const sev: Record<string, number> = { CRITICAL: 0, URGENT: 1, WARNING: 2, INFO: 3 };
          return (sev[a.severity] || 4) - (sev[b.severity] || 4);
        });

        return NextResponse.json({
          success: true,
          data: {
            complianceScore,
            totalChecked,
            compliantCount,
            issueCount: issues.length,
            issues,
          },
        });
      }

      // ---------------------------------------------------------------
      // Unknown action
      // ---------------------------------------------------------------
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Muqeem GET]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.MUQEEM_READ }
);

// =============================================================================
// POST — Write operations
// =============================================================================

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      const body = await request.json();
      const { action } = body;

      if (!action) {
        return NextResponse.json({ error: 'action is required in request body' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);
      const recordsColl = db.collection('cvision_muqeem_records');
      const alertsColl = db.collection('cvision_muqeem_alerts');
      const now = new Date();

      // ---------------------------------------------------------------
      // ACTION: create — Create a new iqama record
      // ---------------------------------------------------------------
      if (action === 'create') {
        const {
          employeeId, iqamaNumber, iqamaIssueDate, iqamaExpiryDate,
          passportNumber, nationality, passportIssueDate, passportExpiryDate,
          visaType, visaNumber, visaIssueDate, visaExpiryDate,
          insuranceProvider, insuranceNumber, insuranceExpiryDate,
          sponsorName, sponsorId, dependents: depsInput,
        } = body;

        if (!employeeId || !iqamaNumber || !iqamaIssueDate || !iqamaExpiryDate || !passportNumber || !nationality) {
          return NextResponse.json({
            error: 'Required: employeeId, iqamaNumber, iqamaIssueDate, iqamaExpiryDate, passportNumber, nationality',
          }, { status: 400 });
        }

        if (!validateIqamaNumber(iqamaNumber)) {
          return NextResponse.json({ error: 'Invalid iqama number — must be 10 digits starting with 2' }, { status: 400 });
        }

        // Fetch employee details first — need nationality check
        const empColl = db.collection('cvision_employees');
        const emp = await empColl.findOne({ tenantId, id: employeeId }) as unknown as CVisionEmployee | null;

        // Block Saudi employees from having iqama records
        if (emp && isSaudiEmployee(emp)) {
          return NextResponse.json({
            error: 'Saudi nationals do not require iqama records. Only non-Saudi (foreign) employees need iqama tracking.',
          }, { status: 400 });
        }

        // Check for duplicate
        const existing = await recordsColl.findOne({ tenantId, employeeId });
        if (existing) {
          return NextResponse.json({ error: 'Muqeem record already exists for this employee' }, { status: 409 });
        }

        const deptColl = db.collection('cvision_departments');
        const departments = await deptColl.find({ tenantId }).limit(5000).toArray();
        const deptMap = new Map<string, string>();
        for (const d of departments) {
          const dept = d as unknown as CVisionDepartment;
          deptMap.set(dept.id, dept.name || dept.code || dept.id);
        }

        const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : body.employeeName || 'Unknown';
        const dept = emp ? (deptMap.get(emp.departmentId) || emp.departmentId || '') : body.department || '';

        const dependents: Dependent[] = (depsInput || []).map((d: Partial<Dependent>) => ({
          id: d.id || uuidv4(),
          name: d.name || '',
          relationship: d.relationship || 'SPOUSE',
          iqamaNumber: d.iqamaNumber || null,
          iqamaExpiryDate: d.iqamaExpiryDate || null,
          dateOfBirth: d.dateOfBirth || null,
          passportNumber: d.passportNumber || null,
        }));

        const record: IqamaRecord = {
          _id: uuidv4(),
          tenantId,
          employeeId,
          employeeName: empName,
          department: dept,
          nationality: nationality.toUpperCase(),
          iqamaNumber,
          iqamaIssueDate,
          iqamaExpiryDate,
          iqamaStatus: getDocumentStatus(iqamaExpiryDate),
          passportNumber,
          passportIssueDate: passportIssueDate || iqamaIssueDate,
          passportExpiryDate: passportExpiryDate || iqamaExpiryDate,
          passportStatus: getDocumentStatus(passportExpiryDate || iqamaExpiryDate),
          visaType: visaType || 'WORK',
          visaNumber: visaNumber || '',
          visaIssueDate: visaIssueDate || iqamaIssueDate,
          visaExpiryDate: visaExpiryDate || iqamaExpiryDate,
          visaStatus: getDocumentStatus(visaExpiryDate || iqamaExpiryDate),
          exitReentryVisas: [],
          lastAbsherCheck: null,
          absherStatus: 'NOT_CHECKED',
          absherNotes: null,
          insuranceProvider: insuranceProvider || null,
          insuranceNumber: insuranceNumber || null,
          insuranceExpiryDate: insuranceExpiryDate || null,
          iqamaRenewalCost: IQAMA_RENEWAL_COSTS.EMPLOYEE,
          visaCost: 0,
          insuranceCost: null,
          totalAnnualCost: 0,
          sponsorName: sponsorName || 'CVision Technologies',
          sponsorId: sponsorId || '',
          dependents,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        record.totalAnnualCost = calculateAnnualCost(record);

        await recordsColl.insertOne(record as unknown as Record<string, unknown>);

        // Generate alerts if expiring soon
        const alerts = generateAlerts([record]);
        if (alerts.length > 0) {
          await alertsColl.insertMany(alerts.map((a) => ({ ...a, _id: uuidv4() })));
        }

        return NextResponse.json({ success: true, data: record, alertsCreated: alerts.length }, { status: 201 });
      }

      // ---------------------------------------------------------------
      // ACTION: update — Update existing record
      // ---------------------------------------------------------------
      if (action === 'update') {
        const { _id, employeeId, ...updates } = body;
        const recordId = _id || body.id;

        if (!recordId && !employeeId) {
          return NextResponse.json({ error: '_id or employeeId is required' }, { status: 400 });
        }

        const query: any = { tenantId };
        if (recordId) query._id = recordId;
        else query.employeeId = employeeId;

        const existing = await recordsColl.findOne(query);
        if (!existing) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        // Build partial update
        const allowedFields = [
          'iqamaNumber', 'iqamaIssueDate', 'iqamaExpiryDate', 'iqamaStatus',
          'passportNumber', 'passportIssueDate', 'passportExpiryDate',
          'visaType', 'visaNumber', 'visaIssueDate', 'visaExpiryDate',
          'insuranceProvider', 'insuranceNumber', 'insuranceExpiryDate',
          'sponsorName', 'sponsorId',
          'absherStatus', 'absherNotes', 'lastAbsherCheck',
          'dependents', 'department', 'nationality',
        ];

        const $set: any = { updatedAt: now.toISOString() };
        for (const key of allowedFields) {
          if (updates[key] !== undefined) {
            $set[key] = updates[key];
          }
        }

        // Recalculate statuses if dates changed
        if ($set.iqamaExpiryDate) {
          $set.iqamaStatus = getDocumentStatus($set.iqamaExpiryDate as string);
        }
        if ($set.passportExpiryDate) {
          $set.passportStatus = getDocumentStatus($set.passportExpiryDate as string);
        }
        if ($set.visaExpiryDate) {
          $set.visaStatus = getDocumentStatus($set.visaExpiryDate as string);
        }

        await recordsColl.updateOne(query, { $set });

        // Recalculate annual cost
        const updated = await recordsColl.findOne(query) as unknown as IqamaRecord | null;
        if (updated) {
          const newCost = calculateAnnualCost(updated);
          await recordsColl.updateOne(query, { $set: { totalAnnualCost: newCost } });
        }

        // Regenerate alerts if iqama expiry changed
        if ($set.iqamaExpiryDate && updated) {
          const newAlerts = generateAlerts([updated]);
          // Remove old unresolved iqama alerts for this employee
          await alertsColl.deleteMany({ tenantId, employeeId: updated.employeeId, type: 'IQAMA_EXPIRY', isResolved: false });
          if (newAlerts.length > 0) {
            const iqamaAlerts = newAlerts.filter((a) => a.type === 'IQAMA_EXPIRY');
            if (iqamaAlerts.length > 0) {
              await alertsColl.insertMany(iqamaAlerts.map((a) => ({ ...a, _id: uuidv4() })));
            }
          }
        }

        const finalRecord = await recordsColl.findOne(query);
        return NextResponse.json({ success: true, data: finalRecord });
      }

      // ---------------------------------------------------------------
      // ACTION: renew — Renew iqama
      // ---------------------------------------------------------------
      if (action === 'renew') {
        const { employeeId, newExpiryDate } = body;
        if (!employeeId || !newExpiryDate) {
          return NextResponse.json({ error: 'employeeId and newExpiryDate are required' }, { status: 400 });
        }

        const query = { tenantId, employeeId };
        const existing = await recordsColl.findOne(query) as unknown as IqamaRecord | null;
        if (!existing) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const renewalCost = IQAMA_RENEWAL_COSTS.EMPLOYEE + IQAMA_RENEWAL_COSTS.WORK_PERMIT +
          (existing.dependents?.length || 0) * IQAMA_RENEWAL_COSTS.DEPENDENT;

        await recordsColl.updateOne(query, {
          $set: {
            iqamaExpiryDate: newExpiryDate,
            iqamaIssueDate: now.toISOString(),
            iqamaStatus: 'RENEWED',
            iqamaRenewalCost: renewalCost,
            totalAnnualCost: renewalCost,
            updatedAt: now.toISOString(),
          },
        });

        // Mark existing iqama alerts as resolved
        await alertsColl.updateMany(
          { tenantId, employeeId, type: 'IQAMA_EXPIRY', isResolved: false },
          { $set: { isResolved: true, resolvedAt: now.toISOString(), resolvedBy: userId } }
        );

        const updated = await recordsColl.findOne(query);
        return NextResponse.json({ success: true, data: updated, renewalCost, renewalCostFormatted: formatCurrency(renewalCost) });
      }

      // ---------------------------------------------------------------
      // ACTION: issue-exit-reentry — Issue new exit/re-entry visa
      // ---------------------------------------------------------------
      if (action === 'issue-exit-reentry') {
        const { employeeId, type: erType, duration, estimatedDepartureDate } = body;
        if (!employeeId || !erType || !duration) {
          return NextResponse.json({ error: 'employeeId, type (SINGLE/MULTIPLE), and duration are required' }, { status: 400 });
        }

        const query = { tenantId, employeeId };
        const existing = await recordsColl.findOne(query);
        if (!existing) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const visaNumber = `ER-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
        const expiryDate = new Date(now.getTime() + duration * 86400000);
        const cost = erType === 'MULTIPLE' ? IQAMA_RENEWAL_COSTS.EXIT_REENTRY_MULTIPLE : IQAMA_RENEWAL_COSTS.EXIT_REENTRY_SINGLE;

        const newVisa: ExitReentryVisa = {
          id: uuidv4(),
          type: erType,
          visaNumber,
          issueDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          duration,
          departureDate: estimatedDepartureDate || null,
          returnDate: null,
          destination: body.destination || null,
          status: 'ISSUED',
        };

        await recordsColl.updateOne(query, {
          $push: { exitReentryVisas: newVisa } as Record<string, unknown>,
          $set: { visaCost: cost, updatedAt: now.toISOString() },
        });

        const updated = await recordsColl.findOne(query);
        return NextResponse.json({
          success: true,
          data: updated,
          visa: newVisa,
          cost,
          costFormatted: formatCurrency(cost),
        }, { status: 201 });
      }

      // ---------------------------------------------------------------
      // ACTION: record-departure
      // ---------------------------------------------------------------
      if (action === 'record-departure') {
        const { employeeId, visaId, departureDate, destination } = body;
        if (!employeeId || !visaId || !departureDate) {
          return NextResponse.json({ error: 'employeeId, visaId, and departureDate are required' }, { status: 400 });
        }

        await recordsColl.updateOne(
          { tenantId, employeeId, 'exitReentryVisas.id': visaId },
          {
            $set: {
              'exitReentryVisas.$.departureDate': departureDate,
              'exitReentryVisas.$.destination': destination || null,
              'exitReentryVisas.$.status': 'DEPARTED',
              updatedAt: now.toISOString(),
            },
          }
        );

        const updated = await recordsColl.findOne({ tenantId, employeeId });
        return NextResponse.json({ success: true, data: updated });
      }

      // ---------------------------------------------------------------
      // ACTION: record-return
      // ---------------------------------------------------------------
      if (action === 'record-return') {
        const { employeeId, visaId, returnDate } = body;
        if (!employeeId || !visaId || !returnDate) {
          return NextResponse.json({ error: 'employeeId, visaId, and returnDate are required' }, { status: 400 });
        }

        // Check if return is within visa validity
        const record = await recordsColl.findOne({ tenantId, employeeId }) as unknown as IqamaRecord | null;
        if (!record) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        const visa = (record.exitReentryVisas || []).find((v: ExitReentryVisa) => v.id === visaId);
        let warning: string | null = null;
        if (visa && new Date(returnDate) > new Date(visa.expiryDate)) {
          warning = `Return date is after visa expiry (${visa.expiryDate}). Employee may face penalties.`;
        }

        await recordsColl.updateOne(
          { tenantId, employeeId, 'exitReentryVisas.id': visaId },
          {
            $set: {
              'exitReentryVisas.$.returnDate': returnDate,
              'exitReentryVisas.$.status': 'RETURNED',
              updatedAt: now.toISOString(),
            },
          }
        );

        const updated = await recordsColl.findOne({ tenantId, employeeId });
        return NextResponse.json({ success: true, data: updated, warning });
      }

      // ---------------------------------------------------------------
      // ACTION: verify-absher — Simulate Absher verification
      // ---------------------------------------------------------------
      if (action === 'verify-absher') {
        const { employeeId } = body;
        if (!employeeId) {
          return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
        }

        const query = { tenantId, employeeId };
        const existing = await recordsColl.findOne(query);
        if (!existing) {
          return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        }

        await recordsColl.updateOne(query, {
          $set: {
            lastAbsherCheck: now.toISOString(),
            absherStatus: 'VERIFIED',
            absherNotes: 'Simulated verification — all data matches',
            updatedAt: now.toISOString(),
          },
        });

        const updated = await recordsColl.findOne(query);
        return NextResponse.json({ success: true, data: updated });
      }

      // ---------------------------------------------------------------
      // ACTION: generate-alerts — Scan and generate alerts
      // ---------------------------------------------------------------
      if (action === 'generate-alerts') {
        const allRecords = await recordsColl.find({ tenantId }).limit(5000).toArray() as unknown as IqamaRecord[];
        const newAlerts = generateAlerts(allRecords);

        let newCount = 0;
        let resolvedCount = 0;

        for (const alert of newAlerts) {
          // Check for existing unresolved alert of same type for same employee
          const existingAlert = await alertsColl.findOne({
            tenantId,
            employeeId: alert.employeeId,
            type: alert.type,
            isResolved: false,
          });

          if (!existingAlert) {
            await alertsColl.insertOne({ ...alert, _id: uuidv4() });
            newCount++;
          }
        }

        // Resolve alerts for documents that have been renewed (no longer expiring)
        const allAlertTypes: MuqeemAlertType[] = ['IQAMA_EXPIRY', 'PASSPORT_EXPIRY', 'VISA_EXPIRY', 'INSURANCE_EXPIRY', 'EXIT_REENTRY_EXPIRY'];
        const activeAlerts = await alertsColl.find({ tenantId, isResolved: false }).limit(1000).toArray() as unknown as MuqeemAlert[];

        for (const activeAlert of activeAlerts) {
          const record = allRecords.find((r: IqamaRecord) => r.employeeId === activeAlert.employeeId);
          if (!record) continue;

          let stillExpiring = false;
          if (activeAlert.type === 'IQAMA_EXPIRY') {
            stillExpiring = daysUntilExpiry(record.iqamaExpiryDate) <= ALERT_THRESHOLDS.IQAMA[0];
          } else if (activeAlert.type === 'PASSPORT_EXPIRY') {
            stillExpiring = daysUntilExpiry(record.passportExpiryDate) <= ALERT_THRESHOLDS.PASSPORT[0];
          } else if (activeAlert.type === 'VISA_EXPIRY') {
            stillExpiring = daysUntilExpiry(record.visaExpiryDate) <= ALERT_THRESHOLDS.VISA[0];
          } else if (activeAlert.type === 'INSURANCE_EXPIRY' && record.insuranceExpiryDate) {
            stillExpiring = daysUntilExpiry(record.insuranceExpiryDate) <= ALERT_THRESHOLDS.INSURANCE[0];
          }

          if (!stillExpiring) {
            await alertsColl.updateOne(
              { _id: activeAlert._id, tenantId },
              { $set: { isResolved: true, resolvedAt: now.toISOString(), resolvedBy: 'system' } }
            );
            resolvedCount++;
          }
        }

        const totalActive = await alertsColl.countDocuments({ tenantId, isResolved: false });

        return NextResponse.json({
          success: true,
          data: { newAlerts: newCount, resolvedAlerts: resolvedCount, totalActive },
        });
      }

      // ---------------------------------------------------------------
      // ACTION: resolve-alert
      // ---------------------------------------------------------------
      if (action === 'resolve-alert') {
        const { alertId } = body;
        if (!alertId) {
          return NextResponse.json({ error: 'alertId is required' }, { status: 400 });
        }

        const result = await alertsColl.updateOne(
          { _id: alertId, tenantId },
          { $set: { isResolved: true, resolvedAt: now.toISOString(), resolvedBy: userId } }
        );

        if (result.matchedCount === 0) {
          return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
        }

        const updated = await alertsColl.findOne({ _id: alertId });
        return NextResponse.json({ success: true, data: updated });
      }

      // ---------------------------------------------------------------
      // ACTION: reset-data — Wipe all muqeem records & alerts, re-seed cleanly
      // ---------------------------------------------------------------
      if (action === 'reset-data') {
        // Only admin/owner can reset
        if (!ADMIN_ROLES.includes(role || '')) {
          return NextResponse.json({ error: 'Only admins can reset Muqeem data' }, { status: 403 });
        }

        // 1. Delete all existing records and alerts
        const deletedRecords = await recordsColl.deleteMany({ tenantId });
        const deletedAlerts = await alertsColl.deleteMany({ tenantId });

        // 2. Check if we have non-Saudi employees; if not, create sample foreign employees
        const empColl = db.collection('cvision_employees');
        const allEmps = await empColl
          .find({
            tenantId,
            status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            isArchived: { $ne: true },
          })
          .limit(5000)
          .toArray() as unknown as CVisionEmployee[];

        const foreignEmps = allEmps.filter((e: CVisionEmployee) => {
          const nat = (e.nationality || '').trim();
          return nat && !isSaudiEmployee(e);
        });

        let sampleEmployeesCreated = 0;

        if (foreignEmps.length === 0) {
          // Create sample non-Saudi employees so there's data to seed
          const sampleForeign = [
            {
              id: uuidv4(), tenantId, employeeNo: 'EMP-F001',
              firstName: 'Omar', lastName: 'Ali',
              nationality: 'Egyptian', nationalId: '2098765432',
              status: 'ACTIVE', isArchived: false,
              departmentId: allEmps[0]?.departmentId || 'DEPT-001',
              position: 'Software Engineer', email: 'omar.ali@cvision.sa',
              createdAt: now.toISOString(), updatedAt: now.toISOString(),
            },
            {
              id: uuidv4(), tenantId, employeeNo: 'EMP-F002',
              firstName: 'Maria', lastName: 'Santos',
              nationality: 'Filipino', nationalId: '2087654321',
              status: 'ACTIVE', isArchived: false,
              departmentId: allEmps[1]?.departmentId || allEmps[0]?.departmentId || 'DEPT-001',
              position: 'HR Specialist', email: 'maria.santos@cvision.sa',
              createdAt: now.toISOString(), updatedAt: now.toISOString(),
            },
            {
              id: uuidv4(), tenantId, employeeNo: 'EMP-F003',
              firstName: 'Ahmed', lastName: 'Hassan',
              nationality: 'Sudanese', nationalId: '2076543210',
              status: 'ACTIVE', isArchived: false,
              departmentId: allEmps[2]?.departmentId || allEmps[0]?.departmentId || 'DEPT-001',
              position: 'Accountant', email: 'ahmed.hassan@cvision.sa',
              createdAt: now.toISOString(), updatedAt: now.toISOString(),
            },
            {
              id: uuidv4(), tenantId, employeeNo: 'EMP-F004',
              firstName: 'Rajesh', lastName: 'Kumar',
              nationality: 'Indian', nationalId: '2065432109',
              status: 'ACTIVE', isArchived: false,
              departmentId: allEmps[0]?.departmentId || 'DEPT-001',
              position: 'IT Support', email: 'rajesh.kumar@cvision.sa',
              createdAt: now.toISOString(), updatedAt: now.toISOString(),
            },
          ];

          await empColl.insertMany(sampleForeign);
          sampleEmployeesCreated = sampleForeign.length;
        }

        // 3. Re-seed muqeem records for non-Saudi employees only
        const seedResult = await seedMuqeemData(tenantId, userId);

        return NextResponse.json({
          success: true,
          data: {
            deletedRecords: deletedRecords.deletedCount,
            deletedAlerts: deletedAlerts.deletedCount,
            sampleEmployeesCreated,
            ...seedResult,
          },
        });
      }

      // ---------------------------------------------------------------
      // ACTION: bulk-import
      // ---------------------------------------------------------------
      if (action === 'bulk-import') {
        const { records: inputRecords } = body;
        if (!Array.isArray(inputRecords) || inputRecords.length === 0) {
          return NextResponse.json({ error: 'records array is required' }, { status: 400 });
        }

        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < inputRecords.length; i++) {
          const rec = inputRecords[i];
          try {
            if (!rec.employeeId || !rec.iqamaNumber || !rec.iqamaExpiryDate || !rec.passportNumber || !rec.nationality) {
              errors.push(`Record ${i}: missing required fields`);
              failed++;
              continue;
            }

            if (!validateIqamaNumber(rec.iqamaNumber)) {
              errors.push(`Record ${i}: invalid iqama number ${rec.iqamaNumber}`);
              failed++;
              continue;
            }

            // Check for duplicate
            const exists = await recordsColl.findOne({ tenantId, employeeId: rec.employeeId });
            if (exists) {
              errors.push(`Record ${i}: duplicate — employeeId ${rec.employeeId} already exists`);
              failed++;
              continue;
            }

            const fullRecord: IqamaRecord = {
              _id: uuidv4(),
              tenantId,
              ...rec,
              nationality: (rec.nationality || '').toUpperCase(),
              iqamaStatus: getDocumentStatus(rec.iqamaExpiryDate),
              passportStatus: getDocumentStatus(rec.passportExpiryDate || rec.iqamaExpiryDate),
              visaStatus: getDocumentStatus(rec.visaExpiryDate || rec.iqamaExpiryDate),
              exitReentryVisas: rec.exitReentryVisas || [],
              dependents: rec.dependents || [],
              absherStatus: rec.absherStatus || 'NOT_CHECKED',
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
            fullRecord.totalAnnualCost = calculateAnnualCost(fullRecord);

            await recordsColl.insertOne(fullRecord);
            imported++;
          } catch (err: unknown) {
            errors.push(`Record ${i}: ${err instanceof Error ? err.message : String(err)}`);
            failed++;
          }
        }

        return NextResponse.json({
          success: true,
          data: { imported, failed, errors: errors.slice(0, 50) },
        }, { status: 201 });
      }

      // ---------------------------------------------------------------
      // ACTION: sync-profile — Sync document dates from employee profile
      // ---------------------------------------------------------------
      if (action === 'sync-profile') {
        const { employeeId, iqamaExpiryDate, passportNumber, passportExpiryDate } = body;
        if (!employeeId) {
          return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
        }

        const query = { tenantId, employeeId };
        const existing = await recordsColl.findOne(query);
        if (!existing) {
          return NextResponse.json({ success: true, synced: false, reason: 'no_muqeem_record' });
        }

        const $set: any = { updatedAt: now.toISOString() };
        if (iqamaExpiryDate) {
          $set.iqamaExpiryDate = iqamaExpiryDate;
          $set.iqamaStatus = getDocumentStatus(iqamaExpiryDate);
        }
        if (passportNumber) {
          $set.passportNumber = passportNumber;
        }
        if (passportExpiryDate) {
          $set.passportExpiryDate = passportExpiryDate;
          $set.passportStatus = getDocumentStatus(passportExpiryDate);
        }

        await recordsColl.updateOne(query, { $set });

        if ($set.iqamaExpiryDate) {
          const updated = await recordsColl.findOne(query) as unknown as IqamaRecord | null;
          if (updated) {
            const newAlerts = generateAlerts([updated]);
            await alertsColl.deleteMany({ tenantId, employeeId, type: 'IQAMA_EXPIRY', isResolved: false });
            const iqamaAlerts = newAlerts.filter((a) => a.type === 'IQAMA_EXPIRY');
            if (iqamaAlerts.length > 0) {
              await alertsColl.insertMany(iqamaAlerts.map((a) => ({ ...a, _id: uuidv4() })));
            }
          }
        }

        return NextResponse.json({ success: true, synced: true });
      }

      // ---------------------------------------------------------------
      // Unknown action
      // ---------------------------------------------------------------
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Muqeem POST]', errMsg);
      return NextResponse.json(
        { error: 'Internal server error', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.MUQEEM_READ }
);
