/**
 * CVision Employee Engagement Engine
 * Suggestion box, polls, social features
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const SUGGESTION_CATEGORIES = ['PROCESS', 'CULTURE', 'TECHNOLOGY', 'FACILITY', 'BENEFIT', 'OTHER'] as const;
export const SUGGESTION_STATUSES = ['NEW', 'UNDER_REVIEW', 'ACCEPTED', 'IMPLEMENTED', 'DECLINED'] as const;
export const POLL_STATUSES = ['ACTIVE', 'CLOSED'] as const;

const SUG_COL = 'cvision_suggestions';
const POLL_COL = 'cvision_polls';

// ── Suggestions ─────────────────────────────────────────────────────────

export async function submitSuggestion(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await db.collection(SUG_COL).insertOne({
    id, tenantId, suggestionId: `SUG-${Date.now()}`,
    submittedBy: data.anonymous ? null : data.submittedBy,
    anonymous: data.anonymous || false,
    title: data.title, description: data.description,
    category: data.category || 'OTHER',
    votes: [], comments: [],
    status: 'NEW', createdAt: new Date(),
  });
  return { id };
}

export async function voteSuggestion(db: Db, tenantId: string, suggestionId: string, employeeId: string): Promise<{ success: boolean }> {
  const doc = await db.collection(SUG_COL).findOne({ tenantId, id: suggestionId });
  if (!doc) return { success: false };
  if ((doc.votes || []).includes(employeeId)) {
    await db.collection(SUG_COL).updateOne({ tenantId, id: suggestionId }, { $pull: { votes: employeeId } });
  } else {
    await db.collection(SUG_COL).updateOne({ tenantId, id: suggestionId }, { $push: { votes: employeeId } });
  }
  return { success: true };
}

export async function commentSuggestion(db: Db, tenantId: string, suggestionId: string, data: any): Promise<{ success: boolean }> {
  await db.collection(SUG_COL).updateOne({ tenantId, id: suggestionId }, {
    $push: { comments: { employeeId: data.employeeId, text: data.text, date: new Date() } },
  });
  return { success: true };
}

export async function respondSuggestion(db: Db, tenantId: string, suggestionId: string, response: string, status: string, respondedBy: string): Promise<{ success: boolean }> {
  await db.collection(SUG_COL).updateOne({ tenantId, id: suggestionId }, {
    $set: { response, status, respondedBy },
  });
  return { success: true };
}

export async function listSuggestions(db: Db, tenantId: string, filters: any = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  return db.collection(SUG_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getMySuggestions(db: Db, tenantId: string, employeeId: string): Promise<any[]> {
  return db.collection(SUG_COL).find({ tenantId, submittedBy: employeeId }).sort({ createdAt: -1 }).toArray();
}

export async function getTrending(db: Db, tenantId: string): Promise<any[]> {
  const suggestions = await db.collection(SUG_COL).find({ tenantId, status: { $in: ['NEW', 'UNDER_REVIEW'] } }).toArray();
  return suggestions.sort((a: any, b: any) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 10);
}

// ── Polls ────────────────────────────────────────────────────────────────

export async function createPoll(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  const options = (data.options || []).map((text: string) => ({ id: uuidv4(), text, votes: 0 }));
  await db.collection(POLL_COL).insertOne({
    id, tenantId, question: data.question, options,
    voters: [], anonymous: data.anonymous || false,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE', createdBy: data.createdBy, createdAt: new Date(),
  });
  return { id };
}

export async function votePoll(db: Db, tenantId: string, pollId: string, optionId: string, employeeId: string): Promise<{ success: boolean }> {
  const poll = await db.collection(POLL_COL).findOne({ tenantId, id: pollId });
  if (!poll || poll.status !== 'ACTIVE') return { success: false };
  if ((poll.voters || []).includes(employeeId)) return { success: false };
  await db.collection(POLL_COL).updateOne(
    { tenantId, id: pollId, 'options.id': optionId },
    { $inc: { 'options.$.votes': 1 }, $push: { voters: employeeId } },
  );
  return { success: true };
}

export async function closePoll(db: Db, tenantId: string, pollId: string): Promise<{ success: boolean }> {
  await db.collection(POLL_COL).updateOne({ tenantId, id: pollId }, { $set: { status: 'CLOSED' } });
  return { success: true };
}

export async function listPolls(db: Db, tenantId: string, status?: string): Promise<any[]> {
  const query: any = { tenantId };
  if (status) query.status = status;
  return db.collection(POLL_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const suggestions = await db.collection(SUG_COL).countDocuments({ tenantId });
  const newSuggestions = await db.collection(SUG_COL).countDocuments({ tenantId, status: 'NEW' });
  const implemented = await db.collection(SUG_COL).countDocuments({ tenantId, status: 'IMPLEMENTED' });
  const activePolls = await db.collection(POLL_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  return { totalSuggestions: suggestions, newSuggestions, implemented, activePolls };
}
