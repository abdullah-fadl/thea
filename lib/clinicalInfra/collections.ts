export const CLINICAL_INFRA_COLLECTIONS = {
  facilities: 'clinical_infra_facilities',
  units: 'clinical_infra_units',
  floors: 'clinical_infra_floors',
  rooms: 'clinical_infra_rooms',
  beds: 'clinical_infra_beds',
  specialties: 'clinical_infra_specialties',
  clinics: 'clinical_infra_clinics',
  providers: 'clinical_infra_providers',
  providerProfiles: 'clinical_infra_provider_profiles',
  providerPrivileges: 'clinical_infra_provider_privileges',
  providerRoomAssignments: 'clinical_infra_provider_room_assignments',
  providerUnitScopes: 'clinical_infra_provider_unit_scopes',
  providerAssignments: 'clinical_infra_provider_assignments',
  idempotency: 'clinical_infra_idempotency',
} as const;

export type ClinicalInfraCollectionName =
  (typeof CLINICAL_INFRA_COLLECTIONS)[keyof typeof CLINICAL_INFRA_COLLECTIONS];

