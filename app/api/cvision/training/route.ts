import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { getPlatformClient } from '@/lib/db/mongo';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { onTrainingCompleted } from '@/lib/cvision/lifecycle';

export const dynamic = 'force-dynamic';

function hasPerm(ctx: any, perm: string) { return ctx.isOwner || (CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || []).includes(perm); }

/** Resolve a user's display name by looking up cvision_employees first, then platform users */
async function resolveUserName(db: any, tenantId: string, id: string): Promise<string> {
  // 1. Try CVision employee record
  const emp = await db.collection('cvision_employees').findOne({ tenantId, id, deletedAt: null });
  if (emp) {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    if (name) return name;
  }
  // 2. Try platform users collection (auth user by id)
  try {
    const { db: platformDb } = await getPlatformClient();
    const user = await platformDb.collection('users').findOne({ id });
    if (user) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      if (name) return name;
    }
  } catch { /* ignore platform lookup failures */ }
  return id;
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId, userId, user }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const courseCol = db.collection('cvision_training_courses');
  const enrollCol = db.collection('cvision_training_enrollments');
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'catalog';

  if (action === 'catalog') {
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const filter: any = { tenantId };
    if (category) filter.category = category;
    if (status) filter.status = status;
    const data = await courseCol.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    // Add enrollment counts — PG returns 'id' (not 'courseId'), and 'name' (not 'title')
    const enriched = await Promise.all(data.map(async (c: any) => {
      const cid = c.courseId || c.id;
      const enrolled = await enrollCol.countDocuments({ tenantId, courseId: cid, status: { $in: ['ENROLLED', 'ATTENDED', 'COMPLETED'] } });
      return { ...c, courseId: cid, title: c.title || c.name, titleAr: c.titleAr || c.nameAr, enrolledCount: enrolled };
    }));
    return NextResponse.json({ ok: true, data: enriched });
  }

  if (action === 'get') {
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    // COLUMN_ALIAS maps courseId -> id, so this queries by PG 'id' column
    let course = await courseCol.findOne({ tenantId, courseId: id });
    // Fallback: try direct id lookup
    if (!course) course = await courseCol.findOne({ tenantId, id });
    if (!course) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    // Enrich with backward-compat fields
    const courseId = (course as Record<string, unknown>).courseId || (course as Record<string, unknown>).id || id;
    const rawEnrollments = await enrollCol.find({ tenantId, courseId }).limit(1000).toArray();

    const dedupMap = new Map<string, any>();
    for (const e of rawEnrollments) {
      const existing = dedupMap.get(e.employeeId);
      if (!existing || new Date(e.createdAt) > new Date(existing.createdAt)) {
        dedupMap.set(e.employeeId, e);
      }
    }
    const enrollments = Array.from(dedupMap.values());

    // Resolve employee names — check cvision_employees, then platform users
    const enrichedEnrollments = await Promise.all(enrollments.map(async (e: any) => {
      // Skip if already has a real name (not a UUID/ObjectId pattern)
      if (e.employeeName && !e.employeeName.match(/^[0-9a-f]{8,}/i)) return e;
      const name = await resolveUserName(db, tenantId, e.employeeId);
      return { ...e, employeeName: name };
    }));

    // Also persist resolved names back to DB (fire-and-forget) and clean up duplicate records
    const bulkNameOps: any[] = [];
    for (const e of enrichedEnrollments) {
      if (e.employeeName && !e.employeeName.match(/^[0-9a-f]{8,}/i)) {
        bulkNameOps.push({ updateMany: { filter: { tenantId, courseId: id, employeeId: e.employeeId }, update: { $set: { employeeName: e.employeeName } } } });
      }
    }
    // Delete duplicate enrollment records (keep only the _id from dedupMap)
    const keepIds = enrollments.map((e: any) => e._id);
    const deleteFilter: any = { tenantId, courseId: id, _id: { $nin: keepIds } };
    Promise.all([
      bulkNameOps.length > 0 ? enrollCol.bulkWrite(bulkNameOps).catch(() => {}) : Promise.resolve(),
      rawEnrollments.length > enrollments.length ? enrollCol.deleteMany(deleteFilter).catch(() => {}) : Promise.resolve(),
    ]).catch(() => {});

    const enrolledCount = enrollments.filter((e: any) => ['ENROLLED', 'ATTENDED', 'COMPLETED'].includes(e.status)).length;
    return NextResponse.json({ ok: true, data: { ...course, enrollments: enrichedEnrollments, enrolledCount } });
  }

  if (action === 'my-training') {
    const empId = ctx.employeeId || userId;
    const enrollments = await enrollCol.find({ tenantId, employeeId: empId }).sort({ createdAt: -1 }).limit(100).toArray();
    const courseIds = [...new Set(enrollments.map((e: any) => e.courseId).filter(Boolean))];
    // COLUMN_ALIAS maps courseId -> id, so { courseId: { $in: ids } } queries by PG 'id'
    const courses = courseIds.length > 0 ? await courseCol.find({ tenantId, courseId: { $in: courseIds } }).toArray() : [];
    // PG returns 'id' not 'courseId', build map using both possible keys
    const courseMap = new Map(courses.map((c: any) => [c.courseId || c.id, c]));
    const enriched = enrollments.map((e: any) => ({ ...e, course: courseMap.get(e.courseId) || null }));
    return NextResponse.json({ ok: true, data: enriched });
  }

  if (action === 'report') {
    const [totalCourses, totalEnrollments, completed, totalCost] = await Promise.all([
      courseCol.countDocuments({ tenantId }),
      enrollCol.countDocuments({ tenantId }),
      enrollCol.countDocuments({ tenantId, status: 'COMPLETED' }),
      courseCol.aggregate([{ $match: { tenantId } }, { $group: { _id: null, total: { $sum: '$cost' } } }]).toArray(),
    ]);
    const courses = await courseCol.find({ tenantId }).limit(1000).toArray();
    const totalHours = courses.reduce((sum: number, c: any) => sum + (c.duration || 0), 0);
    return NextResponse.json({ ok: true, data: { totalCourses, totalEnrollments, completed, completionRate: totalEnrollments > 0 ? Math.round((completed / totalEnrollments) * 100) : 0, totalHours, totalCost: totalCost[0]?.total || 0 } });
  }

  if (action === 'budget') {
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const budgetCol = db.collection('cvision_training_budget');
    const budget = await budgetCol.findOne({ tenantId, year: parseInt(year) });
    return NextResponse.json({ ok: true, data: budget || { totalBudget: 0, allocations: [], year: parseInt(year) } });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
},
  { platformKey: 'cvision', permissionKey: 'cvision.training.read' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId, user }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const db = await getCVisionDb(tenantId);
  const courseCol = db.collection('cvision_training_courses');
  const enrollCol = db.collection('cvision_training_enrollments');
  const body = await request.json();
  const action = body.action;

  if (action === 'create-course') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');
    const courseUuid = uuidv4();
    // PG schema for cvision_training_courses:
    //   id (UUID PK), tenantId, name, nameAr, description, category, provider, duration,
    //   cost (Decimal), currency, isExternal, isMandatory, maxParticipants, isActive, createdAt, updatedAt, createdBy, updatedBy
    // COLUMN_ALIASES: title -> name, titleAr -> nameAr
    const doc = {
      id: courseUuid,       // explicit UUID so we can reference it as courseId
      tenantId,
      title: body.title || body.name || '',       // mapped to 'name' via COLUMN_ALIAS
      titleAr: body.titleAr || body.nameAr || '', // mapped to 'nameAr' via COLUMN_ALIAS
      description: body.description || '',
      category: body.category || 'TECHNICAL',
      provider: body.provider || 'INTERNAL',
      duration: body.duration || 0,
      cost: body.cost || 0,
      currency: body.currency || 'SAR',
      isExternal: body.isExternal || false,
      isMandatory: body.isMandatory || (body.type === 'MANDATORY'),
      maxParticipants: body.maxEnrollment || body.maxParticipants || 30,
      isActive: (body.status || 'DRAFT') !== 'CANCELLED',
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await courseCol.insertOne(doc);
    // Return doc with courseId for backward compat (COLUMN_ALIAS maps courseId -> id in queries)
    return NextResponse.json({ ok: true, data: { ...doc, courseId: courseUuid, name: doc.title, nameAr: doc.titleAr } });
  }

  if (action === 'update-course') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');
    const { courseId, ...updates } = body; delete updates.action; delete updates.tenantId;
    if (!courseId) return NextResponse.json({ ok: false, error: 'courseId required' }, { status: 400 });
    await courseCol.updateOne({ tenantId, courseId }, { $set: { ...updates, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'enroll') {
    const { courseId, employeeId, employeeName, employeeIds } = body;
    if (!courseId) return NextResponse.json({ ok: false, error: 'courseId required' }, { status: 400 });
    const ids = employeeIds || [employeeId || (ctx.employeeId || userId)];

    // Resolve employee names — try body name, then DB employee, then auth user, then platform users
    const resolvedNames: string[] = [];
    for (const id of ids) {
      if (employeeName && !employeeName.match(/^[0-9a-f]{8,}/i)) {
        resolvedNames.push(employeeName);
      } else if (id === userId && user?.firstName) {
        // Self-enrollment: use the auth user's name directly
        resolvedNames.push(`${user.firstName || ''} ${user.lastName || ''}`.trim() || id);
      } else {
        const name = await resolveUserName(db, tenantId, id);
        resolvedNames.push(name);
      }
    }

    // Check for existing enrollment to prevent duplicates (idempotent)
    const existing = await enrollCol.find({ tenantId, courseId, employeeId: { $in: ids }, status: 'ENROLLED' }).limit(1000).toArray();
    const existingIds = new Set(existing.map((e: any) => e.employeeId));
    const newIds = ids.filter((id: string) => !existingIds.has(id));

    if (newIds.length === 0) return NextResponse.json({ ok: true, enrolled: 0, message: 'Already enrolled' });

    // PG schema for cvision_training_enrollments:
    //   id (UUID), tenantId, courseId, employeeId, scheduledDate, completedDate, status, score, certificate (Json), feedback, createdAt, updatedAt, createdBy
    const docs = newIds.map((id: string) => {
      const idx = ids.indexOf(id);
      return {
        tenantId, courseId, employeeId: id, status: 'ENROLLED',
        certificate: { employeeName: resolvedNames[idx] || id, attendancePercent: 0, certificateIssued: false },
        createdAt: new Date(), createdBy: userId,
      };
    });
    if (docs.length > 0) await enrollCol.insertMany(docs);
    return NextResponse.json({ ok: true, enrolled: docs.length });
  }

  if (action === 'withdraw') {
    const { courseId, employeeId } = body;
    if (!courseId || !employeeId) return NextResponse.json({ ok: false, error: 'courseId and employeeId required' }, { status: 400 });
    await enrollCol.updateOne({ tenantId, courseId, employeeId }, { $set: { status: 'WITHDRAWN', updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (action === 'complete') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');
    const { courseId, employeeId, score, attendancePercent } = body;
    if (!courseId || !employeeId) return NextResponse.json({ ok: false, error: 'courseId and employeeId required' }, { status: 400 });
    const passed = (score ?? 100) >= 60;
    // PG columns: status, score, completedDate, certificate (Json)
    await enrollCol.updateOne({ tenantId, courseId, employeeId }, {
      $set: {
        status: passed ? 'COMPLETED' : 'FAILED',
        score: score ?? null,
        completedDate: new Date(),
        certificate: { attendancePercent: attendancePercent ?? 100, certificateIssued: passed },
      },
    });

    // Lifecycle: update skills matrix, training hours, notifications
    if (passed) {
      onTrainingCompleted(db, tenantId, employeeId, courseId, score ?? 100)
        .catch(err => logger.error('[Lifecycle] onTrainingCompleted failed:', err));
    }

    return NextResponse.json({ ok: true, passed });
  }

  if (action === 'cancel-session') {
    if (!hasPerm(ctx, CVISION_PERMISSIONS.TRAINING_WRITE)) return deny('INSUFFICIENT_PERMISSION', 'Requires TRAINING_WRITE');
    const { courseId } = body;
    if (!courseId) return NextResponse.json({ ok: false, error: 'courseId required' }, { status: 400 });
    await courseCol.updateOne({ tenantId, courseId }, { $set: { isActive: false, updatedAt: new Date() } });
    await enrollCol.updateMany({ tenantId, courseId, status: 'ENROLLED' }, { $set: { status: 'WITHDRAWN' } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
});
