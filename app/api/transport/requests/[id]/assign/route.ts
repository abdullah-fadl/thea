import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { assignTransporter } from '@/lib/transport/transportEngine';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const assignSchema = z.object({
  staffId: z.string().min(1, 'staffId is required'),
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST /api/transport/requests/[id]/assign — Assign transporter
// ---------------------------------------------------------------------------

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams?.id as string;

    if (!id) {
      return NextResponse.json({ error: 'Missing request ID' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    try {
      const updated = await assignTransporter(id, tenantId, parsed.data.staffId);
      return NextResponse.json({ request: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to assign transporter';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKey: 'transport.manage',
  },
);
