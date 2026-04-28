/**
 * Centralized Query Keys Factory
 * 
 * All query keys should be defined here for consistency and easy cache invalidation.
 * Format: [entity, action, ...params]
 */

export const queryKeys = {
  // Structure (Patient Experience)
  floors: {
    all: ['floors'] as const,
    lists: () => [...queryKeys.floors.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.floors.lists(), filters] as const,
    details: () => [...queryKeys.floors.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.floors.details(), id] as const,
  },
  departments: {
    all: ['departments'] as const,
    lists: () => [...queryKeys.departments.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.departments.lists(), filters] as const,
    details: () => [...queryKeys.departments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.departments.details(), id] as const,
  },
  rooms: {
    all: ['rooms'] as const,
    lists: () => [...queryKeys.rooms.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.rooms.lists(), filters] as const,
    details: () => [...queryKeys.rooms.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.rooms.details(), id] as const,
  },
  
  // Patient Experience
  patientExperience: {
    all: ['patient-experience'] as const,
    visits: {
      all: () => [...queryKeys.patientExperience.all, 'visits'] as const,
      lists: () => [...queryKeys.patientExperience.visits.all(), 'list'] as const,
      list: (filters?: Record<string, any>) => [...queryKeys.patientExperience.visits.lists(), filters] as const,
      details: () => [...queryKeys.patientExperience.visits.all(), 'detail'] as const,
      detail: (id: string) => [...queryKeys.patientExperience.visits.details(), id] as const,
    },
    cases: {
      all: () => [...queryKeys.patientExperience.all, 'cases'] as const,
      lists: () => [...queryKeys.patientExperience.cases.all(), 'list'] as const,
      list: (filters?: Record<string, any>) => [...queryKeys.patientExperience.cases.lists(), filters] as const,
      details: () => [...queryKeys.patientExperience.cases.all(), 'detail'] as const,
      detail: (id: string) => [...queryKeys.patientExperience.cases.details(), id] as const,
    },
  },
  
  // OPD
  opd: {
    all: ['opd'] as const,
  },
  
  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    me: () => [...queryKeys.users.all, 'me'] as const,
  },
  
  // Equipment
  equipment: {
    all: ['equipment'] as const,
    lists: () => [...queryKeys.equipment.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.equipment.lists(), filters] as const,
    details: () => [...queryKeys.equipment.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.equipment.details(), id] as const,
  },
} as const;


