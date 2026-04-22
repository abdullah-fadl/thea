import {
  OPD_PAYMENT_METHODS,
  OPD_PAYMENT_SERVICE_TYPES,
  OPD_PAYMENT_STATUSES,
  OPDPaymentSnapshot,
} from '@/lib/models/OPDEncounter';

const STATUS_SET = new Set<string>(OPD_PAYMENT_STATUSES);
const SERVICE_TYPE_SET = new Set<string>(OPD_PAYMENT_SERVICE_TYPES);
const METHOD_SET = new Set<string>(OPD_PAYMENT_METHODS);

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeOpdPaymentSnapshot(input: any): { payment?: OPDPaymentSnapshot; error?: string } {
  if (input === null || input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Invalid payment payload' };
  }

  const status = String(input.status || '').trim().toUpperCase();
  const serviceType = String(input.serviceType || '').trim().toUpperCase();
  const method = input.method ? String(input.method || '').trim().toUpperCase() : '';
  const amount = input.amount;
  const paidAt = input.paidAt;
  const invoiceId = input.invoiceId ? String(input.invoiceId || '').trim() : '';
  const reference = input.reference ? String(input.reference || '').trim() : '';

  if (!status || !STATUS_SET.has(status)) {
    return { error: 'Invalid payment status' };
  }
  if (!serviceType || !SERVICE_TYPE_SET.has(serviceType)) {
    return { error: 'Invalid payment serviceType' };
  }
  if (method && !METHOD_SET.has(method)) {
    return { error: 'Invalid payment method' };
  }
  if (amount !== undefined && amount !== null && typeof amount !== 'number') {
    return { error: 'Invalid payment amount' };
  }

  const parsedPaidAt = paidAt ? parseDate(paidAt) : null;
  if (paidAt && !parsedPaidAt) {
    return { error: 'Invalid payment paidAt' };
  }

  const payment: OPDPaymentSnapshot = {
    status: status as OPDPaymentSnapshot['status'],
    serviceType: serviceType as OPDPaymentSnapshot['serviceType'],
  };
  if (method) payment.method = method as OPDPaymentSnapshot['method'];
  if (amount === null || typeof amount === 'number') payment.amount = amount;
  if (parsedPaidAt) payment.paidAt = parsedPaidAt;
  if (invoiceId) payment.invoiceId = invoiceId;
  if (reference) payment.reference = reference;

  return { payment };
}
