# Phase 6A — Patient Experience SLA Scheduler

## Overview

This implementation provides automatic SLA escalation for Patient Experience cases. Overdue cases are automatically escalated every 15 minutes without manual intervention.

## Architecture

### 1. Shared SLA Function
- **Location**: `lib/patient-experience/runSla.ts`
- **Function**: `runPxSla(actorUserId?: string)`
- **Purpose**: Core logic for finding and escalating overdue cases
- **Returns**: `{ scanned, escalated, skipped, errors? }`

### 2. Manual Endpoint (Existing)
- **Path**: `POST /api/patient-experience/cases/run-sla`
- **Security**: Requires admin/supervisor role
- **Usage**: Manual trigger from UI or API calls
- **Changes**: Now uses shared `runPxSla()` function

### 3. Cron Endpoint (New)
- **Path**: `GET /api/cron/patient-experience/run-sla`
- **Security**: Protected by `CRON_SECRET` (header or query param)
- **Usage**: Called automatically by scheduler
- **Response**: `{ ok: true, scanned, escalated, skipped }`

## Deployment Options

### Option A: Vercel (Recommended for Vercel deployments)

1. **Configure `vercel.json`** (already created):
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/patient-experience/run-sla",
         "schedule": "*/15 * * * *"
       }
     ]
   }
   ```

2. **Set Environment Variable**:
   - In Vercel dashboard: Settings → Environment Variables
   - Add: `CRON_SECRET` = (generate a secure random string)
   - Example: `openssl rand -hex 32`

3. **Deploy**: Vercel will automatically call the endpoint every 15 minutes

### Option B: Long-running Node.js Server

1. **Install node-cron**:
   ```bash
   npm install node-cron @types/node-cron
   ```

2. **Import scheduler in server entry point**:
   ```typescript
   // In your server.ts or app entry file
   import { startPxSlaScheduler } from '@/lib/patient-experience/scheduler';
   
   // Start scheduler (only in production or when enabled)
   if (process.env.ENABLE_SLA_SCHEDULER === 'true') {
     startPxSlaScheduler(true);
   }
   ```

3. **Set Environment Variable**:
   - `CRON_SECRET` = (secure random string)
   - `ENABLE_SLA_SCHEDULER=true` (optional, to enable scheduler)

4. **External Cron Alternative**: Use system cron (crontab) to call the endpoint:
   ```bash
   */15 * * * * curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/patient-experience/run-sla
   ```

## Security

### CRON_SECRET Protection

The cron endpoint requires authentication via:
- **Header**: `x-cron-secret: YOUR_SECRET`
- **Query Param**: `?secret=YOUR_SECRET`

**Important**: 
- Generate a strong, random secret
- Never commit `CRON_SECRET` to version control
- Use environment variables only
- Rotate secrets periodically

### Generating a Secure Secret

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing

### Test Manual Endpoint
```bash
curl -X POST http://localhost:3000/api/patient-experience/cases/run-sla \
  -H "x-user-id: USER_ID" \
  -H "x-user-role: admin"
```

### Test Cron Endpoint
```bash
# With header
curl -H "x-cron-secret: YOUR_SECRET" \
  http://localhost:3000/api/cron/patient-experience/run-sla

# With query param
curl "http://localhost:3000/api/cron/patient-experience/run-sla?secret=YOUR_SECRET"
```

## Behavior

### What Happens Every 15 Minutes

1. **Scan**: Finds all overdue cases:
   - Status: `OPEN` or `IN_PROGRESS`
   - `dueAt < now`
   - `active !== false`

2. **Escalate**: For each overdue case:
   - Sets status to `ESCALATED`
   - Increments `escalationLevel` (max: 3)
   - Creates audit record
   - Creates notification for assigned department

3. **Skip**: Cases already `ESCALATED` or at max escalation level are skipped

### Audit Trail

- All escalations are recorded in `px_case_audits`
- Actor is `'system'` for cron-initiated runs
- Actor is `userId` for manual runs

### Notifications

- Type: `PX_CASE_ESCALATED`
- Recipient: Assigned department
- Includes escalation level and due date in metadata

## Monitoring

### Logs

The cron endpoint logs:
- Execution start/completion
- Counts: scanned, escalated, skipped
- Errors (if any)

### Response Format

```json
{
  "ok": true,
  "scanned": 5,
  "escalated": 2,
  "skipped": 3,
  "errors": [] // optional, only if errors occurred
}
```

## Troubleshooting

### Cron Not Running (Vercel)

1. Check `vercel.json` is in root directory
2. Verify cron configuration in Vercel dashboard
3. Check deployment logs for errors
4. Ensure `CRON_SECRET` is set in environment variables

### Cron Not Running (Node.js)

1. Verify `node-cron` is installed
2. Check scheduler is imported and started
3. Verify `ENABLE_SLA_SCHEDULER` is set (if using)
4. Check server logs for scheduler start message

### 401 Unauthorized

- Verify `CRON_SECRET` environment variable is set
- Check secret matches in request header/query
- Ensure secret is not empty

### No Cases Escalated

- Check if cases exist with `status: OPEN/IN_PROGRESS`
- Verify `dueAt` is in the past
- Check `active` field is not `false`
- Review escalation level (max is 3)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | Yes | Secret for authenticating cron requests |
| `ENABLE_SLA_SCHEDULER` | No | Enable node-cron scheduler (for Node.js servers) |
| `NODE_ENV` | No | Scheduler auto-enables in production |

## Files Created/Modified

### New Files
- `lib/patient-experience/runSla.ts` - Shared SLA runner function
- `lib/patient-experience/scheduler.ts` - Node-cron scheduler (optional)
- `app/api/cron/patient-experience/run-sla/route.ts` - Cron endpoint
- `vercel.json` - Vercel cron configuration
- `docs/PHASE6A_SLA_SCHEDULER.md` - This documentation

### Modified Files
- `app/api/patient-experience/cases/run-sla/route.ts` - Refactored to use shared function

## Acceptance Criteria ✅

- ✅ Overdue cases automatically become `ESCALATED` within ~15 minutes
- ✅ Audit records created for all escalations
- ✅ Notifications sent to assigned departments
- ✅ Endpoint secured with `CRON_SECRET`
- ✅ Logs show execution summary
- ✅ Works on both Vercel and long-running Node.js servers
- ✅ No duplicate schedulers in development
