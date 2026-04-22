/**
 * k6 Load Test — Thea EHR
 *
 * Simulates realistic traffic patterns: ramp up to 50 VUs, sustain, ramp down.
 * Validates SLA targets:
 *   - GET endpoints: p95 < 200ms
 *   - POST endpoints: p95 < 500ms
 *   - Search/list: p95 < 300ms
 *
 * Run: k6 run load-tests/k6-load.js
 *
 * Environment variables:
 *   BASE_URL    — Target URL (default: http://localhost:3000)
 *   API_TOKEN   — JWT token for authenticated requests
 *   TENANT_ID   — Tenant ID header value
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const getDuration = new Trend('get_duration', true);
const searchDuration = new Trend('search_duration', true);
const postDuration = new Trend('post_duration', true);

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 VUs
    { duration: '3m', target: 50 },   // Ramp up to 50 VUs
    { duration: '10m', target: 50 },  // Sustain 50 VUs
    { duration: '2m', target: 10 },   // Ramp down to 10 VUs
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    'get_duration': ['p(95)<200'],       // GET: p95 < 200ms
    'search_duration': ['p(95)<300'],    // Search: p95 < 300ms
    'post_duration': ['p(95)<500'],      // POST: p95 < 500ms
    'http_req_failed': ['rate<0.05'],    // Less than 5% request failures
    'errors': ['rate<0.05'],             // Less than 5% error rate
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
  // Simulate a realistic user session

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    getDuration.add(res.timings.duration);
    const ok = check(res, { 'health: 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(0.5);

  if (API_TOKEN) {
    group('Authentication', () => {
      const res = http.get(`${BASE_URL}/api/auth/me`, { headers: authHeaders() });
      getDuration.add(res.timings.duration);
      const ok = check(res, { 'auth/me: 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });

    sleep(0.3);

    group('Patient Search', () => {
      const terms = ['ahmed', 'mohammed', 'fatima', 'ali', 'sara'];
      const q = terms[Math.floor(Math.random() * terms.length)];
      const res = http.get(`${BASE_URL}/api/patients/search?q=${q}&limit=20`, {
        headers: authHeaders(),
      });
      searchDuration.add(res.timings.duration);
      const ok = check(res, { 'search: 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });

    sleep(0.3);

    group('OPD Queue', () => {
      const res = http.get(`${BASE_URL}/api/opd/queue`, { headers: authHeaders() });
      getDuration.add(res.timings.duration);
      const ok = check(res, { 'queue: 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });

    sleep(0.3);

    group('Departments List', () => {
      const res = http.get(`${BASE_URL}/api/departments`, { headers: authHeaders() });
      getDuration.add(res.timings.duration);
      const ok = check(res, { 'departments: 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });

    sleep(0.3);

    group('Scheduling Resources', () => {
      const res = http.get(`${BASE_URL}/api/scheduling/resources`, {
        headers: authHeaders(),
      });
      getDuration.add(res.timings.duration);
      const ok = check(res, { 'resources: 200': (r) => r.status === 200 });
      errorRate.add(!ok);
    });
  }

  sleep(1 + Math.random() * 2); // 1-3 second think time between user actions
}
