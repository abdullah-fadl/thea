/**
 * CVision SaaS — Tenant Manager
 *
 * Full tenant lifecycle: create, read, update, suspend, validate.
 * Every CVision company is a Tenant with its own subscription, branding, and settings.
 */

import { Db, Collection, ObjectId } from '@/lib/cvision/infra/mongo-compat';
import { getTenantDbByKey } from '@/lib/cvision/infra';
import { getPlatformDb } from '@/lib/db/platformDb';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TenantAddress {
  street: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  nationalAddress?: string;
}

export interface TenantBranding {
  logo?: string;
  logoLight?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily?: string;
  customCSS?: string;
}

export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

export interface TenantSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  startDate: Date;
  endDate?: Date;
  maxEmployees: number;
  maxUsers: number;
  features: string[];
  price: number;
}

export interface TenantSettings {
  language: 'en' | 'ar' | 'both';
  timezone: string;
  dateFormat: string;
  currency: string;
  weekStart: 'sunday' | 'saturday' | 'monday';
  workDays: number[];
  workHoursPerDay: number;
  fiscalYearStart: number;

  enableAI: boolean;
  enableRetentionAI: boolean;
  enableWhatIf: boolean;
  enableGovernmentIntegrations: boolean;
  enableRecruitment: boolean;
  enablePerformance: boolean;
  enableDisciplinary: boolean;
  enableMuqeem: boolean;

  emailNotifications: boolean;
  smsNotifications: boolean;
  webhookUrl?: string;
}

export interface Tenant {
  _id?: ObjectId;
  tenantId: string;

  companyName: string;
  commercialRegistration: string;
  vatNumber?: string;
  molNumber?: string;
  gosiNumber?: string;

  email: string;
  phone: string;
  website?: string;

  address: TenantAddress;
  branding: TenantBranding;
  subscription: TenantSubscription;
  settings: TenantSettings;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
  deletedAt?: Date | null;
  suspendedReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Subscription Plans
// ═══════════════════════════════════════════════════════════════════════════

export const PLANS: Record<SubscriptionPlan, {
  name: string;
  price: number;
  maxEmployees: number;
  maxUsers: number;
  features: string[];
  description: string;
}> = {
  FREE: {
    name: 'Free',
    price: 0,
    maxEmployees: 10,
    maxUsers: 2,
    features: ['employees', 'attendance', 'basic_reports'],
    description: 'For small teams getting started',
  },
  STARTER: {
    name: 'Starter',
    price: 299,
    maxEmployees: 50,
    maxUsers: 5,
    features: ['employees', 'attendance', 'payroll', 'reports', 'recruitment', 'leaves'],
    description: 'For growing companies',
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 799,
    maxEmployees: 200,
    maxUsers: 20,
    features: [
      'employees', 'attendance', 'payroll', 'reports', 'recruitment', 'leaves',
      'performance', 'promotions', 'disciplinary', 'muqeem',
      'government_reports', 'integrations',
    ],
    description: 'For established organizations',
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 1999,
    maxEmployees: -1,
    maxUsers: -1,
    features: ['ALL'],
    description: 'For large enterprises with full needs',
  },
};

// Feature → setting mapping for quick lookups
const FEATURE_SETTING_MAP: Record<string, keyof TenantSettings> = {
  ai: 'enableAI',
  retention_ai: 'enableRetentionAI',
  what_if: 'enableWhatIf',
  government_reports: 'enableGovernmentIntegrations',
  recruitment: 'enableRecruitment',
  performance: 'enablePerformance',
  disciplinary: 'enableDisciplinary',
  muqeem: 'enableMuqeem',
};

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

const COLLECTION = 'cvision_tenants';

async function getTenantsCollection(tenantId: string): Promise<Collection<Tenant>> {
  const db = await getTenantDbByKey(tenantId);
  return db.collection<Tenant>(COLLECTION);
}

async function getSystemDb(): Promise<Db> {
  return getPlatformDb();
}

async function getSystemTenantsCollection(): Promise<Collection<Tenant>> {
  const db = await getSystemDb();
  return db.collection<Tenant>(COLLECTION);
}

function defaultSettings(): TenantSettings {
  return {
    language: 'both',
    timezone: 'Asia/Riyadh',
    dateFormat: 'DD/MM/YYYY',
    currency: 'SAR',
    weekStart: 'sunday',
    workDays: [0, 1, 2, 3, 4],
    workHoursPerDay: 8,
    fiscalYearStart: 1,
    enableAI: false,
    enableRetentionAI: false,
    enableWhatIf: false,
    enableGovernmentIntegrations: false,
    enableRecruitment: true,
    enablePerformance: false,
    enableDisciplinary: false,
    enableMuqeem: false,
    emailNotifications: true,
    smsNotifications: false,
  };
}

function defaultBranding(): TenantBranding {
  return {
    primaryColor: '#2563eb',
    secondaryColor: '#1e293b',
    accentColor: '#f59e0b',
  };
}

function defaultAddress(): TenantAddress {
  return {
    street: '',
    city: '',
    district: '',
    postalCode: '',
    country: 'SA',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════════

export async function createTenant(data: Partial<Tenant>): Promise<Tenant> {
  const col = await getSystemTenantsCollection();

  if (!data.tenantId || !data.companyName || !data.email) {
    throw new Error('tenantId, companyName, and email are required');
  }

  const existing = await col.findOne({ tenantId: data.tenantId });
  if (existing) throw new Error(`Tenant "${data.tenantId}" already exists`);

  const plan = (data.subscription?.plan || 'FREE') as SubscriptionPlan;
  const planDef = PLANS[plan];

  const tenant: Tenant = {
    tenantId: data.tenantId,
    companyName: data.companyName,
    commercialRegistration: data.commercialRegistration || '',
    vatNumber: data.vatNumber,
    molNumber: data.molNumber,
    gosiNumber: data.gosiNumber,
    email: data.email,
    phone: data.phone || '',
    website: data.website,
    address: { ...defaultAddress(), ...data.address },
    branding: { ...defaultBranding(), ...data.branding },
    subscription: {
      plan,
      status: plan === 'FREE' ? 'ACTIVE' : 'TRIAL',
      trialEndsAt: plan !== 'FREE' ? new Date(Date.now() + 14 * 86400000) : undefined,
      billingCycle: data.subscription?.billingCycle || 'MONTHLY',
      startDate: new Date(),
      maxEmployees: planDef.maxEmployees,
      maxUsers: planDef.maxUsers,
      features: planDef.features,
      price: planDef.price,
      ...data.subscription,
    },
    settings: { ...defaultSettings(), ...data.settings },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: data.createdBy || 'system',
    isActive: true,
  };

  await col.insertOne(tenant as any);
  return tenant;
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const col = await getSystemTenantsCollection();
  return col.findOne({ tenantId });
}

export async function updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
  const col = await getSystemTenantsCollection();

  const { _id, tenantId: _tid, createdAt: _ca, createdBy: _cb, ...safeUpdates } = updates as Record<string, unknown>;

  const result = await col.findOneAndUpdate(
    { tenantId },
    { $set: { ...safeUpdates, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  const doc = (result as Record<string, unknown>)?.value ?? result;
  if (!doc) throw new Error(`Tenant "${tenantId}" not found`);
  return doc as Tenant;
}

export async function suspendTenant(tenantId: string, reason: string): Promise<void> {
  const col = await getSystemTenantsCollection();
  await col.updateOne(
    { tenantId },
    {
      $set: {
        'subscription.status': 'SUSPENDED',
        suspendedReason: reason,
        isActive: false,
        updatedAt: new Date(),
      },
    },
  );
}

export async function reactivateTenant(tenantId: string): Promise<void> {
  const col = await getSystemTenantsCollection();
  await col.updateOne(
    { tenantId },
    {
      $set: {
        'subscription.status': 'ACTIVE',
        suspendedReason: null,
        isActive: true,
        updatedAt: new Date(),
      },
    },
  );
}

export async function listTenants(filters?: {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ tenants: Tenant[]; total: number }> {
  const col = await getSystemTenantsCollection();

  const query: Record<string, any> = {};

  if (filters?.plan) query['subscription.plan'] = filters.plan;
  if (filters?.status) query['subscription.status'] = filters.status;
  if (filters?.isActive !== undefined) query.isActive = filters.isActive;
  if (filters?.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { companyName: { $regex: escaped, $options: 'i' } },
      { tenantId: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Math.max(1, filters?.page || 1);
  const limit = Math.min(100, Math.max(1, filters?.limit || 20));
  const skip = (page - 1) * limit;

  const [tenants, total] = await Promise.all([
    col.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(query),
  ]);

  return { tenants, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// Feature & Limit checks
// ═══════════════════════════════════════════════════════════════════════════

export function isFeatureEnabled(tenant: Tenant, feature: string): boolean {
  if (tenant.subscription.features.includes('ALL')) return true;
  if (tenant.subscription.features.includes(feature)) return true;

  const settingKey = FEATURE_SETTING_MAP[feature];
  if (settingKey && tenant.settings[settingKey] === true) return true;

  return false;
}

export async function checkEmployeeLimit(tenantId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return { allowed: false, current: 0, max: 0 };

  const max = tenant.subscription.maxEmployees;
  if (max === -1) return { allowed: true, current: 0, max: -1 };

  const db = await getTenantDbByKey(tenantId);
  const current = await db.collection('cvision_employees').countDocuments({
    tenantId,
    isArchived: { $ne: true },
  });

  return { allowed: current < max, current, max };
}

export async function checkUserLimit(tenantId: string): Promise<{ allowed: boolean; current: number; max: number }> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return { allowed: false, current: 0, max: 0 };

  const max = tenant.subscription.maxUsers;
  if (max === -1) return { allowed: true, current: 0, max: -1 };

  const db = await getTenantDbByKey(tenantId);
  const current = await db.collection('cvision_tenant_users').countDocuments({
    tenantId,
    isActive: true,
  });

  return { allowed: current < max, current, max };
}

export async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  const tenant = await getTenant(tenantId);
  return tenant?.branding || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════

export async function validateTenantAccess(tenantId: string): Promise<{ valid: boolean; reason?: string; status?: number }> {
  const tenant = await getTenant(tenantId);

  if (!tenant) return { valid: false, reason: 'Tenant not found', status: 404 };
  if (!tenant.isActive) return { valid: false, reason: 'Account is inactive', status: 403 };

  const sub = tenant.subscription;

  if (sub.status === 'SUSPENDED') {
    return { valid: false, reason: `Account suspended: ${tenant.suspendedReason || 'Contact support'}`, status: 403 };
  }
  if (sub.status === 'CANCELLED') {
    return { valid: false, reason: 'Subscription cancelled', status: 403 };
  }
  if (sub.status === 'EXPIRED') {
    return { valid: false, reason: 'Subscription expired. Please renew.', status: 402 };
  }
  if (sub.status === 'TRIAL' && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date()) {
    return { valid: false, reason: 'Trial period ended. Please subscribe.', status: 402 };
  }
  if (sub.endDate && new Date(sub.endDate) < new Date()) {
    return { valid: false, reason: 'Subscription expired. Please renew.', status: 402 };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Usage stats
// ═══════════════════════════════════════════════════════════════════════════

export async function getTenantUsage(tenantId: string): Promise<{
  employees: number;
  users: number;
  storage: number;
  apiCalls: number;
  lastActivity: Date | null;
}> {
  const db = await getTenantDbByKey(tenantId);

  const [employees, users, lastAudit] = await Promise.all([
    db.collection('cvision_employees').countDocuments({
      tenantId,
      isArchived: { $ne: true },
    }),
    db.collection('cvision_tenant_users').countDocuments({ tenantId, isActive: true }),
    db.collection('cvision_audit_logs').findOne(
      { tenantId },
      { sort: { createdAt: -1 }, projection: { createdAt: 1 } },
    ),
  ]);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const apiCalls = await db.collection('cvision_audit_logs').countDocuments({
    tenantId,
    createdAt: { $gte: startOfMonth },
  });

  return {
    employees,
    users,
    storage: 0,
    apiCalls,
    lastActivity: lastAudit?.createdAt || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Indexes
// ═══════════════════════════════════════════════════════════════════════════

export async function ensureTenantIndexes(): Promise<void> {
  const col = await getSystemTenantsCollection();
  await col.createIndex({ tenantId: 1 }, { unique: true });
  await col.createIndex({ email: 1 });
  await col.createIndex({ 'subscription.plan': 1, 'subscription.status': 1 });
  await col.createIndex({ isActive: 1 });
}
