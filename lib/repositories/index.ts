// =============================================================================
// Repository Layer — Barrel Exports
// =============================================================================

// Base
export { BaseRepository } from './base.repository';
export type { TransactionClient } from './base.repository';

// Core (Tenant, User, Session)
export { TenantRepository, UserRepository, SessionRepository } from './core';

// Patient
export { PatientRepository } from './patient';

// Encounter
export { EncounterCoreRepository } from './encounter';

// OPD
export { OpdEncounterRepository, OpdBookingRepository } from './opd';

// ER
export { ErEncounterRepository, ErBedRepository } from './er';
