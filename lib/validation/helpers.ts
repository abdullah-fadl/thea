import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Validates a request body against a Zod schema.
 * Returns `{ data }` on success, or `{ error: NextResponse }` on failure.
 *
 * Usage:
 * ```ts
 * const result = validateBody(body, mySchema);
 * if ('error' in result) return result.error;
 * const { field1, field2 } = result.data;
 * ```
 */
export function validateBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): { data: z.infer<T> } | { error: NextResponse } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data };
}

/**
 * Safely parses JSON from a Request.
 * Returns `{ body }` on success, or `{ error: NextResponse }` on failure.
 */
export async function safeParseBody(
  req: Request
): Promise<{ body: unknown } | { error: NextResponse }> {
  try {
    const body = await req.json();
    return { body };
  } catch {
    return {
      error: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}
