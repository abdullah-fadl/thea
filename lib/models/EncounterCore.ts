export type EncounterType = 'ER' | 'OPD' | 'IPD' | 'PROCEDURE';
export type EncounterStatus = 'CREATED' | 'ACTIVE' | 'CLOSED';

export interface EncounterCore {
  id: string;
  tenantId: string;
  patientId: string;
  encounterType: EncounterType;
  status: EncounterStatus;
  department: string;
  openedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: string;
  closedByUserId?: string;
  source?: {
    system: 'REGISTRATION' | 'ER' | 'IPD';
    sourceId?: string;
  };
}
