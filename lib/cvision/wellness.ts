/**
 * CVision Employee Wellness Engine
 * Challenges, mood tracking, wellness points, burnout detection
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const CHALLENGE_TYPES = ['STEPS', 'EXERCISE', 'WATER', 'SLEEP', 'MEDITATION', 'READING', 'CUSTOM'] as const;
export const RESOURCE_CATEGORIES = ['MENTAL_HEALTH', 'NUTRITION', 'FITNESS', 'STRESS', 'ERGONOMICS'] as const;
export const RESOURCE_TYPES = ['ARTICLE', 'VIDEO', 'LINK', 'CONTACT'] as const;
export const MOOD_EMOJIS: Record<number, string> = { 1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' };

const PROG_COL = 'cvision_wellness_programs';
const EMP_COL = 'cvision_employee_wellness';

async function ensureProgram(db: Db, tenantId: string) {
  const exists = await db.collection(PROG_COL).findOne({ tenantId });
  if (!exists) {
    await db.collection(PROG_COL).insertOne({
      tenantId, activeChallenges: [], resources: [], updatedAt: new Date(),
    });
  }
}

async function ensureEmployeeWellness(db: Db, tenantId: string, employeeId: string) {
  const exists = await db.collection(EMP_COL).findOne({ tenantId, employeeId });
  if (!exists) {
    await db.collection(EMP_COL).insertOne({
      tenantId, employeeId, moodLog: [], wellnessPoints: 0, pointsHistory: [], screenings: [],
    });
  }
}

export async function logMood(db: Db, tenantId: string, employeeId: string, mood: number, notes?: string): Promise<{ success: boolean }> {
  await ensureEmployeeWellness(db, tenantId, employeeId);
  await db.collection(EMP_COL).updateOne({ tenantId, employeeId }, {
    $push: { moodLog: { date: new Date(), mood, notes } },
    $inc: { wellnessPoints: 5 },
  });
  await db.collection(EMP_COL).updateOne({ tenantId, employeeId }, {
    $push: { pointsHistory: { date: new Date(), points: 5, source: 'Mood Log' } },
  });
  return { success: true };
}

export async function createChallenge(db: Db, tenantId: string, data: any): Promise<{ challengeId: string }> {
  await ensureProgram(db, tenantId);
  const challengeId = uuidv4();
  await db.collection(PROG_COL).updateOne({ tenantId }, {
    $push: { activeChallenges: { challengeId, name: data.name, type: data.type || 'CUSTOM', startDate: new Date(data.startDate), endDate: new Date(data.endDate), target: data.target || 10000, unit: data.unit || 'steps', participants: [], reward: data.reward } },
    $set: { updatedAt: new Date() },
  });
  return { challengeId };
}

export async function joinChallenge(db: Db, tenantId: string, challengeId: string, employeeId: string, employeeName: string): Promise<{ success: boolean }> {
  await db.collection(PROG_COL).updateOne(
    { tenantId, 'activeChallenges.challengeId': challengeId },
    { $push: { 'activeChallenges.$.participants': { employeeId, employeeName, currentProgress: 0, lastUpdate: new Date() } } },
  );
  return { success: true };
}

export async function updateProgress(db: Db, tenantId: string, challengeId: string, employeeId: string, progress: number): Promise<{ success: boolean }> {
  await db.collection(PROG_COL).updateOne(
    { tenantId, 'activeChallenges.challengeId': challengeId },
    { $set: { 'activeChallenges.$[c].participants.$[p].currentProgress': progress, 'activeChallenges.$[c].participants.$[p].lastUpdate': new Date() } },
    { arrayFilters: [{ 'c.challengeId': challengeId }, { 'p.employeeId': employeeId }] },
  );
  await ensureEmployeeWellness(db, tenantId, employeeId);
  await db.collection(EMP_COL).updateOne({ tenantId, employeeId }, {
    $inc: { wellnessPoints: 2 },
    $push: { pointsHistory: { date: new Date(), points: 2, source: 'Challenge Progress' } },
  });
  return { success: true };
}

export async function addResource(db: Db, tenantId: string, data: any): Promise<{ success: boolean }> {
  await ensureProgram(db, tenantId);
  await db.collection(PROG_COL).updateOne({ tenantId }, {
    $push: { resources: { title: data.title, category: data.category, type: data.type || 'ARTICLE', url: data.url, content: data.content } },
    $set: { updatedAt: new Date() },
  });
  return { success: true };
}

export async function calculateBurnout(db: Db, tenantId: string, employeeId: string): Promise<{ score: number }> {
  await ensureEmployeeWellness(db, tenantId, employeeId);
  const wellness = await db.collection(EMP_COL).findOne({ tenantId, employeeId });
  const recentMoods = (wellness?.moodLog || []).slice(-30);
  const avgMood = recentMoods.length > 0 ? recentMoods.reduce((s: number, m: any) => s + m.mood, 0) / recentMoods.length : 3;
  const burnoutScore = Math.max(0, Math.min(100, Math.round((5 - avgMood) * 25)));
  await db.collection(EMP_COL).updateOne({ tenantId, employeeId }, {
    $set: { burnoutScore, lastCalculated: new Date() },
  });
  return { score: burnoutScore };
}

// Queries
export async function getPrograms(db: Db, tenantId: string): Promise<any> {
  await ensureProgram(db, tenantId);
  return db.collection(PROG_COL).findOne({ tenantId });
}

export async function getMyWellness(db: Db, tenantId: string, employeeId: string): Promise<any> {
  await ensureEmployeeWellness(db, tenantId, employeeId);
  return db.collection(EMP_COL).findOne({ tenantId, employeeId });
}

export async function getChallenges(db: Db, tenantId: string): Promise<any[]> {
  const prog = await db.collection(PROG_COL).findOne({ tenantId });
  return prog?.activeChallenges || [];
}

export async function getLeaderboard(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(EMP_COL).find({ tenantId }).sort({ wellnessPoints: -1 }).limit(20).toArray();
}

export async function getResources(db: Db, tenantId: string, category?: string): Promise<any[]> {
  const prog = await db.collection(PROG_COL).findOne({ tenantId });
  const resources = prog?.resources || [];
  if (category) return resources.filter((r: any) => r.category === category);
  return resources;
}

export async function getMoodTrends(db: Db, tenantId: string): Promise<any> {
  const all = await db.collection(EMP_COL).find({ tenantId }).toArray();
  const last30 = new Date(); last30.setDate(last30.getDate() - 30);
  const recentMoods: number[] = [];
  for (const e of all) {
    for (const m of (e.moodLog || [])) {
      if (new Date(m.date) >= last30) recentMoods.push(m.mood);
    }
  }
  const avg = recentMoods.length > 0 ? recentMoods.reduce((s, m) => s + m, 0) / recentMoods.length : 0;
  return { averageMood: Math.round(avg * 10) / 10, totalEntries: recentMoods.length, distribution: { 1: recentMoods.filter(m => m === 1).length, 2: recentMoods.filter(m => m === 2).length, 3: recentMoods.filter(m => m === 3).length, 4: recentMoods.filter(m => m === 4).length, 5: recentMoods.filter(m => m === 5).length } };
}

export async function getBurnoutReport(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(EMP_COL).find({ tenantId, burnoutScore: { $exists: true, $gt: 50 } }).sort({ burnoutScore: -1 }).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const prog = await db.collection(PROG_COL).findOne({ tenantId });
  const participants = await db.collection(EMP_COL).countDocuments({ tenantId });
  return {
    activeChallenges: (prog?.activeChallenges || []).length,
    resources: (prog?.resources || []).length,
    participants,
  };
}
