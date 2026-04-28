import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform } from '@/lib/shell/platform';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = req.cookies.get('auth-token')?.value;
  const payload = token ? await verifyTokenEdge(token) : null;
  if (!payload || !(payload as unknown as Record<string, unknown>).userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    platform: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const platform = parseActivePlatform(body?.platform);
  if (!platform) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const res = NextResponse.json({ success: true, platform });

  // Phase 1 cookie: shell selection.
  res.cookies.set(ACTIVE_PLATFORM_COOKIE, platform, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
  });

  return res;
});

