import crypto from 'crypto';
import type { IntegrityEvidence } from '@/lib/models/Integrity';

export const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

export const buildDedupeKey = ({
  type,
  severity,
  documentIds,
  summary,
  evidence,
}: {
  type: string;
  severity: string;
  documentIds: string[];
  summary: string;
  evidence: IntegrityEvidence[];
}) => {
  const docKey = documentIds.slice().sort().join('|');
  const evidenceQuotes = evidence
    .map((entry) => normalizeText(entry.quote || ''))
    .filter(Boolean)
    .slice(0, 3)
    .join('|');
  const base = [type, severity, docKey, normalizeText(summary), evidenceQuotes]
    .filter(Boolean)
    .join('::');
  return crypto.createHash('sha256').update(base).digest('hex');
};

export const summarizeFindings = (findings: Array<{ status: string }>) => {
  const summary = {
    findingsTotal: findings.length,
    openCount: 0,
    inReviewCount: 0,
    resolvedCount: 0,
    ignoredCount: 0,
  };
  findings.forEach((finding) => {
    switch (finding.status) {
      case 'OPEN':
        summary.openCount += 1;
        break;
      case 'IN_REVIEW':
        summary.inReviewCount += 1;
        break;
      case 'RESOLVED':
        summary.resolvedCount += 1;
        break;
      case 'IGNORED':
        summary.ignoredCount += 1;
        break;
      default:
        break;
    }
  });
  return summary;
};
