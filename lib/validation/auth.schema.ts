import { z } from 'zod';

// ─── Login ────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().optional(),
});

// ─── Identify ─────────────────────────────────────────────
export const identifySchema = z.object({
  email: z.string().email('Invalid email'),
});

// ─── Change Password ──────────────────────────────────────
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Save Session State ───────────────────────────────────
export const saveSessionStateSchema = z.object({
  lastRoute: z.string().optional(),
  lastPlatformKey: z.string().optional(),
});

// ─── Switch Tenant ────────────────────────────────────────
export const switchTenantSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
});

// ─── 2FA Verify ───────────────────────────────────────────
export const twoFactorVerifySchema = z.object({
  token: z.string().length(6, 'Token must be 6 characters'),
});

// ─── 2FA Disable ──────────────────────────────────────────
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().min(1, 'Token is required'),
});

// ─── 2FA Login ────────────────────────────────────────────
export const twoFactorLoginSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  token: z.string().min(1, '2FA token is required'),
});

// ─── Forgot Password ─────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

// ─── Reset Password ──────────────────────────────────────
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

// ─── Password Strength ───────────────────────────────────
export const passwordStrengthSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  email: z.string().optional(),
  name: z.string().optional(),
});
