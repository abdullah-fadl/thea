import { z } from 'zod';

// ─── Create Function ─────────────────────────────────────
export const createFunctionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  code: z.string().optional(),
});

// ─── Update Function ─────────────────────────────────────
export const updateFunctionSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  code: z.string().optional(),
});

// ─── Create Operation ────────────────────────────────────
export const createOperationSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  code: z.string().optional(),
});

// ─── Update Operation ────────────────────────────────────
export const updateOperationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  code: z.string().optional(),
});

// ─── Create Risk Domain ──────────────────────────────────
export const createRiskDomainSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
});

// ─── Update Risk Domain ──────────────────────────────────
export const updateRiskDomainSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

// ─── Create Scope ────────────────────────────────────────
export const createScopeSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().min(1, 'code is required'),
});

// ─── Update Scope ────────────────────────────────────────
export const updateScopeSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
});

// ─── Create Sector ───────────────────────────────────────
export const createSectorSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().optional(),
});

// ─── Update Sector ───────────────────────────────────────
export const updateSectorSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
});

// ─── Create Entity Type ──────────────────────────────────
export const createEntityTypeSchema = z.object({
  name: z.string().min(1, 'name is required'),
  code: z.string().min(1, 'code is required'),
});

// ─── Update Entity Type ──────────────────────────────────
export const updateEntityTypeSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
});
