/**
 * MongoDB indexes for Systems 21–26 (OD modules)
 */
import { getCVisionDb } from '../db';

export async function ensureSystems21to26Indexes(tenantId: string) {
  const db = await getCVisionDb(tenantId);

  // System 21: Org Health
  await db.collection('cvision_org_health_assessments').createIndex({ tenantId: 1, period: 1 }, { unique: true });
  await db.collection('cvision_org_health_assessments').createIndex({ tenantId: 1, status: 1, assessmentDate: -1 });

  // System 22: Change Management
  await db.collection('cvision_change_initiatives').createIndex({ tenantId: 1, status: 1 });
  await db.collection('cvision_change_initiatives').createIndex({ tenantId: 1, 'impactedGroups.groupId': 1 });

  // System 23: Org Design
  await db.collection('cvision_org_designs').createIndex({ tenantId: 1, status: 1 });

  // System 24: Culture
  await db.collection('cvision_culture_assessments').createIndex({ tenantId: 1, period: 1 });

  // System 25: Process Effectiveness
  await db.collection('cvision_process_analysis').createIndex({ tenantId: 1, period: 1 });
  await db.collection('cvision_process_slas').createIndex({ tenantId: 1, processType: 1 }, { unique: true });
  await db.collection('cvision_process_improvements').createIndex({ tenantId: 1, status: 1 });

  // System 26: Strategic Alignment
  await db.collection('cvision_strategic_alignment').createIndex({ tenantId: 1, period: 1 });
}
