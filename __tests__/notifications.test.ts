/**
 * Notifications Module Tests
 *
 * Covers:
 *  - Notification emission (emit.ts): deduplication, role broadcast, scopes
 *  - SMS service (smsService.ts): phone normalization, OTP bilingual, dev mode
 *  - Notification routes: list filter, mark-all-read, ack idempotency, dismiss, inbox counts
 *  - Admin emit route: role check, recipient validation
 *  - ER notifications: types, deduplication via title prefix, read-all
 *  - SSE stream: ReadableStream, OPD event types
 *  - Route wiring: withAuthTenant, Prisma indexes
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Notification Emission (emit.ts)
// ---------------------------------------------------------------------------
describe('Notification Emission', () => {
  const emitSrc = readRoute('lib', 'notifications', 'emit.ts');

  it('1 — emitNotification deduplicates via dedupeKey', () => {
    // The function queries for an existing notification with the same dedupeKey
    // and returns { noOp: true } when a duplicate is found.
    expect(emitSrc).toContain('dedupeKey');
    expect(emitSrc).toContain('findFirst');
    expect(emitSrc).toMatch(/if\s*\(\s*existing\s*\)/);
    expect(emitSrc).toContain('noOp: true');
  });

  it('2 — emitNotificationToRole broadcasts to all users matching role', () => {
    // The function fetches all users with a matching role via prisma.user.findMany,
    // then calls emitNotification for each user with a per-user dedupeKey suffix.
    expect(emitSrc).toContain('emitNotificationToRole');
    expect(emitSrc).toContain('prisma.user.findMany');
    expect(emitSrc).toMatch(/role:\s*\{/);
    // Each user gets a dedupe key with their userId appended
    expect(emitSrc).toContain('`${dedupeKey}:${userId}`');
  });

  it('3 — notification scopes include ER, IPD, OPD, ORDERS, RESULTS, BILLING, SYSTEM', () => {
    const expectedScopes = ['ER', 'IPD', 'OPD', 'ORDERS', 'RESULTS', 'BILLING', 'SYSTEM'];
    // The NotificationScope type union should contain all expected scopes
    for (const scope of expectedScopes) {
      expect(emitSrc).toContain(`'${scope}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. SMS Service (smsService.ts)
// ---------------------------------------------------------------------------
describe('SMS Service', () => {
  const smsSrc = readRoute('lib', 'notifications', 'smsService.ts');

  it('4 — normalizeNumber converts Saudi phone formats (00966, 966, 0) to +966', () => {
    // The normalizeNumber function strips digits-only then strips prefixes:
    // 00966 -> slice(5), 966 -> slice(3), 0 -> slice(1), prepend +966
    expect(smsSrc).toContain("n.startsWith('00966')");
    expect(smsSrc).toContain("n.startsWith('966')");
    expect(smsSrc).toContain("n.startsWith('0')");
    expect(smsSrc).toContain("'+966'");
  });

  it('5 — sendOTP message is bilingual (Arabic + English)', () => {
    // OTP template must contain both Arabic and English text
    expect(smsSrc).toMatch(/رمز التحقق/); // Arabic "verification code"
    expect(smsSrc).toContain('Your Thea Health OTP');
    expect(smsSrc).toContain('Valid for 5 minutes');
    // Also ensure the otp variable is interpolated into the message
    expect(smsSrc).toMatch(/\$\{otp\}/);
  });

  it('6 — dev mode logs instead of sending when Twilio not configured', () => {
    // When accountSid/authToken/fromNumber are missing, sendSMS logs and
    // returns success with messageId "dev-mode" without calling Twilio.
    expect(smsSrc).toContain("'dev-mode'");
    expect(smsSrc).toContain('SMS dev mode');
    // Ensure it still returns success: true
    expect(smsSrc).toMatch(/success:\s*true.*messageId:\s*'dev-mode'/s);
  });
});

// ---------------------------------------------------------------------------
// 3. Notification Routes
// ---------------------------------------------------------------------------
describe('Notification Routes', () => {
  const listRouteSrc = readRoute('app', 'api', 'notifications', 'route.ts');

  it('7 — list route filters by unread status via query param', () => {
    // GET /api/notifications accepts ?unread=1 or ?unread=0
    expect(listRouteSrc).toContain("searchParams.get('unread')");
    // unread=1 filters for readAt === null
    expect(listRouteSrc).toContain('readAt');
    expect(listRouteSrc).toMatch(/unread\s*===\s*'1'/);
    expect(listRouteSrc).toMatch(/unread\s*===\s*'0'/);
  });

  it('8 — mark-all-read updates all unread notifications for current user', () => {
    const markAllSrc = readRoute('app', 'api', 'notifications', 'mark-all-read', 'route.ts');
    // Uses prisma.notification.updateMany with readAt: null filter
    expect(markAllSrc).toContain('updateMany');
    expect(markAllSrc).toContain('readAt: null');
    // Only targets the current user's notifications (by recipientUserId)
    expect(markAllSrc).toContain('recipientUserId: userId');
    // Returns the count of updated notifications
    expect(markAllSrc).toContain('result.count');
  });

  it('9 — ack route is idempotent: returns noOp if already READ', () => {
    const ackSrc = readRoute('app', 'api', 'notifications', '[id]', 'ack', 'route.ts');
    // When notification.status is already READ, it returns noOp: true
    expect(ackSrc).toMatch(/status\s*===\s*'READ'/);
    expect(ackSrc).toContain('noOp: true');
    // Otherwise, it updates status to READ
    expect(ackSrc).toContain("status: 'READ'");
    expect(ackSrc).toContain('readAt: now');
  });

  it('10 — dismiss route sets status to CLOSED', () => {
    const dismissSrc = readRoute('app', 'api', 'notifications', '[id]', 'dismiss', 'route.ts');
    // Updates the notification status to CLOSED
    expect(dismissSrc).toContain("status: 'CLOSED'");
    // Also idempotent: returns noOp if already CLOSED
    expect(dismissSrc).toMatch(/status\s*===\s*'CLOSED'/);
    expect(dismissSrc).toContain('noOp: true');
    // Creates an audit log with action DISMISS
    expect(dismissSrc).toContain("'DISMISS'");
  });

  it('11 — inbox route shows counts by severity, scope, and status', () => {
    const inboxSrc = readRoute('app', 'api', 'notifications', 'inbox', 'route.ts');
    // Uses prisma groupBy to get counts by severity, scope, and status
    expect(inboxSrc).toContain('groupBy');
    expect(inboxSrc).toContain("by: ['severity']");
    expect(inboxSrc).toContain("by: ['scope']");
    expect(inboxSrc).toContain("by: ['status']");
    // Returns a counts object with severity, scope, and status sub-objects
    expect(inboxSrc).toContain('counts.severity');
    expect(inboxSrc).toContain('counts.scope');
    expect(inboxSrc).toContain('counts.status');
    // Also returns openCount
    expect(inboxSrc).toContain('openCount');
  });
});

// ---------------------------------------------------------------------------
// 4. Admin Emit Route
// ---------------------------------------------------------------------------
describe('Admin Emit — Lib', () => {
  const emitLibSrc = readRoute('lib', 'notifications', 'emit.ts');

  it('12 — emitNotification function supports recipientUserId', () => {
    expect(emitLibSrc).toContain('emitNotification');
    expect(emitLibSrc).toContain('recipientUserId');
  });

  it('13 — emitNotificationToRole broadcasts to role-matched users', () => {
    expect(emitLibSrc).toContain('emitNotificationToRole');
    expect(emitLibSrc).toContain('prisma.user.findMany');
  });
});

// ---------------------------------------------------------------------------
// 5. ER Notifications
// ---------------------------------------------------------------------------
describe('ER Notifications', () => {
  const erNotifLib = readRoute('lib', 'er', 'notifications.ts');

  it('14 — ER notification types include ESCALATION_OPEN, CRITICAL_VITALS, OVERDUE_TASKS', () => {
    const expectedTypes = [
      'ESCALATION_OPEN',
      'TRANSFER_REQUEST_OPEN',
      'CRITICAL_VITALS',
      'OVERDUE_VITALS',
      'OVERDUE_TASKS',
    ];
    for (const t of expectedTypes) {
      expect(erNotifLib).toContain(`'${t}'`);
    }
    // severityForType maps CRITICAL_VITALS -> CRITICAL
    expect(erNotifLib).toMatch(/CRITICAL_VITALS.*CRITICAL/s);
    // ESCALATION_OPEN maps to WARN
    expect(erNotifLib).toMatch(/ESCALATION_OPEN.*WARN/s);
  });

  it('15 — ER notifications deduplication via title prefix SYSTEM:<dedupeKey>', () => {
    // createErNotificationIfMissing uses "SYSTEM:" prefix in title for deduplication
    expect(erNotifLib).toContain('`SYSTEM:${args.dedupeKey}`');
    // Checks for existing by matching (encounterId, title)
    expect(erNotifLib).toContain('findFirst');
    expect(erNotifLib).toContain('encounterId: args.encounterId');
    expect(erNotifLib).toContain('title,');
    // Returns { created: false } when already exists
    expect(erNotifLib).toContain('created: false');
  });

  it('16 — ER read-all marks all unread notifications as read using updateMany', () => {
    const erReadAllSrc = readRoute('app', 'api', 'er', 'notifications', 'read-all', 'route.ts');
    // Uses updateMany to mark all unread (readAt: null) as read
    expect(erReadAllSrc).toContain('updateMany');
    expect(erReadAllSrc).toContain('readAt: null');
    expect(erReadAllSrc).toContain('readByUserId: userId');
    // Returns updated count
    expect(erReadAllSrc).toContain('result.count');
  });
});

// ---------------------------------------------------------------------------
// 6. SSE Stream
// ---------------------------------------------------------------------------
describe('SSE Stream', () => {
  const streamSrc = readRoute('app', 'api', 'opd', 'events', 'stream', 'route.ts');
  const eventBusSrc = readRoute('lib', 'opd', 'eventBus.ts');

  it('17 — SSE stream route uses createSSEStream with text/event-stream content type', () => {
    // Route now delegates to lib/realtime/sseManager
    expect(streamSrc).toContain('createSSEStream');
    expect(streamSrc).toContain("'text/event-stream'");
    expect(streamSrc).toContain('no-cache');
    // Subscribes to OPD-specific event types
    expect(streamSrc).toContain('FLOW_STATE_CHANGE');
    expect(streamSrc).toContain('NEW_PATIENT');
    expect(streamSrc).toContain('VITALS_SAVED');
  });

  it('18 — OPD event types include FLOW_STATE_CHANGE, NEW_PATIENT, VITALS_SAVED', () => {
    // OpdEvent interface defines the type union
    expect(eventBusSrc).toContain("'FLOW_STATE_CHANGE'");
    expect(eventBusSrc).toContain("'NEW_PATIENT'");
    expect(eventBusSrc).toContain("'VITALS_SAVED'");
    // Event shape includes encounterCoreId, tenantId, data, timestamp
    expect(eventBusSrc).toContain('encounterCoreId: string');
    expect(eventBusSrc).toContain('tenantId: string');
    expect(eventBusSrc).toContain('data: Record<string, any>');
    expect(eventBusSrc).toContain('timestamp: string');
  });
});

// ---------------------------------------------------------------------------
// 7. Route Wiring
// ---------------------------------------------------------------------------
describe('Route Wiring', () => {
  it('19 — all notification routes use withAuthTenant', () => {
    const routes = [
      readRoute('app', 'api', 'notifications', 'route.ts'),
      readRoute('app', 'api', 'notifications', 'mark-all-read', 'route.ts'),
      readRoute('app', 'api', 'notifications', '[id]', 'route.ts'),
      readRoute('app', 'api', 'notifications', '[id]', 'ack', 'route.ts'),
      readRoute('app', 'api', 'notifications', '[id]', 'dismiss', 'route.ts'),
      readRoute('app', 'api', 'notifications', 'inbox', 'route.ts'),
      readRoute('app', 'api', 'er', 'notifications', 'route.ts'),
      readRoute('app', 'api', 'er', 'notifications', 'read', 'route.ts'),
      readRoute('app', 'api', 'er', 'notifications', 'read-all', 'route.ts'),
      readRoute('app', 'api', 'opd', 'events', 'stream', 'route.ts'),
    ];

    for (const src of routes) {
      expect(src).toContain('withAuthTenant');
    }
  });

  it('20 — Notification model has proper indexes on tenantId, recipientUserId, dedupeKey, status', () => {
    const schemaSrc = readRoute('prisma', 'schema', 'core.prisma');
    // The Notification model should exist
    expect(schemaSrc).toContain('model Notification');
    // Check essential indexes for query performance
    expect(schemaSrc).toContain('@@index([tenantId])');
    expect(schemaSrc).toContain('@@index([recipientUserId])');
    expect(schemaSrc).toContain('@@index([dedupeKey])');
    expect(schemaSrc).toContain('@@index([status])');
    // Also verify severity and scope indexes (used by inbox groupBy)
    expect(schemaSrc).toContain('@@index([severity])');
    expect(schemaSrc).toContain('@@index([scope])');
    // Maps to "notifications" table
    expect(schemaSrc).toContain('@@map("notifications")');
  });
});
