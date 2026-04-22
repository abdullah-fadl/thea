/**
 * Tracks all entities created during simulation for cross-reference and cleanup.
 */
export interface PatientRef {
  id: string;
  mrn: string;
  name: string;
}

export interface EncounterRef {
  id: string;
  type: 'OPD' | 'ER' | 'IPD' | 'ICU';
  patientId: string;
  status?: string;
}

export interface OrderRef {
  id: string;
  kind: string;
  encounterCoreId: string;
  status: string;
}

export interface EpisodeRef {
  id: string;
  encounterCoreId: string;
  type?: string;
}

export class SimulationState {
  patients = new Map<string, PatientRef>();
  encounters = new Map<string, EncounterRef>();
  orders = new Map<string, OrderRef>();
  bookings = new Map<string, { id: string; encounterCoreId: string }>();
  episodes = new Map<string, EpisodeRef>();

  trackPatient(data: PatientRef): void {
    this.patients.set(data.id, data);
  }

  trackEncounter(data: EncounterRef): void {
    this.encounters.set(data.id, data);
  }

  trackOrder(data: OrderRef): void {
    this.orders.set(data.id, data);
  }

  trackBooking(data: { id: string; encounterCoreId: string }): void {
    this.bookings.set(data.id, data);
  }

  trackEpisode(data: EpisodeRef): void {
    this.episodes.set(data.id, data);
  }

  getRandomPatient(): PatientRef | undefined {
    const arr = Array.from(this.patients.values());
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
  }

  getRandomEncounter(type?: string): EncounterRef | undefined {
    const arr = Array.from(this.encounters.values()).filter(
      (e) => (!type || e.type === type),
    );
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
  }

  // ── CVision HR entity tracking ──

  cvisionEmployees = new Map<string, CVisionEmployeeRef>();
  cvisionRequisitions = new Map<string, CVisionRequisitionRef>();
  cvisionPayrollRuns = new Map<string, CVisionPayrollRunRef>();
  cvisionDepartments = new Map<string, { id: string; name: string; code: string }>();

  trackCVisionEmployee(data: CVisionEmployeeRef): void {
    this.cvisionEmployees.set(data.id, data);
  }

  trackCVisionRequisition(data: CVisionRequisitionRef): void {
    this.cvisionRequisitions.set(data.id, data);
  }

  trackCVisionPayrollRun(data: CVisionPayrollRunRef): void {
    this.cvisionPayrollRuns.set(data.id, data);
  }

  trackCVisionDepartment(data: { id: string; name: string; code: string }): void {
    this.cvisionDepartments.set(data.id, data);
  }

  getRandomCVisionEmployee(): CVisionEmployeeRef | undefined {
    const arr = Array.from(this.cvisionEmployees.values());
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
  }

  get stats() {
    return {
      patients: this.patients.size,
      encounters: this.encounters.size,
      orders: this.orders.size,
      bookings: this.bookings.size,
      episodes: this.episodes.size,
      cvisionEmployees: this.cvisionEmployees.size,
      cvisionRequisitions: this.cvisionRequisitions.size,
      cvisionPayrollRuns: this.cvisionPayrollRuns.size,
    };
  }
}

// ── CVision entity references ──

export interface CVisionEmployeeRef {
  id: string;
  employeeNo: string;
  name: string;
  departmentId?: string;
  status?: string;
}

export interface CVisionRequisitionRef {
  id: string;
  requisitionNumber?: string;
  departmentId?: string;
  title?: string;
}

export interface CVisionPayrollRunRef {
  id: string;
  period: string;
  status: string;
}
