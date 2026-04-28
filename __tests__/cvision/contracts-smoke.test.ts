/**
 * Stage B T3 — contracts route smoke test.
 * Exercises Mongo→Prisma shim on app/api/cvision/contracts/route.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TENANT_ID, makePrismaStub, makeWithAuthTenant } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET, POST } = await import('@/app/api/cvision/contracts/route');

function makeReq(method: 'GET' | 'POST', url: string, body?: any) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Stage B T3 — contracts route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.count.mockResolvedValue(0);
    });
    // Pre-create models the tests reference
    getModel('cvisionContract');
    getModel('cvisionEmployee');
    getModel('cvisionDepartment');
  });

  it('GET → 200 list returns enriched contracts; tenantId + status $ne EXPIRED translate via shim', async () => {
    models.cvisionContract.findMany.mockResolvedValueOnce([
      {
        id: 'c-1',
        tenantId: TENANT_ID,
        employeeId: 'e-1',
        type: 'UNLIMITED',
        status: 'ACTIVE',
        basicSalary: 5000,
        createdAt: new Date(),
      },
    ]);
    // Employee enrichment
    models.cvisionEmployee.findMany.mockResolvedValueOnce([
      { id: 'e-1', tenantId: TENANT_ID, firstName: 'John', lastName: 'Doe', departmentId: 'd-1' },
    ]);
    // Department enrichment
    models.cvisionDepartment.findMany.mockResolvedValueOnce([
      { id: 'd-1', tenantId: TENANT_ID, name: 'Engineering' },
    ]);

    const res = await GET(makeReq('GET', 'http://localhost/api/cvision/contracts'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].employeeName).toBe('John Doe');
    expect(body.data[0].departmentName).toBe('Engineering');

    const findArgs = models.cvisionContract.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
    // $ne 'EXPIRED' should translate to Prisma { not: 'EXPIRED' }
    expect(findArgs.where.status).toMatchObject({ not: 'EXPIRED' });
  });

  it('GET ?action=expiring-soon → translates date range with $lte/$gte', async () => {
    models.cvisionContract.findMany.mockResolvedValueOnce([]);

    const res = await GET(
      makeReq('GET', 'http://localhost/api/cvision/contracts?action=expiring-soon'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.contracts).toEqual([]);

    const findArgs = models.cvisionContract.findMany.mock.calls[0][0];
    expect(findArgs.where.tenantId).toBe(TENANT_ID);
    expect(findArgs.where.endDate).toBeDefined();
    // shim translates $lte/$gte to Prisma lte/gte
    expect(findArgs.where.endDate.lte).toBeInstanceOf(Date);
    expect(findArgs.where.endDate.gte).toBeInstanceOf(Date);
  });

  it('GET ?action=summary&employeeId=... → 404 when no active contract', async () => {
    models.cvisionContract.findFirst.mockResolvedValueOnce(null);

    const res = await GET(
      makeReq(
        'GET',
        'http://localhost/api/cvision/contracts?action=summary&employeeId=00000000-0000-0000-0000-000000000999',
      ),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);

    const findArgs = models.cvisionContract.findFirst.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      tenantId: TENANT_ID,
      employeeId: '00000000-0000-0000-0000-000000000999',
      status: 'ACTIVE',
    });
  });

  it('POST ?action=validate → 200 validation result without DB write', async () => {
    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/contracts', {
        action: 'validate',
        type: 'UNLIMITED',
        startDate: '2026-01-01',
        basicSalary: 5000,
        housingAllowance: 1000,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(models.cvisionContract.create).not.toHaveBeenCalled();
  });
});
