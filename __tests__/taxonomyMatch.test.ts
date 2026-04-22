import { findBestMatch, normalizeLabel } from '@/lib/sam/taxonomyMatch';

describe('taxonomyMatch', () => {
  describe('normalizeLabel', () => {
    it('removes common suffix/prefix tokens and punctuation', () => {
      expect(normalizeLabel('Admissions Staff')).toBe('admissions');
      expect(normalizeLabel('ICU Team')).toBe('icu');
      expect(normalizeLabel('Pre-Admission Unit')).toBe('pre admission');
      expect(normalizeLabel('Risk: Privacy & Security')).toBe('privacy security');
    });
  });

  describe('findBestMatch', () => {
    it('matches Admissions Staff -> Admissions', () => {
      const match = findBestMatch('Admissions Staff', [
        { id: 'dept-1', name: 'Admissions' },
      ]);
      expect(match?.matchId).toBe('dept-1');
    });

    it('matches ICU Team -> ICU', () => {
      const match = findBestMatch('ICU Team', [
        { id: 'dept-icu', name: 'ICU' },
      ]);
      expect(match?.matchId).toBe('dept-icu');
    });

    it('matches Pre-Admission Unit -> Pre-Admission', () => {
      const match = findBestMatch('Pre-Admission Unit', [
        { id: 'op-pre', name: 'Pre-Admission' },
      ]);
      expect(match?.matchId).toBe('op-pre');
    });

    it('matches Risk: Privacy & Security -> Privacy Security', () => {
      const match = findBestMatch('Risk: Privacy & Security', [
        { id: 'risk-privacy', name: 'Privacy Security' },
      ]);
      expect(match?.matchId).toBe('risk-privacy');
    });
  });
});
