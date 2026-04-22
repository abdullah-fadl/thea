import { describe, it, expect } from 'vitest'
import {
  getAllowedOpdFlowTransitions,
  isOpdFlowTransitionAllowed,
} from '@/lib/opd/flowState'

describe('getAllowedOpdFlowTransitions()', () => {
  it('returns START with all transitions for null/undefined input', () => {
    const result = getAllowedOpdFlowTransitions(null)
    expect(result.current).toBe('START')
    expect(result.allowed.length).toBeGreaterThan(0)
    expect(result.allowed).toContain('ARRIVED')
  })

  it('returns START for empty string', () => {
    const result = getAllowedOpdFlowTransitions('')
    expect(result.current).toBe('START')
  })

  it('normalizes lowercase input', () => {
    const result = getAllowedOpdFlowTransitions('arrived')
    expect(result.current).toBe('ARRIVED')
  })

  it('returns allowed transitions for ARRIVED', () => {
    const result = getAllowedOpdFlowTransitions('ARRIVED')
    expect(result.current).toBe('ARRIVED')
    expect(result.allowed).toContain('WAITING_NURSE')
    expect(result.allowed).not.toContain('IN_DOCTOR')
  })

  it('returns allowed transitions for IN_DOCTOR', () => {
    const result = getAllowedOpdFlowTransitions('IN_DOCTOR')
    expect(result.current).toBe('IN_DOCTOR')
    expect(result.allowed).toContain('COMPLETED')
    expect(result.allowed).toContain('PROCEDURE_PENDING')
  })

  it('returns empty allowed for COMPLETED', () => {
    const result = getAllowedOpdFlowTransitions('COMPLETED')
    expect(result.current).toBe('COMPLETED')
    expect(result.allowed).toEqual([])
  })

  it('returns UNKNOWN for unrecognized non-empty state', () => {
    const result = getAllowedOpdFlowTransitions('GARBAGE')
    expect(result.current).toBe('UNKNOWN')
    expect(result.allowed).toEqual([])
  })

  it('handles whitespace in input', () => {
    const result = getAllowedOpdFlowTransitions('  arrived  ')
    expect(result.current).toBe('ARRIVED')
  })
})

describe('isOpdFlowTransitionAllowed()', () => {
  it('allows valid transition ARRIVED -> WAITING_NURSE', () => {
    const result = isOpdFlowTransitionAllowed('ARRIVED', 'WAITING_NURSE')
    expect(result.ok).toBe(true)
    expect(result.current).toBe('ARRIVED')
  })

  it('allows valid transition IN_DOCTOR -> COMPLETED', () => {
    const result = isOpdFlowTransitionAllowed('IN_DOCTOR', 'COMPLETED')
    expect(result.ok).toBe(true)
  })

  it('disallows invalid transition ARRIVED -> COMPLETED', () => {
    const result = isOpdFlowTransitionAllowed('ARRIVED', 'COMPLETED')
    expect(result.ok).toBe(false)
  })

  it('disallows any transition from COMPLETED', () => {
    const result = isOpdFlowTransitionAllowed('COMPLETED', 'ARRIVED')
    expect(result.ok).toBe(false)
  })

  it('allows transition from START (null) to ARRIVED', () => {
    const result = isOpdFlowTransitionAllowed(null, 'ARRIVED')
    expect(result.ok).toBe(true)
    expect(result.current).toBe('START')
  })

  it('allows backward transition IN_DOCTOR -> WAITING_NURSE', () => {
    const result = isOpdFlowTransitionAllowed('IN_DOCTOR', 'WAITING_NURSE')
    expect(result.ok).toBe(true)
  })

  it('disallows transition from UNKNOWN state', () => {
    const result = isOpdFlowTransitionAllowed('INVALID_STATE', 'ARRIVED')
    expect(result.ok).toBe(false)
    expect(result.current).toBe('UNKNOWN')
  })
})
