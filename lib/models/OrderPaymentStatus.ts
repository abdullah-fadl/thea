export const ORDER_PAYMENT_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'INSURANCE_PENDING',
  'INSURANCE_APPROVED',
  'INSURANCE_REJECTED',
  'EXEMPTED',
  'CANCELLED',
] as const;

export type OrderPaymentStatus = typeof ORDER_PAYMENT_STATUSES[number];

export interface OrderPaymentInfo {
  status: OrderPaymentStatus;
  invoiceId?: string;
  amount?: number;
  paidAmount?: number;
  insuranceAmount?: number;
  patientShare?: number;
  paidAt?: string;
  paidBy?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'ONLINE' | 'INSURANCE';
  paymentReference?: string;
  insuranceApprovalNumber?: string;
  exemptionReason?: string;
  exemptedBy?: string;
}

export interface OrderWithPayment {
  id: string;
  type: 'LAB' | 'RADIOLOGY' | 'PROCEDURE' | 'MEDICATION';
  code: string;
  name: string;
  nameAr?: string;
  patientId: string;
  patientName?: string;
  patientMrn?: string;
  encounterId?: string;
  visitId?: string;
  orderedBy: string;
  orderedByName?: string;
  orderedAt: string;
  status: string;
  payment: OrderPaymentInfo;
  price: number;
  quantity: number;
  totalPrice: number;
  priority?: 'ROUTINE' | 'URGENT' | 'STAT';
  notes?: string;
}

export function canExecuteOrder(payment: OrderPaymentInfo): boolean {
  return ['PAID', 'INSURANCE_APPROVED', 'EXEMPTED'].includes(payment.status);
}

export function needsPayment(payment: OrderPaymentInfo): boolean {
  return ['PENDING_PAYMENT', 'INSURANCE_REJECTED'].includes(payment.status);
}
