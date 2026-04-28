import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to mock the logger before importing cache, since cache imports logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { cache, cached } from '@/lib/cache/index'

describe('MemoryCache', () => {
  beforeEach(async () => {
    await cache.clear()
  })

  // ─── get / set ────────────────────────────────────────────

  it('returns null for missing keys', async () => {
    const result = await cache.get('nonexistent-key')
    expect(result).toBeNull()
  })

  it('stores and retrieves a string value', async () => {
    await cache.set('greeting', 'hello', 60)
    const result = await cache.get<string>('greeting')
    expect(result).toBe('hello')
  })

  it('stores and retrieves an object value', async () => {
    const data = { id: 1, name: 'Test', nested: { ok: true } }
    await cache.set('obj', data, 60)
    const result = await cache.get<typeof data>('obj')
    expect(result).toEqual(data)
  })

  it('stores and retrieves a number value', async () => {
    await cache.set('count', 42, 60)
    const result = await cache.get<number>('count')
    expect(result).toBe(42)
  })

  it('stores and retrieves an array value', async () => {
    const arr = [1, 2, 3]
    await cache.set('arr', arr, 60)
    const result = await cache.get<number[]>('arr')
    expect(result).toEqual([1, 2, 3])
  })

  // ─── TTL ──────────────────────────────────────────────────

  it('respects TTL — expired entries return null', async () => {
    // Set with a very short TTL (0 seconds = immediate expiry)
    await cache.set('ephemeral', 'value', 0)
    // Wait a tiny bit for Date.now() to advance
    await new Promise((r) => setTimeout(r, 10))
    const result = await cache.get('ephemeral')
    expect(result).toBeNull()
  })

  it('returns value within TTL window', async () => {
    await cache.set('durable', 'value', 10) // 10 seconds
    const result = await cache.get('durable')
    expect(result).toBe('value')
  })

  // ─── delete ───────────────────────────────────────────────

  it('deletes a specific key', async () => {
    await cache.set('to-remove', 'data', 60)
    expect(await cache.get('to-remove')).toBe('data')
    await cache.delete('to-remove')
    expect(await cache.get('to-remove')).toBeNull()
  })

  it('does not throw when deleting a nonexistent key', async () => {
    await expect(cache.delete('nonexistent')).resolves.not.toThrow()
  })

  // ─── deletePattern ────────────────────────────────────────

  it('deletes keys matching a wildcard pattern', async () => {
    await cache.set('opd:dashboard:tenant1', 'a', 60)
    await cache.set('opd:dashboard:tenant2', 'b', 60)
    await cache.set('opd:analytics:tenant1:daily', 'c', 60)
    await cache.set('other:key', 'd', 60)

    const deleted = await cache.deletePattern('opd:dashboard:*')
    expect(deleted).toBe(2)
    expect(await cache.get('opd:dashboard:tenant1')).toBeNull()
    expect(await cache.get('opd:dashboard:tenant2')).toBeNull()
    expect(await cache.get('opd:analytics:tenant1:daily')).toBe('c')
    expect(await cache.get('other:key')).toBe('d')
  })

  it('deletePattern returns 0 when no keys match', async () => {
    await cache.set('abc', 'val', 60)
    const deleted = await cache.deletePattern('xyz:*')
    expect(deleted).toBe(0)
  })

  it('deletePattern handles complex patterns', async () => {
    await cache.set('scheduling:slots:t1:r1:2024-01-01', 'x', 60)
    await cache.set('scheduling:slots:t1:r2:2024-01-02', 'y', 60)
    await cache.set('scheduling:resources:t1', 'z', 60)

    const deleted = await cache.deletePattern('scheduling:slots:t1:*')
    expect(deleted).toBe(2)
    expect(await cache.get('scheduling:resources:t1')).toBe('z')
  })

  // ─── clear ────────────────────────────────────────────────

  it('clears all keys', async () => {
    await cache.set('a', 1, 60)
    await cache.set('b', 2, 60)
    await cache.set('c', 3, 60)
    expect(cache.size).toBe(3)

    await cache.clear()
    expect(cache.size).toBe(0)
    expect(await cache.get('a')).toBeNull()
  })

  // ─── size ─────────────────────────────────────────────────

  it('reports correct size', async () => {
    expect(cache.size).toBe(0)
    await cache.set('x', 1, 60)
    expect(cache.size).toBe(1)
    await cache.set('y', 2, 60)
    expect(cache.size).toBe(2)
    await cache.delete('x')
    expect(cache.size).toBe(1)
  })

  it('size does not count expired entries after access', async () => {
    await cache.set('temp', 'val', 0)
    // Access triggers lazy eviction
    await new Promise((r) => setTimeout(r, 10))
    await cache.get('temp')
    expect(cache.size).toBe(0)
  })
})

describe('cached() helper', () => {
  beforeEach(async () => {
    await cache.clear()
  })

  it('calls fetcher on cache miss', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' })
    const result = await cached('miss-key', fetcher, 60)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual({ data: 'fresh' })
  })

  it('returns cached value on cache hit (does not call fetcher)', async () => {
    await cache.set('hit-key', { data: 'cached' }, 60)
    const fetcher = vi.fn().mockResolvedValue({ data: 'fresh' })
    const result = await cached('hit-key', fetcher, 60)
    expect(fetcher).not.toHaveBeenCalled()
    expect(result).toEqual({ data: 'cached' })
  })

  it('stores the fetcher result in cache for subsequent calls', async () => {
    let callCount = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount++
      return `result-${callCount}`
    })

    const first = await cached('sequential', fetcher, 60)
    expect(first).toBe('result-1')
    expect(fetcher).toHaveBeenCalledTimes(1)

    const second = await cached('sequential', fetcher, 60)
    expect(second).toBe('result-1') // Same cached value
    expect(fetcher).toHaveBeenCalledTimes(1) // Not called again
  })
})
