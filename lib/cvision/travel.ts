/**
 * CVision Business Travel & Expenses Engine
 *
 * Handles:
 *  - Travel request submission & approval workflow
 *  - Expense claim submission & settlement
 *  - Per diem calculation by destination & grade
 *  - Advance payment tracking
 *  - Travel policy enforcement
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface TravelRequest {
  _id?: string;
  id: string;
  tenantId: string;
  requestNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  grade?: string;
  // Trip details
  tripType: 'DOMESTIC' | 'INTERNATIONAL';
  purpose: string;
  destination: string;
  destinationCity: string;
  destinationCountry: string;
  departureDate: string;
  returnDate: string;
  numberOfDays: number;
  // Flight & accommodation
  flightClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  hotelCategory: 'STANDARD' | 'BUSINESS' | 'LUXURY';
  needsVisa: boolean;
  // Financial
  estimatedFlightCost: number;
  estimatedHotelCost: number;
  estimatedPerDiem: number;
  estimatedTotal: number;
  advanceRequested: number;
  advanceApproved: number;
  advancePaid: boolean;
  currency: string;
  // Approval
  status: 'DRAFT' | 'PENDING' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'FINANCE_APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  approvals: TravelApproval[];
  rejectionReason?: string;
  // Meta
  notes?: string;
  attachments?: string[];
  requestedBy: string;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TravelApproval {
  step: 'MANAGER' | 'HR' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approverName?: string;
  approvedAt?: Date;
  comments?: string;
}

export interface ExpenseClaim {
  _id?: string;
  id: string;
  tenantId: string;
  claimNumber: string;
  travelRequestId?: string;
  travelRequestNumber?: string;
  employeeId: string;
  employeeName: string;
  department: string;
  // Expenses
  items: ExpenseItem[];
  totalAmount: number;
  advanceReceived: number;
  netPayable: number; // totalAmount - advanceReceived
  currency: string;
  // Approval
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  paidAt?: Date;
  // Meta
  submittedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  date: string;
  amount: number;
  currency: string;
  receipt?: string; // attachment ref
}

// ── Travel Policy (Grade-based entitlements) ────────────────────────────

export interface GradeEntitlement {
  flightClass: TravelRequest['flightClass'];
  hotelCategory: TravelRequest['hotelCategory'];
  domesticPerDiem: number; // SAR per day
  internationalPerDiem: number; // SAR per day
  maxAdvancePercent: number; // % of estimated total
}

export const GRADE_ENTITLEMENTS: Record<string, GradeEntitlement> = {
  'C-SUITE': {
    flightClass: 'FIRST',
    hotelCategory: 'LUXURY',
    domesticPerDiem: 1200,
    internationalPerDiem: 2500,
    maxAdvancePercent: 100,
  },
  'DIRECTOR': {
    flightClass: 'BUSINESS',
    hotelCategory: 'LUXURY',
    domesticPerDiem: 1000,
    internationalPerDiem: 2000,
    maxAdvancePercent: 90,
  },
  'MANAGER': {
    flightClass: 'BUSINESS',
    hotelCategory: 'BUSINESS',
    domesticPerDiem: 800,
    internationalPerDiem: 1500,
    maxAdvancePercent: 80,
  },
  'SENIOR': {
    flightClass: 'PREMIUM_ECONOMY',
    hotelCategory: 'BUSINESS',
    domesticPerDiem: 600,
    internationalPerDiem: 1200,
    maxAdvancePercent: 70,
  },
  'STAFF': {
    flightClass: 'ECONOMY',
    hotelCategory: 'STANDARD',
    domesticPerDiem: 400,
    internationalPerDiem: 800,
    maxAdvancePercent: 60,
  },
};

export const EXPENSE_CATEGORIES = [
  { value: 'FLIGHT', label: 'Flight Tickets' },
  { value: 'HOTEL', label: 'Hotel / Accommodation' },
  { value: 'TRANSPORT', label: 'Local Transport' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'VISA', label: 'Visa Fees' },
  { value: 'COMMUNICATION', label: 'Communication / Internet' },
  { value: 'CONFERENCE', label: 'Conference / Event Fees' },
  { value: 'MISC', label: 'Miscellaneous' },
] as const;

export const DESTINATION_REGIONS: Record<string, { label: string; perDiemMultiplier: number }> = {
  'GCC': { label: 'GCC Countries', perDiemMultiplier: 1.0 },
  'MIDDLE_EAST': { label: 'Middle East', perDiemMultiplier: 1.0 },
  'EUROPE': { label: 'Europe', perDiemMultiplier: 1.5 },
  'NORTH_AMERICA': { label: 'North America', perDiemMultiplier: 1.5 },
  'ASIA': { label: 'Asia', perDiemMultiplier: 1.2 },
  'AFRICA': { label: 'Africa', perDiemMultiplier: 1.0 },
  'DOMESTIC': { label: 'Domestic (Saudi Arabia)', perDiemMultiplier: 1.0 },
};

export const APPROVAL_FLOW: TravelApproval['step'][] = ['MANAGER', 'HR', 'FINANCE'];

export const TRIP_TYPES = [
  { value: 'DOMESTIC', label: 'Domestic' },
  { value: 'INTERNATIONAL', label: 'International' },
] as const;

export const FLIGHT_CLASSES = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'PREMIUM_ECONOMY', label: 'Premium Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First Class' },
] as const;

export const HOTEL_CATEGORIES = [
  { value: 'STANDARD', label: 'Standard (3-Star)' },
  { value: 'BUSINESS', label: 'Business (4-Star)' },
  { value: 'LUXURY', label: 'Luxury (5-Star)' },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────

export function calculatePerDiem(
  grade: string,
  tripType: 'DOMESTIC' | 'INTERNATIONAL',
  days: number,
  region?: string,
): number {
  const ent = GRADE_ENTITLEMENTS[grade] || GRADE_ENTITLEMENTS['STAFF'];
  const base = tripType === 'DOMESTIC' ? ent.domesticPerDiem : ent.internationalPerDiem;
  const multiplier = region ? (DESTINATION_REGIONS[region]?.perDiemMultiplier || 1) : 1;
  return Math.round(base * multiplier * days);
}

export function calculateDays(departure: string, returnDate: string): number {
  const d1 = new Date(departure);
  const d2 = new Date(returnDate);
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1); // inclusive
}

export function getMaxAdvance(grade: string, estimatedTotal: number): number {
  const ent = GRADE_ENTITLEMENTS[grade] || GRADE_ENTITLEMENTS['STAFF'];
  return Math.round(estimatedTotal * ent.maxAdvancePercent / 100);
}

export function getGradeEntitlement(grade: string): GradeEntitlement {
  return GRADE_ENTITLEMENTS[grade] || GRADE_ENTITLEMENTS['STAFF'];
}

// ── CRUD Operations ─────────────────────────────────────────────────────

export async function createTravelRequest(
  db: Db,
  tenantId: string,
  data: {
    employeeId: string;
    employeeName: string;
    department: string;
    grade?: string;
    tripType: 'DOMESTIC' | 'INTERNATIONAL';
    purpose: string;
    destination: string;
    destinationCity: string;
    destinationCountry: string;
    departureDate: string;
    returnDate: string;
    flightClass?: string;
    hotelCategory?: string;
    needsVisa?: boolean;
    estimatedFlightCost?: number;
    estimatedHotelCost?: number;
    advanceRequested?: number;
    notes?: string;
    requestedBy: string;
  },
): Promise<{ id: string; requestNumber: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_travel_requests').countDocuments({ tenantId });
  const requestNumber = `TR-${String(count + 1).padStart(4, '0')}`;

  const grade = data.grade || 'STAFF';
  const days = calculateDays(data.departureDate, data.returnDate);
  const perDiem = calculatePerDiem(grade, data.tripType, days);
  const flightCost = data.estimatedFlightCost || 0;
  const hotelCost = data.estimatedHotelCost || 0;
  const estimatedTotal = flightCost + hotelCost + perDiem;

  const ent = getGradeEntitlement(grade);
  const maxAdv = getMaxAdvance(grade, estimatedTotal);
  const advReq = Math.min(data.advanceRequested || 0, maxAdv);

  const approvals: TravelApproval[] = APPROVAL_FLOW.map((step) => ({
    step,
    status: 'PENDING' as const,
  }));

  const doc: Omit<TravelRequest, '_id'> = {
    id,
    tenantId,
    requestNumber,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    department: data.department,
    grade,
    tripType: data.tripType,
    purpose: data.purpose,
    destination: data.destination,
    destinationCity: data.destinationCity,
    destinationCountry: data.destinationCountry || 'Saudi Arabia',
    departureDate: data.departureDate,
    returnDate: data.returnDate,
    numberOfDays: days,
    flightClass: (data.flightClass as TravelRequest['flightClass']) || ent.flightClass,
    hotelCategory: (data.hotelCategory as TravelRequest['hotelCategory']) || ent.hotelCategory,
    needsVisa: data.needsVisa || false,
    estimatedFlightCost: flightCost,
    estimatedHotelCost: hotelCost,
    estimatedPerDiem: perDiem,
    estimatedTotal,
    advanceRequested: advReq,
    advanceApproved: 0,
    advancePaid: false,
    currency: 'SAR',
    status: 'PENDING',
    approvals,
    notes: data.notes || '',
    attachments: [],
    requestedBy: data.requestedBy,
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_travel_requests').insertOne(doc);

  // Notify manager
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'TRAVEL_REQUEST',
    title: 'New Travel Request',
    message: `${data.employeeName} submitted travel request ${requestNumber} to ${data.destination}`,
    targetRole: 'MANAGER',
    relatedId: requestNumber,
    isRead: false,
    createdAt: now,
  });

  return { id, requestNumber };
}

export async function approveTravelStep(
  db: Db,
  tenantId: string,
  requestId: string,
  step: TravelApproval['step'],
  approvedBy: string,
  approverName: string,
  comments?: string,
): Promise<{ success: boolean; error?: string; newStatus?: string }> {
  const req = await db.collection('cvision_travel_requests').findOne({
    tenantId,
    $or: [{ id: requestId }, { requestNumber: requestId }],
  });

  if (!req) return { success: false, error: 'Travel request not found' };

  const approvals = req.approvals as TravelApproval[];
  const stepIdx = approvals.findIndex((a) => a.step === step);
  if (stepIdx < 0) return { success: false, error: 'Approval step not found' };

  // Previous steps must be approved
  for (let i = 0; i < stepIdx; i++) {
    if (approvals[i].status !== 'APPROVED') {
      return { success: false, error: `Previous step ${approvals[i].step} not yet approved` };
    }
  }

  if (approvals[stepIdx].status !== 'PENDING') {
    return { success: false, error: `Step already ${approvals[stepIdx].status.toLowerCase()}` };
  }

  const now = new Date();
  approvals[stepIdx] = {
    ...approvals[stepIdx],
    status: 'APPROVED',
    approvedBy,
    approverName,
    approvedAt: now,
    comments: comments || '',
  };

  // Determine new overall status
  let newStatus = req.status;
  if (step === 'MANAGER') newStatus = 'MANAGER_APPROVED';
  if (step === 'HR') newStatus = 'HR_APPROVED';
  if (step === 'FINANCE') {
    newStatus = 'FINANCE_APPROVED';
    // Auto-approve advance
  }

  const update: any = {
    approvals,
    status: newStatus,
    updatedAt: now,
  };

  // If finance approved, approve advance
  if (step === 'FINANCE' && req.advanceRequested > 0) {
    update.advanceApproved = req.advanceRequested;
  }

  await db.collection('cvision_travel_requests').updateOne(
    { _id: req._id, tenantId },
    { $set: update },
  );

  // Notify employee
  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'TRAVEL_APPROVED',
    title: `Travel ${step} Approved`,
    message: `Your travel request ${req.requestNumber} has been approved by ${step}`,
    targetEmployeeId: req.employeeId,
    isRead: false,
    createdAt: now,
  });

  return { success: true, newStatus };
}

export async function rejectTravelRequest(
  db: Db,
  tenantId: string,
  requestId: string,
  rejectedBy: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  const req = await db.collection('cvision_travel_requests').findOne({
    tenantId,
    $or: [{ id: requestId }, { requestNumber: requestId }],
  });

  if (!req) return { success: false, error: 'Travel request not found' };
  if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(req.status)) {
    return { success: false, error: `Request is already ${req.status.toLowerCase()}` };
  }

  const now = new Date();
  await db.collection('cvision_travel_requests').updateOne(
    { _id: req._id, tenantId },
    {
      $set: {
        status: 'REJECTED',
        rejectionReason,
        updatedAt: now,
      },
    },
  );

  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'TRAVEL_REJECTED',
    title: 'Travel Request Rejected',
    message: `Your travel request ${req.requestNumber} was rejected: ${rejectionReason}`,
    targetEmployeeId: req.employeeId,
    isRead: false,
    createdAt: now,
  });

  return { success: true };
}

export async function cancelTravelRequest(
  db: Db,
  tenantId: string,
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const result = await db.collection('cvision_travel_requests').updateOne(
    {
      tenantId,
      $or: [{ id: requestId }, { requestNumber: requestId }],
      status: { $nin: ['CANCELLED', 'COMPLETED'] },
    },
    { $set: { status: 'CANCELLED', updatedAt: now } },
  );

  if (result.modifiedCount === 0) return { success: false, error: 'Cannot cancel request' };
  return { success: true };
}

export async function completeTravelRequest(
  db: Db,
  tenantId: string,
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const result = await db.collection('cvision_travel_requests').updateOne(
    {
      tenantId,
      $or: [{ id: requestId }, { requestNumber: requestId }],
      status: 'FINANCE_APPROVED',
    },
    { $set: { status: 'COMPLETED', updatedAt: now } },
  );

  if (result.modifiedCount === 0) return { success: false, error: 'Cannot mark as completed' };
  return { success: true };
}

export async function markAdvancePaid(
  db: Db,
  tenantId: string,
  requestId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_travel_requests').updateOne(
    {
      tenantId,
      $or: [{ id: requestId }, { requestNumber: requestId }],
    },
    { $set: { advancePaid: true, updatedAt: now } },
  );
  return { success: true };
}

// ── Expense Claims ──────────────────────────────────────────────────────

export async function createExpenseClaim(
  db: Db,
  tenantId: string,
  data: {
    travelRequestId?: string;
    travelRequestNumber?: string;
    employeeId: string;
    employeeName: string;
    department: string;
    items: ExpenseItem[];
    advanceReceived?: number;
    notes?: string;
  },
): Promise<{ id: string; claimNumber: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_expense_claims').countDocuments({ tenantId });
  const claimNumber = `EXP-${String(count + 1).padStart(4, '0')}`;

  const totalAmount = data.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const advanceReceived = data.advanceReceived || 0;
  const netPayable = totalAmount - advanceReceived;

  const doc: Omit<ExpenseClaim, '_id'> = {
    id,
    tenantId,
    claimNumber,
    travelRequestId: data.travelRequestId || undefined,
    travelRequestNumber: data.travelRequestNumber || undefined,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    department: data.department,
    items: data.items.map((item) => ({ ...item, id: item.id || uuidv4() })),
    totalAmount,
    advanceReceived,
    netPayable,
    currency: 'SAR',
    status: 'SUBMITTED',
    submittedAt: now,
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_expense_claims').insertOne(doc);

  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'EXPENSE_CLAIM',
    title: 'New Expense Claim',
    message: `${data.employeeName} submitted expense claim ${claimNumber} for ${totalAmount} SAR`,
    targetRole: 'FINANCE',
    relatedId: claimNumber,
    isRead: false,
    createdAt: now,
  });

  return { id, claimNumber };
}

export async function approveExpenseClaim(
  db: Db,
  tenantId: string,
  claimId: string,
  approvedBy: string,
): Promise<{ success: boolean; error?: string }> {
  const claim = await db.collection('cvision_expense_claims').findOne({
    tenantId,
    $or: [{ id: claimId }, { claimNumber: claimId }],
  });

  if (!claim) return { success: false, error: 'Claim not found' };
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status)) {
    return { success: false, error: `Claim is ${claim.status.toLowerCase()}` };
  }

  const now = new Date();
  await db.collection('cvision_expense_claims').updateOne(
    { _id: claim._id, tenantId },
    { $set: { status: 'APPROVED', approvedBy, approvedAt: now, updatedAt: now } },
  );

  await db.collection('cvision_notifications').insertOne({
    id: uuidv4(),
    tenantId,
    type: 'EXPENSE_APPROVED',
    title: 'Expense Claim Approved',
    message: `Your expense claim ${claim.claimNumber} has been approved`,
    targetEmployeeId: claim.employeeId,
    isRead: false,
    createdAt: now,
  });

  return { success: true };
}

export async function rejectExpenseClaim(
  db: Db,
  tenantId: string,
  claimId: string,
  rejectedBy: string,
  rejectionReason: string,
): Promise<{ success: boolean; error?: string }> {
  const claim = await db.collection('cvision_expense_claims').findOne({
    tenantId,
    $or: [{ id: claimId }, { claimNumber: claimId }],
  });

  if (!claim) return { success: false, error: 'Claim not found' };

  const now = new Date();
  await db.collection('cvision_expense_claims').updateOne(
    { _id: claim._id, tenantId },
    {
      $set: {
        status: 'REJECTED',
        rejectionReason,
        updatedAt: now,
      },
    },
  );

  return { success: true };
}

export async function markExpensePaid(
  db: Db,
  tenantId: string,
  claimId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_expense_claims').updateOne(
    {
      tenantId,
      $or: [{ id: claimId }, { claimNumber: claimId }],
      status: 'APPROVED',
    },
    { $set: { status: 'PAID', paidAt: now, updatedAt: now } },
  );
  return { success: true };
}

// ── List / Query ────────────────────────────────────────────────────────

export async function listTravelRequests(
  db: Db,
  tenantId: string,
  filters: {
    status?: string;
    employeeId?: string;
    tripType?: string;
    year?: number;
    limit?: number;
  } = {},
): Promise<TravelRequest[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.tripType) query.tripType = filters.tripType;
  if (filters.year) {
    const yearStr = String(filters.year);
    query.departureDate = { $regex: `^${yearStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  }

  return db
    .collection('cvision_travel_requests')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 200)
    .toArray() as unknown as Promise<TravelRequest[]>;
}

export async function listExpenseClaims(
  db: Db,
  tenantId: string,
  filters: {
    status?: string;
    employeeId?: string;
    limit?: number;
  } = {},
): Promise<ExpenseClaim[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.employeeId) query.employeeId = filters.employeeId;

  return db
    .collection('cvision_expense_claims')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 200)
    .toArray() as unknown as Promise<ExpenseClaim[]>;
}

export async function getTravelStats(
  db: Db,
  tenantId: string,
): Promise<{
  totalRequests: number;
  pendingApproval: number;
  approved: number;
  totalSpend: number;
  pendingClaims: number;
  unpaidAdvances: number;
}> {
  const requests = await db.collection('cvision_travel_requests')
    .find({ tenantId }).toArray();
  const claims = await db.collection('cvision_expense_claims')
    .find({ tenantId }).toArray();

  const totalRequests = requests.length;
  const pendingApproval = requests.filter((r: any) =>
    ['PENDING', 'MANAGER_APPROVED', 'HR_APPROVED'].includes(r.status)
  ).length;
  const approved = requests.filter((r: any) =>
    ['FINANCE_APPROVED', 'COMPLETED'].includes(r.status)
  ).length;
  const totalSpend = claims
    .filter((c: any) => ['APPROVED', 'PAID'].includes(c.status))
    .reduce((sum: number, c: any) => sum + (c.totalAmount || 0), 0);
  const pendingClaims = claims.filter((c: any) =>
    ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)
  ).length;
  const unpaidAdvances = requests.filter((r: any) =>
    r.advanceApproved > 0 && !r.advancePaid && r.status === 'FINANCE_APPROVED'
  ).length;

  return { totalRequests, pendingApproval, approved, totalSpend, pendingClaims, unpaidAdvances };
}
