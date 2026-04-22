import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle — Training Completed
 *
 * Orchestrates post-training-completion integrations:
 * updates skills matrix, training hours, and dispatches events.
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { initializeLifecycle } from './init';
import { dispatchEvent, createEvent } from '@/lib/cvision/events';

export async function onTrainingCompleted(
  db: Db,
  tenantId: string,
  employeeId: string,
  courseId: string,
  score: number,
): Promise<void> {
  initializeLifecycle();

  logger.info(`[Lifecycle] onTrainingCompleted: employee=${employeeId}, course=${courseId}, score=${score}`);

  // 1. Get course details for skills mapping
  let course: any = null;
  try {
    course = await db.collection('cvision_training_courses').findOne({
      tenantId,
      courseId,
    });
  } catch (err) {
    logger.error(`[Lifecycle] Failed to fetch course ${courseId}:`, err);
  }

  // 2. Update skills matrix with course category/skills
  try {
    if (course?.category) {
      const skillName = course.category.replace(/_/g, ' ').toLowerCase();
      const proficiencyLevel = score >= 90 ? 'EXPERT' : score >= 70 ? 'ADVANCED' : score >= 50 ? 'INTERMEDIATE' : 'BEGINNER';

      await db.collection('cvision_skills_matrix').updateOne(
        { tenantId, employeeId, skillName },
        {
          $set: {
            tenantId,
            employeeId,
            skillName,
            proficiencyLevel,
            lastAssessedAt: new Date(),
            source: 'TRAINING',
            sourceId: courseId,
            score,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      logger.info(`[Lifecycle] Skills matrix updated: ${employeeId} → ${skillName} (${proficiencyLevel})`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to update skills matrix for ${employeeId}:`, err);
  }

  // 3. Update employee training hours
  try {
    const duration = course?.duration || 0;
    if (duration > 0) {
      await db.collection('cvision_employees').updateOne(
        { tenantId, $or: [{ id: employeeId }, { employeeId }] },
        {
          $inc: { totalTrainingHours: duration },
          $set: { lastTrainingCompletedAt: new Date(), updatedAt: new Date() },
        },
      );
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to update training hours for ${employeeId}:`, err);
  }

  // 4. Dispatch event (triggers notifications + webhooks)
  try {
    await dispatchEvent(createEvent(
      tenantId,
      'training.completed',
      'training',
      courseId,
      {
        employeeId,
        courseId,
        courseName: course?.title || courseId,
        score,
        category: course?.category,
      },
      employeeId,
    ));
  } catch (err) {
    logger.error(`[Lifecycle] Failed to dispatch training.completed event:`, err);
  }
}
