import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionDb } from '@/lib/cvision/db';
import { requireCtx } from '@/lib/cvision/authz/enforce';

export const dynamic = 'force-dynamic';

interface SearchResult { module: string; id: string; title: string; subtitle: string; link: string; }

const SEARCH_CONFIG: { module: string; collection: string; fields: string[]; titleField: string; subtitleField: string; linkPrefix: string; perm?: string }[] = [
  { module: 'employees', collection: 'cvision_employees', fields: ['name', 'nameAr', 'nameEn', 'employeeNo', 'nationalId', 'email', 'phone', 'jobTitle'], titleField: 'name||nameEn', subtitleField: 'jobTitle', linkPrefix: '/cvision/employees/' },
  { module: 'departments', collection: 'cvision_departments', fields: ['name', 'nameEn', 'nameAr'], titleField: 'name||nameEn', subtitleField: 'nameAr', linkPrefix: '/cvision/organization' },
  { module: 'training', collection: 'cvision_training_courses', fields: ['title', 'titleAr', 'courseId'], titleField: 'title', subtitleField: 'status', linkPrefix: '/cvision/training' },
  { module: 'policies', collection: 'cvision_policies', fields: ['title', 'titleAr'], titleField: 'title', subtitleField: 'status', linkPrefix: '/cvision/policies' },
  { module: 'announcements', collection: 'cvision_announcements', fields: ['title', 'titleAr'], titleField: 'title', subtitleField: 'type', linkPrefix: '/cvision/announcements' },
  { module: 'assets', collection: 'cvision_assets', fields: ['name', 'nameAr', 'serialNumber', 'assetId'], titleField: 'name', subtitleField: 'category', linkPrefix: '/cvision/assets' },
  { module: 'letters', collection: 'cvision_letters', fields: ['titleEn', 'titleAr', 'letterId', 'employeeName'], titleField: 'titleEn||letterId', subtitleField: 'status', linkPrefix: '/cvision/letters' },
  { module: 'grievances', collection: 'cvision_grievances', fields: ['subject', 'grievanceId'], titleField: 'subject', subtitleField: 'status', linkPrefix: '/cvision/grievances', perm: 'cvision.grievances.read' },
];

function getField(doc: any, spec: string): string {
  const parts = spec.split('||');
  for (const p of parts) { if (doc[p]) return String(doc[p]); }
  return '';
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const db = await getCVisionDb(tenantId);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const scope = searchParams.get('scope') || '';

  if (!q || q.length < 2) return NextResponse.json({ ok: true, data: [] });

  const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedQ, 'i');
  const configs = scope ? SEARCH_CONFIG.filter(c => c.module === scope) : SEARCH_CONFIG;

  const results: SearchResult[] = [];

  await Promise.all(configs.map(async (cfg) => {
    try {
      const col = db.collection(cfg.collection);
      const orConditions = cfg.fields.map(f => ({ [f]: regex }));
      const docs = await col.find({ tenantId, $or: orConditions }).limit(5).toArray();
      for (const doc of docs) {
        const d = doc as any;
        const id = d.employeeId || d.departmentId || d.courseId || d.policyId || d.announcementId || d.assetId || d.letterId || d.grievanceId || d._id?.toString() || '';
        results.push({
          module: cfg.module, id,
          title: getField(d, cfg.titleField) || id,
          subtitle: getField(d, cfg.subtitleField),
          link: `${cfg.linkPrefix}${cfg.linkPrefix.endsWith('/') ? id : ''}`,
        });
      }
    } catch { /* collection may not exist yet */ }
  }));

  return NextResponse.json({ ok: true, data: results, query: q });
});
