/**
 * Input Validation & Sanitization
 * Centralized validation utilities using Zod
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sanitize string input (basic XSS prevention)
 * Removes potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Basic HTML tag removal (for stored XSS prevention)
  // Note: For rich text, use a proper HTML sanitizer library
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  return sanitized.trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj } as Record<string, unknown>;
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeString(sanitized[key]);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }
  
  return sanitized as T;
}

/**
 * Validate request body with Zod schema
 * Returns parsed data or error response
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  // Explicit return type for better type narrowing
  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    
    // Sanitize string fields
    const sanitized = sanitizeObject(parsed as Record<string, unknown>) as T;
    
    return { success: true, data: sanitized };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation error',
            details: error.issues.map(e => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const parsed = schema.parse(params);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation error',
            details: error.issues.map(e => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Safe error handler - never leaks stack traces in production
 */
export function handleError(error: unknown): {
  message: string;
  details?: any;
} {
  const isDev = process.env.NODE_ENV === 'development';

  if (error instanceof Error) {
    return {
      message: error.message || 'Internal server error',
      details: isDev ? { stack: error.stack } : undefined,
    };
  }

  return {
    message: 'Internal server error',
    details: isDev ? { error } : undefined,
  };
}

/**
 * Sanitize MongoDB query input to prevent NoSQL injection
 * Removes $ operators from user input
 */
export function sanitizeMongoInput(input: any): any {
  if (typeof input === 'string') return input;
  if (typeof input !== 'object' || input === null) return input;
  if (Array.isArray(input)) return input.map(sanitizeMongoInput);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    // Block MongoDB operators from user input
    if (key.startsWith('$')) continue;
    sanitized[key] = sanitizeMongoInput(value);
  }
  return sanitized;
}

