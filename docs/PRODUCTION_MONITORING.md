# Thea EHR — Production Monitoring Guide

## Health Endpoints

### Basic Health Check
```
GET /api/health
```
Returns: `{ status, timestamp, uptime, version, checks: { database, memory, redis } }`

### Detailed Dashboard
```
GET /api/health?dashboard=true
```
Returns: Basic health + metrics, recent errors, request rates.

## Key Metrics to Watch

### Application Performance
| Metric | Source | Warning | Critical |
|--------|--------|---------|----------|
| API Response Time (p95) | `/api/health` metrics | > 500ms | > 2000ms |
| Error Rate (5xx) | Error reporter | > 1% | > 5% |
| Request Rate | Request logger | Sudden drop > 50% | Drop to 0 |
| Active Connections | Database pool | > 80% capacity | > 95% capacity |

### System Resources
| Metric | Source | Warning | Critical |
|--------|--------|---------|----------|
| Memory Usage (heap) | `/api/health` memory check | > 80% | > 90% |
| CPU Usage | Container metrics | > 70% | > 90% |
| Disk Usage | Server monitoring | > 80% | > 95% |

### Database
| Metric | Source | Warning | Critical |
|--------|--------|---------|----------|
| Query Latency | Health check `database.ms` | > 100ms | > 500ms |
| Connection Pool Usage | Prisma metrics | > 80% | > 95% |
| Slow Queries | PostgreSQL logs | Any > 5s | Any > 30s |

### Redis
| Metric | Source | Warning | Critical |
|--------|--------|---------|----------|
| Redis Latency | Health check `redis.ms` | > 50ms | > 200ms |
| Memory Usage | Redis INFO | > 80% maxmemory | > 95% maxmemory |
| Connection Status | Health check `redis.ok` | — | `ok: false` |

## Log Monitoring

### Structured Logger
All logs go through `lib/monitoring/logger.ts` with these levels:
- `error` — Application errors, failed operations
- `warn` — Degraded performance, retries, rate limits
- `info` — Normal operations, audit events
- `debug` — Development/troubleshooting (disabled in production)

### Log Categories
| Category | What It Covers |
|----------|---------------|
| `auth` | Login, logout, session, MFA, access denied, audit events |
| `api` | Request/response logging, validation errors |
| `db` | Database queries, migration, connection pool |
| `hl7` | HL7/FHIR message processing, ADT events |
| `nphies` | Insurance claims, eligibility checks |
| `admin` | Tenant management, user management, retention |

### Error Reporter
`lib/monitoring/errorReporter.ts` maintains a ring buffer of recent errors:
- Access via health dashboard: `GET /api/health?dashboard=true`
- Sentry integration: configure `SENTRY_DSN` env var

## Integration Monitoring

### HL7 Integration
```
GET /api/integration/messages?status=FAILED
```
Check for failed HL7 message processing. Failed messages are retried 3 times.

### NPHIES (Insurance)
```
GET /api/billing/nphies/eligibility?status=ERROR
```
Monitor failed eligibility checks and claim submissions.

## Alerting Setup

### Recommended Tools
- **Uptime**: UptimeRobot or BetterStack — ping `/api/health` every minute
- **Error Tracking**: Sentry (`SENTRY_DSN` env var)
- **Infrastructure**: Docker health checks + container monitoring
- **On-call**: PagerDuty or OpsGenie for P1/P2 escalation

### Health Check Monitoring Script
```bash
#!/bin/bash
# Add to crontab: */1 * * * * /path/to/health-check.sh
HEALTH_URL="https://app.thea.com.sa/api/health"
STATUS=$(curl -s -o /tmp/health.json -w "%{http_code}" "$HEALTH_URL")
if [ "$STATUS" != "200" ]; then
  echo "ALERT: Health check failed with HTTP $STATUS" | mail -s "Thea EHR DOWN" oncall@thea.com.sa
fi
```

## Load Testing

Before major releases, run load tests:
```bash
# Smoke test (1 VU, 30s)
k6 run load-tests/k6-smoke.js

# Load test (50 VUs, 18 min)
k6 run load-tests/k6-load.js

# Stress test (200 VUs, find breaking point)
k6 run load-tests/k6-stress.js
```

Pass environment variables:
```bash
k6 run -e BASE_URL=https://staging.thea.com.sa \
       -e API_TOKEN=<jwt-token> \
       -e TENANT_ID=<tenant-uuid> \
       load-tests/k6-load.js
```
