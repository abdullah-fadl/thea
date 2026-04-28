/**
 * Input Sanitization for XSS Prevention
 *
 * Provides functions to sanitize user input by stripping HTML tags,
 * removing script injection patterns, and encoding dangerous characters.
 * Used automatically by withAuthTenant for POST/PUT/PATCH request bodies.
 */

/** Fields that legitimately contain HTML and should skip sanitization */
const HTML_ALLOWED_FIELDS = new Set([
  'htmlContent',
  'emailBody',
  'template',
  'htmlTemplate',
  'emailTemplate',
  'bodyHtml',
  'contentHtml',
  'richText',
  'html',
]);

/**
 * Sanitize a single string value to prevent XSS.
 * - Encodes < and > as HTML entities
 * - Removes javascript: / vbscript: / data: URI schemes
 * - Strips on* event handler patterns (onerror, onload, etc.)
 * - Trims whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  let result = input.trim();

  // Encode HTML angle brackets
  result = result.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Remove javascript:, vbscript:, and data: URI schemes (case-insensitive, ignoring whitespace tricks)
  result = result.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');
  result = result.replace(/v\s*b\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');
  result = result.replace(/d\s*a\s*t\s*a\s*:\s*text\/html/gi, '');

  // Remove on* event handler patterns (e.g., onerror=, onload=, onclick=)
  result = result.replace(/\bon\w+\s*=/gi, '');

  // Remove expression() CSS pattern
  result = result.replace(/expression\s*\(/gi, '');

  return result;
}

/**
 * Recursively sanitize all string values in an object.
 * Leaves numbers, booleans, nulls, and undefined untouched.
 * Skips fields listed in HTML_ALLOWED_FIELDS.
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string') return sanitizeString(item);
      if (typeof item === 'object' && item !== null) return sanitizeObject(item);
      return item;
    });
  }

  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];

    // Skip HTML-allowed fields
    if (HTML_ALLOWED_FIELDS.has(key)) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      // numbers, booleans, null, undefined — pass through
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize a parsed JSON request body.
 * Handles objects, arrays, and primitive string bodies.
 * Returns the input unchanged for non-string, non-object types.
 */
export function sanitizeRequestBody(body: any): any {
  if (body === null || body === undefined) return body;
  if (typeof body === 'string') return sanitizeString(body);
  if (typeof body === 'object') return sanitizeObject(body);
  return body;
}
