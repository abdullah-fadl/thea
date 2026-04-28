import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { validateBody } from '@/lib/validation/helpers';
import { aiPolicyAssistantSchema } from '@/lib/validation/sam.schema';
import { buildOrgProfileRequiredResponse, requireTenantContext, OrgProfileRequiredError } from '@/lib/tenant/getTenantContext';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { rateLimitAI, getRequestIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

interface Policy {
  id: string;
  title: string;
  content: string;
  pageNumber?: number;
  section?: string;
  category?: string;
  source?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tenantId?: string;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId }) => {
  const rl = await rateLimitAI({ ip: getRequestIp(req), userId, tenantId });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  try {
    const rawBody = await req.json();
    const v = validateBody(rawBody, aiPolicyAssistantSchema);
    if ('error' in v) return v.error;
    const { question } = v.data;

    // [AI-05] Fetch policies with a reasonable limit to prevent excessive token usage
    const allPolicies = await prisma.policy.findMany({
      where: { tenantId, status: 'active' },
      take: 500,
    });

    // Filter: prefer page-level policies (have pageNumber) over full document policies
    const pagePolicies = allPolicies.filter((p: any) => p.pageNumber);
    const fullPolicies = allPolicies.filter((p: any) => !p.pageNumber && !p.parentPolicyId);

    // Use page-level policies if available, otherwise use full policies
    const policies = pagePolicies.length > 0 ? pagePolicies : fullPolicies;

    if (policies.length === 0) {
      return NextResponse.json({
        answer: 'No policies found in the database. Please add policies first.',
        sources: [],
        relevantPolicies: [],
      });
    }

    // Prepare policy content with metadata for context
    const policyContext = policies.map((policy: any) => {
      const lines = (policy.content || '').split('\n');
      return {
        id: policy.id,
        title: policy.title || 'Untitled Policy',
        content: policy.content || '',
        pageNumber: policy.pageNumber || null,
        section: policy.section || null,
        category: policy.category || null,
        source: policy.source || null,
        lineCount: lines.length,
      };
    });

    // [AI-05] Cap individual policy content to prevent token overflow
    const MAX_POLICY_CONTENT_CHARS = 8000;
    const MAX_TOTAL_CONTEXT_CHARS = 100_000; // ~25K tokens

    // Create a comprehensive context string with size limits
    let totalContextChars = 0;
    const contextString = policyContext.map((p, index) => {
      if (totalContextChars >= MAX_TOTAL_CONTEXT_CHARS) return ''; // Skip remaining
      let context = `Policy ${index + 1}:\n`;
      context += `Title: ${p.title}\n`;
      if (p.category) context += `Category: ${p.category}\n`;
      if (p.section) context += `Section: ${p.section}\n`;
      if (p.pageNumber) context += `Page: ${p.pageNumber}\n`;
      if (p.source) context += `Source: ${p.source}\n`;
      const truncatedContent = p.content.length > MAX_POLICY_CONTENT_CHARS
        ? p.content.slice(0, MAX_POLICY_CONTENT_CHARS) + '... [truncated]'
        : p.content;
      context += `Content:\n${truncatedContent}\n`;
      context += `---\n`;
      totalContextChars += context.length;
      return context;
    }).filter(Boolean).join('\n');

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

    // Call OpenAI API
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about organizational documents.
You have access to the following policies. When answering questions:
1. Provide accurate information based on the policies provided
2. Cite specific policies by their title and ID
3. Mention page numbers, sections, and sources when available
4. If information is not found in the policies, clearly state that
5. Format your response in a clear, structured manner

${contextSummary ? `${contextSummary}\n\n` : ''}Available Policies:
Available Policies:
${contextString}`,
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

    // Find relevant policies based on keywords in the question
    const questionLower = question.toLowerCase();
    const relevantPolicies = policyContext
      .filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(questionLower);
        const contentMatch = p.content.toLowerCase().includes(questionLower);
        const categoryMatch = p.category?.toLowerCase().includes(questionLower);
        return titleMatch || contentMatch || categoryMatch;
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        pageNumber: p.pageNumber,
        section: p.section,
        category: p.category,
        source: p.source,
        excerpt: extractRelevantExcerpt(p.content, question),
      }));

    return NextResponse.json({
      answer,
      sources: relevantPolicies,
      relevantPolicies: relevantPolicies.slice(0, 10), // Limit to top 10
      totalPoliciesSearched: policies.length,
    });
  } catch (error: any) {
    logger.error('Policy assistant error:', { error: error });

    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured. Please contact your administrator.' },
        { status: 500 }
      );
    }

    // [AI-08] Do not leak internal error details to the client
    return NextResponse.json(
      { error: 'Failed to process question. Please try again later.' },
      { status: 500 }
    );
  }
}),
  { tenantScoped: true, permissionKey: 'ai.policy-assistant' });

function extractRelevantExcerpt(content: string, question: string, maxLength: number = 200): string {
  const questionWords = question.toLowerCase().split(/\s+/);
  const sentences = content.split(/[.!?]+/);

  // Find sentences that contain question words
  const relevantSentences = sentences.filter((sentence) => {
    const sentenceLower = sentence.toLowerCase();
    return questionWords.some((word) => sentenceLower.includes(word));
  });

  if (relevantSentences.length === 0) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const excerpt = relevantSentences.join('. ').substring(0, maxLength);
  return excerpt + (excerpt.length >= maxLength ? '...' : '');
}
