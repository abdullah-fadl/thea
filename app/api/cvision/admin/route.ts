import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Admin Settings API
 *
 * GET actions:
 *   settings        - Full tenant settings
 *   modules         - Enabled modules list
 *   custom-fields   - Custom fields (optional module filter)
 *   email-templates - Email templates
 *   system-health   - System health status
 *   usage-stats     - Usage statistics
 *   storage-usage   - Per-collection storage breakdown
 *
 * POST actions:
 *   update-settings       - Update a settings section
 *   update-branding       - Update branding colors / logo
 *   toggle-module         - Enable / disable a module
 *   add-custom-field      - Add a custom field to a module
 *   update-email-template - Update an email template
 *   update-preferences    - Update tenant preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import {
  getSettings,
  updateSettings,
  updateBranding,
  toggleModule,
  addCustomField,
  updateEmailTemplate,
  updatePreferences,
  getModules,
  getCustomFields,
  getEmailTemplates,
  getSystemHealth,
  getUsageStats,
  getStorageUsage,
} from '@/lib/cvision/admin-settings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: any) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action') || 'settings';
      const db = await getCVisionDb(tenantId);

      switch (action) {
        case 'settings': {
          const settings = await getSettings(db, tenantId);
          return NextResponse.json({ success: true, settings });
        }

        case 'modules': {
          const modules = await getModules(db, tenantId);
          return NextResponse.json({ success: true, modules });
        }

        case 'custom-fields': {
          const cvModule = searchParams.get('module') || undefined;
          const fields = await getCustomFields(db, tenantId, cvModule);
          return NextResponse.json({ success: true, fields });
        }

        case 'email-templates': {
          const templates = await getEmailTemplates(db, tenantId);
          return NextResponse.json({ success: true, templates });
        }

        case 'system-health': {
          const health = await getSystemHealth(db, tenantId);
          return NextResponse.json({ success: true, health });
        }

        case 'usage-stats': {
          const stats = await getUsageStats(db, tenantId);
          return NextResponse.json({ success: true, stats });
        }

        case 'storage-usage': {
          const storage = await getStorageUsage(db, tenantId);
          return NextResponse.json({ success: true, storage });
        }

        default:
          return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[cvision/admin GET]', err);
      return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' }
);

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }: any) => {
    try {
      const body = await request.json();
      const action = body.action;
      const db = await getCVisionDb(tenantId);

      switch (action) {
        case 'update-settings': {
          if (!body.section || !body.data) {
            return NextResponse.json({ success: false, error: 'section and data required' }, { status: 400 });
          }
          const result = await updateSettings(db, tenantId, body.section, body.data);
          return NextResponse.json({ success: true, ...result });
        }

        case 'update-branding': {
          const result = await updateBranding(db, tenantId, body);
          return NextResponse.json({ success: true, ...result });
        }

        case 'toggle-module': {
          if (!body.module || body.enabled === undefined) {
            return NextResponse.json({ success: false, error: 'module and enabled required' }, { status: 400 });
          }
          const result = await toggleModule(db, tenantId, body.module, body.enabled);
          return NextResponse.json({ success: true, ...result });
        }

        case 'add-custom-field': {
          if (!body.module) {
            return NextResponse.json({ success: false, error: 'module required' }, { status: 400 });
          }
          const result = await addCustomField(db, tenantId, body.module, body);
          return NextResponse.json({ success: true, ...result });
        }

        case 'update-email-template': {
          if (!body.event) {
            return NextResponse.json({ success: false, error: 'event required' }, { status: 400 });
          }
          const result = await updateEmailTemplate(db, tenantId, body.event, body);
          return NextResponse.json({ success: true, ...result });
        }

        case 'update-preferences': {
          const result = await updatePreferences(db, tenantId, body);
          return NextResponse.json({ success: true, ...result });
        }

        default:
          return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[cvision/admin POST]', err);
      return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' }
);
