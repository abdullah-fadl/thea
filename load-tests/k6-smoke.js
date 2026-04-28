/**
 * k6 Smoke Test — Thea EHR
 *
 * Validates basic operation under minimal load.
 * Run: k6 run load-tests/k6-smoke.js
 *
 * Environment variables:
 *   BASE_URL    — Target URL (default: http://localhost:3000)
 *   API_TOKEN   — JWT token for authenticated requests
 *   TENANT_ID   — Tenant ID header value
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // Smoke: just ensure nothing is broken
    http_req_failed: ['rate<0.1'],       // Less than 10% failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_TOKEN = __ENV.API_TOKEN || '';
const TENANT_ID = __ENV.TENANT_ID || '';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;
  if (TENANT_ID) headers['x-tenant-id'] = TENANT_ID;
  return headers;
}

export default function () {
  // 1. Health check (unauthenticated)
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: ok=true': (r) => {
      try { return JSON.parse(r.body).ok === true; } catch { return false; }
    },
  });

  sleep(0.5);

  // 2. Auth check (if token provided)
  if (API_TOKEN) {
    const meRes = http.get(`${BASE_URL}/api/auth/me`, { headers: authHeaders() });
    check(meRes, {
      'auth/me: status 200': (r) => r.status === 200,
      'auth/me: has userId': (r) => {
        try { return !!JSON.parse(r.body).userId; } catch { return false; }
      },
    });

    sleep(0.5);

    // 3. Patient search (authenticated)
    const searchRes = http.get(`${BASE_URL}/api/patients/search?q=test&limit=10`, {
      headers: authHeaders(),
    });
    check(searchRes, {
      'search: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });

    sleep(0.5);

    // 4. OPD queue (authenticated)
    const queueRes = http.get(`${BASE_URL}/api/opd/queue`, {
      headers: authHeaders(),
    });
    check(queueRes, {
      'queue: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    });

    sleep(0.5);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Minimal text summary for k6 (built-in since k6 v0.30)
function textSummary(data, opts) {
  const lines = ['=== Thea EHR Smoke Test Results ===\n'];
  const metrics = data.metrics;

  if (metrics.http_req_duration) {
    const d = metrics.http_req_duration.values;
    lines.push(`HTTP Duration: avg=${d.avg.toFixed(0)}ms  p95=${d['p(95)'].toFixed(0)}ms  max=${d.max.toFixed(0)}ms`);
  }

  if (metrics.http_reqs) {
    lines.push(`Total Requests: ${metrics.http_reqs.values.count}`);
  }

  if (metrics.http_req_failed) {
    const failRate = (metrics.http_req_failed.values.rate * 100).toFixed(1);
    lines.push(`Failure Rate: ${failRate}%`);
  }

  if (metrics.checks) {
    const passRate = (metrics.checks.values.rate * 100).toFixed(1);
    lines.push(`Checks Passed: ${passRate}%`);
  }

  lines.push('');
  return lines.join('\n');
}
