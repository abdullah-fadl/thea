import { z } from 'zod';

// ─── Portal Register ─────────────────────────────────────
export const portalRegisterSchema = z.object({
  firstName: z.string().min(1, 'firstName is required'),
  lastName: z.string().min(1, 'lastName is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  dateOfBirth: z.string().optional(),
});

// ─── Portal OTP Request ──────────────────────────────────
export const portalRequestOtpSchema = z.object({
  email: z.string().email('Invalid email'),
});

// ─── Portal OTP Verify ───────────────────────────────────
export const portalVerifyOtpSchema = z.object({
  email: z.string().email('Invalid email'),
  otpCode: z.string().min(1, 'otpCode is required'),
});

// ─── Portal Message ──────────────────────────────────────
export const portalMessageSchema = z.object({
  recipientId: z.string().optional(),
  messageContent: z.string().min(1, 'messageContent is required'),
});

// ─── Portal Profile ──────────────────────────────────────
export const portalProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
}).passthrough();

// ─── Portal Booking Create ───────────────────────────────
export const portalBookingCreateSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  patientData: z.record(z.string(), z.unknown()).optional(),
});

// ─── Portal Booking Cancel ───────────────────────────────
export const portalBookingCancelSchema = z.object({
  cancellationReason: z.string().min(1, 'cancellationReason is required'),
});
