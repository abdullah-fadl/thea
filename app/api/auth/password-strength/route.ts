/**
 * Password Strength Check — Public endpoint
 *
 * POST /api/auth/password-strength
 * Body: { password: string, email?: string }
 * Returns: { strength: 0-4, valid: boolean, errors: [...] }
 *
 * NOTE: Public endpoint (no auth required) for registration/change-password forms
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, estimateStrength } from '@/lib/security/passwordPolicy';
import { validateBody } from '@/lib/validation/helpers';
import { passwordStrengthSchema } from '@/lib/validation/auth.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const v = validateBody(body, passwordStrengthSchema);
  if ('error' in v) return v.error;
  const { password, email, name } = v.data;

  const validation = validatePassword(password, {
    email: email || undefined,
    name: name || undefined,
  });

  const strength = estimateStrength(password);

  return NextResponse.json({
    strength,
    valid: validation.valid,
    errors: validation.errors,
  });
});
