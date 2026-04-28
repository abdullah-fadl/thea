/**
 * MongoDB indexes for Systems 11–20
 */
import { getCVisionDb } from '../db';

export async function ensureSystems11to20Indexes(tenantId: string) {
  const db = await getCVisionDb(tenantId);

  // System 11: OKRs & KPIs
  await db.collection('cvision_okrs').createIndex({ tenantId: 1, ownerId: 1, period: 1 });
  await db.collection('cvision_okrs').createIndex({ tenantId: 1, level: 1 });
  await db.collection('cvision_kpis').createIndex({ tenantId: 1, ownerId: 1 });
  await db.collection('cvision_review_cycles').createIndex({ tenantId: 1, status: 1 });

  // System 12: Compensation
  await db.collection('cvision_salary_structure').createIndex({ tenantId: 1 }, { unique: true });
  await db.collection('cvision_employee_compensation').createIndex({ tenantId: 1, employeeId: 1 }, { unique: true });

  // System 13: Rewards
  await db.collection('cvision_recognitions').createIndex({ tenantId: 1, nomineeId: 1, status: 1 });
  await db.collection('cvision_recognitions').createIndex({ tenantId: 1, createdAt: -1 });
  await db.collection('cvision_reward_programs').createIndex({ tenantId: 1, isActive: 1 });
  await db.collection('cvision_reward_points').createIndex({ tenantId: 1, employeeId: 1 }, { unique: true });

  // System 14: Succession
  await db.collection('cvision_succession_plans').createIndex({ tenantId: 1, criticality: 1, status: 1 });

  // System 15: Surveys
  await db.collection('cvision_surveys').createIndex({ tenantId: 1, status: 1 });
  await db.collection('cvision_survey_responses').createIndex({ tenantId: 1, surveyId: 1 });
  await db.collection('cvision_survey_responses').createIndex({ tenantId: 1, respondentId: 1 });

  // System 16: Travel
  await db.collection('cvision_travel_requests').createIndex({ tenantId: 1, employeeId: 1, createdAt: -1 });
  await db.collection('cvision_travel_requests').createIndex({ tenantId: 1, status: 1 });
  await db.collection('cvision_expenses').createIndex({ tenantId: 1, travelId: 1 });

  // System 17: Grievances
  await db.collection('cvision_grievances').createIndex({ tenantId: 1, status: 1, createdAt: -1 });
  await db.collection('cvision_grievances').createIndex({ tenantId: 1, submittedBy: 1 });

  // System 18: Assets
  await db.collection('cvision_assets').createIndex({ tenantId: 1, status: 1, category: 1 });
  await db.collection('cvision_asset_assignments').createIndex({ tenantId: 1, employeeId: 1, returnedAt: 1 });
  await db.collection('cvision_asset_assignments').createIndex({ tenantId: 1, assetId: 1 });

  // System 19: Compliance & Safety
  await db.collection('cvision_compliance_calendar').createIndex({ tenantId: 1, dueDate: 1 });
  await db.collection('cvision_compliance_calendar').createIndex({ tenantId: 1, status: 1 });
  await db.collection('cvision_safety_incidents').createIndex({ tenantId: 1, date: -1 });
  await db.collection('cvision_safety_inspections').createIndex({ tenantId: 1, scheduledDate: -1 });

  // System 20: Teams & Announcements
  await db.collection('cvision_announcements').createIndex({ tenantId: 1, publishedAt: -1, isPinned: -1 });
  await db.collection('cvision_teams').createIndex({ tenantId: 1, status: 1 });
}
