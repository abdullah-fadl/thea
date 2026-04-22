import { describe, it, expect } from 'vitest'
import { normalizeOpdPaymentSnapshot } from '@/lib/opd/payment'

describe('normalizeOpdPaymentSnapshot()', () => {
  // ─── Valid payloads ───────────────────────────────────────

  it('normalizes a valid PAID CONSULTATION payment', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      method: 'cash',
      amount: 150,
    })
    expect(result.error).toBeUndefined()
    expect(result.payment).toBeDefined()
    expect(result.payment!.status).toBe('PAID')
    expect(result.payment!.serviceType).toBe('CONSULTATION')
    expect(result.payment!.method).toBe('CASH')
    expect(result.payment!.amount).toBe(150)
  })

  it('normalizes a SKIPPED FOLLOW_UP payment', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'SKIPPED',
      serviceType: 'FOLLOW_UP',
    })
    expect(result.error).toBeUndefined()
    expect(result.payment!.status).toBe('SKIPPED')
    expect(result.payment!.serviceType).toBe('FOLLOW_UP')
  })

  it('normalizes a PENDING payment with no method', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'pending',
      serviceType: 'consultation',
    })
    expect(result.error).toBeUndefined()
    expect(result.payment!.status).toBe('PENDING')
    expect(result.payment!.method).toBeUndefined()
  })

  it('includes optional fields when present', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      method: 'card',
      amount: 200,
      paidAt: '2024-06-15T10:00:00Z',
      invoiceId: 'INV-001',
      reference: 'REF-123',
    })
    expect(result.error).toBeUndefined()
    expect(result.payment!.paidAt).toBeInstanceOf(Date)
    expect(result.payment!.invoiceId).toBe('INV-001')
    expect(result.payment!.reference).toBe('REF-123')
  })

  it('handles null amount', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      amount: null,
    })
    expect(result.error).toBeUndefined()
    expect(result.payment!.amount).toBeNull()
  })

  // ─── Null / undefined input ───────────────────────────────

  it('returns empty object for null input', () => {
    const result = normalizeOpdPaymentSnapshot(null)
    expect(result).toEqual({})
  })

  it('returns empty object for undefined input', () => {
    const result = normalizeOpdPaymentSnapshot(undefined)
    expect(result).toEqual({})
  })

  // ─── Invalid payloads ────────────────────────────────────

  it('returns error for non-object input', () => {
    expect(normalizeOpdPaymentSnapshot('string').error).toBe('Invalid payment payload')
    expect(normalizeOpdPaymentSnapshot(123).error).toBe('Invalid payment payload')
    expect(normalizeOpdPaymentSnapshot([]).error).toBe('Invalid payment payload')
  })

  it('returns error for invalid status', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'INVALID',
      serviceType: 'consultation',
    })
    expect(result.error).toBe('Invalid payment status')
  })

  it('returns error for empty status', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: '',
      serviceType: 'consultation',
    })
    expect(result.error).toBe('Invalid payment status')
  })

  it('returns error for invalid serviceType', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'INVALID_TYPE',
    })
    expect(result.error).toBe('Invalid payment serviceType')
  })

  it('returns error for invalid method', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      method: 'BITCOIN',
    })
    expect(result.error).toBe('Invalid payment method')
  })

  it('returns error for non-numeric amount', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      amount: 'abc',
    })
    expect(result.error).toBe('Invalid payment amount')
  })

  it('returns error for invalid paidAt date', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'paid',
      serviceType: 'consultation',
      paidAt: 'not-a-date',
    })
    expect(result.error).toBe('Invalid payment paidAt')
  })

  // ─── Case normalization ───────────────────────────────────

  it('normalizes status to uppercase', () => {
    const result = normalizeOpdPaymentSnapshot({
      status: 'Paid',
      serviceType: 'Consultation',
    })
    expect(result.payment!.status).toBe('PAID')
    expect(result.payment!.serviceType).toBe('CONSULTATION')
  })
})
