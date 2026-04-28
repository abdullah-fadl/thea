/**
 * DICOM Source CRUD operations.
 * Stores/retrieves source configs from the `dicom_sources` table via Prisma.
 */

import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/prisma';
import type { DicomSource, DicomSourceType, DicomAuthType, DicomSourceCredentials } from './types';

// ---------------------------------------------------------------------------
// Prisma row <-> DicomSource mapping helpers
// ---------------------------------------------------------------------------

/**
 * The Prisma DicomSource model stores URL fields as wadoUrl/qidoUrl/stowUrl
 * and lacks type/authType/credentials columns. We map the application-level
 * DicomSource interface onto the DB columns as follows:
 *   - baseUrl  -> wadoUrl  (primary canonical URL)
 *   - type     -> aeTitle  (overloaded: stores source type string when no AE title)
 *   - authType / credentials -> not persisted (source-level auth handled at proxy layer)
 */

function rowToSource(row: any): DicomSource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    type: (row.aeTitle as DicomSourceType) || 'custom',
    baseUrl: row.wadoUrl || '',
    authType: 'none' as DicomAuthType,
    credentials: undefined,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listSources(tenantId: string): Promise<DicomSource[]> {
  const rows = await prisma.dicomSource.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(rowToSource);
}

export async function getSource(tenantId: string, sourceId: string): Promise<DicomSource | null> {
  const row = await prisma.dicomSource.findFirst({
    where: { tenantId, id: sourceId },
  });
  return row ? rowToSource(row) : null;
}

export async function getDefaultSource(tenantId: string): Promise<DicomSource | null> {
  const row = await prisma.dicomSource.findFirst({
    where: { tenantId, isDefault: true },
  });
  return row ? rowToSource(row) : null;
}

export interface CreateSourceInput {
  name: string;
  type: DicomSourceType;
  baseUrl: string;
  authType: DicomAuthType;
  credentials?: DicomSourceCredentials;
  isDefault?: boolean;
}

export async function createSource(
  tenantId: string,
  input: CreateSourceInput,
): Promise<DicomSource> {
  // If setting as default, unset existing default
  if (input.isDefault) {
    await prisma.dicomSource.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const baseUrl = input.baseUrl.replace(/\/+$/, ''); // strip trailing slashes

  const row = await prisma.dicomSource.create({
    data: {
      id: `dsrc_${nanoid(12)}`,
      tenantId,
      name: input.name,
      wadoUrl: baseUrl,
      qidoUrl: baseUrl,
      stowUrl: baseUrl,
      aeTitle: input.type, // store source type in aeTitle column
      isDefault: input.isDefault ?? false,
    },
  });

  return rowToSource(row);
}

export interface UpdateSourceInput {
  name?: string;
  type?: DicomSourceType;
  baseUrl?: string;
  authType?: DicomAuthType;
  credentials?: DicomSourceCredentials;
  isDefault?: boolean;
}

export async function updateSource(
  tenantId: string,
  sourceId: string,
  input: UpdateSourceInput,
): Promise<boolean> {
  if (input.isDefault) {
    await prisma.dicomSource.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.type !== undefined) data.aeTitle = input.type;
  if (input.baseUrl !== undefined) {
    const url = input.baseUrl.replace(/\/+$/, '');
    data.wadoUrl = url;
    data.qidoUrl = url;
    data.stowUrl = url;
  }
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  const result = await prisma.dicomSource.updateMany({
    where: { tenantId, id: sourceId },
    data,
  });

  return result.count > 0;
}

export async function deleteSource(tenantId: string, sourceId: string): Promise<boolean> {
  const result = await prisma.dicomSource.deleteMany({
    where: { tenantId, id: sourceId },
  });
  return result.count > 0;
}
