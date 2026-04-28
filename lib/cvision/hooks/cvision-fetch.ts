/**
 * CVision fetch wrapper for React Query integration.
 * Handles credentials, AbortController signals, and error normalization.
 */

export class CVisionApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'CVisionApiError';
    this.status = status;
    this.data = data;
  }
}

interface CVisionFetchOptions extends Omit<RequestInit, 'credentials'> {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Typed fetch wrapper for CVision API calls.
 * - Always includes credentials
 * - Normalizes errors into CVisionApiError
 * - Supports query params via options.params
 */
export async function cvisionFetch<T = any>(
  url: string,
  options: CVisionFetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
  }

  const res = await fetch(finalUrl, {
    credentials: 'include',
    ...fetchOptions,
  });

  if (!res.ok) {
    let errorData: any = {};
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try { errorData = await res.json(); } catch { /* ignore */ }
    }
    throw new CVisionApiError(
      errorData.error || errorData.message || `Request failed: ${res.status} ${res.statusText}`,
      res.status,
      errorData
    );
  }

  return res.json();
}

/**
 * CVision mutation helper — POST/PUT/PATCH/DELETE with JSON body.
 */
export async function cvisionMutate<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: CVisionFetchOptions = {}
): Promise<T> {
  return cvisionFetch<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
}
