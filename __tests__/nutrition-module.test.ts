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

describe('Nutrition Module — API Routes', () => {
  const baseDir = path.join(process.cwd(), 'app/api/nutrition');
  const routes = findRoutes(baseDir);

  it('should have at least 5 nutrition route files (base + tpn + diet-catalog + calorie-intake)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(5);
  });

  // ── Assessments Route ─────────────────────────────────────────
  describe('nutrition root route (assessments)', () => {
    const src = readRoute('app/api/nutrition/route.ts');

    it('uses withAuthTenant with ipd.view permission', () => {
      expect(src).toContain("permissionKey: 'ipd.view'");
    });

    it('queries prisma.nutritionalAssessment with tenant isolation', () => {
      expect(src).toContain('prisma.nutritionalAssessment.findMany');
      expect(src).toContain('tenantId');
    });

    it('computes KPIs (total, atRisk by MUST >= 2, malnourished by MUST >= 3)', () => {
      expect(src).toContain('atRisk');
      expect(src).toContain('malnourished');
      expect(src).toContain('mustScore');
      expect(src).toContain('>= 2');
      expect(src).toContain('>= 3');
    });

    it('auto-calculates BMI from height and weight', () => {
      expect(src).toContain('bmi');
      expect(src).toContain('w / (h * h)');
    });

    it('creates assessment with comprehensive nutrition fields', () => {
      expect(src).toContain('appetiteStatus');
      expect(src).toContain('swallowingStatus');
      expect(src).toContain('caloricNeed');
      expect(src).toContain('proteinNeed');
      expect(src).toContain('fluidNeed');
    });

    it('requires patientMasterId for creation', () => {
      expect(src).toContain("'patientMasterId is required'");
    });
  });

  // ── Assessment [id] Route ─────────────────────────────────────
  describe('nutrition/[id] route', () => {
    const src = readRoute('app/api/nutrition/[id]/route.ts');

    it('recalculates BMI when height or weight changes on PUT', () => {
      expect(src).toContain('data.bmi');
      expect(src).toContain('w / (h * h)');
    });

    it('returns 404 when assessment not found', () => {
      expect(src).toContain("'Not found'");
      expect(src).toContain('status: 404');
    });
  });

  // ── Dietary Orders Route ──────────────────────────────────────
  describe('dietary-orders route', () => {
    const src = readRoute('app/api/nutrition/dietary-orders/route.ts');

    it('supports comprehensive diet types including NPO, DIABETIC, RENAL, TUBE_FEEDING', () => {
      expect(src).toContain("'REGULAR'");
      expect(src).toContain("'NPO'");
      expect(src).toContain("'DIABETIC'");
      expect(src).toContain("'RENAL'");
      expect(src).toContain("'TUBE_FEEDING'");
      expect(src).toContain("'PARENTERAL'");
    });

    it('supports texture types (REGULAR, MINCED, PUREED, THICKENED_LIQUID)', () => {
      expect(src).toContain("'MINCED'");
      expect(src).toContain("'PUREED'");
      expect(src).toContain("'THICKENED_LIQUID'");
    });

    it('validates POST with createDietaryOrderSchema Zod schema', () => {
      expect(src).toContain('createDietaryOrderSchema');
      expect(src).toContain('z.object');
    });

    it('computes KPIs (total, active, npo, restricted)', () => {
      expect(src).toContain('npoCount');
      expect(src).toContain('restrictedCount');
    });

    it('PATCH auto-sets endDate on cancel or complete', () => {
      expect(src).toContain("updates.status === 'completed'");
      expect(src).toContain("updates.status === 'cancelled'");
      expect(src).toContain('data.endDate = new Date()');
    });

    it('requires nutrition.view and nutrition.manage permissions', () => {
      expect(src).toContain("permissionKey: 'nutrition.view'");
      expect(src).toContain("permissionKey: 'nutrition.manage'");
    });
  });

  // ── Meal Service Route ────────────────────────────────────────
  describe('meal-service route', () => {
    const src = readRoute('app/api/nutrition/meal-service/route.ts');

    it('supports meal types (BREAKFAST, LUNCH, DINNER, SNACK_AM, SNACK_PM, SNACK_HS)', () => {
      expect(src).toContain("'BREAKFAST'");
      expect(src).toContain("'LUNCH'");
      expect(src).toContain("'DINNER'");
      expect(src).toContain("'SNACK_AM'");
      expect(src).toContain("'SNACK_HS'");
    });

    it('prevents meal creation for NPO orders', () => {
      expect(src).toContain("order.dietType === 'NPO'");
      expect(src).toContain("'Cannot create meals for NPO orders'");
    });

    it('checks for duplicate meals on same date (409)', () => {
      expect(src).toContain("'All requested meals already exist for this date'");
      expect(src).toContain('status: 409');
    });

    it('has default meal times for each meal type', () => {
      expect(src).toContain('DEFAULT_MEAL_TIMES');
      expect(src).toContain("BREAKFAST: '07:00'");
    });

    it('computes meal service stats (total, pending, prepared, delivered, refused, avgIntake)', () => {
      expect(src).toContain('avgIntake');
      expect(src).toContain('pending');
      expect(src).toContain('refused');
    });

    it('auto-sets deliveredAt when status changes to delivered or consumed', () => {
      expect(src).toContain("updates.status === 'delivered'");
      expect(src).toContain("updates.status === 'consumed'");
      expect(src).toContain('data.deliveredAt = new Date()');
    });
  });

  // ── Meal Intake Route ─────────────────────────────────────────
  describe('meal-service/intake route', () => {
    const src = readRoute('app/api/nutrition/meal-service/intake/route.ts');

    it('validates with recordIntakeSchema Zod schema', () => {
      expect(src).toContain('recordIntakeSchema');
      expect(src).toContain('intakePercent: z.number().int().min(0).max(100)');
    });

    it('sets status to refused when intakePercent is 0', () => {
      expect(src).toContain("newStatus = 'refused'");
      expect(src).toContain('d.intakePercent === 0');
    });

    it('sets status to consumed when intakePercent > 0', () => {
      expect(src).toContain("newStatus = 'consumed'");
      expect(src).toContain('d.intakePercent > 0');
    });

    it('has no TODO/placeholder/dummy data', () => {
      expect(src.toLowerCase()).not.toMatch(/todo|placeholder|dummy|hardcoded/);
    });
  });
});
