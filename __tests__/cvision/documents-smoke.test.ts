/**
 * Stage B T3 — employee documents route smoke test (file storage substitute).
 * The /api/cvision/files route uses a `cvision_files` collection that has no
 * Prisma model mapping (no-op in shim), so we instead test the documents
 * route which hits the real cvisionEmployeeDocument model.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TENANT_ID, USER_ID, makePrismaStub, makeWithAuthTenant } from './_helpers/route-smoke';

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/cvision/audit', () => ({
  logCVisionAudit: vi.fn(async () => undefined),
  createCVisionAuditContext: vi.fn(() => ({ tenantId: TENANT_ID, userId: USER_ID })),
}));
vi.mock('@/lib/cvision/infra', () => ({
  withAuthTenant: makeWithAuthTenant(),
}));

const { prisma, models, getModel } = makePrismaStub();
vi.mock('@/lib/db/prisma', () => ({ prisma }));

const { GET, POST } = await import('@/app/api/cvision/documents/route');

function makeReq(method: 'GET' | 'POST', url: string, body?: any) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Stage B T3 — documents route smoke (shim path)', () => {
  beforeEach(() => {
    Object.values(models).forEach((m) => {
      Object.values(m).forEach((fn: any) => fn.mockReset?.());
      m.findMany.mockResolvedValue([]);
      m.findFirst.mockResolvedValue(null);
      m.count.mockResolvedValue(0);
      m.create.mockImplementation(async (args: any) => args.data);
    });
    getModel('cvisionEmployeeDocument');
  });

  it('GET → 200 list with employeeId+type filters translated to Prisma where', async () => {
    models.cvisionEmployeeDocument.findMany.mockResolvedValueOnce([
      { id: 'd-1', tenantId: TENANT_ID, employeeId: 'emp-1', documentType: 'CONTRACT', title: 'Employment Contract' },
    ]);
    models.cvisionEmployeeDocument.count.mockResolvedValueOnce(1);

    const res = await GET(
      makeReq('GET', `http://localhost/api/cvision/documents?employeeId=emp-1&type=CONTRACT&page=1&limit=20`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);

    const findArgs = models.cvisionEmployeeDocument.findMany.mock.calls[0][0];
    expect(findArgs.where).toMatchObject({
      tenantId: TENANT_ID,
      employeeId: 'emp-1',
      documentType: 'CONTRACT',
    });
    expect(findArgs.skip).toBe(0);
    expect(findArgs.take).toBe(20);
  });

  it('POST → 400 when required fields missing (no Prisma call)', async () => {
    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/documents', {
        // missing employeeId, documentType, title
        fileName: 'foo.pdf',
      }),
    );
    expect(res.status).toBe(400);
    expect(models.cvisionEmployeeDocument.create).not.toHaveBeenCalled();
  });

  it('POST → 400 when documentType is unknown enum value', async () => {
    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/documents', {
        employeeId: 'emp-1',
        documentType: 'BOGUS_TYPE',
        title: 'something',
      }),
    );
    expect(res.status).toBe(400);
    expect(models.cvisionEmployeeDocument.create).not.toHaveBeenCalled();
  });

  it('POST → creates document with cleaned data; reaches Prisma.create', async () => {
    // Employee existence check passes
    getModel('cvisionEmployee').findFirst.mockResolvedValueOnce({
      id: 'emp-1',
      tenantId: TENANT_ID,
    });
    models.cvisionEmployeeDocument.create.mockImplementation(async (args: any) => ({
      ...args.data,
      id: args.data.id || 'generated',
    }));

    const res = await POST(
      makeReq('POST', 'http://localhost/api/cvision/documents', {
        employeeId: 'emp-1',
        documentType: 'CV',
        title: 'CV PDF',
        fileName: 'cv.pdf',
        fileSize: 12345,
        mimeType: 'application/pdf',
        storageKey: 'tenant/emp-1/cv.pdf',
      }),
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(models.cvisionEmployeeDocument.create).toHaveBeenCalled();
    const args = models.cvisionEmployeeDocument.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      tenantId: TENANT_ID,
      employeeId: 'emp-1',
      documentType: 'CV',
      title: 'CV PDF',
    });
    // No mongo operators leaked
    expect(Object.keys(args.data).every((k) => !k.startsWith('$'))).toBe(true);
  });
});
