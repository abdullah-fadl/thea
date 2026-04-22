/**
 * BaseActor — Authenticated HTTP actor for simulation.
 * Every actor logs in via JWT, then makes API calls with proper auth cookies.
 *
 * Session Cache: Concurrent scenarios sharing the same user email will reuse
 * a single JWT+CSRF pair, avoiding "Session expired (logged in elsewhere)" errors.
 */

export interface ActorCredentials {
  email: string;
  password: string;
}

export interface ActorOptions {
  baseUrl: string;
  credentials: ActorCredentials;
  role: string;
  label: string;
  tenantId?: string;
  platform?: string;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  durationMs: number;
  url: string;
  method: string;
}

interface CachedSession {
  jwt: string;
  csrfToken: string | null;
}

export class BaseActor {
  protected baseUrl: string;
  protected credentials: ActorCredentials;
  protected jwt: string | null = null;
  protected csrfToken: string | null = null;
  protected role: string;
  protected tenantId?: string;
  protected platform: string;
  readonly label: string;

  /** Cached user ID from /api/auth/me */
  private cachedUserId: string | null = null;

  /** Metrics collection */
  readonly calls: ApiResult[] = [];

  /**
   * Static session cache — keyed by "email::tenantId".
   * Ensures only ONE login per user across all concurrent scenarios.
   * Multiple actors with the same credentials share the same JWT.
   */
  private static sessionCache = new Map<string, Promise<CachedSession>>();

  /**
   * Track which session promise each actor instance is using.
   * Used by forceReLogin to detect if another actor already refreshed.
   */
  private lastSessionPromise: Promise<CachedSession> | null = null;

  /** Clear all cached sessions (useful between test runs) */
  static clearSessionCache(): void {
    BaseActor.sessionCache.clear();
  }

  constructor(opts: ActorOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.credentials = opts.credentials;
    this.role = opts.role;
    this.label = opts.label;
    this.tenantId = opts.tenantId || process.env.THEA_SIM_TENANT || 'test-tenant-a';
    this.platform = opts.platform || 'health';
  }

  /** Authenticate and store JWT — uses shared session cache to avoid duplicate logins */
  async login(): Promise<void> {
    const cacheKey = `${this.credentials.email}::${this.tenantId || ''}`;

    let sessionPromise = BaseActor.sessionCache.get(cacheKey);
    if (!sessionPromise) {
      // First login for this user — perform the actual login
      sessionPromise = this.performLogin();
      BaseActor.sessionCache.set(cacheKey, sessionPromise);
    }

    try {
      const session = await sessionPromise;
      this.jwt = session.jwt;
      this.csrfToken = session.csrfToken;
      this.lastSessionPromise = sessionPromise;
    } catch (err) {
      // Login failed — clear cache so next attempt can retry
      BaseActor.sessionCache.delete(cacheKey);
      throw err;
    }
  }

  /** Get the authenticated user's ID (cached after first call) */
  async getUserId(): Promise<string> {
    if (this.cachedUserId) return this.cachedUserId;
    const res = await this.get<{ user: { id: string } | null }>('/api/auth/me');
    const data = res.data;
    const userId = data?.user?.id;
    if (!userId) {
      throw new Error(`[${this.label}] Could not resolve user ID from /api/auth/me`);
    }
    this.cachedUserId = userId;
    return userId;
  }

  /** Perform the actual login with retry logic for rate limiting (429) and transient errors (500/0) */
  private async performLogin(): Promise<CachedSession> {
    const MAX_RETRIES = 7;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        await new Promise((r) => setTimeout(r, delay));
      }

      const loginBody: Record<string, string> = {
        email: this.credentials.email,
        password: this.credentials.password,
      };
      if (this.tenantId) {
        loginBody.tenantId = this.tenantId;
      }

      const res = await this.rawPost('/api/auth/login', loginBody);

      // Retry on rate limit OR transient server errors (DB unreachable, pool exhausted)
      if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 0) {
        const reason = res.status === 429 ? 'rate-limited' :
          res.status === 0 ? 'network error' : `server error (${res.status})`;
        lastErr = new Error(`[${this.label}] Login ${reason} (attempt ${attempt + 1}/${MAX_RETRIES})`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`[${this.label}] Login failed (${res.status}): ${JSON.stringify(res.data)}`);
      }

      // Extract JWT from Set-Cookie header or response body
      const data = res.data as Record<string, unknown>;
      let jwt: string | null = null;
      if (data.token) {
        jwt = data.token as string;
      } else if (res.setCookie) {
        const match = res.setCookie.match(/auth-token=([^;]+)/);
        if (match) jwt = match[1];
      }

      if (!jwt) {
        throw new Error(`[${this.label}] Login response missing token`);
      }

      // Store JWT temporarily for CSRF fetch
      this.jwt = jwt;
      const csrfToken = await this.fetchCSRF();

      return { jwt, csrfToken };
    }

    throw lastErr || new Error(`[${this.label}] Login failed after ${MAX_RETRIES} retries`);
  }

  /** Fetch CSRF token from /api/auth/me — with retry for transient failures */
  private async fetchCSRF(): Promise<string | null> {
    const url = `${this.baseUrl}/api/auth/me`;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: this.authHeaders(),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.csrfToken) {
            this.csrfToken = data.csrfToken;
            return data.csrfToken;
          }
        }

        // Extract from Set-Cookie as fallback
        const setCookie = response.headers.get('set-cookie') || '';
        const match = setCookie.match(/csrf-token=([^;]+)/);
        if (match) {
          this.csrfToken = match[1];
          return match[1];
        }

        // If server returned error (500/502/503), retry
        if (response.status >= 500) continue;
        return null;
      } catch {
        // Network error — retry
        if (attempt < 2) continue;
        return null;
      }
    }
    return null;
  }

  /** Build auth headers */
  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.jwt) {
      let cookie = `auth-token=${this.jwt}; activePlatform=${this.platform}`;
      if (this.csrfToken) {
        cookie += `; csrf-token=${this.csrfToken}`;
      }
      headers['Cookie'] = cookie;
    }
    if (this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }
    return headers;
  }

  /** Raw POST for login (captures Set-Cookie) */
  private async rawPost(path: string, body: unknown): Promise<ApiResult & { setCookie?: string }> {
    const url = `${this.baseUrl}${path}`;
    const start = performance.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'manual',
      });
      const text = await response.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      const result = {
        ok: response.ok,
        status: response.status,
        data,
        durationMs: performance.now() - start,
        url: path,
        method: 'POST',
        setCookie: response.headers.get('set-cookie') || undefined,
      };
      this.calls.push(result);
      return result;
    } catch (err) {
      const result = {
        ok: false,
        status: 0,
        data: { error: (err as Error).message },
        durationMs: performance.now() - start,
        url: path,
        method: 'POST',
      };
      this.calls.push(result);
      return result;
    }
  }

  /** HTTP GET */
  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResult<T>> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }
    return this.request<T>('GET', url);
  }

  /** HTTP POST */
  async post<T = unknown>(
    path: string,
    body: unknown,
    opts?: { skipAuth?: boolean },
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('POST', url, body, opts);
  }

  /** HTTP PUT */
  async put<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('PUT', url, body);
  }

  /** HTTP PATCH */
  async patch<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('PATCH', url, body);
  }

  /** HTTP DELETE */
  async delete<T = unknown>(path: string): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;
    return this.request<T>('DELETE', url);
  }

  /**
   * Force a fresh login — but prevent cascading invalidation across actors.
   * If another actor sharing the same credentials has already refreshed the
   * session (cache has a DIFFERENT promise than ours), we reuse that instead
   * of creating yet another login (which would invalidate theirs).
   */
  private async forceReLogin(): Promise<void> {
    const cacheKey = `${this.credentials.email}::${this.tenantId || ''}`;
    const currentCached = BaseActor.sessionCache.get(cacheKey);

    // If the cache has been updated since our last login (another actor already refreshed),
    // just adopt that session — don't create a new one that would cascade-invalidate.
    if (currentCached && currentCached !== this.lastSessionPromise) {
      try {
        const session = await currentCached;
        this.jwt = session.jwt;
        this.csrfToken = session.csrfToken;
        this.cachedUserId = null;
        this.lastSessionPromise = currentCached;
        return;
      } catch {
        // The other actor's refresh also failed — fall through to our own login
      }
    }

    // We're the first actor to notice the session is invalid — create a fresh login
    const sessionPromise = this.performLogin();
    BaseActor.sessionCache.set(cacheKey, sessionPromise);
    this.lastSessionPromise = sessionPromise;

    try {
      const session = await sessionPromise;
      this.jwt = session.jwt;
      this.csrfToken = session.csrfToken;
      this.cachedUserId = null;
    } catch (err) {
      BaseActor.sessionCache.delete(cacheKey);
      throw err;
    }
  }

  /** Core request handler with timing, auto re-login on 401, and retry on transient errors */
  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    opts?: { skipAuth?: boolean; _authRetry?: number; _networkRetry?: number },
  ): Promise<ApiResult<T>> {
    const start = performance.now();
    const headers = opts?.skipAuth
      ? { 'Content-Type': 'application/json' }
      : this.authHeaders();

    const fetchOpts: RequestInit = { method, headers };
    if (body && method !== 'GET') {
      fetchOpts.body = JSON.stringify(body);
    }

    let status = 0;
    let data: unknown = {};
    const networkRetry = opts?._networkRetry ?? 0;
    const authRetry = opts?._authRetry ?? 0;
    const MAX_NETWORK_RETRIES = 3;
    const MAX_AUTH_RETRIES = 3;

    try {
      const response = await fetch(url, fetchOpts);
      status = response.status;

      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      // Auto re-login on 401 (session expired / invalidated) — retry up to 3 times
      if (status === 401 && !opts?.skipAuth && authRetry < MAX_AUTH_RETRIES) {
        try {
          // Small backoff before re-login to avoid hammering the auth endpoint
          if (authRetry > 0) {
            await new Promise((r) => setTimeout(r, 1000 * authRetry));
          }
          await this.forceReLogin();
          return this.request<T>(method, url, body, { ...opts, _authRetry: authRetry + 1 });
        } catch {
          // Re-login failed — return the original 401 result
        }
      }

      // Retry on transient server errors (DB unreachable, pool exhausted)
      if ((status === 500 || status === 502 || status === 503) && networkRetry < MAX_NETWORK_RETRIES) {
        const errMsg = typeof data === 'object' && data !== null ? JSON.stringify(data) : '';
        const isTransient = errMsg.includes('reach database') || errMsg.includes('connection') ||
          errMsg.includes('pool') || errMsg.includes('timeout') || errMsg.includes('Invalid');
        if (isTransient) {
          await new Promise((r) => setTimeout(r, 2000 * (networkRetry + 1)));
          return this.request<T>(method, url, body, { ...opts, _networkRetry: networkRetry + 1 });
        }
      }

      const result: ApiResult<T> = {
        ok: response.ok,
        status,
        data: data as T,
        durationMs: performance.now() - start,
        url: url.replace(this.baseUrl, ''),
        method,
      };

      this.calls.push(result as ApiResult);
      return result;
    } catch (err) {
      // Network-level failure (fetch failed) — retry with backoff
      if (networkRetry < MAX_NETWORK_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * (networkRetry + 1)));
        return this.request<T>(method, url, body, { ...opts, _networkRetry: networkRetry + 1 });
      }

      const result: ApiResult<T> = {
        ok: false,
        status: 0,
        data: { error: (err as Error).message } as T,
        durationMs: performance.now() - start,
        url: url.replace(this.baseUrl, ''),
        method,
      };
      this.calls.push(result as ApiResult);
      return result;
    }
  }

  /** Assert response was successful, throw with context if not */
  assertOk<T>(result: ApiResult<T>, context: string): T {
    if (!result.ok) {
      throw new Error(
        `[${this.label}] ${context} failed — ${result.method} ${result.url} → ${result.status}: ${JSON.stringify(result.data)}`,
      );
    }
    return result.data;
  }

  /** Get call metrics summary */
  getMetrics() {
    const total = this.calls.length;
    const successes = this.calls.filter((c) => c.ok).length;
    const failures = total - successes;
    const avgMs = total ? this.calls.reduce((s, c) => s + c.durationMs, 0) / total : 0;
    const maxMs = total ? Math.max(...this.calls.map((c) => c.durationMs)) : 0;
    return { total, successes, failures, avgMs: Math.round(avgMs), maxMs: Math.round(maxMs) };
  }
}
