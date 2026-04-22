// =============================================================================
// Care Path Order Watcher
// =============================================================================
// Call this function whenever an order is created, modified, or cancelled
// to update the active care path for that patient.

import { PrismaClient } from '@prisma/client';
import { addTaskToPath } from './carePathEngine';
import { generateDayTimeSlots, type TaskCategory } from './carePath';

interface OrderChange {
  tenantId: string;
  patientMasterId: string;
  orderId: string;
  orderName: string;
  orderNameAr?: string;
  kind: string; // LAB, RADIOLOGY, MEDICATION, PROCEDURE
  changeType: 'NEW' | 'MODIFIED' | 'CANCELLED';
  priority?: string;
  meta?: Record<string, unknown>;
}

export async function onOrderChange(prisma: PrismaClient, change: OrderChange): Promise<void> {
  const today = new Date();
  const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Find active care path for this patient today
  const activePath = await prisma.dailyCarePath.findFirst({
    where: {
      tenantId: change.tenantId,
      patientMasterId: change.patientMasterId,
      date: dateOnly,
      status: 'ACTIVE',
    },
  });

  if (!activePath) return; // No active path, nothing to update

  const alertType = change.changeType === 'NEW' ? 'NEW_ORDER'
    : change.changeType === 'CANCELLED' ? 'CANCELLED_ORDER'
    : 'MODIFIED_ORDER';

  const isStatAlert = change.priority === 'STAT' ? 'STAT_ORDER' : alertType;

  const categoryMap: Record<string, TaskCategory> = {
    LAB: 'LAB',
    RADIOLOGY: 'RADIOLOGY',
    MEDICATION: 'MEDICATION',
    PROCEDURE: 'PROCEDURE',
    CONSULTATION: 'DOCTOR_VISIT',
  };

  const category = categoryMap[change.kind] ?? 'CUSTOM';

  if (change.changeType === 'CANCELLED') {
    // Cancel matching tasks from this order
    await prisma.carePathTask.updateMany({
      where: {
        carePathId: activePath.id,
        sourceOrderId: change.orderId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    // Create alert
    await prisma.carePathAlert.create({
      data: {
        tenantId: change.tenantId,
        carePathId: activePath.id,
        alertType: 'CANCELLED_ORDER',
        severity: 'WARNING',
        title: `Order Cancelled: ${change.orderName}`,
        titleAr: change.orderNameAr ? `تم إلغاء الأمر: ${change.orderNameAr}` : undefined,
        sourceOrderId: change.orderId,
        orderDetails: change.meta as any,
      },
    });

    return;
  }

  // For new or modified orders, generate tasks
  if (change.changeType === 'NEW' || change.changeType === 'MODIFIED') {
    // For medication orders, generate multiple time slots
    if (category === 'MEDICATION' && change.meta) {
      const freq = ((change.meta.frequency as string) ?? 'QD').toUpperCase();
      const timeSlots = generateDayTimeSlots(freq);
      const now = new Date();

      // Filter only future time slots
      const futureSlots = timeSlots.filter(t => {
        const [h] = t.split(':').map(Number);
        return h > now.getHours() || (h === now.getHours() && now.getMinutes() < 30);
      });

      if (futureSlots.length === 0) futureSlots.push(timeSlots[0] ?? '08:00');

      for (const time of futureSlots) {
        const [h, m] = time.split(':').map(Number);
        const scheduledTime = new Date(dateOnly);
        scheduledTime.setHours(h, m || 0, 0, 0);

        await addTaskToPath(prisma, activePath.id, change.tenantId, {
          category,
          scheduledTime,
          isRecurring: true,
          recurrenceRule: freq,
          title: `${change.orderName} ${change.meta.dose ?? ''} ${change.meta.route ?? ''}`.trim(),
          titleAr: change.orderNameAr,
          priority: change.priority === 'STAT' ? 'STAT' : change.priority === 'URGENT' ? 'URGENT' : 'ROUTINE',
          sourceType: 'AUTO',
          sourceOrderId: change.orderId,
          taskData: change.meta as Record<string, unknown>,
        }, {
          alertType: isStatAlert,
          title: `New: ${change.orderName}`,
          titleAr: change.orderNameAr ? `جديد: ${change.orderNameAr}` : undefined,
          message: `${change.meta.dose ?? ''} ${change.meta.route ?? ''} ${freq}`.trim(),
          sourceOrderId: change.orderId,
        });
      }
    } else {
      // Non-medication orders: single task
      const scheduledTime = new Date();
      if (scheduledTime.getMinutes() > 30) {
        scheduledTime.setHours(scheduledTime.getHours() + 1, 0, 0, 0);
      } else {
        scheduledTime.setMinutes(30, 0, 0);
      }

      await addTaskToPath(prisma, activePath.id, change.tenantId, {
        category,
        scheduledTime,
        isRecurring: false,
        title: change.orderName,
        titleAr: change.orderNameAr,
        priority: change.priority === 'STAT' ? 'STAT' : change.priority === 'URGENT' ? 'URGENT' : 'ROUTINE',
        sourceType: 'AUTO',
        sourceOrderId: change.orderId,
        taskData: change.meta as Record<string, unknown>,
      }, {
        alertType: isStatAlert,
        title: `New: ${change.orderName}`,
        titleAr: change.orderNameAr ? `جديد: ${change.orderNameAr}` : undefined,
        sourceOrderId: change.orderId,
      });
    }
  }
}
