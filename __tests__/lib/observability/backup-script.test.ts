/**
 * Phase 8.6 — Backup script syntax check.
 *
 * Runs `bash -n` against scripts/backup-production.sh to catch syntax errors
 * before they reach a production cron host. Doesn't execute the script.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

describe('scripts/backup-production.sh', () => {
  const scriptPath = path.resolve(__dirname, '../../../scripts/backup-production.sh');

  it('exists, is executable, and parses with bash -n', () => {
    expect(existsSync(scriptPath)).toBe(true);

    const mode = statSync(scriptPath).mode;
    // owner-execute bit must be set
    expect(mode & 0o100).toBe(0o100);

    expect(() => {
      execSync(`bash -n "${scriptPath}"`, { stdio: 'pipe' });
    }).not.toThrow();
  });
});
