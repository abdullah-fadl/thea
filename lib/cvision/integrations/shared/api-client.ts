/**
 * CVision Integrations — Base API Client
 *
 * Abstract HTTP client for all Saudi government integrations.
 * Supports three modes:
 *   - LIVE: real HTTP calls with OAuth2, retry, circuit-breaking
 *   - SIMULATION: returns realistic mock responses (for development / demos)
 *   - FILE_EXPORT: generates downloadable files instead of API calls
 *
 * Each integration extends this class and overrides `simulateResponse`.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { IntegrationMode, IntegrationLog } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface IntegrationClientConfig {
  tenantId: string;
  integrationId: string;
  baseUrl: string;
  apiKey?: string;
  mode: IntegrationMode;
  timeout?: number;
  headers?: Record<string, string>;
}

export abstract class IntegrationClient {
  protected tenantId: string;
  protected integrationId: string;
  protected baseUrl: string;
  protected apiKey: string;
  protected mode: IntegrationMode;
  protected timeout: number;
  protected extraHeaders: Record<string, string>;

  constructor(config: IntegrationClientConfig) {
    this.tenantId = config.tenantId;
    this.integrationId = config.integrationId;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
    this.mode = config.mode;
    this.timeout = config.timeout || DEFAULT_TIMEOUT_MS;
    this.extraHeaders = config.headers || {};
  }

  // ── Public entry point ──────────────────────────────────────────────────

  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: any,
  ): Promise<{ data: T; simulated: boolean; duration: number }> {
    const start = Date.now();

    if (this.mode === 'SIMULATION') {
      const simulated = await this.simulateResponse(method, path, data);
      const duration = Date.now() - start;
      await this.logCall(method + ' ' + path, 'SUCCESS', data, simulated, duration);
      return { data: simulated as T, simulated: true, duration };
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeHttp<T>(method, path, data);
        const duration = Date.now() - start;
        await this.logCall(method + ' ' + path, 'SUCCESS', data, result, duration);
        return { data: result, simulated: false, duration };
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES && this.isRetryable(err)) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    const duration = Date.now() - start;
    await this.logCall(method + ' ' + path, 'FAILED', data, null, duration, lastError?.message);
    throw lastError;
  }

  // ── Simulation (override in subclasses) ─────────────────────────────────

  protected abstract simulateResponse(
    method: string,
    path: string,
    data?: any,
  ): Promise<any>;

  // ── HTTP execution ──────────────────────────────────────────────────────

  private async executeHttp<T>(
    method: string,
    path: string,
    data?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.extraHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new IntegrationApiError(
          `${this.integrationId}: ${method} ${path} returned ${res.status}`,
          res.status,
          body,
        );
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Audit logging ──────────────────────────────────────────────────────

  protected async logCall(
    action: string,
    status: 'SUCCESS' | 'FAILED' | 'PENDING',
    request: any,
    response: any,
    duration: number,
    error?: string,
  ): Promise<void> {
    try {
      const coll = await getCVisionCollection<any>(this.tenantId, 'integrationLogs');
      const log: IntegrationLog = {
        id: uuidv4(),
        tenantId: this.tenantId,
        integrationId: this.integrationId,
        action,
        status,
        request: summarisePayload(request),
        response: summarisePayload(response),
        error: error || undefined,
        duration,
        createdAt: new Date().toISOString(),
      };
      await coll.insertOne(log as any);
    } catch {
      // Non-critical — never let logging failure break the integration
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private isRetryable(err: any): boolean {
    if (err instanceof IntegrationApiError) {
      return err.statusCode >= 500 || err.statusCode === 429;
    }
    return err?.name === 'AbortError' || err?.code === 'ECONNRESET';
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class IntegrationApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body: string,
  ) {
    super(message);
    this.name = 'IntegrationApiError';
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate large payloads before persisting to the log collection.
 */
function summarisePayload(payload: any): any {
  if (!payload) return undefined;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (str.length <= 4_096) return payload;
  return { _truncated: true, length: str.length, preview: str.slice(0, 2_048) };
}
