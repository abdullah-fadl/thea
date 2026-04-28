# Disaster Recovery Runbook — Thea EHR

**Phase 8.6 — Operational Readiness**
**Owner:** ops on-call (KSA business hours), backed by engineering on-call after hours
**Last reviewed:** 2026-04-26

---

## Recovery objectives (current setup)

| Objective | Target | How it's met |
|-----------|--------|--------------|
| **RPO** (Recovery Point Objective) | **≤ 1 hour** | Hourly logical `pg_dump` via `scripts/backup-production.sh` (cron). Production should run the backup hourly into local disk + S3. |
| **RTO** (Recovery Time Objective) | **≤ 4 hours** | Time to: provision a fresh Postgres host (≤ 1h with managed Postgres), download + `gpg --decrypt` the latest backup (≤ 30m), `pg_restore` (≤ 2h for a single-tenant pilot DB), redeploy the app container (≤ 30m). |

These targets are calibrated for the **single-pilot** deployment shape. Multi-tenant production with > 1 hospital will require revising RPO downward (consider WAL archiving / PITR via a managed Postgres provider) — see _§ Future hardening_ at the end.

---

## Pre-requisites (verify before an incident)

Before you'll need this runbook, the following must already be true. Run through this list quarterly:

1. `scripts/backup-production.sh` is wired into cron and producing files in both `./backups/` and `s3://<BACKUP_S3_BUCKET>/`.
2. The GPG private key for `BACKUP_GPG_RECIPIENT` is **not** stored on the production host. It lives in the ops vault (1Password "Thea ops" → `Thea backups GPG private key`). The public key is on the production host.
3. At least one ops engineer has tested an end-to-end restore into a scratch DB in the last 90 days.
4. `DIRECT_URL` for the production DB is documented in the ops vault.
5. The most recent `prisma migrate` history is committed to `main` (so a fresh DB can be re-migrated to the schema the app expects).

---

## Common commands you'll need

```bash
# Decrypt a backup (requires GPG private key in your local keyring)
gpg --decrypt backups/thea-2026-04-26-020003.sql.gpg > /tmp/thea.dump

# Inspect a custom-format dump without restoring
pg_restore --list /tmp/thea.dump | less

# Restore everything into a target DB (clean + recreate objects)
pg_restore --clean --if-exists --no-owner --dbname "$DIRECT_URL" /tmp/thea.dump

# Restore one table only (extract section, then restore)
pg_restore --list /tmp/thea.dump | grep -i 'TABLE DATA public encounter_core' \
  > /tmp/restore.list
pg_restore --use-list=/tmp/restore.list --data-only --dbname "$DIRECT_URL" /tmp/thea.dump

# Re-apply Prisma migrations to a fresh DB (uses prisma/migrations/)
DIRECT_URL=postgresql://... npx prisma migrate deploy

# Roll a single Prisma migration back (manual — Prisma has no `down`)
psql "$DIRECT_URL" -f prisma/migrations/20260424000010_outcome_metrics/down.sql
psql "$DIRECT_URL" -c \
  "DELETE FROM _prisma_migrations WHERE migration_name = '20260424000010_outcome_metrics';"
```

---

## Scenario 1 — Full database loss

**Symptom:** the Postgres host is gone (deleted, hardware loss, region outage). The app reports `ECONNREFUSED` on every request and `/api/health/ready` returns 503.

**Recovery steps:**

1. **Stop the app** (or scale to zero) to prevent partial writes against any half-restored DB:
   ```bash
   # vercel / fly / k8s — depends on host. Example:
   kubectl scale deployment/thea --replicas=0
   ```
2. **Provision a fresh Postgres** of the same major version. Note the new connection string.
3. **Identify the latest good backup** — should be the newest file by name in `s3://<BACKUP_S3_BUCKET>/` matching `thea-YYYY-MM-DD-HHMMSS.sql.gpg`:
   ```bash
   aws s3 ls "s3://$BACKUP_S3_BUCKET/" | grep '\.sql\.gpg$' | sort | tail -1
   ```
4. **Download + decrypt** locally:
   ```bash
   aws s3 cp "s3://$BACKUP_S3_BUCKET/thea-YYYY-MM-DD-HHMMSS.sql.gpg" /tmp/
   gpg --decrypt /tmp/thea-YYYY-MM-DD-HHMMSS.sql.gpg > /tmp/thea.dump
   ```
5. **Restore** into the fresh DB:
   ```bash
   pg_restore --clean --if-exists --no-owner \
     --dbname "$NEW_DIRECT_URL" /tmp/thea.dump
   ```
6. **Re-apply any pending migrations** (in case the backup is from before today's deploy):
   ```bash
   DIRECT_URL=$NEW_DIRECT_URL npx prisma migrate deploy
   ```
7. **Update the app's `DIRECT_URL`** secret to point at the new DB.
8. **Bring the app back up** and watch `/api/health/ready` (should return 200) and `/api/health/deep` (should show recent migration count).
9. **Verify integrity** — see _§ Post-restore integrity checks_.
10. **Communicate** — update the status page; note RPO actually achieved (gap between backup timestamp and outage start).

---

## Scenario 2 — Partial table corruption

**Symptom:** one table is corrupted (bad migration, accidental `DELETE`, vendor data wipe). Other tables are fine and the app is mostly working.

**Recovery steps:**

1. **Stop writes to the affected table** — disable the feature flag for the module, or block traffic to the relevant API routes at the load balancer.
2. **Snapshot the current state** before any restore (in case the corruption is recoverable from current data + WAL):
   ```bash
   pg_dump --table=corrupted_table --format=custom \
     --file=/tmp/corrupted_table_pre_restore.dump "$DIRECT_URL"
   ```
3. **Find the most recent backup taken _before_ the corruption** (look at the timestamp on the file vs the suspected corruption time):
   ```bash
   aws s3 ls "s3://$BACKUP_S3_BUCKET/" | grep '\.sql\.gpg$' | sort
   ```
4. **Decrypt** that backup as in Scenario 1.
5. **Restore _only_ the affected table** into a scratch schema first, so you can inspect before swapping:
   ```bash
   psql "$DIRECT_URL" -c 'CREATE SCHEMA restore_scratch;'
   pg_restore --list /tmp/thea.dump | grep -i 'TABLE.*corrupted_table' > /tmp/list.txt
   pg_restore --use-list=/tmp/list.txt --no-owner \
     --schema-mapping=public:restore_scratch \
     --dbname "$DIRECT_URL" /tmp/thea.dump
   ```
   _Note: `--schema-mapping` is not native to all `pg_restore` versions. Fallback: restore into a separate DB and `\copy` rows across._
6. **Diff** the scratch table against production to confirm the restore looks sane:
   ```sql
   SELECT COUNT(*) FROM restore_scratch.corrupted_table;
   SELECT COUNT(*) FROM public.corrupted_table;
   ```
7. **Swap** in a transaction:
   ```sql
   BEGIN;
   ALTER TABLE public.corrupted_table RENAME TO corrupted_table_old;
   ALTER TABLE restore_scratch.corrupted_table SET SCHEMA public;
   COMMIT;
   ```
8. **Verify** with the integrity checks below, then drop `corrupted_table_old` after a 24h soak.
9. **Re-enable** the feature flag / route.

---

## Scenario 3 — Lost backup (latest backup is missing or won't decrypt)

**Symptom:** S3 upload silently failed for the last N runs, OR the GPG key the backup was encrypted with has been rotated and the old private key is gone.

**Recovery steps:**

1. **Don't panic, don't write more data.** Stop the cron job so the broken backup script doesn't keep running:
   ```bash
   crontab -l | grep -v backup-production.sh | crontab -
   ```
2. **Walk back through available backups** — list everything in S3 + local:
   ```bash
   aws s3 ls "s3://$BACKUP_S3_BUCKET/" | sort
   ls -lh ./backups/
   ```
3. **For each candidate, attempt decrypt** with every GPG private key in the ops vault. The most recent successfully-decryptable backup is your effective recovery point.
4. **Accept the worse RPO** — communicate the actual gap (e.g. "last good backup is 8 hours old, so we will lose 8h of writes") to stakeholders before restoring.
5. **Restore** as in Scenario 1 from the oldest-newest file you can decrypt.
6. **Root cause the backup failure**:
   - If S3 upload failed: check IAM creds, bucket policy, network egress.
   - If GPG decrypt failed: rotate to a single recipient, document the new key in the vault, re-test backup + restore.
7. **Add a monitor** so silent backup failures page someone (e.g. AWS Lambda that alerts if `ListObjectsV2` returns no new key in the last 90 minutes).
8. **Resume the cron** only after verifying both upload + decrypt work end-to-end.

---

## Scenario 4 — App-only crash (DB is healthy)

**Symptom:** `/api/health/ready` returns 503 with a non-DB reason, or the app container is in `CrashLoopBackOff`. The DB is reachable and other services depending on it work fine.

**Recovery steps:**

1. **Look at the app logs first** — never assume DB:
   ```bash
   kubectl logs deployment/thea --tail=200
   # or vercel logs, fly logs, etc.
   ```
2. **Check if a recent deploy is the cause** — the most common app-only outage is a bad release. Roll back:
   ```bash
   kubectl rollout undo deployment/thea
   ```
3. **If not deploy-related**: check resource limits (OOM, CPU throttling), check config changes (was `DIRECT_URL` updated to a wrong value?), check upstream services (Anthropic API, Redis) that the app depends on.
4. **Verify** `/api/health` (no auth, no DB) returns 200 — if even this is failing, the container itself is broken, not application code.
5. **Verify** `/api/health/ready` (DB ping) returns 200 — confirms the DB itself is healthy.
6. **Verify** `/api/health/deep` (auth required) returns the expected counts — this is a stronger signal that registries and migrations look right.
7. **No DB action required.** Do NOT restore the DB.

---

## Scenario 5 — App + DB crash (both down)

**Symptom:** everything is down. Could be a region outage, a wrong-environment deploy, or the host the DB lives on has died.

**Recovery steps:**

1. **Triage: is the DB recoverable in place?**
   - If the DB host is alive but Postgres is crashed: try `systemctl restart postgresql` first. Often this is enough.
   - If `pg_isready` succeeds but the DB rejects connections: check `pg_hba.conf`, `max_connections`, disk space (`df -h`), and Postgres logs.
   - If the host is gone: proceed to Scenario 1 (full DB loss) and run those steps in parallel with bringing the app back.
2. **Restore order matters: DB first, app second.** An app starting against a missing DB will spin in a crash loop and pollute logs. Wait for `/api/health/ready` to return 200 from the new DB before scaling app replicas back up.
3. **Once DB is up:**
   - Run Scenario 1 steps 6–9 (re-apply migrations, update `DIRECT_URL` secret, restart app, verify health endpoints).
4. **Once app is up:**
   - Run a quick smoke test on a known-safe page (e.g. `/login` should render).
   - Verify the integrity checks below.
5. **Communicate the RPO + RTO actually achieved** in the postmortem.

---

## Post-restore integrity checks

After **any** restore (Scenarios 1, 2, 3, 5), run these before declaring "recovered":

```sql
-- 1. Schema is intact: every table the app expects is present.
SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Migrations table matches what the codebase ships.
SELECT migration_name, finished_at
  FROM _prisma_migrations
 WHERE finished_at IS NOT NULL
 ORDER BY finished_at DESC
 LIMIT 10;

-- 3. Critical tables have non-zero counts (in a non-empty pilot DB).
SELECT 'tenants'        AS tbl, COUNT(*) FROM tenants
UNION ALL SELECT 'users',          COUNT(*) FROM users
UNION ALL SELECT 'hospitals',      COUNT(*) FROM hospitals
UNION ALL SELECT 'patient_master', COUNT(*) FROM patient_master;

-- 4. No partially-restored rows (look for nulls in NOT-NULL-by-app-convention columns).
-- Module-specific — extend per pilot deployment.
```

Then from the app side:

```bash
# /api/health → 200 (no DB call, sanity check process is up)
curl -fs https://app.thea.com.sa/api/health | jq .

# /api/health/ready → 200 (DB ping succeeds)
curl -fs https://app.thea.com.sa/api/health/ready | jq .

# /api/health/deep → 200 (auth required) — verify migration count + registry counts
curl -fs -H "Authorization: Bearer $TOKEN" \
     https://app.thea.com.sa/api/health/deep | jq .
```

If any of these fail, **do not declare recovered**. Roll forward (re-restore, re-migrate) until they all pass.

---

## Future hardening (not in Phase 8.6)

These improve RPO/RTO meaningfully but are commercial / infra decisions, not code:

- **WAL archiving + PITR** via a managed Postgres provider (RDS, Supabase, Neon) — drops RPO from 1 hour to seconds.
- **Cross-region S3 replication** — protects against single-region S3 outage.
- **Read replica failover** — drops RTO for the "DB host is gone" case from hours to minutes.
- **Automated restore drills** — a weekly cron that picks a random backup, restores into a scratch DB, runs the integrity SQL, and pages on failure. The current process is manual quarterly.
