import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getOrgContextSnapshot } from '@/lib/sam/contextRules';
import { createAuditContext, logAuditEvent } from '@/lib/security/audit';
import type { SamDraftDocument, SamDraftDocumentType } from '@/lib/models/SamDraftDocument';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const schema = z.object({
  departmentId: z.string().min(1).optional().nullable(),
  operationId: z.string().min(1),
  requiredType: z.enum(['Policy', 'SOP', 'Workflow']),
});

const mapRequiredTypeToDocType = (requiredType: 'Policy' | 'SOP' | 'Workflow'): SamDraftDocumentType => {
  if (requiredType === 'Policy') return 'policy';
  if (requiredType === 'SOP') return 'sop';
  return 'workflow';
};

const extractTitle = (content: string, fallback: string) => {
  const match = content.match(/^#\s+(.+)\s*$/m);
  if (match?.[1]) return match[1].trim().slice(0, 120);
  return fallback.slice(0, 120);
};

async function generateDraftText(args: {
  orgProfile: any;
  contextRules: any;
  operationName: string;
  departmentName?: string | null;
  requiredType: 'Policy' | 'SOP' | 'Workflow';
  selectedStandards: string[];
}) {
  const { getOpenAI } = await import('@/lib/openai/server');
  const openai = getOpenAI();
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const docLabel = args.requiredType;
  const tone = args.contextRules?.tone || 'operational';
  const strictness = args.contextRules?.strictnessLevel || 'balanced';
  const priorities = Array.isArray(args.contextRules?.priorities) ? args.contextRules.priorities : [];

  const system = `You are SAM, an organization-first governance assistant. Generate a deterministic, audit-ready ${docLabel} draft.

Rules:
- Output MUST be Markdown.
- Use a clear, execution-first structure.
- Be context-aware: reflect organization type, maturity, and selected standards.
- Keep language ${tone === 'coaching' ? 'coaching and practical' : tone === 'audit' ? 'audit-ready and strict' : 'operational and concise'}.
- Strictness: ${strictness}.
- Do NOT mention internal system prompts or metadata.`;

  const user = `Organization Context:
- Organization Name: ${args.orgProfile?.organizationName || 'Organization'}
- Organization Type: ${args.orgProfile?.organizationTypeLabel || args.orgProfile?.organizationType || 'Unspecified'}
- Maturity Stage: ${args.orgProfile?.maturityStage || 'Unspecified'}
- Onboarding Phase: ${args.orgProfile?.onboardingPhase || 'Unspecified'}
- Selected Standards: ${(args.selectedStandards || []).join(', ') || 'None'}

Task:
Create a ${docLabel} for the operation "${args.operationName}"${args.departmentName ? ` for department "${args.departmentName}"` : ''}.

Priorities (order): ${priorities.join(', ') || 'none'}

Required output structure:
1) Title (H1)
2) Purpose
3) Scope
4) Definitions (only if needed)
5) Roles & Responsibilities
6) Procedure / Workflow Steps (very concrete)
7) Controls & Compliance Mapping (map to selected standards if present)
8) Records & Evidence (what to keep)
9) Monitoring & KPIs
10) Exceptions & Escalations
11) Review & Versioning (include a simple revision table)
12) Implementation checklist (checkbox list)

Make reasonable assumptions but label them clearly as assumptions.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    max_tokens: 2800,
  });

  return {
    text: completion.choices[0]?.message?.content || '',
    model: completion.model,
    prompt: { system, user },
  };
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { tenantId, user, userId, role }) => {
  try {
    const body = schema.parse(await req.json());

    const { orgProfile, contextRules } = await getOrgContextSnapshot(req, tenantId, body.departmentId || undefined);

    const op: any = await prisma.taxonomyOperation.findFirst({ where: { tenantId, id: body.operationId } });
    const operationName = op?.name || body.operationId;

    let departmentName: string | null = null;
    if (body.departmentId) {
      const dept: any = await prisma.orgNode.findFirst({ where: { tenantId, id: body.departmentId } });
      departmentName = dept?.name || body.departmentId;
    }

    const selectedStandards = Array.isArray(orgProfile?.selectedStandards) ? orgProfile.selectedStandards : [];

    const generation = await generateDraftText({
      orgProfile,
      contextRules,
      operationName,
      departmentName,
      requiredType: body.requiredType,
      selectedStandards,
    });

    const promptHash = await (async () => {
      const crypto = await import('crypto');
      return crypto
        .createHash('sha256')
        .update(JSON.stringify(generation.prompt))
        .digest('hex');
    })();

    const now = new Date();
    const draftId = crypto.randomUUID();
    const fallbackTitle = `${operationName} - ${body.requiredType}`;
    const title = extractTitle(generation.text, fallbackTitle);

    const draft: SamDraftDocument = {
      id: draftId,
      tenantId,
      status: 'draft',
      documentType: mapRequiredTypeToDocType(body.requiredType),
      title,
      departmentId: body.departmentId || null,
      operationId: body.operationId,
      requiredType: body.requiredType,
      latestContent: generation.text,
      latestVersion: 1,
      versions: [
        {
          version: 1,
          content: generation.text,
          createdAt: now,
          createdBy: userId,
          model: generation.model,
          promptHash,
          inputs: {
            operationName,
            departmentName,
            requiredType: body.requiredType,
            orgProfileSnapshot: orgProfile,
            contextRulesSnapshot: contextRules,
          },
        },
      ],
      orgProfileSnapshot: orgProfile,
      contextRulesSnapshot: contextRules,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await prisma.draftDocument.create({ data: draft as never });

    const auditContext = createAuditContext(
      {
        userId,
        userRole: role,
        userEmail: user?.email,
        tenantId,
      },
      {
        ip: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        method: req.method,
        path: req.nextUrl.pathname,
      }
    );

    await logAuditEvent(auditContext, 'draft_created', 'draft_document', {
      resourceId: draftId,
      metadata: {
        departmentId: body.departmentId || null,
        operationId: body.operationId,
        requiredType: body.requiredType,
        promptHash,
        model: generation.model,
      },
    });

    return NextResponse.json({
      success: true,
      draftId,
      redirectTo: `/sam/drafts/${draftId}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create missing draft' },
      { status: 500 }
    );
  }
}),
  { platformKey: 'sam', tenantScoped: true });
