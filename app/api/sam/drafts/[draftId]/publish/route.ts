import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { env } from '@/lib/env';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { withErrorHandler } from '@/lib/core/errors';
import { emit } from '@/lib/events';
import { logger } from '@/lib/monitoring/logger';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const safeFilename = (value: string) =>
  value
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .replace(/\s/g, '_');

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user, userId, role }, params) => {
  try {
    const draftId = (params as Record<string, string>)?.draftId as string | undefined;
    if (!draftId) {
      return NextResponse.json({ error: 'draftId is required' }, { status: 400 });
    }

    const draft: any = await prisma.draftDocument.findFirst({ where: { tenantId, id: draftId } });
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    void shadowEvaluate({ legacyDecision: 'allow', action: 'Approve', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id: draftId, type: 'Thea::SamPolicy', attrs: { tenantId, status: String((draft as any)?.status ?? ''), scope: (draft as any)?.departmentId ? 'department' : 'enterprise' } } });

    if (draft.status === 'published' && draft.publishedTheaEngineId) {
      return NextResponse.json({
        success: true,
        theaEngineId: draft.publishedTheaEngineId,
      });
    }

    if (!env.THEA_ENGINE_URL) {
      return NextResponse.json({ error: 'THEA_ENGINE_URL is not configured' }, { status: 500 });
    }

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId, draft.departmentId || undefined);

    const filename = `${safeFilename(draft.title || 'draft')}.md`;
    const content = String(draft.latestContent || '');

    const form = new FormData();
    form.append('tenantId', tenantId);
    form.append('uploaderUserId', userId);
    form.append('orgProfile', JSON.stringify(orgProfile));
    form.append('contextRules', JSON.stringify(contextRules));
    form.append('source', 'sam_draft_publish');
    if (draft.documentType) {
      form.append('entityType', String(draft.documentType));
    }
    if (draft.departmentId) {
      form.append('scope', 'department');
      form.append('departments[]', String(draft.departmentId));
    } else {
      form.append('scope', 'enterprise');
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const file = new File([blob], filename, { type: 'text/markdown' });
    form.append('files', file);

    const theaEngineUrl = `${env.THEA_ENGINE_URL}/v1/ingest`;
    const response = await fetch(theaEngineUrl, {
      method: 'POST',
      body: form,
    });
    const responseText = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { raw: responseText };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || 'Policy engine publish failed', details: payload },
        { status: response.status }
      );
    }

    const theaEngineId =
      payload?.jobs?.[0]?.policyId || payload?.policies?.[0]?.policyId || payload?.policyId || null;

    const now = new Date();
    await prisma.draftDocument.updateMany({
      where: { tenantId, id: draftId },
      data: {
        status: 'published',
        publishedTheaEngineId: theaEngineId,
        publishedAt: now,
        publishedBy: userId,
        updatedAt: now,
        updatedBy: userId,
      } as Prisma.InputJsonValue,
    });

    const auditContext = createAuditContext(
      { userId, userRole: role, userEmail: user?.email, tenantId },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );
    await logAuditEvent(auditContext, 'draft_published', 'draft_document', {
      resourceId: draftId,
      metadata: {
        draftId,
        departmentId: draft.departmentId || null,
        operationId: draft.operationId || null,
        requiredType: draft.requiredType || null,
        theaEngineId,
      },
    });

    // Emit policy.published@v1 — best-effort, never breaks the response.
    try {
      await emit({
        eventName: 'policy.published',
        version: 1,
        tenantId,
        aggregate: 'policy',
        aggregateId: draftId,
        payload: {
          draftId,
          tenantId,
          publishedTheaEngineId: theaEngineId ? String(theaEngineId) : null,
          status: 'published',
          publishedAt: now.toISOString(),
        },
      });
    } catch (e) {
      logger.error('events.emit_failed', { category: 'sam', eventName: 'policy.published', error: e });
    }

    return NextResponse.json({
      success: true,
      theaEngineId,
      redirectTo: '/sam/library',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to publish draft' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });
