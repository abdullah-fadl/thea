import { describe, it, expect } from 'vitest'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'

describe('CacheKeys', () => {
  const tenantId = 'tenant-abc'

  // ─── Dashboard / Analytics ────────────────────────────────

  it('opdDashboard includes tenantId', () => {
    expect(CacheKeys.opdDashboard(tenantId)).toBe('opd:dashboard:tenant-abc')
  })

  it('opdAnalytics includes tenantId and period', () => {
    expect(CacheKeys.opdAnalytics(tenantId, 'daily')).toBe('opd:analytics:tenant-abc:daily')
  })

  it('opdAnalyticsWithDept includes tenantId, period, and departmentId', () => {
    expect(CacheKeys.opdAnalyticsWithDept(tenantId, 'weekly', 'dept-1')).toBe(
      'opd:analytics:tenant-abc:weekly:dept-1'
    )
  })

  // ─── Departments ──────────────────────────────────────────

  it('departments includes tenantId', () => {
    expect(CacheKeys.departments(tenantId)).toBe('departments:tenant-abc')
  })

  it('departmentsByFloor includes tenantId and floorKey', () => {
    expect(CacheKeys.departmentsByFloor(tenantId, 'floor-2')).toBe(
      'departments:tenant-abc:floor:floor-2'
    )
  })

  it('departmentsWithDeleted includes tenantId', () => {
    expect(CacheKeys.departmentsWithDeleted(tenantId)).toBe(
      'departments:tenant-abc:with-deleted'
    )
  })

  it('department includes tenantId and deptId', () => {
    expect(CacheKeys.department(tenantId, 'dept-x')).toBe('department:tenant-abc:dept-x')
  })

  // ─── Scheduling ───────────────────────────────────────────

  it('schedulingResources includes tenantId', () => {
    expect(CacheKeys.schedulingResources(tenantId)).toBe('scheduling:resources:tenant-abc')
  })

  it('schedulingResourcesFiltered includes tenantId and filterHash', () => {
    expect(CacheKeys.schedulingResourcesFiltered(tenantId, 'hash123')).toBe(
      'scheduling:resources:tenant-abc:hash123'
    )
  })

  it('schedulingSlots includes tenantId, resourceId, and date', () => {
    expect(CacheKeys.schedulingSlots(tenantId, 'res-1', '2024-06-01')).toBe(
      'scheduling:slots:tenant-abc:res-1:2024-06-01'
    )
  })

  // ─── Providers ────────────────────────────────────────────

  it('providers includes tenantId', () => {
    expect(CacheKeys.providers(tenantId)).toBe('providers:tenant-abc')
  })

  // ─── Patients ─────────────────────────────────────────────

  it('patientSearch includes tenantId and query', () => {
    expect(CacheKeys.patientSearch(tenantId, 'john')).toBe('patient:search:tenant-abc:john')
  })

  it('patient includes tenantId and patientId', () => {
    expect(CacheKeys.patient(tenantId, 'pat-1')).toBe('patient:tenant-abc:pat-1')
  })

  // ─── System ───────────────────────────────────────────────

  it('systemSettings includes tenantId', () => {
    expect(CacheKeys.systemSettings(tenantId)).toBe('system:settings:tenant-abc')
  })
})

describe('CacheTTL', () => {
  it('DASHBOARD is 5 minutes (300 seconds)', () => {
    expect(CacheTTL.DASHBOARD).toBe(300)
  })

  it('ANALYTICS is 5 minutes (300 seconds)', () => {
    expect(CacheTTL.ANALYTICS).toBe(300)
  })

  it('DEPARTMENTS is 30 minutes (1800 seconds)', () => {
    expect(CacheTTL.DEPARTMENTS).toBe(1800)
  })

  it('SCHEDULING is 10 minutes (600 seconds)', () => {
    expect(CacheTTL.SCHEDULING).toBe(600)
  })

  it('PROVIDERS is 15 minutes (900 seconds)', () => {
    expect(CacheTTL.PROVIDERS).toBe(900)
  })

  it('PATIENT_SEARCH is 2 minutes (120 seconds)', () => {
    expect(CacheTTL.PATIENT_SEARCH).toBe(120)
  })

  it('PATIENT is 5 minutes (300 seconds)', () => {
    expect(CacheTTL.PATIENT).toBe(300)
  })

  it('SYSTEM_SETTINGS is 30 minutes (1800 seconds)', () => {
    expect(CacheTTL.SYSTEM_SETTINGS).toBe(1800)
  })

  it('all TTL values are positive numbers', () => {
    for (const [key, value] of Object.entries(CacheTTL)) {
      expect(value, `CacheTTL.${key}`).toBeGreaterThan(0)
      expect(typeof value).toBe('number')
    }
  })
})
