import { Db } from '@/lib/cvision/infra/mongo-compat';

interface Widget {
  dataSource: string;
  metric: string;
  field?: string;
  filters?: { field: string; operator: string; value: any }[];
  groupBy?: string;
  timeRange?: string;
}

const DATA_SOURCE_MAP: Record<string, string> = {
  employees: 'cvision_employees',
  leaves: 'cvision_leaves',
  loans: 'cvision_loans',
  attendance: 'cvision_attendance',
  payroll: 'cvision_payroll',
  training: 'cvision_training_courses',
  recruitment: 'cvision_job_openings',
  performance: 'cvision_okrs',
  grievances: 'cvision_grievances',
  assets: 'cvision_assets',
  announcements: 'cvision_announcements',
  travel: 'cvision_travel_requests',
  rewards: 'cvision_recognitions',
};

function getDateFilter(range: string): any {
  const now = new Date();
  const start = new Date();
  switch (range) {
    case 'CURRENT_MONTH': start.setDate(1); break;
    case 'LAST_MONTH': start.setMonth(start.getMonth() - 1); start.setDate(1); now.setDate(0); break;
    case 'CURRENT_QUARTER': start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1); break;
    case 'CURRENT_YEAR': start.setMonth(0, 1); break;
    default: return null;
  }
  return { $gte: start, $lte: now };
}

// Map of ID fields to their lookup collections and name fields
const ID_LABEL_LOOKUPS: Record<string, { collection: string; idField: string; nameField: string; nameFieldAr?: string }> = {
  departmentId: { collection: 'cvision_departments', idField: 'id', nameField: 'name', nameFieldAr: 'nameAr' },
  jobTitleId: { collection: 'cvision_job_titles', idField: 'id', nameField: 'name', nameFieldAr: 'nameAr' },
  unitId: { collection: 'cvision_units', idField: 'id', nameField: 'name', nameFieldAr: 'nameAr' },
  gradeId: { collection: 'cvision_grades', idField: 'id', nameField: 'name' },
};

async function resolveIdLabels(db: Db, tenantId: string, groupByField: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const lookup = ID_LABEL_LOOKUPS[groupByField];
  if (!lookup) return new Map();

  const validIds = ids.filter(Boolean) as string[];
  if (validIds.length === 0) return new Map();

  try {
    const docs = await db.collection(lookup.collection)
      .find({ tenantId, [lookup.idField]: { $in: validIds } })
      .project({ [lookup.idField]: 1, [lookup.nameField]: 1, ...(lookup.nameFieldAr ? { [lookup.nameFieldAr]: 1 } : {}) })
      .toArray();

    const map = new Map<string, string>();
    for (const doc of docs) {
      const id = doc[lookup.idField];
      const name = doc[lookup.nameField] || doc[lookup.nameFieldAr] || id;
      if (id) map.set(id, name);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getWidgetData(db: Db, tenantId: string, widget: Widget): Promise<{ labels: string[]; data: number[]; total?: number }> {
  const colName = DATA_SOURCE_MAP[widget.dataSource];
  if (!colName) return { labels: [], data: [], total: 0 };

  const col = db.collection(colName);
  const match: any = { tenantId };

  if (widget.filters) {
    for (const f of widget.filters) {
      if (f.operator === 'eq') match[f.field] = f.value;
      else if (f.operator === 'ne') match[f.field] = { $ne: f.value };
      else if (f.operator === 'gt') match[f.field] = { $gt: f.value };
      else if (f.operator === 'lt') match[f.field] = { $lt: f.value };
      else if (f.operator === 'in') match[f.field] = { $in: f.value };
    }
  }

  const dateFilter = widget.timeRange ? getDateFilter(widget.timeRange) : null;
  if (dateFilter) match.createdAt = dateFilter;

  if (widget.groupBy) {
    const pipeline: any[] = [
      { $match: match },
      { $group: { _id: `$${widget.groupBy}`, value: widget.metric === 'count' ? { $sum: 1 } : { [`$${widget.metric}`]: `$${widget.field || '_id'}` } } },
      { $sort: { value: -1 } },
      { $limit: 20 },
    ];
    const results: any[] = await col.aggregate(pipeline).toArray();

    // Resolve ID fields to human-readable names
    let labels = results.map(r => String(r._id || 'Unknown'));
    if (widget.groupBy && ID_LABEL_LOOKUPS[widget.groupBy]) {
      const nameMap = await resolveIdLabels(db, tenantId, widget.groupBy, results.map(r => r._id));
      labels = results.map(r => nameMap.get(r._id) || String(r._id || 'Unknown'));
    }

    return {
      labels,
      data: results.map(r => r.value || 0) as number[],
      total: results.reduce((s: number, r: any) => s + (r.value || 0), 0),
    };
  }

  if (widget.metric === 'count') {
    const c = await col.countDocuments(match);
    return { labels: ['Total'], data: [c], total: c };
  }

  const pipeline = [{ $match: match }, { $group: { _id: null, value: { [`$${widget.metric}`]: `$${widget.field}` } } }];
  const results: any[] = await col.aggregate(pipeline).toArray();
  const val: number = results[0]?.value || 0;
  return { labels: ['Value'], data: [val], total: val };
}

export function getDefaultDashboard(tenantId: string) {
  return {
    tenantId, dashboardId: 'default-hr-overview', name: 'HR Overview', nameAr: 'نظرة عامة للموارد البشرية',
    ownerId: 'system', isShared: true,
    widgets: [
      { widgetId: 'w1', type: 'NUMBER', title: 'Total Employees', titleAr: 'إجمالي الموظفين', dataSource: 'employees', metric: 'count', filters: [{ field: 'status', operator: 'in', value: ['ACTIVE', 'PROBATION', 'active', 'probation'] }, { field: 'isArchived', operator: 'ne', value: true }], position: { x: 0, y: 0, w: 3, h: 1 }, color: '#3b82f6' },
      { widgetId: 'w2', type: 'GAUGE', title: 'Saudization %', titleAr: 'نسبة السعودة', dataSource: 'employees', metric: 'count', groupBy: 'nationality', filters: [{ field: 'status', operator: 'in', value: ['ACTIVE', 'PROBATION', 'active', 'probation'] }, { field: 'isArchived', operator: 'ne', value: true }], position: { x: 3, y: 0, w: 3, h: 1 }, color: '#10b981' },
      { widgetId: 'w3', type: 'CHART_PIE', title: 'By Department', titleAr: 'حسب القسم', dataSource: 'employees', metric: 'count', groupBy: 'departmentId', filters: [{ field: 'status', operator: 'in', value: ['ACTIVE', 'PROBATION', 'active', 'probation'] }, { field: 'isArchived', operator: 'ne', value: true }], position: { x: 0, y: 1, w: 6, h: 2 }, color: '#8b5cf6' },
      { widgetId: 'w4', type: 'CHART_BAR', title: 'Leaves This Month', titleAr: 'إجازات هذا الشهر', dataSource: 'leaves', metric: 'count', groupBy: 'type', timeRange: 'CURRENT_MONTH', position: { x: 6, y: 0, w: 6, h: 2 }, color: '#f59e0b' },
      { widgetId: 'w5', type: 'NUMBER', title: 'Open Positions', titleAr: 'الوظائف الشاغرة', dataSource: 'recruitment', metric: 'count', filters: [{ field: 'status', operator: 'eq', value: 'OPEN' }], position: { x: 6, y: 2, w: 3, h: 1 }, color: '#ef4444' },
      { widgetId: 'w6', type: 'NUMBER', title: 'Active Trainings', titleAr: 'التدريب النشط', dataSource: 'training', metric: 'count', filters: [{ field: 'status', operator: 'eq', value: 'ACTIVE' }], position: { x: 9, y: 2, w: 3, h: 1 }, color: '#06b6d4' },
    ],
    createdAt: new Date(), updatedAt: new Date(),
  };
}
