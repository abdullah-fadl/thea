import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Skills Matrix API
 * GET  /api/cvision/ai/skills  - Search skills, department summaries, org reports, defaults
 * POST /api/cvision/ai/skills  - Extract from CV, assess gaps, update skills, bulk assess
 *
 * Wires the skills-matrix engine (lib/cvision/ai/skills-matrix.ts) to the
 * database and integrates AI governance decision logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionEmployee,
  CVisionJobTitle,
  CVisionCandidate,
  CVisionCvParseJob,
} from '@/lib/cvision/types';
import {
  extractSkillsFromCV,
  assessSkillGaps,
  buildDepartmentSummary,
  findEmployeesWithSkill,
  generateSkillsReport,
  DEFAULT_SKILLS,
  PROFICIENCY_LABELS,
  type EmployeeSkillProfile,
  type EmployeeSkill,
} from '@/lib/cvision/ai/skills-matrix';
import {
  createDecisionLog,
  DEFAULT_GOVERNANCE_CONFIG,
  type GovernanceConfig,
} from '@/lib/cvision/ai/ai-governance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds an EmployeeSkillProfile from a CVisionEmployee document.
 * Skills are read from employee.metadata?.skills (flexible schema).
 */
function buildEmployeeSkillProfile(
  employee: any,
  deptName?: string,
  jtName?: string
): EmployeeSkillProfile {
  const rawSkills: any[] = employee.metadata?.skills || [];

  const skills: EmployeeSkill[] = rawSkills.map((s: any) => ({
    skillId: s.skillId || s.id || s.skillName || '',
    skillName: s.skillName || s.name || '',
    proficiencyLevel: Math.min(5, Math.max(1, s.proficiencyLevel || s.level || 1)) as 1 | 2 | 3 | 4 | 5,
    selfAssessed: s.selfAssessed ?? true,
    verifiedBy: s.verifiedBy,
    verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : undefined,
    source: s.source || 'SELF_ASSESSMENT',
    lastUpdated: s.lastUpdated ? new Date(s.lastUpdated) : new Date(),
  }));

  return {
    employeeId: employee.id,
    employeeName:
      employee.fullName ||
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
      'Unknown',
    department: deptName || employee.departmentId || '',
    jobTitle: jtName || employee.jobTitleId || '',
    skills,
    lastAssessmentDate: employee.metadata?.lastSkillAssessment
      ? new Date(employee.metadata.lastSkillAssessment)
      : undefined,
  };
}

/**
 * Creates a GovernanceConfig from defaults for decision logging.
 */
function buildGovernanceConfig(tenantId: string, userId: string): GovernanceConfig {
  return {
    ...DEFAULT_GOVERNANCE_CONFIG,
    tenantId,
    updatedAt: new Date(),
    updatedBy: userId,
  };
}

/**
 * Generates a simple unique ID for decision logs.
 */
function generateSimpleId(): string {
  return `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parses a job title requirements array (string[]) into
 * { skillName, requiredLevel }[] format for gap analysis.
 * Each requirement string becomes a skill with default level 3 (Intermediate).
 */
function parseRequirementsToSkills(
  requirements: string[]
): { skillName: string; requiredLevel: number }[] {
  return requirements
    .filter((r) => r && r.trim().length > 0)
    .map((r) => ({ skillName: r.trim(), requiredLevel: 3 }));
}

// ─── Auto-seed skills onto employee documents ──────────────────────────────

const JOB_TITLE_SKILLS: Record<string, { name: string; level: number }[]> = {
  'data analyst': [
    { name: 'Python', level: 3 }, { name: 'SQL', level: 4 }, { name: 'Excel', level: 4 },
    { name: 'Data Visualization', level: 3 }, { name: 'Statistics', level: 3 }, { name: 'Power BI', level: 2 },
  ],
  'registered nurse': [
    { name: 'Patient Care', level: 4 }, { name: 'Clinical Assessment', level: 3 },
    { name: 'BLS/CPR', level: 4 }, { name: 'Medication Administration', level: 3 }, { name: 'Communication', level: 4 },
  ],
  nurse: [
    { name: 'Patient Care', level: 3 }, { name: 'Clinical Assessment', level: 3 },
    { name: 'BLS/CPR', level: 3 }, { name: 'Communication', level: 3 },
  ],
  'software engineer': [
    { name: 'JavaScript', level: 4 }, { name: 'Python', level: 3 }, { name: 'Git', level: 4 },
    { name: 'APIs', level: 3 }, { name: 'Database Design', level: 3 },
  ],
  developer: [
    { name: 'JavaScript', level: 3 }, { name: 'HTML/CSS', level: 4 }, { name: 'React', level: 3 },
    { name: 'Node.js', level: 3 }, { name: 'Git', level: 3 },
  ],
  'hr manager': [
    { name: 'Recruitment', level: 4 }, { name: 'Employee Relations', level: 4 },
    { name: 'Saudi Labor Law', level: 3 }, { name: 'HRIS', level: 3 }, { name: 'Performance Management', level: 3 },
  ],
  'hr assistant': [
    { name: 'Recruitment Support', level: 2 }, { name: 'Data Entry', level: 3 },
    { name: 'Communication', level: 3 }, { name: 'Excel', level: 3 },
  ],
  accountant: [
    { name: 'Accounting', level: 4 }, { name: 'Excel', level: 4 },
    { name: 'Financial Reporting', level: 3 }, { name: 'VAT/ZATCA', level: 3 },
  ],
  manager: [
    { name: 'Leadership', level: 3 }, { name: 'Team Management', level: 3 },
    { name: 'Strategic Planning', level: 2 }, { name: 'Communication', level: 4 },
  ],
  pharmacist: [
    { name: 'Pharmacology', level: 4 }, { name: 'Patient Counseling', level: 3 },
    { name: 'Medication Safety', level: 4 }, { name: 'Inventory Management', level: 3 },
  ],
  'lab technician': [
    { name: 'Lab Procedures', level: 4 }, { name: 'Quality Control', level: 3 },
    { name: 'Safety Protocols', level: 3 }, { name: 'Documentation', level: 3 },
  ],
  receptionist: [
    { name: 'Customer Service', level: 4 }, { name: 'MS Office', level: 3 },
    { name: 'Communication', level: 4 }, { name: 'Scheduling', level: 3 },
  ],
};

const DEPARTMENT_SKILLS: Record<string, { name: string; level: number }[]> = {
  nursing: [{ name: 'Teamwork', level: 3 }, { name: 'Time Management', level: 3 }],
  it: [{ name: 'Technical Support', level: 3 }, { name: 'Problem Solving', level: 3 }],
  hr: [{ name: 'Confidentiality', level: 4 }, { name: 'Organization', level: 3 }],
  finance: [{ name: 'Attention to Detail', level: 4 }],
  admin: [{ name: 'MS Office', level: 3 }, { name: 'Organization', level: 3 }],
  pharmacy: [{ name: 'Attention to Detail', level: 4 }, { name: 'Communication', level: 3 }],
  lab: [{ name: 'Attention to Detail', level: 4 }, { name: 'Teamwork', level: 3 }],
};

async function autoSeedEmployeeSkills(tenantId: string): Promise<number> {
  const db = await getCVisionDb(tenantId);
  const empCol = db.collection('cvision_employees');

  const totalEmps = await empCol.countDocuments({ tenantId });
  if (totalEmps === 0) return 0;

  const withSkills = await empCol.countDocuments({
    tenantId,
    'metadata.skills.0': { $exists: true },
  });
  if (withSkills > 0) return 0;

  // Fetch all non-terminated employees (handle both isActive and status fields)
  const employees = await empCol.find({
    tenantId,
    deletedAt: null,
    isArchived: { $ne: true },
    $or: [
      { isActive: true },
      { status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] } },
    ],
  }).limit(5000).toArray();

  if (employees.length === 0) {
    // Fallback: just get all employees regardless of status
    const allEmps = await empCol.find({ tenantId, deletedAt: null }).limit(50).toArray();
    if (allEmps.length === 0) return 0;
    return seedSkillsForEmployees(db, tenantId, allEmps);
  }

  return seedSkillsForEmployees(db, tenantId, employees);
}

async function seedSkillsForEmployees(db: any, tenantId: string, employees: any[]): Promise<number> {
  const deptCol = db.collection('cvision_departments');
  const departments = await deptCol.find({ tenantId }).limit(500).toArray();
  const deptNameMap = new Map<string, string>();
  for (const d of departments) deptNameMap.set(d.id, (d.name || '').toLowerCase());

  const jtCol = db.collection('cvision_job_titles');
  const jobTitles = await jtCol.find({ tenantId }).limit(500).toArray();
  const jtNameMap = new Map<string, string>();
  for (const jt of jobTitles) jtNameMap.set(jt.id, (jt.name || '').toLowerCase());

  const now = new Date();
  let seeded = 0;
  const empCol = db.collection('cvision_employees');

  for (const emp of employees) {
    const jobTitle = (
      jtNameMap.get(emp.jobTitleId) ||
      emp.jobTitle ||
      emp.sections?.EMPLOYMENT?.data?.jobTitle ||
      ''
    ).toLowerCase().trim();

    const department = (
      deptNameMap.get(emp.departmentId) ||
      emp.departmentName ||
      emp.department ||
      emp.sections?.EMPLOYMENT?.data?.department ||
      ''
    ).toLowerCase().trim();

    let skills: { name: string; level: number }[] = [];

    if (jobTitle) {
      for (const [key, titleSkills] of Object.entries(JOB_TITLE_SKILLS)) {
        if (jobTitle.includes(key) || key.includes(jobTitle)) {
          skills = [...titleSkills];
          break;
        }
      }
    }

    if (department) {
      for (const [key, deptSkills] of Object.entries(DEPARTMENT_SKILLS)) {
        if (department.includes(key)) {
          skills = [...skills, ...deptSkills.filter(ds => !skills.find(s => s.name === ds.name))];
          break;
        }
      }
    }

    if (skills.length === 0) {
      skills = [
        { name: 'Communication', level: 3 },
        { name: 'Teamwork', level: 3 },
        { name: 'Time Management', level: 2 },
        { name: 'Problem Solving', level: 2 },
      ];
    }

    const metadataSkills = skills.map(s => {
      const jitter = Math.random() > 0.5 ? 0 : (Math.random() > 0.5 ? 1 : -1);
      return {
        skillId: `sk-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        skillName: s.name,
        proficiencyLevel: Math.max(1, Math.min(5, s.level + jitter)),
        selfAssessed: false,
        source: 'SYSTEM_GENERATED',
        lastUpdated: now,
      };
    });

    await empCol.updateOne(
      { tenantId, _id: emp._id },
      {
        $set: {
          'metadata.skills': metadataSkills,
          'metadata.lastSkillAssessment': now,
          updatedAt: now,
        },
      },
    );
    seeded++;
  }

  logger.info(`[Skills Auto-Seed] Seeded ${seeded} employees for tenant ${tenantId}`);
  return seeded;
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      // ── action=defaults ────────────────────────────────────────────
      if (action === 'defaults') {
        return NextResponse.json({
          success: true,
          data: {
            skills: DEFAULT_SKILLS,
            proficiencyLabels: PROFICIENCY_LABELS,
          },
        });
      }

      // ── action=search ─────────────────────────────────────────────
      if (action === 'search') {
        await autoSeedEmployeeSkills(tenantId);
        const skill = searchParams.get('skill');
        if (!skill) {
          return NextResponse.json(
            {
              success: false,
              error: 'skill parameter is required',
            },
            { status: 400 }
          );
        }

        const minLevel = parseInt(searchParams.get('minLevel') || '1', 10) || 1;
        const department = searchParams.get('department');

        // Build employee filter
        const empFilter: any = { isActive: true };
        if (department) {
          empFilter.departmentId = department;
        }

        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employees = await empCol
          .find(createTenantFilter(tenantId, empFilter))
          .limit(5000)
          .toArray();

        // Resolve department names for display
        const deptCol = await getCVisionCollection<any>(tenantId, 'departments');
        const depts = await deptCol.find(createTenantFilter(tenantId)).limit(500).toArray();
        const searchDeptMap = new Map<string, string>();
        for (const d of depts) searchDeptMap.set(d.id, d.name || d.id);

        // Build profiles with resolved department names
        const profiles: EmployeeSkillProfile[] = employees.map((e) =>
          buildEmployeeSkillProfile(e, searchDeptMap.get(e.departmentId))
        );

        // Search
        const results = findEmployeesWithSkill(profiles, skill, minLevel);

        return NextResponse.json({
          success: true,
          data: {
            skill,
            minLevel,
            department: department || 'all',
            results,
            totalFound: results.length,
          },
        });
      }

      // ── action=department-summary ─────────────────────────────────
      if (action === 'department-summary') {
        await autoSeedEmployeeSkills(tenantId);
        const department = searchParams.get('department');
        if (!department) {
          return NextResponse.json(
            {
              success: false,
              error: 'department parameter is required',
            },
            { status: 400 }
          );
        }

        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employees = await empCol
          .find(createTenantFilter(tenantId, { departmentId: department, isActive: true }))
          .limit(5000)
          .toArray();

        // Build profiles
        const profiles: EmployeeSkillProfile[] = employees.map((e) =>
          buildEmployeeSkillProfile(e)
        );

        // Optionally fetch job title requirements for this department
        let requiredSkills: { skillName: string; requiredLevel: number }[] | undefined;
        try {
          const jtCol = await getCVisionCollection<CVisionJobTitle>(tenantId, 'jobTitles');
          const jobTitles = await jtCol
            .find(createTenantFilter(tenantId, { departmentId: department, isActive: true }))
            .limit(500)
            .toArray();

          // Collect unique requirements from all job titles in this department
          const allReqs = new Set<string>();
          for (const jt of jobTitles) {
            if (jt.requirements && Array.isArray(jt.requirements)) {
              for (const req of jt.requirements) {
                allReqs.add(req);
              }
            }
          }
          if (allReqs.size > 0) {
            requiredSkills = parseRequirementsToSkills([...allReqs]);
          }
        } catch {
          // Non-critical: proceed without required skills
        }

        const summary = buildDepartmentSummary(profiles, requiredSkills);

        return NextResponse.json({
          success: true,
          data: summary,
        });
      }

      // ── action=organization-report ────────────────────────────────
      if (action === 'organization-report') {
        const seeded = await autoSeedEmployeeSkills(tenantId);
        if (seeded > 0) logger.info(`[Skills API] Auto-seeded skills for ${seeded} employees`);

        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const allEmployees = await empCol
          .find(createTenantFilter(tenantId, { isActive: true }))
          .limit(5000)
          .toArray();

        // Fetch department names for display
        const deptCol = await getCVisionCollection<any>(tenantId, 'departments');
        const departments = await deptCol
          .find(createTenantFilter(tenantId))
          .limit(500)
          .toArray();
        const deptNameMap = new Map<string, string>();
        for (const d of departments) {
          deptNameMap.set(d.id, d.name || d.id);
        }

        // Group employees by department
        const deptGroups = new Map<string, any[]>();
        for (const emp of allEmployees) {
          const deptId = emp.departmentId || 'unassigned';
          const existing = deptGroups.get(deptId) || [];
          existing.push(emp);
          deptGroups.set(deptId, existing);
        }

        // Build department summaries
        const departmentSummaries = [];
        for (const [deptId, emps] of deptGroups) {
          const deptName = deptNameMap.get(deptId) || deptId;
          const profiles = emps.map((e) => buildEmployeeSkillProfile(e, deptName));
          const summary = buildDepartmentSummary(profiles);
          departmentSummaries.push(summary);
        }

        // Generate organization-wide report
        const report = generateSkillsReport(departmentSummaries);

        return NextResponse.json({
          success: true,
          data: {
            ...report,
            departmentCount: departmentSummaries.length,
            totalEmployees: allEmployees.length,
            departmentSummaries,
          },
        });
      }

      // ── Default: API documentation ────────────────────────────────
      return NextResponse.json({
        success: true,
        data: {
          name: 'CVision Skills Matrix API',
          version: '1.0',
          endpoints: {
            GET: {
              'action=defaults':
                'Returns default skill definitions and proficiency labels',
              'action=search&skill=React&minLevel=3&department=dept-id':
                'Find employees with a specific skill (optional: minLevel, department)',
              'action=department-summary&department=dept-id':
                'Skill coverage summary for a department',
              'action=organization-report':
                'Organization-wide skills report across all departments',
            },
            POST: {
              'extract-from-cv':
                'Extract skills from a candidate CV (requires candidateId or cvData)',
              'assess-gaps':
                'Assess skill gaps for an employee (requires employeeId, optional requiredSkills)',
              'update-employee-skill':
                'Update/add a skill to an employee (requires employeeId, skillId, proficiencyLevel)',
              'bulk-assess-department':
                'Assess skill gaps for all employees in a department (requires department)',
            },
          },
        },
      });
    } catch (error: any) {
      logger.error('[Skills API GET]', error?.message || String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      // ── action=extract-from-cv ────────────────────────────────────
      if (action === 'extract-from-cv') {
        const { candidateId, cvData } = body;

        if (!candidateId && !cvData) {
          return NextResponse.json(
            {
              success: false,
              error: 'candidateId or cvData is required',
            },
            { status: 400 }
          );
        }

        let parsedCVData: any = cvData || {};
        let subjectId = candidateId || 'direct-cv';

        // If candidateId provided, fetch from DB
        if (candidateId) {
          const candidatesCol = await getCVisionCollection<CVisionCandidate>(
            tenantId,
            'candidates'
          );
          const candidate = await findById(candidatesCol, tenantId, candidateId);
          if (!candidate) {
            return NextResponse.json(
              {
                success: false,
                error: 'Candidate not found',
              },
              { status: 404 }
            );
          }

          // Fetch latest parse job for this candidate
          const parseCol = await getCVisionCollection<CVisionCvParseJob>(
            tenantId,
            'cvParseJobs'
          );
          const parseJob = await parseCol
            .find(
              createTenantFilter(tenantId, {
                candidateId,
                status: 'DONE',
              } as Record<string, unknown>)
            )
            .sort({ completedAt: -1 } as any)
            .limit(1)
            .toArray();

          const latestParse = parseJob[0];
          parsedCVData =
            latestParse?.extractedJson || latestParse?.metaJson || {};
          subjectId = candidateId;
        }

        // Extract skills
        const skills = extractSkillsFromCV(parsedCVData);

        // Create AI governance decision log
        const decisionId = generateSimpleId();
        const govConfig = buildGovernanceConfig(tenantId, userId);
        const decisionLog = createDecisionLog({
          id: decisionId,
          tenantId,
          decisionType: 'SKILL_ASSESSMENT',
          confidence: 75,
          subjectId,
          subjectType: 'CANDIDATE',
          inputSnapshot: {
            source: candidateId ? 'cv_parse_job' : 'direct_input',
            skillCount: parsedCVData?.skills?.length || 0,
            certCount: parsedCVData?.certifications?.length || 0,
          },
          outputSnapshot: {
            extractedSkills: skills.length,
            skillNames: skills.map((s) => s.skillName),
          },
          config: govConfig,
          createdBy: userId,
        });

        // Save decision log to DB
        try {
          const db = await getCVisionDb(tenantId);
          await db.collection('cvision_ai_decisions').insertOne({
            ...decisionLog,
            tenantId,
          });
        } catch (e) {
          logger.error('[Skills API] Failed to save decision log:', e);
          // Non-critical: continue even if logging fails
        }

        return NextResponse.json({
          success: true,
          data: {
            skills,
            totalExtracted: skills.length,
            decisionLogId: decisionId,
            decisionStatus: decisionLog.status,
          },
        });
      }

      // ── action=assess-gaps ────────────────────────────────────────
      if (action === 'assess-gaps') {
        const { employeeId, requiredSkills: bodyRequiredSkills } = body;

        if (!employeeId) {
          return NextResponse.json(
            {
              success: false,
              error: 'employeeId is required',
            },
            { status: 400 }
          );
        }

        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employee = await findById(empCol, tenantId, employeeId);
        if (!employee) {
          return NextResponse.json(
            {
              success: false,
              error: 'Employee not found',
            },
            { status: 404 }
          );
        }

        const profile = buildEmployeeSkillProfile(employee);

        // Determine required skills
        let requiredSkills: { skillName: string; requiredLevel: number }[] =
          bodyRequiredSkills || [];

        // If not provided, fetch from job title
        if (requiredSkills.length === 0 && employee.jobTitleId) {
          try {
            const jtCol = await getCVisionCollection<CVisionJobTitle>(
              tenantId,
              'jobTitles'
            );
            const jobTitle = await findById(jtCol, tenantId, employee.jobTitleId);
            if (jobTitle?.requirements && Array.isArray(jobTitle.requirements)) {
              requiredSkills = parseRequirementsToSkills(jobTitle.requirements);
            }
          } catch {
            // Non-critical: proceed with empty required skills
          }
        }

        const gaps = assessSkillGaps(profile.skills, requiredSkills);

        const highPriority = gaps.filter((g) => g.priority === 'HIGH').length;
        const mediumPriority = gaps.filter((g) => g.priority === 'MEDIUM').length;
        const lowPriority = gaps.filter((g) => g.priority === 'LOW').length;

        return NextResponse.json({
          success: true,
          data: {
            employeeId,
            employeeName: profile.employeeName,
            currentSkillCount: profile.skills.length,
            gaps,
            totalGaps: gaps.length,
            highPriority,
            mediumPriority,
            lowPriority,
          },
        });
      }

      // ── action=update-employee-skill ──────────────────────────────
      if (action === 'update-employee-skill') {
        const { employeeId, skillId, proficiencyLevel, source, verifiedBy } = body;

        if (!employeeId || !skillId || proficiencyLevel === undefined) {
          return NextResponse.json(
            {
              success: false,
              error: 'employeeId, skillId, and proficiencyLevel are required',
            },
            { status: 400 }
          );
        }

        const level = parseInt(String(proficiencyLevel), 10);
        if (isNaN(level) || level < 1 || level > 5) {
          return NextResponse.json(
            {
              success: false,
              error: 'proficiencyLevel must be between 1 and 5',
            },
            { status: 400 }
          );
        }

        // Verify employee exists
        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employee = await findById(empCol, tenantId, employeeId);
        if (!employee) {
          return NextResponse.json(
            {
              success: false,
              error: 'Employee not found',
            },
            { status: 404 }
          );
        }

        // Build the skill object
        const now = new Date();
        const skillUpdate = {
          skillId,
          skillName: skillId, // Will be overridden below if found in DEFAULT_SKILLS
          proficiencyLevel: level,
          selfAssessed: !verifiedBy,
          verifiedBy: verifiedBy || undefined,
          verifiedAt: verifiedBy ? now : undefined,
          source: source || (verifiedBy ? 'MANAGER_ASSIGNED' : 'SELF_ASSESSMENT'),
          lastUpdated: now,
        };

        // Try to resolve skill name from DEFAULT_SKILLS
        const knownSkill = DEFAULT_SKILLS.find(
          (s) => s.id === skillId || s.name.toLowerCase() === skillId.toLowerCase()
        );
        if (knownSkill) {
          skillUpdate.skillName = knownSkill.name;
          skillUpdate.skillId = knownSkill.id;
        }

        // Upsert into metadata.skills array
        const db = await getCVisionDb(tenantId);
        const existingSkills: any[] = employee.metadata?.skills || [];
        const existingIndex = existingSkills.findIndex(
          (s: any) =>
            s.skillId === skillUpdate.skillId ||
            s.skillName?.toLowerCase() === skillUpdate.skillName.toLowerCase()
        );

        if (existingIndex >= 0) {
          // Update existing skill
          existingSkills[existingIndex] = {
            ...existingSkills[existingIndex],
            ...skillUpdate,
          };
        } else {
          // Add new skill
          existingSkills.push(skillUpdate);
        }

        await db.collection('cvision_employees').updateOne(
          { id: employeeId, tenantId },
          {
            $set: {
              'metadata.skills': existingSkills,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        return NextResponse.json({
          success: true,
          data: {
            updated: true,
            employeeId,
            skill: skillUpdate,
            totalSkills: existingSkills.length,
          },
        });
      }

      // ── action=bulk-assess-department ─────────────────────────────
      if (action === 'bulk-assess-department') {
        const { department, requiredSkills: bodyRequiredSkills } = body;

        if (!department) {
          return NextResponse.json(
            {
              success: false,
              error: 'department is required',
            },
            { status: 400 }
          );
        }

        const empCol = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
        const employees = await empCol
          .find(createTenantFilter(tenantId, { departmentId: department, isActive: true }))
          .limit(5000)
          .toArray();

        if (employees.length === 0) {
          return NextResponse.json({
            success: true,
            data: {
              department,
              employeeCount: 0,
              assessments: [],
              aggregateGaps: [],
            },
          });
        }

        // Determine required skills
        let requiredSkills: { skillName: string; requiredLevel: number }[] =
          bodyRequiredSkills || [];

        if (requiredSkills.length === 0) {
          try {
            const jtCol = await getCVisionCollection<CVisionJobTitle>(
              tenantId,
              'jobTitles'
            );
            const jobTitles = await jtCol
              .find(createTenantFilter(tenantId, { departmentId: department, isActive: true }))
              .limit(500)
              .toArray();

            const allReqs = new Set<string>();
            for (const jt of jobTitles) {
              if (jt.requirements && Array.isArray(jt.requirements)) {
                for (const req of jt.requirements) {
                  allReqs.add(req);
                }
              }
            }
            if (allReqs.size > 0) {
              requiredSkills = parseRequirementsToSkills([...allReqs]);
            }
          } catch {
            // Non-critical
          }
        }

        // Assess each employee
        const assessments = employees.map((emp) => {
          const profile = buildEmployeeSkillProfile(emp);
          const gaps = assessSkillGaps(profile.skills, requiredSkills);
          return {
            employeeId: emp.id,
            employeeName: profile.employeeName,
            currentSkillCount: profile.skills.length,
            totalGaps: gaps.length,
            highPriority: gaps.filter((g) => g.priority === 'HIGH').length,
            mediumPriority: gaps.filter((g) => g.priority === 'MEDIUM').length,
            lowPriority: gaps.filter((g) => g.priority === 'LOW').length,
            gaps,
          };
        });

        // Aggregate gaps across all employees
        const gapCounts = new Map<string, { count: number; avgGap: number; priority: string }>();
        for (const a of assessments) {
          for (const gap of a.gaps) {
            const existing = gapCounts.get(gap.skillName) || {
              count: 0,
              avgGap: 0,
              priority: gap.priority,
            };
            existing.count++;
            existing.avgGap =
              (existing.avgGap * (existing.count - 1) + gap.gap) / existing.count;
            // Highest priority wins
            if (
              gap.priority === 'HIGH' ||
              (gap.priority === 'MEDIUM' && existing.priority === 'LOW')
            ) {
              existing.priority = gap.priority;
            }
            gapCounts.set(gap.skillName, existing);
          }
        }

        const aggregateGaps = [...gapCounts.entries()]
          .map(([skillName, data]) => ({
            skillName,
            affectedEmployees: data.count,
            averageGap: Math.round(data.avgGap * 10) / 10,
            priority: data.priority,
          }))
          .sort((a, b) => {
            const p = { HIGH: 3, MEDIUM: 2, LOW: 1 } as Record<string, number>;
            return (
              (p[b.priority] || 0) - (p[a.priority] || 0) ||
              b.affectedEmployees - a.affectedEmployees
            );
          });

        return NextResponse.json({
          success: true,
          data: {
            department,
            employeeCount: employees.length,
            assessments,
            aggregateGaps,
            totalUniqueGaps: aggregateGaps.length,
          },
        });
      }

      // ── action=force-seed-skills ──────────────────────────────────
      if (action === 'force-seed-skills') {
        const db = await getCVisionDb(tenantId);
        // Clear existing auto-generated skills so auto-seed can run
        await db.collection('cvision_employees').updateMany(
          { tenantId, 'metadata.skills.0.source': 'SYSTEM_GENERATED' },
          { $unset: { 'metadata.skills': '' } },
        );
        const seeded = await autoSeedEmployeeSkills(tenantId);
        return NextResponse.json({
          success: true,
          data: { seeded, message: `Force-seeded skills for ${seeded} employees` },
        });
      }

      // ── Unknown action ────────────────────────────────────────────
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action: ${action || 'none'}. Valid actions: extract-from-cv, assess-gaps, update-employee-skill, bulk-assess-department, force-seed-skills`,
        },
        { status: 400 }
      );
    } catch (error: any) {
      logger.error('[Skills API POST]', error?.message || String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
