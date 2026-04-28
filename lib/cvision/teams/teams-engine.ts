import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type TeamType = 'PERMANENT' | 'PROJECT' | 'CROSS_FUNCTIONAL' | 'TASK_FORCE';
export type MemberRole = 'LEAD' | 'CO_LEAD' | 'MEMBER' | 'ADVISOR';
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type TeamStatus = 'ACTIVE' | 'COMPLETED' | 'DISSOLVED';

const TEAMS_COLL = 'cvision_teams';

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_TEAMS = [
  {
    teamId: 'TM-001', name: 'Digital Transformation', nameAr: 'التحول الرقمي',
    description: 'Cross-functional team driving digital transformation initiatives',
    type: 'CROSS_FUNCTIONAL' as TeamType,
    leaderId: 'EMP-015', leaderName: 'Ali Al-Mutairi',
    members: [
      { employeeId: 'EMP-015', employeeName: 'Ali Al-Mutairi', role: 'LEAD' as MemberRole, department: 'IT', joinedAt: new Date(2026, 0, 1), allocation: 50 },
      { employeeId: 'EMP-001', employeeName: 'Ahmed Hassan', role: 'MEMBER' as MemberRole, department: 'HR', joinedAt: new Date(2026, 0, 1), allocation: 30 },
      { employeeId: 'EMP-020', employeeName: 'Omar Al-Sheikh', role: 'MEMBER' as MemberRole, department: 'Finance', joinedAt: new Date(2026, 0, 1), allocation: 30 },
      { employeeId: 'EMP-010', employeeName: 'Sara Al-Dosari', role: 'MEMBER' as MemberRole, department: 'Operations', joinedAt: new Date(2026, 0, 15), allocation: 40 },
      { employeeId: 'EMP-025', employeeName: 'Dr. Nasser', role: 'ADVISOR' as MemberRole, department: 'Management', joinedAt: new Date(2026, 0, 1), allocation: 10 },
    ],
    goals: [
      { goalId: 'G-001', description: 'Implement employee self-service portal', targetDate: new Date(2026, 3, 30), progress: 65, status: 'IN_PROGRESS' as GoalStatus },
      { goalId: 'G-002', description: 'Migrate paper forms to digital workflows', targetDate: new Date(2026, 5, 30), progress: 30, status: 'IN_PROGRESS' as GoalStatus },
      { goalId: 'G-003', description: 'Deploy mobile app for field employees', targetDate: new Date(2026, 8, 30), progress: 0, status: 'NOT_STARTED' as GoalStatus },
    ],
    budget: { allocated: 250000, spent: 95000, remaining: 155000 },
    projectName: 'Digital Transformation 2026', projectDeadline: new Date(2026, 11, 31),
    status: 'ACTIVE' as TeamStatus, startDate: new Date(2026, 0, 1),
  },
  {
    teamId: 'TM-002', name: 'Safety Committee', nameAr: 'لجنة السلامة',
    description: 'Permanent safety oversight committee',
    type: 'PERMANENT' as TeamType,
    leaderId: 'EMP-050', leaderName: 'Nasser Al-Saud',
    members: [
      { employeeId: 'EMP-050', employeeName: 'Nasser Al-Saud', role: 'LEAD' as MemberRole, department: 'Operations', joinedAt: new Date(2025, 0, 1), allocation: 20 },
      { employeeId: 'EMP-040', employeeName: 'Saeed Al-Ghamdi', role: 'MEMBER' as MemberRole, department: 'Warehouse', joinedAt: new Date(2025, 0, 1), allocation: 15 },
      { employeeId: 'EMP-005', employeeName: 'Fatima Al-Zahrani', role: 'MEMBER' as MemberRole, department: 'HR', joinedAt: new Date(2025, 0, 1), allocation: 10 },
    ],
    goals: [
      { goalId: 'G-004', description: 'Zero major incidents in 2026', targetDate: new Date(2026, 11, 31), progress: 100, status: 'IN_PROGRESS' as GoalStatus },
      { goalId: 'G-005', description: 'Complete quarterly fire drills', targetDate: new Date(2026, 11, 31), progress: 25, status: 'IN_PROGRESS' as GoalStatus },
    ],
    budget: { allocated: 50000, spent: 12000, remaining: 38000 },
    status: 'ACTIVE' as TeamStatus, startDate: new Date(2025, 0, 1),
  },
  {
    teamId: 'TM-003', name: 'Saudization Task Force', nameAr: 'فريق عمل السعودة',
    description: 'Task force to improve Saudization rates',
    type: 'TASK_FORCE' as TeamType,
    leaderId: 'EMP-001', leaderName: 'Ahmed Hassan',
    members: [
      { employeeId: 'EMP-001', employeeName: 'Ahmed Hassan', role: 'LEAD' as MemberRole, department: 'HR', joinedAt: new Date(2026, 0, 15), allocation: 40 },
      { employeeId: 'EMP-003', employeeName: 'Layla Al-Rashed', role: 'CO_LEAD' as MemberRole, department: 'HR', joinedAt: new Date(2026, 0, 15), allocation: 30 },
      { employeeId: 'EMP-060', employeeName: 'Turki Al-Otaibi', role: 'MEMBER' as MemberRole, department: 'Recruitment', joinedAt: new Date(2026, 0, 20), allocation: 50 },
    ],
    goals: [
      { goalId: 'G-006', description: 'Reach 35% Saudization by Q3', targetDate: new Date(2026, 8, 30), progress: 45, status: 'IN_PROGRESS' as GoalStatus },
      { goalId: 'G-007', description: 'Launch graduate training program', targetDate: new Date(2026, 3, 30), progress: 80, status: 'IN_PROGRESS' as GoalStatus },
    ],
    budget: { allocated: 100000, spent: 35000, remaining: 65000 },
    projectDeadline: new Date(2026, 11, 31),
    status: 'ACTIVE' as TeamStatus, startDate: new Date(2026, 0, 15),
  },
];

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(TEAMS_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;
  const now = new Date();
  await coll.insertMany(SEED_TEAMS.map(t => ({ ...t, tenantId, createdAt: now, updatedAt: now })));
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function listTeams(db: Db, tenantId: string, status?: string) {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(TEAMS_COLL).find(query).sort({ teamId: 1 }).toArray();
}

export async function getTeamDetail(db: Db, tenantId: string, teamId: string) {
  return db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
}

export async function getMyTeams(db: Db, tenantId: string, employeeId: string) {
  return db.collection(TEAMS_COLL).find({ tenantId, 'members.employeeId': employeeId, status: 'ACTIVE' }).toArray();
}

export async function getTeamMembers(db: Db, tenantId: string, teamId: string) {
  const team = await db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
  return team?.members || [];
}

export async function getTeamPerformance(db: Db, tenantId: string, teamId: string) {
  const team = await db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
  if (!team) return null;
  const goals = team.goals || [];
  const totalGoals = goals.length;
  const completed = goals.filter((g: any) => g.status === 'COMPLETED').length;
  const avgProgress = totalGoals > 0 ? Math.round(goals.reduce((s: number, g: any) => s + (g.progress || 0), 0) / totalGoals) : 0;
  const budgetUsed = team.budget ? Math.round((team.budget.spent / team.budget.allocated) * 100) : 0;
  return { teamId, teamName: team.name, totalGoals, completedGoals: completed, avgProgress, budgetUsed, memberCount: team.members?.length || 0 };
}

export async function getResourceAllocation(db: Db, tenantId: string) {
  const teams = await db.collection(TEAMS_COLL).find({ tenantId, status: 'ACTIVE' }).toArray();
  const employeeMap: any = {};
  for (const t of teams) {
    for (const m of t.members || []) {
      if (!employeeMap[m.employeeId]) employeeMap[m.employeeId] = { employeeId: m.employeeId, employeeName: m.employeeName, department: m.department, totalAllocation: 0, teams: [] };
      employeeMap[m.employeeId].totalAllocation += m.allocation;
      employeeMap[m.employeeId].teams.push({ teamId: t.teamId, teamName: t.name, allocation: m.allocation, role: m.role });
    }
  }
  const employees = Object.values(employeeMap);
  const overAllocated = employees.filter((e: any) => e.totalAllocation > 100);
  return { employees, overAllocated, totalTeams: teams.length };
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function createTeam(db: Db, tenantId: string, data: any) {
  const count = await db.collection(TEAMS_COLL).countDocuments({ tenantId });
  const teamId = `TM-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(TEAMS_COLL).insertOne({
    ...data, tenantId, teamId, members: data.members || [], goals: data.goals || [],
    status: 'ACTIVE', startDate: new Date(), createdAt: now, updatedAt: now,
  });
  return teamId;
}

export async function updateTeam(db: Db, tenantId: string, teamId: string, updates: any) {
  await db.collection(TEAMS_COLL).updateOne({ tenantId, teamId }, { $set: { ...updates, updatedAt: new Date() } });
}

export async function addMember(db: Db, tenantId: string, teamId: string, member: any) {
  await db.collection(TEAMS_COLL).updateOne(
    { tenantId, teamId },
    { $push: { members: { ...member, joinedAt: new Date() } } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
}

export async function removeMember(db: Db, tenantId: string, teamId: string, employeeId: string) {
  await db.collection(TEAMS_COLL).updateOne(
    { tenantId, teamId },
    { $pull: { members: { employeeId } } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
}

export async function setGoal(db: Db, tenantId: string, teamId: string, goal: any) {
  const team = await db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
  const goalId = `G-${String((team?.goals?.length || 0) + 1).padStart(3, '0')}`;
  await db.collection(TEAMS_COLL).updateOne(
    { tenantId, teamId },
    { $push: { goals: { ...goal, goalId, progress: 0, status: 'NOT_STARTED' } } as Record<string, unknown>, $set: { updatedAt: new Date() } },
  );
  return goalId;
}

export async function updateGoal(db: Db, tenantId: string, teamId: string, goalId: string, updates: any) {
  const team = await db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
  if (!team) return;
  const goals = (team.goals || []).map((g: any) => g.goalId === goalId ? { ...g, ...updates } : g);
  await db.collection(TEAMS_COLL).updateOne({ tenantId, teamId }, { $set: { goals, updatedAt: new Date() } });
}

export async function dissolveTeam(db: Db, tenantId: string, teamId: string) {
  await db.collection(TEAMS_COLL).updateOne({ tenantId, teamId }, { $set: { status: 'DISSOLVED', endDate: new Date(), updatedAt: new Date() } });
}

export async function transferLead(db: Db, tenantId: string, teamId: string, newLeaderId: string, newLeaderName: string) {
  const team = await db.collection(TEAMS_COLL).findOne({ tenantId, teamId });
  if (!team) return;
  const members = (team.members || []).map((m: any) => {
    if (m.employeeId === team.leaderId) return { ...m, role: 'MEMBER' };
    if (m.employeeId === newLeaderId) return { ...m, role: 'LEAD' };
    return m;
  });
  await db.collection(TEAMS_COLL).updateOne(
    { tenantId, teamId },
    { $set: { leaderId: newLeaderId, leaderName: newLeaderName, members, updatedAt: new Date() } },
  );
}
