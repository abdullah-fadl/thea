/**
 * Smart Order Sets
 *
 * Predefined order bundles that create multiple related orders in a single click.
 * Examples: "Chest Pain Protocol" -> ECG + Troponin + CXR + CBC + BMP
 *
 * Order sets are stored in the `order_sets` table via Prisma.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderSetItem {
  kind: 'LAB' | 'RADIOLOGY' | 'MEDICATION' | 'PROCEDURE' | 'CONSULT';
  orderCode: string;
  orderName: string;
  orderNameAr?: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  department?: string;
  instructions?: string;
  /** For medications */
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
}

export interface OrderSet {
  id: string;
  tenantId: string;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  descriptionAr?: string;
  items: OrderSetItem[];
  isActive: boolean;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderSetExecutionResult {
  orderSetId: string;
  orderSetName: string;
  createdOrders: Array<{
    id: string;
    kind: string;
    orderName: string;
    status: string;
  }>;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Built-in Order Sets (Defaults)
// ---------------------------------------------------------------------------

export const DEFAULT_ORDER_SETS: Omit<OrderSet, 'id' | 'tenantId' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Chest Pain Protocol',
    nameAr: '\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0623\u0644\u0645 \u0627\u0644\u0635\u062F\u0631',
    category: 'Emergency',
    description: 'Standard workup for acute chest pain presentation',
    descriptionAr: '\u0641\u062D\u0635 \u0634\u0627\u0645\u0644 \u0644\u062D\u0627\u0644\u0627\u062A \u0623\u0644\u0645 \u0627\u0644\u0635\u062F\u0631 \u0627\u0644\u062D\u0627\u062F',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'LAB', orderCode: 'TROP', orderName: 'Troponin I', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'BMP', orderName: 'Basic Metabolic Panel', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'DDIR', orderName: 'D-Dimer', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'PT', orderName: 'PT/INR', priority: 'STAT' },
      { kind: 'RADIOLOGY', orderCode: 'CXR', orderName: 'Chest X-Ray PA', priority: 'STAT' },
      { kind: 'PROCEDURE', orderCode: 'ECG', orderName: '12-Lead ECG', priority: 'STAT' },
    ],
  },
  {
    name: 'Sepsis Bundle',
    nameAr: '\u062D\u0632\u0645\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u0646 \u0627\u0644\u062F\u0645\u0648\u064A',
    category: 'Emergency',
    description: 'Surviving Sepsis Campaign hour-1 bundle',
    descriptionAr: '\u062D\u0632\u0645\u0629 \u0627\u0644\u0633\u0627\u0639\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u0644\u0644\u0625\u0646\u062A\u0627\u0646',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'LAB', orderCode: 'LACT', orderName: 'Lactate', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'BC', orderName: 'Blood Culture x2', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'CRP', orderName: 'C-Reactive Protein', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'PCT', orderName: 'Procalcitonin', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'BMP', orderName: 'Basic Metabolic Panel', priority: 'STAT' },
      { kind: 'MEDICATION', orderCode: 'NS', orderName: 'Normal Saline 1L IV', priority: 'STAT', dose: '1000', route: 'IV', frequency: 'ONCE' },
    ],
  },
  {
    name: 'DKA Protocol',
    nameAr: '\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u062D\u0645\u0627\u0636 \u0627\u0644\u0643\u064A\u062A\u0648\u0646\u064A \u0627\u0644\u0633\u0643\u0631\u064A',
    category: 'Emergency',
    description: 'Diabetic ketoacidosis initial workup and treatment',
    descriptionAr: '\u0641\u062D\u0635 \u0648\u0639\u0644\u0627\u062C \u0623\u0648\u0644\u064A \u0644\u0644\u062D\u0645\u0627\u0636 \u0627\u0644\u0643\u064A\u062A\u0648\u0646\u064A',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'LAB', orderCode: 'GLU', orderName: 'Blood Glucose', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'ABG', orderName: 'Arterial Blood Gas', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'BMP', orderName: 'Basic Metabolic Panel', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'HBA1C', orderName: 'HbA1c', priority: 'URGENT' },
      { kind: 'LAB', orderCode: 'UA', orderName: 'Urinalysis + Ketones', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'PHOS', orderName: 'Phosphate', priority: 'URGENT' },
      { kind: 'PROCEDURE', orderCode: 'ECG', orderName: '12-Lead ECG', priority: 'STAT' },
    ],
  },
  {
    name: 'Stroke Protocol',
    nameAr: '\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u0633\u0643\u062A\u0629 \u0627\u0644\u062F\u0645\u0627\u063A\u064A\u0629',
    category: 'Emergency',
    description: 'Acute stroke evaluation',
    descriptionAr: '\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0633\u0643\u062A\u0629 \u0627\u0644\u062F\u0645\u0627\u063A\u064A\u0629 \u0627\u0644\u062D\u0627\u062F\u0629',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'RADIOLOGY', orderCode: 'CTH', orderName: 'CT Head without Contrast', priority: 'STAT' },
      { kind: 'RADIOLOGY', orderCode: 'CTA', orderName: 'CT Angiography Head/Neck', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'BMP', orderName: 'Basic Metabolic Panel', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'PT', orderName: 'PT/INR', priority: 'STAT' },
      { kind: 'LAB', orderCode: 'GLU', orderName: 'Blood Glucose', priority: 'STAT' },
      { kind: 'PROCEDURE', orderCode: 'ECG', orderName: '12-Lead ECG', priority: 'STAT' },
    ],
  },
  {
    name: 'Pre-Op Standard',
    nameAr: '\u0641\u062D\u0648\u0635\u0627\u062A \u0645\u0627 \u0642\u0628\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0629',
    category: 'Surgery',
    description: 'Standard pre-operative assessment',
    descriptionAr: '\u062A\u0642\u064A\u064A\u0645 \u0645\u0639\u064A\u0627\u0631\u064A \u0642\u0628\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0629',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'BMP', orderName: 'Basic Metabolic Panel', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'PT', orderName: 'PT/INR/PTT', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'BT', orderName: 'Blood Type & Screen', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'UA', orderName: 'Urinalysis', priority: 'ROUTINE' },
      { kind: 'RADIOLOGY', orderCode: 'CXR', orderName: 'Chest X-Ray PA', priority: 'ROUTINE' },
      { kind: 'PROCEDURE', orderCode: 'ECG', orderName: '12-Lead ECG', priority: 'ROUTINE' },
    ],
  },
  {
    name: 'Well-Baby Check',
    nameAr: '\u0641\u062D\u0635 \u0627\u0644\u0637\u0641\u0644 \u0627\u0644\u0633\u0644\u064A\u0645',
    category: 'Pediatrics',
    description: 'Routine pediatric wellness visit labs',
    descriptionAr: '\u062A\u062D\u0627\u0644\u064A\u0644 \u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0637\u0641\u0644 \u0627\u0644\u0631\u0648\u062A\u064A\u0646\u064A\u0629',
    isActive: true,
    isDefault: true,
    items: [
      { kind: 'LAB', orderCode: 'CBC', orderName: 'Complete Blood Count', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'IRON', orderName: 'Iron Studies', priority: 'ROUTINE' },
      { kind: 'LAB', orderCode: 'LEAD', orderName: 'Lead Level', priority: 'ROUTINE' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Internal helper — map Prisma row to OrderSet interface
// ---------------------------------------------------------------------------

function rowToOrderSet(row: any): OrderSet {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    nameAr: row.nameAr ?? '',
    category: row.category ?? 'General',
    description: row.description ?? undefined,
    descriptionAr: row.descriptionAr ?? undefined,
    items: (row.items as OrderSetItem[]) ?? [],
    isActive: row.isActive,
    isDefault: row.isDefault,
    createdBy: row.createdByUserId ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

/**
 * List all order sets for a tenant.
 */
export async function listOrderSets(
  tenantId: string,
  options?: { category?: string; activeOnly?: boolean },
): Promise<OrderSet[]> {
  const where: Record<string, unknown> = { tenantId };
  if (options?.category) where.category = options.category;
  if (options?.activeOnly) where.isActive = true;

  const rows = await prisma.orderSet.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return rows.map(rowToOrderSet);
}

/**
 * Get a single order set by ID.
 */
export async function getOrderSet(
  tenantId: string,
  id: string,
): Promise<OrderSet | null> {
  const row = await prisma.orderSet.findFirst({
    where: { tenantId, id },
  });

  return row ? rowToOrderSet(row) : null;
}

/**
 * Create a new order set.
 */
export async function createOrderSet(
  tenantId: string,
  userId: string,
  data: {
    name: string;
    nameAr: string;
    category: string;
    description?: string;
    descriptionAr?: string;
    items: OrderSetItem[];
  },
): Promise<OrderSet> {
  const row = await prisma.orderSet.create({
    data: {
      tenantId,
      name: data.name,
      nameAr: data.nameAr,
      category: data.category,
      description: data.description,
      descriptionAr: data.descriptionAr,
      items: data.items as any,
      isActive: true,
      isDefault: false,
      createdByUserId: userId,
    },
  });

  logger.info('Order set created', {
    category: 'api',
    tenantId,
    orderSetId: row.id,
    name: data.name,
  } as Record<string, unknown>);

  return rowToOrderSet(row);
}

/**
 * Update an existing order set.
 */
export async function updateOrderSet(
  tenantId: string,
  id: string,
  updates: Partial<Pick<OrderSet, 'name' | 'nameAr' | 'category' | 'description' | 'descriptionAr' | 'items' | 'isActive'>>,
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.nameAr !== undefined) data.nameAr = updates.nameAr;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.descriptionAr !== undefined) data.descriptionAr = updates.descriptionAr;
  if (updates.items !== undefined) data.items = updates.items as any;
  if (updates.isActive !== undefined) data.isActive = updates.isActive;

  const result = await prisma.orderSet.updateMany({
    where: { tenantId, id },
    data,
  });

  return result.count > 0;
}

/**
 * Delete an order set (soft-delete: set isActive=false). Cannot delete default sets.
 */
export async function deleteOrderSet(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.orderSet.updateMany({
    where: { tenantId, id, isDefault: false },
    data: { isActive: false },
  });

  return result.count > 0;
}

/**
 * Seed default order sets for a tenant.
 */
export async function seedDefaultOrderSets(
  tenantId: string,
  userId: string,
): Promise<number> {
  const existing = await prisma.orderSet.count({ where: { tenantId } });
  if (existing > 0) return 0;

  const docs = DEFAULT_ORDER_SETS.map((set) => ({
    tenantId,
    name: set.name,
    nameAr: set.nameAr,
    category: set.category,
    description: set.description,
    descriptionAr: set.descriptionAr,
    items: set.items as any,
    isActive: set.isActive,
    isDefault: set.isDefault,
    createdByUserId: userId,
  }));

  if (docs.length > 0) {
    await prisma.orderSet.createMany({ data: docs });
  }

  return docs.length;
}

// ---------------------------------------------------------------------------
// Execution — Create All Orders from a Set
// ---------------------------------------------------------------------------

/**
 * Execute an order set: create all orders in the orders_hub table.
 */
export async function executeOrderSet(
  tenantId: string,
  userId: string,
  params: {
    orderSetId: string;
    patientId: string;
    encounterId: string;
  },
): Promise<OrderSetExecutionResult> {
  const orderSet = await getOrderSet(tenantId, params.orderSetId);

  if (!orderSet || !orderSet.isActive) {
    return {
      orderSetId: params.orderSetId,
      orderSetName: 'Unknown',
      createdOrders: [],
      errors: ['Order set not found or inactive'],
    };
  }

  const createdOrders: OrderSetExecutionResult['createdOrders'] = [];
  const errors: string[] = [];
  const now = new Date();

  for (const item of orderSet.items) {
    try {
      const order = await prisma.ordersHub.create({
        data: {
          tenantId,
          patientMasterId: params.patientId,
          encounterCoreId: params.encounterId,
          kind: item.kind,
          orderCode: item.orderCode,
          orderName: item.orderName,
          status: 'ORDERED',
          priority: item.priority,
          assignedToDept: item.department,
          clinicalText: item.instructions,
          meta: {
            orderSetId: orderSet.id,
            orderSetName: orderSet.name,
          },
          createdByUserId: userId,
          orderedAt: now,
        },
      });

      createdOrders.push({
        id: order.id,
        kind: item.kind,
        orderName: item.orderName,
        status: 'ORDERED',
      });
    } catch (error) {
      errors.push(`Failed to create ${item.orderName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  logger.info('Order set executed', {
    category: 'api',
    tenantId,
    orderSetId: orderSet.id,
    orderCount: createdOrders.length,
    errorCount: errors.length,
  } as Record<string, unknown>);

  return {
    orderSetId: orderSet.id,
    orderSetName: orderSet.name,
    createdOrders,
    errors,
  };
}
