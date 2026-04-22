# Thea EHR — Disaster Recovery Plan

## Recovery Objectives

| Metric | Target |
|--------|--------|
| **RTO** (Recovery Time Objective) | 2 hours |
| **RPO** (Recovery Point Objective) | 1 hour (WAL-based) |

## Scenario 1: Application Crash / Pod Restart

**Symptoms**: 5xx errors, health check failing, container restarting

**Recovery Steps**:
1. Check container logs: `docker logs thea-app --tail 100`
2. Check health endpoint: `curl https://app.thea.com.sa/api/health`
3. If OOM: increase memory limit in docker-compose.yml
4. If crash loop: check recent deployments, rollback if needed
5. Restart: `docker compose restart app`

**Estimated Recovery**: 5-15 minutes

## Scenario 2: Database Unavailable

**Symptoms**: Health check shows `database: { ok: false }`, all API calls return 500

**Recovery Steps**:
1. Check Supabase dashboard for status
2. Verify DATABASE_URL is correct: `echo $DATABASE_URL | head -c 30`
3. Test direct connection: `psql $DATABASE_URL -c "SELECT 1"`
4. If Supabase outage: wait for Supabase recovery, app auto-reconnects
5. If connection pool exhausted: restart app to reset connections
6. If data corruption: restore from Supabase point-in-time recovery

**Estimated Recovery**: 15-60 minutes (depends on Supabase)

## Scenario 3: Redis Failure

**Symptoms**: Slower responses, cache misses, health shows `redis: { ok: false }`

**Recovery Steps**:
1. The app degrades gracefully — all data comes from PostgreSQL
2. Restart Redis: `docker compose restart redis`
3. Verify: `redis-cli -u $REDIS_URL ping`
4. Cache will rebuild automatically on next requests

**Estimated Recovery**: 2-5 minutes (or zero — app continues without Redis)

## Scenario 4: Full Deployment Rollback

**Symptoms**: Critical bug in new release, breaking changes

**Recovery Steps**:
1. Identify the last known good image tag
2. Pull and deploy the previous version:
   ```bash
   docker pull ghcr.io/org/thea-ehr:<previous-sha>
   docker compose up -d --no-deps app
   ```
3. Verify health: `curl https://app.thea.com.sa/api/health`
4. If database migration was applied:
   - Check if migration is backward-compatible
   - If not: restore database from snapshot before migration
5. Update GitHub to reflect the rollback

**Estimated Recovery**: 15-30 minutes

## Scenario 5: Complete Infrastructure Failure

**Symptoms**: Server unreachable, DNS failure, data center issue

**Recovery Steps**:
1. Confirm outage scope (DNS, hosting, cloud provider)
2. If DNS: update DNS records to point to backup server
3. If server: provision new server from Docker image
4. Deploy steps:
   ```bash
   # On new server
   docker pull ghcr.io/org/thea-ehr:latest
   cp .env.production .env
   docker compose up -d
   npx prisma migrate deploy
   ```
5. Verify database connectivity (Supabase is external, should still be up)
6. Run health check and smoke tests
7. Update DNS to point to new server

**Estimated Recovery**: 1-2 hours

## Scenario 6: Data Breach / Security Incident

**Steps**:
1. Isolate affected systems (disable external access)
2. Preserve audit logs: `pg_dump` the audit_logs table
3. Review audit trail: `GET /api/admin/audit?from=<incident_start>`
4. Check patient access logs: `GET /api/admin/audit/patient-access`
5. Identify compromised accounts, force password resets
6. Rotate all API keys and JWT secrets
7. Notify affected tenants per HIPAA breach notification requirements
8. Document incident in post-mortem

## Escalation Contacts

| Role | Contact | Trigger |
|------|---------|---------|
| On-call Engineer | \<Configure in PagerDuty/OpsGenie\> | P1/P2 alerts |
| Tech Lead | \<Phone/Slack\> | P1 not resolved in 30 min |
| CTO | \<Phone\> | P1 not resolved in 1 hour |
| Supabase Support | https://supabase.com/support | Database issues |

## Post-Incident

After every P1/P2 incident:
1. Create incident report within 24 hours
2. Conduct blameless post-mortem within 48 hours
3. Create action items with deadlines
4. Update this runbook if gaps are found
