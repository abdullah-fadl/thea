#!/usr/bin/env bash
# backup-production.sh
# Phase 8.6 — Production-grade backup automation for Thea EHR.
#
# What it does:
#   1. Takes a logical Postgres dump (pg_dump --format=custom) from $DIRECT_URL.
#   2. Encrypts the dump with gpg (recipient = $BACKUP_GPG_RECIPIENT).
#   3. Stores the encrypted backup locally under ./backups/.
#   4. Optionally uploads to S3-compatible storage if $BACKUP_S3_BUCKET is set.
#   5. Prunes locally to a Grandfather-Father-Son retention window:
#        7 daily   (last 7 calendar days)
#        4 weekly  (one per ISO week, last 4 weeks)
#       12 monthly (one per calendar month, last 12 months)
#   6. Logs every step to stdout (cron-friendly).
#
# Idempotency:
#   - Filenames are timestamp-suffixed (HHMMSS), so re-running within the same
#     second is the only way to collide. Cron typically fires once per period.
#   - Local pruning is conservative: a file is only deleted if it falls outside
#     all three retention windows.
#   - S3 upload uses `aws s3 cp` (idempotent — overwrites the same key safely).
#   - Failure at any step exits non-zero without touching prior backups.
#
# Required environment variables:
#   DIRECT_URL              postgresql://user:pass@host:port/dbname
#                           (read-only or rw — pg_dump only reads)
#   BACKUP_GPG_RECIPIENT    GPG key id / email used as `--recipient`. The
#                           public key must already be in the keyring.
#
# Optional environment variables:
#   BACKUP_DIR              Local directory (default: ./backups)
#   BACKUP_S3_BUCKET        s3://bucket-name/optional-prefix — upload target
#   BACKUP_S3_ENDPOINT      Custom S3-compatible endpoint (e.g. R2, MinIO)
#   BACKUP_KEEP_DAILY       Default: 7
#   BACKUP_KEEP_WEEKLY      Default: 4
#   BACKUP_KEEP_MONTHLY     Default: 12
#   PG_DUMP_BIN             Override pg_dump binary path
#
# Usage (cron, daily 02:00 KSA):
#   0 2 * * * cd /srv/thea && DIRECT_URL=... BACKUP_GPG_RECIPIENT=ops@thea.com.sa \
#             ./scripts/backup-production.sh >> /var/log/thea/backup.log 2>&1
#
# Verify a backup later:
#   gpg --decrypt backups/thea-2026-04-26-020003.sql.gpg | pg_restore --list -
#
# Restore (see docs/disaster-recovery-runbook.md):
#   gpg --decrypt backups/thea-YYYY-MM-DD-HHMMSS.sql.gpg \
#     | pg_restore --clean --if-exists --no-owner --dbname "$DIRECT_URL"

set -euo pipefail

# ── Logging helper ──────────────────────────────────────────────────────────
log() { printf '[backup-production] %s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# ── Required vars ───────────────────────────────────────────────────────────
: "${DIRECT_URL:?DIRECT_URL is required (postgresql://...)}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT is required (gpg key id/email)}"

# ── Optional vars / defaults ────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-12}"
PG_DUMP="${PG_DUMP_BIN:-pg_dump}"

# ── Tooling pre-flight ──────────────────────────────────────────────────────
for bin in "$PG_DUMP" gpg date find; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    log "FATAL  required binary not found: $bin"
    exit 1
  fi
done

if [ -n "${BACKUP_S3_BUCKET:-}" ] && ! command -v aws >/dev/null 2>&1; then
  log "FATAL  BACKUP_S3_BUCKET set but aws CLI not on PATH"
  exit 1
fi

# Verify the GPG recipient key is actually in the keyring before we spend time
# producing a dump we can't encrypt.
if ! gpg --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null 2>&1; then
  log "FATAL  GPG recipient '$BACKUP_GPG_RECIPIENT' not found in keyring"
  exit 1
fi

# ── Compute target paths ────────────────────────────────────────────────────
TIMESTAMP="$(date -u +%Y-%m-%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

DUMP_FILE="${BACKUP_DIR}/thea-${TIMESTAMP}.sql"
ENC_FILE="${DUMP_FILE}.gpg"

log "starting backup → ${ENC_FILE}"

# Cleanup on failure: never leave a half-written plaintext dump on disk.
cleanup_on_fail() {
  if [ -f "$DUMP_FILE" ]; then
    log "cleanup  removing partial plaintext dump ${DUMP_FILE}"
    rm -f "$DUMP_FILE"
  fi
}
trap cleanup_on_fail ERR

# ── Step 1 — pg_dump (custom format, parallel-safe single-file output) ──────
log "step 1/5  pg_dump → ${DUMP_FILE}"
"$PG_DUMP" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --compress=6 \
  --file="$DUMP_FILE" \
  "$DIRECT_URL"
DUMP_BYTES="$(wc -c < "$DUMP_FILE" | tr -d ' ')"
log "step 1/5  dump complete (${DUMP_BYTES} bytes)"

# ── Step 2 — encrypt with gpg ───────────────────────────────────────────────
log "step 2/5  gpg encrypt → ${ENC_FILE}"
gpg --batch --yes --trust-model always \
  --recipient "$BACKUP_GPG_RECIPIENT" \
  --output "$ENC_FILE" \
  --encrypt "$DUMP_FILE"
rm -f "$DUMP_FILE"
ENC_BYTES="$(wc -c < "$ENC_FILE" | tr -d ' ')"
log "step 2/5  encrypted (${ENC_BYTES} bytes)"

# ── Step 3 — optional S3 upload ─────────────────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  S3_KEY="${BACKUP_S3_BUCKET%/}/$(basename "$ENC_FILE")"
  log "step 3/5  s3 upload → ${S3_KEY}"
  if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
    aws s3 cp "$ENC_FILE" "$S3_KEY" --endpoint-url "$BACKUP_S3_ENDPOINT"
  else
    aws s3 cp "$ENC_FILE" "$S3_KEY"
  fi
  log "step 3/5  s3 upload complete"
else
  log "step 3/5  skipped (BACKUP_S3_BUCKET not set)"
fi

# ── Step 4 — local retention pruning ────────────────────────────────────────
# Strategy: classify every existing backup by date. Keep:
#   - any file from the last $KEEP_DAILY calendar days
#   - the newest file per ISO week for the last $KEEP_WEEKLY weeks
#   - the newest file per calendar month for the last $KEEP_MONTHLY months
# Anything not matched by any window is deleted.
#
# Implementation note: we operate on filenames (thea-YYYY-MM-DD-HHMMSS.sql.gpg)
# so we don't depend on filesystem mtimes (which can drift across S3 syncs,
# rsync, container restores, etc.).

log "step 4/5  pruning local backups (keep ${KEEP_DAILY}d / ${KEEP_WEEKLY}w / ${KEEP_MONTHLY}m)"

# Portable epoch for "today UTC". We'll re-derive per-file with date(1).
TODAY_DAY="$(date -u +%Y-%m-%d)"

# Helper: convert YYYY-MM-DD to days-since-epoch (portable across GNU + BSD).
days_since_epoch() {
  local ymd="$1"
  if date -u -d "$ymd" +%s >/dev/null 2>&1; then
    # GNU date
    echo $(( $(date -u -d "$ymd" +%s) / 86400 ))
  else
    # BSD/macOS date
    echo $(( $(date -u -j -f "%Y-%m-%d" "$ymd" +%s) / 86400 ))
  fi
}

iso_week() {
  local ymd="$1"
  if date -u -d "$ymd" +%G-%V >/dev/null 2>&1; then
    date -u -d "$ymd" +%G-%V
  else
    date -u -j -f "%Y-%m-%d" "$ymd" +%G-%V
  fi
}

ymd_month() {
  local ymd="$1"
  echo "${ymd:0:7}"
}

TODAY_EPOCH_DAYS="$(days_since_epoch "$TODAY_DAY")"

# Build sorted list of existing backup files (newest first).
mapfile -t FILES < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'thea-*.sql.gpg' | sort -r)

declare -A SEEN_WEEK
declare -A SEEN_MONTH
DELETE_LIST=()

for f in "${FILES[@]}"; do
  base="$(basename "$f")"
  # base = thea-YYYY-MM-DD-HHMMSS.sql.gpg
  date_part="${base#thea-}"          # YYYY-MM-DD-HHMMSS.sql.gpg
  date_part="${date_part:0:10}"      # YYYY-MM-DD
  if ! [[ "$date_part" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    log "  skip  ${base} (unrecognised filename)"
    continue
  fi

  file_days="$(days_since_epoch "$date_part")"
  age_days=$(( TODAY_EPOCH_DAYS - file_days ))

  keep="no"
  reason=""

  if [ "$age_days" -lt "$KEEP_DAILY" ]; then
    keep="yes"
    reason="daily"
  fi

  if [ "$keep" = "no" ] && [ "$age_days" -lt $(( KEEP_WEEKLY * 7 + KEEP_DAILY )) ]; then
    wk="$(iso_week "$date_part")"
    if [ -z "${SEEN_WEEK[$wk]:-}" ]; then
      SEEN_WEEK[$wk]=1
      keep="yes"
      reason="weekly(${wk})"
    fi
  fi

  if [ "$keep" = "no" ] && [ "$age_days" -lt $(( KEEP_MONTHLY * 31 + KEEP_DAILY )) ]; then
    mo="$(ymd_month "$date_part")"
    if [ -z "${SEEN_MONTH[$mo]:-}" ]; then
      SEEN_MONTH[$mo]=1
      keep="yes"
      reason="monthly(${mo})"
    fi
  fi

  if [ "$keep" = "yes" ]; then
    log "  keep  ${base} (${reason}, age=${age_days}d)"
  else
    DELETE_LIST+=("$f")
  fi
done

if [ "${#DELETE_LIST[@]}" -gt 0 ]; then
  for f in "${DELETE_LIST[@]}"; do
    log "  prune ${f}"
    rm -f "$f"
  done
else
  log "  no files outside retention windows"
fi

# ── Step 5 — summary ────────────────────────────────────────────────────────
REMAINING="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'thea-*.sql.gpg' | wc -l | tr -d ' ')"
log "step 5/5  done — local backups retained: ${REMAINING}"
log "OK  ${ENC_FILE}"

trap - ERR
exit 0
