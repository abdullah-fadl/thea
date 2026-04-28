/**
 * Clinical Pathway Templates
 *
 * Predefined care pathways with time-based task checklists
 * and compliance tracking. Examples: sepsis bundle, stroke protocol, DKA.
 *
 * Uses Prisma models: ClinicalPathway, ClinicalPathwayInstance
 */

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PathwayTask {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  timeframeMinutes: number;
  category: 'assessment' | 'lab' | 'imaging' | 'medication' | 'procedure' | 'monitoring' | 'notification';
  isCritical: boolean;
  orderCode?: string;
  orderKind?: string;
}

export interface ClinicalPathway {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  category: string;
  tasks: PathwayTask[];
  totalDurationMinutes: number;
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PathwayTaskInstance {
  taskId: string;
  taskName: string;
  status: 'pending' | 'completed' | 'skipped' | 'overdue';
  dueAt: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

export interface PathwayInstance {
  id: string;
  tenantId: string;
  pathwayId: string;
  pathwayName: string;
  patientId: string;
  encounterId: string;
  startedAt: Date;
  startedBy: string;
  status: 'active' | 'completed' | 'cancelled';
  tasks: PathwayTaskInstance[];
  compliance: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Default Pathways
// ---------------------------------------------------------------------------

export const DEFAULT_PATHWAYS: Omit<ClinicalPathway, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Sepsis Hour-1 Bundle',
    nameAr: '\u062D\u0632\u0645\u0629 \u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0644\u0644\u0625\u0646\u062A\u0627\u0646',
    description: 'Surviving Sepsis Campaign hour-1 bundle checklist',
    descriptionAr: '\u0642\u0627\u0626\u0645\u0629 \u062D\u0632\u0645\u0629 \u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0644\u0644\u0625\u0646\u062A\u0627\u0646 \u0627\u0644\u062F\u0645\u0648\u064A',
    category: 'Emergency',
    totalDurationMinutes: 60,
    isActive: true,
    isDefault: true,
    tasks: [
      { id: 'sep-1', name: 'Measure Lactate', nameAr: '\u0642\u064A\u0627\u0633 \u0627\u0644\u0644\u0627\u0643\u062A\u0627\u062A', timeframeMinutes: 15, category: 'lab', isCritical: true, orderCode: 'LACT', orderKind: 'LAB' },
      { id: 'sep-2', name: 'Blood Culture Before Antibiotics', nameAr: '\u0645\u0632\u0631\u0639\u0629 \u062F\u0645 \u0642\u0628\u0644 \u0627\u0644\u0645\u0636\u0627\u062F', timeframeMinutes: 15, category: 'lab', isCritical: true, orderCode: 'BC', orderKind: 'LAB' },
      { id: 'sep-3', name: 'Administer Broad-Spectrum Antibiotics', nameAr: '\u0625\u0639\u0637\u0627\u0621 \u0645\u0636\u0627\u062F \u062D\u064A\u0648\u064A \u0648\u0627\u0633\u0639 \u0627\u0644\u0637\u064A\u0641', timeframeMinutes: 60, category: 'medication', isCritical: true },
      { id: 'sep-4', name: 'IV Fluid Bolus (30 mL/kg)', nameAr: '\u0633\u0648\u0627\u0626\u0644 \u0648\u0631\u064A\u062F\u064A\u0629 (30 \u0645\u0644/\u0643\u063A)', timeframeMinutes: 60, category: 'medication', isCritical: true },
      { id: 'sep-5', name: 'Vasopressors if MAP <65', nameAr: '\u0631\u0627\u0641\u0639\u0627\u062A \u0636\u063A\u0637 \u0625\u0630\u0627 MAP <65', timeframeMinutes: 60, category: 'medication', isCritical: false },
      { id: 'sep-6', name: 'Remeasure Lactate if Initial >2', nameAr: '\u0625\u0639\u0627\u062F\u0629 \u0642\u064A\u0627\u0633 \u0627\u0644\u0644\u0627\u0643\u062A\u0627\u062A \u0625\u0630\u0627 >2', timeframeMinutes: 60, category: 'lab', isCritical: true },
    ],
  },
  {
    name: 'Acute Stroke Protocol',
    nameAr: '\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0633\u0643\u062A\u0629 \u0627\u0644\u062D\u0627\u062F\u0629',
    description: 'Time-critical acute ischemic stroke pathway',
    descriptionAr: '\u0645\u0633\u0627\u0631 \u0627\u0644\u0633\u0643\u062A\u0629 \u0627\u0644\u0625\u0642\u0641\u0627\u0631\u064A\u0629 \u0627\u0644\u062D\u0627\u062F\u0629',
    category: 'Emergency',
    totalDurationMinutes: 60,
    isActive: true,
    isDefault: true,
    tasks: [
      { id: 'str-1', name: 'NIHSS Assessment', nameAr: '\u062A\u0642\u064A\u064A\u0645 NIHSS', timeframeMinutes: 10, category: 'assessment', isCritical: true },
      { id: 'str-2', name: 'CT Head Non-Contrast', nameAr: '\u0623\u0634\u0639\u0629 \u0645\u0642\u0637\u0639\u064A\u0629 \u0644\u0644\u0631\u0623\u0633', timeframeMinutes: 25, category: 'imaging', isCritical: true, orderCode: 'CTH', orderKind: 'RADIOLOGY' },
      { id: 'str-3', name: 'Blood Glucose', nameAr: '\u0633\u0643\u0631 \u0627\u0644\u062F\u0645', timeframeMinutes: 15, category: 'lab', isCritical: true, orderCode: 'GLU', orderKind: 'LAB' },
      { id: 'str-4', name: 'tPA Decision', nameAr: '\u0642\u0631\u0627\u0631 \u0625\u0639\u0637\u0627\u0621 tPA', timeframeMinutes: 45, category: 'medication', isCritical: true },
      { id: 'str-5', name: 'tPA Bolus (if eligible)', nameAr: '\u0625\u0639\u0637\u0627\u0621 tPA (\u0625\u0630\u0627 \u0645\u0624\u0647\u0644)', timeframeMinutes: 60, category: 'medication', isCritical: true },
      { id: 'str-6', name: 'Neurology Consult', nameAr: '\u0627\u0633\u062A\u0634\u0627\u0631\u0629 \u0623\u0639\u0635\u0627\u0628', timeframeMinutes: 30, category: 'notification', isCritical: true },
    ],
  },
  {
    name: 'DKA Management',
    nameAr: '\u0639\u0644\u0627\u062C \u0627\u0644\u062D\u0645\u0627\u0636 \u0627\u0644\u0643\u064A\u062A\u0648\u0646\u064A',
    description: 'Diabetic ketoacidosis management pathway',
    descriptionAr: '\u0645\u0633\u0627\u0631 \u0639\u0644\u0627\u062C \u0627\u0644\u062D\u0645\u0627\u0636 \u0627\u0644\u0643\u064A\u062A\u0648\u0646\u064A \u0627\u0644\u0633\u0643\u0631\u064A',
    category: 'Emergency',
    totalDurationMinutes: 240,
    isActive: true,
    isDefault: true,
    tasks: [
      { id: 'dka-1', name: 'ABG + Electrolytes', nameAr: '\u063A\u0627\u0632\u0627\u062A \u0627\u0644\u062F\u0645 + \u0623\u0645\u0644\u0627\u062D', timeframeMinutes: 15, category: 'lab', isCritical: true, orderCode: 'ABG', orderKind: 'LAB' },
      { id: 'dka-2', name: 'IV NS Bolus (1L/hr)', nameAr: '\u0633\u0648\u0627\u0626\u0644 \u0648\u0631\u064A\u062F\u064A\u0629', timeframeMinutes: 15, category: 'medication', isCritical: true },
      { id: 'dka-3', name: 'Insulin Infusion Start', nameAr: '\u0628\u062F\u0621 \u062A\u0633\u0631\u064A\u0628 \u0627\u0644\u0623\u0646\u0633\u0648\u0644\u064A\u0646', timeframeMinutes: 30, category: 'medication', isCritical: true },
      { id: 'dka-4', name: 'K+ Replacement if <5.3', nameAr: '\u062A\u0639\u0648\u064A\u0636 \u0627\u0644\u0628\u0648\u062A\u0627\u0633\u064A\u0648\u0645 \u0625\u0630\u0627 <5.3', timeframeMinutes: 30, category: 'medication', isCritical: true },
      { id: 'dka-5', name: 'Hourly Glucose Check', nameAr: '\u0641\u062D\u0635 \u0633\u0643\u0631 \u0643\u0644 \u0633\u0627\u0639\u0629', timeframeMinutes: 60, category: 'monitoring', isCritical: true },
      { id: 'dka-6', name: 'Repeat BMP in 2 Hours', nameAr: '\u0625\u0639\u0627\u062F\u0629 BMP \u0628\u0639\u062F \u0633\u0627\u0639\u062A\u064A\u0646', timeframeMinutes: 120, category: 'lab', isCritical: true },
      { id: 'dka-7', name: 'Anion Gap Closure Check', nameAr: '\u0641\u062D\u0635 \u0625\u063A\u0644\u0627\u0642 Anion Gap', timeframeMinutes: 240, category: 'lab', isCritical: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listPathways(tenantId: string): Promise<ClinicalPathway[]> {
  const docs = await prisma.clinicalPathway.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return docs.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    name: d.name,
    nameAr: d.nameAr || '',
    description: d.description || '',
    descriptionAr: d.descriptionAr || '',
    category: d.category || '',
    tasks: (d.tasks as unknown as PathwayTask[]) || [],
    totalDurationMinutes: d.totalDurationMinutes || 0,
    isActive: d.isActive,
    isDefault: d.isDefault,
    createdBy: d.createdBy || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function getPathway(tenantId: string, id: string): Promise<ClinicalPathway | null> {
  const doc = await prisma.clinicalPathway.findFirst({
    where: { tenantId, id },
  });
  if (!doc) return null;
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    nameAr: doc.nameAr || '',
    description: doc.description || '',
    descriptionAr: doc.descriptionAr || '',
    category: doc.category || '',
    tasks: (doc.tasks as unknown as PathwayTask[]) || [],
    totalDurationMinutes: doc.totalDurationMinutes || 0,
    isActive: doc.isActive,
    isDefault: doc.isDefault,
    createdBy: doc.createdBy || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createPathway(
  tenantId: string, userId: string,
  data: Omit<ClinicalPathway, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
): Promise<ClinicalPathway> {
  const doc = await prisma.clinicalPathway.create({
    data: {
      tenantId,
      name: data.name,
      nameAr: data.nameAr,
      description: data.description,
      descriptionAr: data.descriptionAr,
      category: data.category,
      tasks: data.tasks as unknown as Prisma.InputJsonValue,
      totalDurationMinutes: data.totalDurationMinutes,
      isActive: data.isActive,
      isDefault: data.isDefault,
      createdBy: userId,
    },
  });
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    nameAr: doc.nameAr || '',
    description: doc.description || '',
    descriptionAr: doc.descriptionAr || '',
    category: doc.category || '',
    tasks: (doc.tasks as unknown as PathwayTask[]) || [],
    totalDurationMinutes: doc.totalDurationMinutes || 0,
    isActive: doc.isActive,
    isDefault: doc.isDefault,
    createdBy: doc.createdBy || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function updatePathway(
  tenantId: string, id: string,
  updates: Partial<ClinicalPathway>,
): Promise<boolean> {
  const result = await prisma.clinicalPathway.updateMany({
    where: { tenantId, id },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.nameAr !== undefined ? { nameAr: updates.nameAr } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.tasks !== undefined ? { tasks: updates.tasks as unknown as Prisma.InputJsonValue } : {}),
      ...(updates.totalDurationMinutes !== undefined ? { totalDurationMinutes: updates.totalDurationMinutes } : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.isDefault !== undefined ? { isDefault: updates.isDefault } : {}),
    },
  });
  return result.count > 0;
}

export async function seedDefaultPathways(tenantId: string, userId: string): Promise<number> {
  const existing = await prisma.clinicalPathway.count({ where: { tenantId } });
  if (existing > 0) return 0;

  for (const p of DEFAULT_PATHWAYS) {
    await prisma.clinicalPathway.create({
      data: {
        tenantId,
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        descriptionAr: p.descriptionAr,
        category: p.category,
        tasks: p.tasks as unknown as Prisma.InputJsonValue,
        totalDurationMinutes: p.totalDurationMinutes,
        isActive: p.isActive,
        isDefault: p.isDefault,
        createdBy: userId,
      },
    });
  }
  return DEFAULT_PATHWAYS.length;
}

// ---------------------------------------------------------------------------
// Pathway Instance Management
// ---------------------------------------------------------------------------

/**
 * Start a pathway for a patient encounter.
 */
export async function startPathway(
  tenantId: string,
  userId: string,
  params: { pathwayId: string; patientId: string; encounterId: string },
): Promise<PathwayInstance | null> {
  const pathway = await getPathway(tenantId, params.pathwayId);
  if (!pathway) return null;

  const now = new Date();

  const tasks: PathwayTaskInstance[] = pathway.tasks.map((t) => ({
    taskId: t.id,
    taskName: t.name,
    status: 'pending',
    dueAt: new Date(now.getTime() + t.timeframeMinutes * 60000),
  }));

  const doc = await prisma.clinicalPathwayInstance.create({
    data: {
      tenantId,
      pathwayId: pathway.id,
      pathwayName: pathway.name,
      patientId: params.patientId,
      encounterId: params.encounterId,
      startedAt: now,
      startedBy: userId,
      status: 'active',
      tasks: tasks as unknown as Prisma.InputJsonValue,
      compliance: 0,
    },
  });

  logger.info('Clinical pathway started', {
    category: 'api',
    tenantId,
    pathwayId: pathway.id,
    pathwayName: pathway.name,
    patientId: params.patientId,
  } as Record<string, unknown>);

  return {
    id: doc.id,
    tenantId: doc.tenantId,
    pathwayId: doc.pathwayId,
    pathwayName: doc.pathwayName || '',
    patientId: doc.patientId || '',
    encounterId: doc.encounterId || '',
    startedAt: doc.startedAt || now,
    startedBy: doc.startedBy || '',
    status: doc.status as PathwayInstance['status'],
    tasks: (doc.tasks as unknown as PathwayTaskInstance[]) || [],
    compliance: doc.compliance || 0,
    completedAt: doc.completedAt || undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Complete a task in a pathway instance.
 */
export async function completePathwayTask(
  tenantId: string,
  instanceId: string,
  taskId: string,
  userId: string,
  notes?: string,
): Promise<PathwayInstance | null> {
  const doc = await prisma.clinicalPathwayInstance.findFirst({
    where: { tenantId, id: instanceId },
  });
  if (!doc) return null;

  const tasks = (doc.tasks as unknown as PathwayTaskInstance[]) || [];
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return null;

  const now = new Date();
  task.status = 'completed';
  task.completedAt = now;
  task.completedBy = userId;
  if (notes) task.notes = notes;

  // Calculate compliance
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const compliance = Math.round((completedTasks / totalTasks) * 100);

  // Check if all tasks done
  const allDone = completedTasks === totalTasks;

  await prisma.clinicalPathwayInstance.update({
    where: { id: instanceId },
    data: {
      tasks: tasks as unknown as Prisma.InputJsonValue,
      compliance,
      status: allDone ? 'completed' : 'active',
      completedAt: allDone ? now : undefined,
    },
  });

  return {
    id: doc.id,
    tenantId: doc.tenantId,
    pathwayId: doc.pathwayId,
    pathwayName: doc.pathwayName || '',
    patientId: doc.patientId || '',
    encounterId: doc.encounterId || '',
    startedAt: doc.startedAt || new Date(),
    startedBy: doc.startedBy || '',
    status: allDone ? 'completed' : 'active',
    tasks,
    compliance,
    completedAt: allDone ? now : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Check for overdue pathway tasks.
 */
export async function checkOverdueTasks(
  tenantId: string,
): Promise<Array<{ instanceId: string; pathwayName: string; taskName: string; dueAt: Date; patientId: string }>> {
  const now = new Date();
  const instances = await prisma.clinicalPathwayInstance.findMany({
    where: { tenantId, status: 'active' },
  });

  const overdue: Array<{ instanceId: string; pathwayName: string; taskName: string; dueAt: Date; patientId: string }> = [];

  for (const inst of instances) {
    const tasks = (inst.tasks as unknown as PathwayTaskInstance[]) || [];
    let changed = false;

    for (const task of tasks) {
      if (task.status === 'pending' && new Date(task.dueAt) < now) {
        task.status = 'overdue';
        changed = true;
        overdue.push({
          instanceId: inst.id,
          pathwayName: inst.pathwayName || '',
          taskName: task.taskName,
          dueAt: task.dueAt,
          patientId: inst.patientId || '',
        });
      }
    }

    // Update instance if any tasks changed
    if (changed) {
      await prisma.clinicalPathwayInstance.update({
        where: { id: inst.id },
        data: { tasks: tasks as unknown as Prisma.InputJsonValue },
      });
    }
  }

  return overdue;
}

/**
 * Get pathway instances for a patient.
 */
export async function getPatientPathways(
  tenantId: string,
  patientId: string,
): Promise<PathwayInstance[]> {
  const docs = await prisma.clinicalPathwayInstance.findMany({
    where: { tenantId, patientId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return docs.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    pathwayId: d.pathwayId,
    pathwayName: d.pathwayName || '',
    patientId: d.patientId || '',
    encounterId: d.encounterId || '',
    startedAt: d.startedAt || new Date(),
    startedBy: d.startedBy || '',
    status: d.status as PathwayInstance['status'],
    tasks: (d.tasks as unknown as PathwayTaskInstance[]) || [],
    compliance: d.compliance || 0,
    completedAt: d.completedAt || undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}
