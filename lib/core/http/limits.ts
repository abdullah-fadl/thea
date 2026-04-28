import { NextResponse } from 'next/server';

export type JsonLimitOptions = {
  maxBytes?: number;
};

export function getMaxJsonBytesFromEnv(): number {
  const kbRaw = process.env.MAX_JSON_KB;
  const kb = Number(kbRaw ?? 256);
  if (!Number.isFinite(kb) || kb <= 0) return 256 * 1024;
  return Math.min(Math.floor(kb), 10 * 1024) * 1024; // cap at 10MB for safety
}

export function isHardeningLimitsEnabled(): boolean {
  return process.env.HARDEN_LIMITS === '1';
}

export function payloadTooLargeResponse() {
  return NextResponse.json({ code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
}

/**
 * Reads JSON body with a hard size cap.
 * Deterministic: same input -> same response.
 * Idempotent: no side effects.
 */
export async function readJsonBodyWithLimit<T = any>(
  request: Request,
  options: JsonLimitOptions = {}
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const maxBytes = Math.max(1, Number(options.maxBytes ?? getMaxJsonBytesFromEnv()));

  // If body stream is missing, fall back to request.json().
  // (NextRequest always provides it, but keep safe.)
  const body = request.body;
  if (!body || typeof body.getReader !== 'function') {
    try {
      const data = (await request.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
    }
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        return { ok: false, response: payloadTooLargeResponse() };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Failed to read body' }, { status: 400 }) };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8').decode(merged);
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
  }
}

