import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import {
  ALL_REPORT_TEMPLATES,
  getTemplateById,
  getTemplatesByModality,
  type Modality,
} from '@/lib/radiology/reportTemplates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/radiology/templates
 *
 * Returns radiology report templates. Supports filtering by modality or templateId.
 *
 *   ?modality=CT       — templates for CT studies
 *   ?templateId=tmpl_* — a single template by ID
 *   (no params)        — all templates
 */
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest) => {
    const templateId = req.nextUrl.searchParams.get('templateId');
    const modality = req.nextUrl.searchParams.get('modality');

    if (templateId) {
      const template = getTemplateById(templateId);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ template });
    }

    if (modality) {
      const templates = getTemplatesByModality(modality.toUpperCase() as Modality);
      return NextResponse.json({ templates });
    }

    return NextResponse.json({ templates: ALL_REPORT_TEMPLATES });
  }),
  { tenantScoped: true, permissionKey: 'radiology.reports.view' }
);
