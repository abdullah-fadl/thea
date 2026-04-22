/**
 * Extended HL7 v2.x Segment Parsers
 *
 * Adds ORC (Order Common) and PV1 (Patient Visit) parsing
 * to complement the existing PID, OBR, OBX parsers.
 */

import type { HL7Segment } from '@/lib/integrations/hl7/parser';
import type { ORCSegment } from './types';

// Re-export existing parsers
export {
  parsePID,
  parseOBR,
  parseOBX,
} from '@/lib/integrations/hl7/parser';

// ---------------------------------------------------------------------------
// ORC — Order Common
// ---------------------------------------------------------------------------

export function parseORC(segment: HL7Segment): ORCSegment {
  const f = segment.fields;
  return {
    orderControl: (f[0] || 'NW') as ORCSegment['orderControl'],
    placerOrderNumber: f[1] || '',
    fillerOrderNumber: f[2] || '',
    placerGroupNumber: f[3] || '',
    orderStatus: f[4] || '',
    responseFlag: f[5] || '',
    quantityTiming: f[6] || '',
    parent: f[7] || '',
    dateTimeOfTransaction: f[8] || '',
    enteredBy: f[9] || '',
    verifiedBy: f[10] || '',
    orderingProvider: f[11] || '',
    entererLocation: f[12] || '',
    callBackPhoneNumber: f[13] || '',
    orderEffectiveDateTime: f[14] || '',
    orderControlCodeReason: f[15] || '',
    enteringOrganization: f[16] || '',
    enteringDevice: f[17] || '',
    actionBy: f[18] || '',
  };
}

// ---------------------------------------------------------------------------
// PV1 — Patient Visit
// ---------------------------------------------------------------------------

export interface PV1Segment {
  setId: string;
  patientClass: string;
  assignedPatientLocation: string;
  admissionType: string;
  preadmitNumber: string;
  priorPatientLocation: string;
  attendingDoctor: string;
  referringDoctor: string;
  consultingDoctor: string;
  hospitalService: string;
  temporaryLocation: string;
  preadmitTestIndicator: string;
  readmissionIndicator: string;
  admitSource: string;
  ambulatoryStatus: string;
  vipIndicator: string;
  admittingDoctor: string;
  patientType: string;
  visitNumber: string;
  financialClass: string;
  chargePriceIndicator: string;
  courtesyCode: string;
  creditRating: string;
  contractCode: string;
  contractEffectiveDate: string;
  contractAmount: string;
  contractPeriod: string;
  interestCode: string;
  transferToBadDebtCode: string;
  transferToBadDebtDate: string;
  badDebtAgencyCode: string;
  badDebtTransferAmount: string;
  badDebtRecoveryAmount: string;
  deleteAccountIndicator: string;
  deleteAccountDate: string;
  dischargeDisposition: string;
  dischargedToLocation: string;
  dietType: string;
  servicingFacility: string;
  bedStatus: string;
  accountStatus: string;
  pendingLocation: string;
  priorTemporaryLocation: string;
  admitDateTime: string;
  dischargeDateTime: string;
  currentPatientBalance: string;
  totalCharges: string;
}

export function parsePV1(segment: HL7Segment): PV1Segment {
  const f = segment.fields;
  return {
    setId: f[0] || '',
    patientClass: f[1] || '',
    assignedPatientLocation: f[2] || '',
    admissionType: f[3] || '',
    preadmitNumber: f[4] || '',
    priorPatientLocation: f[5] || '',
    attendingDoctor: f[6] || '',
    referringDoctor: f[7] || '',
    consultingDoctor: f[8] || '',
    hospitalService: f[9] || '',
    temporaryLocation: f[10] || '',
    preadmitTestIndicator: f[11] || '',
    readmissionIndicator: f[12] || '',
    admitSource: f[13] || '',
    ambulatoryStatus: f[14] || '',
    vipIndicator: f[15] || '',
    admittingDoctor: f[16] || '',
    patientType: f[17] || '',
    visitNumber: f[18] || '',
    financialClass: f[19] || '',
    chargePriceIndicator: f[20] || '',
    courtesyCode: f[21] || '',
    creditRating: f[22] || '',
    contractCode: f[23] || '',
    contractEffectiveDate: f[24] || '',
    contractAmount: f[25] || '',
    contractPeriod: f[26] || '',
    interestCode: f[27] || '',
    transferToBadDebtCode: f[28] || '',
    transferToBadDebtDate: f[29] || '',
    badDebtAgencyCode: f[30] || '',
    badDebtTransferAmount: f[31] || '',
    badDebtRecoveryAmount: f[32] || '',
    deleteAccountIndicator: f[33] || '',
    deleteAccountDate: f[34] || '',
    dischargeDisposition: f[35] || '',
    dischargedToLocation: f[36] || '',
    dietType: f[37] || '',
    servicingFacility: f[38] || '',
    bedStatus: f[39] || '',
    accountStatus: f[40] || '',
    pendingLocation: f[41] || '',
    priorTemporaryLocation: f[42] || '',
    admitDateTime: f[43] || '',
    dischargeDateTime: f[44] || '',
    currentPatientBalance: f[45] || '',
    totalCharges: f[46] || '',
  };
}
