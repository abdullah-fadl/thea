import fs from 'fs';
import path from 'path';

describe('Integrity API wiring', () => {
  it('uses tenant-scoped integrity models (Prisma)', () => {
    const filePath = path.join(process.cwd(), 'app', 'api', 'sam', 'integrity', 'runs', 'route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    // Migrated from MongoDB collections to Prisma models
    expect(code).toContain('prisma.integrityRun');
    expect(code).toContain('prisma.integrityFinding');
  });

  it('uses SAM gateway routes for thea-engine calls', () => {
    const filePath = path.join(process.cwd(), 'app', 'api', 'sam', 'integrity', 'runs', 'route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('/api/sam/thea-engine/issues/ai');
    expect(code).toContain('/api/sam/thea-engine/conflicts');
    expect(code).not.toContain('THEA_ENGINE_URL');
  });

  it('enforces tenant auth in integrity routes', () => {
    const filePath = path.join(process.cwd(), 'app', 'api', 'sam', 'integrity', 'runs', 'route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('withAuthTenant');
  });
});
