import { logger } from '@/lib/monitoring/logger';
import { getCVisionDb } from '@/lib/cvision/db';
import { checkRateLimit } from '@/lib/cvision/middleware/rate-limiter';
import type { SMSResult } from '../sender';
import { v4 as uuid } from 'uuid';

const SMS_RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 };

export async function sendViaMock(tenantId: string, to: string, message: string): Promise<SMSResult> {
  const rl = checkRateLimit(`sms:${tenantId}`, SMS_RATE_LIMIT);
  if (!rl.allowed) {
    logger.warn(`[SMS] Rate limit exceeded for tenant ${tenantId}. Retry after ${rl.retryAfter}s.`);
    return { success: false, error: 'Rate limit exceeded — too many SMS per minute' };
  }

  const db = await getCVisionDb(tenantId);
  const messageId = `mock-sms-${uuid()}`;
  await db.collection('cvision_sms_mock_inbox').insertOne({ tenantId, messageId, to, message, sentAt: new Date() });
  logger.info(`[SMS Mock] → ${to.slice(0, 4)}****: [message redacted, ${message.length} chars]`);
  return { success: true, messageId };
}
