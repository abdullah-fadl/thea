import { describe, it, expect } from 'vitest'
import { APP_CONFIG, appConfig, getAppName, getLegacyAppName } from '@/lib/config'

describe('APP_CONFIG', () => {
  it('has name "Thea"', () => {
    expect(APP_CONFIG.name).toBe('Thea')
  })

  it('has fullName "Thea EHR"', () => {
    expect(APP_CONFIG.fullName).toBe('Thea EHR')
  })

  it('has Arabic name', () => {
    expect(APP_CONFIG.nameArabic).toBe('\u062b\u064a\u0627')
  })

  it('has a version string', () => {
    expect(typeof APP_CONFIG.version).toBe('string')
    expect(APP_CONFIG.version.length).toBeGreaterThan(0)
  })

  it('has thea-owner role constant', () => {
    expect(APP_CONFIG.roles.THEA_OWNER).toBe('thea-owner')
  })

  it('has platform entries for health and sam', () => {
    expect(APP_CONFIG.platforms.health.name).toBe('Thea Health')
    expect(APP_CONFIG.platforms.sam.name).toBe('SAM')
  })

  it('has no syra references', () => {
    const configStr = JSON.stringify(APP_CONFIG).toLowerCase()
    expect(configStr).not.toContain('syra')
  })
})

describe('appConfig', () => {
  it('returns name from APP_CONFIG or env', () => {
    expect(typeof appConfig.name).toBe('string')
    expect(appConfig.name.length).toBeGreaterThan(0)
  })

  it('title returns Thea EHR', () => {
    expect(appConfig.title).toBe('Thea EHR')
  })

  it('description is non-empty', () => {
    expect(appConfig.description.length).toBeGreaterThan(0)
  })
})

describe('getAppName()', () => {
  it('returns Thea for English', () => {
    expect(getAppName('en')).toBe('Thea')
  })

  it('returns Arabic name for Arabic', () => {
    expect(getAppName('ar')).toBe('\u062b\u064a\u0627')
  })

  it('returns full English name with context "full"', () => {
    expect(getAppName('en', 'full')).toBe('Thea Electronic Health Records')
  })

  it('returns full Arabic name with context "full"', () => {
    const result = getAppName('ar', 'full')
    expect(result).toContain('\u062b\u064a\u0627')
  })

  it('defaults to English', () => {
    expect(getAppName()).toBe('Thea')
  })
})

describe('getLegacyAppName()', () => {
  it('returns Thea', () => {
    expect(getLegacyAppName()).toBe('Thea')
  })
})
