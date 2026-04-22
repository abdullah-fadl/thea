import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { ensureSeedData, getInsuranceSummary, getCostReport, getClaimsAnalytics, SEED_PROVIDERS } from '@/lib/cvision/insurance/insurance-engine';
import type {
  CVisionEmployee,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionInsuranceProvider,
  CVisionInsurancePolicy,
  CVisionEmployeeInsurance,
  CVisionInsuranceClaim,
  CVisionInsuranceRequest,
  CVisionInsurancePlan,
  InsuranceDependent,
} from '@/lib/cvision/types';

/** Projected employee fields used in list queries */
interface EmployeeProjection {
  _id?: any;
  id: string;
  firstName?: string;
  lastName?: string;
  departmentId?: string;
  jobTitleId?: string;
  hireDate?: Date | string | null;
  nationality?: string;
}

/** Shape returned after merging insurance info onto an employee row */
interface MergedEmployee {
  employeeId: string;
  fullName: string;
  department: string;
  jobTitle: string;
  hireDate?: Date | string | null;
  insured: boolean;
  insuranceStatus: string;
  providerName: string;
  planName: string;
  insuranceClass: string;
  monthlyPremium: number;
  dependentCount: number;
  cardNumber: string;
  membershipNumber: string;
  expiryDate: Date | string | null;
  expiringSoon: boolean;
}

/** Enriched provider with unpacked contactInfo fields */
interface EnrichedProvider extends CVisionInsuranceProvider {
  providerId: string;
  type?: string;
  status: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || '';
      const db = await getCVisionDb(tenantId);
      await ensureSeedData(db, tenantId);

      /* ── All employees merged with insurance status ─────────────── */
      if (action === 'all-employees') {
        const employees = await db.collection('cvision_employees')
          .find({ tenantId, status: { $in: ['ACTIVE', 'Active', 'active', 'PROBATION', 'probation'] }, isArchived: { $ne: true }, deletedAt: null })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1, jobTitleId: 1, hireDate: 1, nationality: 1 })
          .toArray();

        // Resolve department & job title names
        const deptIds = [...new Set((employees as EmployeeProjection[]).map((e) => e.departmentId).filter(Boolean))] as string[];
        const jtIds = [...new Set((employees as EmployeeProjection[]).map((e) => e.jobTitleId).filter(Boolean))] as string[];
        const [deptDocs, jtDocs] = await Promise.all([
          deptIds.length > 0 ? db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray() : [],
          jtIds.length > 0 ? db.collection('cvision_job_titles').find({ tenantId, id: { $in: jtIds } }).project({ id: 1, name: 1 }).toArray() : [],
        ]);
        const deptMap = new Map((deptDocs as Pick<CVisionDepartment, 'id' | 'name'>[]).map((d) => [d.id, d.name] as [string, string]));
        const jtMap = new Map((jtDocs as Pick<CVisionJobTitle, 'id' | 'name'>[]).map((j) => [j.id, j.name] as [string, string]));

        const enrollments = await db.collection('cvision_employee_insurances')
          .find({ tenantId }).limit(5000).toArray() as CVisionEmployeeInsurance[];
        const enrollMap = new Map(enrollments.map((e) => [e.employeeId, e]));

        const rawProviders = await db.collection('cvision_insurance_providers')
          .find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
        // Unpack contactInfo so callers see providerId, plans, etc.
        const providers = rawProviders.map((p) => {
          const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
          return { ...p, providerId: ci.providerId || p.id, plans: ci.plans || p.plans || [], type: ci.type, status: ci.status || (p.isActive ? 'ACTIVE' : 'INACTIVE') };
        });
        // Key by PG UUID id (policy.providerId stores this UUID)
        const providerMap = new Map(providers.map((p) => [p.id, p]));

        const policies = await db.collection('cvision_insurance_policies')
          .find({ tenantId }).limit(500).toArray() as CVisionInsurancePolicy[];
        // policyId COLUMN_ALIAS maps to policyNumber; enrollment stores the policy number string in its policyId column
        const policyMap = new Map(policies.map((p) => [p.policyNumber || p.policyId || p.id, p]));

        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 86400000);

        const merged: MergedEmployee[] = (employees as EmployeeProjection[]).map((emp) => {
          const empId = emp.id || emp._id?.toString();
          const ins = enrollMap.get(empId) as CVisionEmployeeInsurance | undefined;
          let providerName = '';
          let planName = '';
          let insuranceClass = '';
          let dependentCount = 0;
          let expiringSoon = false;

          if (ins) {
            const policy = policyMap.get(ins.policyId);
            const provider = policy ? providerMap.get(policy.providerId) : null;
            providerName = provider?.name || policy?.providerName || '';
            planName = policy?.planName || '';
            insuranceClass = ins.tier || '';
            dependentCount = (ins.dependents || []).filter((d: InsuranceDependent) => d.status === 'ACTIVE').length;
            const expiry = ins.expiryDate ? new Date(ins.expiryDate) : null;
            expiringSoon = !!expiry && expiry <= thirtyDays && expiry >= now;
          }

          return {
            employeeId: empId,
            fullName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || empId,
            department: deptMap.get(emp.departmentId || '') || '',
            jobTitle: jtMap.get(emp.jobTitleId || '') || '',
            hireDate: emp.hireDate,
            insured: !!ins && ins.status === 'ACTIVE',
            insuranceStatus: ins ? ins.status : 'NOT_INSURED',
            providerName,
            planName,
            insuranceClass,
            monthlyPremium: ins ? ins.monthlyPremium || 0 : 0,
            dependentCount,
            cardNumber: ins ? ins.cardNumber || '' : '',
            membershipNumber: ins ? ins.membershipNumber || '' : '',
            expiryDate: ins ? ins.expiryDate : null,
            expiringSoon,
          };
        });

        const stats = {
          total: merged.length,
          active: merged.filter((m) => m.insured).length,
          notInsured: merged.filter((m) => !m.insured).length,
          expiringSoon: merged.filter((m) => m.expiringSoon).length,
        };

        return NextResponse.json({ success: true, employees: merged, stats });
      }

      /* ── Employee full detail (insurance + dependents + claims + history) */
      if (action === 'employee-full-detail') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });

        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId });

        let provider: CVisionInsuranceProvider | null = null;
        let policy: CVisionInsurancePolicy | null = null;
        let plan: CVisionInsurancePlan | null = null;
        const typedInsurance = insurance as CVisionEmployeeInsurance | null;
        if (typedInsurance) {
          policy = await db.collection('cvision_insurance_policies').findOne({ tenantId, policyId: typedInsurance.policyId }) as CVisionInsurancePolicy | null;
          if (policy) {
            // providerId on policy stores the provider's PG UUID 'id'
            provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: policy.providerId }) as CVisionInsuranceProvider | null;
            const provCi = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
            plan = (provCi.plans || provider?.plans || []).find((p: CVisionInsurancePlan) => p.planId === policy!.planId) || null;
          }
        }

        const claims = await db.collection('cvision_insurance_claims')
          .find({ tenantId, employeeId }).sort({ submittedDate: -1 }).limit(20).toArray();

        const requests = await db.collection('cvision_insurance_requests')
          .find({ tenantId, employeeId }).sort({ submittedAt: -1 }).limit(20).toArray();

        // Resolve department name for employee
        let empDeptName = '';
        if (employee?.departmentId) {
          const dept = await db.collection('cvision_departments').findOne({ tenantId, id: employee.departmentId });
          empDeptName = dept?.name || '';
        }
        let empJobTitle = '';
        if (employee?.jobTitleId) {
          const jt = await db.collection('cvision_job_titles').findOne({ tenantId, id: employee.jobTitleId }) as CVisionJobTitle | null;
          empJobTitle = jt?.name || '';
        }

        return NextResponse.json({
          success: true,
          employee: employee ? {
            employeeId: employee.id,
            fullName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.id,
            department: empDeptName,
            jobTitle: empJobTitle,
            hireDate: employee.hireDate,
          } : null,
          insurance: typedInsurance ? {
            ...typedInsurance,
            providerName: provider?.name || policy?.providerName || '',
            planName: plan?.name || policy?.planName || '',
            policyNumber: policy?.policyNumber || '',
          } : null,
          provider: provider ? (() => {
            const pCi = (typeof provider.contactInfo === 'string' ? JSON.parse(provider.contactInfo) : provider.contactInfo) || {};
            return { providerId: pCi.providerId || provider.id, name: provider.name, plans: pCi.plans || provider.plans || [] };
          })() : null,
          claims,
          requests,
        });
      }

      /* ── Available plans for enrollment / class change ────────── */
      if (action === 'available-plans') {
        const rawProvs = await db.collection('cvision_insurance_providers')
          .find({ tenantId, isActive: true }).limit(500).toArray() as CVisionInsuranceProvider[];
        const activePolicies = await db.collection('cvision_insurance_policies')
          .find({ tenantId, isActive: true }).limit(500).toArray() as CVisionInsurancePolicy[];

        const plans: any[] = [];
        for (const rawProv of rawProvs) {
          // Unpack contactInfo to get plans and providerId
          const provCi = (typeof rawProv.contactInfo === 'string' ? JSON.parse(rawProv.contactInfo as string) : rawProv.contactInfo) || {} as Record<string, unknown>;
          const provId = rawProv.id; // PG UUID
          const provLegacyId = provCi.providerId || rawProv.id;
          const provPlans: CVisionInsurancePlan[] = provCi.plans || rawProv.plans || [];

          // policy.providerId stores the provider's PG UUID
          const providerPolicies = activePolicies.filter((p) => p.providerId === provId);
          for (const pp of providerPolicies) {
            const plan = provPlans.find((p: CVisionInsurancePlan) => p.planId === pp.planId);
            if (plan) {
              plans.push({
                policyId: pp.policyNumber || pp.policyId,
                providerId: provLegacyId,
                providerName: rawProv.name,
                planId: plan.planId,
                planName: plan.name,
                tier: plan.tier,
                monthlyPremium: plan.monthlyPremium,
                annualPremium: plan.annualPremium,
                deductible: plan.deductible,
                copay: plan.copay,
                networkType: plan.networkType,
                benefits: plan.benefits,
                maxCoverage: plan.maxCoverage,
              });
            }
          }

          for (const plan of provPlans) {
            const alreadyListed = plans.some(p => p.planId === plan.planId && p.providerId === provLegacyId);
            if (!alreadyListed) {
              plans.push({
                policyId: null,
                providerId: provLegacyId,
                providerName: rawProv.name,
                planId: plan.planId,
                planName: plan.name,
                tier: plan.tier,
                monthlyPremium: plan.monthlyPremium,
                annualPremium: plan.annualPremium,
                deductible: plan.deductible,
                copay: plan.copay,
                networkType: plan.networkType,
                benefits: plan.benefits,
                maxCoverage: plan.maxCoverage,
              });
            }
          }
        }

        return NextResponse.json({ success: true, plans });
      }

      /* ── Providers ──────────────────────────────────────────────── */
      if (action === 'list-providers') {
        const rawProviders = await db.collection('cvision_insurance_providers')
          .find({ tenantId }).sort({ name: 1 }).limit(500).toArray() as CVisionInsuranceProvider[];
        // Unpack contactInfo JSON fields so callers see providerId, plans, etc. at top level
        const providers = rawProviders.map((p) => {
          let ci: any = {};
          try {
            ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {};
          } catch {
            logger.error('[Insurance list-providers] Failed to parse contactInfo for provider', p.id, typeof p.contactInfo);
          }
          // Fallback: if contactInfo has no plans, match by name from SEED_PROVIDERS constant
          let plans = ci.plans || p.plans || [];
          if (plans.length === 0) {
            const match = SEED_PROVIDERS.find((sp) => sp.name === p.name);
            if (match) plans = match.plans || [];
          }
          return {
            ...p,
            providerId: ci.providerId || p.id,
            type: ci.type || (p as any).type,
            contactPerson: ci.contactPerson,
            contactEmail: ci.contactEmail,
            contactPhone: ci.contactPhone,
            website: ci.website,
            plans,
            status: ci.status || (p.isActive ? 'ACTIVE' : 'INACTIVE'),
          };
        });
        return NextResponse.json({ success: true, providers });
      }

      if (action === 'provider-detail') {
        const providerId = searchParams.get('providerId');
        if (!providerId) return NextResponse.json({ success: false, error: 'Missing providerId' }, { status: 400 });
        // Provider ID is stored as the PG 'id' column; also check contactInfo.providerId
        let provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: providerId }) as CVisionInsuranceProvider | null;
        if (!provider) {
          // Fallback: search all providers and match contactInfo.providerId
          const all = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
          provider = all.find((p) => {
            const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
            return ci.providerId === providerId;
          }) || null;
        }
        if (!provider) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        // Unpack contactInfo
        const ci = (typeof provider.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider.contactInfo) || {} as Record<string, unknown>;
        const enriched = { ...provider, providerId: ci.providerId || provider.id, plans: ci.plans || provider.plans || [], type: ci.type, status: ci.status || (provider.isActive ? 'ACTIVE' : 'INACTIVE') };
        return NextResponse.json({ success: true, provider: enriched });
      }

      if (action === 'provider-plans') {
        const providerId = searchParams.get('providerId');
        if (!providerId) return NextResponse.json({ success: false, error: 'Missing providerId' }, { status: 400 });
        let provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: providerId }) as CVisionInsuranceProvider | null;
        if (!provider) {
          const all = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
          provider = all.find((p) => {
            const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
            return ci.providerId === providerId;
          }) || null;
        }
        const ci = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
        return NextResponse.json({ success: true, plans: ci.plans || provider?.plans || [] });
      }

      /* ── Policies ───────────────────────────────────────────────── */
      if (action === 'list-policies') {
        const policies = await db.collection('cvision_insurance_policies')
          .find({ tenantId }).sort({ startDate: -1 }).limit(500).toArray();
        return NextResponse.json({ success: true, policies });
      }

      if (action === 'policy-detail') {
        const policyId = searchParams.get('policyId');
        if (!policyId) return NextResponse.json({ success: false, error: 'Missing policyId' }, { status: 400 });
        const policy = await db.collection('cvision_insurance_policies').findOne({ tenantId, policyId });
        if (!policy) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true, policy });
      }

      /* ── Employee Insurance ─────────────────────────────────────── */
      if (action === 'employee-insurance') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId });
        return NextResponse.json({ success: true, insurance });
      }

      if (action === 'list-insured') {
        const enrollments = await db.collection('cvision_employee_insurances')
          .find({ tenantId }).sort({ enrollmentDate: -1 }).limit(5000).toArray() as CVisionEmployeeInsurance[];
        const empIds = enrollments.map((e) => e.employeeId).filter(Boolean);
        // Employee documents use 'id' (UUID) not 'employeeId'
        const employees = await db.collection('cvision_employees')
          .find({ tenantId, id: { $in: empIds }, deletedAt: null })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1, jobTitleId: 1 })
          .toArray() as EmployeeProjection[];
        // Resolve department names
        const deptIds = [...new Set(employees.map((e) => e.departmentId).filter(Boolean))] as string[];
        const deptDocs = deptIds.length > 0
          ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray() as Pick<CVisionDepartment, 'id' | 'name'>[]
          : [];
        const deptMap = new Map(deptDocs.map((d) => [d.id, d.name]));
        const empMap = new Map(employees.map((e) => [e.id, {
          employeeId: e.id,
          fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.id,
          department: deptMap.get(e.departmentId || '') || '',
        }]));
        const enriched = enrollments.map((e) => ({ ...e, employee: empMap.get(e.employeeId) || null }));
        return NextResponse.json({ success: true, insured: enriched, total: enriched.length });
      }

      if (action === 'uninsured') {
        // Insurance enrollments store employee reference as 'employeeId' (mapped from employee.id)
        const insuredIds = await db.collection('cvision_employee_insurances')
          .find({ tenantId, status: 'ACTIVE' }).project({ employeeId: 1 }).limit(5000).toArray() as Pick<CVisionEmployeeInsurance, 'employeeId'>[];
        const insuredSet = new Set(insuredIds.map((i) => i.employeeId));
        const allActive = await db.collection('cvision_employees')
          .find({ tenantId, status: { $in: ['ACTIVE', 'Active', 'active', 'PROBATION', 'probation'] }, isArchived: { $ne: true }, deletedAt: null })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1, jobTitleId: 1, hireDate: 1 })
          .toArray() as EmployeeProjection[];
        // Filter out already insured (insurance stores employee.id as employeeId)
        const uninsuredRaw = allActive.filter((e) => e.id && !insuredSet.has(e.id));
        // Resolve department names
        const deptIds = [...new Set(uninsuredRaw.map((e) => e.departmentId).filter(Boolean))] as string[];
        const deptDocs = deptIds.length > 0
          ? await db.collection('cvision_departments').find({ tenantId, id: { $in: deptIds } }).project({ id: 1, name: 1 }).toArray() as Pick<CVisionDepartment, 'id' | 'name'>[]
          : [];
        const deptMap = new Map(deptDocs.map((d) => [d.id, d.name]));
        const uninsured = uninsuredRaw.map((e) => ({
          employeeId: e.id,
          fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.id,
          department: deptMap.get(e.departmentId || '') || '',
        }));
        return NextResponse.json({ success: true, uninsured, total: uninsured.length });
      }

      if (action === 'search-member') {
        const q = searchParams.get('q') || '';
        if (!q) return NextResponse.json({ success: false, error: 'Missing q' }, { status: 400 });
        const enrollment = await db.collection('cvision_employee_insurances').findOne({
          tenantId, $or: [{ membershipNumber: q }, { cardNumber: q }],
        });
        if (!enrollment) return NextResponse.json({ success: true, enrollment: null });
        const typedEnrollment = enrollment as CVisionEmployeeInsurance;
        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: typedEnrollment.employeeId });
        return NextResponse.json({ success: true, enrollment, employee });
      }

      /* ── Dependents ─────────────────────────────────────────────── */
      if (action === 'employee-dependents') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId }) as CVisionEmployeeInsurance | null;
        return NextResponse.json({ success: true, dependents: insurance?.dependents || [] });
      }

      /* ── Claims ─────────────────────────────────────────────────── */
      if (action === 'list-claims') {
        const filter: any = { tenantId };
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const employeeId = searchParams.get('employeeId');
        if (status && status !== 'ALL') filter.status = status;
        if (type && type !== 'ALL') filter.type = type;
        if (employeeId) filter.employeeId = employeeId;
        const claims = await db.collection('cvision_insurance_claims')
          .find(filter).sort({ submittedDate: -1 }).limit(500).toArray();
        return NextResponse.json({ success: true, claims, total: claims.length });
      }

      if (action === 'claim-detail') {
        const claimId = searchParams.get('claimId');
        if (!claimId) return NextResponse.json({ success: false, error: 'Missing claimId' }, { status: 400 });
        const claim = await db.collection('cvision_insurance_claims').findOne({ tenantId, claimId });
        return NextResponse.json({ success: true, claim });
      }

      if (action === 'employee-claims') {
        const employeeId = searchParams.get('employeeId');
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
        const claims = await db.collection('cvision_insurance_claims')
          .find({ tenantId, employeeId }).sort({ claimDate: -1 }).limit(100).toArray();
        // Enrich with claimId (from claimNumber via COLUMN_ALIAS) and fields from attachments JSON
        const enriched = (claims as (CVisionInsuranceClaim & any)[]).map((c) => {
          const att = (typeof c.attachments === 'string' ? JSON.parse(c.attachments) : c.attachments) || {} as Record<string, unknown>;
          return {
            ...c,
            claimId: c.claimNumber || c.claimId,
            type: att.type || c.type || '',
            provider: att.provider || c.provider || '',
            diagnosis: att.diagnosis || c.diagnosis || '',
            receiptNumber: att.receiptNumber || c.receiptNumber || '',
            employeeName: att.employeeName || c.employeeName || '',
          };
        });
        return NextResponse.json({ success: true, claims: enriched });
      }

      /* ── Requests ───────────────────────────────────────────────── */
      if (action === 'list-requests') {
        const status = searchParams.get('status');
        const filter: any = { tenantId };
        if (status && status !== 'ALL') filter.status = status;
        const requests = await db.collection('cvision_insurance_requests')
          .find(filter).sort({ submittedAt: -1 }).limit(500).toArray() as CVisionInsuranceRequest[];

        const empIds = [...new Set(requests.map((r) => r.employeeId).filter(Boolean))];
        // Look up employees by UUID 'id' field
        const employees = await db.collection('cvision_employees')
          .find({ tenantId, id: { $in: empIds }, deletedAt: null })
          .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1 })
          .toArray();
        const empMap = new Map<string, { employeeId: string; fullName: string; departmentId?: string; department?: string }>();
        for (const e of employees as EmployeeProjection[]) {
          empMap.set(e.id, {
            employeeId: e.id,
            fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.id,
            departmentId: e.departmentId,
          });
        }
        // For unmatched IDs (e.g. seed data using MongoDB _id), try _id lookup
        const unmatchedIds = empIds.filter(id => !empMap.has(id));
        if (unmatchedIds.length > 0) {
          const { ObjectId } = await import('mongodb');
          const objectIds = unmatchedIds.filter(id => /^[a-f0-9]{24}$/.test(id)).map(id => new ObjectId(id));
          if (objectIds.length > 0) {
            const byOid = await db.collection('cvision_employees')
              .find({ tenantId, _id: { $in: objectIds } })
              .project({ id: 1, firstName: 1, lastName: 1, departmentId: 1 })
              .toArray();
            for (const e of byOid) {
              empMap.set(e._id.toString(), {
                employeeId: e.id || e._id.toString(),
                fullName: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e._id.toString(),
                departmentId: e.departmentId,
              });
            }
          }
        }
        // Resolve department names
        const allDeptIds = [...new Set(Array.from(empMap.values()).map((e) => e.departmentId).filter(Boolean))] as string[];
        const reqDeptDocs = allDeptIds.length > 0
          ? await db.collection('cvision_departments').find({ tenantId, id: { $in: allDeptIds } }).project({ id: 1, name: 1 }).toArray() as Pick<CVisionDepartment, 'id' | 'name'>[]
          : [];
        const reqDeptMap = new Map(reqDeptDocs.map((d) => [d.id, d.name] as [string, string]));
        for (const [, emp] of empMap) {
          emp.department = reqDeptMap.get(emp.departmentId || '') || '';
        }

        const enriched = requests.map((r) => ({
          ...r,
          employeeName: empMap.get(r.employeeId)?.fullName || (r as CVisionInsuranceRequest & any).employeeName || r.employeeId,
          employee: empMap.get(r.employeeId) || null,
        }));

        return NextResponse.json({ success: true, requests: enriched });
      }

      if (action === 'request-detail') {
        const requestId = searchParams.get('requestId');
        if (!requestId) return NextResponse.json({ success: false, error: 'Missing requestId' }, { status: 400 });
        const req = await db.collection('cvision_insurance_requests').findOne({ tenantId, requestId });
        return NextResponse.json({ success: true, request: req });
      }

      /* ── Analytics ──────────────────────────────────────────────── */
      if (action === 'insurance-summary') {
        const summary = await getInsuranceSummary(db, tenantId);
        return NextResponse.json({ success: true, summary });
      }

      if (action === 'cost-report') {
        const report = await getCostReport(db, tenantId);
        return NextResponse.json({ success: true, report });
      }

      if (action === 'claims-analytics') {
        const analytics = await getClaimsAnalytics(db, tenantId);
        return NextResponse.json({ success: true, analytics });
      }

      if (action === 'expiring-policies') {
        const days = parseInt(searchParams.get('days') || '90');
        const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const expiring = await db.collection('cvision_insurance_policies').find({
          tenantId, status: 'ACTIVE', endDate: { $lte: cutoff, $gte: new Date() },
        }).toArray();
        return NextResponse.json({ success: true, expiring });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[insurance GET]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.insurance.read' },
);

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;
      const db = await getCVisionDb(tenantId);

      if (action === 'enroll-employee') {
        const { employeeId, providerId, planId, policyId, tier, effectiveDate } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });

        const existing = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' });
        if (existing) return NextResponse.json({ success: false, error: 'Employee already enrolled' }, { status: 400 });

        let resolvedPolicyId = policyId;
        let provider: CVisionInsuranceProvider | null = null;
        let plan: CVisionInsurancePlan | null = null;

        if (providerId && planId) {
          // Provider ID is stored as PG 'id' column
          provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: providerId }) as CVisionInsuranceProvider | null;
          if (!provider) {
            const allProv = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
            provider = allProv.find((p) => {
              const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
              return ci.providerId === providerId;
            }) || null;
          }
          const provCi = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
          let plansList: CVisionInsurancePlan[] = provCi.plans || provider?.plans || [];
          // Fallback: if contactInfo has no plans, match by provider name from SEED_PROVIDERS
          if (plansList.length === 0 && provider?.name) {
            const seedMatch = SEED_PROVIDERS.find((sp) => sp.name === provider!.name);
            if (seedMatch) plansList = seedMatch.plans || [];
          }
          plan = plansList.find((p) => p.planId === planId) || null;

          // Look for an existing active policy matching this provider
          const existingPolicy = await db.collection('cvision_insurance_policies').findOne({
            tenantId, providerId, isActive: true,
          });

          const typedExistingPolicy = existingPolicy as CVisionInsurancePolicy | null;
          if (typedExistingPolicy) {
            // policyId alias maps to policyNumber column
            resolvedPolicyId = typedExistingPolicy.policyNumber || typedExistingPolicy.policyId;
          } else {
            resolvedPolicyId = `POL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
            // PG schema: id, tenantId, providerId, policyNumber, name, type, coverageDetails, ...
            await db.collection('cvision_insurance_policies').insertOne({
              tenantId,
              providerId,
              policyNumber: resolvedPolicyId, // serves as policyId via COLUMN_ALIAS
              name: plan?.name || '',
              type: 'medical',
              startDate: new Date(effectiveDate || new Date()),
              endDate: new Date(`${new Date().getFullYear()}-12-31`),
              isActive: true,
              coverageDetails: {
                providerName: provider?.name || '',
                planId,
                planName: plan?.name || '',
                status: 'ACTIVE',
                enrolledCount: 0,
                maxEnrolled: 100,
                annualCost: 0,
              },
              createdAt: new Date(),
            });
          }
        } else if (resolvedPolicyId) {
          // policyId -> policyNumber via COLUMN_ALIAS
          const policy = await db.collection('cvision_insurance_policies').findOne({ tenantId, policyId: resolvedPolicyId }) as CVisionInsurancePolicy | null;
          if (policy) {
            // Look up provider by UUID id
            const provId = policy.providerId;
            provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: provId }) as CVisionInsuranceProvider | null;
            const ci = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
            let policyPlans: CVisionInsurancePlan[] = ci.plans || provider?.plans || [];
            if (policyPlans.length === 0 && provider?.name) {
              const seedMatch = SEED_PROVIDERS.find((sp) => sp.name === provider!.name);
              if (seedMatch) policyPlans = seedMatch.plans || [];
            }
            plan = policyPlans.find((p) => p.planId === policy.planId) || null;
          }
        }

        if (!plan) return NextResponse.json({ success: false, error: 'Could not resolve insurance plan' }, { status: 400 });

        const count = await db.collection('cvision_employee_insurances').countDocuments({ tenantId });
        const num = String(count + 1).padStart(4, '0');
        const provPrefix = provider?.name?.split(' ')[0]?.toUpperCase() || 'INS';

        const employerPct = 0.75;
        const premium = plan.monthlyPremium || 0;

        // PG schema: id, tenantId, employeeId, policyId, enrollmentDate, membershipNumber,
        //            dependents (Json), status, createdAt, updatedAt, createdBy, updatedBy
        // Pack non-column fields (cardNumber, tier, premium, etc.) into dependents JSON metadata.
        await db.collection('cvision_employee_insurances').insertOne({
          tenantId, employeeId, policyId: resolvedPolicyId,
          membershipNumber: `MEM-${num}`,
          enrollmentDate: new Date(effectiveDate || new Date()),
          status: 'ACTIVE',
          dependents: {
            list: [],
            metadata: {
              cardNumber: `${provPrefix}-${num}`,
              expiryDate: `${new Date().getFullYear()}-12-31`,
              tier: tier || plan.tier || 'STANDARD',
              monthlyPremium: premium,
              employerContribution: Math.round(premium * employerPct),
              employeeContribution: Math.round(premium * (1 - employerPct)),
            },
          },
          createdAt: new Date(),
        });

        if (resolvedPolicyId) {
          await db.collection('cvision_insurance_policies').updateOne(
            { tenantId, policyId: resolvedPolicyId },
            { $inc: { enrolledCount: 1, annualCost: (plan.annualPremium || premium * 12) } },
          );
        }

        return NextResponse.json({ success: true });
      }

      if (action === 'add-dependent') {
        const { employeeId, dependent } = body;
        if (!employeeId || !dependent?.name || !dependent?.relationship)
          return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' }) as CVisionEmployeeInsurance | null;
        if (!insurance) return NextResponse.json({ success: false, error: 'No active insurance' }, { status: 400 });

        const existingDeps = (insurance.dependents || []).filter((d: InsuranceDependent) => d.status === 'ACTIVE');
        if (dependent.relationship === 'SPOUSE') {
          const spouseCount = existingDeps.filter((d: InsuranceDependent) => d.relationship === 'SPOUSE').length;
          if (spouseCount >= 1) return NextResponse.json({ success: false, error: 'Only 1 spouse allowed' }, { status: 400 });
        }
        if (dependent.relationship === 'CHILD') {
          const childCount = existingDeps.filter((d: InsuranceDependent) => d.relationship === 'CHILD').length;
          if (childCount >= 4) return NextResponse.json({ success: false, error: 'Maximum 4 children allowed' }, { status: 400 });
        }
        if (dependent.relationship === 'PARENT') {
          const parentCount = existingDeps.filter((d: InsuranceDependent) => d.relationship === 'PARENT').length;
          if (parentCount >= 2) return NextResponse.json({ success: false, error: 'Maximum 2 parents allowed' }, { status: 400 });
        }

        const dep = {
          dependentId: `DEP-${Date.now()}`,
          name: dependent.name,
          nameAr: dependent.nameAr || '',
          relationship: dependent.relationship,
          dateOfBirth: dependent.dateOfBirth || '',
          nationalId: dependent.nationalId || '',
          gender: dependent.gender || '',
          membershipNumber: `DEP-MEM-${Date.now()}`,
          status: 'ACTIVE',
          addedAt: new Date(),
        };

        const depPremium = Math.round(insurance.monthlyPremium * 0.38);

        await db.collection('cvision_employee_insurances').updateOne(
          { tenantId, employeeId, status: 'ACTIVE' },
          {
            $push: { dependents: dep } as Record<string, unknown>,
            $inc: { monthlyPremium: depPremium, employerContribution: Math.round(depPremium * 0.75), employeeContribution: Math.round(depPremium * 0.25) },
          },
        );

        return NextResponse.json({ success: true, dependent: dep });
      }

      if (action === 'remove-dependent') {
        const { employeeId, dependentId } = body;
        if (!employeeId || !dependentId) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' }) as CVisionEmployeeInsurance | null;
        if (!insurance) return NextResponse.json({ success: false, error: 'No active insurance' }, { status: 400 });

        const depPremium = Math.round(insurance.monthlyPremium * 0.38 / Math.max(1, (insurance.dependents || []).filter((d: InsuranceDependent) => d.status === 'ACTIVE').length));

        await db.collection('cvision_employee_insurances').updateOne(
          { tenantId, employeeId, status: 'ACTIVE', 'dependents.dependentId': dependentId },
          {
            $set: { 'dependents.$.status': 'REMOVED', 'dependents.$.removedAt': new Date() },
            $inc: { monthlyPremium: -depPremium, employerContribution: -Math.round(depPremium * 0.75), employeeContribution: -Math.round(depPremium * 0.25) },
          },
        );
        return NextResponse.json({ success: true });
      }

      if (action === 'change-class') {
        const { employeeId, newPlanId, newProviderId, reason } = body;
        if (!employeeId || !newPlanId) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' }) as CVisionEmployeeInsurance | null;
        if (!insurance) return NextResponse.json({ success: false, error: 'No active insurance' }, { status: 400 });

        // Resolve provider: newProviderId or derive from current enrollment's policy
        let resolveProvId = newProviderId;
        if (!resolveProvId && insurance.policyId) {
          const curPolicy = await db.collection('cvision_insurance_policies').findOne({ tenantId, policyId: insurance.policyId }) as CVisionInsurancePolicy | null;
          resolveProvId = curPolicy?.providerId;
        }
        // Provider ID is stored as PG 'id' column; fallback to contactInfo.providerId
        let provider: CVisionInsuranceProvider | null = resolveProvId ? await db.collection('cvision_insurance_providers').findOne({ tenantId, id: resolveProvId }) as CVisionInsuranceProvider | null : null;
        if (!provider && resolveProvId) {
          const allProvs = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
          provider = allProvs.find((p) => {
            const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
            return ci.providerId === resolveProvId;
          }) || null;
        }
        const provCi = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
        const provPlans: CVisionInsurancePlan[] = provCi.plans || provider?.plans || [];
        const newPlan = provPlans.find((p) => p.planId === newPlanId);
        if (!newPlan) return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 400 });

        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
        const requestId = `REQ-INS-${Date.now().toString().slice(-6)}`;

        await db.collection('cvision_insurance_requests').insertOne({
          tenantId, requestId, employeeId,
          employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : '',
          type: 'UPGRADE',
          details: {
            currentTier: insurance.tier,
            currentPremium: insurance.monthlyPremium,
            newTier: newPlan.tier,
            newPlanId: newPlan.planId,
            newPlanName: newPlan.name,
            newPremium: newPlan.monthlyPremium,
            reason: reason || '',
          },
          status: 'PENDING',
          submittedAt: new Date(),
          submittedBy: userId,
        });

        return NextResponse.json({ success: true, requestId });
      }

      if (action === 'cancel-insurance') {
        const { employeeId, reason } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });

        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' }) as CVisionEmployeeInsurance | null;
        if (!insurance) return NextResponse.json({ success: false, error: 'No active insurance' }, { status: 400 });

        // For cancellation, directly update the enrollment status (no approval workflow needed for simulator)
        await db.collection('cvision_employee_insurances').updateOne(
          { tenantId, employeeId, status: 'ACTIVE' },
          { $set: { status: 'CANCELLED' } },
        );

        return NextResponse.json({ success: true, requestId: `REQ-INS-${Date.now().toString().slice(-6)}` });
      }

      if (action === 'replace-card') {
        const { employeeId, reason } = body;
        if (!employeeId) return NextResponse.json({ success: false, error: 'Missing employeeId' }, { status: 400 });

        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
        const requestId = `REQ-INS-${Date.now().toString().slice(-6)}`;

        await db.collection('cvision_insurance_requests').insertOne({
          tenantId, requestId, employeeId,
          employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : '',
          type: 'CARD_REPLACEMENT',
          details: { reason: reason || 'Lost/Damaged' },
          status: 'PENDING',
          submittedAt: new Date(),
          submittedBy: userId,
        });

        return NextResponse.json({ success: true, requestId });
      }

      if (action === 'submit-claim') {
        const { employeeId, type, provider: claimProvider, diagnosis, amount, receiptNumber } = body;
        if (!employeeId || !type || !amount) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const insurance = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId, status: 'ACTIVE' }) as CVisionEmployeeInsurance | null;
        if (!insurance) return NextResponse.json({ success: false, error: 'No active insurance' }, { status: 400 });

        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId }) as CVisionEmployee | null;
        const claimId = `CLM-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

        // PG schema: id, tenantId, employeeId, policyId, claimNumber, claimDate, amount,
        //            description, status, attachments (Json), approvedAmount
        // Non-PG fields go into attachments JSON
        await db.collection('cvision_insurance_claims').insertOne({
          tenantId, claimId, employeeId,
          policyId: insurance.policyId,
          claimDate: new Date(),
          amount: parseFloat(amount),
          description: diagnosis || type || '',
          approvedAmount: 0,
          status: 'SUBMITTED',
          attachments: {
            employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : '',
            membershipNumber: insurance.membershipNumber,
            type, provider: claimProvider || '', diagnosis: diagnosis || '',
            submittedDate: new Date().toISOString(),
            receiptNumber: receiptNumber || '', notes: '',
          },
          createdAt: new Date(),
        });

        return NextResponse.json({ success: true, claimId });
      }

      if (action === 'process-claim') {
        const { claimId, status, approvedAmount, rejectionReason } = body;
        if (!claimId || !status) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const update: any = { status, processedDate: new Date(), processedBy: userId };
        if (approvedAmount !== undefined) update.approvedAmount = parseFloat(approvedAmount);
        if (rejectionReason) update.rejectionReason = rejectionReason;

        await db.collection('cvision_insurance_claims').updateOne(
          { tenantId, claimId }, { $set: update },
        );
        return NextResponse.json({ success: true });
      }

      if (action === 'submit-request') {
        const { employeeId, type, details } = body;
        if (!employeeId || !type) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const employee = await db.collection('cvision_employees').findOne({ tenantId, id: employeeId });
        const requestId = `REQ-INS-${Date.now().toString().slice(-6)}`;

        await db.collection('cvision_insurance_requests').insertOne({
          tenantId, requestId, employeeId,
          employeeName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : '',
          type, details: details || {}, status: 'PENDING', submittedAt: new Date(),
        });

        return NextResponse.json({ success: true, requestId });
      }

      if (action === 'process-request') {
        const { requestId, status, notes } = body;
        if (!requestId || !status) return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });

        const req = await db.collection('cvision_insurance_requests').findOne({ tenantId, requestId });

        await db.collection('cvision_insurance_requests').updateOne(
          { tenantId, requestId },
          { $set: { status, processedAt: new Date(), processedBy: userId, notes: notes || '' } },
        );

        if (status === 'APPROVED' && req) {
          const r = req as CVisionInsuranceRequest & any;
          if (r.type === 'UPGRADE' && r.details?.newPlanId) {
            // Search all providers for the plan (plans stored in contactInfo JSON)
            const allProvs = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
            let newPlan: CVisionInsurancePlan | null = null;
            for (const prov of allProvs) {
              const ci = (typeof prov.contactInfo === 'string' ? JSON.parse(prov.contactInfo as string) : prov.contactInfo) || {} as Record<string, unknown>;
              const plans: CVisionInsurancePlan[] = ci.plans || prov.plans || [];
              newPlan = plans.find((p) => p.planId === r.details.newPlanId) || null;
              if (newPlan) break;
            }
            if (newPlan) {
              // PG enrollment: pack premium/tier into dependents JSON metadata
              const curIns = await db.collection('cvision_employee_insurances').findOne({ tenantId, employeeId: r.employeeId, status: 'ACTIVE' });
              const curDeps = (typeof curIns?.dependents === 'string' ? JSON.parse(curIns.dependents) : curIns?.dependents) || {};
              const meta = curDeps.metadata || {};
              await db.collection('cvision_employee_insurances').updateOne(
                { tenantId, employeeId: r.employeeId, status: 'ACTIVE' },
                {
                  $set: {
                    dependents: {
                      ...curDeps,
                      metadata: {
                        ...meta,
                        tier: newPlan.tier,
                        monthlyPremium: newPlan.monthlyPremium,
                        employerContribution: Math.round(newPlan.monthlyPremium * 0.75),
                        employeeContribution: Math.round(newPlan.monthlyPremium * 0.25),
                      },
                    },
                  },
                },
              );
            }
          }
          if (r.type === 'CANCELLATION') {
            await db.collection('cvision_employee_insurances').updateOne(
              { tenantId, employeeId: r.employeeId, status: 'ACTIVE' },
              { $set: { status: 'CANCELLED', cancelledAt: new Date() } },
            );
          }
        }

        return NextResponse.json({ success: true });
      }

      if (action === 'create-policy') {
        const { providerId, planId, policyNumber, startDate, endDate, maxEnrolled } = body;
        if (!providerId || !planId || !policyNumber || !startDate || !endDate) {
          return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
        }

        // Provider ID is stored as PG 'id' column; fallback to contactInfo.providerId search
        let provider = await db.collection('cvision_insurance_providers').findOne({ tenantId, id: providerId }) as CVisionInsuranceProvider | null;
        if (!provider) {
          const all = await db.collection('cvision_insurance_providers').find({ tenantId }).limit(500).toArray() as CVisionInsuranceProvider[];
          provider = all.find((p) => {
            const ci = (typeof p.contactInfo === 'string' ? JSON.parse(p.contactInfo as string) : p.contactInfo) || {} as Record<string, unknown>;
            return ci.providerId === providerId;
          }) || null;
        }
        const provCI = (typeof provider?.contactInfo === 'string' ? JSON.parse(provider.contactInfo as string) : provider?.contactInfo) || {} as Record<string, unknown>;
        const plan = (provCI.plans || provider?.plans || []).find((p: CVisionInsurancePlan) => p.planId === planId);
        const policyId = `POL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

        // PG schema: id, tenantId, providerId, policyNumber, name, type, coverageDetails (Json),
        //            premium, startDate, endDate, isActive, createdAt, updatedAt
        await db.collection('cvision_insurance_policies').insertOne({
          tenantId,
          providerId,
          policyNumber,
          name: plan?.name || '',
          type: 'medical',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: true,
          coverageDetails: {
            policyId,
            providerName: provider?.name || '',
            planId,
            planName: plan?.name || '',
            status: 'ACTIVE',
            enrolledCount: 0,
            maxEnrolled: maxEnrolled || 100,
            annualCost: 0,
          },
          createdAt: new Date(),
        });

        return NextResponse.json({ success: true, policyId });
      }

      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    } catch (err: any) {
      logger.error('[insurance POST]', err);
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  },
);
