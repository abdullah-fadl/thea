/**
 * Password Policy Tests
 *
 * Tests the NIST 800-63B aligned password policy enforcement including
 * complexity, history, and expiration checks.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  estimateStrength,
  checkPasswordHistory,
  buildPasswordHistory,
  isPasswordExpired,
  PasswordHistoryEntry,
} from '@/lib/security/passwordPolicy';

describe('Password Policy', () => {
  describe('validatePassword', () => {
    it('should reject passwords shorter than 12 characters', () => {
      const result = validatePassword('short123');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'TOO_SHORT')).toBe(true);
    });

    it('should accept passwords 12+ characters', () => {
      const result = validatePassword('securePassword123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords over 128 characters', () => {
      const result = validatePassword('a'.repeat(129));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'TOO_LONG')).toBe(true);
    });

    it('should reject common passwords', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'COMMON_PASSWORD')).toBe(true);
    });

    it('should reject password containing email prefix (5+ chars)', () => {
      const result = validatePassword('yousef_is_great_password', { email: 'yousef@hospital.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CONTAINS_EMAIL')).toBe(true);
    });

    it('should NOT reject password containing short email prefix (<5 chars)', () => {
      const result = validatePassword('aliSecurePass12', { email: 'ali@hospital.com' });
      expect(result.valid).toBe(true);
    });

    it('should reject password containing user name', () => {
      const result = validatePassword('mohammedSecure12', { name: 'Mohammed' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CONTAINS_NAME')).toBe(true);
    });

    it('should reject all-same-character passwords', () => {
      const result = validatePassword('aaaaaaaaaaaa');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ALL_SAME')).toBe(true);
    });

    it('should reject sequential passwords', () => {
      const result = validatePassword('123456789012');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SEQUENTIAL')).toBe(true);
    });

    it('should return bilingual error messages', () => {
      const result = validatePassword('short');
      expect(result.errors[0]?.messageAr).toBeTruthy();
      expect(result.errors[0]?.messageEn).toBeTruthy();
    });
  });

  describe('estimateStrength', () => {
    it('should return 0 for common passwords', () => {
      expect(estimateStrength('password123')).toBe(0);
    });

    it('should return higher score for longer mixed passwords', () => {
      expect(estimateStrength('MyStr0ng!Pass#123')).toBeGreaterThanOrEqual(3);
    });

    it('should increase score for mixed case', () => {
      const lower = estimateStrength('alllowercase12');
      const mixed = estimateStrength('MixedCaseHere12');
      expect(mixed).toBeGreaterThan(lower);
    });
  });

  describe('checkPasswordHistory', () => {
    it('should return not reused for empty history', async () => {
      const result = await checkPasswordHistory(
        'newPassword123',
        null,
        async () => false,
      );
      expect(result.reused).toBe(false);
    });

    it('should detect reused password', async () => {
      const mockCompare = async (plain: string, hash: string) => plain === 'oldPassword' && hash === 'hash1';
      const history: PasswordHistoryEntry[] = [
        { hash: 'hash1', changedAt: new Date().toISOString() },
      ];
      const result = await checkPasswordHistory('oldPassword', history, mockCompare);
      expect(result.reused).toBe(true);
      expect(result.error?.code).toBe('PASSWORD_REUSED');
    });

    it('should allow non-matching password', async () => {
      const mockCompare = async () => false;
      const history: PasswordHistoryEntry[] = [
        { hash: 'hash1', changedAt: new Date().toISOString() },
        { hash: 'hash2', changedAt: new Date().toISOString() },
      ];
      const result = await checkPasswordHistory('brandNewPass', history, mockCompare);
      expect(result.reused).toBe(false);
    });
  });

  describe('buildPasswordHistory', () => {
    it('should add current hash to history', () => {
      const result = buildPasswordHistory('currentHash', null);
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('currentHash');
    });

    it('should keep max 5 entries', () => {
      const existing: PasswordHistoryEntry[] = Array.from({ length: 6 }, (_, i) => ({
        hash: `hash${i}`,
        changedAt: new Date().toISOString(),
      }));
      const result = buildPasswordHistory('newHash', existing);
      expect(result).toHaveLength(5);
      expect(result[0].hash).toBe('newHash');
    });

    it('should prepend new entry', () => {
      const existing: PasswordHistoryEntry[] = [
        { hash: 'old1', changedAt: new Date().toISOString() },
      ];
      const result = buildPasswordHistory('current', existing);
      expect(result[0].hash).toBe('current');
      expect(result[1].hash).toBe('old1');
    });
  });

  describe('isPasswordExpired', () => {
    it('should return false for null date', () => {
      expect(isPasswordExpired(null)).toBe(false);
    });

    it('should return false for recent password change', () => {
      expect(isPasswordExpired(new Date())).toBe(false);
    });

    it('should return true for password older than 90 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      expect(isPasswordExpired(oldDate)).toBe(true);
    });

    it('should handle string dates', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      expect(isPasswordExpired(oldDate.toISOString())).toBe(true);
    });
  });
});
