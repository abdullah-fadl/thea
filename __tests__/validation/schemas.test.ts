import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  identifySchema,
  changePasswordSchema,
  saveSessionStateSchema,
  switchTenantSchema,
  twoFactorVerifySchema,
  twoFactorDisableSchema,
  twoFactorLoginSchema,
  passwordStrengthSchema,
} from '@/lib/validation/auth.schema'
import {
  createPatientSchema,
  mergePatientSchema,
} from '@/lib/validation/patient.schema'
import {
  paginationSchema,
  objectIdString,
  requiredId,
  genderEnum,
  priorityEnum,
  departmentDomainEnum,
} from '@/lib/validation/shared.schema'

// ═════════════════════════════════════════════════════════════
// Auth Schemas
// ═════════════════════════════════════════════════════════════

describe('loginSchema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts login with optional tenantId', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
      tenantId: 'tenant-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'abc' })
    expect(result.success).toBe(false)
  })

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com' })
    expect(result.success).toBe(false)
  })
})

describe('identifySchema', () => {
  it('accepts valid email', () => {
    const result = identifySchema.safeParse({ email: 'user@test.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = identifySchema.safeParse({ email: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldPass',
      newPassword: 'newPass12345',
    })
    expect(result.success).toBe(true)
  })

  it('rejects new password shorter than 8 chars', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('accepts when currentPassword is optional', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'newpassword',
    })
    expect(result.success).toBe(true)
  })
})

describe('switchTenantSchema', () => {
  it('accepts valid tenantId', () => {
    const result = switchTenantSchema.safeParse({ tenantId: 'tenant-abc' })
    expect(result.success).toBe(true)
  })

  it('rejects empty tenantId', () => {
    const result = switchTenantSchema.safeParse({ tenantId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing tenantId', () => {
    const result = switchTenantSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('twoFactorVerifySchema', () => {
  it('accepts 6-character token', () => {
    const result = twoFactorVerifySchema.safeParse({ token: '123456' })
    expect(result.success).toBe(true)
  })

  it('rejects token shorter than 6', () => {
    const result = twoFactorVerifySchema.safeParse({ token: '12345' })
    expect(result.success).toBe(false)
  })

  it('rejects token longer than 6', () => {
    const result = twoFactorVerifySchema.safeParse({ token: '1234567' })
    expect(result.success).toBe(false)
  })
})

describe('twoFactorDisableSchema', () => {
  it('accepts valid disable request', () => {
    const result = twoFactorDisableSchema.safeParse({
      password: 'mypass',
      token: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty password', () => {
    const result = twoFactorDisableSchema.safeParse({ password: '', token: '123456' })
    expect(result.success).toBe(false)
  })
})

describe('twoFactorLoginSchema', () => {
  it('accepts valid 2FA login', () => {
    const result = twoFactorLoginSchema.safeParse({
      tempToken: 'temp-token-xyz',
      token: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty tempToken', () => {
    const result = twoFactorLoginSchema.safeParse({ tempToken: '', token: '123456' })
    expect(result.success).toBe(false)
  })
})

describe('passwordStrengthSchema', () => {
  it('accepts valid password', () => {
    const result = passwordStrengthSchema.safeParse({ password: 'testPassword' })
    expect(result.success).toBe(true)
  })

  it('accepts with optional email and name', () => {
    const result = passwordStrengthSchema.safeParse({
      password: 'testPassword',
      email: 'user@test.com',
      name: 'John',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty password', () => {
    const result = passwordStrengthSchema.safeParse({ password: '' })
    expect(result.success).toBe(false)
  })
})

describe('saveSessionStateSchema', () => {
  it('accepts valid session state', () => {
    const result = saveSessionStateSchema.safeParse({
      lastRoute: '/dashboard',
      lastPlatformKey: 'thea_health',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all optional)', () => {
    const result = saveSessionStateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════
// Patient Schemas
// ═════════════════════════════════════════════════════════════

describe('createPatientSchema', () => {
  it('accepts valid patient data', () => {
    const result = createPatientSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
    })
    expect(result.success).toBe(true)
  })

  it('accepts patient with all optional fields', () => {
    const result = createPatientSchema.safeParse({
      firstName: 'Jane',
      lastName: 'Smith',
      dob: '1990-01-01',
      gender: 'FEMALE',
      nationality: 'US',
      mobile: '+1234567890',
      email: 'jane@test.com',
      bloodType: 'A+',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const result = createPatientSchema.safeParse({
      firstName: '',
      lastName: 'Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty lastName', () => {
    const result = createPatientSchema.safeParse({
      firstName: 'John',
      lastName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing firstName', () => {
    const result = createPatientSchema.safeParse({ lastName: 'Doe' })
    expect(result.success).toBe(false)
  })

  it('accepts allergies as array', () => {
    const result = createPatientSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      knownAllergies: ['penicillin', 'aspirin'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts allergies as string', () => {
    const result = createPatientSchema.safeParse({
      firstName: 'John',
      lastName: 'Doe',
      knownAllergies: 'penicillin',
    })
    expect(result.success).toBe(true)
  })
})

describe('mergePatientSchema', () => {
  it('accepts valid merge request', () => {
    const result = mergePatientSchema.safeParse({
      sourcePatientId: 'patient-1',
      targetPatientId: 'patient-2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty sourcePatientId', () => {
    const result = mergePatientSchema.safeParse({
      sourcePatientId: '',
      targetPatientId: 'patient-2',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty targetPatientId', () => {
    const result = mergePatientSchema.safeParse({
      sourcePatientId: 'patient-1',
      targetPatientId: '',
    })
    expect(result.success).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
// Shared Schemas
// ═════════════════════════════════════════════════════════════

describe('paginationSchema', () => {
  it('accepts valid pagination', () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 20 })
    expect(result.success).toBe(true)
  })

  it('provides defaults for missing values', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('rejects page < 1', () => {
    const result = paginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit > 200', () => {
    const result = paginationSchema.safeParse({ limit: 201 })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })
})

describe('objectIdString', () => {
  it('accepts valid 24-char hex string', () => {
    const result = objectIdString.safeParse('507f1f77bcf86cd799439011')
    expect(result.success).toBe(true)
  })

  it('rejects short string', () => {
    const result = objectIdString.safeParse('507f1f77')
    expect(result.success).toBe(false)
  })

  it('rejects non-hex characters', () => {
    const result = objectIdString.safeParse('507f1f77bcf86cd79943901z')
    expect(result.success).toBe(false)
  })
})

describe('requiredId', () => {
  it('accepts non-empty string', () => {
    const result = requiredId.safeParse('abc-123')
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = requiredId.safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('genderEnum', () => {
  it('accepts valid gender values', () => {
    for (const g of ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']) {
      expect(genderEnum.safeParse(g).success).toBe(true)
    }
  })

  it('rejects invalid gender', () => {
    expect(genderEnum.safeParse('INVALID').success).toBe(false)
  })
})

describe('priorityEnum', () => {
  it('accepts all priority values', () => {
    for (const p of ['URGENT', 'HIGH', 'NORMAL', 'LOW']) {
      expect(priorityEnum.safeParse(p).success).toBe(true)
    }
  })

  it('rejects invalid priority', () => {
    expect(priorityEnum.safeParse('MEDIUM').success).toBe(false)
  })
})

describe('departmentDomainEnum', () => {
  it('accepts valid department domains', () => {
    for (const d of ['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']) {
      expect(departmentDomainEnum.safeParse(d).success).toBe(true)
    }
  })

  it('rejects invalid domain', () => {
    expect(departmentDomainEnum.safeParse('PHARMACY').success).toBe(false)
  })
})
