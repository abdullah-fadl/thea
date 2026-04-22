import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { PolicyDocument, PolicyChunk } from '@/lib/models/Policy';
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

const summarizeSchema = z.object({
  documentId: z.string().min(1),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const body = await req.json();
    const { documentId } = summarizeSchema.parse(body);

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Get document
    const document = await prisma.policyDocument.findFirst({
      where: {
        tenantId,
        id: documentId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Policy document not found' },
        { status: 404 }
      );
    }

    // Get all chunks for this document
    const chunks = await prisma.policyChunk.findMany({
      where: {
        tenantId,
        documentId,
      },
      orderBy: { chunkIndex: 'asc' },
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'No content found for this policy document' },
        { status: 404 }
      );
    }

    // Combine all chunks into full text
    const fullText = chunks.map((c: Record<string, unknown>) => c.text).join('\n\n');

    // Generate summary using OpenAI
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in analyzing hospital policy documents. Provide a comprehensive summary that includes: 1) Main purpose and scope, 2) Key procedures and requirements, 3) Important responsibilities, 4) Critical compliance points, 5) Key dates or timelines if mentioned. Format the summary clearly with sections.',
        },
        {
          role: 'user',
          content: `Please summarize the following hospital policy document:\n\nTitle: ${(document as Record<string, unknown>).title}\n\nContent:\n${fullText.substring(0, 15000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const summary = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      documentId,
      title: (document as Record<string, unknown>).title,
      summary,
      totalChunks: chunks.length,
      totalPages: (document as Record<string, unknown>).totalPages,
    });
  } catch (error: unknown) {
    logger.error('AI summarize error:', { error: error });

    // [SEC-06]
    if ((error as any).name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    if ((error as any).message?.includes('API key') || (error as any).message?.includes('401')) {
      return NextResponse.json(
        { error: 'OpenAI API key is invalid or expired' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to summarize policy' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'policies.ai-summarize' });
