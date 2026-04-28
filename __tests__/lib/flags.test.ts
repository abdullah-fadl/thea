import { isEnabled, requireFlag, FLAGS } from '@/lib/core/flags';

describe('Feature flags', () => {
  it('returns false when env var is unset', () => {
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
    expect(isEnabled('FF_PORTAL_SLUG_ROUTING')).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    process.env[FLAGS.FF_PORTAL_SLUG_ROUTING] = 'true';
    expect(isEnabled('FF_PORTAL_SLUG_ROUTING')).toBe(true);
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
  });

  it('returns false for any value other than "true"', () => {
    for (const val of ['1', 'yes', 'TRUE', 'on']) {
      process.env[FLAGS.FF_PORTAL_SLUG_ROUTING] = val;
      expect(isEnabled('FF_PORTAL_SLUG_ROUTING')).toBe(false);
    }
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
  });

  it('all registered flags default to false when no env vars set', () => {
    for (const envVar of Object.values(FLAGS)) {
      delete process.env[envVar];
    }
    for (const key of Object.keys(FLAGS) as (keyof typeof FLAGS)[]) {
      expect(isEnabled(key)).toBe(false);
    }
  });

  it('requireFlag does not throw when flag is enabled', () => {
    process.env[FLAGS.FF_PORTAL_SLUG_ROUTING] = 'true';
    expect(() => requireFlag('FF_PORTAL_SLUG_ROUTING')).not.toThrow();
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
  });

  it('requireFlag throws when flag is disabled', () => {
    delete process.env[FLAGS.FF_PORTAL_SLUG_ROUTING];
    expect(() => requireFlag('FF_PORTAL_SLUG_ROUTING')).toThrow(
      'THEA_FF_PORTAL_SLUG_ROUTING is not enabled'
    );
  });
});
