import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

const findRoutes = (dir: string): string[] => {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findRoutes(fp));
    else if (entry.name === 'route.ts') files.push(fp);
  }
  return files;
};

describe('Psychiatry Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/psychiatry');
  const routes = findRoutes(baseDir);

  it('should have at least 6 psychiatry route files', () => {
    expect(routes.length).toBeGreaterThanOrEqual(6);
  });

  // ── Assessments Route ─────────────────────────────────────────
  describe('assessments list/create route', () => {
    const src = readRoute('app/api/psychiatry/assessments/route.ts');

    it('uses withAuthTenant with psychiatry.view and psychiatry.manage permissions', () => {
      expect(src).toContain("permissionKey: 'psychiatry.view'");
      expect(src).toContain("permissionKey: 'psychiatry.manage'");
    });

    it('queries prisma.psychiatricAssessment with tenantId isolation', () => {
      expect(src).toContain('prisma.psychiatricAssessment.findMany');
      expect(src).toContain('tenantId');
    });

    it('creates assessment with DSM-5 diagnosis and formulation', () => {
      expect(src).toContain('body.dsm5Diagnosis');
      expect(src).toContain('body.formulation');
    });

    it('records chief complaint and presenting illness', () => {
      expect(src).toContain('body.chiefComplaint');
      expect(src).toContain('body.presentingIllness');
    });

    it('tracks psychiatric, medical, family history and substance use', () => {
      expect(src).toContain('body.psychiatricHistory');
      expect(src).toContain('body.medicalHistory');
      expect(src).toContain('body.familyHistory');
      expect(src).toContain('body.substanceUse');
    });
  });

  // ── Assessments [id] Route ────────────────────────────────────
  describe('assessments/[id] route', () => {
    const src = readRoute('app/api/psychiatry/assessments/[id]/route.ts');

    it('GET includes notes ordered by date', () => {
      expect(src).toContain('include: { notes:');
      expect(src).toContain("noteDate: 'desc'");
    });

    it('PUT updates diagnosis, treatmentPlan, disposition, riskAssessment', () => {
      expect(src).toContain('body.diagnosis');
      expect(src).toContain('body.treatmentPlan');
      expect(src).toContain('body.disposition');
      expect(src).toContain('body.riskAssessment');
    });

    it('returns 404 when assessment not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Notes Route ───────────────────────────────────────────────
  describe('assessments/[id]/notes route', () => {
    const src = readRoute('app/api/psychiatry/assessments/[id]/notes/route.ts');

    it('creates psychNote linked to assessmentId', () => {
      expect(src).toContain('prisma.psychNote.create');
      expect(src).toContain('assessmentId');
    });

    it('supports noteType with PROGRESS default', () => {
      expect(src).toContain("body.noteType || 'PROGRESS'");
    });

    it('tracks medications and mood rating', () => {
      expect(src).toContain('body.medications');
      expect(src).toContain('body.moodRating');
    });

    it('records suicidal risk assessment per note', () => {
      expect(src).toContain('body.suicidalRisk');
    });
  });

  // ── MSE Route ─────────────────────────────────────────────────
  describe('mse (mental status exam) route', () => {
    const src = readRoute('app/api/psychiatry/mse/route.ts');

    it('queries prisma.psychMentalStatusExam', () => {
      expect(src).toContain('psychMentalStatusExam.findMany');
    });

    it('records all MSE domains (appearance, behavior, speech, mood, affect)', () => {
      expect(src).toContain('body.appearance');
      expect(src).toContain('body.behavior');
      expect(src).toContain('body.speech');
      expect(src).toContain('body.moodReported');
      expect(src).toContain('body.affectObserved');
    });

    it('records thought process and content including delusion type', () => {
      expect(src).toContain('body.thoughtProcess');
      expect(src).toContain('body.thoughtContent');
      expect(src).toContain('body.delusionType');
    });

    it('records cognition scores (MMSE, MoCA)', () => {
      expect(src).toContain('body.mmseScore');
      expect(src).toContain('body.mocaScore');
    });

    it('records insight, judgment, and reliability', () => {
      expect(src).toContain('body.insight');
      expect(src).toContain('body.judgment');
      expect(src).toContain('body.reliability');
    });

    it('logs MSE creation', () => {
      expect(src).toContain("logger.info('MSE created'");
    });
  });

  // ── Restraints Route ──────────────────────────────────────────
  describe('restraints list/create route', () => {
    const src = readRoute('app/api/psychiatry/restraints/route.ts');

    it('queries prisma.psychRestraintLog', () => {
      expect(src).toContain('psychRestraintLog.findMany');
    });

    it('requires patientMasterId, interventionType, and reason for creation', () => {
      expect(src).toContain("'patientMasterId, interventionType, and reason are required'");
    });

    it('initializes monitoring checks as empty array', () => {
      expect(src).toContain('monitoringChecks: []');
    });

    it('sets default monitoring frequency to 15 minutes', () => {
      expect(src).toContain('monitoringFreqMin: body.monitoringFreqMin ?? 15');
    });

    it('sets initial status to ACTIVE', () => {
      expect(src).toContain("status: 'ACTIVE'");
    });
  });

  // ── Restraints [restraintId] Route ────────────────────────────
  describe('restraints/[restraintId] route', () => {
    const src = readRoute('app/api/psychiatry/restraints/[restraintId]/route.ts');

    it('PATCH supports addMonitoringCheck with clinical fields', () => {
      expect(src).toContain('addMonitoringCheck');
      expect(src).toContain('circulation');
      expect(src).toContain('skinIntegrity');
      expect(src).toContain('emotionalStatus');
      expect(src).toContain('hydration');
    });

    it('supports end restraint with duration calculation', () => {
      expect(src).toContain('endRestraint');
      expect(src).toContain('totalDurationMin');
      expect(src).toContain("update.status = 'COMPLETED'");
    });

    it('supports cancel action', () => {
      expect(src).toContain('body.cancel');
      expect(src).toContain("update.status = 'CANCELLED'");
    });

    it('supports physician face-to-face assessment', () => {
      expect(src).toContain('physicianAssessment');
      expect(src).toContain('physicianAssessedAt');
      expect(src).toContain('physicianNotes');
    });

    it('supports debrief with staff and patient notes', () => {
      expect(src).toContain('debrief');
      expect(src).toContain('debriefCompleted');
      expect(src).toContain('patientDebriefNotes');
    });

    it('tracks injuries noted during restraint', () => {
      expect(src).toContain('injuriesNoted');
      expect(src).toContain('injuryDescription');
    });
  });

  // ── Risk Assessment Route ─────────────────────────────────────
  describe('risk-assessment route', () => {
    const src = readRoute('app/api/psychiatry/risk-assessment/route.ts');

    it('queries prisma.psychRiskAssessment', () => {
      expect(src).toContain('psychRiskAssessment.findMany');
    });

    it('auto-calculates Broset Violence Checklist score', () => {
      expect(src).toContain('brosetScore');
      expect(src).toContain('brosetConfusion');
      expect(src).toContain('brosetIrritability');
      expect(src).toContain('brosetBoisterousness');
      expect(src).toContain('brosetVerbalThreats');
      expect(src).toContain('brosetPhysicalThreats');
      expect(src).toContain('brosetAttackObjects');
    });

    it('supports C-SSRS suicidal ideation and behavior assessment', () => {
      expect(src).toContain('suicideIdeation');
      expect(src).toContain('ideationType');
      expect(src).toContain('suicideBehavior');
      expect(src).toContain('behaviorType');
    });

    it('records PHQ-9 depression score', () => {
      expect(src).toContain('phq9Score');
      expect(src).toContain('phq9Item9');
    });

    it('tracks risk factors (static, dynamic, protective)', () => {
      expect(src).toContain('staticFactors');
      expect(src).toContain('dynamicFactors');
      expect(src).toContain('protectiveFactors');
    });

    it('supports safety plan creation flag', () => {
      expect(src).toContain('safetyPlanCreated');
      expect(src).toContain('safetyPlan');
    });

    it('tracks supervision level and environmental safety', () => {
      expect(src).toContain('supervisionLevel');
      expect(src).toContain('environmentalSafety');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
