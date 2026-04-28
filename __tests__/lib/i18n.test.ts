import { describe, it, expect, vi } from 'vitest'

// Mock the config module that i18n.ts imports
vi.mock('@/lib/config', () => ({
  appConfig: {
    name: 'Thea',
    code: 'sam',
    type: 'policy_platform',
    get title() { return 'Thea EHR' },
    get description() { return 'Advanced Electronic Health Records System' },
  },
  APP_CONFIG: {
    name: 'Thea',
    fullName: 'Thea EHR',
    nameArabic: '\u062b\u064a\u0627',
  },
  getAppName: (lang: string) => lang === 'ar' ? '\u062b\u064a\u0627' : 'Thea',
}))

import { t, getTranslations, translations } from '@/lib/i18n/index'

describe('t() -- translation function', () => {
  // --- English translations ---

  it('returns English translation for simple common keys', () => {
    expect(t('common.save', 'en')).toBe('Save')
    expect(t('common.cancel', 'en')).toBe('Cancel')
    expect(t('common.delete', 'en')).toBe('Delete')
  })

  it('returns English nav translations', () => {
    expect(t('nav.dashboard', 'en')).toBe('Dashboard')
    expect(t('nav.notifications', 'en')).toBe('Notifications')
    expect(t('nav.er', 'en')).toBe('Emergency Room')
  })

  it('returns English nav OPD translations', () => {
    expect(t('nav.opd', 'en')).toBe('OPD')
    expect(t('nav.opdHome', 'en')).toBe('Home')
    expect(t('nav.opdDashboard', 'en')).toBe('OPD Dashboard')
    expect(t('nav.opdNurseStation', 'en')).toBe('Nurse Station')
  })

  it('returns English common edit/add/search', () => {
    expect(t('common.edit', 'en')).toBe('Edit')
    expect(t('common.add', 'en')).toBe('Add')
    expect(t('common.search', 'en')).toBe('Search')
  })

  // --- Arabic translations ---

  it('returns Arabic translation for common keys', () => {
    expect(t('common.save', 'ar')).toBe('\u062d\u0641\u0638')
    expect(t('common.cancel', 'ar')).toBe('\u0625\u0644\u063a\u0627\u0621')
    expect(t('common.delete', 'ar')).toBe('\u062d\u0630\u0641')
  })

  it('returns Arabic nav translations', () => {
    expect(t('nav.dashboard', 'ar')).toBe('\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645')
    expect(t('nav.er', 'ar')).toBe('\u0627\u0644\u0637\u0648\u0627\u0631\u0626')
  })

  it('returns Arabic roles translations', () => {
    expect(t('roles.admin', 'ar')).toBe('\u0645\u0633\u0624\u0648\u0644')
    expect(t('roles.supervisor', 'ar')).toBe('\u0645\u0634\u0631\u0641')
  })

  // --- Default language ---

  it('defaults to English when no language specified', () => {
    expect(t('common.save')).toBe('Save')
  })

  // --- Missing keys ---

  it('returns the key itself for missing translation', () => {
    expect(t('nonexistent.key', 'en')).toBe('nonexistent.key')
    expect(t('nonexistent.key', 'ar')).toBe('nonexistent.key')
  })

  it('returns key for partially valid path', () => {
    expect(t('common.nonexistent', 'en')).toBe('common.nonexistent')
  })

  it('returns key for empty string', () => {
    expect(t('', 'en')).toBe('')
  })

  // --- Nested keys ---

  it('resolves deeply nested keys (px.setup.title)', () => {
    expect(t('px.setup.title', 'en')).toBe('Patient Experience Setup')
  })

  it('resolves deeply nested keys (px.visit.title)', () => {
    expect(t('px.visit.title', 'en')).toBe('Patient Experience')
  })

  it('returns key when path points to an object, not a string', () => {
    // 'common' is an object, not a string
    expect(t('common', 'en')).toBe('common')
  })

  // --- Keys not yet implemented return the key ---

  it('returns translated auth keys and dashboard keys', () => {
    // auth section was implemented in en.ts/ar.ts
    expect(t('auth.login', 'en')).toBe('Log in')
    // dashboard.home was implemented — returns 'Home'
    expect(t('dashboard.home', 'en')).toBe('Home')
  })
})

describe('getTranslations()', () => {
  it('returns an object with en and ar translations', () => {
    const result = getTranslations('common.save')
    expect(result).toEqual({
      en: 'Save',
      ar: '\u062d\u0641\u0638',
    })
  })

  it('returns keys for missing translations', () => {
    const result = getTranslations('nonexistent.path')
    expect(result).toEqual({
      en: 'nonexistent.path',
      ar: 'nonexistent.path',
    })
  })

  it('works for nested paths', () => {
    const result = getTranslations('px.setup.title')
    expect(result.en).toBe('Patient Experience Setup')
    expect(typeof result.ar).toBe('string')
    expect(result.ar.length).toBeGreaterThan(0)
  })

  it('works for nav translations', () => {
    const result = getTranslations('nav.dashboard')
    expect(result.en).toBe('Dashboard')
    expect(result.ar).toBe('\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645')
  })
})

describe('translation completeness', () => {
  it('common section has the same keys in both languages', () => {
    const enKeys = Object.keys(translations.en.common)
    const arKeys = Object.keys(translations.ar.common)
    expect(enKeys.sort()).toEqual(arKeys.sort())
  })

  it('roles section has the same keys in both languages', () => {
    const enKeys = Object.keys(translations.en.roles)
    const arKeys = Object.keys(translations.ar.roles)
    expect(enKeys.sort()).toEqual(arKeys.sort())
  })

  it('nav section has the same keys in both languages', () => {
    const enKeys = Object.keys(translations.en.nav)
    const arKeys = Object.keys(translations.ar.nav)
    expect(enKeys.sort()).toEqual(arKeys.sort())
  })

  it('px section has the same top-level keys in both languages', () => {
    const enKeys = Object.keys(translations.en.px)
    const arKeys = Object.keys(translations.ar.px)
    expect(enKeys.sort()).toEqual(arKeys.sort())
  })
})
