/**
 * CVision Integrations — Nafath Client (NIC)
 *
 * National Single Sign-On for Saudi Arabia:
 *   - Initiate authentication (returns a 2-digit random number for
 *     the user to confirm in the Nafath mobile app)
 *   - Poll authentication status (WAITING → COMPLETED / REJECTED / EXPIRED)
 *
 * In SIMULATION mode the flow auto-completes after a short delay.
 * The Nafath protocol is challenge-based: the system shows a random number
 * and the user must choose the matching number in their app.
 */

import { IntegrationClient, type IntegrationClientConfig } from '../shared/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NafathAuthInitResult {
  requestId: string;
  random: string;
  transId: string;
  expiresIn: number;
  status: 'WAITING';
  simulated: boolean;
}

export type NafathAuthStatus = 'WAITING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';

export interface NafathAuthStatusResult {
  status: NafathAuthStatus;
  userInfo?: {
    nationalId: string;
    name: string;
  };
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Track pending simulated sessions so `checkAuthStatus` returns
 * WAITING on first call and COMPLETED on subsequent calls.
 */
const pendingSessions = new Map<string, { createdAt: number; nationalId: string }>();

export class NafathClient extends IntegrationClient {
  constructor(config: Omit<IntegrationClientConfig, 'integrationId'>) {
    super({ ...config, integrationId: 'nafath' });
  }

  async initiateAuth(nationalId: string): Promise<NafathAuthInitResult> {
    const res = await this.request<NafathAuthInitResult>(
      'POST',
      '/api/v1/auth/initiate',
      { nationalId },
    );
    return res.data;
  }

  async checkAuthStatus(requestId: string): Promise<NafathAuthStatusResult> {
    const res = await this.request<NafathAuthStatusResult>(
      'GET',
      `/api/v1/auth/status/${requestId}`,
    );
    return res.data;
  }

  // ── Simulation ────────────────────────────────────────────────────

  protected async simulateResponse(method: string, path: string, data?: any): Promise<any> {
    await delay();

    // ── Initiate ─────────────────────────────────────────────────
    if (path.includes('/initiate')) {
      const nationalId: string = data?.nationalId || '1000000000';
      const requestId = `NFT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const random = String(Math.floor(10 + Math.random() * 90));

      pendingSessions.set(requestId, { createdAt: Date.now(), nationalId });

      return {
        requestId,
        random,
        transId: `TXN-${Date.now()}`,
        expiresIn: 120,
        status: 'WAITING' as const,
        simulated: true,
      } satisfies NafathAuthInitResult;
    }

    // ── Status check ─────────────────────────────────────────────
    if (path.includes('/status/')) {
      const requestId = path.split('/').pop() || '';
      const session = pendingSessions.get(requestId);

      if (!session) {
        return {
          status: 'EXPIRED' as NafathAuthStatus,
          simulated: true,
        } satisfies NafathAuthStatusResult;
      }

      const elapsed = Date.now() - session.createdAt;
      if (elapsed < 2_000) {
        return {
          status: 'WAITING' as NafathAuthStatus,
          simulated: true,
        } satisfies NafathAuthStatusResult;
      }

      pendingSessions.delete(requestId);
      const isSaudi = session.nationalId.startsWith('1');
      return {
        status: 'COMPLETED' as NafathAuthStatus,
        userInfo: {
          nationalId: session.nationalId,
          name: isSaudi ? 'Khalid Ibrahim' : 'Yousef Hassan',
        },
        simulated: true,
      } satisfies NafathAuthStatusResult;
    }

    return { status: 'EXPIRED', simulated: true };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(): Promise<void> {
  return new Promise(r => setTimeout(r, 80 + Math.random() * 150));
}
