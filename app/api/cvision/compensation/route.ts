import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[(ctx.roles as string[])?.[0]] || []).includes(perm); }

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const structCol = db.collection('cvision_salary_structure');
  const compCol = db.collection('cvision_employee_compensation');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'structure';

  if (action === 'structure') {
    let rows = await structCol.find({ tenantId }).sort({ name: 1 }).limit(500).toArray();
    if (rows.length === 0) {
      const defaultGrades = [
        { gradeId: 'G1', name: 'Entry Level', nameAr: 'مبتدئ', level: 1, minSalary: 4000, midSalary: 5500, maxSalary: 7000, allowances: { housing: 25, transport: 10, food: 0 } },
        { gradeId: 'G2', name: 'Junior', nameAr: 'مبتدئ متقدم', level: 2, minSalary: 5000, midSalary: 7500, maxSalary: 10000, allowances: { housing: 25, transport: 10, food: 5 } },
        { gradeId: 'G3', name: 'Mid-Level', nameAr: 'متوسط', level: 3, minSalary: 8000, midSalary: 12000, maxSalary: 16000, allowances: { housing: 25, transport: 10, food: 5 } },
        { gradeId: 'G4', name: 'Senior', nameAr: 'أول', level: 4, minSalary: 12000, midSalary: 18000, maxSalary: 25000, allowances: { housing: 25, transport: 10, food: 5 } },
        { gradeId: 'G5', name: 'Lead', nameAr: 'قائد', level: 5, minSalary: 18000, midSalary: 25000, maxSalary: 35000, allowances: { housing: 25, transport: 10, food: 5 } },
        { gradeId: 'G6', name: 'Manager', nameAr: 'مدير', level: 6, minSalary: 25000, midSalary: 35000, maxSalary: 50000, allowances: { housing: 25, transport: 10, food: 5 } },
        { gradeId: 'G7', name: 'Director', nameAr: 'مدير أول', level: 7, minSalary: 35000, midSalary: 50000, maxSalary: 70000, allowances: { housing: 30, transport: 10, food: 5 } },
        { gradeId: 'G8', name: 'Executive', nameAr: 'تنفيذي', level: 8, minSalary: 50000, midSalary: 75000, maxSalary: 100000, allowances: { housing: 30, transport: 15, food: 5 } },
      ];
      for (const g of defaultGrades) {
        const gUuid = uuidv4();
        await structCol.insertOne({
          tenantId, id: uuidv4(), gradeId: gUuid, name: g.name,
          components: JSON.stringify({ ...g, gradeId: gUuid }), isActive: true,
          createdAt: new Date(), updatedAt: new Date(),
        });
      }
      rows = await structCol.find({ tenantId }).sort({ name: 1 }).limit(500).toArray();
    }
    const grades = rows.map((r: any) => {
      const comp = typeof r.components === 'string' ? JSON.parse(r.components as string) : ((r.components as Record<string, unknown>) || {});
      return { ...comp, gradeId: r.gradeId, name: r.name, id: r.id };
    });
    return NextResponse.json({ ok: true, data: { tenantId, grades } });
  }

  if (action === 'employee') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    const comp = await compCol.findOne({ tenantId, employeeId: id });
    return NextResponse.json({ ok: true, data: comp });
  }

  if (action === 'analysis') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.COMPENSATION_READ)) return deny('INSUFFICIENT_PERMISSION', 'Requires COMPENSATION_READ');
    const comps = await compCol.find({ tenantId }).limit(5000).toArray();
    const structRows = await structCol.find({ tenantId }).limit(500).toArray();
    const grades = structRows.map((r: any) => {
      const comp = typeof r.components === 'string' ? JSON.parse(r.components) : (r.components || {});
      return { ...comp, gradeId: r.gradeId, name: r.name };
    });
    const gradeMap = new Map(grades.map((g: any) => [g.gradeId, g]));
    let totalPayroll = 0; let belowRange = 0; let aboveRange = 0; let inRange = 0;
    const byGrade: Record<string, number[]> = {};
    for (const c of comps) {
      const comp = c as Record<string, unknown>;
      totalPayroll += (comp.totalPackage as number) || (comp.basicSalary as number) || 0;
      const grade = gradeMap.get(comp.gradeId as string) as Record<string, unknown> | undefined;
      if (grade) {
        if (!byGrade[comp.gradeId as string]) byGrade[comp.gradeId as string] = [];
        byGrade[comp.gradeId as string].push((comp.basicSalary as number) || 0);
        if ((comp.basicSalary as number) < (grade.minSalary as number)) belowRange++;
        else if ((comp.basicSalary as number) > (grade.maxSalary as number)) aboveRange++;
        else inRange++;
      }
    }
    return NextResponse.json({ ok: true, data: { totalEmployees: comps.length, totalPayroll, avgSalary: comps.length > 0 ? Math.round(totalPayroll / comps.length) : 0, belowRange, inRange, aboveRange, byGrade } });
  }

  if (action === 'benchmarks') {
    return NextResponse.json({ ok: true, data: { note: 'Market benchmark data requires external API integration', benchmarks: [] } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.compensation.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  if (!hasPerm(ctx, CVISION_PERMISSIONS.COMPENSATION_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires COMPENSATION_WRITE');
  const db = await getCVisionDb(tenantId);
  const structCol = db.collection('cvision_salary_structure');
  const compCol = db.collection('cvision_employee_compensation');
  const body = await request.json();
  const action = body.action;

  if (action === 'create-grade') {
    const gId = uuidv4();
    const grade = { gradeId: gId, name: body.name || '', nameAr: body.nameAr || '', level: body.level || 0, minSalary: body.minSalary || 0, midSalary: body.midSalary || 0, maxSalary: body.maxSalary || 0, allowances: body.allowances || { housing: 25, transport: 10, food: 0 } };
    await structCol.insertOne({
      tenantId, id: uuidv4(), gradeId: gId, name: grade.name,
      components: JSON.stringify(grade), isActive: true,
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    });
    return NextResponse.json({ ok: true, data: grade });
  }

  if (action === 'update-compensation') {
    const { employeeId, gradeId, basicSalary, allowances, deductions } = body;
    if (!employeeId) return NextResponse.json({ ok: false, error: 'employeeId required' }, { status: 400 });
    const total = (basicSalary || 0) + Object.values(allowances || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    const gradeRow = gradeId ? await structCol.findOne({ tenantId, gradeId }) as Record<string, unknown> | null : null;
    const grade = gradeRow ? (typeof gradeRow.components === 'string' ? JSON.parse(gradeRow.components) : gradeRow.components) : null;
    const compaRatio = grade ? Math.round((basicSalary / grade.midSalary) * 100) : 0;
    await compCol.updateOne({ tenantId, employeeId }, {
      $set: { gradeId, basicSalary, allowances: allowances || {}, deductions: deductions || {}, totalPackage: total, compaRatio, effectiveDate: new Date(), updatedAt: new Date() },
      $push: { history: { date: new Date(), basicSalary, reason: body.reason || '', approvedBy: userId } } as Record<string, unknown>,
      $setOnInsert: { tenantId, employeeId, createdAt: new Date() },
    }, { upsert: true });
    return NextResponse.json({ ok: true, data: { totalPackage: total, compaRatio } });
  }

  if (action === 'simulate-raise') {
    const { percentage, departmentId, gradeId: targetGrade } = body;
    if (!percentage) return NextResponse.json({ ok: false, error: 'percentage required' }, { status: 400 });
    const filter: any = { tenantId };
    if (departmentId) filter.departmentId = departmentId;
    if (targetGrade) filter.gradeId = targetGrade;
    const comps = await compCol.find(filter).limit(5000).toArray();
    const currentTotal = comps.reduce((s, c) => s + ((c as Record<string, unknown>).totalPackage as number || 0), 0);
    const increase = Math.round(currentTotal * (percentage / 100));
    return NextResponse.json({ ok: true, data: { affectedEmployees: comps.length, currentTotal, increase, newTotal: currentTotal + increase, percentage } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.compensation.write' });
