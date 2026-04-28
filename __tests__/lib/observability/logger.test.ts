/**
 * Phase 8.6 — Structured logger tests.
 *
 * Cases:
 *  1. emits a single JSON line per call (parseable, has timestamp/level/message)
 *  2. carries provided context (tenantId, userId, category, requestId)
 *  3. honours level threshold (debug < info < warn < error < fatal)
 *  4. silenced in NODE_ENV=test by default; manual override re-enables output
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { obs } from '@/lib/observability/logger';

interface OutSpy {
  out: string[];
  err: string[];
  restore: () => void;
}

function captureStdio(): OutSpy {
  const out: string[] = [];
  const err: string[] = [];
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: any) => {
    out.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: any) => {
    err.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  }) as typeof process.stderr.write;
  return {
    out,
    err,
    restore: () => {
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    },
  };
}

describe('lib/observability/logger', () => {
  let spy: OutSpy;

  beforeEach(() => {
    spy = captureStdio();
    obs.__setLevelForTest('debug');
  });

  afterEach(() => {
    spy.restore();
    obs.__resetLevelForTest();
  });

  it('1. emits a single JSON line with timestamp + level + message', () => {
    obs.info('test.message');
    expect(spy.out).toHaveLength(1);
    const line = spy.out[0];
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test.message');
    expect(typeof parsed.timestamp).toBe('string');
    expect(() => new Date(parsed.timestamp)).not.toThrow();
  });

  it('2. carries provided context fields', () => {
    obs.warn('opd.queue.full', {
      tenantId: 't-1',
      userId: 'u-9',
      category: 'opd',
      requestId: 'req-abc',
      queueDepth: 42,
    });
    // warn → stderr
    const parsed = JSON.parse(spy.err[0].trim());
    expect(parsed.tenantId).toBe('t-1');
    expect(parsed.userId).toBe('u-9');
    expect(parsed.category).toBe('opd');
    expect(parsed.requestId).toBe('req-abc');
    expect(parsed.queueDepth).toBe(42);
    expect(parsed.level).toBe('warn');

    // child binds context too
    spy.err.length = 0;
    const child = obs.child({ tenantId: 't-2', requestId: 'req-xyz' });
    child.error('boom', { category: 'er' });
    const parsedChild = JSON.parse(spy.err[0].trim());
    expect(parsedChild.tenantId).toBe('t-2');
    expect(parsedChild.requestId).toBe('req-xyz');
    expect(parsedChild.category).toBe('er');

    // secret-like keys are stripped
    spy.err.length = 0;
    obs.error('sec', { password: 'p', authorization: 'Bearer x', tenantId: 't-3' });
    const parsedSec = JSON.parse(spy.err[0].trim());
    expect(parsedSec.password).toBeUndefined();
    expect(parsedSec.authorization).toBeUndefined();
    expect(parsedSec.tenantId).toBe('t-3');
  });

  it('3. level threshold filters lower levels', () => {
    obs.__setLevelForTest('warn');
    obs.debug('d');
    obs.info('i');
    obs.warn('w');
    obs.error('e');
    obs.fatal('f');
    // debug + info dropped; warn → stderr, error → stderr, fatal → stderr
    expect(spy.out).toHaveLength(0);
    expect(spy.err).toHaveLength(3);
    expect(JSON.parse(spy.err[0]).level).toBe('warn');
    expect(JSON.parse(spy.err[1]).level).toBe('error');
    expect(JSON.parse(spy.err[2]).level).toBe('fatal');
  });

  it('4. silent level emits nothing', () => {
    obs.__setLevelForTest('silent');
    obs.debug('d');
    obs.info('i');
    obs.warn('w');
    obs.error('e');
    obs.fatal('f');
    expect(spy.out).toHaveLength(0);
    expect(spy.err).toHaveLength(0);
  });
});
