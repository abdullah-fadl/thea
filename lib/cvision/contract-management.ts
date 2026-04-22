/**
 * CVision Contract Management Engine
 * Full contract lifecycle: create, sign, amend, renew, terminate
 * Templates, e-signature, renewal queue
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { generateSequenceNumber } from '@/lib/cvision/db';

export const CONTRACT_TYPES = ['UNLIMITED', 'LIMITED', 'PART_TIME', 'PROBATION', 'CONTRACTOR', 'INTERNSHIP', 'SEASONAL'] as const;
export const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED'] as const;
export const RENEWAL_STATUSES = ['NOT_DUE', 'DUE_SOON', 'PENDING_RENEWAL', 'RENEWED', 'NOT_RENEWED'] as const;
export const ESIG_STATUSES = ['PENDING', 'SIGNED', 'REJECTED'] as const;
export const TEMPLATE_LANGS = ['EN', 'AR', 'BOTH'] as const;

const CTR_COL = 'cvision_contracts_v2';
const TPL_COL = 'cvision_contract_templates';

export async function createContract(db: Db, tenantId: string, data: any): Promise<{ id: string; contractId: string }> {
  const id = uuidv4();
  const contractId = await generateSequenceNumber(tenantId, 'CTR');
  const now = new Date();
  await db.collection(CTR_COL).insertOne({
    id, tenantId, contractId,
    employeeId: data.employeeId, employeeName: data.employeeName,
    type: data.type || 'UNLIMITED',
    startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null,
    probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
    terms: data.terms || {},
    templateId: data.templateId, generatedDocUrl: data.generatedDocUrl,
    signedByEmployee: false, signedByCompany: false,
    eSignatureStatus: 'PENDING', amendments: [],
    renewalStatus: 'NOT_DUE', status: 'DRAFT',
    createdAt: now, updatedAt: now,
  });
  return { id, contractId };
}

export async function generateFromTemplate(db: Db, tenantId: string, templateId: string, employeeData: any): Promise<{ html: string }> {
  const template = await db.collection(TPL_COL).findOne({ tenantId, id: templateId });
  if (!template) return { html: '' };
  let html = template.bodyTemplate || '';
  for (const [key, value] of Object.entries(employeeData)) {
    const ek = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); html = html.replace(new RegExp(`\\{\\{${ek}\\}\\}`, 'g'), String(value || ''));
  }
  return { html };
}

export async function signContract(db: Db, tenantId: string, contractId: string, signer: 'employee' | 'company', signedBy?: string): Promise<{ success: boolean }> {
  const updates: any = { updatedAt: new Date() };
  if (signer === 'employee') { updates.signedByEmployee = true; updates.signedByEmployeeAt = new Date(); }
  if (signer === 'company') { updates.signedByCompany = true; updates.signedByCompanyAt = new Date(); updates.signedByCompanyPerson = signedBy; }
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: updates });
  // If both signed, activate
  const doc = await db.collection(CTR_COL).findOne({ tenantId, id: contractId });
  if (doc?.signedByEmployee && updates.signedByCompany || doc?.signedByCompany && updates.signedByEmployee) {
    await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: { status: 'ACTIVE' } });
  }
  return { success: true };
}

export async function amendContract(db: Db, tenantId: string, contractId: string, data: any): Promise<{ amendmentId: string }> {
  const amendmentId = uuidv4();
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, {
    $push: { amendments: { amendmentId, date: new Date(), description: data.description, oldTerms: data.oldTerms || {}, newTerms: data.newTerms || {}, signedByEmployee: false, signedByCompany: false, documentUrl: data.documentUrl } } as Record<string, unknown>,
    $set: { updatedAt: new Date() },
  });
  if (data.newTerms) {
    const termUpdates: any = {};
    for (const [k, v] of Object.entries(data.newTerms)) termUpdates[`terms.${k}`] = v;
    if (Object.keys(termUpdates).length > 0) {
      await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: termUpdates });
    }
  }
  return { amendmentId };
}

export async function renewContract(db: Db, tenantId: string, contractId: string, newEndDate: string): Promise<{ newContractId: string }> {
  const old = await db.collection(CTR_COL).findOne({ tenantId, id: contractId });
  if (!old) return { newContractId: '' };
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: { status: 'RENEWED', renewalStatus: 'RENEWED', updatedAt: new Date() } });
  const result = await createContract(db, tenantId, {
    ...old, startDate: old.endDate || new Date(), endDate: newEndDate, status: 'DRAFT',
  });
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: { renewedContractId: result.id } });
  return { newContractId: result.contractId };
}

export async function terminateContract(db: Db, tenantId: string, contractId: string): Promise<{ success: boolean }> {
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: { status: 'TERMINATED', updatedAt: new Date() } });
  return { success: true };
}

export async function sendForSignature(db: Db, tenantId: string, contractId: string): Promise<{ success: boolean }> {
  await db.collection(CTR_COL).updateOne({ tenantId, id: contractId }, { $set: { eSignatureStatus: 'PENDING', updatedAt: new Date() } });
  return { success: true };
}

export async function createTemplate(db: Db, tenantId: string, data: any): Promise<{ id: string }> {
  const id = uuidv4();
  await db.collection(TPL_COL).insertOne({
    id, tenantId, name: data.name, nameAr: data.nameAr, type: data.type,
    language: data.language || 'EN', bodyTemplate: data.bodyTemplate || '',
    variables: data.variables || [], status: 'ACTIVE', version: 1, createdAt: new Date(),
  });
  return { id };
}

// Queries
export async function listContracts(db: Db, tenantId: string, filters: any = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  return db.collection(CTR_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getContractDetail(db: Db, tenantId: string, contractId: string): Promise<any> {
  return db.collection(CTR_COL).findOne({ tenantId, $or: [{ id: contractId }, { contractId }] });
}

export async function getEmployeeContracts(db: Db, tenantId: string, employeeId: string): Promise<any[]> {
  return db.collection(CTR_COL).find({ tenantId, employeeId }).sort({ startDate: -1 }).toArray();
}

export async function getExpiring(db: Db, tenantId: string, days: number = 90): Promise<any[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return db.collection(CTR_COL).find({
    tenantId, status: 'ACTIVE', endDate: { $lte: cutoff, $gte: new Date() },
  }).sort({ endDate: 1 }).toArray();
}

export async function getRenewalQueue(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(CTR_COL).find({
    tenantId, renewalStatus: { $in: ['DUE_SOON', 'PENDING_RENEWAL'] },
  }).sort({ endDate: 1 }).toArray();
}

export async function listTemplates(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(TPL_COL).find({ tenantId }).sort({ name: 1 }).toArray();
}

export async function getStats(db: Db, tenantId: string) {
  const total = await db.collection(CTR_COL).countDocuments({ tenantId });
  const active = await db.collection(CTR_COL).countDocuments({ tenantId, status: 'ACTIVE' });
  const drafts = await db.collection(CTR_COL).countDocuments({ tenantId, status: 'DRAFT' });
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 90);
  const expiring = await db.collection(CTR_COL).countDocuments({ tenantId, status: 'ACTIVE', endDate: { $lte: cutoff, $gte: new Date() } });
  const templates = await db.collection(TPL_COL).countDocuments({ tenantId });
  return { total, active, drafts, expiringSoon: expiring, templates };
}
