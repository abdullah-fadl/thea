import assert from 'node:assert/strict';
import { generateUnknownTempMrn, retryOnDuplicateKey } from '../../lib/er/identifiers';

function run(name: string, fn: () => void | Promise<void>) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(`✓ ${name}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`✗ ${name}`);
      // eslint-disable-next-line no-console
      console.error(err);
      process.exitCode = 1;
    });
}

run('generateUnknownTempMrn format UN-YYYYMMDD-HHmm-XXXX', () => {
  const fixed = new Date('2026-01-21T16:15:00.000Z');
  const mrn = generateUnknownTempMrn({ now: fixed, random: () => 0.0483 });
  assert.equal(mrn, 'UN-20260121-1615-0483');
});

run('retryOnDuplicateKey retries on duplicate key up to maxAttempts', async () => {
  let calls = 0;
  const values = ['A', 'B', 'C'];

  const out = await retryOnDuplicateKey({
    maxAttempts: 5,
    generate: () => values[calls] ?? `X${calls}`,
    run: async () => {
      calls += 1;
      if (calls <= 2) {
        const err: any = new Error('duplicate');
        err.code = 11000;
        throw err;
      }
      return { ok: true };
    },
  });

  assert.equal(calls, 3);
  assert.equal(out.attempts, 3);
  assert.equal(out.value, 'C');
  assert.deepEqual(out.result, { ok: true });
});

