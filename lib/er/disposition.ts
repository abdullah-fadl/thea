export type ErDecisionType = 'DISCHARGE' | 'ADMIT' | 'TRANSFER';
export type ErTransferType = 'INTERNAL' | 'EXTERNAL';

export interface ErDispositionBase {
  id: string;
  tenantId: string;
  encounterId: string;
  type: ErDecisionType;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface ErDispositionDischarge {
  type: 'DISCHARGE';
  finalDiagnosis?: string | null;
  dischargeInstructions?: string | null;
  dischargeMedications?: string | null; // placeholder
  followUpPlan?: string | null;
  sickLeaveRequested?: boolean | null; // placeholder
}

export interface ErDispositionAdmit {
  type: 'ADMIT';
  admitService?: string | null;
  admitWardUnit?: string | null;
  acceptingPhysician?: string | null;
  reasonForAdmission?: string | null;
  bedRequestCreatedAt?: Date | null;
  handoffSbar?: string | null;
}

export interface ErDispositionTransfer {
  type: 'TRANSFER';
  transferType?: ErTransferType | null;
  destinationFacilityUnit?: string | null;
  reason?: string | null;
  handoffSbar?: string | null;
}

export type ErDisposition =
  | (ErDispositionBase & ErDispositionDischarge)
  | (ErDispositionBase & ErDispositionAdmit)
  | (ErDispositionBase & ErDispositionTransfer);

export function validateDisposition(disposition: Partial<ErDisposition> | null | undefined): {
  isValid: boolean;
  missing: string[];
} {
  if (!disposition || !disposition.type) {
    return { isValid: false, missing: ['type'] };
  }

  const missing: string[] = [];
  const type = disposition.type;

  if (type === 'DISCHARGE') {
    const d = disposition as Partial<ErDispositionBase & ErDispositionDischarge>;
    if (!String(d.finalDiagnosis || '').trim()) missing.push('finalDiagnosis');
    if (!String(d.dischargeInstructions || '').trim()) missing.push('dischargeInstructions');
  }

  if (type === 'ADMIT') {
    const d = disposition as Partial<ErDispositionBase & ErDispositionAdmit>;
    if (!String(d.admitService || '').trim()) missing.push('admitService');
    if (!String(d.admitWardUnit || '').trim()) missing.push('admitWardUnit');
    if (!String(d.reasonForAdmission || '').trim()) missing.push('reasonForAdmission');
    if (!String(d.handoffSbar || '').trim()) missing.push('handoffSbar');
  }

  if (type === 'TRANSFER') {
    const d = disposition as Partial<ErDispositionBase & ErDispositionTransfer>;
    const transferType = d.transferType;
    if (!transferType) missing.push('transferType');
    if (!String(d.destinationFacilityUnit || '').trim()) missing.push('destinationFacilityUnit');
    if (!String(d.reason || '').trim()) missing.push('reason');
    if (!String(d.handoffSbar || '').trim()) missing.push('handoffSbar');
  }

  return { isValid: missing.length === 0, missing };
}

