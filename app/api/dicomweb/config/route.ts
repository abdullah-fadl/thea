import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
} from '@/lib/dicomweb/sources';
import { testConnection } from '@/lib/dicomweb/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET — list DICOM sources for this tenant
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const sources = await listSources(tenantId);

    // Strip credentials from response for security
    const safe = sources.map((s) => ({ ...s, credentials: undefined }));
    return NextResponse.json({ sources: safe });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);

// ---------------------------------------------------------------------------
// POST — create or test a DICOM source
// ---------------------------------------------------------------------------

const createSchema = z.object({
  action: z.enum(['create', 'test', 'update', 'delete']).default('create'),

  // For create/update
  name: z.string().min(1).optional(),
  type: z.enum(['orthanc', 'dcm4chee', 'google_health', 'custom']).optional(),
  baseUrl: z.string().url().optional(),
  authType: z.enum(['none', 'basic', 'bearer', 'apikey']).optional(),
  credentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
    apiKey: z.string().optional(),
  }).optional(),
  isDefault: z.boolean().optional(),

  // For update/delete/test
  sourceId: z.string().optional(),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, createSchema);
    if ('error' in v) return v.error;

    const { action, sourceId, ...fields } = v.data;

    // ---- TEST ----
    if (action === 'test') {
      let source;
      if (sourceId) {
        source = await getSource(tenantId, sourceId);
        if (!source) {
          return NextResponse.json({ error: 'Source not found' }, { status: 404 });
        }
      } else if (fields.baseUrl) {
        // Test with ad-hoc config (before saving)
        source = {
          id: 'test',
          name: 'test',
          type: fields.type || 'custom' as const,
          baseUrl: fields.baseUrl,
          authType: fields.authType || 'none' as const,
          credentials: fields.credentials,
          isDefault: false,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        return NextResponse.json({ error: 'sourceId or baseUrl required for test' }, { status: 400 });
      }

      const result = await testConnection(source);
      return NextResponse.json({ test: result });
    }

    // ---- CREATE ----
    if (action === 'create') {
      if (!fields.name || !fields.baseUrl || !fields.type || !fields.authType) {
        return NextResponse.json({ error: 'name, type, baseUrl, and authType are required' }, { status: 400 });
      }
      const source = await createSource(tenantId, {
        name: fields.name,
        type: fields.type,
        baseUrl: fields.baseUrl,
        authType: fields.authType,
        credentials: fields.credentials,
        isDefault: fields.isDefault,
      });
      return NextResponse.json({ success: true, source: { ...source, credentials: undefined } });
    }

    // ---- UPDATE ----
    if (action === 'update') {
      if (!sourceId) {
        return NextResponse.json({ error: 'sourceId required for update' }, { status: 400 });
      }
      const ok = await updateSource(tenantId, sourceId, fields);
      if (!ok) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    // ---- DELETE ----
    if (action === 'delete') {
      if (!sourceId) {
        return NextResponse.json({ error: 'sourceId required for delete' }, { status: 400 });
      }
      const ok = await deleteSource(tenantId, sourceId);
      if (!ok) {
        return NextResponse.json({ error: 'Source not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }),
  { tenantScoped: true, permissionKey: 'admin.settings' },
);
