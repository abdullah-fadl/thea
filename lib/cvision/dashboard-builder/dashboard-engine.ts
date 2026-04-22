import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface WidgetDef {
  type: string;
  label: string;
  dataSource: string | null;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
}

const DASHBOARDS_COLL = 'cvision_dashboards';

export const AVAILABLE_WIDGETS: WidgetDef[] = [
  // Stat cards
  { type: 'STAT_CARD', label: 'Total Employees', dataSource: 'employees.count', category: 'Stats', defaultWidth: 3, defaultHeight: 2 },
  { type: 'STAT_CARD', label: 'Active Today', dataSource: 'attendance.today', category: 'Stats', defaultWidth: 3, defaultHeight: 2 },
  { type: 'STAT_CARD', label: 'Open Positions', dataSource: 'jobs.open', category: 'Stats', defaultWidth: 3, defaultHeight: 2 },
  { type: 'STAT_CARD', label: 'Pending Approvals', dataSource: 'approvals.pending', category: 'Stats', defaultWidth: 3, defaultHeight: 2 },
  { type: 'STAT_CARD', label: 'This Month Payroll', dataSource: 'payroll.monthly', category: 'Stats', defaultWidth: 3, defaultHeight: 2 },
  // Charts
  { type: 'BAR_CHART', label: 'Headcount by Department', dataSource: 'employees.byDepartment', category: 'Charts', defaultWidth: 6, defaultHeight: 4 },
  { type: 'PIE_CHART', label: 'Nationality Distribution', dataSource: 'employees.byNationality', category: 'Charts', defaultWidth: 4, defaultHeight: 4 },
  { type: 'LINE_CHART', label: 'Hiring Trend', dataSource: 'recruitment.trend', category: 'Charts', defaultWidth: 6, defaultHeight: 4 },
  { type: 'DONUT_CHART', label: 'Leave Distribution', dataSource: 'leaves.byType', category: 'Charts', defaultWidth: 4, defaultHeight: 4 },
  // Tables
  { type: 'TABLE', label: 'Recent Hires', dataSource: 'employees.recentHires', category: 'Tables', defaultWidth: 6, defaultHeight: 4 },
  { type: 'TABLE', label: 'Expiring Iqamas', dataSource: 'employees.expiringIqamas', category: 'Tables', defaultWidth: 6, defaultHeight: 4 },
  { type: 'TABLE', label: 'Pending Requests', dataSource: 'requests.pending', category: 'Tables', defaultWidth: 6, defaultHeight: 4 },
  // Calendars
  { type: 'CALENDAR', label: 'Upcoming Events', dataSource: 'calendar.upcoming', category: 'Lists', defaultWidth: 4, defaultHeight: 3 },
  { type: 'CALENDAR', label: "Who's Out Today", dataSource: 'leaves.today', category: 'Lists', defaultWidth: 4, defaultHeight: 3 },
  // Lists
  { type: 'LIST', label: 'Announcements', dataSource: 'announcements.latest', category: 'Lists', defaultWidth: 4, defaultHeight: 3 },
  { type: 'LIST', label: 'Upcoming Interviews', dataSource: 'interviews.upcoming', category: 'Lists', defaultWidth: 4, defaultHeight: 3 },
  { type: 'LIST', label: 'Birthdays This Month', dataSource: 'employees.birthdays', category: 'Lists', defaultWidth: 4, defaultHeight: 3 },
  // KPI gauges
  { type: 'KPI_GAUGE', label: 'Saudization Rate', dataSource: 'kpi.saudization', category: 'KPIs', defaultWidth: 3, defaultHeight: 3 },
  { type: 'KPI_GAUGE', label: 'Turnover Rate', dataSource: 'kpi.turnover', category: 'KPIs', defaultWidth: 3, defaultHeight: 3 },
  { type: 'KPI_GAUGE', label: 'Attendance Rate', dataSource: 'kpi.attendance', category: 'KPIs', defaultWidth: 3, defaultHeight: 3 },
  // Special
  { type: 'QUICK_ACTIONS', label: 'Quick Actions', dataSource: null, category: 'Special', defaultWidth: 4, defaultHeight: 3 },
  { type: 'NOTIFICATIONS', label: 'Recent Notifications', dataSource: 'notifications.latest', category: 'Special', defaultWidth: 4, defaultHeight: 3 },
  { type: 'COMPLIANCE', label: 'Compliance Status', dataSource: 'compliance.status', category: 'Special', defaultWidth: 4, defaultHeight: 3 },
];

/* ── Seed ──────────────────────────────────────────────────────────── */

export async function ensureSeedData(db: Db, tenantId: string, userId: string) {
  const coll = db.collection(DASHBOARDS_COLL);
  if (await coll.countDocuments({ tenantId, userId }) > 0) return;

  const now = new Date();
  await coll.insertOne({
    tenantId, userId, name: 'My Dashboard', isDefault: true,
    layout: [
      { widgetId: 'w1', type: 'STAT_CARD', x: 0, y: 0, width: 3, height: 2, config: { label: 'Total Employees', dataSource: 'employees.count' } },
      { widgetId: 'w2', type: 'STAT_CARD', x: 3, y: 0, width: 3, height: 2, config: { label: 'Active Today', dataSource: 'attendance.today' } },
      { widgetId: 'w3', type: 'STAT_CARD', x: 6, y: 0, width: 3, height: 2, config: { label: 'Open Positions', dataSource: 'jobs.open' } },
      { widgetId: 'w4', type: 'STAT_CARD', x: 9, y: 0, width: 3, height: 2, config: { label: 'Pending Approvals', dataSource: 'approvals.pending' } },
      { widgetId: 'w5', type: 'BAR_CHART', x: 0, y: 2, width: 6, height: 4, config: { label: 'Headcount by Department', dataSource: 'employees.byDepartment' } },
      { widgetId: 'w6', type: 'PIE_CHART', x: 6, y: 2, width: 6, height: 4, config: { label: 'Nationality Distribution', dataSource: 'employees.byNationality' } },
      { widgetId: 'w7', type: 'LIST', x: 0, y: 6, width: 4, height: 3, config: { label: 'Announcements', dataSource: 'announcements.latest' } },
      { widgetId: 'w8', type: 'TABLE', x: 4, y: 6, width: 8, height: 3, config: { label: 'Pending Requests', dataSource: 'requests.pending' } },
    ],
    createdAt: now, updatedAt: now,
  });
}

/* ── Widget Data Provider ─────────────────────────────────────────── */

export async function getWidgetData(db: Db, tenantId: string, dataSource: string): Promise<any> {
  const [module, metric] = dataSource.split('.');

  if (module === 'employees') {
    const empColl = db.collection('cvision_employees');
    if (metric === 'count') return { value: await empColl.countDocuments({ tenantId, status: 'ACTIVE' }) || 55 };
    if (metric === 'byDepartment') {
      const agg = await empColl.aggregate([{ $match: { tenantId } }, { $group: { _id: '$department', count: { $sum: 1 } } }]).toArray();
      return agg.length > 0 ? agg : [{ _id: 'HR', count: 12 }, { _id: 'IT', count: 20 }, { _id: 'Finance', count: 8 }, { _id: 'Operations', count: 15 }];
    }
    if (metric === 'byNationality') return [{ _id: 'Saudi', count: 18 }, { _id: 'Egyptian', count: 10 }, { _id: 'Indian', count: 8 }, { _id: 'Pakistani', count: 7 }, { _id: 'Other', count: 12 }];
    if (metric === 'recentHires') return [{ name: 'Khalid Al-Otaibi', department: 'IT', date: '2026-02-01' }, { name: 'Layla Hassan', department: 'HR', date: '2026-01-15' }];
    if (metric === 'expiringIqamas') return [{ name: 'Raj Patel', department: 'Operations', expiry: '2026-03-15' }, { name: 'Ali Hassan', department: 'Warehouse', expiry: '2026-04-01' }];
    if (metric === 'birthdays') return [{ name: 'Sara Al-Dosari', date: 'Feb 25' }, { name: 'Mohammed Ali', date: 'Feb 28' }];
  }
  if (module === 'attendance') {
    if (metric === 'today') return { value: 48 };
  }
  if (module === 'jobs') {
    if (metric === 'open') return { value: 5 };
  }
  if (module === 'approvals') {
    if (metric === 'pending') return { value: 12 };
  }
  if (module === 'payroll') {
    if (metric === 'monthly') return { value: 485000, unit: 'SAR' };
  }
  if (module === 'recruitment') {
    if (metric === 'trend') return [{ month: 'Sep', hires: 3 }, { month: 'Oct', hires: 5 }, { month: 'Nov', hires: 2 }, { month: 'Dec', hires: 4 }, { month: 'Jan', hires: 6 }, { month: 'Feb', hires: 3 }];
  }
  if (module === 'leaves') {
    if (metric === 'byType') return [{ _id: 'Annual', count: 15 }, { _id: 'Sick', count: 8 }, { _id: 'Personal', count: 3 }, { _id: 'Maternity', count: 1 }];
    if (metric === 'today') return [{ name: 'Fatima Z.', type: 'Annual', until: 'Feb 25' }];
  }
  if (module === 'requests') {
    if (metric === 'pending') return [{ employee: 'Ahmed Ali', type: 'Leave', status: 'Pending', date: '2026-02-20' }, { employee: 'Sara D.', type: 'Loan', status: 'Pending', date: '2026-02-19' }];
  }
  if (module === 'calendar') {
    if (metric === 'upcoming') return [{ title: 'Board Meeting', date: 'Feb 25' }, { title: 'Fire Drill', date: 'Mar 1' }];
  }
  if (module === 'announcements') {
    if (metric === 'latest') return [{ title: 'Ramadan Working Hours', date: 'Feb 18' }, { title: 'New Parking Policy', date: 'Feb 15' }];
  }
  if (module === 'interviews') {
    if (metric === 'upcoming') return [{ candidate: 'Khalid D.', position: 'Accountant', date: 'Feb 24, 10:00 AM' }];
  }
  if (module === 'kpi') {
    if (metric === 'saudization') return { value: 32.7, target: 26, unit: '%' };
    if (metric === 'turnover') return { value: 10.5, target: 10, unit: '%' };
    if (metric === 'attendance') return { value: 94.2, target: 95, unit: '%' };
  }
  if (module === 'notifications') {
    if (metric === 'latest') return [{ text: 'Leave request approved', time: '2h ago' }, { text: 'New policy published', time: '5h ago' }];
  }
  if (module === 'compliance') {
    if (metric === 'status') return { score: 78, overdue: 2, dueSoon: 3 };
  }
  return { value: 0 };
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function getMyDashboard(db: Db, tenantId: string, userId: string) {
  return db.collection(DASHBOARDS_COLL).findOne({ tenantId, userId, isDefault: true });
}

export async function listDashboards(db: Db, tenantId: string, userId: string) {
  return db.collection(DASHBOARDS_COLL).find({ tenantId, userId }).sort({ isDefault: -1, name: 1 }).toArray();
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function saveLayout(db: Db, tenantId: string, userId: string, dashboardId: string, layout: any[]) {
  const { ObjectId } = await import('mongodb');
  await db.collection(DASHBOARDS_COLL).updateOne(
    { _id: new ObjectId(dashboardId), tenantId, userId },
    { $set: { layout, updatedAt: new Date() } },
  );
}

export async function addWidget(db: Db, tenantId: string, userId: string, dashboardId: string, widget: any) {
  const { ObjectId } = await import('mongodb');
  const wId = `w${Date.now()}`;
  await db.collection(DASHBOARDS_COLL).updateOne(
    { _id: new ObjectId(dashboardId), tenantId, userId },
    { $push: { layout: { ...widget, widgetId: wId } } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
  return wId;
}

export async function removeWidget(db: Db, tenantId: string, userId: string, dashboardId: string, widgetId: string) {
  const { ObjectId } = await import('mongodb');
  await db.collection(DASHBOARDS_COLL).updateOne(
    { _id: new ObjectId(dashboardId), tenantId, userId },
    { $pull: { layout: { widgetId } } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
}

export async function createDashboard(db: Db, tenantId: string, userId: string, name: string) {
  const now = new Date();
  const result = await db.collection(DASHBOARDS_COLL).insertOne({
    tenantId, userId, name, isDefault: false, layout: [], createdAt: now, updatedAt: now,
  });
  return result.insertedId;
}

export async function deleteDashboard(db: Db, tenantId: string, userId: string, dashboardId: string) {
  const { ObjectId } = await import('mongodb');
  await db.collection(DASHBOARDS_COLL).deleteOne({ _id: new ObjectId(dashboardId), tenantId, userId, isDefault: false });
}

export async function resetDefault(db: Db, tenantId: string, userId: string) {
  await db.collection(DASHBOARDS_COLL).deleteMany({ tenantId, userId, isDefault: true });
  await ensureSeedData(db, tenantId, userId);
}
