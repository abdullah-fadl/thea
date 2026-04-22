/**
 * Redis Client — for distributed rate limiting and caching
 *
 * Falls back gracefully to in-memory when Redis is unavailable.
 * Set REDIS_URL in environment to enable.
 */

import Redis from 'ioredis';
import { logger } from '@/lib/monitoring/logger';

let redisClient: Redis | null = null;
let connectionFailed = false;

export function getRedis(): Redis | null {
  if (connectionFailed) return null;
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    // No REDIS_URL configured — fall back to in-memory
    return null;
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 3) {
          connectionFailed = true;
          logger.warn('Redis: Max retries exceeded, falling back to in-memory rate limiting', { category: 'system' });
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { category: 'system', error: err });
    });

    redisClient.on('close', () => {
      redisClient = null;
    });

    return redisClient;
  } catch {
    logger.error('Failed to create Redis client — falling back to in-memory', { category: 'system' });
    connectionFailed = true;
    return null;
  }
}
