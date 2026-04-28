/**
 * k6 Stress Test — Thea EHR
 *
 * Finds the breaking point by ramping to 200 VUs.
 * Run: k6 run load-tests/k6-stress.js
 *
 * Environment variables:
 *   BASE_URL    — Target URL (default: http://localhost:3000)
 *   API_TOKEN   — JWT token for authenticated requests
 *   TENANT_ID   — Tenant ID header value
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const reqDuration = new Trend('req_duration', true);

export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Warm up
    { duration: '3m', target: 50 },    // Normal load
    { duration: '3m', target: 100 },   // High load
    { duration: '3m', target: 150 },   // Very high load
    { duration: '3m', target: 200 },   // Stress: find breaking point
    { duration: '2m', target: 200 },   // Sustain stress
    { duration: '3m', target: 0 },     // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(99)<5000'],  // Even under stress, p99 < 5s
    'http_req_failed': ['rate<0.20'],      // Allow up to 20% failures under stress
    'errors': ['rate<0.20'],
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

const ENDPOINTS = [
  { path: '/api/health', auth: false, method: 'GET' },
  { path: '/api/auth/me', auth: true, method: 'GET' },
  { path: '/api/patients/search?q=a&limit=10', auth: true, method: 'GET' },
  { path: '/api/opd/queue', auth: true, method: 'GET' },
  { path: '/api/departments', auth: true, method: 'GET' },
  { path: '/api/scheduling/resources', auth: true, method: 'GET' },
];

export default function () {
  // Pick a random endpoint to stress
  const ep = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  if (ep.auth && !API_TOKEN) {
    // Only hit unauthenticated endpoints if no token
    const res = http.get(`${BASE_URL}/api/health`);
    reqDuration.add(res.timings.duration);
    const ok = check(res, { 'status < 500': (r) => r.status < 500 });
    errorRate.add(!ok);
  } else {
    const headers = ep.auth ? authHeaders() : { 'Content-Type': 'application/json' };
    const res = http.get(`${BASE_URL}${ep.path}`, { headers });
    reqDuration.add(res.timings.duration);

    const ok = check(res, {
      'status < 500': (r) => r.status < 500,
      'response time < 5s': (r) => r.timings.duration < 5000,
    });
    errorRate.add(!ok);
  }

  sleep(0.1 + Math.random() * 0.5); // Minimal think time for stress
}
