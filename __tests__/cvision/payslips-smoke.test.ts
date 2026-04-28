/**
 * Stage B T3 — self-service payslips route smoke test (invoices substitute).
 * Covers cvisionPayslip filter through the Mongo→Prisma shim. There is no
 * dedicated invoices route in CVision; payslips are the closest invoice-like
 * money document. Documented here as the substitution per task spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TENANT_ID, USER_ID, makePrismaStub, makeWithAuthTenant } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET } = await import('@/app/api/cvision/self-service/payslips/route');

function makeReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

describe('Stage B T3 — payslips route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
    });
    getModel('cvisionPayslip');
    getModel('cvisionEmployee');
  });

  it('GET → 200 returns sanitized payslip list; year+month filters translate via shim', async () => {
    // resolveEmployeeId: first findFirst (by id) returns null, second (by userId) returns employee
    models.cvisionEmployee.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'emp-1', tenantId: TENANT_ID, userId: USER_ID });

    models.cvisionPayslip.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        tenantId: TENANT_ID,
        employeeId: 'emp-1',
        year: 2026,
        month: 4,
        basicSalary: 5000,
        netPay: 4500,
        status: 'PAID',
      },
    ]);

    const res = await GET(makeReq(`http://localhost/api/cvision/self-service/payslips?year=2026&month=4`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('p-1');
    expect(body.data[0].year).toBe(2026);
    expect(body.data[0].month).toBe(4);

    const findArgs = models.cvisionPayslip.findMany.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      tenantId: TENANT_ID,
      employeeId: 'emp-1',
      year: 2026,
      month: 4,
    });
    expect(findArgs.take).toBe(24);
  });

  it('GET → 200 returns empty data when no payslips exist; sort order applied', async () => {
    models.cvisionEmployee.findFirst
      .mockResolvedValueOnce({ id: USER_ID, tenantId: TENANT_ID });
    models.cvisionPayslip.findMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq(`http://localhost/api/cvision/self-service/payslips`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);

    const findArgs = models.cvisionPayslip.findMany.mock.calls[0][0];
    // Mongo sort { year: -1, month: -1 } → Prisma orderBy [{year:'desc'}, {month:'desc'}]
    expect(findArgs.orderBy).toEqual([{ year: 'desc' }, { month: 'desc' }]);
  });

  it('GET → 500 propagates internal errors as JSON', async () => {
    models.cvisionEmployee.findFirst.mockRejectedValueOnce(new Error('db gone'));

    const res = await GET(makeReq(`http://localhost/api/cvision/self-service/payslips`));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
