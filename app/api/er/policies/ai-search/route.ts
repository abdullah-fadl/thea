import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  question: z.string().min(1, 'Question is required'),
}).passthrough();

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
    const rawBody = await req.json();
    const v = validateBody(rawBody, bodySchema);
    if ('error' in v) return v.error;
    const { question } = v.data;

    const searchPattern = `%${question}%`;

    // Step 1: Search for relevant chunks using ILIKE
    const matchingChunks: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM policy_chunks WHERE "tenantId" = $1 AND "text" ILIKE $2 LIMIT 50`,
      tenantId, searchPattern
    );

    if (matchingChunks.length === 0) {
      // Fallback: search in document titles
      const titleMatches: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM policy_documents
         WHERE "tenantId" = $1 AND "isActive" = true AND "processingStatus" = 'completed'
           AND "title" ILIKE $2
         LIMIT 10`,
        tenantId, searchPattern
      );

      if (titleMatches.length === 0) {
        return NextResponse.json({
          answer: 'No relevant policies found for your question.',
          sources: [],
          relevantPolicies: [],
        });
      }

      // Return title matches only
      const sources = titleMatches.map((doc: any) => ({
        documentId: doc.documentId,
        title: doc.title,
        category: doc.category || null,
        section: doc.section || null,
        source: doc.source || null,
        pages: [],
      }));

      return NextResponse.json({
        answer: `Found ${titleMatches.length} policy document(s) with matching titles, but no content matches. Please review the documents: ${titleMatches.map((d: any) => d.title).join(', ')}`,
        sources,
        relevantPolicies: sources,
        totalDocumentsSearched: titleMatches.length,
        totalChunksFound: 0,
      });
    }

    // Step 2: Group chunks by documentId
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of matchingChunks) {
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    // Step 3: Get document metadata
    const documentIds = Array.from(chunksByDocument.keys());
    const placeholders = documentIds.map((_, i) => `$${i + 2}`).join(', ');
    const documents: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM policy_documents
       WHERE "tenantId" = $1 AND "isActive" = true AND "processingStatus" = 'completed'
         AND "documentId" IN (${placeholders})`,
      tenantId, ...documentIds
    );

    // Step 4: Prepare context for AI (top chunks from top documents)
    const relevantChunks: Array<{
      document: any;
      chunk: any;
      snippet: string;
    }> = [];

    // Sort documents by number of matching chunks
    const documentsWithChunkCount = documents.map((doc: any) => ({
      doc,
      chunkCount: chunksByDocument.get(doc.documentId)?.length || 0,
    })).sort((a, b) => b.chunkCount - a.chunkCount);

    // Get top 10 documents
    for (const { doc } of documentsWithChunkCount.slice(0, 10)) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];
      // Sort chunks by chunkIndex
      docChunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);

      // Take top 3 chunks per document
      for (const chunk of docChunks.slice(0, 3)) {
        const index = chunk.text.toLowerCase().indexOf(question.toLowerCase());
        const start = Math.max(0, index - 200);
        const end = Math.min(chunk.text.length, index + question.length + 200);
        const snippet = '...' + chunk.text.substring(start, end) + '...';

        relevantChunks.push({
          document: {
            documentId: doc.documentId,
            title: doc.title,
            category: doc.category,
            section: doc.section,
            source: doc.source,
            pageNumber: chunk.pageNumber,
          },
          chunk,
          snippet,
        });
      }
    }

    // Limit to top 10 chunks for AI context
    const contextChunks = relevantChunks.slice(0, 10);

    // Step 5: Prepare context for AI
    const contextText = contextChunks
      .map((item, idx) => {
        return `[Document ${idx + 1}]
Title: ${item.document.title}
Category: ${item.document.category || 'N/A'}
Section: ${item.document.section || 'N/A'}
Source: ${item.document.source || 'N/A'}
Page: ${item.chunk.pageNumber}
Content: ${item.chunk.text}
---`;
      })
      .join('\n\n');

    // Step 6: Call OpenAI
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about hospital policies.
You have access to policy documents. When answering:
1. Provide accurate information based on the provided policy excerpts
2. Cite specific documents by title and document ID
3. Mention page numbers when available
4. If information is not found, clearly state that
5. Format your response clearly with proper structure

Available Policy Excerpts:
${contextText}`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const answer = completion.choices[0]?.message?.content || 'No answer generated.';

    // Step 7: Format sources
    const uniqueDocs = new Map();
    for (const item of relevantChunks) {
      if (!uniqueDocs.has(item.document.documentId)) {
        uniqueDocs.set(item.document.documentId, {
          documentId: item.document.documentId,
          title: item.document.title,
          category: item.document.category,
          section: item.document.section,
          source: item.document.source,
          pages: new Set<number>(),
        });
      }
      uniqueDocs.get(item.document.documentId).pages.add(item.chunk.pageNumber);
    }

    const sources = Array.from(uniqueDocs.values()).map((doc: any) => ({
      ...doc,
      pages: Array.from(doc.pages).sort((a: number, b: number) => a - b),
    }));

    return NextResponse.json({
      answer,
      sources,
      relevantPolicies: sources.slice(0, 10),
      totalDocumentsSearched: documents.length,
      totalChunksFound: matchingChunks.length,
    });
  } catch (error: any) {
    logger.error('AI policy search error', { category: 'er', error });

    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.policies.ai-search' }
);
