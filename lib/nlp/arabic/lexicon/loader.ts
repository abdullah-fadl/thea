export interface MedicalPhrase {
  phrase: string;
  canonical: string;
  concept_code_system: string;
  concept_code: string;
}

export class LexiconNotLoaded extends Error {
  constructor(cause?: unknown) {
    super('Arabic medical lexicon failed to load');
    this.name = 'LexiconNotLoaded';
    if (cause) this.cause = cause;
  }
}

let _cache: MedicalPhrase[] | null = null;

/** Returns the loaded medical phrases, cached after first call. Throws LexiconNotLoaded on error. */
export function getMedicalPhrases(): MedicalPhrase[] {
  if (_cache) return _cache;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('./medical-saudi-phrases.json') as MedicalPhrase[];
    _cache = raw;
    return _cache;
  } catch (err) {
    throw new LexiconNotLoaded(err);
  }
}

/** Reset the cache — used in tests only. */
export function _resetLexiconCache(): void {
  _cache = null;
}
