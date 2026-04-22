/**
 * CVision Employee Tagging & Segmentation
 * Manual tags + dynamic rule-based segments
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const SEGMENT_TYPES = ['MANUAL', 'DYNAMIC'] as const;
export const OPERATORS = ['EQUALS', 'NOT_EQUALS', 'GREATER', 'LESS', 'CONTAINS', 'IN'] as const;
export const RULE_LOGIC = ['AND', 'OR'] as const;

export const DEFAULT_TAGS = [
  'High Potential', 'Remote', 'Expat', 'Critical Role', 'Key Talent',
  'Flight Risk', 'New Hire', 'Part-Time', 'Probation', 'Contractor',
];

const SEG_COL = 'cvision_employee_segments';
const EMP_COL = 'cvision_employees';

export async function createSegment(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  const now = new Date();
  const doc = {
    id, tenantId, segmentId: `SEG-${Date.now()}`,
    name: data.name, type: data.type || 'MANUAL',
    rules: data.rules || [], ruleLogic: data.ruleLogic || 'AND',
    manualEmployeeIds: data.manualEmployeeIds || [],
    employeeCount: 0, lastCalculated: now,
    usedIn: data.usedIn || [],
    createdBy: data.createdBy || '', createdAt: now, updatedAt: now,
  };
  await db.collection(SEG_COL).insertOne(doc);
  if (data.type === 'DYNAMIC') await recalculateSegment(db, tenantId, id);
  return { id };
}

export async function updateRules(db: Db, tenantId: string, segmentId: string, rules: any[], ruleLogic: string): Promise<{ success: boolean }> {
  await db.collection(SEG_COL).updateOne({ tenantId, id: segmentId }, {
    $set: { rules, ruleLogic, updatedAt: new Date() },
  });
  await recalculateSegment(db, tenantId, segmentId);
  return { success: true };
}

export async function addTag(db: Db, tenantId: string, employeeId: string, tag: string): Promise<{ success: boolean }> {
  await db.collection(EMP_COL).updateOne({ tenantId, id: employeeId }, {
    $addToSet: { tags: tag } as Record<string, unknown>, $set: { updatedAt: new Date() },
  });
  return { success: true };
}

export async function removeTag(db: Db, tenantId: string, employeeId: string, tag: string): Promise<{ success: boolean }> {
  await db.collection(EMP_COL).updateOne({ tenantId, id: employeeId }, {
    $pull: { tags: tag } as Record<string, unknown>, $set: { updatedAt: new Date() },
  });
  return { success: true };
}

export async function bulkTag(db: Db, tenantId: string, employeeIds: string[], tag: string): Promise<{ updated: number }> {
  const result = await db.collection(EMP_COL).updateMany(
    { tenantId, id: { $in: employeeIds } },
    { $addToSet: { tags: tag } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
  return { updated: result.modifiedCount };
}

export async function recalculateSegment(db: Db, tenantId: string, segmentId: string): Promise<{ count: number }> {
  const seg = await db.collection(SEG_COL).findOne({ tenantId, id: segmentId });
  if (!seg || seg.type !== 'DYNAMIC') return { count: 0 };

  const query: any = { tenantId, status: { $ne: 'TERMINATED' } };
  const conditions = (seg.rules || []).map((r: any) => {
    switch (r.operator) {
      case 'EQUALS': return { [r.field]: r.value };
      case 'NOT_EQUALS': return { [r.field]: { $ne: r.value } };
      case 'GREATER': return { [r.field]: { $gt: r.value } };
      case 'LESS': return { [r.field]: { $lt: r.value } };
      case 'CONTAINS': return { [r.field]: { $regex: String(r.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
      case 'IN': return { [r.field]: { $in: Array.isArray(r.value) ? r.value : [r.value] } };
      default: return {};
    }
  });

  if (conditions.length > 0) {
    query[seg.ruleLogic === 'OR' ? '$or' : '$and'] = conditions;
  }

  const count = await db.collection(EMP_COL).countDocuments(query);
  await db.collection(SEG_COL).updateOne({ tenantId, id: segmentId }, {
    $set: { employeeCount: count, lastCalculated: new Date() },
  });
  return { count };
}

export async function getSegmentEmployees(db: Db, tenantId: string, segmentId: string): Promise<any[]> {
  const seg = await db.collection(SEG_COL).findOne({ tenantId, id: segmentId });
  if (!seg) return [];

  if (seg.type === 'MANUAL') {
    return db.collection(EMP_COL).find({ tenantId, id: { $in: seg.manualEmployeeIds || [] } }).limit(5000).toArray();
  }

  const query: any = { tenantId, status: { $ne: 'TERMINATED' } };
  const conditions = (seg.rules || []).map((r: any) => {
    switch (r.operator) {
      case 'EQUALS': return { [r.field]: r.value };
      case 'NOT_EQUALS': return { [r.field]: { $ne: r.value } };
      case 'GREATER': return { [r.field]: { $gt: r.value } };
      case 'LESS': return { [r.field]: { $lt: r.value } };
      case 'CONTAINS': return { [r.field]: { $regex: String(r.value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
      case 'IN': return { [r.field]: { $in: Array.isArray(r.value) ? r.value : [r.value] } };
      default: return {};
    }
  });
  if (conditions.length > 0) query[seg.ruleLogic === 'OR' ? '$or' : '$and'] = conditions;
  return db.collection(EMP_COL).find(query).limit(5000).toArray();
}

export async function listSegments(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(SEG_COL).find({ tenantId }).sort({ createdAt: -1 }).toArray();
}

export async function getAvailableTags(db: Db, tenantId: string): Promise<string[]> {
  const employees = await db.collection(EMP_COL).find({ tenantId, tags: { $exists: true, $ne: [] } }).toArray();
  const tagSet = new Set<string>(DEFAULT_TAGS);
  for (const e of employees) for (const t of (e.tags || [])) tagSet.add(t);
  return [...tagSet].sort();
}

export async function getTagCloud(db: Db, tenantId: string): Promise<{ tag: string; count: number }[]> {
  const employees = await db.collection(EMP_COL).find({ tenantId, tags: { $exists: true, $ne: [] } }).toArray();
  const counts: Record<string, number> = {};
  for (const e of employees) for (const t of (e.tags || [])) counts[t] = (counts[t] || 0) + 1;
  return Object.entries(counts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

export async function getStats(db: Db, tenantId: string) {
  const segments = await db.collection(SEG_COL).countDocuments({ tenantId });
  const manual = await db.collection(SEG_COL).countDocuments({ tenantId, type: 'MANUAL' });
  const dynamic = await db.collection(SEG_COL).countDocuments({ tenantId, type: 'DYNAMIC' });
  const taggedEmployees = await db.collection(EMP_COL).countDocuments({ tenantId, tags: { $exists: true, $ne: [] } });
  return { totalSegments: segments, manualSegments: manual, dynamicSegments: dynamic, taggedEmployees };
}
