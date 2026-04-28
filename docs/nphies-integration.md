# NPHIES Integration — HTTP Transport (Phase 8.1.4)

> Phase 8.1.4 wires the HTTP transport layer for the Saudi NPHIES gateway.
> All outbound traffic is gated behind `FF_NPHIES_HTTP_ENABLED` and requires
> a complete env config — there is **no fallback** to bundled credentials.

---

## 1. Configuration

The adapter reads from `process.env`. All four required vars must be set
before flipping the flag on; otherwise the adapter throws a clear error.

| Variable               | Required | Example                                              | Description                                |
| ---------------------- | :------: | ---------------------------------------------------- | ------------------------------------------ |
| `NPHIES_GATEWAY_URL`   |    ✓     | `https://sandbox.nphies.sa/$process-message`         | Full URL the message bundle is POSTed to.  |
| `NPHIES_CLIENT_ID`     |    ✓     | `thea-clinic-12345`                                  | OAuth2 client_credentials client id.       |
| `NPHIES_CLIENT_SECRET` |    ✓     | _(provided by NPHIES onboarding)_                    | OAuth2 secret. Never commit.               |
| `NPHIES_ENVIRONMENT`   |    ✓     | `sandbox` &#124; `production`                        | Drives logging + future profile selection. |
| `NPHIES_TOKEN_URL`     |          | `https://sandbox.nphies.sa/oauth2/token`             | Override OAuth endpoint (default: derived from gateway URL). |
| `NPHIES_TIMEOUT_MS`    |          | `30000`                                              | Per-request timeout (default 30s).         |
| `NPHIES_RETRY_COUNT`   |          | `1`                                                  | Number of 5xx retries (default 1; 4xx never retried). |

The flag itself:

| Flag                       | Env var                       | Default | Effect when ON                                            |
| -------------------------- | ----------------------------- | :-----: | ---------------------------------------------------------- |
| `FF_NPHIES_HTTP_ENABLED`   | `THEA_FF_NPHIES_HTTP_ENABLED` |   OFF   | All `lib/integrations/nphies/*` send paths hit the network.|

**Flag-OFF behaviour (default):**

- `getNphiesAccessToken()` returns the constant `mock-token-flag-off`.
- `sendNphiesMessage()` waits 50 ms and returns the input bundle echoed back
  with a synthetic `MessageHeader.response.code = 'ok'` — zero outbound HTTP.
- The three send routes return HTTP 404 + an OperationOutcome.

This is the safe state for CI, staging, and for any environment that has not
yet completed NPHIES onboarding.

---

## 2. Sandbox endpoint URLs

The KSA NPHIES sandbox lives at `sandbox.nphies.sa`. The two endpoints used
by the adapter:

| Purpose                        | Method | Path                  |
| ------------------------------ | :----: | --------------------- |
| OAuth2 token (client_credentials) | POST | `/oauth2/token`       |
| Message bundle round-trip      |  POST  | `/$process-message`   |

Production hostnames are issued by NPHIES during go-live onboarding; switch
`NPHIES_GATEWAY_URL` and set `NPHIES_ENVIRONMENT=production` once the
production credentials are minted.

---

## 3. Auth flow

1. Caller invokes `getNphiesAccessToken()` (or any send helper that needs it).
2. If a cached token exists and has not expired (`expires_in − 60s buffer`),
   it is returned directly.
3. Otherwise we POST `grant_type=client_credentials` to the token URL with
   `client_id` + `client_secret` (form-encoded body), parse `access_token` /
   `expires_in` from the JSON response, cache it, and return it.
4. Token failures throw — the adapter does not retry token requests beyond
   the explicit retries configured for the message endpoint.

The cache lives in-memory inside the Node process; it does not survive
restarts. That's intentional — restart-on-redeploy is the safest token
refresh strategy.

---

## 4. Local testing without real credentials

The fastest way to test the wiring end-to-end is the **flag-OFF mock path**:

```bash
# Default state — no NPHIES_* env vars needed.
yarn test __tests__/lib/integrations/nphies
```

The 21 tests cover config loading, OAuth caching, transport (mock + real
fetch via `vi.spyOn(globalThis, 'fetch')`), retry on 5xx, no-retry on 4xx,
and the operations layer with stubbed Prisma.

For an interactive smoke test against the bundled mock:

```bash
# Optional — flip the FHIR API on; HTTP flag stays OFF for safety.
export THEA_FF_FHIR_API_ENABLED=true

# Then call any of the three send routes; they will return HTTP 404
# OperationOutcome until FF_NPHIES_HTTP_ENABLED is also on.
```

To exercise the real transport against the sandbox, set the four required
vars and `THEA_FF_NPHIES_HTTP_ENABLED=true`.

---

## 5. Going live — production checklist

> Do not flip `FF_NPHIES_HTTP_ENABLED=true` in production until every box
> below is checked.

- [ ] Production NPHIES credentials onboarded (license id, sender id,
      provider id) and stored in the secrets manager (not in `.env.local`).
- [ ] `NPHIES_GATEWAY_URL` points at the production endpoint, not the
      sandbox.
- [ ] `NPHIES_ENVIRONMENT=production`.
- [ ] **Phase 8.1.5 profile validator merged and enabled** — without it,
      malformed bundles will be rejected by NPHIES with opaque 4xx errors.
- [ ] `nphies.send` permission granted only to the billing-submitter role
      group; default tenant users cannot trigger sends.
- [ ] At least one end-to-end eligibility check completed against the
      sandbox during the onboarding period.
- [ ] Logs (`category: 'integration'`, `subsystem: 'nphies.http'`)
      forwarded to the central log store with tenantId/correlationId
      retained for audit.
- [ ] Alerting wired on repeated 5xx or 401/403 from the gateway.
- [ ] Rollback plan confirmed: flipping the flag back to OFF restores the
      mock-mode behaviour with zero outbound traffic.

---

## 6. Module map

| File                                       | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `lib/core/flags/index.ts`                  | `FF_NPHIES_HTTP_ENABLED` registration.               |
| `lib/integrations/nphies/config.ts`        | `getNphiesConfig()` — env-driven adapter config.     |
| `lib/integrations/nphies/auth.ts`          | OAuth2 token cache + flag-OFF mock token.            |
| `lib/integrations/nphies/adapter.ts`       | `sendNphiesMessage()` HTTP transport + retry.        |
| `lib/integrations/nphies/operations.ts`    | `sendEligibilityCheck()`, `sendClaim()` orchestrators. |
| `app/api/fhir/$process-message/route.ts`   | Generic Bundle round-trip.                           |
| `app/api/integrations/nphies/eligibility/[id]/send/route.ts` | Trigger eligibility submission. |
| `app/api/integrations/nphies/claims/[id]/send/route.ts`      | Trigger claim submission.       |

The Phase 8.1.5 profile validator will plug in between the bundle builder
and the adapter without changing this surface.
