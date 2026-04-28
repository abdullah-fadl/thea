// =============================================================================
// Daily Care Path — Auto-Generation Engine
// =============================================================================
// Generates a daily care path for a patient by pulling from active orders,
// prescriptions, care plans, and system schedules.

import { PrismaClient } from '@prisma/client';
import {
  type CarePathDepartment,
  type CarePathTemplate,
  type TaskCategory,
  type ShiftType,
  type MedicationTaskData,
  type VitalsTaskData,
  type LabTaskData,
  type ProcedureTaskData,
  DEPARTMENT_TEMPLATE_MAP,
  DEFAULT_MEAL_TIMES,
  frequencyToHours,
  generateDayTimeSlots,
  getShiftForTime,
} from './carePath';
import crypto from 'crypto';
import {
  getBabyPathTasks,
  getNICUPathTasks,
  getCriticalCarePathTasks,
  getLDRPathTasks,
} from './carePathTemplates';

interface GeneratePathInput {
  tenantId: string;
  patientMasterId: string;
  encounterCoreId?: string;
  episodeId?: string;
  erEncounterId?: string;
  department: CarePathDepartment;
  date: Date; // The date for the path
  nurseUserId?: string;
  nurseName?: string;
  nurseNameAr?: string;
}

interface TaskSeed {
  category: TaskCategory;
  subcategory?: string;
  scheduledTime: Date;
  scheduledEndTime?: Date;
  isRecurring: boolean;
  recurrenceRule?: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  priority: string;
  sourceType: string;
  sourceOrderId?: string;
  sourcePrescriptionId?: string;
  sourceCarePlanId?: string;
  taskData?: Record<string, unknown>;
  requiresWitness?: boolean;
  sortOrder: number;
}

function toDateAtTime(baseDate: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function nextDayAt(baseDate: Date, timeStr: string): Date {
  const d = toDateAtTime(baseDate, timeStr);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function generateDailyCarePath(
  prisma: PrismaClient,
  input: GeneratePathInput
): Promise<{ carePathId: string; tasksCreated: number }> {
  const {
    tenantId, patientMasterId, encounterCoreId, episodeId,
    erEncounterId, department, date, nurseUserId, nurseName, nurseNameAr
  } = input;

  const template = DEPARTMENT_TEMPLATE_MAP[department];
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // 1. Build patient snapshot
  const patient = await prisma.patientMaster.findUnique({
    where: { id: patientMasterId },
    select: {
      fullName: true, mrn: true, dob: true, gender: true,
      bloodType: true, knownAllergies: true,
    },
  });

  const patientSnapshot: Record<string, unknown> = {
    fullName: patient?.fullName ?? 'Unknown',
    mrn: patient?.mrn ?? '',
    dob: patient?.dob?.toISOString().split('T')[0],
    gender: patient?.gender,
    bloodType: patient?.bloodType,
    allergies: Array.isArray(patient?.knownAllergies) ? patient.knownAllergies : [],
  };

  // Enrich with bed/room info from IPD if available
  if (episodeId) {
    const admission = await prisma.ipdAdmission.findFirst({
      where: { tenantId, episodeId, isActive: true },
      select: { patientName: true, diagnosis: true },
    });
    const episode = await prisma.ipdEpisode.findFirst({
      where: { id: episodeId, tenantId },
      select: { location: true, reasonForAdmission: true },
    });
    if (episode?.location && typeof episode.location === 'object') {
      const loc = episode.location as Record<string, string>;
      patientSnapshot.room = loc.room;
      patientSnapshot.bed = loc.bed;
      patientSnapshot.ward = loc.ward;
    }
    if (admission?.diagnosis) {
      patientSnapshot.diagnosis = admission.diagnosis;
    }
  }

  // 2. Generate bedside access token
  const bedsideToken = crypto.randomBytes(16).toString('hex');
  const bedsidePin = String(Math.floor(1000 + Math.random() * 9000));

  // 3. Collect tasks from all sources
  const tasks: TaskSeed[] = [];
  let sortOrder = 0;

  // --- A) Active medication orders → Medication tasks ---
  await collectMedicationTasks(prisma, tenantId, patientMasterId, encounterCoreId, episodeId, dateOnly, tasks, sortOrder);
  sortOrder = tasks.length;

  // --- B) Vitals schedule → Vitals tasks ---
  collectVitalsTasks(department, template, dateOnly, tasks, sortOrder);
  sortOrder = tasks.length;

  // --- C) Active lab/radiology orders → Lab/Radiology tasks ---
  await collectLabRadiologyTasks(prisma, tenantId, patientMasterId, encounterCoreId, dateOnly, tasks, sortOrder);
  sortOrder = tasks.length;

  // --- D) Diet/meals → Diet tasks ---
  collectDietTasks(template, dateOnly, tasks, sortOrder);
  sortOrder = tasks.length;

  // --- E) Nursing care plan tasks ---
  if (episodeId) {
    await collectCarePlanTasks(prisma, tenantId, episodeId, dateOnly, tasks, sortOrder);
    sortOrder = tasks.length;
  }

  // --- F) Template-specific tasks (Baby, NICU, Critical, LDR) ---
  collectTemplateTasks(template, dateOnly, tasks, sortOrder);
  sortOrder = tasks.length;

  // Sort all tasks by scheduled time
  tasks.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  tasks.forEach((t, i) => { t.sortOrder = i; });

  // 4. Create the path with shifts and tasks in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Check if path already exists for this date
    const existing = await tx.dailyCarePath.findUnique({
      where: {
        tenantId_patientMasterId_date_departmentType: {
          tenantId, patientMasterId, date: dateOnly, departmentType: department,
        },
      },
    });

    if (existing) {
      return { carePathId: existing.id, tasksCreated: 0, alreadyExists: true };
    }

    // Create path
    const carePath = await tx.dailyCarePath.create({
      data: {
        tenantId,
        patientMasterId,
        encounterCoreId,
        episodeId,
        erEncounterId,
        date: dateOnly,
        departmentType: department,
        templateType: template,
        patientSnapshot: patientSnapshot as object,
        dietOrder: buildDietOrder(template) as object,
        instructions: [],
        roundsSchedule: [],
        status: 'ACTIVE',
        bedsideToken,
        bedsidePin,
      },
    });

    // Create shifts
    const dayShiftStart = toDateAtTime(dateOnly, '07:00');
    const dayShiftEnd   = toDateAtTime(dateOnly, '19:00');
    const nightShiftStart = toDateAtTime(dateOnly, '19:00');
    const nightShiftEnd   = nextDayAt(dateOnly, '07:00');

    const dayShift = await tx.carePathShift.create({
      data: {
        tenantId,
        carePathId: carePath.id,
        shiftType: 'DAY',
        nurseUserId: nurseUserId ?? null,
        nurseName: nurseName ?? null,
        nurseNameAr: nurseNameAr ?? null,
        startTime: dayShiftStart,
        endTime: dayShiftEnd,
        status: 'PENDING',
      },
    });

    const nightShift = await tx.carePathShift.create({
      data: {
        tenantId,
        carePathId: carePath.id,
        shiftType: 'NIGHT',
        startTime: nightShiftStart,
        endTime: nightShiftEnd,
        status: 'PENDING',
      },
    });

    // Create tasks
    const createdTasks = await Promise.all(
      tasks.map((task) => {
        const timeStr = task.scheduledTime.toTimeString().slice(0, 5);
        const shift = getShiftForTime(timeStr);
        const shiftId = shift === 'DAY' ? dayShift.id : nightShift.id;

        return tx.carePathTask.create({
          data: {
            tenantId,
            carePathId: carePath.id,
            shiftId,
            category: task.category,
            subcategory: task.subcategory,
            scheduledTime: task.scheduledTime,
            scheduledEndTime: task.scheduledEndTime,
            isRecurring: task.isRecurring,
            recurrenceRule: task.recurrenceRule,
            title: task.title,
            titleAr: task.titleAr,
            description: task.description,
            descriptionAr: task.descriptionAr,
            priority: task.priority,
            sourceType: task.sourceType,
            sourceOrderId: task.sourceOrderId,
            sourcePrescriptionId: task.sourcePrescriptionId,
            taskData: (task.taskData ?? undefined) as object | undefined,
            requiresWitness: task.requiresWitness ?? false,
            status: 'PENDING',
            sortOrder: task.sortOrder,
          },
        });
      })
    );

    // Update shift task counts
    const dayTasks = createdTasks.filter(t => t.shiftId === dayShift.id).length;
    const nightTasks = createdTasks.filter(t => t.shiftId === nightShift.id).length;

    await tx.carePathShift.update({
      where: { id: dayShift.id },
      data: { totalTasks: dayTasks },
    });
    await tx.carePathShift.update({
      where: { id: nightShift.id },
      data: { totalTasks: nightTasks },
    });

    return { carePathId: carePath.id, tasksCreated: createdTasks.length };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Task collection helpers
// ---------------------------------------------------------------------------

async function collectMedicationTasks(
  prisma: PrismaClient,
  tenantId: string,
  patientMasterId: string,
  encounterCoreId: string | undefined,
  episodeId: string | undefined,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  // Pull active prescriptions
  const prescriptions = await prisma.pharmacyPrescription.findMany({
    where: {
      tenantId,
      patientId: patientMasterId,
      status: { in: ['PENDING', 'VERIFIED', 'DISPENSED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Pull active medication orders from OrdersHub
  const medOrders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      patientMasterId,
      kind: 'MEDICATION',
      status: { in: ['ORDERED', 'IN_PROGRESS'] },
    },
    orderBy: { orderedAt: 'desc' },
    take: 50,
  });

  const seen = new Set<string>();
  let order = startOrder;

  for (const rx of prescriptions as any[]) {
    const key = `${rx.medication}-${rx.dose}-${rx.frequency}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const freq = rx.frequency?.toUpperCase() ?? 'QD';
    const timeSlots = generateDayTimeSlots(freq);

    if (timeSlots.length === 0 && freq !== 'PRN' && freq !== 'STAT' && freq !== 'CONTINUOUS') {
      timeSlots.push('08:00');
    }

    if (freq === 'STAT') {
      tasks.push({
        category: 'MEDICATION',
        subcategory: rx.route ?? 'PO',
        scheduledTime: toDateAtTime(dateOnly, '08:00'),
        isRecurring: false,
        title: `${rx.medication ?? 'Unknown'} ${rx.dose ?? ''} ${rx.route ?? ''}`.trim(),
        titleAr: rx.medicationAr ? `${rx.medicationAr} ${rx.dose ?? ''} ${rx.route ?? ''}`.trim() : undefined,
        priority: 'STAT',
        sourceType: 'AUTO',
        sourcePrescriptionId: rx.id,
        taskData: {
          drugName: rx.medication,
          drugNameAr: rx.medicationAr,
          genericName: rx.genericName,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          isHighAlert: false,
        } satisfies MedicationTaskData as unknown as Record<string, unknown>,
        sortOrder: order++,
      });
      continue;
    }

    for (const time of timeSlots) {
      tasks.push({
        category: 'MEDICATION',
        subcategory: rx.route ?? 'PO',
        scheduledTime: toDateAtTime(dateOnly, time),
        isRecurring: true,
        recurrenceRule: freq,
        title: `${rx.medication ?? 'Unknown'} ${rx.dose ?? ''} ${rx.route ?? ''}`.trim(),
        titleAr: rx.medicationAr ? `${rx.medicationAr} ${rx.dose ?? ''} ${rx.route ?? ''}`.trim() : undefined,
        priority: rx.priority === 'URGENT' ? 'URGENT' : 'ROUTINE',
        sourceType: 'AUTO',
        sourcePrescriptionId: rx.id,
        taskData: {
          drugName: rx.medication,
          drugNameAr: rx.medicationAr,
          genericName: rx.genericName,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          isHighAlert: false,
        } satisfies MedicationTaskData as unknown as Record<string, unknown>,
        sortOrder: order++,
      });
    }
  }

  // Also process orders from OrdersHub that aren't already covered by prescriptions
  for (const o of medOrders) {
    const meta = (o.meta as Record<string, unknown>) ?? {};
    const drugName = o.orderName ?? (meta.medication as string) ?? 'Unknown';
    const dose = (meta.dose as string) ?? '';
    const route = (meta.route as string) ?? '';
    const freq = ((meta.frequency as string) ?? 'QD').toUpperCase();
    const key = `${drugName}-${dose}-${freq}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const timeSlots = generateDayTimeSlots(freq);
    if (timeSlots.length === 0) timeSlots.push('08:00');

    for (const time of timeSlots) {
      tasks.push({
        category: 'MEDICATION',
        subcategory: route,
        scheduledTime: toDateAtTime(dateOnly, time),
        isRecurring: true,
        recurrenceRule: freq,
        title: `${drugName} ${dose} ${route}`.trim(),
        titleAr: o.orderNameAr ? `${o.orderNameAr} ${dose} ${route}`.trim() : undefined,
        priority: o.priority === 'STAT' ? 'STAT' : o.priority === 'URGENT' ? 'URGENT' : 'ROUTINE',
        sourceType: 'AUTO',
        sourceOrderId: o.id,
        taskData: {
          drugName,
          dose,
          route,
          frequency: freq,
        } as Record<string, unknown>,
        sortOrder: order++,
      });
    }
  }
}

function collectVitalsTasks(
  department: CarePathDepartment,
  _template: CarePathTemplate,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  // Templates that handle their own vitals (skip default generation)
  if (['NICU', 'ICU', 'NURSERY', 'LDR'].includes(department)) return;

  const freqMap: Record<CarePathDepartment, string> = {
    OPD: 'Q4H',
    IPD: 'Q4H',
    ER: 'Q2H',
    ICU: 'Q1H',
    NICU: 'Q3H',
    NURSERY: 'Q3H',
    LDR: 'Q2H',
  };

  const freq = freqMap[department];
  const timeSlots = generateDayTimeSlots(freq);
  let order = startOrder;

  for (const time of timeSlots) {
    const params = department === 'NICU'
      ? ['Temp', 'HR', 'RR', 'SpO2', 'FiO2']
      : department === 'ICU'
        ? ['BP', 'HR', 'RR', 'Temp', 'SpO2', 'MAP', 'CVP']
        : department === 'LDR'
          ? ['BP', 'HR', 'Temp', 'FHR', 'Contractions']
          : ['BP', 'HR', 'RR', 'Temp', 'SpO2'];

    tasks.push({
      category: 'VITALS',
      subcategory: 'ROUTINE',
      scheduledTime: toDateAtTime(dateOnly, time),
      isRecurring: true,
      recurrenceRule: freq,
      title: `Vital Signs (${freq})`,
      titleAr: `العلامات الحيوية (${freq})`,
      priority: 'ROUTINE',
      sourceType: 'AUTO',
      taskData: {
        frequency: freq,
        parameters: params,
      } satisfies VitalsTaskData as unknown as Record<string, unknown>,
      sortOrder: order++,
    });
  }
}

async function collectLabRadiologyTasks(
  prisma: PrismaClient,
  tenantId: string,
  patientMasterId: string,
  encounterCoreId: string | undefined,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  const startOfDay = new Date(dateOnly);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateOnly);
  endOfDay.setHours(23, 59, 59, 999);

  const orders = await prisma.ordersHub.findMany({
    where: {
      tenantId,
      patientMasterId,
      kind: { in: ['LAB', 'RADIOLOGY', 'PROCEDURE'] },
      status: { in: ['ORDERED', 'IN_PROGRESS'] },
      orderedAt: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { orderedAt: 'asc' },
  });

  let order = startOrder;
  for (const o of orders) {
    const cat: TaskCategory = o.kind === 'LAB' ? 'LAB'
      : o.kind === 'RADIOLOGY' ? 'RADIOLOGY'
        : 'PROCEDURE';

    const scheduledTime = o.orderedAt ?? toDateAtTime(dateOnly, '08:00');

    tasks.push({
      category: cat,
      scheduledTime,
      isRecurring: false,
      title: o.orderName ?? `${o.kind} Order`,
      titleAr: o.orderNameAr,
      description: o.clinicalText ?? o.notes,
      priority: o.priority === 'STAT' ? 'STAT' : o.priority === 'URGENT' ? 'URGENT' : 'ROUTINE',
      sourceType: 'AUTO',
      sourceOrderId: o.id,
      taskData: cat === 'LAB'
        ? { testCode: o.orderCode, testName: o.orderName, testNameAr: o.orderNameAr } satisfies LabTaskData as unknown as Record<string, unknown>
        : { procedureName: o.orderName, procedureNameAr: o.orderNameAr, category: o.kind } satisfies ProcedureTaskData as unknown as Record<string, unknown>,
      sortOrder: order++,
    });
  }
}

function collectDietTasks(
  template: CarePathTemplate,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  const meals = template === 'nicu' ? [] : DEFAULT_MEAL_TIMES.STANDARD;
  let order = startOrder;

  for (const meal of meals) {
    tasks.push({
      category: 'DIET',
      scheduledTime: toDateAtTime(dateOnly, meal.time),
      isRecurring: true,
      title: meal.label,
      titleAr: meal.labelAr,
      priority: 'ROUTINE',
      sourceType: 'AUTO',
      taskData: { mealLabel: meal.label, mealLabelAr: meal.labelAr } as Record<string, unknown>,
      sortOrder: order++,
    });
  }
}

async function collectCarePlanTasks(
  prisma: PrismaClient,
  tenantId: string,
  episodeId: string,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  const carePlans = await prisma.ipdCarePlan.findMany({
    where: { tenantId, episodeId, status: 'ACTIVE' },
  });

  let order = startOrder;
  for (const cp of carePlans) {
    const interventions = cp.interventions;
    if (!interventions) continue;

    tasks.push({
      category: 'NURSING_CARE',
      scheduledTime: toDateAtTime(dateOnly, '08:00'),
      isRecurring: false,
      title: `Care Plan: ${cp.problem ?? 'Nursing intervention'}`,
      titleAr: cp.problem ? `خطة رعاية: ${cp.problem}` : 'تدخل تمريضي',
      description: typeof interventions === 'string' ? interventions : JSON.stringify(interventions),
      priority: 'ROUTINE',
      sourceType: 'AUTO',
      sourceCarePlanId: cp.id,
      taskData: { problem: cp.problem, goals: cp.goals, interventions } as Record<string, unknown>,
      sortOrder: order++,
    });
  }
}

function collectTemplateTasks(
  template: CarePathTemplate,
  dateOnly: Date,
  tasks: TaskSeed[],
  startOrder: number,
) {
  let templateTasks;
  switch (template) {
    case 'baby':
      templateTasks = getBabyPathTasks();
      break;
    case 'nicu':
      templateTasks = getNICUPathTasks();
      break;
    case 'critical':
      templateTasks = getCriticalCarePathTasks();
      break;
    case 'ldr':
      templateTasks = getLDRPathTasks();
      break;
    default:
      return; // 'adult' uses the standard collectors above
  }

  let order = startOrder;
  const existingKeys = new Set(tasks.map(t => `${t.category}-${t.scheduledTime.toTimeString().slice(0, 5)}-${t.title}`));

  for (const tt of templateTasks) {
    const key = `${tt.category}-${tt.time}-${tt.title}`;
    if (existingKeys.has(key)) continue; // Skip duplicates with auto-generated tasks

    tasks.push({
      category: tt.category,
      subcategory: tt.subcategory,
      scheduledTime: toDateAtTime(dateOnly, tt.time),
      isRecurring: tt.isRecurring,
      recurrenceRule: tt.recurrenceRule,
      title: tt.title,
      titleAr: tt.titleAr,
      description: tt.description,
      descriptionAr: tt.descriptionAr,
      priority: tt.priority ?? 'ROUTINE',
      sourceType: 'AUTO',
      taskData: tt.taskData,
      sortOrder: order++,
    });
  }
}

function buildDietOrder(template: CarePathTemplate) {
  if (template === 'nicu') {
    return { type: 'TUBE_FEEDING', typeAr: 'تغذية أنبوبية', mealTimes: [] };
  }
  return {
    type: 'REGULAR',
    typeAr: 'حمية عادية',
    mealTimes: DEFAULT_MEAL_TIMES.STANDARD,
  };
}

// ---------------------------------------------------------------------------
// Add task to existing path (for mid-shift order changes)
// ---------------------------------------------------------------------------
export async function addTaskToPath(
  prisma: PrismaClient,
  carePathId: string,
  tenantId: string,
  task: Omit<TaskSeed, 'sortOrder'>,
  alertDetails?: { alertType: string; title: string; titleAr?: string; message?: string; messageAr?: string; sourceOrderId?: string }
) {
  return prisma.$transaction(async (tx) => {
    const maxSort = await tx.carePathTask.aggregate({
      where: { carePathId },
      _max: { sortOrder: true },
    });

    const timeStr = task.scheduledTime.toTimeString().slice(0, 5);
    const shiftType = getShiftForTime(timeStr);

    const shift = await tx.carePathShift.findFirst({
      where: { carePathId, shiftType },
    });

    const newTask = await tx.carePathTask.create({
      data: {
        tenantId,
        carePathId,
        shiftId: shift?.id,
        category: task.category,
        subcategory: task.subcategory,
        scheduledTime: task.scheduledTime,
        scheduledEndTime: task.scheduledEndTime,
        isRecurring: task.isRecurring,
        recurrenceRule: task.recurrenceRule,
        title: task.title,
        titleAr: task.titleAr,
        description: task.description,
        descriptionAr: task.descriptionAr,
        priority: task.priority,
        sourceType: 'ORDER_UPDATE',
        sourceOrderId: task.sourceOrderId,
        sourcePrescriptionId: task.sourcePrescriptionId,
        taskData: (task.taskData ?? undefined) as object | undefined,
        requiresWitness: task.requiresWitness ?? false,
        status: 'PENDING',
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    // Create alert if specified
    let alertId: string | undefined;
    if (alertDetails) {
      const alert = await tx.carePathAlert.create({
        data: {
          tenantId,
          carePathId,
          alertType: alertDetails.alertType,
          severity: alertDetails.alertType === 'STAT_ORDER' ? 'CRITICAL' : 'WARNING',
          title: alertDetails.title,
          titleAr: alertDetails.titleAr,
          message: alertDetails.message,
          messageAr: alertDetails.messageAr,
          sourceOrderId: alertDetails.sourceOrderId,
          generatedTaskId: newTask.id,
        },
      });
      alertId = alert.id;
    }

    // Update shift task count
    if (shift) {
      await tx.carePathShift.update({
        where: { id: shift.id },
        data: { totalTasks: { increment: 1 } },
      });
    }

    return { taskId: newTask.id, alertId };
  });
}
