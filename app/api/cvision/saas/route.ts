import { logger } from '@/lib/monitoring/logger';
/**
 * CVision SaaS Settings API
 *
 * Consolidated endpoint for all tenant-admin operations:
 * company info, branding, subscription, users, API keys, and webhooks.
 *
 * GET  ?action=tenant|users|api-keys|webhooks|webhook-history|usage|subscription|plans
 * POST body.action = update-company|update-branding|update-settings|create-api-key|
 *                     revoke-api-key|create-webhook|test-webhook|delete-webhook|
 *                     invite-user|update-user-role|deactivate-user|upgrade-plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getTenant,
  updateTenant,
  getTenantUsage,
  PLANS,
  type Tenant,
  type SubscriptionPlan,
} from '@/lib/cvision/saas/tenant-manager';
import {
  listTenantUsers,
  inviteUser,
  updateUser,
  deactivateUser,
  type TenantUserRole,
} from '@/lib/cvision/saas/user-manager';
import {
  generateAPIKey,
  listAPIKeys,
  revokeAPIKey,
  getAPIUsageStats,
  API_PERMISSIONS,
} from '@/lib/cvision/saas/api-keys';
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  testWebhook,
  getWebhookHistory,
  WEBHOOK_EVENTS,
} from '@/lib/cvision/saas/webhooks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ═══════════════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════════════

export const GET = withAuthTenant(
  async (request: NextRequest, { tenantId }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'tenant';

    try {
      switch (action) {
        case 'tenant': {
          const tenant = await getTenant(tenantId);
          // Return 200 with null data instead of 404 — the layout.tsx
          // fetches this on every page load and a 404 pollutes the console.
          return NextResponse.json({ success: true, data: tenant || null });
        }

        case 'users': {
          const users = await listTenantUsers(tenantId);
          return NextResponse.json({ success: true, data: users });
        }

        case 'api-keys': {
          const keys = await listAPIKeys(tenantId);
          return NextResponse.json({
            success: true,
            data: keys,
            permissions: API_PERMISSIONS,
          });
        }

        case 'webhooks': {
          const subs = await listWebhooks(tenantId);
          return NextResponse.json({
            success: true,
            data: subs,
            events: WEBHOOK_EVENTS,
          });
        }

        case 'webhook-history': {
          const subId = url.searchParams.get('subscriptionId') || undefined;
          const history = await getWebhookHistory(tenantId, subId);
          return NextResponse.json({ success: true, data: history });
        }

        case 'usage': {
          const [tenantUsage, apiStats] = await Promise.all([
            getTenantUsage(tenantId),
            getAPIUsageStats(tenantId),
          ]);
          return NextResponse.json({
            success: true,
            data: { ...tenantUsage, api: apiStats },
          });
        }

        case 'subscription': {
          const tenant = await getTenant(tenantId);
          if (!tenant) return NextResponse.json({ success: true, data: null });

          const plan = PLANS[tenant.subscription.plan];
          const usage = await getTenantUsage(tenantId);

          const featureList = Object.keys(PLANS.ENTERPRISE.features.includes('ALL')
            ? {
                employees: true, attendance: true, payroll: true, reports: true,
                recruitment: true, leaves: true, performance: true, promotions: true,
                disciplinary: true, muqeem: true, government_reports: true,
                integrations: true, ai: true, retention_ai: true, whatif: true,
              }
            : {}
          );

          return NextResponse.json({
            success: true,
            data: {
              current: {
                plan: tenant.subscription.plan,
                planName: plan.name,
                status: tenant.subscription.status,
                price: tenant.subscription.price,
                billingCycle: tenant.subscription.billingCycle,
                maxEmployees: tenant.subscription.maxEmployees,
                maxUsers: tenant.subscription.maxUsers,
                features: tenant.subscription.features,
                startDate: tenant.subscription.startDate,
                endDate: tenant.subscription.endDate,
              },
              usage: {
                employees: usage.employees,
                users: usage.users,
                storage: usage.storage,
                apiCalls: usage.apiCalls,
              },
              featureList,
            },
          });
        }

        case 'plans': {
          const tenant = await getTenant(tenantId);
          const currentPlan = tenant?.subscription.plan || 'FREE';

          const plans = Object.entries(PLANS).map(([key, p]) => ({
            id: key,
            ...p,
            isCurrent: key === currentPlan,
          }));

          return NextResponse.json({ success: true, data: plans });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[SaaS API GET]', err);
      return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// POST
// ═══════════════════════════════════════════════════════════════════════════

export const POST = withAuthTenant(
  async (request: NextRequest, { tenantId, userId }) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, ...payload } = body;

    try {
      switch (action) {
        // ── Company ─────────────────────────────────────────────
        case 'update-company': {
          const updates: Partial<Tenant> = {};
          if (payload.companyName) updates.companyName = payload.companyName;
          if (payload.commercialRegistration) updates.commercialRegistration = payload.commercialRegistration;
          if (payload.vatNumber !== undefined) updates.vatNumber = payload.vatNumber;
          if (payload.molNumber !== undefined) updates.molNumber = payload.molNumber;
          if (payload.gosiNumber !== undefined) updates.gosiNumber = payload.gosiNumber;
          if (payload.email) updates.email = payload.email;
          if (payload.phone) updates.phone = payload.phone;
          if (payload.website !== undefined) updates.website = payload.website;
          if (payload.address) updates.address = payload.address;

          const updated = await updateTenant(tenantId, updates);
          return NextResponse.json({ success: true, data: updated });
        }

        // ── Branding ────────────────────────────────────────────
        case 'update-branding': {
          const branding: Record<string, any> = {};
          const allowedKeys = ['logo', 'logoLight', 'primaryColor', 'secondaryColor', 'accentColor', 'fontFamily', 'customCSS'];
          for (const k of allowedKeys) {
            if (payload[k] !== undefined) branding[k] = payload[k];
          }

          // Validate hex colors
          for (const k of ['primaryColor', 'secondaryColor', 'accentColor']) {
            if (branding[k] && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(branding[k])) {
              return NextResponse.json({ error: `Invalid hex color for ${k}: ${branding[k]}` }, { status: 400 });
            }
          }

          const tenant = await getTenant(tenantId);
          const merged = { ...tenant?.branding, ...branding };
          const updated = await updateTenant(tenantId, { branding: merged } as Partial<Tenant>);
          return NextResponse.json({ success: true, data: updated?.branding || merged });
        }

        // ── Settings ────────────────────────────────────────────
        case 'update-settings': {
          const tenant = await getTenant(tenantId);
          const merged = { ...tenant?.settings, ...payload.settings };
          const updated = await updateTenant(tenantId, { settings: merged } as Partial<Tenant>);
          return NextResponse.json({ success: true, data: updated?.settings || merged });
        }

        // ── API Keys ────────────────────────────────────────────
        case 'create-api-key': {
          if (!payload.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
          const { key, keyId } = await generateAPIKey(tenantId, {
            name: payload.name,
            type: payload.type || 'LIVE',
            permissions: payload.permissions || ['read:employees'],
            rateLimit: payload.rateLimit || 60,
            ipWhitelist: payload.ipWhitelist,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
            createdBy: userId,
          });
          return NextResponse.json({ success: true, data: { key, keyId } });
        }

        case 'revoke-api-key': {
          if (!payload.keyId) return NextResponse.json({ error: 'keyId is required' }, { status: 400 });
          await revokeAPIKey(tenantId, payload.keyId, userId);
          return NextResponse.json({ success: true });
        }

        // ── Webhooks ────────────────────────────────────────────
        case 'create-webhook': {
          if (!payload.url || !payload.events?.length) {
            return NextResponse.json({ error: 'url and events are required' }, { status: 400 });
          }
          const { subscription, secret } = await createWebhook(tenantId, {
            url: payload.url,
            events: payload.events,
          });
          return NextResponse.json({ success: true, data: { ...subscription, secret } });
        }

        case 'test-webhook': {
          if (!payload.subscriptionId) return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
          const result = await testWebhook(tenantId, payload.subscriptionId);
          return NextResponse.json({ success: true, data: result });
        }

        case 'delete-webhook': {
          if (!payload.subscriptionId) return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
          await deleteWebhook(tenantId, payload.subscriptionId);
          return NextResponse.json({ success: true });
        }

        // ── Users ───────────────────────────────────────────────
        case 'invite-user': {
          if (!payload.email || !payload.role) {
            return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
          }
          const invite = await inviteUser(tenantId, payload.email, payload.role, userId);
          return NextResponse.json({ success: true, data: invite });
        }

        case 'update-user-role': {
          if (!payload.userId || !payload.newRole) {
            return NextResponse.json({ error: 'userId and newRole are required' }, { status: 400 });
          }
          const updated = await updateUser(tenantId, payload.userId, {
            role: payload.newRole as TenantUserRole,
          });
          return NextResponse.json({ success: true, data: updated });
        }

        case 'deactivate-user': {
          if (!payload.userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
          await deactivateUser(tenantId, payload.userId);
          return NextResponse.json({ success: true });
        }

        // ── Subscription ────────────────────────────────────────
        case 'upgrade-plan': {
          if (!payload.planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 });
          const plan = PLANS[payload.planId as SubscriptionPlan];
          if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

          const updated = await updateTenant(tenantId, {
            subscription: {
              plan: payload.planId as SubscriptionPlan,
              status: 'ACTIVE',
              billingCycle: payload.billingCycle || 'MONTHLY',
              startDate: new Date(),
              maxEmployees: plan.maxEmployees,
              maxUsers: plan.maxUsers,
              features: plan.features,
              price: plan.price,
            },
          } as Partial<Tenant>);
          return NextResponse.json({ success: true, data: updated?.subscription });
        }

        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
    } catch (err: any) {
      logger.error('[SaaS API POST]', err);
      return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
  },
);
