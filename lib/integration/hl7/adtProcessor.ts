/**
 * ADT Event Processor
 *
 * Processes ADT (Admit/Discharge/Transfer) events received via HL7:
 *   A01 — Admit inpatient: match patient → create EncounterCore + IpdEpisode
 *   A02 — Transfer: update encounter/episode location
 *   A03 — Discharge: close encounter + episode
 *   A04 — Register outpatient: create EncounterCore + OpdEncounter
 *   A08 — Update patient demographics
 *
 * This processor bridges external hospital systems (PACS, RIS, pharmacy)
 * with Thea EHR's internal encounter workflow.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import type { ADTEvent } from './types';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ADTProcessResult {
  success: boolean;
  eventType: string;
  patientId: string | null;
  actions: string[];
  errors: string[];
  ackCode: 'AA' | 'AE' | 'AR';
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processADTEvent(
  tenantId: string,
  event: ADTEvent,
): Promise<ADTProcessResult> {
  const result: ADTProcessResult = {
    success: false,
    eventType: event.eventType,
    patientId: null,
    actions: [],
    errors: [],
    ackCode: 'AE',
  };

  try {
    // Step 1: Match patient by MRN or external patient ID
    const patient = await matchPatient(tenantId, event);
    if (!patient) {
      result.errors.push(`Patient not found: MRN=${event.patientId}`);
      result.actions.push('patient_not_matched');
      // Still return AA — we logged the event, just can't process it
      result.ackCode = 'AA';
      result.success = true;
      return result;
    }
    result.patientId = patient.id;

    // Step 2: Route to handler based on event type
    switch (event.eventType) {
      case 'A01':
        await handleAdmit(tenantId, patient, event, result);
        break;
      case 'A02':
        await handleTransfer(tenantId, patient, event, result);
        break;
      case 'A03':
        await handleDischarge(tenantId, patient, event, result);
        break;
      case 'A04':
        await handleRegisterOutpatient(tenantId, patient, event, result);
        break;
      case 'A08':
        await handleUpdatePatient(tenantId, patient, event, result);
        break;
      default:
        result.errors.push(`Unsupported ADT event type: ${event.eventType}`);
        result.ackCode = 'AR';
        return result;
    }

    result.success = true;
    result.ackCode = 'AA';
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Processing error: ${errMsg}`);
    result.ackCode = 'AE';
    logger.error('ADT processing failed', { category: 'hl7', tenantId, eventType: event.eventType, error: errMsg });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Patient matching
// ---------------------------------------------------------------------------

interface MatchedPatient {
  id: string;
  mrn: string | null;
  fullName: string;
}

async function matchPatient(
  tenantId: string,
  event: ADTEvent,
): Promise<MatchedPatient | null> {
  if (!event.patientId) return null;

  // Try matching by MRN first (primary identifier in HL7 PID-3)
  const patient = await prisma.patientMaster.findFirst({
    where: {
      tenantId,
      OR: [
        { mrn: event.patientId },
        { nationalId: event.patientId },
        { iqama: event.patientId },
      ],
    },
    select: { id: true, mrn: true, fullName: true },
  });

  if (patient) return patient;

  // Fallback: search by name (less reliable)
  if (event.patientName) {
    const nameSearch = event.patientName.replace(',', ' ').trim().toLowerCase();
    const byName = await prisma.patientMaster.findFirst({
      where: {
        tenantId,
        nameNormalized: { contains: nameSearch },
      },
      select: { id: true, mrn: true, fullName: true },
    });
    return byName;
  }

  return null;
}

// ---------------------------------------------------------------------------
// A01 — Admit (Inpatient)
// ---------------------------------------------------------------------------

async function handleAdmit(
  tenantId: string,
  patient: MatchedPatient,
  event: ADTEvent,
  result: ADTProcessResult,
): Promise<void> {
  const now = new Date();

  // Check for existing active inpatient encounter
  const existing = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId: patient.id,
      encounterType: 'IPD',
      status: { not: 'CLOSED' },
    },
  });

  if (existing) {
    result.actions.push('encounter_already_exists');
    result.errors.push(`Patient already has active IPD encounter: ${existing.id}`);
    return;
  }

  // Create EncounterCore
  const encounter = await prisma.encounterCore.create({
    data: {
      tenantId,
      patientId: patient.id,
      encounterType: 'IPD',
      status: 'ACTIVE',
      department: event.assignedLocation || 'IPD',
      openedAt: event.admitDateTime ? new Date(event.admitDateTime) : now,
      sourceId: event.messageId,
    },
  });
  result.actions.push('encounter_created');

  // Create IpdEpisode
  await prisma.ipdEpisode.create({
    data: {
      tenantId,
      encounterId: encounter.id,
      encounterType: 'IPD',
      patient: { id: patient.id, fullName: patient.fullName },
      serviceUnit: event.assignedLocation || undefined,
      status: 'ACTIVE',
      source: { type: 'HL7_ADT', messageId: event.messageId },
      location: event.assignedLocation
        ? { ward: event.assignedLocation, unit: '', room: '', bed: '' }
        : undefined,
      reasonForAdmission: `HL7 ADT^A01 Admit — Visit #${event.visitNumber || 'N/A'}`,
    },
  });
  result.actions.push('ipd_episode_created');

  logger.info('ADT A01: Patient admitted via HL7', {
    category: 'hl7',
    tenantId,
    patientId: patient.id,
    encounterId: encounter.id,
  });
}

// ---------------------------------------------------------------------------
// A02 — Transfer
// ---------------------------------------------------------------------------

async function handleTransfer(
  tenantId: string,
  patient: MatchedPatient,
  event: ADTEvent,
  result: ADTProcessResult,
): Promise<void> {
  // Find active IPD encounter for patient
  const encounter = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId: patient.id,
      encounterType: 'IPD',
      status: 'ACTIVE',
    },
    select: { id: true },
  });

  if (!encounter) {
    result.errors.push('No active IPD encounter found for transfer');
    result.actions.push('no_active_encounter');
    return;
  }

  // Update encounter department
  await prisma.encounterCore.update({
    where: { id: encounter.id },
    data: { department: event.assignedLocation || 'IPD' },
  });
  result.actions.push('encounter_location_updated');

  // Update IPD episode location
  await prisma.ipdEpisode.updateMany({
    where: { tenantId, encounterId: encounter.id, status: 'ACTIVE' },
    data: {
      serviceUnit: event.assignedLocation || undefined,
      location: event.assignedLocation
        ? { ward: event.assignedLocation, unit: '', room: '', bed: '' }
        : undefined,
    },
  });
  result.actions.push('ipd_episode_location_updated');

  logger.info('ADT A02: Patient transferred via HL7', {
    category: 'hl7',
    tenantId,
    patientId: patient.id,
    newLocation: event.assignedLocation,
  });
}

// ---------------------------------------------------------------------------
// A03 — Discharge
// ---------------------------------------------------------------------------

async function handleDischarge(
  tenantId: string,
  patient: MatchedPatient,
  event: ADTEvent,
  result: ADTProcessResult,
): Promise<void> {
  const now = new Date();
  const dischargeTime = event.dischargeDateTime ? new Date(event.dischargeDateTime) : now;

  // Find active encounter (IPD preferred, then ER)
  const encounter = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId: patient.id,
      status: 'ACTIVE',
      encounterType: { in: ['IPD', 'ER'] },
    },
    orderBy: { openedAt: 'desc' },
    select: { id: true, encounterType: true },
  });

  if (!encounter) {
    result.errors.push('No active encounter found for discharge');
    result.actions.push('no_active_encounter');
    return;
  }

  // Close EncounterCore
  await prisma.encounterCore.update({
    where: { id: encounter.id },
    data: { status: 'CLOSED', closedAt: dischargeTime },
  });
  result.actions.push('encounter_closed');

  // Close IPD episode if applicable
  if (encounter.encounterType === 'IPD') {
    await prisma.ipdEpisode.updateMany({
      where: { tenantId, encounterId: encounter.id, status: { not: 'DISCHARGED' } },
      data: {
        status: 'DISCHARGED',
        closedAt: dischargeTime,
        doctorSummary: `Discharged via HL7 ADT^A03 — Visit #${event.visitNumber || 'N/A'}`,
      },
    });
    result.actions.push('ipd_episode_discharged');
  }

  logger.info('ADT A03: Patient discharged via HL7', {
    category: 'hl7',
    tenantId,
    patientId: patient.id,
    encounterId: encounter.id,
  });
}

// ---------------------------------------------------------------------------
// A04 — Register Outpatient
// ---------------------------------------------------------------------------

async function handleRegisterOutpatient(
  tenantId: string,
  patient: MatchedPatient,
  event: ADTEvent,
  result: ADTProcessResult,
): Promise<void> {
  const now = new Date();

  // Check for existing active OPD encounter
  const existing = await prisma.encounterCore.findFirst({
    where: {
      tenantId,
      patientId: patient.id,
      encounterType: 'OPD',
      status: { not: 'CLOSED' },
    },
  });

  if (existing) {
    result.actions.push('encounter_already_exists');
    result.errors.push(`Patient already has active OPD encounter: ${existing.id}`);
    return;
  }

  // Create EncounterCore
  const encounter = await prisma.encounterCore.create({
    data: {
      tenantId,
      patientId: patient.id,
      encounterType: 'OPD',
      status: 'ACTIVE',
      department: event.assignedLocation || 'OPD',
      openedAt: event.admitDateTime ? new Date(event.admitDateTime) : now,
      sourceId: event.messageId,
    },
  });
  result.actions.push('encounter_created');

  // Create OpdEncounter
  await prisma.opdEncounter.create({
    data: {
      tenantId,
      encounterCoreId: encounter.id,
      patientId: patient.id,
      status: 'OPEN',
      arrivedAt: now,
    },
  });
  result.actions.push('opd_encounter_created');

  logger.info('ADT A04: Outpatient registered via HL7', {
    category: 'hl7',
    tenantId,
    patientId: patient.id,
    encounterId: encounter.id,
  });
}

// ---------------------------------------------------------------------------
// A08 — Update Patient Info
// ---------------------------------------------------------------------------

async function handleUpdatePatient(
  tenantId: string,
  patient: MatchedPatient,
  event: ADTEvent,
  result: ADTProcessResult,
): Promise<void> {
  const updates: Record<string, any> = {};

  // Parse patient name (HL7 format: LastName, FirstName)
  if (event.patientName) {
    const parts = event.patientName.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      updates.lastName = parts[0];
      updates.firstName = parts[1];
      updates.fullName = `${parts[1]} ${parts[0]}`;
      updates.nameNormalized = `${parts[1]} ${parts[0]}`.toLowerCase();
    }
  }

  if (event.dateOfBirth) {
    // HL7 date format: YYYYMMDD
    const dob = parseHL7Date(event.dateOfBirth);
    if (dob) updates.dob = dob;
  }

  if (event.sex) {
    const genderMap: Record<string, string> = { M: 'MALE', F: 'FEMALE', O: 'OTHER', U: 'UNKNOWN' };
    const gender = genderMap[event.sex.toUpperCase()];
    if (gender) updates.gender = gender;
  }

  if (Object.keys(updates).length === 0) {
    result.actions.push('no_updates_needed');
    return;
  }

  await prisma.patientMaster.update({
    where: { id: patient.id },
    data: updates,
  });
  result.actions.push('patient_demographics_updated');

  logger.info('ADT A08: Patient info updated via HL7', {
    category: 'hl7',
    tenantId,
    patientId: patient.id,
    updatedFields: Object.keys(updates),
  });
}

// ---------------------------------------------------------------------------
// Utility: Parse HL7 date (YYYYMMDD) to Date
// ---------------------------------------------------------------------------

function parseHL7Date(hl7Date: string): Date | null {
  if (!hl7Date || hl7Date.length < 8) return null;
  const year = parseInt(hl7Date.substring(0, 4), 10);
  const month = parseInt(hl7Date.substring(4, 6), 10) - 1;
  const day = parseInt(hl7Date.substring(6, 8), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}
