/**
 * PDPL Retention Policy Tests
 *
 * Tests for lib/privacy/retention-policy.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  RETENTION_POLICY,
  getRetentionPolicy,
  isRetentionExpired,
  type RetentionCategory,
} from '@/lib/privacy/retention-policy';

describe('Retention Policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RETENTION_POLICY', () => {
    it('should define all expected categories', () => {
      const categories: RetentionCategory[] = [
        'medical_records',
        'billing_records',
        'audit_logs',
        'consent_records',
        'session_data',
        'temporary_files',
      ];
      for (const cat of categories) {
        expect(RETENTION_POLICY[cat]).toBeDefined();
      }
    });

    it('should set medical_records retention to 3650 days (10 years)', () => {
      expect(RETENTION_POLICY.medical_records.days).toBe(3650);
      expect(RETENTION_POLICY.medical_records.label).toBe('10 years');
    });

    it('should set audit_logs retention to 2555 days (7 years)', () => {
      expect(RETENTION_POLICY.audit_logs.days).toBe(2555);
      expect(RETENTION_POLICY.audit_logs.label).toBe('7 years');
    });

    it('should set consent_records retention to 3650 days (10 years)', () => {
      expect(RETENTION_POLICY.consent_records.days).toBe(3650);
      expect(RETENTION_POLICY.consent_records.regulation).toBe('PDPL');
    });

    it('should set session_data retention to 90 days', () => {
      expect(RETENTION_POLICY.session_data.days).toBe(90);
    });

    it('should set temporary_files retention to 30 days', () => {
      expect(RETENTION_POLICY.temporary_files.days).toBe(30);
    });

    it('should have Arabic labels for all categories', () => {
      for (const key of Object.keys(RETENTION_POLICY) as RetentionCategory[]) {
        expect(RETENTION_POLICY[key].labelAr).toBeDefined();
        expect(RETENTION_POLICY[key].labelAr.length).toBeGreaterThan(0);
      }
    });

    it('should have a regulation for every category', () => {
      for (const key of Object.keys(RETENTION_POLICY) as RetentionCategory[]) {
        expect(typeof RETENTION_POLICY[key].regulation).toBe('string');
        expect(RETENTION_POLICY[key].regulation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getRetentionPolicy', () => {
    it('should return the correct policy for a known category', () => {
      const policy = getRetentionPolicy('medical_records');
      expect(policy).not.toBeNull();
      expect(policy?.days).toBe(3650);
      expect(policy?.label).toBe('10 years');
    });

    it('should return null for an unknown category', () => {
      const policy = getRetentionPolicy('nonexistent_category');
      expect(policy).toBeNull();
    });

    it('should return the correct policy for billing_records', () => {
      const policy = getRetentionPolicy('billing_records');
      expect(policy).not.toBeNull();
      expect(policy?.days).toBe(2555);
      expect(policy?.regulation).toBe('Tax Law');
    });
  });

  describe('isRetentionExpired', () => {
    it('should return true for data older than retention period', () => {
      // session_data = 90 days; create a date 100 days ago
      const createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      expect(isRetentionExpired('session_data', createdAt)).toBe(true);
    });

    it('should return false for data within retention period', () => {
      // session_data = 90 days; create a date 10 days ago
      const createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(isRetentionExpired('session_data', createdAt)).toBe(false);
    });

    it('should return false for unknown category', () => {
      const createdAt = new Date('2000-01-01');
      expect(isRetentionExpired('nonexistent_category', createdAt)).toBe(false);
    });

    it('should return true for temporary_files older than 30 days', () => {
      const createdAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      expect(isRetentionExpired('temporary_files', createdAt)).toBe(true);
    });

    it('should return false for medical_records created recently', () => {
      const createdAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      expect(isRetentionExpired('medical_records', createdAt)).toBe(false);
    });
  });
});
