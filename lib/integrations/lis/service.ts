import { prisma } from '@/lib/db/prisma';
import { LabResult } from '@/lib/integrations/hl7/oruProcessor';
import { nanoid } from 'nanoid';
import { checkCriticalValue } from '@/lib/lab/criticalValues';
import { logger } from '@/lib/monitoring/logger';

export interface LISConfig {
  autoMatchPatients: boolean;
  autoUpdateOrders: boolean;
  notifyCriticalValues: boolean;
  criticalValueWebhook?: string;
}

export interface ProcessedResult {
  id: string;
  labResultId: string;
  orderId?: string;
  patientId?: string;
  matched: boolean;
  isCritical: boolean;
  criticalAlert?: Record<string, unknown>;
}

interface PrismaDelegate {
  findFirst: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const db = prisma as unknown as Record<string, PrismaDelegate>;

export async function processIncomingResults(
  _db: unknown, // ignored — kept for backward compat
  tenantId: string,
  results: LabResult[],
  config: LISConfig
): Promise<ProcessedResult[]> {
  const processed: ProcessedResult[] = [];

  for (const result of results) {
    const processedResult: ProcessedResult = {
      id: `prc_${nanoid(12)}`,
      labResultId: '',
      matched: false,
      isCritical: false,
    };

    let patientId: string | null = null;
    if (config.autoMatchPatients) {
      // PatientMaster has no mrn/fileNumber fields directly.
      // First try nationalId on PatientMaster, then fall back to PatientIdentityLink.
      let patient = await prisma.patientMaster.findFirst({
        where: {
          tenantId,
          nationalId: result.patientId,
        },
      });
      if (!patient) {
        // Try identity links (mrn, sourcePatientId)
        const link = await prisma.patientIdentityLink.findFirst({
          where: {
            tenantId,
            OR: [
              { mrn: result.patientId },
              { sourcePatientId: result.patientId },
            ],
          },
          select: { patientId: true },
        });
        if (link) {
          patient = await prisma.patientMaster.findFirst({
            where: { id: link.patientId },
          });
        }
      }

      if (patient) {
        patientId = patient.id;
        processedResult.patientId = patientId;
        processedResult.matched = true;
      }
    }

    let orderId: string | null = null;
    if (config.autoUpdateOrders && result.orderId) {
      try {
        const order = await db.labOrder.findFirst({
          where: {
            tenantId,
            OR: [
              { id: result.orderId },
              { externalOrderId: result.orderId },
              { accessionNumber: result.orderId },
            ],
          },
        });
        if (order) {
          orderId = order.id as string;
          processedResult.orderId = orderId;
        }
      } catch (error) {
        logger.error('Failed to look up LabOrder', { category: 'clinical', orderId: result.orderId, error });
      }
    }

    const criticalCheck = checkCriticalValue(result.testCode, result.valueNumeric);
    if (criticalCheck.isCritical) {
      processedResult.isCritical = true;
      processedResult.criticalAlert = criticalCheck;
    }

    const labResultDoc = {
      id: `lrs_${nanoid(12)}`,
      tenantId,
      patientId,
      orderId,
      testCode: result.testCode,
      testName: result.testName,
      value: result.value,
      valueNumeric: result.valueNumeric,
      unit: result.unit,
      referenceRange: result.referenceRange,
      abnormalFlag: result.abnormalFlag,
      status: result.status,
      resultDateTime: result.resultDateTime,
      performingLab: result.performingLab,
      externalPatientId: result.patientId,
      externalOrderId: result.orderId,
      isCritical: processedResult.isCritical,
      criticalNotified: false,
      matchedAutomatically: processedResult.matched,
      createdAt: new Date(),
      source: 'HL7',
    };

    await prisma.labResult.create({ data: labResultDoc as Parameters<typeof prisma.labResult.create>[0]['data'] });
    processedResult.labResultId = labResultDoc.id;

    if (orderId) {
      try {
        await db.labOrder.update({
          where: { id: orderId },
          data: { status: 'RESULTED', resultedAt: new Date() },
        });
      } catch (error) {
        logger.error('Failed to update LabOrder status', { category: 'clinical', orderId, error });
      }
    }

    if (processedResult.isCritical && config.notifyCriticalValues) {
      try {
        await db.labCriticalAlert.create({
          data: {
            id: `crt_${nanoid(12)}`,
            tenantId,
            type: 'LAB_CRITICAL',
            patientId,
            orderId,
            labResultId: labResultDoc.id,
            testCode: result.testCode,
            testName: result.testName,
            value: result.value,
            unit: result.unit,
            criticalType: criticalCheck.type,
            threshold: criticalCheck.threshold,
            status: 'PENDING',
            createdAt: new Date(),
            notifiedAt: null,
            acknowledgedAt: null,
            acknowledgedBy: null,
          },
        });
      } catch (error) {
        logger.error('Failed to create LabCriticalAlert', { category: 'clinical', testCode: result.testCode, error });
      }

      if (config.criticalValueWebhook) {
        try {
          await fetch(config.criticalValueWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'CRITICAL_VALUE',
              patientId,
              testCode: result.testCode,
              value: result.value,
              unit: result.unit,
            }),
          });
        } catch (error) {
          logger.error('Failed to send critical value webhook', { category: 'system', error });
        }
      }
    }

    processed.push(processedResult);
  }

  return processed;
}

export async function getUnmatchedResults(_db: unknown, tenantId: string, limit: number = 50) {
  // LabResult has no matchedAutomatically column — unmatched means patientId is null
  return prisma.labResult.findMany({
    where: {
      tenantId,
      patientId: null,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function manualMatchResult(
  _db: unknown,
  tenantId: string,
  labResultId: string,
  patientId: string,
  userId: string
) {
  const result = await prisma.labResult.update({
    where: { id: labResultId },
    data: {
      patientId,
      matchedManually: true,
      matchedBy: userId,
      matchedAt: new Date(),
    } as Parameters<typeof prisma.labResult.update>[0]['data'],
  });

  return result;
}
