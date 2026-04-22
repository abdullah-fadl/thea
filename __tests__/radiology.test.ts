/**
 * Radiology / DICOM Module Tests — Thea EHR
 *
 * 20 scenarios covering:
 *   1-3   DICOM Source Config
 *   4-6   QIDO-RS Search
 *   7-8   WADO-RS Retrieve
 *   9-10  STOW-RS Upload
 *   11-14 Radiology Orders
 *   15-17 Reports
 *   18-19 Templates
 *   20    Route Wiring
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ---------------------------------------------------------------------------
// Lib-level imports (safe — no side effects, no DB calls)
// ---------------------------------------------------------------------------

import {
  DICOM_TAGS,
  type DicomSource,
  type DicomStudy,
  type DicomSeries,
  type DicomInstance,
  type DicomSourceType,
  type DicomAuthType,
} from '@/lib/dicomweb/types';

import {
  resolveImageIds,
  resolveMultiFrameImageIds,
} from '@/lib/dicomweb/imageIdResolver';

import {
  isValidTransition,
  getNextStatuses,
  actionToStatus,
  VALID_TRANSITIONS,
  STUDY_STATUS_LABELS,
  type StudyStatus,
} from '@/lib/radiology/studyStatus';

import {
  ALL_REPORT_TEMPLATES,
  getTemplateById,
  getTemplatesByModality,
  getTemplatesByBodyPart,
  type ReportTemplate,
  type Modality,
} from '@/lib/radiology/reportTemplates';

// ===================================================================
// 1. DICOM Source Config (tests 1-3)
// ===================================================================

describe('DICOM Source Config', () => {
  const configRoute = readRoute('app', 'api', 'dicomweb', 'config', 'route.ts');

  // ---- Test 1 ----
  it('1 — Config route POST supports create/test/update/delete actions via Zod enum', () => {
    // The route defines a Zod schema with action enum
    expect(configRoute).toContain("z.enum(['create', 'test', 'update', 'delete'])");
    // Each action branch is present
    expect(configRoute).toContain("action === 'create'");
    expect(configRoute).toContain("action === 'test'");
    expect(configRoute).toContain("action === 'update'");
    expect(configRoute).toContain("action === 'delete'");
  });

  // ---- Test 2 ----
  it('2 — Config route requires admin.settings permission', () => {
    // Both GET and POST must be guarded with admin.settings
    const matches = configRoute.match(/permissionKey:\s*'admin\.settings'/g);
    expect(matches).not.toBeNull();
    // Two occurrences: one for GET, one for POST
    expect(matches!.length).toBe(2);
  });

  // ---- Test 3 ----
  it('3 — GET response strips credentials from DICOM sources', () => {
    // The GET handler maps sources to remove credentials
    expect(configRoute).toContain('credentials: undefined');
    // Also strips credentials on the POST create success response
    const credentialStrips = configRoute.match(/credentials:\s*undefined/g);
    expect(credentialStrips).not.toBeNull();
    expect(credentialStrips!.length).toBeGreaterThanOrEqual(2);
  });
});

// ===================================================================
// 2. QIDO-RS Search (tests 4-6)
// ===================================================================

describe('QIDO-RS Search', () => {
  // ---- Test 4 ----
  it('4 — Studies search route proxies to PACS via searchStudies client', () => {
    const studiesRoute = readRoute('app', 'api', 'dicomweb', 'studies', 'route.ts');
    // Imports searchStudies from dicomweb client
    expect(studiesRoute).toContain("import { searchStudies } from '@/lib/dicomweb/client'");
    // Calls searchStudies with the resolved source and forwarded params
    expect(studiesRoute).toContain('searchStudies(source, qidoParams)');
    // Uses radiology.view permission
    expect(studiesRoute).toContain("permissionKey: 'radiology.view'");
  });

  // ---- Test 5 ----
  it('5 — Series route requires studyUID and returns 400 when missing', () => {
    const seriesRoute = readRoute(
      'app', 'api', 'dicomweb', 'studies', '[studyUID]', 'series', 'route.ts',
    );
    // Guard for missing studyUID
    expect(seriesRoute).toContain('studyUID is required');
    expect(seriesRoute).toContain('status: 400');
    // Calls listSeries from client
    expect(seriesRoute).toContain("import { listSeries } from '@/lib/dicomweb/client'");
    expect(seriesRoute).toContain('listSeries(source, studyUID)');
  });

  // ---- Test 6 ----
  it('6 — Instances route returns imageIds array with wadors: prefix', () => {
    const instancesRoute = readRoute(
      'app', 'api', 'dicomweb', 'studies', '[studyUID]', 'series', '[seriesUID]', 'instances', 'route.ts',
    );
    // Imports resolveImageIds
    expect(instancesRoute).toContain("import { resolveImageIds } from '@/lib/dicomweb/imageIdResolver'");
    // Uses the proxy base URL for wadors
    expect(instancesRoute).toContain("'/api/dicomweb/wado'");
    // Response includes imageIds
    expect(instancesRoute).toContain('imageIds');
    // Verify the resolver actually produces wadors: prefixed strings
    const fakeInstances: DicomInstance[] = [
      { sopInstanceUID: '1.2.3.4', instanceNumber: 1 },
    ];
    const ids = resolveImageIds('/api/dicomweb/wado', '1.2.840.1', '1.2.840.2', fakeInstances);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^wadors:/);
    expect(ids[0]).toContain('/api/dicomweb/wado/studies/1.2.840.1/series/1.2.840.2/instances/1.2.3.4/frames/1');
  });
});

// ===================================================================
// 3. WADO-RS Retrieve (tests 7-8)
// ===================================================================

describe('WADO-RS Retrieve', () => {
  const wadoRoute = readRoute('app', 'api', 'dicomweb', 'wado', 'route.ts');

  // ---- Test 7 ----
  it('7 — WADO proxy route exists and streams pixel data pass-through', () => {
    // Verifies the file exports a GET handler
    expect(wadoRoute).toContain('export const GET');
    // Passes upstream body through as NextResponse stream
    expect(wadoRoute).toContain('new NextResponse(upstream.body');
    // Sets Content-Type from upstream response
    expect(wadoRoute).toContain("upstream.headers.get('Content-Type')");
    // Extracts DICOMWeb path after /wado/
    expect(wadoRoute).toContain('/api/dicomweb/wado/');
  });

  // ---- Test 8 ----
  it('8 — WADO proxy builds auth headers from source config for basic/bearer/apikey', () => {
    // The route inline-builds auth headers based on source.authType
    expect(wadoRoute).toContain("case 'basic'");
    expect(wadoRoute).toContain("case 'bearer'");
    expect(wadoRoute).toContain("case 'apikey'");
    // Verifies basic auth uses Buffer.from for base64
    expect(wadoRoute).toContain('Buffer.from');
    expect(wadoRoute).toContain("'Authorization'");
    expect(wadoRoute).toContain("'X-API-Key'");
  });
});

// ===================================================================
// 4. STOW-RS Upload (tests 9-10)
// ===================================================================

describe('STOW-RS Upload', () => {
  const stowRoute = readRoute('app', 'api', 'dicomweb', 'stow', 'route.ts');

  // ---- Test 9 ----
  it('9 — STOW route accepts body via arrayBuffer and forwards Content-Type', () => {
    // Reads request body as arrayBuffer and converts to Buffer
    expect(stowRoute).toContain('req.arrayBuffer()');
    expect(stowRoute).toContain('Buffer.from');
    // Reads Content-Type from request
    expect(stowRoute).toContain("req.headers.get('Content-Type')");
    // Calls storeInstances from client
    expect(stowRoute).toContain("import { storeInstances } from '@/lib/dicomweb/client'");
    expect(stowRoute).toContain('storeInstances(source, bodyBuffer, contentType)');
    // Returns 400 if no Content-Type header
    expect(stowRoute).toContain("'Content-Type header is required'");
  });

  // ---- Test 10 ----
  it('10 — STOW route requires radiology.orders.create permission', () => {
    expect(stowRoute).toContain("permissionKey: 'radiology.orders.create'");
  });
});

// ===================================================================
// 5. Radiology Orders (tests 11-14)
// ===================================================================

describe('Radiology Orders', () => {
  const studiesRoute = readRoute('app', 'api', 'radiology', 'studies', 'route.ts');

  // ---- Test 11 ----
  it('11 — POST creates order in orders_hub with kind=RADIOLOGY', () => {
    // The POST handler writes to prisma.ordersHub.create
    expect(studiesRoute).toContain('prisma.ordersHub.create');
    expect(studiesRoute).toContain("kind: 'RADIOLOGY'");
    expect(studiesRoute).toContain("departmentKey: 'radiology'");
    // Initial status is ORDERED
    expect(studiesRoute).toContain("status: 'ORDERED'");
  });

  // ---- Test 12 ----
  it('12 — Study status workflow: ORDERED->SCHEDULED->IN_PROGRESS->COMPLETED->REPORTED->VERIFIED', () => {
    // Verify the full forward chain from studyStatus lib
    const chain: StudyStatus[] = ['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REPORTED', 'VERIFIED'];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(isValidTransition(chain[i], chain[i + 1])).toBe(true);
    }
    // VERIFIED is terminal
    expect(getNextStatuses('VERIFIED')).toEqual([]);
    // CANCELLED is also terminal
    expect(getNextStatuses('CANCELLED')).toEqual([]);
    // Cannot go backwards
    expect(isValidTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(isValidTransition('REPORTED', 'COMPLETED')).toBe(false);
  });

  // ---- Test 13 ----
  it('13 — Worklist filters by status and defaults to ORDERED,SCHEDULED,IN_PROGRESS', () => {
    const worklistRoute = readRoute('app', 'api', 'radiology', 'worklist', 'route.ts');
    // Default statuses
    expect(worklistRoute).toContain("'ORDERED,SCHEDULED,IN_PROGRESS'");
    // Parses comma-separated status param
    expect(worklistRoute).toContain("statusParam.split(',')");
    // Uses Prisma { in: statuses } filter
    expect(worklistRoute).toContain('status: { in: statuses }');
    // Also filters by modality
    expect(worklistRoute).toContain("modality");
    expect(worklistRoute).toContain("modality.toUpperCase()");
  });

  // ---- Test 14 ----
  it('14 — Accession number is auto-generated with RAD- prefix and date stamp', () => {
    // The POST handler generates accession numbers in RAD-YYYYMMDD-XXXXXX format
    expect(studiesRoute).toContain('`RAD-${now.getFullYear()}');
    expect(studiesRoute).toContain('nanoid(6)');
    expect(studiesRoute).toContain('.toUpperCase()');
    // Stored in meta.accessionNumber
    expect(studiesRoute).toContain('accessionNumber');
  });
});

// ===================================================================
// 6. Reports (tests 15-17)
// ===================================================================

describe('Reports', () => {
  const reportSaveRoute = readRoute('app', 'api', 'radiology', 'reports', 'save', 'route.ts');
  const reportsRoute = readRoute('app', 'api', 'radiology', 'reports', 'route.ts');

  // ---- Test 15 ----
  it('15 — Report save requires orderId + findings + impression via Zod schema', () => {
    // Zod schema validates required fields
    expect(reportSaveRoute).toContain("orderId: z.string().min(1, 'orderId is required')");
    expect(reportSaveRoute).toContain("findings: z.string().min(1, 'findings is required')");
    expect(reportSaveRoute).toContain("impression: z.string().min(1, 'impression is required')");
    // Also supports optional bilingual fields
    expect(reportSaveRoute).toContain('findingsAr: z.string().optional()');
    expect(reportSaveRoute).toContain('impressionAr: z.string().optional()');
  });

  // ---- Test 16 ----
  it('16 — Report save updates orders_hub status to REPORTED when report status is COMPLETED', () => {
    // When report status is COMPLETED, order status becomes REPORTED
    expect(reportSaveRoute).toContain("status === 'COMPLETED' ? 'REPORTED'");
    // Updates orders_hub
    expect(reportSaveRoute).toContain('prisma.ordersHub.update');
    expect(reportSaveRoute).toContain('status: orderStatus');
    // Also checks payment gate before allowing save
    expect(reportSaveRoute).toContain('checkOrderPayment');
    expect(reportSaveRoute).toContain("status: 402");
  });

  // ---- Test 17 ----
  it('17 — Report query filters by orderId, patientId, status, and modality', () => {
    // GET handler reads filter params
    expect(reportsRoute).toContain("req.nextUrl.searchParams.get('orderId')");
    expect(reportsRoute).toContain("req.nextUrl.searchParams.get('patientId')");
    expect(reportsRoute).toContain("req.nextUrl.searchParams.get('status')");
    expect(reportsRoute).toContain("req.nextUrl.searchParams.get('modality')");
    // Applies them to Prisma where
    expect(reportsRoute).toContain('where.orderId = orderId');
    expect(reportsRoute).toContain('where.patientId = patientId');
    expect(reportsRoute).toContain('where.status = status');
    expect(reportsRoute).toContain('where.modality = modality.toUpperCase()');
  });
});

// ===================================================================
// 7. Templates (tests 18-19)
// ===================================================================

describe('Templates', () => {
  // ---- Test 18 ----
  it('18 — Templates contain bilingual content (en + ar) for templateName and sections', () => {
    for (const tmpl of ALL_REPORT_TEMPLATES) {
      // templateName must have both languages
      expect(tmpl.templateName).toHaveProperty('ar');
      expect(tmpl.templateName).toHaveProperty('en');
      expect(tmpl.templateName.ar.length).toBeGreaterThan(0);
      expect(tmpl.templateName.en.length).toBeGreaterThan(0);

      // Every section must have bilingual title and defaultText
      for (const section of tmpl.sections) {
        expect(section.title).toHaveProperty('ar');
        expect(section.title).toHaveProperty('en');
        expect(section.defaultText).toHaveProperty('ar');
        expect(section.defaultText).toHaveProperty('en');
      }
    }
  });

  // ---- Test 19 ----
  it('19 — Exactly 6 built-in templates: chest_xr, abd_us, ct_head, ct_chest, mri_brain, mri_lumbar', () => {
    expect(ALL_REPORT_TEMPLATES).toHaveLength(6);

    const expectedIds = [
      'tmpl_chest_xr',
      'tmpl_abd_us',
      'tmpl_ct_head',
      'tmpl_ct_chest',
      'tmpl_mri_brain',
      'tmpl_mri_lumbar',
    ];
    const actualIds = ALL_REPORT_TEMPLATES.map((t) => t.id);
    expect(actualIds).toEqual(expectedIds);

    // Each template is retrievable by ID
    for (const id of expectedIds) {
      const found = getTemplateById(id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(id);
    }

    // Modality filtering works
    const ctTemplates = getTemplatesByModality('CT');
    expect(ctTemplates).toHaveLength(2);
    expect(ctTemplates.map((t) => t.id).sort()).toEqual(['tmpl_ct_chest', 'tmpl_ct_head']);

    const mriTemplates = getTemplatesByModality('MRI');
    expect(mriTemplates).toHaveLength(2);
    expect(mriTemplates.map((t) => t.id).sort()).toEqual(['tmpl_mri_brain', 'tmpl_mri_lumbar']);
  });
});

// ===================================================================
// 8. Route Wiring (test 20)
// ===================================================================

describe('Route Wiring', () => {
  // ---- Test 20 ----
  it('20 — All radiology and dicomweb routes use withAuthTenant + withErrorHandler', () => {
    const routePaths = [
      ['app', 'api', 'dicomweb', 'config', 'route.ts'],
      ['app', 'api', 'dicomweb', 'studies', 'route.ts'],
      ['app', 'api', 'dicomweb', 'studies', '[studyUID]', 'series', 'route.ts'],
      ['app', 'api', 'dicomweb', 'studies', '[studyUID]', 'series', '[seriesUID]', 'instances', 'route.ts'],
      ['app', 'api', 'dicomweb', 'wado', 'route.ts'],
      ['app', 'api', 'dicomweb', 'stow', 'route.ts'],
      ['app', 'api', 'radiology', 'studies', 'route.ts'],
      ['app', 'api', 'radiology', 'worklist', 'route.ts'],
      ['app', 'api', 'radiology', 'reports', 'route.ts'],
      ['app', 'api', 'radiology', 'reports', 'save', 'route.ts'],
      ['app', 'api', 'radiology', 'templates', 'route.ts'],
    ];

    for (const segments of routePaths) {
      const src = readRoute(...segments);
      const routeLabel = segments.join('/');

      // Must import and use withAuthTenant
      expect(src, `${routeLabel} must import withAuthTenant`).toContain(
        "import { withAuthTenant } from '@/lib/core/guards/withAuthTenant'",
      );

      // Must import and use withErrorHandler
      expect(src, `${routeLabel} must import withErrorHandler`).toContain(
        "import { withErrorHandler } from '@/lib/core/errors'",
      );

      // Every exported handler must be wrapped (at least one withAuthTenant call present)
      expect(src, `${routeLabel} must call withAuthTenant`).toMatch(/withAuthTenant\(/);
      expect(src, `${routeLabel} must call withErrorHandler`).toMatch(/withErrorHandler\(/);

      // Must be tenant-scoped
      expect(src, `${routeLabel} must be tenantScoped`).toContain('tenantScoped: true');
    }
  });
});
