/**
 * Password Policy — NIST 800-63B aligned
 *
 * Rules:
 * - Minimum 12 characters
 * - Not in common breached passwords list
 * - Not the same as email/username
 * - No maximum length restriction (NIST recommendation)
 * - No forced special character requirements (NIST recommendation)
 */

// Top common passwords (abbreviated set — extend as needed)
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '12345678', '123456789', '1234567890',
  'qwerty123', 'abc12345', 'letmein', 'welcome1', 'monkey123',
  'dragon123', 'master123', 'login123', 'princess1', 'football1',
  'shadow123', 'sunshine1', 'trustno1', 'iloveyou1', 'batman123',
  'access14', 'mustang1', 'michael1', 'charlie1', 'jessica1',
  'password1', 'password12', 'qwerty12', 'admin123', 'admin1234',
  'changeme', 'changeme1', 'changeme123', 'welcome123', 'hello123',
  'letmein123', 'abc123456', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  'qwerty1234', 'test1234', 'test12345', 'default1', 'guest123',
  '12345678910', 'abcdefgh', 'abcdefghi', 'password!', 'baseball1',
  'iloveyou', 'trustno12', 'superman1', 'master1234', 'dragon1234',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: { code: string; messageAr: string; messageEn: string }[];
}

export function validatePassword(
  password: string,
  context?: { email?: string; name?: string }
): PasswordValidationResult {
  const errors: PasswordValidationResult['errors'] = [];

  // Rule 1: Minimum length (NIST: 8 min, we use 12 for medical systems)
  if (password.length < 12) {
    errors.push({
      code: 'TOO_SHORT',
      messageAr: 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل',
      messageEn: 'Password must be at least 12 characters',
    });
  }

  // Rule 2: Maximum length (NIST: at least 64)
  if (password.length > 128) {
    errors.push({
      code: 'TOO_LONG',
      messageAr: 'كلمة المرور يجب ألا تتجاوز 128 حرفاً',
      messageEn: 'Password must not exceed 128 characters',
    });
  }

  // Rule 3: Not a common password
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push({
      code: 'COMMON_PASSWORD',
      messageAr: 'كلمة المرور شائعة جداً — اختر كلمة مرور أقوى',
      messageEn: 'This password is too common — choose a stronger password',
    });
  }

  // Rule 4: Not same as email or name
  // Only check if the email prefix is meaningful (5+ chars) to avoid false positives
  // with short prefixes like "thea" or "ali" appearing in random passwords
  const emailPrefix = context?.email?.split('@')[0]?.toLowerCase();
  if (emailPrefix && emailPrefix.length >= 5 && password.toLowerCase().includes(emailPrefix)) {
    errors.push({
      code: 'CONTAINS_EMAIL',
      messageAr: 'كلمة المرور يجب ألا تحتوي على بريدك الإلكتروني',
      messageEn: 'Password must not contain your email',
    });
  }

  if (context?.name && context.name.length > 2 && password.toLowerCase().includes(context.name.toLowerCase())) {
    errors.push({
      code: 'CONTAINS_NAME',
      messageAr: 'كلمة المرور يجب ألا تحتوي على اسمك',
      messageEn: 'Password must not contain your name',
    });
  }

  // Rule 5: Not all same character
  if (/^(.)\1+$/.test(password)) {
    errors.push({
      code: 'ALL_SAME',
      messageAr: 'كلمة المرور يجب ألا تكون حرفاً واحداً مكرراً',
      messageEn: 'Password must not be a single repeated character',
    });
  }

  // Rule 6: Not sequential (123456, abcdef)
  if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password) && /^\d+$|^[a-z]+$/i.test(password)) {
    errors.push({
      code: 'SEQUENTIAL',
      messageAr: 'كلمة المرور يجب ألا تكون تسلسلية',
      messageEn: 'Password must not be sequential',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Password History ─────────────────────────────────────────
const PASSWORD_HISTORY_COUNT = 5;

export interface PasswordHistoryEntry {
  hash: string;
  changedAt: string;
}

/**
 * Check if a new password matches any in the history
 */
export async function checkPasswordHistory(
  newPassword: string,
  history: PasswordHistoryEntry[] | null | undefined,
  comparePasswordFn: (plain: string, hash: string) => Promise<boolean>,
): Promise<{ reused: boolean; error?: { code: string; messageAr: string; messageEn: string } }> {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return { reused: false };
  }
  for (const entry of history.slice(0, PASSWORD_HISTORY_COUNT)) {
    const match = await comparePasswordFn(newPassword, entry.hash);
    if (match) {
      return {
        reused: true,
        error: {
          code: 'PASSWORD_REUSED',
          messageAr: `لا يمكن إعادة استخدام آخر ${PASSWORD_HISTORY_COUNT} كلمات مرور`,
          messageEn: `Cannot reuse your last ${PASSWORD_HISTORY_COUNT} passwords`,
        },
      };
    }
  }
  return { reused: false };
}

/**
 * Build updated password history array (keeps last N)
 */
export function buildPasswordHistory(
  currentHash: string,
  existing: PasswordHistoryEntry[] | null | undefined,
): PasswordHistoryEntry[] {
  const history = Array.isArray(existing) ? [...existing] : [];
  history.unshift({ hash: currentHash, changedAt: new Date().toISOString() });
  return history.slice(0, PASSWORD_HISTORY_COUNT);
}

// ─── Password Expiry ─────────────────────────────────────────
const PASSWORD_MAX_AGE_DAYS = 90; // HIPAA recommendation

/**
 * Check if password is expired (older than 90 days)
 */
export function isPasswordExpired(passwordChangedAt: Date | string | null | undefined): boolean {
  if (!passwordChangedAt) return false; // No change date = don't force expiry (new accounts handle via forcePasswordChange)
  const changedAt = typeof passwordChangedAt === 'string' ? new Date(passwordChangedAt) : passwordChangedAt;
  const now = new Date();
  const diffMs = now.getTime() - changedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > PASSWORD_MAX_AGE_DAYS;
}

/**
 * Estimate password strength (for UI meter)
 * Returns: 0 (very weak) to 4 (very strong)
 */
export function estimateStrength(password: string): number {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 0;
  return Math.min(4, score);
}
