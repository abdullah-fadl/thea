import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type SearchResultType =
  | 'EMPLOYEE' | 'CANDIDATE' | 'JOB' | 'DOCUMENT' | 'POLICY'
  | 'LETTER' | 'LOAN' | 'CLAIM' | 'TRAINING' | 'ASSET'
  | 'CONTRACT' | 'ANNOUNCEMENT' | 'TEAM' | 'ROUTE' | 'INCIDENT'
  | 'KPI' | 'OKR' | 'WORKFLOW';

const INDEX_COLL = 'cvision_search_index';
const HISTORY_COLL = 'cvision_search_history';

/* ── Index Helpers ─────────────────────────────────────────────────── */

export function mapToSearchFields(module: string, record: any): any {
  switch (module) {
    case 'employees':
      return {
        title: record.name || record.employeeName || '',
        subtitle: `${record.department || ''} — ${record.position || ''}`,
        description: `${record.employeeId || ''} ${record.email || ''} ${record.phone || ''}`,
        searchTokens: [
          record.name?.toLowerCase(),
          ...(record.name?.toLowerCase().split(' ') || []),
          record.employeeId?.toLowerCase(),
          record.email?.toLowerCase(),
          record.phone?.replace(/\D/g, ''),
          record.nationalId ? `nid_${record.nationalId.slice(-4)}` : undefined,
          record.department?.toLowerCase(),
          record.position?.toLowerCase(),
        ].filter(Boolean),
        type: 'EMPLOYEE' as SearchResultType,
        icon: '👤',
        url: `/cvision/employees?id=${record._id}`,
        importance: record.status === 'ACTIVE' ? 10 : 3,
      };
    case 'candidates':
      return {
        title: record.name || '',
        subtitle: `${record.position || ''} — ${record.status || ''}`,
        searchTokens: [record.name?.toLowerCase(), ...(record.name?.toLowerCase().split(' ') || []), record.email?.toLowerCase(), record.phone?.replace(/\D/g, '')].filter(Boolean),
        type: 'CANDIDATE' as SearchResultType,
        icon: '📋',
        url: `/cvision/recruitment?tab=candidates&id=${record._id}`,
        importance: 7,
      };
    case 'jobs':
      return {
        title: record.title || '',
        subtitle: `${record.department || ''} — ${record.status || ''}`,
        searchTokens: [record.title?.toLowerCase(), record.reqNumber?.toLowerCase(), record.department?.toLowerCase()].filter(Boolean),
        type: 'JOB' as SearchResultType,
        icon: '💼',
        url: `/cvision/recruitment?tab=jobs&id=${record._id}`,
        importance: record.status === 'Open' ? 8 : 2,
      };
    case 'policies':
      return {
        title: record.title || '',
        subtitle: record.category || '',
        description: record.content?.substring(0, 200),
        searchTokens: [record.title?.toLowerCase(), record.policyId?.toLowerCase(), record.category?.toLowerCase(), ...(record.tags || [])].filter(Boolean),
        type: 'POLICY' as SearchResultType,
        icon: '📝',
        url: `/cvision/company-policies?id=${record._id}`,
        importance: 5,
      };
    case 'teams':
      return {
        title: record.name || '',
        subtitle: `${record.type || ''} Team — ${record.leaderName || ''}`,
        searchTokens: [record.name?.toLowerCase(), record.teamId?.toLowerCase(), record.leaderName?.toLowerCase(), record.nameAr].filter(Boolean),
        type: 'TEAM' as SearchResultType,
        icon: '👥',
        url: `/cvision/teams?id=${record._id}`,
        importance: 6,
      };
    case 'transport_routes':
      return {
        title: record.name || '',
        subtitle: `${record.type || ''} — ${record.vehiclePlate || ''}`,
        searchTokens: [record.name?.toLowerCase(), record.routeId?.toLowerCase(), record.driverName?.toLowerCase()].filter(Boolean),
        type: 'ROUTE' as SearchResultType,
        icon: '🚌',
        url: `/cvision/transport?route=${record.routeId}`,
        importance: 4,
      };
    case 'safety_incidents':
      return {
        title: record.title || '',
        subtitle: `${record.type || ''} — ${record.severity || ''}`,
        searchTokens: [record.title?.toLowerCase(), record.incidentId?.toLowerCase(), record.location?.toLowerCase()].filter(Boolean),
        type: 'INCIDENT' as SearchResultType,
        icon: '⚠️',
        url: `/cvision/safety?incident=${record.incidentId}`,
        importance: record.status !== 'CLOSED' ? 7 : 3,
      };
    case 'kpis':
      return {
        title: record.name || '',
        subtitle: `${record.category || ''} KPI`,
        searchTokens: [record.name?.toLowerCase(), record.kpiId?.toLowerCase(), record.nameAr].filter(Boolean),
        type: 'KPI' as SearchResultType,
        icon: '📊',
        url: `/cvision/okrs?tab=kpis&kpi=${record.kpiId}`,
        importance: 5,
      };
    case 'okrs':
      return {
        title: record.objective || '',
        subtitle: `${record.level || ''} — ${record.ownerName || ''}`,
        searchTokens: [record.objective?.toLowerCase(), record.okrId?.toLowerCase(), record.objectiveAr, record.ownerName?.toLowerCase()].filter(Boolean),
        type: 'OKR' as SearchResultType,
        icon: '🎯',
        url: `/cvision/okrs?okr=${record.okrId}`,
        importance: 6,
      };
    case 'workflows':
      return {
        title: record.name || '',
        subtitle: `Workflow — ${record.module || ''}`,
        searchTokens: [record.name?.toLowerCase(), record.workflowId?.toLowerCase(), record.nameAr].filter(Boolean),
        type: 'WORKFLOW' as SearchResultType,
        icon: '⚙️',
        url: `/cvision/workflow-builder?wf=${record.workflowId}`,
        importance: 4,
      };
    case 'training':
      return {
        title: record.name || record.courseName || '',
        subtitle: `Training — ${record.category || ''}`,
        searchTokens: [record.name?.toLowerCase(), record.courseName?.toLowerCase(), record.courseId?.toLowerCase()].filter(Boolean),
        type: 'TRAINING' as SearchResultType,
        icon: '🎓',
        url: `/cvision/training?id=${record._id}`,
        importance: 5,
      };
    case 'contracts':
      return {
        title: `Contract — ${record.employeeName || ''}`,
        subtitle: `${record.contractType || ''} — ${record.status || ''}`,
        searchTokens: [record.employeeName?.toLowerCase(), record.contractId?.toLowerCase()].filter(Boolean),
        type: 'CONTRACT' as SearchResultType,
        icon: '📄',
        url: `/cvision/contracts?id=${record._id}`,
        importance: 5,
      };
    case 'announcements':
      return {
        title: record.title || '',
        subtitle: record.category || 'Announcement',
        description: record.content?.substring(0, 200),
        searchTokens: [record.title?.toLowerCase(), ...(record.title?.toLowerCase().split(' ') || [])].filter(Boolean),
        type: 'ANNOUNCEMENT' as SearchResultType,
        icon: '📢',
        url: `/cvision/communications?id=${record._id}`,
        importance: record.pinned ? 8 : 4,
      };
    default:
      return {
        title: record.name || record.title || 'Unknown',
        subtitle: module,
        searchTokens: [record.name?.toLowerCase(), record.title?.toLowerCase()].filter(Boolean),
        type: 'DOCUMENT' as SearchResultType,
        icon: '📄',
        url: `/cvision/${module}?id=${record._id}`,
        importance: 3,
      };
  }
}

/* ── Indexing ───────────────────────────────────────────────────────── */

export async function indexRecord(db: Db, tenantId: string, module: string, record: any) {
  const mapped = mapToSearchFields(module, record);
  const entry = {
    tenantId,
    sourceModule: module,
    sourceCollection: `cvision_${module}`,
    sourceId: record._id?.toString() || record.employeeId || record.teamId || '',
    ...mapped,
    lastModified: record.updatedAt || record.createdAt || new Date(),
    updatedAt: new Date(),
  };
  await db.collection(INDEX_COLL).updateOne(
    { tenantId, sourceModule: module, sourceId: entry.sourceId },
    { $set: entry },
    { upsert: true },
  );
}

export async function removeFromIndex(db: Db, tenantId: string, module: string, sourceId: string) {
  await db.collection(INDEX_COLL).deleteOne({ tenantId, sourceModule: module, sourceId });
}

export async function rebuildIndex(db: Db, tenantId: string, module: string, collection: string) {
  const records = await db.collection(collection).find({ tenantId }).toArray();
  const bulk = records.map(r => ({
    updateOne: {
      filter: { tenantId, sourceModule: module, sourceId: r._id.toString() },
      update: {
        $set: {
          tenantId, sourceModule: module, sourceCollection: collection, sourceId: r._id.toString(),
          ...mapToSearchFields(module, r),
          lastModified: r.updatedAt || r.createdAt || new Date(),
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));
  if (bulk.length > 0) await db.collection(INDEX_COLL).bulkWrite(bulk);
  return bulk.length;
}

/* ── Seed ──────────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(INDEX_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;

  const now = new Date();
  const seeds = [
    { sourceModule: 'employees', sourceCollection: 'cvision_employees', sourceId: 'EMP-001', title: 'Ahmed Ali', subtitle: 'HR Department — Senior Manager', description: 'EMP-001 ahmed@company.com +966501112233', searchTokens: ['ahmed', 'ali', 'emp-001', 'hr', 'senior manager'], type: 'EMPLOYEE', icon: '👤', url: '/cvision/employees?id=EMP-001', importance: 10 },
    { sourceModule: 'employees', sourceCollection: 'cvision_employees', sourceId: 'EMP-002', title: 'Fatima Al-Zahrani', subtitle: 'Finance — Accountant', description: 'EMP-002 fatima@company.com', searchTokens: ['fatima', 'al-zahrani', 'emp-002', 'finance', 'accountant'], type: 'EMPLOYEE', icon: '👤', url: '/cvision/employees?id=EMP-002', importance: 10 },
    { sourceModule: 'employees', sourceCollection: 'cvision_employees', sourceId: 'EMP-003', title: 'Mohammed Al-Harbi', subtitle: 'IT Department — Developer', description: 'EMP-003 mohammed@company.com', searchTokens: ['mohammed', 'al-harbi', 'emp-003', 'it', 'developer'], type: 'EMPLOYEE', icon: '👤', url: '/cvision/employees?id=EMP-003', importance: 10 },
    { sourceModule: 'employees', sourceCollection: 'cvision_employees', sourceId: 'EMP-004', title: 'Sara Al-Dosari', subtitle: 'Operations — Coordinator', description: 'EMP-004', searchTokens: ['sara', 'al-dosari', 'emp-004', 'operations'], type: 'EMPLOYEE', icon: '👤', url: '/cvision/employees?id=EMP-004', importance: 10 },
    { sourceModule: 'employees', sourceCollection: 'cvision_employees', sourceId: 'EMP-005', title: 'Omar Al-Sheikh', subtitle: 'Marketing — Manager', description: 'EMP-005', searchTokens: ['omar', 'al-sheikh', 'emp-005', 'marketing'], type: 'EMPLOYEE', icon: '👤', url: '/cvision/employees?id=EMP-005', importance: 10 },
    { sourceModule: 'jobs', sourceCollection: 'cvision_jobs', sourceId: 'JOB-001', title: 'Senior Software Engineer', subtitle: 'IT — Open', searchTokens: ['senior', 'software', 'engineer', 'it'], type: 'JOB', icon: '💼', url: '/cvision/recruitment?tab=jobs', importance: 8 },
    { sourceModule: 'jobs', sourceCollection: 'cvision_jobs', sourceId: 'JOB-002', title: 'Staff Nurse', subtitle: 'Medical — Open', searchTokens: ['staff', 'nurse', 'medical'], type: 'JOB', icon: '💼', url: '/cvision/recruitment?tab=jobs', importance: 8 },
    { sourceModule: 'candidates', sourceCollection: 'cvision_candidates', sourceId: 'CND-001', title: 'Khalid Al-Daghar', subtitle: 'Accountant — Interview', searchTokens: ['khalid', 'al-daghar', 'accountant'], type: 'CANDIDATE', icon: '📋', url: '/cvision/recruitment?tab=candidates', importance: 7 },
    { sourceModule: 'policies', sourceCollection: 'cvision_policies', sourceId: 'POL-001', title: 'Annual Leave Policy', subtitle: 'HR Policy', description: 'Employees are entitled to 21 days of paid annual leave...', searchTokens: ['annual', 'leave', 'policy', 'hr'], type: 'POLICY', icon: '📝', url: '/cvision/company-policies', importance: 5 },
    { sourceModule: 'policies', sourceCollection: 'cvision_policies', sourceId: 'POL-002', title: 'Work From Home Policy', subtitle: 'Operations', searchTokens: ['work', 'from', 'home', 'wfh', 'remote'], type: 'POLICY', icon: '📝', url: '/cvision/company-policies', importance: 5 },
    { sourceModule: 'announcements', sourceCollection: 'cvision_announcements', sourceId: 'ANN-001', title: 'Ramadan Working Hours', subtitle: 'Announcement', searchTokens: ['ramadan', 'working', 'hours'], type: 'ANNOUNCEMENT', icon: '📢', url: '/cvision/communications', importance: 8 },
    { sourceModule: 'training', sourceCollection: 'cvision_training', sourceId: 'TRN-001', title: 'Leadership Development Program', subtitle: 'Training — Management', searchTokens: ['leadership', 'development', 'program', 'training'], type: 'TRAINING', icon: '🎓', url: '/cvision/training', importance: 5 },
  ];

  await coll.insertMany(seeds.map(s => ({ ...s, tenantId, lastModified: now, updatedAt: now })));
}

/* ── Search ─────────────────────────────────────────────────────────── */

export async function search(db: Db, tenantId: string, q: string, opts?: { type?: string; limit?: number }) {
  if (!q || q.length < 2) return [];
  const limit = opts?.limit || 15;
  const query: any = {
    tenantId,
    searchTokens: { $regex: q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  };
  if (opts?.type) query.type = opts.type;
  return db.collection(INDEX_COLL)
    .find(query)
    .sort({ importance: -1, lastModified: -1 })
    .limit(limit)
    .toArray();
}

export async function getRecent(db: Db, tenantId: string, userId: string, limit = 10) {
  return db.collection(HISTORY_COLL)
    .find({ tenantId, userId })
    .sort({ viewedAt: -1 })
    .limit(limit)
    .toArray();
}

export async function trackView(db: Db, tenantId: string, userId: string, data: { title: string; url: string; type: string; icon?: string }) {
  await db.collection(HISTORY_COLL).updateOne(
    { tenantId, userId, url: data.url },
    { $set: { ...data, tenantId, userId, viewedAt: new Date() } },
    { upsert: true },
  );
  const count = await db.collection(HISTORY_COLL).countDocuments({ tenantId, userId });
  if (count > 20) {
    const oldest = await db.collection(HISTORY_COLL).find({ tenantId, userId }).sort({ viewedAt: 1 }).limit(count - 20).toArray();
    if (oldest.length > 0) {
      await db.collection(HISTORY_COLL).deleteMany({ _id: { $in: oldest.map(o => o._id) }, tenantId });
    }
  }
}
