/**
 * ADT Outbound Sender
 *
 * Sends ADT notification messages to external systems (PACS, pharmacy, RIS)
 * when patient events occur within Thea EHR.
 *
 * Usage:
 *   await sendADTNotification(tenantId, 'A01', { patientId, patientName, ... });
 *
 * Messages are queued via the integration message system for reliable delivery.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';
import { buildADT, type ADTBuildOptions } from './builder';
import { logMessage } from '../messageQueue';

// ---------------------------------------------------------------------------
// Options for outbound ADT
// ---------------------------------------------------------------------------

export interface ADTNotificationOptions {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  sex: string;
  patientClass: 'I' | 'O' | 'E' | 'P';
  assignedLocation?: string;
  attendingDoctor?: string;
  admitDateTime?: Date;
  dischargeDateTime?: Date;
  visitNumber?: string;
}

export interface ADTSendResult {
  success: boolean;
  messagesSent: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Main sender
// ---------------------------------------------------------------------------

/**
 * Send an ADT notification to all configured outbound destinations for this tenant.
 * Messages are logged in the integration_messages table for tracking.
 */
export async function sendADTNotification(
  tenantId: string,
  eventType: 'A01' | 'A02' | 'A03' | 'A04' | 'A08',
  options: ADTNotificationOptions,
): Promise<ADTSendResult> {
  const result: ADTSendResult = {
    success: false,
    messagesSent: 0,
    errors: [],
  };

  try {
    // Get tenant's outbound instrument destinations
    const instruments = await prisma.instrument.findMany({
      where: {
        tenantId,
        status: 'ONLINE',
        protocol: 'HL7',
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
      },
    });

    if (instruments.length === 0) {
      result.success = true; // No destinations configured is not an error
      return result;
    }

    // Build the ADT message
    const adtOptions: ADTBuildOptions = {
      sendingApplication: 'Thea_EHR',
      sendingFacility: 'Thea',
      receivingApplication: '', // Will be set per instrument
      receivingFacility: '',
      eventType,
      patientId: options.patientId,
      patientName: options.patientName,
      dateOfBirth: options.dateOfBirth,
      sex: options.sex,
      patientClass: options.patientClass,
      assignedLocation: options.assignedLocation,
      attendingDoctor: options.attendingDoctor,
      admitDateTime: options.admitDateTime,
      dischargeDateTime: options.dischargeDateTime,
      visitNumber: options.visitNumber,
    };

    for (const instrument of instruments) {
      try {
        // Customize message for each recipient
        const msg = buildADT({
          ...adtOptions,
          receivingApplication: instrument.name,
          receivingFacility: instrument.name,
        });

        // Queue outbound message for delivery tracking
        await logMessage(tenantId, {
          direction: 'OUTBOUND',
          protocol: 'HL7',
          messageType: `ADT_${eventType}`,
          instrumentId: instrument.id,
          rawMessage: msg,
          parsedData: {
            eventType,
            patientId: options.patientId,
            patientName: options.patientName,
            destination: instrument.name,
          },
          status: 'RECEIVED', // Will be marked PROCESSED after successful send
        });

        result.messagesSent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to queue ADT for ${instrument.name}: ${errMsg}`);
        logger.warn('ADT outbound queue failed', {
          category: 'hl7',
          tenantId,
          instrumentId: instrument.id,
          error: errMsg,
        });
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`ADT outbound error: ${errMsg}`);
    logger.error('ADT outbound failed', { category: 'hl7', tenantId, error: errMsg });
  }

  return result;
}
