import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Profile Schemas Bootstrap
 * 
 * Ensures every tenant has active schemas for all 4 profile sections.
 * Called automatically when profile data is accessed.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from './db';
import type { CVisionProfileSectionSchema, ProfileSectionKey, ProfileFieldDefinition } from './types';

// Re-export for backwards compatibility
export type { ProfileFieldDefinition } from './types';

export type ProfileFieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'json' | 'phone' | 'select';

export interface ProfileSchemaJson {
  fields: ProfileFieldDefinition[];
}

// Legacy field keys that have been replaced - these should be removed from existing schemas
const DEPRECATED_FIELD_KEYS = new Set([
  'baseSalary',      // replaced by basicSalary
  'bankIban',        // replaced by iban
  'allowancesJson',  // replaced by housingAllowance + transportAllowance
]);

const DEFAULT_SCHEMAS: Record<ProfileSectionKey, ProfileFieldDefinition[]> = {
  PERSONAL: [
    { key: 'fullName', label: 'Full Name', type: 'text', required: true },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'] },
    { key: 'nationality', label: 'Nationality', type: 'text' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'nationalId', label: 'National ID', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'address', label: 'Address', type: 'textarea' },
  ],
  EMPLOYMENT: [
    { key: 'departmentId', label: 'Department', type: 'select', required: true, source: 'departments' },
    { key: 'unitId', label: 'Unit', type: 'select', required: false, dependsOn: 'departmentId' },
    { key: 'positionId', label: 'Position', type: 'select', required: false, source: 'departmentPositions', dependsOn: 'departmentId' },
    { key: 'jobTitleId', label: 'Job Title', type: 'select', required: true },
    { key: 'managerEmployeeId', label: 'Manager', type: 'select' },
    { key: 'hiredAt', label: 'Hire Date', type: 'date' },
  ],
  FINANCIAL: [
    { key: 'basicSalary', label: 'Basic Salary', type: 'number' },
    { key: 'housingAllowance', label: 'Housing Allowance', type: 'number' },
    { key: 'transportAllowance', label: 'Transport Allowance', type: 'number' },
    { key: 'bankName', label: 'Bank Name', type: 'text' },
    { key: 'bankAccountNumber', label: 'Bank Account Number', type: 'text' },
    { key: 'iban', label: 'IBAN', type: 'text' },
  ],
  CONTRACT: [
    { key: 'contractType', label: 'Contract Type', type: 'select' },
    { key: 'startDate', label: 'Start Date', type: 'date' },
    { key: 'endDate', label: 'End Date', type: 'date' },
    { key: 'probationEndDate', label: 'Probation End Date', type: 'date' },
  ],
};

/**
 * Ensure all profile schemas exist for a tenant
 * Creates default schemas if missing, and updates existing schemas with missing fields
 * (idempotent - safe to call multiple times)
 */
export async function ensureProfileSchemas(
  tenantId: string,
  userId: string = 'system'
): Promise<void> {
  const schemaCollection = await getCVisionCollection<CVisionProfileSectionSchema>(
    tenantId,
    'profileSectionSchemas'
  );

  const sectionKeys: ProfileSectionKey[] = ['PERSONAL', 'EMPLOYMENT', 'FINANCIAL', 'CONTRACT'];
  const now = new Date();

  for (const sectionKey of sectionKeys) {
    // Check if active schema exists
    const existingActive = await schemaCollection.findOne(
      createTenantFilter(tenantId, {
        sectionKey,
        isActive: true,
      })
    );

    if (!existingActive) {
      // Create default schema version 1
      const schema: CVisionProfileSectionSchema = {
        id: uuidv4(),
        tenantId,
        sectionKey,
        version: 1,
        schemaJson: {
          fields: DEFAULT_SCHEMAS[sectionKey],
        } as ProfileSchemaJson,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        createdByUserId: userId,
      };

      await schemaCollection.insertOne(schema);

      if (process.env.NODE_ENV === 'development') {
        logger.info(`[CVision Profile Schemas] Created default schema for ${sectionKey} (tenant: ${tenantId})`);
      }
    } else {
      // Schema exists - sync with default schema (add missing, remove duplicates, reorder)
      const existingFields = existingActive.schemaJson?.fields || [];
      const defaultFields = DEFAULT_SCHEMAS[sectionKey];
      const defaultFieldKeys = new Set(defaultFields.map(f => f.key));

      // Build updated fields list: use default schema order, keep existing values for known fields
      const updatedFields: ProfileFieldDefinition[] = [];
      const seenKeys = new Set<string>();

      // First, add all default fields in order (with any custom properties from existing)
      for (const defaultField of defaultFields) {
        const existingField = existingFields.find((f: ProfileFieldDefinition) => f.key === defaultField.key);
        // Use default field definition (ensures correct type, source, etc.)
        updatedFields.push({ ...defaultField });
        seenKeys.add(defaultField.key);
      }

      // Then, add any custom fields that aren't in the default schema (preserve tenant customizations)
      // Skip deprecated fields that have been replaced
      for (const existingField of existingFields) {
        if (!seenKeys.has(existingField.key) && !DEPRECATED_FIELD_KEYS.has(existingField.key)) {
          updatedFields.push(existingField);
          seenKeys.add(existingField.key);
        }
      }

      // Check if schema needs updating (fields changed, duplicates, or wrong order)
      const existingFieldKeys = existingFields.map((f: ProfileFieldDefinition) => f.key);
      const updatedFieldKeys = updatedFields.map(f => f.key);
      const hasDuplicates = existingFieldKeys.length !== new Set(existingFieldKeys).size;
      const needsUpdate = hasDuplicates ||
        existingFieldKeys.join(',') !== updatedFieldKeys.join(',') ||
        existingFields.length !== updatedFields.length;

      if (needsUpdate) {
        // Update the schema with corrected fields
        await schemaCollection.updateOne(
          createTenantFilter(tenantId, { id: existingActive.id }),
          {
            $set: {
              'schemaJson.fields': updatedFields,
              updatedAt: now,
              updatedBy: userId,
            },
          }
        );

        if (process.env.NODE_ENV === 'development') {
          logger.info(`[CVision Profile Schemas] Updated ${sectionKey} schema (tenant: ${tenantId}):`, {
            before: existingFields.map((f: ProfileFieldDefinition) => f.key),
            after: updatedFields.map(f => f.key),
          });
        }
      }
    }
  }
}
