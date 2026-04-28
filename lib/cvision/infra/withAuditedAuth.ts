/**
 * CVision Audited Auth Wrapper
 *
 * Wraps withAuthTenant to automatically log audit events for all mutation
 * requests (POST, PUT, PATCH, DELETE). This ensures comprehensive audit
 * coverage without modifying every individual route handler.
 *
 * Usage:
 *   import { withAuditedAuth } from '@/lib/cvision/infra';
 *   export const POST = withAuditedAuth(handler, { resourceType: 'EMPLOYEE' });
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthTenant,
  type AuthTenantHandler,
} from '@/lib/core/guards/withAuthTenant';
import { logCVisionAudit, type CVisionAuditContext } from '../audit';
import { logger } from '@/lib/monitoring/logger';

export interface AuditedAuthOptions {
  /** The resource type for audit logs (e.g., 'EMPLOYEE', 'DEPARTMENT') */
  resourceType: string;
  /** Override the action name (defaults to auto-detection from HTTP method + URL) */
  action?: string;
  /** Extract a resource ID from the response body. Default: looks for data.id or id */
  extractResourceId?: (responseBody: any) => string | undefined;
}

/**
 * Infer audit action from HTTP method and URL path
 */
function inferAction(method: string, url: string): string {
  const path = new URL(url).pathname;
  const segments = path.split('/').filter(Boolean);
  // Find the last meaningful segment (skip IDs)
  const lastSegment = segments[segments.length - 1];
  const isIdSegment = /^[0-9a-f-]{20,}$/.test(lastSegment || '');

  switch (method) {
    case 'POST': {
      // Check for action-like segments: /approve, /escalate, /close, /assign, etc.
      if (!isIdSegment && lastSegment) {
        return lastSegment.toUpperCase().replace(/-/g, '_');
      }
      return 'CREATE';
    }
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return method.toUpperCase();
  }
}

/**
 * Default resource ID extractor — looks for common patterns in response body
 */
function defaultExtractResourceId(body: any): string | undefined {
  if (!body) return undefined;
  if (body.data?.id) return body.data.id;
  if (body.id) return body.id;
  if (body.data?.jobId) return body.data.jobId;
  return undefined;
}

/**
 * Wrap a route handler with automatic audit logging for mutations.
 * GET requests pass through without audit logging.
 */
export function withAuditedAuth(
  handler: AuthTenantHandler,
  options: AuditedAuthOptions,
) {
  return withAuthTenant(async (request: NextRequest, context: any) => {
    const method = request.method;

    // GET requests don't need audit logging
    if (method === 'GET') {
      return handler(request, context);
    }

    const { tenantId, userId, user } = context;
    const action = options.action || inferAction(method, request.url);

    // Execute the actual handler
    const response = await handler(request, context);

    // Only audit successful mutations (2xx status)
    if (response.status >= 200 && response.status < 300) {
      try {
        // Clone response to read body without consuming it
        const cloned = response.clone();
        let responseBody: any = {};
        try {
          responseBody = await cloned.json();
        } catch {
          // Response may not be JSON
        }

        const resourceId =
          (options.extractResourceId || defaultExtractResourceId)(responseBody) ||
          'unknown';

        const auditCtx: CVisionAuditContext = {
          tenantId,
          actorUserId: userId,
          actorRole: user?.role || 'unknown',
          actorEmail: user?.email,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        };

        await logCVisionAudit(
          auditCtx,
          action as any,
          options.resourceType as any,
          { resourceId },
        );
      } catch (auditError) {
        // Audit should never break the response
        logger.error('[CVision AutoAudit] Failed:', auditError);
      }
    }

    return response;
  });
}
