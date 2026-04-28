/**
 * OpenAPI 3.1 Specification Generator for Thea EHR API
 *
 * Features:
 * - Zod-to-OpenAPI schema converter (handles all common Zod types)
 * - Route registration system with tags, permissions, and request/response schemas
 * - Auto-generated OpenAPI 3.1 spec with Bearer JWT auth
 * - Bilingual descriptions (Arabic / English)
 *
 * Served at GET /api/docs and rendered by the Scalar UI at /admin/api-docs.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod Internals — accessing _def is required for schema introspection
// ---------------------------------------------------------------------------

/** Internal Zod definition shape, used for schema-to-OpenAPI conversion */
interface ZodDef {
  typeName?: string;
  type?: string;
  checks?: Array<{ kind: string; value?: number; regex?: RegExp }>;
  values?: unknown;
  value?: unknown;
  innerType?: z.ZodType;
  schema?: z.ZodType;
  options?: z.ZodType[] | Map<string, z.ZodType>;
  left?: z.ZodType;
  right?: z.ZodType;
  valueType?: z.ZodType;
  defaultValue?: unknown;
  getter?: () => z.ZodType;
  in?: z.ZodType;
  [key: string]: unknown;
}

/** Safely extract the internal _def from a Zod schema */
function getZodDef(schema: z.ZodType): ZodDef | undefined {
  return (schema as unknown as { _def?: ZodDef })._def;
}

/** Safely extract the shape from a ZodObject */
function getZodShape(schema: z.ZodType): Record<string, z.ZodType> | undefined {
  return (schema as unknown as { shape?: Record<string, z.ZodType> }).shape;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteDoc {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  summary: string;
  description?: string;
  tags: string[];
  requestBody?: z.ZodType;
  responseSchema?: z.ZodType;
  queryParams?: Record<string, { type: string; description: string; required?: boolean }>;
  pathParams?: Record<string, { type: string; description: string }>;
  permissionKey?: string;
}

// ---------------------------------------------------------------------------
// Route Registry
// ---------------------------------------------------------------------------

const routes: RouteDoc[] = [];

export function registerRoute(doc: RouteDoc): void {
  routes.push(doc);
}

// ---------------------------------------------------------------------------
// Zod → OpenAPI Schema Converter
// ---------------------------------------------------------------------------

/**
 * Convert any Zod schema into an OpenAPI 3.1-compatible JSON Schema object.
 * Handles: ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject, ZodEnum,
 * ZodOptional, ZodNullable, ZodDefault, ZodDate, ZodRecord, ZodUnion,
 * ZodLiteral, ZodAny, ZodEffects (passthrough/transform/preprocess).
 */
export function zodToOpenAPI(schema: z.ZodType): Record<string, unknown> {
  const def = schema ? getZodDef(schema) : undefined;
  if (!def) {
    return { type: 'object', additionalProperties: true };
  }

  const typeName: string = def.typeName ?? def.type ?? '';

  switch (typeName) {
    // --- Primitives ---
    case 'ZodString': {
      const result: Record<string, unknown> = { type: 'string' };
      const checks = def.checks ?? [];
      for (const c of checks) {
        if (c.kind === 'min') result.minLength = c.value;
        if (c.kind === 'max') result.maxLength = c.value;
        if (c.kind === 'email') result.format = 'email';
        if (c.kind === 'datetime') result.format = 'date-time';
        if (c.kind === 'uuid') result.format = 'uuid';
        if (c.kind === 'url') result.format = 'uri';
        if (c.kind === 'regex') result.pattern = c.regex?.source;
      }
      return result;
    }

    case 'ZodNumber': {
      const result: Record<string, unknown> = { type: 'number' };
      const checks = def.checks ?? [];
      for (const c of checks) {
        if (c.kind === 'min') result.minimum = c.value;
        if (c.kind === 'max') result.maximum = c.value;
        if (c.kind === 'int') result.type = 'integer';
      }
      return result;
    }

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodDate':
      return { type: 'string', format: 'date-time' };

    // --- Containers ---
    case 'ZodArray': {
      const itemSchema = zodToOpenAPI(def.type as any);
      return { type: 'array', items: itemSchema };
    }

    case 'ZodObject': {
      const shape = getZodShape(schema);
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodType;
        properties[key] = zodToOpenAPI(fieldSchema);

        if (!isOptionalLike(fieldSchema)) {
          required.push(key);
        }
      }

      const result: Record<string, unknown> = { type: 'object', properties };
      if (required.length > 0) result.required = required;
      return result;
    }

    case 'ZodRecord': {
      const valueDef = def.valueType;
      return {
        type: 'object',
        additionalProperties: valueDef ? zodToOpenAPI(valueDef) : true,
      };
    }

    // --- Enums ---
    case 'ZodEnum': {
      const values = def.values;
      return { type: 'string', enum: Array.isArray(values) ? values : Object.values(values) };
    }

    case 'ZodNativeEnum': {
      const vals = Object.values(def.values);
      return { type: 'string', enum: vals };
    }

    case 'ZodLiteral': {
      const value = def.value;
      const litType = typeof value === 'number' ? 'number'
        : typeof value === 'boolean' ? 'boolean'
        : 'string';
      return { type: litType, enum: [value] };
    }

    // --- Wrappers ---
    case 'ZodOptional': {
      return zodToOpenAPI(def.innerType);
    }

    case 'ZodNullable': {
      const inner = zodToOpenAPI(def.innerType);
      return { ...inner, nullable: true };
    }

    case 'ZodDefault': {
      const inner = zodToOpenAPI(def.innerType);
      const defaultVal = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
      return { ...inner, default: defaultVal };
    }

    // --- Union ---
    case 'ZodUnion': {
      const rawOpts = def.options;
      const optsList = Array.isArray(rawOpts) ? rawOpts : Array.from((rawOpts as Map<string, z.ZodType>).values());
      const options = optsList.map((o: z.ZodType) => zodToOpenAPI(o));
      if (options.length === 2) {
        const nullIdx = options.findIndex(
          (o: Record<string, unknown>) => o.type === 'null'
        );
        if (nullIdx !== -1) {
          const other = options[1 - nullIdx];
          return { ...(other as Record<string, unknown>), nullable: true };
        }
      }
      return { oneOf: options };
    }

    case 'ZodDiscriminatedUnion': {
      const opts = def.options;
      const items = Array.isArray(opts) ? opts : Array.from(opts.values());
      return { oneOf: items.map((o: z.ZodType) => zodToOpenAPI(o)) };
    }

    // --- Effects (transform, preprocess, refinement) ---
    case 'ZodEffects': {
      const innerType = def.schema;
      return zodToOpenAPI(innerType);
    }

    // --- Passthrough types ---
    case 'ZodAny':
    case 'ZodUnknown':
      return { type: 'object', additionalProperties: true };

    case 'ZodNull':
    case 'ZodVoid':
    case 'ZodUndefined':
      return { type: 'null' };

    case 'ZodPipeline': {
      const pipeIn = def.in;
      return zodToOpenAPI(pipeIn);
    }

    case 'ZodIntersection': {
      const left = zodToOpenAPI(def.left);
      const right = zodToOpenAPI(def.right);
      return { allOf: [left, right] };
    }

    case 'ZodLazy': {
      const getter = def.getter;
      return zodToOpenAPI(getter());
    }

    default:
      return { type: 'object', additionalProperties: true };
  }
}

/** Check whether a Zod schema is "optional-like" (optional, nullable, or has default). */
function isOptionalLike(schema: z.ZodType): boolean {
  const def = getZodDef(schema);
  const typeName: string = def?.typeName ?? def?.type ?? '';
  if (typeName === 'ZodOptional' || typeName === 'ZodDefault') return true;
  if (typeName === 'ZodNullable') return true;
  if (typeName === 'ZodUnion' && def) {
    const options = def.options;
    const optsList: z.ZodType[] = Array.isArray(options) ? options : Array.from((options as Map<string, z.ZodType>).values());
    return optsList.some((o) => {
      const oDef = getZodDef(o);
      const tn = oDef?.typeName ?? oDef?.type ?? '';
      return tn === 'ZodUndefined' || tn === 'ZodNull';
    });
  }
  return false;
}

// ---------------------------------------------------------------------------
// OpenAPI Spec Builder
// ---------------------------------------------------------------------------

const API_TAGS = [
  { name: 'Auth', description: 'Authentication and session management / المصادقة وإدارة الجلسات' },
  { name: 'OPD', description: 'Outpatient Department / العيادات الخارجية' },
  { name: 'Billing', description: 'Billing, payments, and claims / الفوترة والمدفوعات والمطالبات' },
  { name: 'Admin', description: 'Administration (users, roles, hospitals) / الإدارة' },
  { name: 'Patients', description: 'Patient records and demographics / سجلات المرضى' },
  { name: 'Orders', description: 'Clinical orders (lab, radiology, procedures) / الطلبات السريرية' },
  { name: 'ER', description: 'Emergency Department / قسم الطوارئ' },
  { name: 'IPD', description: 'Inpatient Department / قسم التنويم' },
  { name: 'Lab', description: 'Laboratory / المختبر' },
  { name: 'Radiology', description: 'Radiology / الأشعة' },
  { name: 'Pharmacy', description: 'Pharmacy / الصيدلية' },
  { name: 'Scheduling', description: 'Scheduling and appointments / المواعيد والجدولة' },
  { name: 'Notifications', description: 'Notifications / الإشعارات' },
  { name: 'Clinical', description: 'Clinical data (allergies, notes, vitals) / البيانات السريرية' },
  { name: 'Quality', description: 'Quality and incident management / الجودة' },
  { name: 'System', description: 'System health and configuration / النظام' },
];

export function generateOpenAPISpec(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {};
    }

    const operation: Record<string, unknown> = {
      summary: route.summary,
      tags: route.tags,
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Successful response / استجابة ناجحة',
          content: route.responseSchema
            ? { 'application/json': { schema: zodToOpenAPI(route.responseSchema) } }
            : { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } },
        },
        '401': {
          description: 'Unauthorized / غير مصرّح',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        '403': {
          description: 'Forbidden / ممنوع الوصول',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        '422': {
          description: 'Validation error / خطأ في التحقق',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } },
        },
        '500': {
          description: 'Internal server error / خطأ في الخادم',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    };

    if (route.description) {
      operation.description = route.description;
    }

    if (route.permissionKey) {
      operation['x-permission-key'] = route.permissionKey;
    }

    // Path parameters
    const params: Record<string, unknown>[] = [];
    if (route.pathParams) {
      for (const [name, info] of Object.entries(route.pathParams)) {
        params.push({
          name,
          in: 'path',
          required: true,
          description: info.description,
          schema: { type: info.type },
        });
      }
    }

    // Query parameters
    if (route.queryParams) {
      for (const [name, info] of Object.entries(route.queryParams)) {
        params.push({
          name,
          in: 'query',
          required: info.required ?? false,
          description: info.description,
          schema: { type: info.type },
        });
      }
    }

    if (params.length > 0) {
      operation.parameters = params;
    }

    // Request body
    if (route.requestBody) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: zodToOpenAPI(route.requestBody),
          },
        },
      };
    }

    paths[route.path][route.method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Thea EHR API',
      version: '1.0.0',
      description:
        'Thea Electronic Health Records System API\n\n' +
        'واجهة برمجة تطبيقات نظام ثيا للسجلات الصحية الإلكترونية\n\n' +
        'Multi-tenant healthcare platform supporting OPD, ER, IPD, Lab, Radiology, Pharmacy, Billing, and more.\n\n' +
        'منصة رعاية صحية متعددة المستأجرين تدعم العيادات الخارجية والطوارئ والتنويم والمختبر والأشعة والصيدلية والفوترة والمزيد.',
      contact: {
        name: 'Thea Health',
        email: 'thea@thea.com.sa',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current server / الخادم الحالي',
      },
    ],
    tags: API_TAGS,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT token obtained from POST /api/auth/login. Include as Authorization: Bearer <token>\n\n' +
            'رمز JWT يتم الحصول عليه من POST /api/auth/login. يُضاف في ترويسة Authorization: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', description: 'Human-readable error message / رسالة خطأ مقروءة' },
            code: { type: 'string', description: 'Machine-readable error code / رمز خطأ آلي' },
          },
        },
        ValidationError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string' },
            code: { type: 'string', enum: ['VALIDATION_ERROR'] },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'array', items: { type: 'string' } },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

// ---------------------------------------------------------------------------
// Import Zod Schemas for route registration
// ---------------------------------------------------------------------------

import { createPatientSchema, updatePatientSchema, mergePatientSchema } from '@/lib/validation/patient.schema';
import { createUserSchema, createRoleSchema, createHospitalSchema } from '@/lib/validation/admin.schema';
import {
  createChargeEventSchema,
  recordPaymentSchema,
  createClaimSchema,
  createChargeCatalogSchema,
  createInvoiceDraftSchema,
} from '@/lib/validation/billing.schema';
import {
  openEncounterSchema,
  createBookingSchema,
  walkInBookingSchema,
  cancelBookingSchema,
  checkInBookingSchema,
  opdNursingSchema,
  visitNotesSchema,
  opdFlowStateSchema,
  opdOrdersBulkSchema,
} from '@/lib/validation/opd.schema';
import { createOrderSchema, cancelOrderSchema, assignOrderSchema } from '@/lib/validation/orders.schema';
import { createResourceSchema, createTemplateSchema, generateSlotsSchema } from '@/lib/validation/scheduling.schema';

// ---------------------------------------------------------------------------
// Route Registrations (20+ key routes)
// ---------------------------------------------------------------------------

// ─── Auth ────────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/auth/login',
  method: 'post',
  summary: 'Authenticate user and obtain JWT',
  description: 'Login with email/password. Returns JWT token and user info. Supports 2FA flow.\n\nتسجيل الدخول بالبريد الإلكتروني وكلمة المرور.',
  tags: ['Auth'],
  requestBody: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tenantId: z.string().optional(),
  }),
  responseSchema: z.object({
    success: z.boolean(),
    redirectTo: z.string().optional(),
    requires2FA: z.boolean().optional(),
  }),
});

registerRoute({
  path: '/api/auth/me',
  method: 'get',
  summary: 'Get current authenticated user',
  description: 'Returns the currently authenticated user profile, permissions, and tenant context.\n\nإرجاع ملف المستخدم الحالي.',
  tags: ['Auth'],
  responseSchema: z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      role: z.string(),
    }),
    tenantId: z.string().optional(),
  }),
});

// ─── OPD ─────────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/opd/encounters/{encounterCoreId}',
  method: 'get',
  summary: 'Get OPD encounter details',
  description: 'Retrieve a single OPD encounter by its core ID.\n\nاسترجاع تفاصيل زيارة العيادات الخارجية.',
  tags: ['OPD'],
  pathParams: { encounterCoreId: { type: 'string', description: 'Encounter core ID / معرف الزيارة' } },
  permissionKey: 'opd.visit.view',
});

registerRoute({
  path: '/api/opd/booking/create',
  method: 'post',
  summary: 'Create OPD booking',
  description: 'Book an OPD appointment for a patient.\n\nحجز موعد عيادات خارجية لمريض.',
  tags: ['OPD'],
  requestBody: createBookingSchema,
  permissionKey: 'opd.booking.create',
});

registerRoute({
  path: '/api/opd/booking/walk-in',
  method: 'post',
  summary: 'Register walk-in patient',
  description: 'Create a walk-in booking without a pre-existing appointment.\n\nتسجيل مريض بدون موعد مسبق.',
  tags: ['OPD'],
  requestBody: walkInBookingSchema,
  permissionKey: 'opd.booking.create',
});

registerRoute({
  path: '/api/opd/booking/cancel',
  method: 'post',
  summary: 'Cancel OPD booking',
  description: 'Cancel an existing OPD booking.\n\nإلغاء حجز موعد.',
  tags: ['OPD'],
  requestBody: cancelBookingSchema,
  permissionKey: 'opd.booking.cancel',
});

registerRoute({
  path: '/api/opd/booking/check-in',
  method: 'post',
  summary: 'Check-in patient for appointment',
  description: 'Check-in a patient who has arrived for their appointment.\n\nتسجيل وصول المريض لموعده.',
  tags: ['OPD'],
  requestBody: checkInBookingSchema,
  permissionKey: 'opd.booking.checkin',
});

registerRoute({
  path: '/api/opd/encounters/{encounterCoreId}/nursing',
  method: 'post',
  summary: 'Save nursing assessment',
  description: 'Save vitals, nursing notes, and pain assessment for an encounter.\n\nحفظ العلامات الحيوية وملاحظات التمريض.',
  tags: ['OPD'],
  pathParams: { encounterCoreId: { type: 'string', description: 'Encounter core ID / معرف الزيارة' } },
  requestBody: opdNursingSchema,
  permissionKey: 'opd.nursing.write',
});

registerRoute({
  path: '/api/opd/encounters/{encounterCoreId}/visit-notes',
  method: 'post',
  summary: 'Save doctor visit notes (SOAP)',
  description: 'Save doctor SOAP notes including chief complaint, assessment, and plan.\n\nحفظ ملاحظات الطبيب (SOAP).',
  tags: ['OPD'],
  pathParams: { encounterCoreId: { type: 'string', description: 'Encounter core ID / معرف الزيارة' } },
  requestBody: visitNotesSchema,
  permissionKey: 'opd.doctor.write',
});

registerRoute({
  path: '/api/opd/encounters/{encounterCoreId}/flow-state',
  method: 'post',
  summary: 'Update encounter flow state',
  description: 'Transition the OPD encounter through workflow states (waiting, in nursing, in doctor, completed).\n\nتحديث حالة سير العمل للزيارة.',
  tags: ['OPD'],
  pathParams: { encounterCoreId: { type: 'string', description: 'Encounter core ID / معرف الزيارة' } },
  requestBody: opdFlowStateSchema,
  permissionKey: 'opd.visit.flow',
});

registerRoute({
  path: '/api/opd/encounters/{encounterCoreId}/orders',
  method: 'post',
  summary: 'Place orders for OPD encounter',
  description: 'Place lab, radiology, or procedure orders for the encounter.\n\nإنشاء طلبات مختبر أو أشعة أو إجراءات للزيارة.',
  tags: ['OPD'],
  pathParams: { encounterCoreId: { type: 'string', description: 'Encounter core ID / معرف الزيارة' } },
  requestBody: opdOrdersBulkSchema,
  permissionKey: 'opd.orders.create',
});

registerRoute({
  path: '/api/opd/queue',
  method: 'get',
  summary: 'Get OPD queue / waiting list',
  description: 'Retrieve the current OPD queue filtered by clinic, doctor, or status.\n\nاسترجاع قائمة الانتظار للعيادات الخارجية.',
  tags: ['OPD'],
  queryParams: {
    clinicId: { type: 'string', description: 'Filter by clinic / تصفية بالعيادة' },
    status: { type: 'string', description: 'Filter by flow state / تصفية بالحالة' },
  },
  permissionKey: 'opd.queue.view',
});

// ─── Billing ─────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/billing/charge-events',
  method: 'post',
  summary: 'Create charge event',
  description: 'Record a billable charge event for an encounter.\n\nتسجيل حدث رسوم للزيارة.',
  tags: ['Billing'],
  requestBody: createChargeEventSchema,
  permissionKey: 'billing.charge.create',
});

registerRoute({
  path: '/api/billing/payments/record',
  method: 'post',
  summary: 'Record payment',
  description: 'Record a payment against an encounter (cash, card, bank transfer).\n\nتسجيل دفعة مالية للزيارة.',
  tags: ['Billing'],
  requestBody: recordPaymentSchema,
  permissionKey: 'billing.payment.create',
});

registerRoute({
  path: '/api/billing/claims',
  method: 'post',
  summary: 'Create insurance claim',
  description: 'Generate an insurance claim for an encounter.\n\nإنشاء مطالبة تأمين لزيارة.',
  tags: ['Billing'],
  requestBody: createClaimSchema,
  permissionKey: 'billing.claims.create',
});

registerRoute({
  path: '/api/billing/eligibility',
  method: 'post',
  summary: 'Check insurance eligibility',
  description: 'Verify patient insurance eligibility with the payer.\n\nالتحقق من أهلية تأمين المريض.',
  tags: ['Billing'],
  requestBody: z.object({
    patientMasterId: z.string(),
    payerId: z.string(),
    memberOrPolicyRef: z.string().optional(),
  }),
  permissionKey: 'billing.eligibility.check',
});

registerRoute({
  path: '/api/billing/invoice-draft',
  method: 'post',
  summary: 'Create invoice draft',
  description: 'Create a draft invoice for review before finalizing.\n\nإنشاء مسودة فاتورة للمراجعة.',
  tags: ['Billing'],
  requestBody: createInvoiceDraftSchema,
  permissionKey: 'billing.invoice.create',
});

// ─── Admin ───────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/admin/users',
  method: 'get',
  summary: 'List users',
  description: 'Retrieve all users in the current tenant.\n\nاسترجاع جميع المستخدمين في المستأجر الحالي.',
  tags: ['Admin'],
  queryParams: {
    page: { type: 'integer', description: 'Page number / رقم الصفحة' },
    limit: { type: 'integer', description: 'Items per page / العناصر لكل صفحة' },
    role: { type: 'string', description: 'Filter by role / تصفية بالدور' },
  },
  permissionKey: 'admin.users.view',
});

registerRoute({
  path: '/api/admin/users',
  method: 'post',
  summary: 'Create user',
  description: 'Create a new user account in the current tenant.\n\nإنشاء حساب مستخدم جديد.',
  tags: ['Admin'],
  requestBody: createUserSchema,
  permissionKey: 'admin.users.create',
});

registerRoute({
  path: '/api/admin/roles',
  method: 'post',
  summary: 'Create role',
  description: 'Create a new role with permission set.\n\nإنشاء دور جديد مع مجموعة الصلاحيات.',
  tags: ['Admin'],
  requestBody: createRoleSchema,
  permissionKey: 'admin.roles.manage',
});

registerRoute({
  path: '/api/admin/hospitals',
  method: 'post',
  summary: 'Create hospital',
  description: 'Register a new hospital/facility in the tenant.\n\nتسجيل مستشفى/منشأة جديدة.',
  tags: ['Admin'],
  requestBody: createHospitalSchema,
  permissionKey: 'admin.hospitals.manage',
});

// ─── Patients ────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/patients/search',
  method: 'get',
  summary: 'Search patients',
  description: 'Search patients by name, MRN, national ID, or phone.\n\nالبحث عن المرضى بالاسم أو الرقم الطبي أو الهوية أو الهاتف.',
  tags: ['Patients'],
  queryParams: {
    q: { type: 'string', description: 'Search query / نص البحث', required: true },
    page: { type: 'integer', description: 'Page number / رقم الصفحة' },
    limit: { type: 'integer', description: 'Items per page / العناصر لكل صفحة' },
  },
  permissionKey: 'patients.search',
});

registerRoute({
  path: '/api/patients',
  method: 'post',
  summary: 'Create patient record',
  description: 'Register a new patient in the system.\n\nتسجيل مريض جديد في النظام.',
  tags: ['Patients'],
  requestBody: createPatientSchema,
  permissionKey: 'patients.create',
});

registerRoute({
  path: '/api/patients/{id}/demographics',
  method: 'put',
  summary: 'Update patient demographics',
  description: 'Update patient demographic information.\n\nتحديث البيانات الديموغرافية للمريض.',
  tags: ['Patients'],
  pathParams: { id: { type: 'string', description: 'Patient master ID / معرف المريض' } },
  requestBody: updatePatientSchema,
  permissionKey: 'patients.demographics.update',
});

registerRoute({
  path: '/api/patients/merge',
  method: 'post',
  summary: 'Merge duplicate patients',
  description: 'Merge two patient records into one. Requires acknowledgment of pending orders/billing.\n\nدمج سجلي مريض مكررين.',
  tags: ['Patients'],
  requestBody: mergePatientSchema,
  permissionKey: 'patients.merge',
});

// ─── Orders ──────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/orders',
  method: 'post',
  summary: 'Create clinical order',
  description: 'Create a new clinical order (lab, radiology, procedure, medication).\n\nإنشاء طلب سريري جديد.',
  tags: ['Orders'],
  requestBody: createOrderSchema,
  permissionKey: 'orders.create',
});

registerRoute({
  path: '/api/orders/{orderId}/cancel',
  method: 'post',
  summary: 'Cancel order',
  description: 'Cancel an existing clinical order.\n\nإلغاء طلب سريري.',
  tags: ['Orders'],
  pathParams: { orderId: { type: 'string', description: 'Order ID / معرف الطلب' } },
  requestBody: cancelOrderSchema,
  permissionKey: 'orders.cancel',
});

registerRoute({
  path: '/api/orders/{orderId}/results',
  method: 'get',
  summary: 'Get order results',
  description: 'Retrieve results associated with an order.\n\nاسترجاع نتائج الطلب.',
  tags: ['Orders'],
  pathParams: { orderId: { type: 'string', description: 'Order ID / معرف الطلب' } },
  permissionKey: 'orders.results.view',
});

registerRoute({
  path: '/api/orders/{orderId}/assign',
  method: 'post',
  summary: 'Assign order to staff',
  description: 'Assign a clinical order to a staff member for execution.\n\nتعيين طلب سريري لموظف.',
  tags: ['Orders'],
  pathParams: { orderId: { type: 'string', description: 'Order ID / معرف الطلب' } },
  requestBody: assignOrderSchema,
  permissionKey: 'orders.assign',
});

registerRoute({
  path: '/api/orders/queue',
  method: 'get',
  summary: 'Get orders queue',
  description: 'List pending orders filtered by department and status.\n\nعرض الطلبات المعلقة حسب القسم والحالة.',
  tags: ['Orders'],
  queryParams: {
    departmentKey: { type: 'string', description: 'Department key / مفتاح القسم' },
    status: { type: 'string', description: 'Order status filter / تصفية بحالة الطلب' },
    kind: { type: 'string', description: 'Order kind (LAB, RADIOLOGY, etc.) / نوع الطلب' },
  },
  permissionKey: 'orders.queue.view',
});

// ─── Scheduling ──────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/scheduling/resources',
  method: 'post',
  summary: 'Create scheduling resource',
  description: 'Register a new schedulable resource (clinic room, provider, equipment).\n\nتسجيل مورد جديد للجدولة.',
  tags: ['Scheduling'],
  requestBody: createResourceSchema,
  permissionKey: 'scheduling.resources.manage',
});

registerRoute({
  path: '/api/scheduling/templates',
  method: 'post',
  summary: 'Create scheduling template',
  description: 'Create a recurring availability template for a resource.\n\nإنشاء قالب توفر متكرر لمورد.',
  tags: ['Scheduling'],
  requestBody: createTemplateSchema,
  permissionKey: 'scheduling.templates.manage',
});

registerRoute({
  path: '/api/scheduling/slots/generate',
  method: 'post',
  summary: 'Generate time slots',
  description: 'Generate bookable time slots from templates for a date range.\n\nتوليد فترات زمنية قابلة للحجز.',
  tags: ['Scheduling'],
  requestBody: generateSlotsSchema,
  permissionKey: 'scheduling.slots.generate',
});

// ─── Notifications ───────────────────────────────────────────────────────────

registerRoute({
  path: '/api/notifications/inbox',
  method: 'get',
  summary: 'Get notification inbox',
  description: 'Retrieve unread and recent notifications for the current user.\n\nاسترجاع الإشعارات للمستخدم الحالي.',
  tags: ['Notifications'],
  queryParams: {
    page: { type: 'integer', description: 'Page number / رقم الصفحة' },
    limit: { type: 'integer', description: 'Items per page / العناصر لكل صفحة' },
    unreadOnly: { type: 'boolean', description: 'Only unread / غير المقروءة فقط' },
  },
  permissionKey: 'notifications.inbox.view',
});

// ─── System ──────────────────────────────────────────────────────────────────

registerRoute({
  path: '/api/health/db',
  method: 'get',
  summary: 'Database health check',
  description: 'Check database connectivity and server health status.\n\nفحص اتصال قاعدة البيانات وحالة الخادم.',
  tags: ['System'],
});
