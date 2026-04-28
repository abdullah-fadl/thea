/**
 * Receptionist Actor — Patient registration + OPD walk-in + ER registration.
 */

import { BaseActor, type ActorOptions } from './base';
import type { PatientData } from '../data/patients';

export class Receptionist extends BaseActor {
  constructor(opts: Omit<ActorOptions, 'role' | 'label'>) {
    super({ ...opts, role: 'reception', label: 'Receptionist' });
  }

  /** Register a new patient */
  async registerPatient(patient: PatientData): Promise<{ id: string; mrn: string }> {
    const res = await this.post<{ success: boolean; patient: { id: string; mrn: string } } | { id: string; mrn: string }>('/api/patients', {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dob: patient.dob,
      gender: patient.gender,
      identifiers: {
        nationalId: patient.nationalId,
      },
      mobile: patient.mobile,
      nationality: patient.nationality,
      city: patient.city,
    });
    const raw = this.assertOk(res, 'Register patient');
    // Handle both { success, patient: { id, mrn } } and { id, mrn } response formats
    if ('patient' in raw && raw.patient) {
      return { id: raw.patient.id, mrn: raw.patient.mrn };
    }
    return raw as { id: string; mrn: string };
  }

  /** Create OPD walk-in booking */
  async walkIn(patientId: string, departmentId: string): Promise<{ bookingId: string; encounterCoreId: string }> {
    const res = await this.post<{ bookingId: string; encounterCoreId: string }>('/api/opd/booking/walk-in', {
      patientMasterId: patientId,
      clinicId: departmentId,
      chiefComplaint: 'General checkup',
      priority: 'NORMAL',
    });
    return this.assertOk(res, 'Walk-in booking');
  }

  /** Register known patient in ER */
  async erRegisterKnown(patientId: string, chiefComplaint: string): Promise<{ encounterId: string; encounterCoreId: string }> {
    const res = await this.post<{ encounter: { id: string; encounterCoreId?: string }; encounterId?: string }>('/api/er/encounters/known', {
      patientId,
      chiefComplaint,
      arrivalMode: 'WALK_IN',
      idempotencyKey: `er-${patientId}-${Date.now()}`,
    });
    const raw = this.assertOk(res, 'ER register known patient');
    // API returns { encounter: { id, encounterCoreId } } — normalize
    const encounterId = raw.encounter?.id || raw.encounterId || (raw as Record<string, unknown>).id as string;
    const encounterCoreId = raw.encounter?.encounterCoreId || (raw as Record<string, unknown>).encounterCoreId as string || encounterId;
    return { encounterId, encounterCoreId };
  }

  /** Register unknown patient in ER */
  async erRegisterUnknown(chiefComplaint: string): Promise<{ encounterId: string }> {
    const res = await this.post<{ encounter: { id: string }; encounterId?: string }>('/api/er/encounters/unknown', {
      chiefComplaint,
      arrivalMode: 'AMBULANCE',
      estimatedAge: 40,
      gender: 'MALE',
      idempotencyKey: `er-unknown-${Date.now()}`,
    });
    const raw = this.assertOk(res, 'ER register unknown patient');
    return { encounterId: raw.encounter?.id || raw.encounterId || (raw as Record<string, unknown>).id as string };
  }

  /** Search patients */
  async searchPatients(query: string): Promise<{ patients: Array<{ id: string }> }> {
    const res = await this.get<{ patients: Array<{ id: string }> }>('/api/patients/search', { q: query });
    return this.assertOk(res, 'Search patients');
  }

  /** Get OPD departments */
  async getDepartments(): Promise<{ departments: Array<{ id: string; name: string }> }> {
    const res = await this.get<{ departments: Array<{ id: string; name: string }> }>('/api/opd/departments');
    return this.assertOk(res, 'Get departments');
  }
}
