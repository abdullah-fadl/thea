/**
 * CVision System Administration Engine
 * Tenant settings, branding, modules, custom fields, email templates
 */
import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { v4 as uuidv4 } from 'uuid';

const SETTINGS_COL = 'cvision_tenant_settings';

const DEFAULT_SETTINGS = {
  company: { name: '', nameAr: '', logo: '', crNumber: '', industry: '', size: '', address: '', phone: '', email: '' },
  branding: { primaryColor: '#2563eb', secondaryColor: '#1e40af', accentColor: '#f59e0b', darkMode: false },
  enabledModules: [] as Record<string, unknown>[],
  customFields: [] as Record<string, unknown>[],
  customDropdowns: [] as Record<string, unknown>[],
  emailTemplates: [
    { event: 'leave_approved', subject: 'Leave Request Approved', body: 'Your leave has been approved.', enabled: true },
    { event: 'payslip_ready', subject: 'Payslip Available', body: 'Your payslip is ready to view.', enabled: true },
    { event: 'contract_renewal', subject: 'Contract Renewal', body: 'Your contract is due for renewal.', enabled: true },
    { event: 'welcome', subject: 'Welcome to the Team', body: 'Welcome! Your account has been created.', enabled: true },
  ],
  workSchedule: {
    workDays: [0, 1, 2, 3, 4],       // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu — Saudi default
    restDays: [5, 6],                 // 5=Fri, 6=Sat
    defaultStartTime: '08:00',
    defaultEndTime: '17:00',
    defaultWorkingHours: 8,
    breakDurationMinutes: 60,
    graceMinutes: 15,
  },
  preferences: {
    defaultLanguage: 'en', dateFormat: 'DD/MM/YYYY', numberFormat: 'EN',
    calendarType: 'GREGORIAN', timezone: 'Asia/Riyadh', weekStart: 'SUN',
    currency: 'SAR', fiscalYearStart: 1,
  },
  dataRetention: { auditLogDays: 365, deletedRecordsDays: 90, sessionTimeoutMinutes: 30, passwordExpiryDays: 90 },
};

async function ensureSettings(db: Db, tenantId: string) {
  const exists = await db.collection(SETTINGS_COL).findOne({ tenantId });
  if (!exists) {
    await db.collection(SETTINGS_COL).insertOne({ tenantId, ...DEFAULT_SETTINGS, updatedAt: new Date() });
  }
}

export async function getSettings(db: Db, tenantId: string): Promise<any> {
  await ensureSettings(db, tenantId);
  return db.collection(SETTINGS_COL).findOne({ tenantId });
}

export async function updateSettings(db: Db, tenantId: string, section: string, data: any): Promise<{ success: boolean }> {
  await ensureSettings(db, tenantId);
  await db.collection(SETTINGS_COL).updateOne({ tenantId }, { $set: { [section]: data, updatedAt: new Date() } });
  return { success: true };
}

export async function updateBranding(db: Db, tenantId: string, branding: any): Promise<{ success: boolean }> {
  return updateSettings(db, tenantId, 'branding', branding);
}

export async function toggleModule(db: Db, tenantId: string, module: string, enabled: boolean): Promise<{ success: boolean }> {
  await ensureSettings(db, tenantId);
  const settings = await db.collection(SETTINGS_COL).findOne({ tenantId });
  const modules = settings?.enabledModules || [];
  const idx = modules.findIndex((m: any) => m.module === module);
  if (idx >= 0) { modules[idx].enabled = enabled; }
  else { modules.push({ module, enabled, label: module }); }
  await db.collection(SETTINGS_COL).updateOne({ tenantId }, { $set: { enabledModules: modules, updatedAt: new Date() } });
  return { success: true };
}

export async function addCustomField(db: Db, tenantId: string, module: string, field: any): Promise<{ success: boolean }> {
  await ensureSettings(db, tenantId);
  const settings = await db.collection(SETTINGS_COL).findOne({ tenantId });
  const customFields = settings?.customFields || [];
  const moduleFields = customFields.find((cf: any) => cf.module === module);
  if (moduleFields) {
    moduleFields.fields.push({ fieldId: `cf_${Date.now()}`, ...field, order: moduleFields.fields.length });
  } else {
    customFields.push({ module, fields: [{ fieldId: `cf_${Date.now()}`, ...field, order: 0 }] });
  }
  await db.collection(SETTINGS_COL).updateOne({ tenantId }, { $set: { customFields, updatedAt: new Date() } });
  return { success: true };
}

export async function updateEmailTemplate(db: Db, tenantId: string, event: string, data: any): Promise<{ success: boolean }> {
  await ensureSettings(db, tenantId);
  const settings = await db.collection(SETTINGS_COL).findOne({ tenantId });
  const templates = settings?.emailTemplates || [];
  const idx = templates.findIndex((t: any) => t.event === event);
  if (idx >= 0) { Object.assign(templates[idx], data); }
  else { templates.push({ event, ...data }); }
  await db.collection(SETTINGS_COL).updateOne({ tenantId }, { $set: { emailTemplates: templates, updatedAt: new Date() } });
  return { success: true };
}

export async function updatePreferences(db: Db, tenantId: string, prefs: any): Promise<{ success: boolean }> {
  return updateSettings(db, tenantId, 'preferences', prefs);
}

export interface SplitShiftSegment {
  label: string;        // "Morning", "Evening"
  startTime: string;    // "07:00"
  endTime: string;      // "11:00"
}

export interface WorkScheduleSettings {
  workDays: number[];
  restDays: number[];
  defaultStartTime: string;
  defaultEndTime: string;
  defaultWorkingHours: number;
  breakDurationMinutes: number;
  graceMinutes: number;
  splitShiftEnabled?: boolean;
  splitShiftSegments?: SplitShiftSegment[];
}

export interface DepartmentWorkSchedule {
  id: string;
  tenantId: string;
  departmentId: string;
  workDays?: number[];
  restDays?: number[];
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultWorkingHours?: number;
  breakDurationMinutes?: number;
  graceMinutes?: number;
  splitShiftEnabled?: boolean;
  splitShiftSegments?: SplitShiftSegment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeWorkSchedule {
  startTime?: string;
  endTime?: string;
  workingHours?: number;
  workDays?: number[];
  restDays?: number[];
  breakDurationMinutes?: number;
  graceMinutes?: number;
  splitShiftEnabled?: boolean;
  splitShiftSegments?: SplitShiftSegment[];
}

const DEFAULT_WORK_SCHEDULE: WorkScheduleSettings = DEFAULT_SETTINGS.workSchedule;

export async function getWorkSchedule(db: Db, tenantId: string): Promise<WorkScheduleSettings> {
  const settings = await getSettings(db, tenantId);
  return { ...DEFAULT_WORK_SCHEDULE, ...(settings?.workSchedule || {}) };
}

export async function updateWorkSchedule(db: Db, tenantId: string, ws: Partial<WorkScheduleSettings>): Promise<{ success: boolean }> {
  const current = await getWorkSchedule(db, tenantId);
  return updateSettings(db, tenantId, 'workSchedule', { ...current, ...ws });
}

export function getDefaultWorkSchedule(): WorkScheduleSettings {
  return { ...DEFAULT_WORK_SCHEDULE };
}

export async function getModules(db: Db, tenantId: string): Promise<any[]> {
  const settings = await getSettings(db, tenantId);
  return settings?.enabledModules || [];
}

export async function getCustomFields(db: Db, tenantId: string, module?: string): Promise<any[]> {
  const settings = await getSettings(db, tenantId);
  const fields = settings?.customFields || [];
  if (module) return fields.filter((f: any) => f.module === module);
  return fields;
}

export async function getEmailTemplates(db: Db, tenantId: string): Promise<any[]> {
  const settings = await getSettings(db, tenantId);
  return settings?.emailTemplates || [];
}

export async function getSystemHealth(db: Db, tenantId: string): Promise<any> {
  const employees = await db.collection('cvision_employees').countDocuments({ tenantId });
  const collections = await db.listCollections().toArray();
  const cvisionCollections = collections.filter(c => c.name.startsWith('cvision_'));
  return { status: 'HEALTHY', employees, collections: cvisionCollections.length, uptime: process.uptime(), timestamp: new Date() };
}

export async function getUsageStats(db: Db, tenantId: string): Promise<any> {
  const employees = await db.collection('cvision_employees').countDocuments({ tenantId });
  const active = await db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE' });
  const departments = await db.collection('cvision_departments').countDocuments({ tenantId });
  const requests = await db.collection('cvision_requests').countDocuments({ tenantId });
  return { totalEmployees: employees, activeEmployees: active, departments, requests };
}

export async function getStorageUsage(db: Db, tenantId: string): Promise<any> {
  const collections = await db.listCollections().toArray();
  const usage: any[] = [];
  for (const col of collections.filter(c => c.name.startsWith('cvision_'))) {
    const count = await db.collection(col.name).countDocuments({ tenantId });
    usage.push({ collection: col.name, documents: count });
  }
  return { collections: usage, totalCollections: usage.length };
}

// =============================================================================
// Department Work Schedule Overrides
// =============================================================================

const DEPT_WS_COL = 'cvision_department_work_schedules';

export async function getDepartmentWorkSchedule(
  db: Db, tenantId: string, departmentId: string
): Promise<DepartmentWorkSchedule | null> {
  return db.collection(DEPT_WS_COL).findOne({ tenantId, departmentId }) as Promise<DepartmentWorkSchedule | null>;
}

export async function getAllDepartmentWorkSchedules(
  db: Db, tenantId: string
): Promise<DepartmentWorkSchedule[]> {
  return db.collection(DEPT_WS_COL).find({ tenantId }).toArray() as Promise<DepartmentWorkSchedule[]>;
}

export async function updateDepartmentWorkSchedule(
  db: Db, tenantId: string, departmentId: string, ws: Partial<DepartmentWorkSchedule>
): Promise<{ success: boolean }> {
  const now = new Date();
  const { id: _id, tenantId: _t, departmentId: _d, createdAt: _c, ...updates } = ws as Record<string, unknown>;
  await db.collection(DEPT_WS_COL).updateOne(
    { tenantId, departmentId },
    {
      $set: { ...updates, tenantId, departmentId, updatedAt: now },
      $setOnInsert: { id: uuidv4(), createdAt: now },
    },
    { upsert: true }
  );
  return { success: true };
}

export async function deleteDepartmentWorkSchedule(
  db: Db, tenantId: string, departmentId: string
): Promise<{ success: boolean }> {
  await db.collection(DEPT_WS_COL).deleteOne({ tenantId, departmentId });
  return { success: true };
}

// =============================================================================
// Work Schedule Resolution — Tenant → Department → Employee
// =============================================================================

/**
 * Resolve the effective work schedule for a given context.
 * Priority: Employee override → Department override → Tenant default
 */
export async function resolveWorkSchedule(
  db: Db,
  tenantId: string,
  departmentId?: string,
  employeeId?: string
): Promise<WorkScheduleSettings> {
  // 1. Start with tenant default
  const tenantWs = await getWorkSchedule(db, tenantId);
  const effective: any = { ...tenantWs };

  // 2. Layer department override
  if (departmentId) {
    const deptWs = await getDepartmentWorkSchedule(db, tenantId, departmentId);
    if (deptWs) {
      const overrideKeys: (keyof WorkScheduleSettings)[] = [
        'workDays', 'restDays', 'defaultStartTime', 'defaultEndTime',
        'defaultWorkingHours', 'breakDurationMinutes', 'graceMinutes',
        'splitShiftEnabled', 'splitShiftSegments',
      ];
      for (const key of overrideKeys) {
        if (deptWs[key as keyof DepartmentWorkSchedule] !== undefined && deptWs[key as keyof DepartmentWorkSchedule] !== null) {
          effective[key] = deptWs[key as keyof DepartmentWorkSchedule];
        }
      }
    }
  }

  // 3. Layer employee override
  if (employeeId) {
    const emp = await db.collection('cvision_employees').findOne({
      tenantId,
      $or: [{ id: employeeId }, { employeeId }],
    });
    if (emp?.workSchedule) {
      for (const key of Object.keys(emp.workSchedule)) {
        if (emp.workSchedule[key] !== undefined && emp.workSchedule[key] !== null) {
          // Map employee fields to WorkScheduleSettings fields
          if (key === 'startTime') effective.defaultStartTime = emp.workSchedule[key];
          else if (key === 'endTime') effective.defaultEndTime = emp.workSchedule[key];
          else if (key === 'workingHours') effective.defaultWorkingHours = emp.workSchedule[key];
          else effective[key] = emp.workSchedule[key];
        }
      }
    }
  }

  return effective as WorkScheduleSettings;
}
