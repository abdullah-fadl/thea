/**
 * CVision Employee Status Engine Tests
 *
 * Tests for employee status transitions and validation logic.
 * Updated to match actual constants (uppercase status keys in transitions,
 * lowercase status values array, and correct request/candidate statuses).
 */

import { describe, it, expect } from 'vitest';
import {
  EMPLOYEE_STATUS_TRANSITIONS,
  EMPLOYEE_STATUSES,
  REQUEST_STATUS_TRANSITIONS,
  REQUEST_STATUSES,
  CANDIDATE_STAGE_TRANSITIONS,
  CANDIDATE_STAGES,
} from '@/lib/cvision/constants';

describe('CVision Employee Status Engine', () => {
  describe('Status Transitions', () => {
    // EMPLOYEE_STATUS_TRANSITIONS uses UPPERCASE keys (from status-engine.ts)
    it('should define transitions for common uppercase statuses', () => {
      const expectedKeys = ['ACTIVE', 'PROBATION', 'RESIGNED', 'TERMINATED'];
      for (const status of expectedKeys) {
        expect(EMPLOYEE_STATUS_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(EMPLOYEE_STATUS_TRANSITIONS[status])).toBe(true);
      }
    });

    it('should allow PROBATION to transition to ACTIVE', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['PROBATION'];
      expect(transitions).toContain('ACTIVE');
    });

    it('should allow PROBATION to transition to TERMINATED', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['PROBATION'];
      expect(transitions).toContain('TERMINATED');
    });

    it('should allow ACTIVE to transition to ON_ANNUAL_LEAVE', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'];
      expect(transitions).toContain('ON_ANNUAL_LEAVE');
    });

    it('should allow ACTIVE to transition to SUSPENDED', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'];
      expect(transitions).toContain('SUSPENDED');
    });

    it('should allow ACTIVE to transition to TERMINATED', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'];
      expect(transitions).toContain('TERMINATED');
    });

    it('should allow ACTIVE to transition to NOTICE_PERIOD', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['ACTIVE'];
      expect(transitions).toContain('NOTICE_PERIOD');
    });

    it('should allow ON_ANNUAL_LEAVE to transition back to ACTIVE', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['ON_ANNUAL_LEAVE'];
      expect(transitions).toContain('ACTIVE');
    });

    it('should allow SUSPENDED to transition back to ACTIVE', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['SUSPENDED'];
      expect(transitions).toContain('ACTIVE');
    });

    it('should not allow TERMINATED to transition to any status', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['TERMINATED'];
      expect(transitions).toHaveLength(0);
    });

    it('should not allow RESIGNED to transition to any status', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['RESIGNED'];
      expect(transitions).toHaveLength(0);
    });

    it('should not allow RETIRED to transition to any status', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['RETIRED'];
      expect(transitions).toHaveLength(0);
    });

    it('should allow PROBATION to transition to ON_SICK_LEAVE', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['PROBATION'];
      expect(transitions).toContain('ON_SICK_LEAVE');
    });

    it('should allow NOTICE_PERIOD to transition to RESIGNED', () => {
      const transitions = EMPLOYEE_STATUS_TRANSITIONS['NOTICE_PERIOD'];
      expect(transitions).toContain('RESIGNED');
    });
  });

  describe('Status Validation', () => {
    function isValidTransition(fromStatus: string, toStatus: string): boolean {
      const allowed = EMPLOYEE_STATUS_TRANSITIONS[fromStatus] || [];
      return allowed.includes(toStatus);
    }

    it('should validate correct transition from PROBATION to ACTIVE', () => {
      expect(isValidTransition('PROBATION', 'ACTIVE')).toBe(true);
    });

    it('should reject any transition from terminal states', () => {
      const terminalStates = ['TERMINATED', 'RESIGNED', 'RETIRED', 'DECEASED', 'END_OF_CONTRACT'];
      for (const terminal of terminalStates) {
        const transitions = EMPLOYEE_STATUS_TRANSITIONS[terminal] || [];
        expect(transitions).toHaveLength(0);
      }
    });

    it('should not allow self-transition (not listed in transition targets)', () => {
      // Transitions don't include the same status as a valid target
      for (const [status, targets] of Object.entries(EMPLOYEE_STATUS_TRANSITIONS)) {
        expect(targets).not.toContain(status);
      }
    });
  });

  describe('Terminal States', () => {
    it('should identify terminal states correctly', () => {
      const terminalStates = Object.entries(EMPLOYEE_STATUS_TRANSITIONS)
        .filter(([, targets]) => targets.length === 0)
        .map(([status]) => status);

      expect(terminalStates).toContain('TERMINATED');
      expect(terminalStates).toContain('RESIGNED');
      expect(terminalStates).toContain('RETIRED');
      expect(terminalStates).toContain('END_OF_CONTRACT');
      expect(terminalStates).toContain('DECEASED');
    });

    it('should have non-empty transitions for non-terminal states', () => {
      const nonTerminalStates = ['PROBATION', 'ACTIVE', 'ON_ANNUAL_LEAVE', 'SUSPENDED'];
      for (const status of nonTerminalStates) {
        expect(EMPLOYEE_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
      }
    });
  });

  describe('EMPLOYEE_STATUSES array', () => {
    it('should be an array of lowercase status strings', () => {
      expect(Array.isArray(EMPLOYEE_STATUSES)).toBe(true);
      expect(EMPLOYEE_STATUSES).toContain('active');
      expect(EMPLOYEE_STATUSES).toContain('probation');
      expect(EMPLOYEE_STATUSES).toContain('terminated');
      expect(EMPLOYEE_STATUSES).toContain('resigned');
      expect(EMPLOYEE_STATUSES).toContain('retired');
      expect(EMPLOYEE_STATUSES).toContain('deceased');
    });
  });
});

describe('CVision Request Status Transitions', () => {
  describe('Request Workflow', () => {
    it('should define transitions for all request statuses', () => {
      for (const status of REQUEST_STATUSES) {
        expect(REQUEST_STATUS_TRANSITIONS).toHaveProperty(status);
      }
    });

    it('should allow open to go to in_review', () => {
      expect(REQUEST_STATUS_TRANSITIONS['open']).toContain('in_review');
    });

    it('should allow open to be closed', () => {
      expect(REQUEST_STATUS_TRANSITIONS['open']).toContain('closed');
    });

    it('should allow in_review to be approved', () => {
      expect(REQUEST_STATUS_TRANSITIONS['in_review']).toContain('approved');
    });

    it('should allow in_review to be rejected', () => {
      expect(REQUEST_STATUS_TRANSITIONS['in_review']).toContain('rejected');
    });

    it('should allow in_review to be escalated', () => {
      expect(REQUEST_STATUS_TRANSITIONS['in_review']).toContain('escalated');
    });

    it('should allow escalated to go back to in_review', () => {
      expect(REQUEST_STATUS_TRANSITIONS['escalated']).toContain('in_review');
    });

    it('should allow escalated to be approved', () => {
      expect(REQUEST_STATUS_TRANSITIONS['escalated']).toContain('approved');
    });

    it('should not allow transitions from closed', () => {
      expect(REQUEST_STATUS_TRANSITIONS['closed']).toHaveLength(0);
    });

    it('should allow rejected to be closed', () => {
      expect(REQUEST_STATUS_TRANSITIONS['rejected']).toContain('closed');
    });

    it('should allow approved to be closed', () => {
      expect(REQUEST_STATUS_TRANSITIONS['approved']).toContain('closed');
    });
  });
});

describe('CVision Candidate Stage Transitions', () => {
  describe('Recruitment Pipeline', () => {
    it('should define transitions for common candidate stages', () => {
      const stages = ['applied', 'screening', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];
      for (const stage of stages) {
        expect(CANDIDATE_STAGE_TRANSITIONS).toHaveProperty(stage);
      }
    });

    it('should allow applied to move to screening', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['applied']).toContain('screening');
    });

    it('should allow screening to move to shortlisted', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['screening']).toContain('shortlisted');
    });

    it('should allow shortlisted to move to interview', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['shortlisted']).toContain('interview');
    });

    it('should allow interview to move to offer', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['interview']).toContain('offer');
    });

    it('should allow offer to move to hired', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['offer']).toContain('hired');
    });

    it('should allow rejection at stages before hire', () => {
      const stagesWithRejection = ['applied', 'screening', 'shortlisted', 'interview', 'offer'];
      for (const stage of stagesWithRejection) {
        expect(CANDIDATE_STAGE_TRANSITIONS[stage]).toContain('rejected');
      }
    });

    it('should not allow transitions from hired', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['hired']).toHaveLength(0);
    });

    it('should not allow transitions from rejected', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['rejected']).toHaveLength(0);
    });

    it('should allow interview to go back to shortlisted (for additional interviews)', () => {
      expect(CANDIDATE_STAGE_TRANSITIONS['interview']).toContain('shortlisted');
    });
  });
});
