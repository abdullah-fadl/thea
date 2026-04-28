// Phase 8.1.3 — NPHIES message-mode Bundle + MessageHeader builder.
//
// NPHIES uses FHIR's message-mode Bundle (`type: "message"`) as its wire
// envelope. Every interaction is a Bundle whose first entry is a
// MessageHeader pointing at a focal resource (e.g. a Claim, an
// CoverageEligibilityRequest, a PaymentNotice). Subsequent entries
// supply the supporting data the focal resource references.
//
// This helper is the construction-side counterpart to the per-resource
// serializers — it doesn't read from the DB. Callers compose the focal +
// contributing resources themselves (typically by calling
// serialize* helpers) and hand them in. We then:
//   1. Mint a deterministic urn:uuid:<id> fullUrl per entry so internal
//      references can resolve without an absolute base URL.
//   2. Build the MessageHeader with destination[].endpoint pointing at the
//      receiver Organization, source.endpoint at the sender Organization,
//      and `focus` referencing the focal resource's urn:uuid.
//   3. Return a Bundle stamped with `meta.profile = MESSAGE_BUNDLE`.
//
// No HTTP — that's 8.1.4. No profile validation — that's 8.1.5.

import type {
  FhirBundle,
  FhirBundleEntry,
  FhirCoding,
  FhirMessageHeader,
  FhirReference,
  FhirResource,
} from './resources/types';
import { NPHIES_PROFILES } from './nphies-profiles';

// `crypto.randomUUID` is available in Node 18+ and the Edge runtime.
function uuid(): string {
  return crypto.randomUUID();
}

function urn(id: string): string {
  return `urn:uuid:${id}`;
}

export interface BuildMessageBundleArgs {
  /** NPHIES event code that pins what this bundle does. */
  eventCoding: FhirCoding;
  /** Sender Organization id (the provider/clinic). */
  senderOrgId: string;
  /** Receiver Organization id (typically the payer or NPHIES hub). */
  receiverOrgId: string;
  /** The driver of the bundle — Claim, CoverageEligibilityRequest, etc. */
  focalResource: FhirResource;
  /** Supporting resources referenced by the focal — Coverage, Patient, etc. */
  contributingResources?: FhirResource[];
  /** Tenant id — recorded in audit trails by callers; not stamped on bundle. */
  tenantId: string;
  /** Optional explicit Bundle/MessageHeader ids (defaults: random uuid). */
  bundleId?: string;
  messageHeaderId?: string;
  /** Optional override for the bundle.timestamp (defaults: now ISO). */
  timestamp?: string;
}

export interface BuiltMessageBundle {
  bundle: FhirBundle;
  /** Map from each input resource id → the urn:uuid fullUrl assigned. */
  fullUrls: Map<string, string>;
}

export function buildNphiesMessageBundle(args: BuildMessageBundleArgs): BuiltMessageBundle {
  const {
    eventCoding,
    senderOrgId,
    receiverOrgId,
    focalResource,
    contributingResources = [],
    bundleId        = uuid(),
    messageHeaderId = uuid(),
    timestamp       = new Date().toISOString(),
  } = args;

  // Mint fullUrls for every resource (focal + contributing). MessageHeader
  // gets its own urn — it's never referenced from elsewhere but FHIR
  // requires fullUrl on every entry of a message bundle.
  const fullUrls = new Map<string, string>();
  const allResources = [focalResource, ...contributingResources];
  for (const r of allResources) {
    if (!r.id) continue;
    fullUrls.set(r.id, urn(r.id));
  }

  const focalRef: FhirReference = {
    reference: focalResource.id ? urn(focalResource.id) : undefined,
    type:      focalResource.resourceType,
  };

  const messageHeader: FhirMessageHeader = {
    resourceType: 'MessageHeader',
    id: messageHeaderId,
    meta: { profile: [NPHIES_PROFILES.MESSAGE_HEADER] },
    eventCoding,
    destination: [{
      endpoint: urn(receiverOrgId),
      receiver: { reference: `Organization/${receiverOrgId}`, type: 'Organization' },
    }],
    sender: { reference: `Organization/${senderOrgId}`, type: 'Organization' },
    source: {
      endpoint: urn(senderOrgId),
    },
    focus: [focalRef],
  };

  const entries: FhirBundleEntry[] = [
    { fullUrl: urn(messageHeaderId), resource: messageHeader },
    ...allResources.map<FhirBundleEntry>(r => ({
      fullUrl:  r.id ? urn(r.id) : undefined,
      resource: r,
    })),
  ];

  const bundle: FhirBundle = {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      lastUpdated: timestamp,
      profile:     [NPHIES_PROFILES.MESSAGE_BUNDLE],
    },
    type: 'message',
    timestamp,
    entry: entries,
  };

  return { bundle, fullUrls };
}
