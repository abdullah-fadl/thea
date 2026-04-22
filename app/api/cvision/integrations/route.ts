import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Integrations API
 *
 * Central API for managing all Saudi government and banking integrations.
 *
 * GET  actions: list, status, logs, test, export-file, nitaqat, verify-identity
 * POST actions: configure, toggle-mode, sync, verify-employee,
 *               generate-wps, generate-sif, generate-gosi
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSessionAndTenant, middlewareError } from '@/lib/cvision/middleware';
import { getCVisionDb, getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import { isSaudiEmployee } from '@/lib/cvision/saudi-utils';
import { calculateNitaqat } from '@/lib/cvision/gosi';
import {
  INTEGRATIONS_REGISTRY,
  FEATURE_LABELS,
  type IntegrationConfig,
  type IntegrationLog,
  type IntegrationMode,
  type IntegrationStatus,
  type IntegrationRegistryEntry,
} from '@/lib/cvision/integrations/shared/types';
import {
  getIntegrationClient,
  QiwaClient,
  YaqeenClient,
  GOSIClient,
  MudadClient,
  ZATCAClient,
} from '@/lib/cvision/integrations';
import {
  generateSIF,
  generateWPSFile,
  generateGOSIFile,
  generateInvoiceXML,
} from '@/lib/cvision/integrations/shared/file-generator';
import { calculateGOSIContribution } from '@/lib/cvision/integrations/shared/helpers';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId, userId } = authResult.data;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    // ── List all integrations ────────────────────────────────────
    if (action === 'list') {
      const db = await getCVisionDb(tenantId);
      const configsColl = db.collection<IntegrationConfig>('cvision_integration_configs');
      const saved = await configsColl.find({ tenantId }).limit(100).toArray();
      const savedMap = new Map(saved.map(c => [c.id, c]));

      const list = INTEGRATIONS_REGISTRY.map(entry => {
        const cfg = savedMap.get(entry.id);
        return {
          ...entry,
          status: cfg?.status || 'DISCONNECTED',
          mode: cfg?.mode || entry.defaultMode,
          lastSync: cfg?.lastSync || null,
          lastError: cfg?.lastError || null,
          hasCredentials: !!(cfg?.apiKey || cfg?.credentials),
          settings: cfg?.settings || {},
          configured: !!cfg,
        };
      });

      const simCount = list.filter(i => i.mode === 'SIMULATION').length;
      const fileCount = list.filter(i => i.mode === 'FILE_EXPORT').length;
      const liveCount = list.filter(i => i.mode === 'LIVE').length;
      const errorCount = list.filter(i => i.status === 'ERROR').length;

      return NextResponse.json({
        success: true,
        data: list,
        summary: {
          total: list.length,
          simulation: simCount,
          fileExport: fileCount,
          live: liveCount,
          errors: errorCount,
        },
        featureLabels: FEATURE_LABELS,
      });
    }

    // ── Quick status check ───────────────────────────────────────
    if (action === 'status') {
      const db = await getCVisionDb(tenantId);
      const configsColl = db.collection<IntegrationConfig>('cvision_integration_configs');
      const saved = await configsColl.find({ tenantId }).limit(100).toArray();
      const savedMap = new Map(saved.map(c => [c.id, c]));

      const statuses = INTEGRATIONS_REGISTRY.map(entry => {
        const cfg = savedMap.get(entry.id);
        return {
          id: entry.id,
          name: entry.name,
          status: cfg?.status || 'DISCONNECTED',
          mode: cfg?.mode || entry.defaultMode,
          lastSync: cfg?.lastSync || null,
          hasErrors: cfg?.status === 'ERROR',
        };
      });

      return NextResponse.json({ success: true, data: statuses });
    }

    // ── Integration logs ─────────────────────────────────────────
    if (action === 'logs') {
      const integrationId = searchParams.get('integrationId');
      const status = searchParams.get('status');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

      const db = await getCVisionDb(tenantId);
      const logsColl = db.collection<IntegrationLog>('cvision_integration_logs');
      const filter: any = { tenantId };
      if (integrationId) filter.integrationId = integrationId;
      if (status) filter.status = status;

      const total = await logsColl.countDocuments(filter);
      const logs = await logsColl
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        data: logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // ── Test connection ──────────────────────────────────────────
    if (action === 'test') {
      const integrationId = searchParams.get('integrationId');
      if (!integrationId) {
        return NextResponse.json({ success: false, error: 'integrationId required' }, { status: 400 });
      }

      const start = Date.now();
      try {
        const client = getIntegrationClient(integrationId, { tenantId, mode: 'SIMULATION' });
        const res = await (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).request('GET', '/health');
        const duration = Date.now() - start;

        await logAction(tenantId, integrationId, 'test', 'SUCCESS', duration);

        return NextResponse.json({
          success: true,
          data: {
            integrationId,
            connected: true,
            responseTime: duration,
            mode: 'SIMULATION',
            details: (res as any)?.data || { status: 'ok' },
          },
        });
      } catch (err: any) {
        const duration = Date.now() - start;
        await logAction(tenantId, integrationId, 'test', 'FAILED', duration, err.message);
        return NextResponse.json({
          success: true,
          data: {
            integrationId,
            connected: false,
            responseTime: duration,
            error: err.message,
          },
        });
      }
    }

    // ── Export file download ─────────────────────────────────────
    if (action === 'export-file') {
      const type = searchParams.get('type');
      const bank = searchParams.get('bank') || 'RJHI';
      const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
      const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

      const employees = await getActiveEmployees(tenantId);

      if (type === 'sif') {
        const file = generateSIF({
          companyCode: 'THEA001',
          paymentDate: `${year}-${String(month).padStart(2, '0')}-25`,
          bankCode: bank,
          employees: employees
            .filter(e => e.iban)
            .map(e => ({
              employeeId: e.employeeNo || e.employeeNumber || e.nationalId || '',
              name: e.fullNameEn || e.fullName || '',
              iban: e.iban || '',
              amount: (e.basicSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0),
            })),
        });
        return fileResponse(file.content, file.filename, file.mimeType);
      }

      if (type === 'wps') {
        const file = generateWPSFile({
          establishmentId: 'EST-001',
          month,
          year,
          employees: employees.map(e => ({
            nationalId: e.nationalId || '',
            name: e.fullNameEn || e.fullName || '',
            bank: bank,
            iban: e.iban || '',
            basicSalary: e.basicSalary || 0,
            housing: e.housingAllowance || 0,
            other: e.transportAllowance || 0,
            deductions: 0,
            netSalary: (e.basicSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0),
          })),
        });
        return fileResponse(file.content, file.filename, file.mimeType);
      }

      if (type === 'gosi') {
        const file = generateGOSIFile({
          establishmentNumber: 'GOSI-001',
          month,
          year,
          employees: employees.map(e => ({
            nationalId: e.nationalId || '',
            name: e.fullNameEn || e.fullName || '',
            isSaudi: isSaudiEmployee(e),
            basicSalary: e.basicSalary || 0,
            housing: e.housingAllowance || 0,
          })),
        });
        return fileResponse(file.content, file.filename, file.mimeType);
      }

      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 });
    }

    // ── Nitaqat calculation ──────────────────────────────────────
    if (action === 'nitaqat') {
      const employees = await getActiveEmployees(tenantId);
      const saudiCount = employees.filter(e => isSaudiEmployee(e)).length;
      const nonSaudiCount = employees.length - saudiCount;
      const nitaqat = calculateNitaqat(saudiCount, nonSaudiCount);

      const { determineNitaqatBand, NITAQAT_BAND_LABELS } = await import(
        '@/lib/cvision/integrations/qiwa/qiwa-client'
      );
      const band = determineNitaqatBand(nitaqat.saudizationPercentage);
      const labels = NITAQAT_BAND_LABELS[band];

      const visaEstimate = Math.max(0, Math.floor(saudiCount * 0.6 - nonSaudiCount));

      return NextResponse.json({
        success: true,
        data: {
          band,
          bandLabel: labels.label,
          bandColor: labels.color,
          saudizationRate: Math.round(nitaqat.saudizationPercentage * 10) / 10,
          saudiCount,
          nonSaudiCount,
          totalEmployees: employees.length,
          requiredRate: nitaqat.requiredPercentage,
          deficit: nitaqat.deficit,
          availableVisas: visaEstimate,
          status: nitaqat.status,
        },
      });
    }

    // ── Verify identity ──────────────────────────────────────────
    if (action === 'verify-identity') {
      const nationalId = searchParams.get('nationalId');
      if (!nationalId) {
        return NextResponse.json({ success: false, error: 'nationalId required' }, { status: 400 });
      }

      const client = getIntegrationClient('yaqeen', { tenantId, mode: 'SIMULATION' }) as YaqeenClient;
      const result = await client.verifyIdentity({ idNumber: nationalId });
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Integrations API GET error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSessionAndTenant(request);
    if (!authResult.success || !authResult.data) return middlewareError(authResult);

    const { tenantId, userId } = authResult.data;
    const body = await request.json();
    const { action } = body;

    // ── Configure integration ────────────────────────────────────
    if (action === 'configure') {
      const { integrationId, apiUrl, apiKey, credentials, settings, mode } = body;
      if (!integrationId) {
        return NextResponse.json({ success: false, error: 'integrationId required' }, { status: 400 });
      }

      const registry = INTEGRATIONS_REGISTRY.find(r => r.id === integrationId);
      if (!registry) {
        return NextResponse.json({ success: false, error: 'Unknown integration' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);
      const coll = db.collection<IntegrationConfig>('cvision_integration_configs');
      const now = new Date().toISOString();

      const update: any = {
        tenantId,
        id: integrationId,
        name: registry.name,
        provider: registry.provider,
        updatedAt: now,
        updatedBy: userId,
      };
      if (apiUrl !== undefined) update.apiUrl = apiUrl;
      if (apiKey !== undefined) update.apiKey = apiKey;
      if (credentials !== undefined) update.credentials = credentials;
      if (settings !== undefined) update.settings = settings;
      if (mode !== undefined) update.mode = mode;

      const result = await coll.updateOne(
        { tenantId, id: integrationId },
        {
          $set: update,
          $setOnInsert: { createdAt: now, createdBy: userId, status: 'SIMULATED' },
        },
        { upsert: true },
      );

      return NextResponse.json({ success: true, data: { updated: result.modifiedCount || result.upsertedCount } });
    }

    // ── Toggle mode ──────────────────────────────────────────────
    if (action === 'toggle-mode') {
      const { integrationId, mode } = body as { integrationId: string; mode: IntegrationMode };
      if (!integrationId || !mode) {
        return NextResponse.json({ success: false, error: 'integrationId and mode required' }, { status: 400 });
      }

      if (mode === 'LIVE') {
        const db = await getCVisionDb(tenantId);
        const coll = db.collection<IntegrationConfig>('cvision_integration_configs');
        const existing = await coll.findOne({ tenantId, id: integrationId });
        if (!existing?.apiKey && !existing?.credentials) {
          return NextResponse.json({
            success: false,
            error: 'Cannot switch to LIVE mode without API credentials. Please configure credentials first.',
          }, { status: 400 });
        }
      }

      const db = await getCVisionDb(tenantId);
      const coll = db.collection<IntegrationConfig>('cvision_integration_configs');
      const now = new Date().toISOString();
      const statusMap: Record<IntegrationMode, IntegrationStatus> = {
        LIVE: 'CONNECTED',
        SIMULATION: 'SIMULATED',
        FILE_EXPORT: 'DISCONNECTED',
      };

      await coll.updateOne(
        { tenantId, id: integrationId },
        {
          $set: { mode, status: statusMap[mode], updatedAt: now, updatedBy: userId },
          $setOnInsert: { createdAt: now, createdBy: userId },
        },
        { upsert: true },
      );

      return NextResponse.json({ success: true, data: { integrationId, mode, status: statusMap[mode] } });
    }

    // ── Sync integration ─────────────────────────────────────────
    if (action === 'sync') {
      const { integrationId } = body;
      if (!integrationId) {
        return NextResponse.json({ success: false, error: 'integrationId required' }, { status: 400 });
      }

      const start = Date.now();
      try {
        const client = getIntegrationClient(integrationId, { tenantId, mode: 'SIMULATION' });
        const res = await (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>).request('POST', '/sync');
        const duration = Date.now() - start;

        const db = await getCVisionDb(tenantId);
        await db.collection<IntegrationConfig>('cvision_integration_configs').updateOne(
          { tenantId, id: integrationId },
          { $set: { lastSync: new Date().toISOString(), status: 'SIMULATED' } },
          { upsert: true },
        );

        await logAction(tenantId, integrationId, 'sync', 'SUCCESS', duration);

        return NextResponse.json({
          success: true,
          data: { integrationId, synced: true, duration, result: (res as any)?.data },
        });
      } catch (err: any) {
        const duration = Date.now() - start;
        await logAction(tenantId, integrationId, 'sync', 'FAILED', duration, err.message);
        return NextResponse.json({
          success: true,
          data: { integrationId, synced: false, duration, error: err.message },
        });
      }
    }

    // ── Verify employee identity ─────────────────────────────────
    if (action === 'verify-employee') {
      const { employeeId } = body;
      if (!employeeId) {
        return NextResponse.json({ success: false, error: 'employeeId required' }, { status: 400 });
      }

      const db = await getCVisionDb(tenantId);
      const emp = await db.collection('cvision_employees').findOne(
        createTenantFilter(tenantId, { id: employeeId } as Record<string, unknown>),
      );
      if (!emp) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
      }

      const nationalId = emp.nationalId || emp.national_id;
      if (!nationalId) {
        return NextResponse.json({ success: false, error: 'Employee has no National ID on file' }, { status: 400 });
      }

      const client = getIntegrationClient('yaqeen', { tenantId, mode: 'SIMULATION' }) as YaqeenClient;
      const result = await client.verifyIdentity({ idNumber: nationalId });

      return NextResponse.json({ success: true, data: { employee: { id: emp.id, name: emp.fullName || emp.fullNameEn }, verification: result } });
    }

    // ── Generate WPS ─────────────────────────────────────────────
    if (action === 'generate-wps') {
      const month = body.month || new Date().getMonth() + 1;
      const year = body.year || new Date().getFullYear();
      const employees = await getActiveEmployees(tenantId);

      const file = generateWPSFile({
        establishmentId: body.establishmentId || 'EST-001',
        month,
        year,
        employees: employees.map(e => ({
          nationalId: e.nationalId || '',
          name: e.fullNameEn || e.fullName || '',
          bank: body.bank || 'RJHI',
          iban: e.iban || '',
          basicSalary: e.basicSalary || 0,
          housing: e.housingAllowance || 0,
          other: e.transportAllowance || 0,
          deductions: 0,
          netSalary: (e.basicSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0),
        })),
      });

      await logAction(tenantId, 'mudad', 'generate-wps', 'SUCCESS', 0);
      return NextResponse.json({ success: true, data: { filename: file.filename, recordCount: file.recordCount, content: file.content } });
    }

    // ── Generate SIF ─────────────────────────────────────────────
    if (action === 'generate-sif') {
      const bank = body.bank || 'RJHI';
      const employees = await getActiveEmployees(tenantId);

      const file = generateSIF({
        companyCode: body.companyCode || 'THEA001',
        paymentDate: body.paymentDate || new Date().toISOString().slice(0, 10),
        bankCode: bank,
        employees: employees
          .filter(e => e.iban)
          .map(e => ({
            employeeId: e.employeeNo || e.employeeNumber || e.nationalId || '',
            name: e.fullNameEn || e.fullName || '',
            iban: e.iban || '',
            amount: (e.basicSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0),
          })),
      });

      await logAction(tenantId, 'banks', 'generate-sif', 'SUCCESS', 0);
      return NextResponse.json({ success: true, data: { filename: file.filename, recordCount: file.recordCount, content: file.content } });
    }

    // ── Generate GOSI ────────────────────────────────────────────
    if (action === 'generate-gosi') {
      const month = body.month || new Date().getMonth() + 1;
      const year = body.year || new Date().getFullYear();
      const employees = await getActiveEmployees(tenantId);

      const file = generateGOSIFile({
        establishmentNumber: body.establishmentNumber || 'GOSI-001',
        month,
        year,
        employees: employees.map(e => ({
          nationalId: e.nationalId || '',
          name: e.fullNameEn || e.fullName || '',
          isSaudi: isSaudiEmployee(e),
          basicSalary: e.basicSalary || 0,
          housing: e.housingAllowance || 0,
        })),
      });

      const gosiDetails = employees.map(e => {
        const saudi = isSaudiEmployee(e);
        const contrib = calculateGOSIContribution(e.basicSalary || 0, e.housingAllowance || 0, saudi);
        return {
          name: e.fullNameEn || e.fullName || '',
          nationalId: e.nationalId || '',
          isSaudi: saudi,
          ...contrib,
        };
      });
      const totalEmployer = gosiDetails.reduce((s, d) => s + d.employerContribution, 0);
      const totalEmployee = gosiDetails.reduce((s, d) => s + d.employeeContribution, 0);

      await logAction(tenantId, 'gosi', 'generate-gosi', 'SUCCESS', 0);
      return NextResponse.json({
        success: true,
        data: {
          filename: file.filename,
          recordCount: file.recordCount,
          content: file.content,
          details: gosiDetails,
          summary: {
            totalEmployer: Math.round(totalEmployer * 100) / 100,
            totalEmployee: Math.round(totalEmployee * 100) / 100,
            total: Math.round((totalEmployer + totalEmployee) * 100) / 100,
          },
        },
      });
    }

    // ── Seed initial configs ─────────────────────────────────────
    if (action === 'seed') {
      const db = await getCVisionDb(tenantId);
      const coll = db.collection<IntegrationConfig>('cvision_integration_configs');
      const existing = await coll.countDocuments({ tenantId });
      if (existing > 0) {
        return NextResponse.json({ success: true, data: { seeded: false, existing } });
      }

      const now = new Date().toISOString();
      const docs: IntegrationConfig[] = INTEGRATIONS_REGISTRY.map(entry => ({
        id: entry.id,
        tenantId,
        name: entry.name,
        provider: entry.provider,
        status: entry.defaultMode === 'SIMULATION' ? 'SIMULATED' as const : 'DISCONNECTED' as const,
        mode: entry.defaultMode,
        settings: {},
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      }));

      await coll.insertMany(docs);
      return NextResponse.json({ success: true, data: { seeded: true, count: docs.length } });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    logger.error('Integrations API POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EmployeeDoc {
  nationalId?: string;
  national_id?: string;
  nationality?: string;
  isSaudi?: boolean;
  iqamaNumber?: string;
  fullName?: string;
  fullNameEn?: string;
  employeeNumber?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  iban?: string;
  status?: string;
  [key: string]: any;
}

async function getActiveEmployees(tenantId: string): Promise<EmployeeDoc[]> {
  const db = await getCVisionDb(tenantId);
  const coll = db.collection<EmployeeDoc>('cvision_employees');
  return coll
    .find({
      tenantId,
      $or: [
        { status: 'ACTIVE' },
        { status: { $exists: false } },
        { deletedAt: null },
      ],
    } as Record<string, unknown>)
    .toArray();
}

async function logAction(
  tenantId: string,
  integrationId: string,
  action: string,
  status: 'SUCCESS' | 'FAILED' | 'PENDING',
  duration: number,
  error?: string,
) {
  try {
    const db = await getCVisionDb(tenantId);
    await db.collection<IntegrationLog>('cvision_integration_logs').insertOne({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      integrationId,
      action,
      status,
      duration,
      error,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Logging failure should not break the main operation
  }
}

function fileResponse(content: string, filename: string, mimeType: string) {
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
