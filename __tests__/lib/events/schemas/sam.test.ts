/**
 * Phase 7.5 — SAM event schema tests
 *
 * One describe per registered event:
 *   1. policy.published@v1
 *   2. policy.acknowledged@v1
 *   3. incident.reported@v1
 *
 * The schemas use Zod v4's default object semantics (unknown keys stripped).
 * Sensitivity discipline: policy bodies, acknowledger emails / IPs, and
 * incident free-text (description, location, patient identifiers) MUST
 * never appear in the parsed payload — only the declared identifiers,
 * scope, status / severity enums, and timestamps.
 */

import { describe, it, expect } from 'vitest';
import '@/lib/events/schemas';
import { getSchema } from '@/lib/events/registry';

const TENANT_ID            = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const DRAFT_ID             = '550e8400-e29b-41d4-a716-446655440000';
const ACKNOWLEDGMENT_ID    = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const INCIDENT_ID          = '7d3a9c2e-1b8d-4c4f-9e7a-2f5e8a1d3c4b';
const ENCOUNTER_ID         = '8e4b0d3f-2c9e-45a0-9f8b-3a6f9b2e4d5c';
const NOW_ISO              = '2026-04-25T10:00:00.000Z';

describe('SAM event schemas', () => {
  describe('policy.published@v1', () => {
    const schema = getSchema('policy.published', 1).payloadSchema;

    it('accepts a valid payload (with non-null thea-engine reference)', () => {
      const result = schema.safeParse({
        draftId: DRAFT_ID,
        tenantId: TENANT_ID,
        publishedTheaEngineId: 'pol-2026-0042',
        status: 'published',
        publishedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects status other than literal "published"', () => {
      const result = schema.safeParse({
        draftId: DRAFT_ID,
        tenantId: TENANT_ID,
        publishedTheaEngineId: null,
        status: 'draft',
        publishedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips policy body + draft metadata (title, content, departmentId, operationId)', () => {
      const result = schema.safeParse({
        draftId: DRAFT_ID,
        tenantId: TENANT_ID,
        publishedTheaEngineId: 'pol-2026-0042',
        status: 'published',
        publishedAt: NOW_ISO,
        title: 'Code Blue Response Protocol',
        content: '## Step 1 — call resuscitation team ...',
        departmentId: 'dept-er',
        operationId: 'op-resuscitation',
        publishedBy: 'user-quality-director',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('title');
        expect(result.data).not.toHaveProperty('content');
        expect(result.data).not.toHaveProperty('departmentId');
        expect(result.data).not.toHaveProperty('operationId');
        expect(result.data).not.toHaveProperty('publishedBy');
      }
    });
  });

  describe('policy.acknowledged@v1', () => {
    const schema = getSchema('policy.acknowledged', 1).payloadSchema;

    it('accepts a valid payload (version is nullable)', () => {
      const result = schema.safeParse({
        acknowledgmentId: ACKNOWLEDGMENT_ID,
        tenantId: TENANT_ID,
        policyId: 'pol-2026-0042',
        userId: 'user-staff-007',
        version: null,
        acknowledgedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects payload with missing required acknowledgedAt', () => {
      const result = schema.safeParse({
        acknowledgmentId: ACKNOWLEDGMENT_ID,
        tenantId: TENANT_ID,
        policyId: 'pol-2026-0042',
        userId: 'user-staff-007',
        version: 3,
      });
      expect(result.success).toBe(false);
    });

    it('strips identity + IP fields (userName, userEmail, ipAddress, metadata)', () => {
      const result = schema.safeParse({
        acknowledgmentId: ACKNOWLEDGMENT_ID,
        tenantId: TENANT_ID,
        policyId: 'pol-2026-0042',
        userId: 'user-staff-007',
        version: 3,
        acknowledgedAt: NOW_ISO,
        userName: 'Sarah Al-Rashid',
        userEmail: 'sarah.alrashid@kfmc.med.sa',
        ipAddress: '10.42.7.91',
        metadata: { device: 'iPad-7', clinicalRole: 'RN' },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('userName');
        expect(result.data).not.toHaveProperty('userEmail');
        expect(result.data).not.toHaveProperty('ipAddress');
        expect(result.data).not.toHaveProperty('metadata');
      }
    });
  });

  describe('incident.reported@v1', () => {
    const schema = getSchema('incident.reported', 1).payloadSchema;

    it('accepts a valid CRITICAL payload', () => {
      const result = schema.safeParse({
        incidentId: INCIDENT_ID,
        tenantId: TENANT_ID,
        type: 'MEDICATION_ERROR',
        severity: 'CRITICAL',
        status: 'OPEN',
        encounterCoreId: ENCOUNTER_ID,
        reportedAt: NOW_ISO,
      });
      expect(result.success).toBe(true);
    });

    it('rejects severity outside {LOW, MEDIUM, HIGH, CRITICAL}', () => {
      const result = schema.safeParse({
        incidentId: INCIDENT_ID,
        tenantId: TENANT_ID,
        type: 'FALL',
        severity: 'CATASTROPHIC',
        status: 'OPEN',
        encounterCoreId: null,
        reportedAt: NOW_ISO,
      });
      expect(result.success).toBe(false);
    });

    it('strips PHI free-text (description, location, episodeId, patientId, reporterEmail)', () => {
      const result = schema.safeParse({
        incidentId: INCIDENT_ID,
        tenantId: TENANT_ID,
        type: 'MEDICATION_ERROR',
        severity: 'HIGH',
        status: 'OPEN',
        encounterCoreId: ENCOUNTER_ID,
        reportedAt: NOW_ISO,
        description: 'Patient X received double dose of warfarin at 14:00',
        location: 'ICU Bed 3',
        episodeId: 'ep-22341',
        patientId: 'pt-Mohammed-AlSaud',
        reporterEmail: 'nurse.lead@kfmc.med.sa',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('description');
        expect(result.data).not.toHaveProperty('location');
        expect(result.data).not.toHaveProperty('episodeId');
        expect(result.data).not.toHaveProperty('patientId');
        expect(result.data).not.toHaveProperty('reporterEmail');
      }
    });
  });
});
