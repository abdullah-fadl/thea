import { verifyTokenEdge } from '@/lib/auth/edge';

export async function isAuthenticatedFromTokenCookie(token: string | null | undefined): Promise<boolean> {
  const t = String(token || '').trim();
  if (!t) return false;
  const payload = await verifyTokenEdge(t);
  return Boolean(payload && (payload as any).userId);
}

