import { describe, it, expect } from 'vitest'
import { deriveOpdStatus } from '@/lib/opd/status'

describe('deriveOpdStatus()', () => {
  it('returns CHECKED_IN when checkedInAt is set', () => {
    expect(deriveOpdStatus({
      checkedInAt: new Date('2024-01-01T10:00:00Z'),
      arrivedAt: new Date('2024-01-01T09:00:00Z'),
    })).toBe('CHECKED_IN')
  })

  it('returns ARRIVED when only arrivedAt is set', () => {
    expect(deriveOpdStatus({
      arrivedAt: new Date('2024-01-01T09:00:00Z'),
    })).toBe('ARRIVED')
  })

  it('returns BOOKED when neither is set', () => {
    expect(deriveOpdStatus({})).toBe('BOOKED')
  })

  it('returns BOOKED when both are null', () => {
    expect(deriveOpdStatus({ checkedInAt: null, arrivedAt: null })).toBe('BOOKED')
  })

  it('returns BOOKED when both are undefined', () => {
    expect(deriveOpdStatus({ checkedInAt: undefined, arrivedAt: undefined })).toBe('BOOKED')
  })

  it('accepts string dates', () => {
    expect(deriveOpdStatus({
      checkedInAt: '2024-01-01T10:00:00Z',
    })).toBe('CHECKED_IN')
  })

  it('handles invalid date for checkedInAt', () => {
    expect(deriveOpdStatus({
      checkedInAt: 'not-a-date',
      arrivedAt: '2024-01-01T09:00:00Z',
    })).toBe('ARRIVED')
  })

  it('handles invalid date for arrivedAt', () => {
    expect(deriveOpdStatus({
      arrivedAt: 'invalid',
    })).toBe('BOOKED')
  })

  it('checkedInAt takes priority over arrivedAt', () => {
    expect(deriveOpdStatus({
      checkedInAt: '2024-06-15T08:00:00Z',
      arrivedAt: '2024-06-15T07:30:00Z',
    })).toBe('CHECKED_IN')
  })
})
