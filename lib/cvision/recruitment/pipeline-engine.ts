import { logger } from '@/lib/monitoring/logger';
/**
 * Recruitment Pipeline Engine
 *
 * Manages the full candidate lifecycle from application to hire, with:
 * - Configurable pipeline stages with SLA tracking
 * - Stage history & transition audit trail
 * - Auto-actions on stage entry/exit
 * - Candidate-to-employee conversion
 * - Rejection with reason tracking
 * - Offer letter generation & management
 * - Recruitment analytics
 */

import { Collection, Db, ObjectId } from '@/lib/cvision/infra/mongo-compat';

// ── Types ──────────────────────────────────────────────────────

export interface PipelineStage {
  id: string;
  name: string;
  nameAr?: string;
  order: number;
  type: 'SCREENING' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'CUSTOM';
  isRequired: boolean;
  autoActions?: { onEnter?: string[]; onExit?: string[] };
  daysLimit?: number;
  color?: string;
}

export interface StageHistoryEntry {
  from: string | null;
  to: string;
  movedBy: string;
  movedAt: Date;
  notes?: string;
  daysInPreviousStage: number;
}

export interface OfferLetter {
  id: string;
  tenantId: string;
  candidateId: string;
  requisitionId: string;
  position: string;
  department: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherBenefits: string[];
  startDate: string;
  probationDays: number;
  workingHours: string;
  annualLeaveDays: number;
  currency: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN';
  sentAt?: Date;
  respondedAt?: Date;
  expiresAt: Date;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecruitmentMetrics {
  pipeline: { stage: string; stageName: string; count: number; color: string }[];
  timeToHire: { avgDays: number; byDepartment: { dept: string; avgDays: number }[] };
  sourceEffectiveness: { source: string; applied: number; hired: number; conversionRate: number }[];
  offerAcceptanceRate: number;
  openPositions: number;
  candidatesInPipeline: number;
  hiredThisMonth: number;
  rejectedThisMonth: number;
  slaBreaches: { stage: string; count: number; avgOverdueDays: number }[];
  avgDaysPerStage: { stage: string; avgDays: number }[];
}

// ── Default Pipeline ───────────────────────────────────────────

export const DEFAULT_PIPELINE: PipelineStage[] = [
  { id: 'applied',         name: 'Applied',           nameAr: 'تقدم',           order: 1, type: 'SCREENING',   isRequired: true,  color: '#6B7280', daysLimit: 2 },
  { id: 'screening',       name: 'CV Screening',      nameAr: 'فرز السير',      order: 2, type: 'SCREENING',   isRequired: true,  color: '#3B82F6', daysLimit: 3 },
  { id: 'phone-screen',    name: 'Phone Screen',      nameAr: 'مقابلة هاتفية',  order: 3, type: 'INTERVIEW',   isRequired: false, color: '#8B5CF6', daysLimit: 5 },
  { id: 'assessment',      name: 'Skills Assessment', nameAr: 'تقييم المهارات', order: 4, type: 'ASSESSMENT',  isRequired: false, color: '#F59E0B', daysLimit: 7 },
  { id: 'interview',       name: 'Interview',         nameAr: 'مقابلة',         order: 5, type: 'INTERVIEW',   isRequired: true,  color: '#10B981', daysLimit: 7 },
  { id: 'shortlisted',     name: 'Shortlisted',       nameAr: 'قائمة مختصرة',   order: 6, type: 'CUSTOM',      isRequired: false, color: '#06B6D4', daysLimit: 5 },
  { id: 'offer',           name: 'Offer',             nameAr: 'عرض وظيفي',      order: 7, type: 'OFFER',       isRequired: true,  color: '#F97316', daysLimit: 5 },
  { id: 'hired',           name: 'Hired',             nameAr: 'تم التوظيف',     order: 8, type: 'CUSTOM',      isRequired: true,  color: '#22C55E' },
];

const STAGE_MAP = new Map(DEFAULT_PIPELINE.map(s => [s.id, s]));

// ── Pipeline Operations ────────────────────────────────────────

export async function getPipeline(db: Db, tenantId: string): Promise<PipelineStage[]> {
  const custom = await db.collection('cvision_pipeline_config').findOne({ tenantId });
  return (custom as Record<string, unknown>)?.stages as PipelineStage[] || DEFAULT_PIPELINE;
}

export async function getPipelineView(db: Db, tenantId: string, requisitionId?: string): Promise<{
  stages: (PipelineStage & { candidates: Record<string, unknown>[] })[];
  total: number;
}> {
  const pipeline = await getPipeline(db, tenantId);
  const filter: Record<string, unknown> = { tenantId, isArchived: { $ne: true } };
  if (requisitionId) filter.requisitionId = requisitionId;

  const candidates = await db.collection('cvision_candidates')
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();

  const stages = pipeline.map(stage => ({
    ...stage,
    candidates: candidates.filter(c =>
      (c.status || 'applied') === stage.id ||
      (c.status === 'new' && stage.id === 'applied')
    ).map(c => ({
      id: c.id,
      _id: c._id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      source: c.source,
      requisitionId: c.requisitionId,
      status: c.status,
      screeningScore: c.screeningScore,
      stageEnteredAt: c.statusChangedAt || c.createdAt,
      daysInStage: Math.round((Date.now() - new Date(c.statusChangedAt || c.createdAt).getTime()) / 86400000),
      offer: c.offer,
      metadata: c.metadata,
    })),
  }));

  // Add a "rejected" virtual stage
  const rejected = candidates.filter(c => c.status === 'rejected');
  stages.push({
    id: 'rejected', name: 'Rejected', nameAr: 'مرفوض', order: 99,
    type: 'CUSTOM', isRequired: false, color: '#EF4444',
    candidates: rejected.map(c => ({
      id: c.id, _id: c._id, fullName: c.fullName, email: c.email,
      phone: c.phone, source: c.source, requisitionId: c.requisitionId,
      status: c.status, screeningScore: c.screeningScore,
      stageEnteredAt: c.statusChangedAt, daysInStage: 0,
      offer: c.offer, metadata: c.metadata,
    })),
  });

  return { stages, total: candidates.length };
}

export async function moveCandidateToStage(
  db: Db, tenantId: string, candidateId: string,
  newStage: string, movedBy: string, notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const col = db.collection('cvision_candidates');
  const candidate = await col.findOne({ tenantId, id: candidateId });
  if (!candidate) {
    const byOid = ObjectId.isValid(candidateId) ? await col.findOne({ tenantId, _id: new ObjectId(candidateId) }) : null;
    if (!byOid) return { success: false, error: 'Candidate not found' };
    return moveCandidateToStageInternal(db, tenantId, col, byOid, newStage, movedBy, notes);
  }
  return moveCandidateToStageInternal(db, tenantId, col, candidate, newStage, movedBy, notes);
}

async function moveCandidateToStageInternal(
  db: Db, tenantId: string, col: Collection,
  candidate: Record<string, unknown>, newStage: string, movedBy: string, notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const oldStage = (candidate.status || 'applied') as string;
  if (oldStage === newStage) return { success: true };

  const daysInPrevious = Math.round(
    (Date.now() - new Date((candidate.statusChangedAt || candidate.createdAt) as string).getTime()) / 86400000
  );

  const historyEntry: StageHistoryEntry = {
    from: oldStage, to: newStage, movedBy, movedAt: new Date(),
    notes, daysInPreviousStage: daysInPrevious,
  };

  await col.updateOne({ _id: candidate._id, tenantId }, {
    $set: { status: newStage, statusChangedAt: new Date(), updatedAt: new Date() },
    $push: { stageHistory: historyEntry },
  });

  // If hired, mark hiredAt + auto-sync manpower headcount
  if (newStage === 'hired') {
    await col.updateOne({ _id: candidate._id, tenantId }, {
      $set: { hiredAt: new Date() },
    });

    // Auto-sync manpower: look up the job requisition for this candidate
    try {
      const reqCol = db.collection('cvision_job_requisitions');
      const requisition = candidate.requisitionId
        ? await reqCol.findOne({ tenantId, id: candidate.requisitionId })
        : null;

      const requisitionDoc = requisition as Record<string, unknown>;
      const manpowerLink = requisitionDoc?.manpowerLink as Record<string, unknown> | undefined;
      if (requisition && manpowerLink?.positionId) {
        const link = manpowerLink;
        const bpCol = db.collection('cvision_budgeted_positions');
        const { ObjectId } = await import('mongodb');

        // Increment active headcount on the budgeted position
        let posFilter: Record<string, unknown> = { tenantId };
        if (ObjectId.isValid(link.positionId as string)) {
          posFilter._id = new ObjectId(link.positionId as string);
        } else {
          posFilter.id = link.positionId as string;
        }

        await bpCol.updateOne(posFilter, { $inc: { activeHeadcount: 1 } });

        // Check if position is now fully staffed
        const position = await bpCol.findOne(posFilter);
        if (position) {
          const positionDoc = position as Record<string, unknown>;
          const budgeted = (positionDoc.budgetedHeadcount as number) || 0;
          const active = (positionDoc.activeHeadcount as number) || 0;
          if (active >= budgeted && budgeted > 0) {
            await reqCol.updateOne({ _id: requisition._id, tenantId }, {
              $set: { status: 'closed', closedReason: 'FULLY_STAFFED', closedAt: new Date(), updatedAt: new Date() },
            });
          }
        }
      }
    } catch (err) {
      logger.error('[Pipeline] Manpower sync failed (non-blocking):', err);
    }
  }

  // Log audit
  await db.collection('cvision_audit_logs').insertOne({
    tenantId, entityType: 'candidate', entityId: candidate.id,
    action: 'STAGE_CHANGE', userId: movedBy,
    details: { from: oldStage, to: newStage, notes },
    createdAt: new Date(),
  });

  return { success: true };
}

// ── Rejection ──────────────────────────────────────────────────

export async function rejectCandidate(
  db: Db, tenantId: string, candidateId: string,
  reason: string, rejectedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await moveCandidateToStage(db, tenantId, candidateId, 'rejected', rejectedBy, reason);
  if (!result.success) return result;

  const col = db.collection('cvision_candidates');
  const query = { tenantId, $or: [{ id: candidateId }, ...(ObjectId.isValid(candidateId) ? [{ _id: new ObjectId(candidateId) }] : [])] };
  await col.updateOne(query, {
    $set: { statusReason: reason, rejectedBy, rejectedAt: new Date() },
  });

  // Queue rejection notification
  await db.collection('cvision_notifications').insertOne({
    tenantId, recipientId: rejectedBy,
    title: 'Candidate Rejected', message: `Candidate was rejected: ${reason}`,
    type: 'INFO', category: 'RECRUITMENT', isRead: false, isDismissed: false,
    priority: 'NORMAL', createdAt: new Date(),
  });

  return { success: true };
}

// ── Offer Letter Management ────────────────────────────────────

export async function createOfferLetter(
  db: Db, tenantId: string, data: Omit<OfferLetter, 'id' | 'tenantId' | 'status' | 'version' | 'createdAt' | 'updatedAt'>,
): Promise<OfferLetter> {
  const offer: OfferLetter = {
    ...data,
    id: new ObjectId().toString(),
    tenantId,
    status: 'DRAFT',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection('cvision_offer_letters').insertOne(offer);
  return offer;
}

export async function sendOfferLetter(
  db: Db, tenantId: string, offerId: string,
): Promise<{ success: boolean; error?: string }> {
  const col = db.collection('cvision_offer_letters');
  const offer = await col.findOne({ tenantId, id: offerId });
  if (!offer) return { success: false, error: 'Offer not found' };

  await col.updateOne({ _id: offer._id, tenantId }, {
    $set: { status: 'SENT', sentAt: new Date(), updatedAt: new Date() },
  });

  // Move candidate to offer stage
  if (offer.candidateId) {
    await moveCandidateToStage(db, tenantId, offer.candidateId, 'offer', 'system', 'Offer sent');
  }

  return { success: true };
}

export async function respondToOffer(
  db: Db, tenantId: string, offerId: string,
  response: 'ACCEPTED' | 'REJECTED', notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const col = db.collection('cvision_offer_letters');
  const offer = await col.findOne({ tenantId, id: offerId });
  if (!offer) return { success: false, error: 'Offer not found' };

  await col.updateOne({ _id: offer._id, tenantId }, {
    $set: { status: response, respondedAt: new Date(), updatedAt: new Date() },
  });

  if (response === 'ACCEPTED' && offer.candidateId) {
    await moveCandidateToStage(db, tenantId, offer.candidateId, 'hired', 'system', 'Offer accepted');
  }

  return { success: true };
}

export async function getOfferLetters(
  db: Db, tenantId: string, filters?: { candidateId?: string; requisitionId?: string; status?: string },
): Promise<OfferLetter[]> {
  const query: Record<string, unknown> = { tenantId };
  if (filters?.candidateId) query.candidateId = filters.candidateId;
  if (filters?.requisitionId) query.requisitionId = filters.requisitionId;
  if (filters?.status) query.status = filters.status;

  return db.collection('cvision_offer_letters').find(query).sort({ createdAt: -1 }).toArray() as unknown as OfferLetter[];
}

// ── Analytics ──────────────────────────────────────────────────

export async function getRecruitmentAnalytics(
  db: Db, tenantId: string, dateRange?: { from: string; to: string },
): Promise<RecruitmentMetrics> {
  const pipeline = await getPipeline(db, tenantId);
  const dateFilter = dateRange
    ? { createdAt: { $gte: new Date(dateRange.from), $lte: new Date(dateRange.to) } }
    : {};

  const allCandidates = await db.collection('cvision_candidates')
    .find({ tenantId, isArchived: { $ne: true }, ...dateFilter })
    .toArray();

  // Pipeline stage counts
  const stageCounts = new Map<string, number>();
  for (const c of allCandidates) {
    const stage = c.status || 'applied';
    if (stage === 'rejected') continue;
    stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
  }

  const pipelineMetrics = pipeline.map(s => ({
    stage: s.id,
    stageName: s.name,
    count: stageCounts.get(s.id) || 0,
    color: s.color || '#6B7280',
  }));

  // Time to hire
  const hired = allCandidates.filter(c => c.status === 'hired' && c.hiredAt);
  const hireTimes = hired.map(c => {
    const applied = new Date(c.createdAt);
    const hiredAt = new Date(c.hiredAt);
    return {
      days: Math.max(0, Math.round((hiredAt.getTime() - applied.getTime()) / 86400000)),
      dept: c.departmentId || 'unknown',
    };
  });
  const avgTimeToHire = hireTimes.length > 0
    ? Math.round(hireTimes.reduce((s, h) => s + h.days, 0) / hireTimes.length)
    : 0;

  // Group by department
  const deptTimes = new Map<string, number[]>();
  for (const h of hireTimes) {
    if (!deptTimes.has(h.dept)) deptTimes.set(h.dept, []);
    deptTimes.get(h.dept)!.push(h.days);
  }
  const byDepartment = Array.from(deptTimes.entries()).map(([dept, times]) => ({
    dept,
    avgDays: Math.round(times.reduce((s, t) => s + t, 0) / times.length),
  }));

  // Source effectiveness
  const sourceMap = new Map<string, { applied: number; hired: number }>();
  for (const c of allCandidates) {
    const source = c.source || 'Direct';
    if (!sourceMap.has(source)) sourceMap.set(source, { applied: 0, hired: 0 });
    sourceMap.get(source)!.applied++;
    if (c.status === 'hired') sourceMap.get(source)!.hired++;
  }

  // Offer acceptance rate
  const offers = await db.collection('cvision_offer_letters')
    .find({ tenantId, status: { $in: ['ACCEPTED', 'REJECTED'] } }).toArray();
  const accepted = offers.filter((o) => (o as Record<string, unknown>).status === 'ACCEPTED').length;
  const offerAcceptanceRate = offers.length > 0 ? Math.round((accepted / offers.length) * 100) : 0;

  // Open positions
  const openPositions = await db.collection('cvision_job_requisitions')
    .countDocuments({ tenantId, status: { $regex: /^(open|approved|active)$/i }, isArchived: { $ne: true } });

  // This month stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const hiredThisMonth = allCandidates.filter(c =>
    c.status === 'hired' && c.hiredAt && new Date(c.hiredAt) >= startOfMonth
  ).length;
  const rejectedThisMonth = allCandidates.filter(c =>
    c.status === 'rejected' && c.statusChangedAt && new Date(c.statusChangedAt) >= startOfMonth
  ).length;

  // SLA breaches
  const slaBreaches: { stage: string; count: number; avgOverdueDays: number }[] = [];
  for (const stage of pipeline) {
    if (!stage.daysLimit) continue;
    const inStage = allCandidates.filter(c => c.status === stage.id);
    const overdue = inStage.filter(c => {
      const enteredAt = new Date(c.statusChangedAt || c.createdAt);
      const daysInStage = (Date.now() - enteredAt.getTime()) / 86400000;
      return daysInStage > stage.daysLimit!;
    });
    if (overdue.length > 0) {
      const avgOverdue = overdue.reduce((s, c) => {
        const d = (Date.now() - new Date(c.statusChangedAt || c.createdAt).getTime()) / 86400000;
        return s + (d - stage.daysLimit!);
      }, 0) / overdue.length;
      slaBreaches.push({ stage: stage.name, count: overdue.length, avgOverdueDays: Math.round(avgOverdue) });
    }
  }

  // Average days per stage from hired candidates' history
  const avgDaysPerStage: { stage: string; avgDays: number }[] = [];
  const stageTimesAgg = new Map<string, number[]>();
  for (const c of hired) {
    if (!c.stageHistory) continue;
    for (const entry of c.stageHistory) {
      if (!stageTimesAgg.has(entry.to)) stageTimesAgg.set(entry.to, []);
      stageTimesAgg.get(entry.to)!.push(entry.daysInPreviousStage || 0);
    }
  }
  for (const [stage, times] of stageTimesAgg) {
    avgDaysPerStage.push({
      stage,
      avgDays: Math.round(times.reduce((s, t) => s + t, 0) / times.length),
    });
  }

  return {
    pipeline: pipelineMetrics,
    timeToHire: { avgDays: avgTimeToHire, byDepartment },
    sourceEffectiveness: Array.from(sourceMap.entries()).map(([source, data]) => ({
      source, ...data,
      conversionRate: data.applied > 0 ? Math.round((data.hired / data.applied) * 100) : 0,
    })),
    offerAcceptanceRate,
    openPositions,
    candidatesInPipeline: allCandidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length,
    hiredThisMonth,
    rejectedThisMonth,
    slaBreaches,
    avgDaysPerStage,
  };
}

// ── Candidate Timeline ─────────────────────────────────────────

export async function getCandidateTimeline(
  db: Db, tenantId: string, candidateId: string,
): Promise<Record<string, unknown>[]> {
  const col = db.collection('cvision_candidates');
  const candidate = await col.findOne({ tenantId, $or: [{ id: candidateId }, ...(ObjectId.isValid(candidateId) ? [{ _id: new ObjectId(candidateId) }] : [])] });
  if (!candidate) return [];

  const timeline: Record<string, unknown>[] = [];

  // Application
  timeline.push({
    type: 'APPLICATION', date: candidate.createdAt,
    title: 'Applied', description: `Applied via ${candidate.source || 'direct'}`,
  });

  // Stage history
  if (candidate.stageHistory) {
    for (const entry of candidate.stageHistory) {
      const stageInfo = STAGE_MAP.get(entry.to);
      timeline.push({
        type: 'STAGE_CHANGE', date: entry.movedAt,
        title: `Moved to ${stageInfo?.name || entry.to}`,
        description: entry.notes || `From ${entry.from || 'applied'}`,
        movedBy: entry.movedBy,
        daysInPrevious: entry.daysInPreviousStage,
      });
    }
  }

  // Interviews
  if (candidate.interviews) {
    for (const interview of candidate.interviews) {
      timeline.push({
        type: 'INTERVIEW', date: interview.scheduledAt || interview.createdAt,
        title: `Interview: ${interview.type || 'General'}`,
        description: interview.feedback || `Score: ${interview.score || 'N/A'}`,
      });
    }
  }

  // Offer
  if (candidate.offer) {
    timeline.push({
      type: 'OFFER', date: candidate.offer.sentAt || candidate.offerExtendedAt,
      title: 'Offer Extended',
      description: `${candidate.offer.basicSalary || candidate.offerAmount} SAR`,
    });
    if (candidate.offer.status === 'accepted' || candidate.offerStatus === 'accepted') {
      timeline.push({
        type: 'OFFER_ACCEPTED', date: candidate.offer.respondedAt || candidate.offerResponseAt,
        title: 'Offer Accepted',
      });
    }
  }

  // Hired
  if (candidate.hiredAt) {
    timeline.push({
      type: 'HIRED', date: candidate.hiredAt,
      title: 'Hired', description: `Employee ID: ${candidate.employeeId || 'pending'}`,
    });
  }

  return timeline.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
}
