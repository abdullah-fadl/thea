/**
 * API-based data creation helpers for E2E test setup.
 * Uses page.request (inherits auth cookies) for faster test data creation.
 */

import { Page } from '@playwright/test';
import { BASE_URL } from './constants';

interface PatientData {
  firstName: string;
  lastName: string;
  firstNameAr?: string;
  lastNameAr?: string;
  dob: string;
  gender: string;
  nationalId?: string;
  mobile?: string;
  nationality?: string;
  city?: string;
}

interface CreatedPatient {
  id: string;
  mrn: string;
}

interface CreatedEncounter {
  encounterCoreId: string;
  bookingId?: string;
}

interface CreatedOrder {
  orderId: string;
}

/**
 * Create a patient via API.
 * Returns { id, mrn }.
 */
export async function createPatientViaAPI(
  page: Page,
  data: PatientData,
): Promise<CreatedPatient> {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const response = await page.request.post(`${BASE_URL}/api/patients`, {
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      firstNameAr: data.firstNameAr || data.firstName,
      lastNameAr: data.lastNameAr || data.lastName,
      dateOfBirth: data.dob,
      gender: data.gender,
      nationalId: data.nationalId ? `${data.nationalId}${uniqueSuffix}` : undefined,
      mobileNumber: data.mobile,
      nationality: data.nationality || 'SA',
      city: data.city,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create patient: ${response.status()} - ${text}`);
  }

  const body = await response.json();
  return {
    id: body.id || body.patientId || body.data?.id,
    mrn: body.mrn || body.data?.mrn || '',
  };
}

/**
 * Create an OPD walk-in encounter via API.
 * Returns { encounterCoreId, bookingId }.
 */
export async function createEncounterViaAPI(
  page: Page,
  patientId: string,
): Promise<CreatedEncounter> {
  const response = await page.request.post(
    `${BASE_URL}/api/opd/booking/walk-in`,
    {
      data: {
        patientId,
        visitType: 'CONSULTATION',
        chiefComplaint: 'E2E test encounter',
      },
    },
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(
      `Failed to create encounter: ${response.status()} - ${text}`,
    );
  }

  const body = await response.json();
  return {
    encounterCoreId:
      body.encounterCoreId || body.data?.encounterCoreId || '',
    bookingId: body.bookingId || body.data?.bookingId,
  };
}

/**
 * Create an order via API.
 * @param kind - 'LAB' | 'RADIOLOGY' | 'PROCEDURE' | 'MEDICATION'
 * Returns { orderId }.
 */
export async function createOrderViaAPI(
  page: Page,
  encounterCoreId: string,
  kind: string,
  orderName: string,
): Promise<CreatedOrder> {
  const response = await page.request.post(`${BASE_URL}/api/orders`, {
    data: {
      encounterCoreId,
      kind,
      orderName,
      orderNameAr: orderName,
      priority: 'ROUTINE',
      idempotencyKey: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create order: ${response.status()} - ${text}`);
  }

  const body = await response.json();
  return {
    orderId: body.orderId || body.id || body.data?.orderId || '',
  };
}
