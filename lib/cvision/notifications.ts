import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Notification System
 * Handles notifications for recruitment events
 */

import { getCVisionCollection } from './db';
import { v4 as uuidv4 } from 'uuid';

export type CVisionNotificationType =
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_NEGOTIATING'
  | 'OFFER_HR_APPROVED'
  | 'OFFER_HR_REJECTED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'CANDIDATE_APPLIED'
  | 'CANDIDATE_HIRED';

export interface CVisionNotification {
  id: string;
  tenantId: string;
  type: CVisionNotificationType;

  // Content
  title: string;
  message: string;

  // Recipient - HR users who should see this
  recipientUserIds: string[]; // Specific users
  recipientRoles: string[]; // Or roles like 'hr_manager', 'recruiter'

  // Reference to candidate/job
  candidateId: string;
  candidateName: string;
  jobTitleId?: string;
  jobTitleName?: string;

  // Priority
  priority: 'low' | 'medium' | 'high';

  // Action URL
  actionUrl?: string;

  // Read tracking per user
  readBy: { userId: string; readAt: Date }[];

  // Metadata
  meta?: Record<string, any>;

  createdAt: Date;
  createdBy?: string;
}

// Notification templates
const NOTIFICATION_TEMPLATES: Record<CVisionNotificationType, {
  title: string;
  message: (data: any) => string;
  priority: 'low' | 'medium' | 'high';
}> = {
  OFFER_SENT: {
    title: 'Offer Sent',
    message: (d) => `Job offer sent to ${d.candidateName} for ${d.jobTitleName} position`,
    priority: 'medium',
  },
  OFFER_ACCEPTED: {
    title: 'Offer Accepted!',
    message: (d) => `${d.candidateName} accepted the job offer for ${d.jobTitleName}. Pending HR approval.`,
    priority: 'high',
  },
  OFFER_REJECTED: {
    title: 'Offer Rejected',
    message: (d) => `${d.candidateName} rejected the job offer for ${d.jobTitleName}`,
    priority: 'high',
  },
  OFFER_NEGOTIATING: {
    title: 'Offer Under Negotiation',
    message: (d) => `${d.candidateName} wants to negotiate the offer for ${d.jobTitleName}`,
    priority: 'high',
  },
  OFFER_HR_APPROVED: {
    title: 'Offer Approved',
    message: (d) => `HR approved the offer for ${d.candidateName}. Ready to complete hiring.`,
    priority: 'medium',
  },
  OFFER_HR_REJECTED: {
    title: 'Offer Approval Rejected',
    message: (d) => `HR rejected the offer approval for ${d.candidateName}`,
    priority: 'high',
  },
  INTERVIEW_SCHEDULED: {
    title: 'Interview Scheduled',
    message: (d) => `Interview scheduled with ${d.candidateName} on ${d.scheduledDate}`,
    priority: 'medium',
  },
  INTERVIEW_COMPLETED: {
    title: 'Interview Completed',
    message: (d) => `Interview with ${d.candidateName} completed. Decision: ${d.decision}`,
    priority: 'medium',
  },
  CANDIDATE_APPLIED: {
    title: 'New Application',
    message: (d) => `${d.candidateName} applied for ${d.jobTitleName}`,
    priority: 'low',
  },
  CANDIDATE_HIRED: {
    title: 'Candidate Hired!',
    message: (d) => `${d.candidateName} has been successfully hired as ${d.jobTitleName}`,
    priority: 'high',
  },
};

/**
 * Create a CVision notification
 */
export async function createCVisionNotification(
  tenantId: string,
  type: CVisionNotificationType,
  data: {
    candidateId: string;
    candidateName: string;
    jobTitleId?: string;
    jobTitleName?: string;
    recipientUserIds?: string[];
    recipientRoles?: string[];
    meta?: Record<string, any>;
    createdBy?: string;
  }
): Promise<CVisionNotification | null> {
  try {
    const template = NOTIFICATION_TEMPLATES[type];

    const notification: CVisionNotification = {
      id: uuidv4(),
      tenantId,
      type,
      title: template.title,
      message: template.message(data),
      recipientUserIds: data.recipientUserIds || [],
      recipientRoles: data.recipientRoles || ['hr_manager', 'recruiter', 'admin'],
      candidateId: data.candidateId,
      candidateName: data.candidateName,
      jobTitleId: data.jobTitleId,
      jobTitleName: data.jobTitleName || 'Unknown Position',
      priority: template.priority,
      actionUrl: `/cvision/recruitment?candidateId=${data.candidateId}`,
      readBy: [],
      meta: data.meta,
      createdAt: new Date(),
      createdBy: data.createdBy,
    };

    const collection = await getCVisionCollection(tenantId, 'notifications');
    await collection.insertOne(notification as any);

    return notification;
  } catch (error) {
    logger.error('[createCVisionNotification Error]', error);
    return null;
  }
}

/**
 * Get notifications for a user
 */
export async function getCVisionNotifications(
  tenantId: string,
  userId: string,
  userRoles: string[],
  options: {
    unreadOnly?: boolean;
    limit?: number;
    skip?: number;
  } = {}
): Promise<{ notifications: CVisionNotification[]; unreadCount: number; total: number }> {
  const { unreadOnly = false, limit = 50, skip = 0 } = options;

  const collection = await getCVisionCollection(tenantId, 'notifications');

  // Build query - user sees notifications if they're in recipientUserIds OR their role is in recipientRoles
  const baseQuery: any = {
    tenantId,
    $or: [
      { recipientUserIds: userId },
      { recipientRoles: { $in: userRoles } },
    ],
  };

  if (unreadOnly) {
    baseQuery['readBy.userId'] = { $ne: userId };
  }

  const notifications = await collection
    .find(baseQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .toArray() as unknown as CVisionNotification[];

  const total = await collection.countDocuments(baseQuery);

  // Count unread
  const unreadQuery = {
    ...baseQuery,
    'readBy.userId': { $ne: userId },
  };
  const unreadCount = await collection.countDocuments(unreadQuery);

  return { notifications, unreadCount, total };
}

/**
 * Mark notification as read
 */
export async function markCVisionNotificationRead(
  tenantId: string,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const collection = await getCVisionCollection(tenantId, 'notifications');

  const result = await collection.updateOne(
    { tenantId, id: notificationId },
    {
      $addToSet: {
        readBy: { userId, readAt: new Date() },
      } as Record<string, unknown>,
    }
  );

  return result.modifiedCount > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllCVisionNotificationsRead(
  tenantId: string,
  userId: string,
  userRoles: string[]
): Promise<number> {
  const collection = await getCVisionCollection(tenantId, 'notifications');

  const result = await collection.updateMany(
    {
      tenantId,
      $or: [
        { recipientUserIds: userId },
        { recipientRoles: { $in: userRoles } },
      ],
      'readBy.userId': { $ne: userId },
    },
    {
      $addToSet: {
        readBy: { userId, readAt: new Date() },
      } as Record<string, unknown>,
    }
  );

  return result.modifiedCount;
}
