import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type RecognitionType = 'KUDOS' | 'EMPLOYEE_OF_MONTH' | 'EMPLOYEE_OF_QUARTER' | 'EMPLOYEE_OF_YEAR' | 'SPOT_AWARD' | 'MILESTONE' | 'INNOVATION' | 'CUSTOMER_SERVICE' | 'TEAMWORK' | 'CUSTOM';
export type RecognitionCategory = 'PERFORMANCE' | 'INNOVATION' | 'TEAMWORK' | 'LEADERSHIP' | 'CUSTOMER_FOCUS' | 'VALUES' | 'SAFETY' | 'ATTENDANCE';
export type AwardType = 'CERTIFICATE' | 'GIFT_CARD' | 'BONUS' | 'EXTRA_LEAVE' | 'TROPHY' | 'CUSTOM';

export const TYPE_LABELS: Record<RecognitionType, string> = {
  KUDOS: 'Kudos', EMPLOYEE_OF_MONTH: 'Employee of the Month', EMPLOYEE_OF_QUARTER: 'Employee of the Quarter',
  EMPLOYEE_OF_YEAR: 'Employee of the Year', SPOT_AWARD: 'Spot Award', MILESTONE: 'Milestone',
  INNOVATION: 'Innovation', CUSTOMER_SERVICE: 'Customer Service', TEAMWORK: 'Teamwork', CUSTOM: 'Custom',
};

export const CATEGORY_LABELS: Record<RecognitionCategory, string> = {
  PERFORMANCE: 'Performance', INNOVATION: 'Innovation', TEAMWORK: 'Teamwork', LEADERSHIP: 'Leadership',
  CUSTOMER_FOCUS: 'Customer Focus', VALUES: 'Values', SAFETY: 'Safety', ATTENDANCE: 'Attendance',
};

export const POINT_VALUES: Record<string, number> = {
  KUDOS: 10,
  SPOT_AWARD: 50,
  EMPLOYEE_OF_MONTH: 200,
  EMPLOYEE_OF_QUARTER: 500,
  EMPLOYEE_OF_YEAR: 2000,
  INNOVATION: 100,
  MILESTONE_1_YEAR: 100,
  MILESTONE_5_YEAR: 500,
  MILESTONE_10_YEAR: 1000,
  PERFECT_ATTENDANCE_MONTH: 50,
  CUSTOMER_SERVICE: 75,
  TEAMWORK: 50,
  CUSTOM: 25,
};

export const REDEMPTION_CATALOG = [
  { id: 'RDM-001', name: 'Amazon Gift Card 100 SAR', points: 500, category: 'Gift Card' },
  { id: 'RDM-002', name: 'Extra Day Off', points: 300, category: 'Leave' },
  { id: 'RDM-003', name: 'Lunch Voucher', points: 100, category: 'Dining' },
  { id: 'RDM-004', name: 'Parking Upgrade (1 month)', points: 200, category: 'Perks' },
  { id: 'RDM-005', name: 'Training Course Sponsorship', points: 1000, category: 'Development' },
  { id: 'RDM-006', name: 'Amazon Gift Card 50 SAR', points: 250, category: 'Gift Card' },
  { id: 'RDM-007', name: 'Coffee Shop Voucher', points: 50, category: 'Dining' },
  { id: 'RDM-008', name: 'Gym Membership (1 month)', points: 400, category: 'Wellness' },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_RECOGNITIONS = [
  {
    recognitionId: 'REC-2026-001', recipientId: 'EMP-001', recipientName: 'Ahmed Al-Rashidi', recipientDepartment: 'IT',
    giverId: 'EMP-004', giverName: 'Fahad Al-Qahtani', giverRole: 'MANAGER' as const,
    type: 'EMPLOYEE_OF_MONTH' as RecognitionType, category: 'PERFORMANCE' as RecognitionCategory,
    message: 'Outstanding work on the digital transformation project. Ahmed showed exceptional leadership and technical skills, delivering ahead of schedule.',
    isPublic: true, pointsAwarded: 200, status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-002', 'EMP-003', 'EMP-005', 'EMP-006', 'EMP-007'],
    comments: [
      { employeeId: 'EMP-002', employeeName: 'Sara Hassan', text: 'Well deserved! Ahmed is always going above and beyond.', createdAt: new Date('2026-02-10') },
      { employeeId: 'EMP-005', employeeName: 'Khalid Al-Dosari', text: 'Congratulations Ahmed! Great teamwork.', createdAt: new Date('2026-02-10') },
    ],
    createdAt: new Date('2026-02-09'),
  },
  {
    recognitionId: 'REC-2026-002', recipientId: 'EMP-002', recipientName: 'Sara Hassan', recipientDepartment: 'Finance',
    giverId: 'EMP-003', giverName: 'Mohammed Al-Harbi', giverRole: 'PEER' as const,
    type: 'KUDOS' as RecognitionType, category: 'TEAMWORK' as RecognitionCategory,
    message: 'Thank you Sara for helping the IT team with budget analysis during a very tight deadline. Your collaboration was invaluable!',
    isPublic: true, pointsAwarded: 10, status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-001', 'EMP-004'], comments: [],
    createdAt: new Date('2026-02-14'),
  },
  {
    recognitionId: 'REC-2026-003', recipientId: 'EMP-003', recipientName: 'Mohammed Al-Harbi', recipientDepartment: 'IT',
    giverId: 'EMP-004', giverName: 'Fahad Al-Qahtani', giverRole: 'MANAGER' as const,
    type: 'INNOVATION' as RecognitionType, category: 'INNOVATION' as RecognitionCategory,
    message: 'Mohammed proposed and built an automated report generation tool that saves the team 15+ hours per week. Brilliant initiative!',
    isPublic: true, pointsAwarded: 100, status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-001', 'EMP-002', 'EMP-005', 'EMP-006'],
    comments: [{ employeeId: 'EMP-001', employeeName: 'Ahmed Al-Rashidi', text: 'This tool is amazing — already using it every day!', createdAt: new Date('2026-02-16') }],
    createdAt: new Date('2026-02-15'),
  },
  {
    recognitionId: 'REC-2026-004', recipientId: 'EMP-005', recipientName: 'Khalid Al-Dosari', recipientDepartment: 'Operations',
    giverId: 'EMP-001', giverName: 'Ahmed Al-Rashidi', giverRole: 'PEER' as const,
    type: 'SPOT_AWARD' as RecognitionType, category: 'CUSTOMER_FOCUS' as RecognitionCategory,
    message: 'Khalid went the extra mile to resolve a critical customer issue at 10pm on a Friday. His dedication to customer satisfaction is inspiring.',
    isPublic: true, pointsAwarded: 50, status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-002', 'EMP-003', 'EMP-004'], comments: [],
    createdAt: new Date('2026-02-18'),
  },
  {
    recognitionId: 'REC-2026-005', recipientId: 'EMP-006', recipientName: 'Noura Al-Shehri', recipientDepartment: 'HR',
    giverId: 'EMP-004', giverName: 'Fahad Al-Qahtani', giverRole: 'EXECUTIVE' as const,
    type: 'MILESTONE' as RecognitionType, category: 'VALUES' as RecognitionCategory,
    message: 'Congratulations Noura on completing 5 years with the company! Your dedication and positive attitude have been a cornerstone of our HR team.',
    isPublic: true, pointsAwarded: 500,
    award: { type: 'GIFT_CARD' as AwardType, value: 500, description: 'Amazon Gift Card 500 SAR', deliveredAt: new Date('2026-02-20') },
    status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005', 'EMP-007'],
    comments: [
      { employeeId: 'EMP-002', employeeName: 'Sara Hassan', text: 'Happy anniversary Noura! Here\'s to many more years!', createdAt: new Date('2026-02-20') },
    ],
    createdAt: new Date('2026-02-20'),
  },
  {
    recognitionId: 'REC-2026-006', recipientId: 'EMP-007', recipientName: 'Ali Al-Mutairi', recipientDepartment: 'Operations',
    giverId: 'EMP-005', giverName: 'Khalid Al-Dosari', giverRole: 'PEER' as const,
    type: 'TEAMWORK' as RecognitionType, category: 'TEAMWORK' as RecognitionCategory,
    message: 'Ali took on extra responsibilities while I was on leave and kept everything running smoothly. True team player!',
    isPublic: true, pointsAwarded: 50, status: 'ACTIVE' as const, requiresApproval: false,
    likes: ['EMP-004'], comments: [],
    createdAt: new Date('2026-02-21'),
  },
];

const SEED_POINTS: Array<{ employeeId: string; totalEarned: number; totalRedeemed: number; currentBalance: number; history: any[] }> = [
  {
    employeeId: 'EMP-001', totalEarned: 260, totalRedeemed: 0, currentBalance: 260,
    history: [
      { date: new Date('2026-02-09'), type: 'EARNED', points: 200, source: 'REC-2026-001', description: 'Employee of the Month — February 2026' },
      { date: new Date('2026-01-15'), type: 'EARNED', points: 50, source: 'REC-2025-088', description: 'Perfect Attendance — January 2026' },
      { date: new Date('2026-01-05'), type: 'EARNED', points: 10, source: 'REC-2025-080', description: 'Kudos from Sara Hassan' },
    ],
  },
  {
    employeeId: 'EMP-002', totalEarned: 110, totalRedeemed: 100, currentBalance: 10,
    history: [
      { date: new Date('2026-02-14'), type: 'EARNED', points: 10, source: 'REC-2026-002', description: 'Kudos from Mohammed Al-Harbi' },
      { date: new Date('2026-01-20'), type: 'REDEEMED', points: 100, source: 'RDM-003', description: 'Redeemed: Lunch Voucher' },
      { date: new Date('2026-01-10'), type: 'EARNED', points: 100, source: 'REC-2025-075', description: 'Innovation Award' },
    ],
  },
  {
    employeeId: 'EMP-003', totalEarned: 150, totalRedeemed: 0, currentBalance: 150,
    history: [
      { date: new Date('2026-02-15'), type: 'EARNED', points: 100, source: 'REC-2026-003', description: 'Innovation Award' },
      { date: new Date('2026-01-15'), type: 'EARNED', points: 50, source: 'REC-2025-085', description: 'Perfect Attendance — January 2026' },
    ],
  },
  {
    employeeId: 'EMP-005', totalEarned: 100, totalRedeemed: 0, currentBalance: 100,
    history: [
      { date: new Date('2026-02-18'), type: 'EARNED', points: 50, source: 'REC-2026-004', description: 'Spot Award — Customer Service' },
      { date: new Date('2026-01-12'), type: 'EARNED', points: 50, source: 'REC-2025-083', description: 'Teamwork Recognition' },
    ],
  },
  {
    employeeId: 'EMP-006', totalEarned: 750, totalRedeemed: 300, currentBalance: 450,
    history: [
      { date: new Date('2026-02-20'), type: 'EARNED', points: 500, source: 'REC-2026-005', description: '5-Year Milestone Award' },
      { date: new Date('2026-02-05'), type: 'REDEEMED', points: 300, source: 'RDM-002', description: 'Redeemed: Extra Day Off' },
      { date: new Date('2026-01-10'), type: 'EARNED', points: 50, source: 'REC-2025-078', description: 'Perfect Attendance — January 2026' },
      { date: new Date('2025-12-15'), type: 'EARNED', points: 200, source: 'REC-2025-070', description: 'Employee of the Month — December 2025' },
    ],
  },
  {
    employeeId: 'EMP-007', totalEarned: 60, totalRedeemed: 0, currentBalance: 60,
    history: [
      { date: new Date('2026-02-21'), type: 'EARNED', points: 50, source: 'REC-2026-006', description: 'Teamwork Recognition' },
      { date: new Date('2026-01-05'), type: 'EARNED', points: 10, source: 'REC-2025-079', description: 'Kudos from Manager' },
    ],
  },
];

export async function ensureSeedData(db: Db, tenantId: string): Promise<void> {
  const coll = db.collection('cvision_recognitions');
  const count = await coll.countDocuments({ tenantId });
  if (count > 0) return;

  const now = new Date();
  const recs = SEED_RECOGNITIONS.map(r => ({
    tenantId,
    recipientEmployeeId: r.recipientId,
    nominatorEmployeeId: r.giverId || null,
    category: r.category,
    title: r.type,
    description: r.message,
    points: r.pointsAwarded || 0,
    status: 'active',
    createdAt: r.createdAt || now,
    updatedAt: now,
  }));
  await coll.insertMany(recs);

  const pointsColl = db.collection('cvision_reward_points');
  const pts = SEED_POINTS.flatMap(p =>
    (p.history || []).map((h: any) => ({
      tenantId,
      employeeId: p.employeeId,
      points: h.points || 0,
      reason: h.description || '',
      source: h.type === 'EARNED' ? 'recognition' : 'redemption',
      createdAt: h.date || now,
    }))
  );
  if (pts.length > 0) await pointsColl.insertMany(pts);
}

/* ── Engine Functions ──────────────────────────────────────────────── */

export function getPointsForType(type: RecognitionType): number {
  return POINT_VALUES[type] || POINT_VALUES.CUSTOM;
}

export function requiresApproval(type: RecognitionType, award?: { type: AwardType; value?: number }): boolean {
  const monetary: RecognitionType[] = ['EMPLOYEE_OF_MONTH', 'EMPLOYEE_OF_QUARTER', 'EMPLOYEE_OF_YEAR', 'SPOT_AWARD'];
  if (monetary.includes(type)) return true;
  if (award?.value && award.value > 0) return true;
  return false;
}

export async function getLeaderboard(db: Db, tenantId: string, limit = 10): Promise<any[]> {
  const points = await db.collection('cvision_reward_points')
    .find({ tenantId })
    .sort({ totalEarned: -1 })
    .limit(limit)
    .toArray();

  const employees = await db.collection('cvision_employees')
    .find({ tenantId, employeeId: { $in: points.map(p => p.employeeId) } })
    .project({ employeeId: 1, fullName: 1, department: 1, position: 1 })
    .toArray();

  const empMap = new Map(employees.map(e => [e.employeeId, e]));

  return points.map((p, i) => {
    const emp = empMap.get(p.employeeId);
    return {
      rank: i + 1,
      employeeId: p.employeeId,
      name: emp?.fullName || p.employeeId,
      department: emp?.department || '—',
      position: emp?.position || '—',
      totalEarned: p.totalEarned,
      currentBalance: p.currentBalance,
      recognitionsCount: 0,
    };
  });
}

export async function getRecognitionAnalytics(db: Db, tenantId: string) {
  const coll = db.collection('cvision_recognitions');
  const total = await coll.countDocuments({ tenantId });
  const thisMonth = await coll.countDocuments({
    tenantId,
    createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
  });

  const byType = await coll.aggregate([
    { $match: { tenantId } },
    { $group: { _id: '$type', count: { $sum: 1 }, points: { $sum: '$pointsAwarded' } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const byCategory = await coll.aggregate([
    { $match: { tenantId } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const byDepartment = await coll.aggregate([
    { $match: { tenantId } },
    { $group: { _id: '$recipientDepartment', count: { $sum: 1 }, points: { $sum: '$pointsAwarded' } } },
    { $sort: { count: -1 } },
  ]).toArray();

  const pointsColl = db.collection('cvision_reward_points');
  const pointsAgg = await pointsColl.aggregate([
    { $match: { tenantId } },
    { $group: { _id: null, totalEarned: { $sum: '$totalEarned' }, totalRedeemed: { $sum: '$totalRedeemed' }, totalBalance: { $sum: '$currentBalance' } } },
  ]).toArray();
  const pointsSummary = pointsAgg[0] || { totalEarned: 0, totalRedeemed: 0, totalBalance: 0 };

  return {
    totalRecognitions: total,
    thisMonthRecognitions: thisMonth,
    totalPointsEarned: pointsSummary.totalEarned,
    totalPointsRedeemed: pointsSummary.totalRedeemed,
    totalPointsBalance: pointsSummary.totalBalance,
    byType: byType.map(t => ({ type: t._id, label: TYPE_LABELS[t._id as RecognitionType] || t._id, count: t.count, points: t.points })),
    byCategory: byCategory.map(c => ({ category: c._id, label: CATEGORY_LABELS[c._id as RecognitionCategory] || c._id, count: c.count })),
    byDepartment: byDepartment.map(d => ({ department: d._id, count: d.count, points: d.points })),
  };
}

export async function awardPoints(db: Db, tenantId: string, employeeId: string, points: number, source: string, description: string) {
  await db.collection('cvision_reward_points').insertOne({
    tenantId, employeeId, points, reason: description, source,
    createdAt: new Date(),
  });
}

export async function redeemPoints(db: Db, tenantId: string, employeeId: string, points: number, rewardId: string, description: string): Promise<{ success: boolean; error?: string }> {
  const rec = await db.collection('cvision_reward_points').findOne({ tenantId, employeeId });
  if (!rec) return { success: false, error: 'No points record found' };
  if (rec.currentBalance < points) return { success: false, error: `Insufficient points. Balance: ${rec.currentBalance}, required: ${points}` };

  await db.collection('cvision_reward_points').updateOne(
    { tenantId, employeeId },
    {
      $inc: { totalRedeemed: points, currentBalance: -points },
      $push: { history: { $each: [{ date: new Date(), type: 'REDEEMED', points, source: rewardId, description }], $position: 0 } } as Record<string, unknown>,
      $set: { updatedAt: new Date() },
    },
  );
  return { success: true };
}
