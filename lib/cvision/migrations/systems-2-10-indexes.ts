/**
 * MongoDB indexes for Systems 2–10
 */
import { getCVisionDb } from '../db';

export async function ensureSystemsIndexes(tenantId: string) {
  const db = await getCVisionDb(tenantId);

  // System 2: Settings
  await db.collection('cvision_tenant_settings').createIndex({ tenantId: 1 }, { unique: true });
  await db.collection('cvision_email_templates').createIndex({ tenantId: 1, key: 1 }, { unique: true });

  // System 4: Workflows
  await db.collection('cvision_workflows').createIndex({ tenantId: 1, triggerType: 1, isActive: 1 });
  await db.collection('cvision_workflow_instances').createIndex({ tenantId: 1, status: 1, currentStep: 1 });
  await db.collection('cvision_workflow_instances').createIndex({ tenantId: 1, resourceType: 1, resourceId: 1 });
  await db.collection('cvision_workflow_instances').createIndex({ tenantId: 1, 'stepHistory.assigneeId': 1, status: 1 });

  // System 5: Notifications
  await db.collection('cvision_notifications').createIndex({ tenantId: 1, recipientId: 1, status: 1, createdAt: -1 });
  await db.collection('cvision_notifications').createIndex({ tenantId: 1, recipientId: 1, readAt: 1 });

  // System 7: Letters
  await db.collection('cvision_letters').createIndex({ tenantId: 1, employeeId: 1, createdAt: -1 });
  await db.collection('cvision_letters').createIndex({ verificationCode: 1 }, { unique: true, sparse: true });
  await db.collection('cvision_letter_templates').createIndex({ tenantId: 1, templateKey: 1 }, { unique: true });

  // System 8: Onboarding
  await db.collection('cvision_onboarding_instances').createIndex({ tenantId: 1, employeeId: 1, type: 1 });
  await db.collection('cvision_onboarding_instances').createIndex({ tenantId: 1, status: 1, 'tasks.status': 1 });

  // System 9: Policies + Calendar
  await db.collection('cvision_calendar_events').createIndex({ tenantId: 1, date: 1 });
  await db.collection('cvision_policies').createIndex({ tenantId: 1, status: 1 });

  // System 10: Training
  await db.collection('cvision_training_courses').createIndex({ tenantId: 1, status: 1, startDate: 1 });
  await db.collection('cvision_training_enrollments').createIndex({ tenantId: 1, courseId: 1 });
  await db.collection('cvision_training_enrollments').createIndex({ tenantId: 1, employeeId: 1, status: 1 });
}
