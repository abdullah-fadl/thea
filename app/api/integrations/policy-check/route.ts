import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { ClinicalEvent } from '@/lib/models/ClinicalEvent';
import { PolicyAlert } from '@/lib/models/PolicyAlert';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { env } from '@/lib/env';
import { isIntegrationEnabled, getSeverityThreshold, meetsSeverityThreshold } from '@/lib/integrations/settings';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const policyCheckSchema = z.object({
  eventId: z.string().optional(),
  type: z.enum(['NOTE', 'ORDER', 'PROCEDURE', 'OTHER']).optional(),
  subject: z.string().optional(),
  payload: z.object({
    text: z.string().optional(),
    content: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).passthrough().optional(),
}).refine(
  (data) => data.eventId || (data.type && data.payload),
  { message: 'Either eventId or (type + payload) must be provided' }
);

/**
 * POST /api/integrations/policy-check
 * Run policy check on a clinical event
 *
 * Requires: User must have BOTH sam=true AND health=true entitlements
 *
 * Body: { eventId } OR { type, subject?, payload }
 * Response: { ok: true, alertId, resultSummary }
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, permissions }) => {
  try {
    // Check entitlements: requires BOTH sam AND health
    // Note: withAuthTenant ensures authentication, but we need to check platform entitlements separately
    const token = req.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyTokenEdge(token);
    if (!payload || !payload.entitlements) {
      return NextResponse.json(
        { error: 'Invalid token or entitlements not found' },
        { status: 401 }
      );
    }

    // Enforce entitlement requirement: BOTH sam AND health
    if (!payload.entitlements.sam || !payload.entitlements.health) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Integration requires access to both SAM and Thea Health platforms'
        },
        { status: 403 }
      );
    }

    // Check if integration is enabled in settings
    const integrationEnabled = await isIntegrationEnabled(
      tenantId,
      payload.entitlements.sam,
      payload.entitlements.health
    );

    if (!integrationEnabled) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Integration is disabled in tenant settings'
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    const validation = policyCheckSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { eventId, type, subject, payload: eventPayload } = validation.data;

    let event: Record<string, unknown> | null = null;
    let eventText = '';

    // Load event if eventId provided, otherwise use direct input with tenant isolation
    if (eventId) {
      event = await prisma.clinicalEvent.findFirst({
        where: { id: eventId, tenantId },
      });

      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      // Extract text from event payload
      const eventPayloadData = event.payload as Record<string, unknown> | null;
      eventText = String(eventPayloadData?.text || eventPayloadData?.content || JSON.stringify(event.payload));
    } else if (type && eventPayload) {
      // Create temporary event structure for processing
      eventText = eventPayload.text || eventPayload.content || JSON.stringify(eventPayload);
    } else {
      return NextResponse.json(
        { error: 'Invalid request: eventId or (type + payload) required' },
        { status: 400 }
      );
    }

    if (!eventText || eventText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Event text/content is required' },
        { status: 400 }
      );
    }

    // Update event status to processing with tenant isolation
    if (event) {
      await prisma.clinicalEvent.updateMany({
        where: { id: event.id, tenantId },
        data: {
          status: 'processing',
          updatedAt: new Date(),
          updatedBy: userId,
        },
      });
    }

    try {
      // Call thea-engine search endpoint
      // Reuse existing integration pattern from SAM
      // Use tenantId from session (not env fallback)
      const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/search`;

      const searchResponse = await fetch(theaEngineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId, // From session (not env)
          query: eventText,
          topK: 10, // Get top 10 relevant policies
        }),
      });

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Policy engine error: ${errorText}`);
      }

      const searchStartTime = Date.now();
      const searchData = await searchResponse.json();
      const results = searchData.results || [];
      const searchEndTime = Date.now();

      // Get severity threshold from settings
      const severityThreshold = await getSeverityThreshold(tenantId);

      // Process results and create policy alerts
      const alertIds: string[] = [];
      const now = new Date();
      const processingTimeMs = searchEndTime - searchStartTime;

      // Collect all policy IDs for traceability
      const matchedPolicyIds: string[] = [];
      const evidenceItems: PolicyAlert['evidence'] = [];

      // Create alerts for high-relevance results (score > 0.7)
      for (const result of results) {
        const score = result.score || 0;

        // Only create alerts for highly relevant policies (threshold: 0.7)
        if (score > 0.7) {
          // Determine severity based on relevance score
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
          if (score > 0.9) {
            severity = 'critical';
          } else if (score > 0.85) {
            severity = 'high';
          } else if (score > 0.75) {
            severity = 'medium';
          }

          // Extract policy title from filename (remove extension)
          const policyTitle = result.filename
            ? result.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
            : result.policyId;

          // Determine source (heuristic: check filename for common standards)
          let source = 'Internal';
          const filenameLower = (result.filename || '').toLowerCase();
          if (filenameLower.includes('cbahi') || filenameLower.includes('cbahi')) {
            source = 'CBAHI';
          } else if (filenameLower.includes('jci')) {
            source = 'JCI';
          } else if (filenameLower.includes('iso')) {
            source = 'ISO';
          }

          // Build evidence item matching PolicyAlert['evidence'] type
          const evidenceItem: PolicyAlert['evidence'][0] = {
            policyId: result.policyId,
            policyTitle,
            snippet: result.snippet || '',
            relevance: score,
          };

          evidenceItems.push(evidenceItem);
          if (result.policyId && !matchedPolicyIds.includes(result.policyId)) {
            matchedPolicyIds.push(result.policyId);
          }

          // Check if alert severity meets threshold
          if (!meetsSeverityThreshold(severity, severityThreshold)) {
            continue; // Skip this alert - doesn't meet threshold
          }

          const alertData = {
            tenantId,
            eventId: event?.id || 'direct',
            severity,
            summary: `Relevant policy found: ${policyTitle} (relevance: ${(score * 100).toFixed(1)}%)`,
            recommendations: [
              `Review policy: ${policyTitle}`,
              result.snippet ? `Relevant section: "${result.snippet.substring(0, 200)}..."` : 'See policy document for details',
            ],
            policyIds: [result.policyId].filter(Boolean),
            evidence: [evidenceItem],
            trace: {
              eventId: event?.id || 'direct',
              engineCallId: searchData.tenantId ? `${searchData.tenantId}-${Date.now()}` : undefined,
              checkedAt: now,
              processingTimeMs,
            },
            createdAt: now,
          };

          const alert = await prisma.policyAlert.create({
            data: {
              tenantId,
              type: alertData.severity,
              severity: alertData.severity,
              message: alertData.summary,
              details: alertData as any,
            },
          });
          alertIds.push(alert.id);
        }
      }

      // Update event status to processed with tenant isolation
      if (event) {
        await prisma.clinicalEvent.updateMany({
          where: { id: event.id, tenantId },
          data: {
            status: 'processed',
            updatedAt: now,
            updatedBy: userId,
          },
        });
      }

      // Return result summary
      return NextResponse.json({
        ok: true,
        alertId: alertIds[0] || null,
        alertIds,
        resultSummary: {
          totalResults: results.length,
          alertsCreated: alertIds.length,
          topScore: results.length > 0 ? results[0].score : 0,
        },
      });
    } catch (error) {
      // Update event status to failed with tenant isolation
      if (event) {
        await prisma.clinicalEvent.updateMany({
          where: { id: event.id, tenantId },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
            updatedBy: userId,
          },
        });
      }

      logger.error('Policy check error', { category: 'api', error });
      return NextResponse.json(
        {
          error: 'Policy check failed',
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Policy check error', { category: 'api', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'integrations.policy-check' });
