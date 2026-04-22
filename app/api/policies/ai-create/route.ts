import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { env } from '@/lib/env';
import { requireAuth } from '@/lib/security/auth';
import { requirePermission } from '@/lib/security/permissions';
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

const createSchema = z.object({
  title: z.string().min(1),
  domain: z.string().optional(),
  detailLevel: z.enum(['brief', 'standard', 'detailed']).optional().default('standard'),
  accreditationFocus: z.string().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  keyRules: z.string().optional(),
  monitoring: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Check permission: policies.new-creator.view
    const permissionCheck = await requirePermission(request, 'policies.new-creator.view', auth);
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Build prompt for policy generation
    const prompt = `Generate a comprehensive hospital policy document with the following specifications:

Title: ${data.title}
${data.domain ? `Domain: ${data.domain}` : ''}
Detail Level: ${data.detailLevel}
${data.accreditationFocus ? `Accreditation Focus: ${data.accreditationFocus}` : ''}
${data.riskLevel ? `Risk Level: ${data.riskLevel}` : ''}
${data.purpose ? `Purpose: ${data.purpose}` : ''}
${data.scope ? `Scope: ${data.scope}` : ''}
${data.keyRules ? `Key Rules: ${data.keyRules}` : ''}
${data.monitoring ? `Monitoring Requirements: ${data.monitoring}` : ''}
${data.notes ? `Additional Notes: ${data.notes}` : ''}

Please generate a complete policy document that includes:
1. Policy Statement
2. Purpose and Scope
3. Definitions (if applicable)
4. Policy Content (detailed based on detailLevel)
5. Procedures (if applicable)
6. Responsibilities
7. Monitoring and Compliance
8. Review and Revision Schedule
9. References (if applicable)

Format the output as a well-structured policy document suitable for hospital use.`;

    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in hospital policy writing. Generate comprehensive, clear, and actionable policy documents that meet healthcare accreditation standards.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedText = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      policyText: generatedText,
      title: data.title,
    });
  } catch (error: any) {
    logger.error('AI create error:', { error: error });
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    if (error.message?.includes('API key') || error.message?.includes('401')) {
      return NextResponse.json(
        { error: 'OpenAI API key is invalid or expired' },
        { status: 500 }
      );
    }

    throw error;
  }
});





