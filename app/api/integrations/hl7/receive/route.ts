import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processORU } from '@/lib/integrations/hl7/oruProcessor';
import { prisma } from '@/lib/db/prisma';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { validateHL7ApiKey } from '@/lib/integrations/hl7Auth';

const hl7JsonSchema = z.object({
  message: z.string().min(1, 'message is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Validate integration API key (global env key or per-tenant DB key)
  const authResult = await validateHL7ApiKey(req);
  if (authResult instanceof NextResponse) return authResult;

    const contentType = req.headers.get('content-type');
    let rawMessage: string;

    if (contentType?.includes('application/json')) {
      const body = await req.json();
      const v = validateBody(body, hl7JsonSchema);
      if ('error' in v) return v.error;
      rawMessage = v.data.message;
    } else {
      rawMessage = await req.text();
    }

    if (!rawMessage) {
      return NextResponse.json({ error: 'No HL7 message provided' }, { status: 400 });
    }

    const result = processORU(rawMessage, {
      receivingApplication: 'Thea_EHR',
      receivingFacility: 'Thea',
    });

    if (result.success && result.results.length > 0) {
      const { tenantId } = authResult;

      for (const labResult of result.results) {
        await prisma.labResultIncoming.create({
          data: {
            id: `hlr_${nanoid(12)}`,
            tenantId,
            ...labResult as unknown as Record<string, unknown>,
            hl7MessageId: result.messageId,
            receivedAt: new Date(),
            processed: false,
          },
        });
      }
    }

  return new NextResponse(result.ackMessage, {
    status: result.success ? 200 : 400,
    headers: {
      'Content-Type': 'application/hl7-v2',
    },
  });
});
