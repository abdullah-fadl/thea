import { describe, it, expect } from 'vitest'
import {
  waitingToNursingMinutes,
  waitingToDoctorMinutes,
} from '@/lib/opd/waiting'

describe('waitingToNursingMinutes()', () => {
  const now = new Date('2024-06-15T10:00:00Z')

  it('returns minutes between arrived and nursing start', () => {
    const arrived = new Date('2024-06-15T09:30:00Z')
    const nursingStart = new Date('2024-06-15T09:45:00Z')
    expect(waitingToNursingMinutes(now, arrived, nursingStart)).toBe(15)
  })

  it('uses now as end time when nursing start is not set', () => {
    const arrived = new Date('2024-06-15T09:30:00Z')
    expect(waitingToNursingMinutes(now, arrived, null)).toBe(30)
  })

  it('returns null when arrivedAt is not set', () => {
    expect(waitingToNursingMinutes(now, null, null)).toBeNull()
    expect(waitingToNursingMinutes(now, undefined, null)).toBeNull()
  })

  it('accepts string dates', () => {
    const result = waitingToNursingMinutes(
      now,
      '2024-06-15T09:50:00Z',
      '2024-06-15T09:55:00Z'
    )
    expect(result).toBe(5)
  })

  it('returns 0 for same time', () => {
    const time = new Date('2024-06-15T09:30:00Z')
    expect(waitingToNursingMinutes(now, time, time)).toBe(0)
  })

  it('returns null for invalid arrivedAt', () => {
    expect(waitingToNursingMinutes(now, 'not-a-date', null)).toBeNull()
  })

  it('returns 0 (not negative) when end is before start', () => {
    const arrived = new Date('2024-06-15T10:00:00Z')
    const nursingStart = new Date('2024-06-15T09:50:00Z')
    expect(waitingToNursingMinutes(now, arrived, nursingStart)).toBe(0)
  })
})

describe('waitingToDoctorMinutes()', () => {
  const now = new Date('2024-06-15T10:00:00Z')

  it('returns minutes between nursing end and doctor start', () => {
    const nursingEnd = new Date('2024-06-15T09:40:00Z')
    const doctorStart = new Date('2024-06-15T09:55:00Z')
    expect(waitingToDoctorMinutes(now, nursingEnd, doctorStart)).toBe(15)
  })

  it('uses now as end time when doctor start is not set', () => {
    const nursingEnd = new Date('2024-06-15T09:40:00Z')
    expect(waitingToDoctorMinutes(now, nursingEnd, null)).toBe(20)
  })

  it('returns null when nursingEndAt is not set', () => {
    expect(waitingToDoctorMinutes(now, null, null)).toBeNull()
    expect(waitingToDoctorMinutes(now, undefined, null)).toBeNull()
  })

  it('accepts string dates', () => {
    const result = waitingToDoctorMinutes(
      now,
      '2024-06-15T09:30:00Z',
      '2024-06-15T09:45:00Z'
    )
    expect(result).toBe(15)
  })
})
