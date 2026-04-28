# Thea EHR — Service Level Agreement (SLA)

## Uptime Target

| Metric | Target | Maximum Downtime |
|--------|--------|------------------|
| Monthly Uptime | 99.9% | 43 minutes/month |
| Annual Uptime | 99.9% | 8.7 hours/year |

## Response Time Targets

| Endpoint Category | p50 | p95 | p99 |
|-------------------|-----|-----|-----|
| GET (simple) | < 50ms | < 200ms | < 500ms |
| GET (search/list) | < 100ms | < 300ms | < 1000ms |
| POST (create/update) | < 100ms | < 500ms | < 1500ms |
| Real-time dashboards | < 100ms | < 250ms | < 500ms |
| File upload | < 500ms | < 2000ms | < 5000ms |

## Incident Severity Levels

| Severity | Description | Response Time | Resolution Time |
|----------|-------------|---------------|-----------------|
| P1 — Critical | System completely down, no workaround | 15 minutes | 2 hours |
| P2 — High | Major feature broken, limited workaround | 30 minutes | 4 hours |
| P3 — Medium | Minor feature broken, workaround available | 2 hours | 24 hours |
| P4 — Low | Cosmetic issue, documentation fix | 24 hours | 1 week |

## Maintenance Windows

- **Scheduled maintenance**: Saturdays 02:00–06:00 AST (Arabia Standard Time)
- **Emergency maintenance**: As needed, with 30-minute advance notice when possible
- **Database migrations**: Applied during scheduled maintenance windows
- **Maintenance notifications**: Sent via email to all tenant admins 48 hours in advance

## Monitoring & Alerting

### Health Endpoints
- `GET /api/health` — Basic health (database, memory, redis)
- `GET /api/health?dashboard=true` — Detailed dashboard with metrics

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| API error rate (5xx) | > 1% | > 5% |
| API latency (p95) | > 500ms | > 2000ms |
| Database latency | > 100ms | > 500ms |
| Memory usage | > 80% | > 90% |
| Disk usage | > 80% | > 95% |

## Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| Clinical data (patient records) | Permanent |
| Audit logs | 7 years (2555 days) |
| Integration messages (HL7/FHIR) | 2 years |
| Session data | 90 days |
| Error logs | 1 year |
| Performance metrics | 6 months |

## Backup Policy

| Component | Frequency | Retention | RTO |
|-----------|-----------|-----------|-----|
| PostgreSQL (Supabase) | Continuous (WAL) + Daily snapshot | 30 days | 1 hour |
| Redis | Not backed up (ephemeral cache) | N/A | Instant (app auto-recovers) |
| File storage | Daily | 30 days | 2 hours |
| Configuration | Version controlled (Git) | Permanent | 15 minutes |

## Exclusions

The following are excluded from SLA calculations:
- Scheduled maintenance windows
- Force majeure events
- Third-party service outages (Supabase, CDN, DNS)
- Client-side errors (4xx responses)
- Load testing traffic
