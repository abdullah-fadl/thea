export const NORMALIZE_STRIP_TOKENS = new Set([
  'staff',
  'team',
  'unit',
  'dept',
  'department',
  'section',
  'division',
  'group',
  'office',
  'service',
  'services',
  'ops',
  'operation',
  'operations',
  'function',
  'functions',
  'domain',
  'risk',
  'risks',
  'program',
  'programs',
]);

export const NORMALIZE_STOP_WORDS = new Set([
  'the',
  'and',
  'of',
  'for',
  'in',
  'to',
]);

export function normalizeLabel(name: string): string {
  if (!name) return '';
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !NORMALIZE_STOP_WORDS.has(token))
    .filter((token) => !NORMALIZE_STRIP_TOKENS.has(token));

  return tokens.join(' ').trim();
}

export function tokenize(name: string): Set<string> {
  const normalized = normalizeLabel(name);
  if (!normalized) return new Set();
  return new Set(normalized.split(' ').filter(Boolean));
}

function jaroWinkler(a: string, b: string): number {
  const s1 = normalizeLabel(a);
  const s2 = normalizeLabel(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i += 1) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j += 1) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches += 1;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i += 1) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k += 1;
    if (s1[i] !== s2[k]) transpositions += 1;
    k += 1;
  }

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i += 1) {
    if (s1[i] === s2[i]) prefix += 1;
    else break;
  }

  return jaro + (0.1 * prefix * (1 - jaro));
}

function tokenJaccard(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function similarity(a: string, b: string): number {
  const jw = jaroWinkler(a, b);
  const jaccard = tokenJaccard(a, b);
  return (jw * 0.6) + (jaccard * 0.4);
}

export type MatchResult = {
  matchId: string;
  matchLabel: string;
  score: number;
  secondScore: number;
  isAmbiguous: boolean;
};

export type MatchOptions = {
  threshold?: number;
  ambiguityDelta?: number;
};

export function findBestMatch<T extends { id: string; name?: string; label?: string }>(
  candidate: string,
  existing: T[],
  options: MatchOptions = {}
): MatchResult | null {
  const threshold = options.threshold ?? 0.88;
  const ambiguityDelta = options.ambiguityDelta ?? 0.03;
  if (!candidate || existing.length === 0) return null;

  const scored = existing
    .map((item) => {
      const label = item.name || item.label || '';
      return {
        item,
        label,
        score: similarity(candidate, label),
      };
    })
    .filter((row) => row.label);

  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const secondScore = scored[1]?.score ?? 0;

  if (best.score < threshold) return null;

  const isAmbiguous = secondScore > 0 && (best.score - secondScore) <= ambiguityDelta;
  return {
    matchId: best.item.id,
    matchLabel: best.label,
    score: best.score,
    secondScore,
    isAmbiguous,
  };
}

export function findTopMatches<T extends { id: string; name?: string; label?: string }>(
  candidate: string,
  existing: T[],
  limit = 5
) {
  if (!candidate || existing.length === 0) return [];
  return existing
    .map((item) => {
      const label = item.name || item.label || '';
      return {
        item,
        label,
        score: similarity(candidate, label),
      };
    })
    .filter((row) => row.label)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
