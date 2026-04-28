// ─────────────────────────────────────────────────────────────────────────────
// Admission Checklist — Programmatic auto-complete helper
// Used by financial APIs to auto-mark checklist items when conditions are met
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/db/prisma';

// Prisma delegate for the AdmissionChecklist model (not yet in generated types)
const admissionChecklistModel = (prisma as unknown as {
  admissionChecklist: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{
      id: string;
      items: unknown;
      completionPercentage: number;
      allRequiredComplete: boolean;
    } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
}).admissionChecklist;

export interface ChecklistItemRecord {
  key: string;
  labelEn: string;
  labelAr: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

/**
 * Programmatically mark a checklist item as completed (or uncompleted).
 * Recalculates completionPercentage and allRequiredComplete automatically.
 */
export async function autoCompleteChecklistItem(
  tenantId: string,
  admissionRequestId: string,
  itemKey: string,
  completedBy: string,
  notes?: string,
): Promise<{ success: boolean; completionPercentage: number; allRequiredComplete: boolean }> {
  // 1. Find checklist
  const checklist = await admissionChecklistModel.findFirst({
    where: { tenantId, admissionRequestId },
  });

  if (!checklist) {
    return { success: false, completionPercentage: 0, allRequiredComplete: false };
  }

  // 2. Parse items
  const items: ChecklistItemRecord[] = Array.isArray(checklist.items)
    ? checklist.items
    : [];

  // 3. Find and update the target item
  let found = false;
  for (const item of items) {
    if (item.key === itemKey) {
      item.completed = true;
      item.completedBy = completedBy;
      item.completedAt = new Date().toISOString();
      if (notes) item.notes = notes;
      found = true;
      break;
    }
  }

  if (!found) {
    return {
      success: false,
      completionPercentage: checklist.completionPercentage || 0,
      allRequiredComplete: checklist.allRequiredComplete || false,
    };
  }

  // 4. Recalculate metrics
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.completed).length;
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const requiredItems = items.filter((i) => i.required);
  const allRequiredComplete = requiredItems.length > 0
    ? requiredItems.every((i) => i.completed)
    : true;

  // 5. Save
  await admissionChecklistModel.update({
    where: { id: checklist.id },
    data: {
      items,
      completionPercentage,
      allRequiredComplete,
    },
  });

  return { success: true, completionPercentage, allRequiredComplete };
}

/**
 * Auto-complete multiple checklist items at once (e.g., for GOVERNMENT patients).
 */
export async function autoCompleteMultipleChecklistItems(
  tenantId: string,
  admissionRequestId: string,
  itemKeys: string[],
  completedBy: string,
  notes?: string,
): Promise<{ success: boolean; completionPercentage: number; allRequiredComplete: boolean }> {
  // 1. Find checklist
  const checklist = await admissionChecklistModel.findFirst({
    where: { tenantId, admissionRequestId },
  });

  if (!checklist) {
    return { success: false, completionPercentage: 0, allRequiredComplete: false };
  }

  // 2. Parse items
  const items: ChecklistItemRecord[] = Array.isArray(checklist.items)
    ? checklist.items
    : [];

  // 3. Update all matching items
  const now = new Date().toISOString();
  for (const item of items) {
    if (itemKeys.includes(item.key) && !item.completed) {
      item.completed = true;
      item.completedBy = completedBy;
      item.completedAt = now;
      if (notes) item.notes = notes;
    }
  }

  // 4. Recalculate metrics
  const totalItems = items.length;
  const completedItems = items.filter((i) => i.completed).length;
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const requiredItems = items.filter((i) => i.required);
  const allRequiredComplete = requiredItems.length > 0
    ? requiredItems.every((i) => i.completed)
    : true;

  // 5. Save
  await admissionChecklistModel.update({
    where: { id: checklist.id },
    data: {
      items,
      completionPercentage,
      allRequiredComplete,
    },
  });

  return { success: true, completionPercentage, allRequiredComplete };
}
