// Phase 8.1.3 — NPHIES message-event codes (the `MessageHeader.eventCoding`
// values that NPHIES routes on to dispatch a Bundle to the right service).
//
// All NPHIES message-mode bundles MUST carry exactly one MessageHeader
// whose `eventCoding` matches one of these. The HTTP adapter (8.1.4) will
// look at this code to know which NPHIES endpoint to POST the bundle to.
//
// Source: KSA NPHIES specification — `ksa-message-events` CodeSystem.

const SYSTEM = 'http://nphies.sa/terminology/CodeSystem/ksa-message-events' as const;

export const NPHIES_EVENTS = {
  ELIGIBILITY:    { system: SYSTEM, code: 'eligibility-request', display: 'Eligibility request' },
  PRIOR_AUTH:     { system: SYSTEM, code: 'priorauth-request',   display: 'Prior authorization request' },
  CLAIM:          { system: SYSTEM, code: 'claim-request',       display: 'Claim request' },
  PAYMENT_NOTICE: { system: SYSTEM, code: 'payment-notice',      display: 'Payment notice' },
  POLL:           { system: SYSTEM, code: 'poll-request',        display: 'Poll request' },
  STATUS:         { system: SYSTEM, code: 'status-check',        display: 'Status check' },
} as const;

export type NphiesEvent     = typeof NPHIES_EVENTS[keyof typeof NPHIES_EVENTS];
export type NphiesEventCode = NphiesEvent['code'];
