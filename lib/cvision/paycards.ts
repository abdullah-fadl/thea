/**
 * CVision Paycard / Prepaid Card Engine
 *
 * Handles:
 *  - Card issuance & lifecycle
 *  - Fund loading (payroll / manual / advance)
 *  - Balance tracking
 *  - Block / unblock / cancel / replace
 *  - Bulk loading from payroll runs
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface Paycard {
  _id?: string;
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  provider: 'PAYIT' | 'STCPAY' | 'MADA' | 'CUSTOM';
  cardNumber: string;
  cardStatus: 'ACTIVE' | 'BLOCKED' | 'EXPIRED' | 'CANCELLED';
  currentBalance: number;
  lastLoadDate?: Date;
  lastLoadAmount?: number;
  loadHistory: LoadEntry[];
  issuedDate: Date;
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadEntry {
  id: string;
  date: Date;
  amount: number;
  source: 'PAYROLL' | 'MANUAL' | 'ADVANCE';
  reference: string;
  payrollMonth?: string;
}

// ── Constants ───────────────────────────────────────────────────────────

export const PROVIDERS = [
  { value: 'PAYIT', label: 'PayIT' },
  { value: 'STCPAY', label: 'STC Pay' },
  { value: 'MADA', label: 'Mada' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const CARD_STATUSES = [
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-red-100 text-red-700' },
  { value: 'EXPIRED', label: 'Expired', color: 'bg-gray-100 text-gray-500' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
] as const;

export const LOAD_SOURCES = [
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'ADVANCE', label: 'Advance' },
] as const;

// ── Card CRUD ────────────────────────────────────────────────────────────

export async function issueCard(db: Db, tenantId: string, data: any): Promise<{ id: string; cardNumber: string }> {
  const now = new Date();
  const id = uuidv4();
  const last4 = String(Math.floor(1000 + Math.random() * 9000));
  const cardNumber = `**** **** **** ${last4}`;
  const expiryDate = new Date(now.getTime() + 3 * 365.25 * 86400000); // 3 years

  const doc = {
    id, tenantId,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    provider: data.provider || 'MADA',
    cardNumber,
    cardStatus: 'ACTIVE',
    currentBalance: 0,
    lastLoadDate: null,
    lastLoadAmount: null,
    loadHistory: [],
    issuedDate: now,
    expiryDate,
    createdAt: now, updatedAt: now,
  };

  await db.collection('cvision_paycards').insertOne(doc);
  return { id, cardNumber };
}

export async function loadFunds(
  db: Db, tenantId: string, cardId: string, amount: number, source: string, reference: string, payrollMonth?: string,
): Promise<{ success: boolean; error?: string; newBalance?: number }> {
  const card = await db.collection('cvision_paycards').findOne({ tenantId, $or: [{ id: cardId }, { employeeId: cardId }] });
  if (!card) return { success: false, error: 'Card not found' };
  if (card.cardStatus !== 'ACTIVE') return { success: false, error: 'Card is not active' };

  const now = new Date();
  const entry: LoadEntry = {
    id: uuidv4(), date: now, amount,
    source: String(source || 'MANUAL') as any,
    reference: reference || `LOAD-${Date.now()}`,
    payrollMonth,
  };

  const newBalance = (card.currentBalance || 0) + amount;

  await db.collection('cvision_paycards').updateOne(
    { _id: card._id, tenantId },
    {
      $set: { currentBalance: newBalance, lastLoadDate: now, lastLoadAmount: amount, updatedAt: now },
      $push: { loadHistory: entry } as Record<string, unknown>,
    },
  );
  return { success: true, newBalance };
}

export async function blockCard(db: Db, tenantId: string, cardId: string): Promise<{ success: boolean }> {
  await db.collection('cvision_paycards').updateOne(
    { tenantId, $or: [{ id: cardId }, { employeeId: cardId }], cardStatus: 'ACTIVE' },
    { $set: { cardStatus: 'BLOCKED', updatedAt: new Date() } },
  );
  return { success: true };
}

export async function unblockCard(db: Db, tenantId: string, cardId: string): Promise<{ success: boolean }> {
  await db.collection('cvision_paycards').updateOne(
    { tenantId, $or: [{ id: cardId }, { employeeId: cardId }], cardStatus: 'BLOCKED' },
    { $set: { cardStatus: 'ACTIVE', updatedAt: new Date() } },
  );
  return { success: true };
}

export async function cancelCard(db: Db, tenantId: string, cardId: string): Promise<{ success: boolean }> {
  await db.collection('cvision_paycards').updateOne(
    { tenantId, $or: [{ id: cardId }, { employeeId: cardId }] },
    { $set: { cardStatus: 'CANCELLED', updatedAt: new Date() } },
  );
  return { success: true };
}

export async function replaceCard(db: Db, tenantId: string, cardId: string): Promise<{ id: string; cardNumber: string }> {
  const old = await db.collection('cvision_paycards').findOne({ tenantId, $or: [{ id: cardId }, { employeeId: cardId }] });
  if (!old) throw new Error('Card not found');

  // Cancel old
  await db.collection('cvision_paycards').updateOne({ _id: old._id, tenantId }, { $set: { cardStatus: 'CANCELLED', updatedAt: new Date() } });

  // Issue new with same balance
  const result = await issueCard(db, tenantId, { employeeId: old.employeeId, employeeName: old.employeeName, provider: old.provider });

  // Transfer balance
  if (old.currentBalance > 0) {
    await loadFunds(db, tenantId, result.id, old.currentBalance, 'MANUAL', `Transfer from ${old.cardNumber}`);
  }

  return result;
}

export async function bulkLoad(
  db: Db, tenantId: string, loads: { employeeId: string; amount: number }[], payrollMonth: string,
): Promise<{ loaded: number; failed: number }> {
  let loaded = 0;
  let failed = 0;

  for (const load of loads) {
    const result = await loadFunds(db, tenantId, load.employeeId, load.amount, 'PAYROLL', `PAYROLL-${payrollMonth}`, payrollMonth);
    if (result.success) loaded++;
    else failed++;
  }

  return { loaded, failed };
}

// ── Queries ──────────────────────────────────────────────────────────────

export async function listCards(db: Db, tenantId: string, filters: { status?: string; provider?: string } = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.cardStatus = filters.status;
  if (filters.provider) query.provider = filters.provider;
  return db.collection('cvision_paycards').find(query).sort({ createdAt: -1 }).limit(1000).toArray();
}

export async function getEmployeeCard(db: Db, tenantId: string, employeeId: string): Promise<any> {
  return db.collection('cvision_paycards').findOne({ tenantId, employeeId, cardStatus: { $ne: 'CANCELLED' } });
}

export async function getLoadHistory(db: Db, tenantId: string, cardId: string): Promise<any[]> {
  const card = await db.collection('cvision_paycards').findOne({ tenantId, $or: [{ id: cardId }, { employeeId: cardId }] });
  return card?.loadHistory || [];
}

export async function getStats(db: Db, tenantId: string) {
  const all = await db.collection('cvision_paycards').find({ tenantId }).toArray();
  const active = all.filter((c: any) => c.cardStatus === 'ACTIVE');
  const totalBalance = active.reduce((s: number, c: any) => s + (c.currentBalance || 0), 0);
  const totalLoaded = all.reduce((s: number, c: any) =>
    s + (c.loadHistory || []).reduce((ls: number, l: any) => ls + (l.amount || 0), 0), 0);

  return {
    totalCards: all.length,
    activeCards: active.length,
    blockedCards: all.filter((c: any) => c.cardStatus === 'BLOCKED').length,
    totalBalance,
    totalLoaded,
    avgBalance: active.length ? Math.round(totalBalance / active.length) : 0,
  };
}
