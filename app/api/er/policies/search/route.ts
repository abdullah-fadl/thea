import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!searchQuery || searchQuery.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const searchPattern = `%${searchQuery}%`;

    // Search in policy chunks using ILIKE for text matching
    let chunkQuery = `
      SELECT * FROM policy_chunks
      WHERE "tenantId" = $1
        AND "text" ILIKE $2
      LIMIT 100
    `;
    const matchingChunks: any[] = await prisma.$queryRawUnsafe(chunkQuery, tenantId, searchPattern);

    // Group chunks by documentId
    const chunksByDocument = new Map<string, any[]>();
    for (const chunk of matchingChunks) {
      if (!chunksByDocument.has(chunk.documentId)) {
        chunksByDocument.set(chunk.documentId, []);
      }
      chunksByDocument.get(chunk.documentId)!.push(chunk);
    }

    const documentIds = Array.from(chunksByDocument.keys());

    if (documentIds.length === 0) {
      // Fallback: search in document titles
      let titleQuery = `
        SELECT * FROM policy_documents
        WHERE "tenantId" = $1
          AND "isActive" = true
          AND "processingStatus" = 'completed'
          AND "title" ILIKE $2
      `;
      const params: any[] = [tenantId, searchPattern];

      if (category) {
        titleQuery += ` AND "category" = $3`;
        params.push(category);
      }

      titleQuery += ` LIMIT $${params.length + 1}`;
      params.push(limit);

      const titleMatches: any[] = await prisma.$queryRawUnsafe(titleQuery, ...params);

      return NextResponse.json({
        query: searchQuery,
        results: titleMatches.map((doc: any) => ({
          document: {
            id: doc.id,
            documentId: doc.documentId,
            title: doc.title,
            category: doc.category,
            section: doc.section,
            source: doc.source,
            totalPages: doc.totalPages,
            fileName: doc.originalFileName,
          },
          chunks: [],
          relevanceScore: 1,
          matchedSnippets: [],
        })),
        totalResults: titleMatches.length,
      });
    }

    // Get documents for matching chunks
    const placeholders = documentIds.map((_, i) => `$${i + 4}`).join(', ');
    let docsQuery = `
      SELECT * FROM policy_documents
      WHERE "tenantId" = $1
        AND "isActive" = true
        AND "processingStatus" = 'completed'
        AND "documentId" IN (${placeholders})
    `;
    const docsParams: any[] = [tenantId];

    if (category) {
      docsQuery = `
        SELECT * FROM policy_documents
        WHERE "tenantId" = $1
          AND "isActive" = true
          AND "processingStatus" = 'completed'
          AND "category" = $2
          AND "documentId" IN (${documentIds.map((_, i) => `$${i + 3}`).join(', ')})
      `;
      docsParams.push(category, ...documentIds);
    } else {
      docsQuery = `
        SELECT * FROM policy_documents
        WHERE "tenantId" = $1
          AND "isActive" = true
          AND "processingStatus" = 'completed'
          AND "documentId" IN (${documentIds.map((_, i) => `$${i + 2}`).join(', ')})
      `;
      docsParams.push(...documentIds);
    }

    const documents: any[] = await prisma.$queryRawUnsafe(docsQuery, ...docsParams);

    // Build results
    const results = [];
    for (const doc of documents) {
      const docChunks = chunksByDocument.get(doc.documentId) || [];

      // Sort chunks by chunkIndex
      docChunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);

      // Extract snippets
      const snippets = docChunks
        .slice(0, 3)
        .map((chunk: any) => {
          const text = chunk.text;
          const index = text.toLowerCase().indexOf(searchQuery.toLowerCase());
          const start = Math.max(0, index - 100);
          const end = Math.min(text.length, index + searchQuery.length + 100);
          return '...' + text.substring(start, end) + '...';
        });

      results.push({
        document: {
          id: doc.id,
          documentId: doc.documentId,
          title: doc.title,
          category: doc.category,
          section: doc.section,
          source: doc.source,
          totalPages: doc.totalPages,
          fileName: doc.originalFileName,
        },
        chunks: docChunks.map((chunk: any) => ({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          text: chunk.text.substring(0, 200) + '...',
        })),
        relevanceScore: docChunks.length,
        matchedSnippets: snippets,
      });
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      query: searchQuery,
      results: results.slice(0, limit),
      totalResults: results.length,
    });
  } catch (error: any) {
    logger.error('Policy search error', { category: 'er', error });
    // [SEC-06]
    return NextResponse.json(
      { error: 'Failed to search policies' },
      { status: 500 }
    );
  }
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.policies.search' }
);
