import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type IncidentType = 'ACCIDENT' | 'NEAR_MISS' | 'UNSAFE_CONDITION' | 'OCCUPATIONAL_ILLNESS' | 'PROPERTY_DAMAGE' | 'ENVIRONMENTAL';
export type Severity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL' | 'FATAL';
export type IncidentStatus = 'REPORTED' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'CLOSED';
export type InspectionType = 'ROUTINE' | 'FIRE_DRILL' | 'EQUIPMENT' | 'WORKPLACE' | 'EXTERNAL_AUDIT';
export type InspectionStatus = 'COMPLETED' | 'SCHEDULED' | 'OVERDUE';
export type PPECondition = 'NEW' | 'GOOD' | 'WORN' | 'DAMAGED';

const INCIDENTS_COLL = 'cvision_safety_incidents';
const INSPECTIONS_COLL = 'cvision_safety_inspections';
const PPE_COLL = 'cvision_ppe_distribution';

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_INCIDENTS = [
  {
    incidentId: 'INC-2026-001', type: 'NEAR_MISS' as IncidentType, severity: 'MINOR' as Severity,
    title: 'Wet floor near entrance', description: 'Employee slipped on wet floor near main entrance. No injury.',
    dateTime: new Date(2026, 0, 15, 8, 30), location: 'Main Building - Entrance',
    reportedBy: 'EMP-005', reportedByName: 'Fatima Al-Zahrani',
    affectedEmployees: [{ employeeId: 'EMP-005', employeeName: 'Fatima Al-Zahrani', treatmentRequired: false }],
    witnesses: ['EMP-010'],
    rootCause: 'Cleaning crew left floor wet without warning signs',
    contributingFactors: ['No wet floor signs', 'Poor timing of cleaning'],
    correctiveActions: [
      { action: 'Install wet floor signs for all cleaning periods', assignedTo: 'EMP-030', dueDate: new Date(2026, 0, 20), status: 'COMPLETED', completedAt: new Date(2026, 0, 18) },
      { action: 'Update cleaning schedule to off-peak hours', assignedTo: 'EMP-031', dueDate: new Date(2026, 0, 25), status: 'COMPLETED', completedAt: new Date(2026, 0, 22) },
    ],
    photos: [], documents: [], gosiClaimFiled: false, status: 'CLOSED' as IncidentStatus,
  },
  {
    incidentId: 'INC-2026-002', type: 'ACCIDENT' as IncidentType, severity: 'MODERATE' as Severity,
    title: 'Forklift collision in warehouse', description: 'Forklift struck shelving unit in warehouse section B. Minor property damage, operator had bruised arm.',
    dateTime: new Date(2026, 1, 3, 14, 15), location: 'Warehouse - Section B',
    reportedBy: 'EMP-040', reportedByName: 'Saeed Al-Ghamdi',
    affectedEmployees: [{ employeeId: 'EMP-040', employeeName: 'Saeed Al-Ghamdi', injuryType: 'Bruised arm', treatmentRequired: true, daysOff: 2 }],
    witnesses: ['EMP-041', 'EMP-042'],
    rootCause: 'Obstructed visibility due to stacked boxes',
    contributingFactors: ['Poor aisle organization', 'Insufficient lighting'],
    correctiveActions: [
      { action: 'Clear all aisle obstructions', assignedTo: 'EMP-041', dueDate: new Date(2026, 1, 5), status: 'COMPLETED', completedAt: new Date(2026, 1, 4) },
      { action: 'Install mirrors at blind corners', assignedTo: 'EMP-031', dueDate: new Date(2026, 1, 15), status: 'IN_PROGRESS' },
      { action: 'Forklift refresher training for all operators', assignedTo: 'EMP-050', dueDate: new Date(2026, 1, 28), status: 'PENDING' },
    ],
    photos: [], documents: [], gosiClaimFiled: true, gosiClaimNumber: 'GOSI-2026-0045', status: 'ACTION_REQUIRED' as IncidentStatus,
  },
  {
    incidentId: 'INC-2026-003', type: 'UNSAFE_CONDITION' as IncidentType, severity: 'MAJOR' as Severity,
    title: 'Exposed wiring in server room', description: 'Exposed electrical wiring found during routine check of server room.',
    dateTime: new Date(2026, 1, 10, 10, 0), location: 'IT Department - Server Room',
    reportedBy: 'EMP-015', reportedByName: 'Ali Al-Mutairi',
    affectedEmployees: [],
    witnesses: [],
    correctiveActions: [
      { action: 'Isolate and repair wiring immediately', assignedTo: 'EMP-060', dueDate: new Date(2026, 1, 11), status: 'COMPLETED', completedAt: new Date(2026, 1, 11) },
      { action: 'Full electrical audit of server room', assignedTo: 'EMP-060', dueDate: new Date(2026, 1, 20), status: 'PENDING' },
    ],
    photos: [], documents: [], gosiClaimFiled: false, status: 'INVESTIGATING' as IncidentStatus,
  },
];

const SEED_INSPECTIONS = [
  {
    inspectionId: 'INS-2026-001', type: 'ROUTINE' as InspectionType, location: 'Main Office Building',
    inspectorName: 'Safety Officer - Nasser', inspectionDate: new Date(2026, 0, 10),
    checklist: [
      { item: 'Fire extinguishers accessible', category: 'Fire Safety', status: 'PASS' },
      { item: 'Emergency exits clear', category: 'Fire Safety', status: 'PASS' },
      { item: 'First aid kits stocked', category: 'Medical', status: 'PASS' },
      { item: 'Floor hazards', category: 'Workplace', status: 'FAIL', notes: 'Cable covers needed in corridor' },
      { item: 'Signage visible', category: 'General', status: 'PASS' },
      { item: 'PPE availability', category: 'PPE', status: 'PASS' },
    ],
    passRate: 83, findings: ['Cable covers needed in main corridor'], recommendations: ['Install cable management system'],
    nextInspectionDate: new Date(2026, 3, 10), status: 'COMPLETED' as InspectionStatus,
  },
  {
    inspectionId: 'INS-2026-002', type: 'FIRE_DRILL' as InspectionType, location: 'All Buildings',
    inspectorName: 'Safety Officer - Nasser', inspectionDate: new Date(2026, 1, 1),
    checklist: [
      { item: 'Alarm sounded within 30s', category: 'Fire Drill', status: 'PASS' },
      { item: 'Full evacuation < 5 min', category: 'Fire Drill', status: 'PASS' },
      { item: 'Assembly point used correctly', category: 'Fire Drill', status: 'PASS' },
      { item: 'Headcount completed', category: 'Fire Drill', status: 'FAIL', notes: 'Headcount took 8 minutes' },
    ],
    passRate: 75, findings: ['Headcount process too slow'], recommendations: ['Assign floor marshals for faster headcount'],
    nextInspectionDate: new Date(2026, 5, 1), status: 'COMPLETED' as InspectionStatus,
  },
  {
    inspectionId: 'INS-2026-003', type: 'EQUIPMENT' as InspectionType, location: 'Warehouse',
    inspectorName: 'External Auditor', inspectionDate: new Date(2026, 3, 1),
    checklist: [],
    passRate: 0, findings: [], recommendations: [],
    nextInspectionDate: new Date(2026, 3, 1), status: 'SCHEDULED' as InspectionStatus,
  },
];

const SEED_PPE = [
  {
    employeeId: 'EMP-040', employeeName: 'Saeed Al-Ghamdi',
    items: [
      { itemName: 'Safety Helmet', issuedDate: new Date(2026, 0, 1), quantity: 1, condition: 'GOOD' as PPECondition },
      { itemName: 'Safety Shoes', issuedDate: new Date(2026, 0, 1), quantity: 1, size: '43', condition: 'GOOD' as PPECondition },
      { itemName: 'Hi-Vis Vest', issuedDate: new Date(2026, 0, 1), quantity: 2, condition: 'NEW' as PPECondition },
      { itemName: 'Gloves', issuedDate: new Date(2026, 0, 1), quantity: 3, expiryDate: new Date(2026, 6, 1), condition: 'GOOD' as PPECondition },
    ],
    lastDistributionDate: new Date(2026, 0, 1), nextDistributionDate: new Date(2026, 6, 1),
  },
  {
    employeeId: 'EMP-041', employeeName: 'Youssef Al-Harbi',
    items: [
      { itemName: 'Safety Helmet', issuedDate: new Date(2025, 6, 1), quantity: 1, condition: 'WORN' as PPECondition },
      { itemName: 'Safety Shoes', issuedDate: new Date(2025, 6, 1), quantity: 1, size: '42', condition: 'WORN' as PPECondition },
      { itemName: 'Ear Protection', issuedDate: new Date(2025, 6, 1), quantity: 1, condition: 'GOOD' as PPECondition },
    ],
    lastDistributionDate: new Date(2025, 6, 1), nextDistributionDate: new Date(2026, 0, 1),
  },
];

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(INCIDENTS_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;
  const now = new Date();
  await coll.insertMany(SEED_INCIDENTS.map(i => ({ ...i, tenantId, createdAt: now, updatedAt: now })));
  await db.collection(INSPECTIONS_COLL).insertMany(SEED_INSPECTIONS.map(i => ({ ...i, tenantId, createdAt: now })));
  await db.collection(PPE_COLL).insertMany(SEED_PPE.map(p => ({ ...p, tenantId })));
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function listIncidents(db: Db, tenantId: string, filters?: { type?: string; severity?: string; status?: string }) {
  const query: any = { tenantId };
  if (filters?.type) query.type = filters.type;
  if (filters?.severity) query.severity = filters.severity;
  if (filters?.status) query.status = filters.status;
  return db.collection(INCIDENTS_COLL).find(query).sort({ dateTime: -1 }).toArray();
}

export async function getIncidentDetail(db: Db, tenantId: string, incidentId: string) {
  return db.collection(INCIDENTS_COLL).findOne({ tenantId, incidentId });
}

export async function listInspections(db: Db, tenantId: string, type?: string) {
  const query: any = { tenantId };
  if (type) query.type = type;
  return db.collection(INSPECTIONS_COLL).find(query).sort({ inspectionDate: -1 }).toArray();
}

export async function getPPERecords(db: Db, tenantId: string, employeeId?: string) {
  const query: any = { tenantId };
  if (employeeId) query.employeeId = employeeId;
  return db.collection(PPE_COLL).find(query).toArray();
}

export async function getDashboard(db: Db, tenantId: string) {
  const incidents = await db.collection(INCIDENTS_COLL).find({ tenantId }).toArray();
  const inspections = await db.collection(INSPECTIONS_COLL).find({ tenantId }).toArray();
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => i.status !== 'CLOSED').length;
  const bySeverity: any = {};
  for (const i of incidents) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  const overdueActions = incidents.flatMap(i => (i.correctiveActions || []).filter((a: any) => a.status !== 'COMPLETED' && new Date(a.dueDate) < new Date()));
  const overdueInspections = inspections.filter(i => i.status === 'OVERDUE' || (i.status === 'SCHEDULED' && new Date(i.nextInspectionDate) < new Date()));
  return { totalIncidents, openIncidents, bySeverity, overdueActionsCount: overdueActions.length, overdueInspectionsCount: overdueInspections.length, lastInspection: inspections[0] };
}

export async function getOverdueActions(db: Db, tenantId: string) {
  const incidents = await db.collection(INCIDENTS_COLL).find({ tenantId }).toArray();
  const now = new Date();
  const overdue: any[] = [];
  for (const i of incidents) {
    for (const a of i.correctiveActions || []) {
      if (a.status !== 'COMPLETED' && new Date(a.dueDate) < now) {
        overdue.push({ incidentId: i.incidentId, incidentTitle: i.title, ...a });
      }
    }
  }
  return overdue;
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function reportIncident(db: Db, tenantId: string, data: any) {
  const count = await db.collection(INCIDENTS_COLL).countDocuments({ tenantId });
  const year = new Date().getFullYear();
  const incidentId = `INC-${year}-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(INCIDENTS_COLL).insertOne({
    ...data, tenantId, incidentId, correctiveActions: data.correctiveActions || [],
    photos: [], documents: [], gosiClaimFiled: false, status: 'REPORTED',
    createdAt: now, updatedAt: now,
  });
  return incidentId;
}

export async function addInvestigation(db: Db, tenantId: string, incidentId: string, data: any) {
  await db.collection(INCIDENTS_COLL).updateOne(
    { tenantId, incidentId },
    { $set: { rootCause: data.rootCause, contributingFactors: data.contributingFactors, status: 'INVESTIGATING', updatedAt: new Date() } },
  );
}

export async function closeIncident(db: Db, tenantId: string, incidentId: string) {
  await db.collection(INCIDENTS_COLL).updateOne({ tenantId, incidentId }, { $set: { status: 'CLOSED', updatedAt: new Date() } });
}

export async function createInspection(db: Db, tenantId: string, data: any) {
  const count = await db.collection(INSPECTIONS_COLL).countDocuments({ tenantId });
  const year = new Date().getFullYear();
  const inspectionId = `INS-${year}-${String(count + 1).padStart(3, '0')}`;
  await db.collection(INSPECTIONS_COLL).insertOne({
    ...data, tenantId, inspectionId, checklist: data.checklist || [],
    passRate: 0, findings: [], recommendations: [], status: 'SCHEDULED', createdAt: new Date(),
  });
  return inspectionId;
}

export async function completeInspection(db: Db, tenantId: string, inspectionId: string, data: any) {
  const passed = (data.checklist || []).filter((c: any) => c.status === 'PASS').length;
  const total = (data.checklist || []).filter((c: any) => c.status !== 'N/A').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  await db.collection(INSPECTIONS_COLL).updateOne(
    { tenantId, inspectionId },
    { $set: { ...data, passRate, status: 'COMPLETED', completedAt: new Date() } },
  );
}

export async function issuePPE(db: Db, tenantId: string, data: any) {
  await db.collection(PPE_COLL).updateOne(
    { tenantId, employeeId: data.employeeId },
    {
      $set: { employeeName: data.employeeName, tenantId, lastDistributionDate: new Date(), nextDistributionDate: data.nextDistributionDate },
      $push: { items: { $each: data.items } } as Record<string, unknown>,
    },
    { upsert: true },
  );
}
