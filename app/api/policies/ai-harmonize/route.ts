import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { validateBody } from '@/lib/validation/helpers';
import { aiHarmonizeSchema } from '@/lib/validation/sam.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const v = validateBody(body, aiHarmonizeSchema);
    if ('error' in v) return v.error;
    const { documentIds, topicQuery } = v.data;

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Get all documents
    const documents = await prisma.policyDocument.findMany({
      where: {
        tenantId,
        id: { in: documentIds },
        isActive: true,
        deletedAt: null,
      },
    });

    if (documents.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 active policy documents required' },
        { status: 400 }
      );
    }

    // Get chunks for all documents
    const allChunks = await prisma.policyChunk.findMany({
      where: {
        tenantId,
        documentId: { in: documentIds },
      },
      orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
    });

    // Group chunks by document
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of allChunks) {
      const docId = (chunk as Record<string, unknown>).documentId as string;
      if (!chunksByDocument.has(docId)) {
        chunksByDocument.set(docId, []);
      }
      chunksByDocument.get(docId)!.push(chunk);
    }

    // Build context for each document
    const documentContexts = documents.map((doc: Record<string, unknown>) => {
      const docChunks = chunksByDocument.get(doc.documentId as string) || [];
      const fullText = docChunks.map((c: Record<string, unknown>) => c.text as string).join('\n\n');

      return {
        documentId: doc.documentId,
        title: doc.title,
        hospital: doc.hospital || 'Unknown',
        fileName: doc.originalFileName,
        text: fullText.substring(0, 10000),
      };
    });

    let contextSummary = '';
    try {
      const context = await requireTenantContext(req, tenantId);
      contextSummary = `Organization context:
- Type: ${context.org.typeName}
- Sector: ${context.org.sectorId}
- Country/Region: ${context.org.countryCode || 'N/A'}
- Required document types: ${(context.requiredDocumentTypes || []).join(', ') || 'None'}
- Accreditation sets: ${(context.org.accreditationSetIds || []).join(', ') || 'None'}
- Guidance strictness: ${context.guidanceDefaults?.strictness || 'balanced'}`;
    } catch (error) {
      if (error instanceof OrgProfileRequiredError) {
        return buildOrgProfileRequiredResponse();
      }
    }

    const documentsText = documentContexts
      .map((ctx, idx) => `Document ${idx + 1} (${ctx.hospital}):\nTitle: ${ctx.title}\nDocument ID: ${ctx.documentId}\n\nContent:\n${ctx.text}`)
      .join('\n\n---\n\n');

    const prompt = `You are analyzing multiple organizational documents to identify conflicts, gaps, and opportunities for harmonization.

${contextSummary ? `${contextSummary}\n\n` : ''}${topicQuery ? `Focus Topic: ${topicQuery}\n\n` : ''}Documents to compare:
${documentsText}

Please provide a comprehensive harmonization analysis that includes:
1. **Conflicts**: Identify conflicting requirements, procedures, or standards between the documents
2. **Gaps**: Identify missing elements in one document that exist in others
3. **Best Practices**: Highlight the best approach from each document
4. **Corrective Actions**: Specific recommendations to align the policies
5. **Unified Standard Draft**: A proposed unified policy standard that combines the best elements from all documents

Format your response clearly with sections for each category.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in hospital policy harmonization and accreditation standards. Analyze multiple policy documents to identify conflicts, gaps, and create unified standards.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const harmonizationResult = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      documentIds,
      documents: documentContexts.map(ctx => ({
        documentId: ctx.documentId,
        title: ctx.title,
        hospital: ctx.hospital,
        fileName: ctx.fileName,
      })),
      harmonization: harmonizationResult,
      topicQuery: topicQuery || null,
    });
  } catch (error: unknown) {
    logger.error('AI harmonize error:', { error: error });

    if ((error as Error).message?.includes('API key') || (error as Error).message?.includes('401')) {
      return NextResponse.json(
        { error: 'OpenAI API key is invalid or expired' },
        { status: 500 }
      );
    }

    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to harmonize policies' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'policies.ai-harmonize' });
