import { z } from 'zod';
import { genderEnum, patientIdentifiersSchema } from './shared.schema';

// ─── Create Patient Master ───────────────────────────────
const emergencyContactSchema = z.union([
  z.string(),
  z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    relation: z.string().optional(),
  }),
]);

export const createPatientSchema = z.object({
  identifiers: patientIdentifiersSchema.optional(),
  firstName: z.string().min(1, 'firstName is required'),
  lastName: z.string().min(1, 'lastName is required'),
  dob: z.string().optional(),
  gender: genderEnum.optional(),
  knownAllergies: z.union([z.array(z.string()), z.string()]).optional(),
  nationality: z.string().optional(),
  city: z.string().optional(),
  mobile: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  bloodType: z.string().optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

// ─── Update Patient Demographics ─────────────────────────
export const updatePatientSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  dob: z.string().optional(),
  gender: genderEnum.optional(),
  reason: z.string().optional(),
  identifiers: patientIdentifiersSchema.optional(),
  nationalId: z.string().optional(),
  iqama: z.string().optional(),
  passport: z.string().optional(),
});

// ─── Full Demographics Update ────────────────────────────
export const fullDemographicsSchema = z.object({
  firstName: z.string().optional().nullable(),
  middleName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  dob: z.union([z.string(), z.date()]).optional().nullable(),
  nationalId: z.string().optional().nullable(),
  gender: genderEnum.optional().nullable(),
  reason: z.string().optional().nullable(),
});

// ─── Create Problem ──────────────────────────────────────
export const createProblemSchema = z.object({
  code: z.string().optional(),
  description: z.string().min(1, 'description is required'),
  status: z.string().optional(),
  severity: z.string().optional(),
  onsetDate: z.string().optional(),
  resolvedDate: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Update Problem ──────────────────────────────────────
export const updateProblemSchema = z.object({
  code: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  onsetDate: z.string().optional(),
  resolvedDate: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Create Allergy ──────────────────────────────────────
export const createAllergySchema = z.object({
  allergen: z.string().optional(),
  substance: z.string().optional(),
  reaction: z.string().optional(),
  type: z.string().optional(),
  severity: z.string().optional(),
});

// ─── Merge Patients ──────────────────────────────────────
export const mergePatientSchema = z.object({
  sourcePatientId: z.string().min(1, 'sourcePatientId is required'),
  targetPatientId: z.string().min(1, 'targetPatientId is required'),
  reason: z.string().optional(),
  acknowledgePendingOrders: z.boolean().optional(),
  acknowledgePendingBilling: z.boolean().optional(),
});

// ─── Link ER Unknown ─────────────────────────────────────
export const linkErUnknownSchema = z.object({
  erEncounterId: z.string().min(1, 'erEncounterId is required'),
  tempMrn: z.string().optional(),
  reason: z.string().optional(),
  identifiers: patientIdentifiersSchema.optional(),
  gender: genderEnum.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dob: z.string().optional(),
});
