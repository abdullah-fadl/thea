import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import { getCVisionCollection } from '@/lib/cvision/db';
import { CVISION_PERMISSIONS, CVISION_ROLE_PERMISSIONS } from '@/lib/cvision/constants';
import { requireCtx, deny } from '@/lib/cvision/authz/enforce';
import { logCVisionAudit, createCVisionAuditContext } from '@/lib/cvision/audit';

const settingsPostSchema = z.object({
  action: z.enum(['update']),
}).passthrough();

export const dynamic = 'force-dynamic';

function defaultSettings(tenantId: string) {
  return {
    tenantId,
    settings: {
      company: { nameEn: '', nameAr: '', commercialRegistration: '', vatNumber: '', molNumber: '', gosiNumber: '', phone: '', email: '', address: '', logo: '', letterhead: '' },
      preferences: { language: 'both', dateFormat: 'DD/MM/YYYY', calendarType: 'both', currency: 'SAR', timezone: 'Asia/Riyadh', fiscalYearStart: '01-01', weekStartDay: 'sunday', workingDays: ['sunday','monday','tuesday','wednesday','thursday'], workingHours: { start: '08:00', end: '17:00' } },
      notifications: { emailEnabled: true, smsEnabled: false, smsProvider: 'unifonic', reminderDays: [90, 30, 7, 1] },
      retention: { auditLogDays: 365, notificationDays: 90 },
      customFields: {},
      customDropdowns: {},
    },
    branding: { primaryColor: '#2563eb', secondaryColor: '#1e40af', darkMode: false },
    modules: { recruitment: true, payroll: true, attendance: true, leaves: true, loans: true, training: true, insurance: true, performance: true, scheduling: true, contracts: true, letters: true, selfService: true, rewards: true, surveys: false, assets: false, travel: false, grievances: false, safety: false, orgHealth: false, changeManagement: false, orgDesign: false, culture: false, processEffectiveness: false, strategicAlignment: false },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function flatToSchema(doc: any) {
  const { tenantId, branding, modules, workSchedule, settings, createdAt, updatedAt, updatedBy, ...rest } = doc;
  return {
    tenantId,
    settings: settings || rest,
    branding: branding || undefined,
    modules: modules || undefined,
    workSchedule: workSchedule || undefined,
    createdAt,
    updatedAt,
    updatedBy,
  };
}

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const col = await getCVisionCollection<any>(tenantId, 'tenantSettings');
  let data = await col.findOne({ tenantId });
  if (!data) {
    const defaults = defaultSettings(tenantId);
    try { await col.insertOne(defaults); } catch { /* already exists */ }
    data = defaults;
  }
  const expanded = {
    ...((data.settings && typeof data.settings === 'object') ? data.settings : {}),
    tenantId: data.tenantId,
    branding: data.branding || {},
    modules: data.modules || {},
    workSchedule: data.workSchedule || null,
  };
  return NextResponse.json({ ok: true, data: expanded });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  const ctxResult = await requireCtx(request);
  if (ctxResult instanceof NextResponse) return ctxResult;
  const ctx = ctxResult;
  const rolePerms: string[] = CVISION_ROLE_PERMISSIONS[ctx.roles?.[0]] || [];
  if (!ctx.isOwner && !rolePerms.includes(CVISION_PERMISSIONS.CONFIG_WRITE)) {
    return deny('INSUFFICIENT_PERMISSION', 'Requires CONFIG_WRITE');
  }
  const body = await request.json();
  const parsed = settingsPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, ...updates } = body;
  if (action !== 'update') return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  delete updates.tenantId; delete updates._id;

  const schemaFields = new Set(['branding', 'modules', 'workSchedule']);
  const setData: any = { updatedAt: new Date(), updatedBy: userId };
  const settingsUpdate: any = {};

  for (const [k, v] of Object.entries(updates)) {
    if (schemaFields.has(k)) {
      setData[k] = v;
    } else {
      settingsUpdate[k] = v;
    }
  }

  if (Object.keys(settingsUpdate).length > 0) {
    const col = await getCVisionCollection<any>(tenantId, 'tenantSettings');
    const existing = await col.findOne({ tenantId });
    const merged = { ...((existing?.settings && typeof existing.settings === 'object') ? existing.settings : {}), ...settingsUpdate };
    setData.settings = merged;
  }

  const col = await getCVisionCollection<any>(tenantId, 'tenantSettings');
  await col.updateOne({ tenantId }, { $set: setData }, { upsert: true });
  const auditCtx = createCVisionAuditContext({ userId: ctx.userId, role: ctx.roles[0] || 'unknown', tenantId, user: ctx.user }, request);
  await logCVisionAudit(auditCtx, 'UPDATE', 'authz', { resourceId: tenantId, metadata: { type: 'tenant_settings' } });
  return NextResponse.json({ ok: true });
},
  { platformKey: 'cvision', permissionKey: 'cvision.config.write' });
