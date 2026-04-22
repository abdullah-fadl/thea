/**
 * Node-cron scheduler for Patient Experience SLA Runner
 * 
 * This file is for long-running Node.js servers (not Vercel).
 * 
 * Usage:
 * 1. Install node-cron: npm install node-cron @types/node-cron
 * 2. Import this file in your server entry point (e.g., server.ts or app entry)
 * 3. Only run in production or when explicitly enabled
 * 
 * For Vercel deployments, use vercel.json cron configuration instead.
 */

import { runPxSla } from './runSla';
import { env } from '../env';
import { logger } from '@/lib/monitoring/logger';

let cronJob: any = null;

/**
 * Start the SLA scheduler (runs every 15 minutes)
 * 
 * @param enabled - Whether to enable the scheduler (default: only in production)
 */
export function startPxSlaScheduler(enabled: boolean = env.isProd) {
  // Only run if enabled and not already running
  if (!enabled || cronJob) {
    return;
  }

  // Dynamic import to avoid bundling node-cron in client
  // @ts-ignore - node-cron types may not be available
  import('node-cron')
    .then((cron) => {
      // Run every 15 minutes: */15 * * * *
      cronJob = cron.default.schedule('*/15 * * * *', async () => {
        try {
          logger.info('Running scheduled SLA check', { category: 'system' });
          const result = await runPxSla();
          logger.info('SLA check completed', { category: 'system', scanned: result.scanned, escalated: result.escalated, skipped: result.skipped });
        } catch (error: any) {
          logger.error('SLA Scheduler error', { category: 'system', error });
        }
      }, {
        scheduled: true,
        timezone: 'UTC',
      });

      logger.info('SLA Scheduler started - running every 15 minutes', { category: 'system' });
    })
    .catch((error) => {
      logger.error('SLA Scheduler failed to start - node-cron not installed', { category: 'system', error });
      logger.warn('Install with: npm install node-cron @types/node-cron', { category: 'system' });
    });
}

/**
 * Stop the SLA scheduler
 */
export function stopPxSlaScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    logger.info('SLA Scheduler stopped', { category: 'system' });
  }
}
