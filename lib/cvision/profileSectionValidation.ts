/**
 * CVision Profile Section Validation Schemas
 * 
 * Zod schemas for validating profile section data when updating employee profiles.
 * These schemas enforce data structure and format requirements.
 */

import { z } from "zod";
import { CONTRACT_TYPE_VALUES } from "./constants";

// UUID validation that allows null/undefined/empty string
export const objectIdLike = z.string().uuid("Invalid id format");
export const optionalUuid = z.union([
  z.string().uuid(),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform(val => val === '' ? null : val);

export const employeeEmploymentSchema = z.object({
  departmentId: optionalUuid.optional().nullable(), // Optional - must be UUID if provided
  positionId: optionalUuid.optional().nullable(),
  unitId: optionalUuid.optional().nullable(), // UUID reference to unit
  jobTitleId: optionalUuid.optional().nullable(), // UUID reference to job title
  gradeId: optionalUuid.optional().nullable(), // UUID reference to grade
  managerEmployeeId: optionalUuid.optional().nullable(), // UUID reference to manager employee
  hiredAt: z.string().min(1).optional().nullable(), // ISO date string
});

export const employeeFinancialSchema = z.object({
  baseSalary: z.number().nonnegative().optional().nullable(),
  bankIban: z.string().optional().nullable(), // Note: field name in DB is bankIban
  allowancesJson: z.union([
    z.array(z.object({
      code: z.string().min(1),
      amount: z.number().nonnegative(),
    })),
    z.string(), // Allow JSON string format
  ]).optional().nullable(),
});

export const employeeContractSchema = z.object({
  contractType: z.string().refine(
    (val) => {
      // Allow empty string, null, undefined, or valid enum values
      if (!val || val === '' || val === null || val === undefined) {
        return true;
      }
      return (CONTRACT_TYPE_VALUES as readonly string[]).includes(val);
    },
    {
      message: `Contract type must be one of: ${CONTRACT_TYPE_VALUES.join(', ')}. Valid values are: PERMANENT, FIXED_TERM, LOCUM, PART_TIME, INTERN`,
    }
  ).optional().nullable(), // Allow optional/nullable for backward compatibility
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
}).refine(
  (data) => {
    // If both probationEndDate and endDate are provided, probationEndDate should be before endDate
    if (data.probationEndDate && data.endDate) {
      const probationDate = new Date(data.probationEndDate);
      const endDate = new Date(data.endDate);
      return probationDate <= endDate;
    }
    return true;
  },
  {
    message: 'Probation end date must be before or equal to contract end date',
    path: ['probationEndDate'],
  }
).refine(
  (data) => {
    // If both startDate and endDate are provided, startDate should be before endDate
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      return startDate <= endDate;
    }
    return true;
  },
  {
    message: 'Contract start date must be before or equal to contract end date',
    path: ['startDate'],
  }
);

/**
 * Get validation schema for a profile section
 */
export function getProfileSectionSchema(sectionKey: string): z.ZodSchema<any> | null {
  switch (sectionKey) {
    case 'EMPLOYMENT':
      return employeeEmploymentSchema;
    case 'FINANCIAL':
      return employeeFinancialSchema;
    case 'CONTRACT':
      return employeeContractSchema;
    case 'PERSONAL':
      // Personal section is more flexible, no strict schema
      return null;
    default:
      return null;
  }
}
