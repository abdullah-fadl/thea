/**
 * CSRF-aware fetch wrapper.
 *
 * Reads the `csrf-token` cookie and attaches it as the `X-CSRF-Token`
 * header on every state-changing request (POST, PUT, PATCH, DELETE).
 * Also includes `credentials: 'include'` by default.
 */

function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Drop-in replacement for `fetch` that auto-attaches CSRF token
 * and credentials.
 */
export function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const headers = new Headers(init?.headers);

  if (STATE_CHANGING_METHODS.has(method)) {
    const token = getCSRFToken();
    if (token && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', token);
    }
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

/** SWR-compatible fetcher that includes credentials + CSRF. */
export const swrFetcher = (url: string) =>
  csrfFetch(url).then((r) => {
    if (!r.ok) throw new Error(`Fetch error ${r.status}`);
    return r.json();
  });
