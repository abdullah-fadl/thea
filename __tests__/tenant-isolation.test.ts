/**
 * Tenant Isolation Sanity Check Tests
 * 
 * These tests verify that:
 * 1. tenantId is always read from authenticated session only
 * 2. Requests fail with 401 if session is missing
 * 3. tenantId is never read from query params, body, or env vars
 */

import { NextRequest } from 'next/server';
import { requireTenantId } from '@/lib/tenant';

describe('Tenant Isolation Sanity Checks', () => {
  describe('requireTenantId', () => {
    it('should return 401 if session is missing', async () => {
      // Create a request without auth cookie
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const result = await requireTenantId(request);

      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(401);
        const json = await result.json();
        expect(json.error).toBe('Unauthorized');
        expect(json.message).toContain('Tenant not selected');
      }
    });

    it('should not read tenantId from query params', async () => {
      // Create a request with tenantId in query but no session
      const request = new NextRequest('http://localhost:3000/api/test?tenantId=malicious-tenant', {
        method: 'GET',
      });

      const result = await requireTenantId(request);

      // Should still return 401, not use query param
      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(401);
      }
    });

    it('should not read tenantId from request body', async () => {
      // Create a request with tenantId in body but no session
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'malicious-tenant' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await requireTenantId(request);

      // Should still return 401, not use body param
      expect(result).toBeInstanceOf(Response);
      if (result instanceof Response) {
        expect(result.status).toBe(401);
      }
    });
  });

  describe('Code Verification', () => {
    it('should verify requireTenantId uses getActiveTenantId from session', () => {
      // This is a static check - we verify the implementation
      // by reading the source code
      const fs = require('fs');
      const path = require('path');
      
      const tenantHelperPath = path.join(process.cwd(), 'lib', 'tenant.ts');
      const code = fs.readFileSync(tenantHelperPath, 'utf-8');

      // Verify it imports getActiveTenantId
      expect(code).toContain('getActiveTenantId');
      expect(code).toContain('from \'@/lib/auth/sessionHelpers\'');

      // Verify it does NOT use env vars
      expect(code).not.toContain('THEA_ENGINE_TENANT_ID');
      expect(code).not.toContain('env.THEA_ENGINE');

      // Verify it does NOT read from query params
      expect(code).not.toContain('searchParams.get');
      expect(code).not.toContain('url.searchParams');

      // Verify it does NOT read from body
      expect(code).not.toContain('request.json()');
      expect(code).not.toContain('request.body');
    });
  });
});

