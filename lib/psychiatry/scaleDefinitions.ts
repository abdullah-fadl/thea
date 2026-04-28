/**
 * Psychometric Scale Definitions
 *
 * Complete clinical scale definitions for PHQ-9, GAD-7, MADRS, AUDIT, PCL-5, and PANSS.
 * Each scale includes bilingual (Arabic + English) item text, response options,
 * scoring functions, and severity threshold mappings.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ScaleOption {
  value: number;
  labelEn: string;
  labelAr: string;
}

export interface ScaleItem {
  number: number;
  textEn: string;
  textAr: string;
  minValue: number;
  maxValue: number;
  options: ScaleOption[];
}

export interface SeverityThreshold {
  min: number;
  max: number;
  level: string;
  labelEn: string;
  labelAr: string;
}

export interface SubscaleDefinition {
  key: string;
  nameEn: string;
  nameAr: string;
  itemNumbers: number[];
}

export interface ScaleDefinition {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  items: ScaleItem[];
  subscales?: SubscaleDefinition[];
  severityThresholds: SeverityThreshold[];
  maxTotal: number;
  score: (responses: number[]) => number;
  subscaleScores?: (responses: number[]) => { subscale: string; score: number }[];
  getSeverity: (total: number) => SeverityThreshold;
}

/* ------------------------------------------------------------------ */
/*  Shared option sets                                                 */
/* ------------------------------------------------------------------ */

const PHQ_GAD_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: 'Not at all', labelAr: '\u0644\u0645 \u064a\u062d\u062f\u062b \u0639\u0644\u0649 \u0627\u0644\u0625\u0637\u0644\u0627\u0642' },
  { value: 1, labelEn: 'Several days', labelAr: '\u0639\u062f\u0629 \u0623\u064a\u0627\u0645' },
  { value: 2, labelEn: 'More than half the days', labelAr: '\u0623\u0643\u062b\u0631 \u0645\u0646 \u0646\u0635\u0641 \u0627\u0644\u0623\u064a\u0627\u0645' },
  { value: 3, labelEn: 'Nearly every day', labelAr: '\u062a\u0642\u0631\u064a\u0628\u0627\u064b \u0643\u0644 \u064a\u0648\u0645' },
];

const MADRS_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: '0 - No abnormality', labelAr: '0 - \u0644\u0627 \u064a\u0648\u062c\u062f \u0627\u0636\u0637\u0631\u0627\u0628' },
  { value: 1, labelEn: '1', labelAr: '1' },
  { value: 2, labelEn: '2 - Mild', labelAr: '2 - \u062e\u0641\u064a\u0641' },
  { value: 3, labelEn: '3', labelAr: '3' },
  { value: 4, labelEn: '4 - Moderate', labelAr: '4 - \u0645\u062a\u0648\u0633\u0637' },
  { value: 5, labelEn: '5', labelAr: '5' },
  { value: 6, labelEn: '6 - Severe', labelAr: '6 - \u0634\u062f\u064a\u062f' },
];

const PCL5_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: 'Not at all', labelAr: '\u0644\u0645 \u064a\u062d\u062f\u062b \u0639\u0644\u0649 \u0627\u0644\u0625\u0637\u0644\u0627\u0642' },
  { value: 1, labelEn: 'A little bit', labelAr: '\u0642\u0644\u064a\u0644\u0627\u064b' },
  { value: 2, labelEn: 'Moderately', labelAr: '\u0628\u0634\u0643\u0644 \u0645\u062a\u0648\u0633\u0637' },
  { value: 3, labelEn: 'Quite a bit', labelAr: '\u0643\u062b\u064a\u0631\u0627\u064b' },
  { value: 4, labelEn: 'Extremely', labelAr: '\u0628\u0634\u062f\u0629' },
];

const PANSS_OPTIONS: ScaleOption[] = [
  { value: 1, labelEn: '1 - Absent', labelAr: '1 - \u063a\u0627\u0626\u0628' },
  { value: 2, labelEn: '2 - Minimal', labelAr: '2 - \u0637\u0641\u064a\u0641' },
  { value: 3, labelEn: '3 - Mild', labelAr: '3 - \u062e\u0641\u064a\u0641' },
  { value: 4, labelEn: '4 - Moderate', labelAr: '4 - \u0645\u062a\u0648\u0633\u0637' },
  { value: 5, labelEn: '5 - Moderate Severe', labelAr: '5 - \u0645\u062a\u0648\u0633\u0637 \u0634\u062f\u064a\u062f' },
  { value: 6, labelEn: '6 - Severe', labelAr: '6 - \u0634\u062f\u064a\u062f' },
  { value: 7, labelEn: '7 - Extreme', labelAr: '7 - \u0634\u062f\u064a\u062f \u062c\u062f\u0627\u064b' },
];

/* ------------------------------------------------------------------ */
/*  Helper to build severity lookup                                    */
/* ------------------------------------------------------------------ */

function findSeverity(thresholds: SeverityThreshold[], score: number): SeverityThreshold {
  for (const t of thresholds) {
    if (score >= t.min && score <= t.max) return t;
  }
  return thresholds[thresholds.length - 1];
}

/* ================================================================== */
/*  PHQ-9 — Patient Health Questionnaire (Depression)                  */
/* ================================================================== */

const PHQ9_THRESHOLDS: SeverityThreshold[] = [
  { min: 0, max: 4, level: 'NONE', labelEn: 'None / Minimal', labelAr: '\u0644\u0627 \u064a\u0648\u062c\u062f / \u0637\u0641\u064a\u0641' },
  { min: 5, max: 9, level: 'MILD', labelEn: 'Mild', labelAr: '\u062e\u0641\u064a\u0641' },
  { min: 10, max: 14, level: 'MODERATE', labelEn: 'Moderate', labelAr: '\u0645\u062a\u0648\u0633\u0637' },
  { min: 15, max: 19, level: 'MODERATELY_SEVERE', labelEn: 'Moderately Severe', labelAr: '\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0634\u062f\u0629' },
  { min: 20, max: 27, level: 'SEVERE', labelEn: 'Severe', labelAr: '\u0634\u062f\u064a\u062f' },
];

export const PHQ9: ScaleDefinition = {
  key: 'PHQ9',
  nameEn: 'PHQ-9 (Patient Health Questionnaire)',
  nameAr: '\u0627\u0633\u062a\u0628\u064a\u0627\u0646 \u0635\u062d\u0629 \u0627\u0644\u0645\u0631\u064a\u0636 - 9',
  descriptionEn: 'Depression screening and severity measure. Over the last 2 weeks, how often have you been bothered by the following problems?',
  descriptionAr: '\u0641\u062d\u0635 \u0627\u0644\u0627\u0643\u062a\u0626\u0627\u0628 \u0648\u0642\u064a\u0627\u0633 \u0634\u062f\u062a\u0647. \u062e\u0644\u0627\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0627\u0644\u0645\u0627\u0636\u064a\u064a\u0646\u060c \u0643\u0645 \u0645\u0631\u0629 \u0623\u0632\u0639\u062c\u062a\u0643 \u0627\u0644\u0645\u0634\u0627\u0643\u0644 \u0627\u0644\u062a\u0627\u0644\u064a\u0629\u061f',
  maxTotal: 27,
  severityThresholds: PHQ9_THRESHOLDS,
  items: [
    {
      number: 1,
      textEn: 'Little interest or pleasure in doing things',
      textAr: '\u0642\u0644\u0629 \u0627\u0644\u0627\u0647\u062a\u0645\u0627\u0645 \u0623\u0648 \u0627\u0644\u0645\u062a\u0639\u0629 \u0641\u064a \u0627\u0644\u0642\u064a\u0627\u0645 \u0628\u0627\u0644\u0623\u0634\u064a\u0627\u0621',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 2,
      textEn: 'Feeling down, depressed, or hopeless',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0625\u062d\u0628\u0627\u0637 \u0623\u0648 \u0627\u0644\u0627\u0643\u062a\u0626\u0627\u0628 \u0623\u0648 \u0627\u0644\u064a\u0623\u0633',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 3,
      textEn: 'Trouble falling or staying asleep, or sleeping too much',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0646\u0648\u0645 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0645\u0631\u0627\u0631 \u0641\u064a\u0647\u060c \u0623\u0648 \u0627\u0644\u0646\u0648\u0645 \u0643\u062b\u064a\u0631\u0627\u064b',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 4,
      textEn: 'Feeling tired or having little energy',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u062a\u0639\u0628 \u0623\u0648 \u0642\u0644\u0629 \u0627\u0644\u0637\u0627\u0642\u0629',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 5,
      textEn: 'Poor appetite or overeating',
      textAr: '\u0636\u0639\u0641 \u0627\u0644\u0634\u0647\u064a\u0629 \u0623\u0648 \u0627\u0644\u0625\u0641\u0631\u0627\u0637 \u0641\u064a \u0627\u0644\u0623\u0643\u0644',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 6,
      textEn: 'Feeling bad about yourself, or that you are a failure, or have let yourself or your family down',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0633\u0648\u0621 \u062a\u062c\u0627\u0647 \u0646\u0641\u0633\u0643\u060c \u0623\u0648 \u0623\u0646\u0643 \u0641\u0627\u0634\u0644\u060c \u0623\u0648 \u0623\u0646\u0643 \u062e\u0630\u0644\u062a \u0646\u0641\u0633\u0643 \u0623\u0648 \u0639\u0627\u0626\u0644\u062a\u0643',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 7,
      textEn: 'Trouble concentrating on things, such as reading the newspaper or watching television',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u062a\u0631\u0643\u064a\u0632 \u0639\u0644\u0649 \u0627\u0644\u0623\u0634\u064a\u0627\u0621\u060c \u0645\u062b\u0644 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0635\u062d\u064a\u0641\u0629 \u0623\u0648 \u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u062a\u0644\u0641\u0627\u0632',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 8,
      textEn: 'Moving or speaking so slowly that other people could have noticed, or the opposite - being so fidgety or restless',
      textAr: '\u0627\u0644\u062a\u062d\u0631\u0643 \u0623\u0648 \u0627\u0644\u062a\u062d\u062f\u062b \u0628\u0628\u0637\u0621 \u0634\u062f\u064a\u062f \u0628\u062d\u064a\u062b \u064a\u0644\u0627\u062d\u0638\u0647 \u0627\u0644\u0622\u062e\u0631\u0648\u0646\u060c \u0623\u0648 \u0627\u0644\u0639\u0643\u0633 - \u0627\u0644\u062a\u0645\u0644\u0645\u0644 \u0648\u0639\u062f\u0645 \u0627\u0644\u0627\u0633\u062a\u0642\u0631\u0627\u0631',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 9,
      textEn: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
      textAr: '\u0623\u0641\u0643\u0627\u0631 \u0628\u0623\u0646\u0643 \u0633\u062a\u0643\u0648\u0646 \u0623\u0641\u0636\u0644 \u062d\u0627\u0644\u0627\u064b \u0644\u0648 \u0645\u062a\u060c \u0623\u0648 \u0623\u0641\u0643\u0627\u0631 \u0628\u0625\u064a\u0630\u0627\u0621 \u0646\u0641\u0633\u0643',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  getSeverity: (total: number) => findSeverity(PHQ9_THRESHOLDS, total),
};

/* ================================================================== */
/*  GAD-7 — Generalized Anxiety Disorder                               */
/* ================================================================== */

const GAD7_THRESHOLDS: SeverityThreshold[] = [
  { min: 0, max: 4, level: 'MINIMAL', labelEn: 'Minimal Anxiety', labelAr: '\u0642\u0644\u0642 \u0637\u0641\u064a\u0641' },
  { min: 5, max: 9, level: 'MILD', labelEn: 'Mild Anxiety', labelAr: '\u0642\u0644\u0642 \u062e\u0641\u064a\u0641' },
  { min: 10, max: 14, level: 'MODERATE', labelEn: 'Moderate Anxiety', labelAr: '\u0642\u0644\u0642 \u0645\u062a\u0648\u0633\u0637' },
  { min: 15, max: 21, level: 'SEVERE', labelEn: 'Severe Anxiety', labelAr: '\u0642\u0644\u0642 \u0634\u062f\u064a\u062f' },
];

export const GAD7: ScaleDefinition = {
  key: 'GAD7',
  nameEn: 'GAD-7 (Generalized Anxiety Disorder)',
  nameAr: '\u0645\u0642\u064a\u0627\u0633 \u0627\u0636\u0637\u0631\u0627\u0628 \u0627\u0644\u0642\u0644\u0642 \u0627\u0644\u0639\u0627\u0645 - 7',
  descriptionEn: 'Anxiety screening and severity measure. Over the last 2 weeks, how often have you been bothered by the following problems?',
  descriptionAr: '\u0641\u062d\u0635 \u0627\u0644\u0642\u0644\u0642 \u0648\u0642\u064a\u0627\u0633 \u0634\u062f\u062a\u0647. \u062e\u0644\u0627\u0644 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0646 \u0627\u0644\u0645\u0627\u0636\u064a\u064a\u0646\u060c \u0643\u0645 \u0645\u0631\u0629 \u0623\u0632\u0639\u062c\u062a\u0643 \u0627\u0644\u0645\u0634\u0627\u0643\u0644 \u0627\u0644\u062a\u0627\u0644\u064a\u0629\u061f',
  maxTotal: 21,
  severityThresholds: GAD7_THRESHOLDS,
  items: [
    {
      number: 1,
      textEn: 'Feeling nervous, anxious, or on edge',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0639\u0635\u0628\u064a\u0629 \u0623\u0648 \u0627\u0644\u0642\u0644\u0642 \u0623\u0648 \u0627\u0644\u062a\u0648\u062a\u0631',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 2,
      textEn: 'Not being able to stop or control worrying',
      textAr: '\u0639\u062f\u0645 \u0627\u0644\u0642\u062f\u0631\u0629 \u0639\u0644\u0649 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0642\u0644\u0642 \u0623\u0648 \u0627\u0644\u0633\u064a\u0637\u0631\u0629 \u0639\u0644\u064a\u0647',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 3,
      textEn: 'Worrying too much about different things',
      textAr: '\u0627\u0644\u0642\u0644\u0642 \u0627\u0644\u0645\u0641\u0631\u0637 \u062d\u0648\u0644 \u0623\u0634\u064a\u0627\u0621 \u0645\u062e\u062a\u0644\u0641\u0629',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 4,
      textEn: 'Trouble relaxing',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0627\u0633\u062a\u0631\u062e\u0627\u0621',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 5,
      textEn: 'Being so restless that it is hard to sit still',
      textAr: '\u0627\u0644\u062a\u0645\u0644\u0645\u0644 \u0644\u062f\u0631\u062c\u0629 \u0635\u0639\u0648\u0628\u0629 \u0627\u0644\u062c\u0644\u0648\u0633 \u0628\u0647\u062f\u0648\u0621',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 6,
      textEn: 'Becoming easily annoyed or irritable',
      textAr: '\u0633\u0647\u0648\u0644\u0629 \u0627\u0644\u0627\u0646\u0632\u0639\u0627\u062c \u0623\u0648 \u0627\u0644\u062a\u0647\u064a\u062c',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
    {
      number: 7,
      textEn: 'Feeling afraid, as if something awful might happen',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u062e\u0648\u0641\u060c \u0643\u0623\u0646 \u0634\u064a\u0626\u0627\u064b \u0641\u0638\u064a\u0639\u0627\u064b \u0642\u062f \u064a\u062d\u062f\u062b',
      minValue: 0, maxValue: 3, options: PHQ_GAD_OPTIONS,
    },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  getSeverity: (total: number) => findSeverity(GAD7_THRESHOLDS, total),
};

/* ================================================================== */
/*  MADRS — Montgomery-Asberg Depression Rating Scale                  */
/* ================================================================== */

const MADRS_THRESHOLDS: SeverityThreshold[] = [
  { min: 0, max: 6, level: 'NONE', labelEn: 'Normal / Absent', labelAr: '\u0637\u0628\u064a\u0639\u064a / \u063a\u0627\u0626\u0628' },
  { min: 7, max: 19, level: 'MILD', labelEn: 'Mild Depression', labelAr: '\u0627\u0643\u062a\u0626\u0627\u0628 \u062e\u0641\u064a\u0641' },
  { min: 20, max: 34, level: 'MODERATE', labelEn: 'Moderate Depression', labelAr: '\u0627\u0643\u062a\u0626\u0627\u0628 \u0645\u062a\u0648\u0633\u0637' },
  { min: 35, max: 60, level: 'SEVERE', labelEn: 'Severe Depression', labelAr: '\u0627\u0643\u062a\u0626\u0627\u0628 \u0634\u062f\u064a\u062f' },
];

export const MADRS: ScaleDefinition = {
  key: 'MADRS',
  nameEn: 'MADRS (Montgomery-\u00C5sberg Depression Rating Scale)',
  nameAr: '\u0645\u0642\u064a\u0627\u0633 \u0645\u0648\u0646\u062a\u063a\u0645\u0631\u064a-\u0622\u0633\u0628\u064a\u0631\u063a \u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0627\u0643\u062a\u0626\u0627\u0628',
  descriptionEn: 'Clinician-rated depression severity scale. Rate each item from 0-6 based on clinical observation.',
  descriptionAr: '\u0645\u0642\u064a\u0627\u0633 \u0634\u062f\u0629 \u0627\u0644\u0627\u0643\u062a\u0626\u0627\u0628 \u0627\u0644\u0645\u0642\u064a\u0651\u0645 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0637\u0628\u064a\u0628. \u0642\u064a\u0651\u0645 \u0643\u0644 \u0639\u0646\u0635\u0631 \u0645\u0646 0-6 \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0633\u0631\u064a\u0631\u064a\u0629.',
  maxTotal: 60,
  severityThresholds: MADRS_THRESHOLDS,
  items: [
    {
      number: 1,
      textEn: 'Apparent sadness - representing despondency, gloom, and despair',
      textAr: '\u0627\u0644\u062d\u0632\u0646 \u0627\u0644\u0638\u0627\u0647\u0631 - \u064a\u0645\u062b\u0644 \u0627\u0644\u064a\u0623\u0633 \u0648\u0627\u0644\u0643\u0622\u0628\u0629 \u0648\u0627\u0644\u0642\u0646\u0648\u0637',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 2,
      textEn: 'Reported sadness - representing reports of depressed mood',
      textAr: '\u0627\u0644\u062d\u0632\u0646 \u0627\u0644\u0645\u0628\u0644\u063a \u0639\u0646\u0647 - \u064a\u0645\u062b\u0644 \u062a\u0642\u0627\u0631\u064a\u0631 \u0639\u0646 \u0627\u0644\u0645\u0632\u0627\u062c \u0627\u0644\u0645\u0643\u062a\u0626\u0628',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 3,
      textEn: 'Inner tension - representing feelings of ill-defined discomfort, edginess, inner turmoil',
      textAr: '\u0627\u0644\u062a\u0648\u062a\u0631 \u0627\u0644\u062f\u0627\u062e\u0644\u064a - \u064a\u0645\u062b\u0644 \u0645\u0634\u0627\u0639\u0631 \u0627\u0644\u0627\u0646\u0632\u0639\u0627\u062c \u0648\u0627\u0644\u0627\u0636\u0637\u0631\u0627\u0628 \u0627\u0644\u062f\u0627\u062e\u0644\u064a',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 4,
      textEn: 'Reduced sleep - representing reduced duration or depth of sleep',
      textAr: '\u0642\u0644\u0629 \u0627\u0644\u0646\u0648\u0645 - \u064a\u0645\u062b\u0644 \u0627\u0646\u062e\u0641\u0627\u0636 \u0645\u062f\u0629 \u0623\u0648 \u0639\u0645\u0642 \u0627\u0644\u0646\u0648\u0645',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 5,
      textEn: 'Reduced appetite - representing the feeling of a loss of appetite',
      textAr: '\u0627\u0646\u062e\u0641\u0627\u0636 \u0627\u0644\u0634\u0647\u064a\u0629 - \u064a\u0645\u062b\u0644 \u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0641\u0642\u062f\u0627\u0646 \u0627\u0644\u0634\u0647\u064a\u0629',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 6,
      textEn: 'Concentration difficulties - representing difficulty in collecting one\'s thoughts',
      textAr: '\u0635\u0639\u0648\u0628\u0627\u062a \u0627\u0644\u062a\u0631\u0643\u064a\u0632 - \u064a\u0645\u062b\u0644 \u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u062a\u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0641\u0643\u0627\u0631',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 7,
      textEn: 'Lassitude - representing difficulty getting started or slowness initiating activities',
      textAr: '\u0627\u0644\u062e\u0645\u0648\u0644 - \u064a\u0645\u062b\u0644 \u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0628\u062f\u0621 \u0623\u0648 \u0628\u0637\u0621 \u0641\u064a \u0628\u062f\u0621 \u0627\u0644\u0623\u0646\u0634\u0637\u0629',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 8,
      textEn: 'Inability to feel - representing the subjective experience of reduced interest',
      textAr: '\u0639\u062f\u0645 \u0627\u0644\u0642\u062f\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0639\u0648\u0631 - \u064a\u0645\u062b\u0644 \u0627\u0646\u062e\u0641\u0627\u0636 \u0627\u0644\u0627\u0647\u062a\u0645\u0627\u0645 \u0627\u0644\u0634\u062e\u0635\u064a',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 9,
      textEn: 'Pessimistic thoughts - representing thoughts of guilt, inferiority, self-reproach',
      textAr: '\u0627\u0644\u0623\u0641\u0643\u0627\u0631 \u0627\u0644\u062a\u0634\u0627\u0624\u0645\u064a\u0629 - \u062a\u0645\u062b\u0644 \u0623\u0641\u0643\u0627\u0631 \u0627\u0644\u0630\u0646\u0628 \u0648\u0627\u0644\u062f\u0648\u0646\u064a\u0629 \u0648\u0644\u0648\u0645 \u0627\u0644\u0630\u0627\u062a',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
    {
      number: 10,
      textEn: 'Suicidal thoughts - representing the feeling that life is not worth living',
      textAr: '\u0627\u0644\u0623\u0641\u0643\u0627\u0631 \u0627\u0644\u0627\u0646\u062a\u062d\u0627\u0631\u064a\u0629 - \u062a\u0645\u062b\u0644 \u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0623\u0646 \u0627\u0644\u062d\u064a\u0627\u0629 \u0644\u0627 \u062a\u0633\u062a\u062d\u0642 \u0627\u0644\u0639\u064a\u0634',
      minValue: 0, maxValue: 6, options: MADRS_OPTIONS,
    },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  getSeverity: (total: number) => findSeverity(MADRS_THRESHOLDS, total),
};

/* ================================================================== */
/*  AUDIT — Alcohol Use Disorders Identification Test                  */
/* ================================================================== */

const AUDIT_THRESHOLDS: SeverityThreshold[] = [
  { min: 0, max: 7, level: 'LOW_RISK', labelEn: 'Low Risk', labelAr: '\u062e\u0637\u0631 \u0645\u0646\u062e\u0641\u0636' },
  { min: 8, max: 15, level: 'HAZARDOUS', labelEn: 'Hazardous Drinking', labelAr: '\u0634\u0631\u0628 \u062e\u0637\u0631' },
  { min: 16, max: 19, level: 'HARMFUL', labelEn: 'Harmful Drinking', labelAr: '\u0634\u0631\u0628 \u0636\u0627\u0631' },
  { min: 20, max: 40, level: 'DEPENDENCE', labelEn: 'Possible Dependence', labelAr: '\u0627\u062d\u062a\u0645\u0627\u0644 \u0627\u0644\u0625\u062f\u0645\u0627\u0646' },
];

const AUDIT_FREQ_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: 'Never', labelAr: '\u0623\u0628\u062f\u0627\u064b' },
  { value: 1, labelEn: 'Monthly or less', labelAr: '\u0645\u0631\u0629 \u0634\u0647\u0631\u064a\u0627\u064b \u0623\u0648 \u0623\u0642\u0644' },
  { value: 2, labelEn: '2-4 times a month', labelAr: '2-4 \u0645\u0631\u0627\u062a \u0634\u0647\u0631\u064a\u0627\u064b' },
  { value: 3, labelEn: '2-3 times a week', labelAr: '2-3 \u0645\u0631\u0627\u062a \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b' },
  { value: 4, labelEn: '4 or more times a week', labelAr: '4 \u0645\u0631\u0627\u062a \u0623\u0648 \u0623\u0643\u062b\u0631 \u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b' },
];

const AUDIT_AMOUNT_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: '1 or 2', labelAr: '1 \u0623\u0648 2' },
  { value: 1, labelEn: '3 or 4', labelAr: '3 \u0623\u0648 4' },
  { value: 2, labelEn: '5 or 6', labelAr: '5 \u0623\u0648 6' },
  { value: 3, labelEn: '7 to 9', labelAr: '7 \u0625\u0644\u0649 9' },
  { value: 4, labelEn: '10 or more', labelAr: '10 \u0623\u0648 \u0623\u0643\u062b\u0631' },
];

const AUDIT_FREQ2_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: 'Never', labelAr: '\u0623\u0628\u062f\u0627\u064b' },
  { value: 1, labelEn: 'Less than monthly', labelAr: '\u0623\u0642\u0644 \u0645\u0646 \u0634\u0647\u0631\u064a' },
  { value: 2, labelEn: 'Monthly', labelAr: '\u0634\u0647\u0631\u064a\u0627\u064b' },
  { value: 3, labelEn: 'Weekly', labelAr: '\u0623\u0633\u0628\u0648\u0639\u064a\u0627\u064b' },
  { value: 4, labelEn: 'Daily or almost daily', labelAr: '\u064a\u0648\u0645\u064a\u0627\u064b \u0623\u0648 \u062a\u0642\u0631\u064a\u0628\u0627\u064b' },
];

const AUDIT_YESNO_OPTIONS: ScaleOption[] = [
  { value: 0, labelEn: 'No', labelAr: '\u0644\u0627' },
  { value: 2, labelEn: 'Yes, but not in the last year', labelAr: '\u0646\u0639\u0645\u060c \u0644\u0643\u0646 \u0644\u064a\u0633 \u0641\u064a \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629' },
  { value: 4, labelEn: 'Yes, during the last year', labelAr: '\u0646\u0639\u0645\u060c \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629' },
];

export const AUDIT: ScaleDefinition = {
  key: 'AUDIT',
  nameEn: 'AUDIT (Alcohol Use Disorders Identification Test)',
  nameAr: '\u0627\u062e\u062a\u0628\u0627\u0631 \u062a\u062d\u062f\u064a\u062f \u0627\u0636\u0637\u0631\u0627\u0628\u0627\u062a \u062a\u0639\u0627\u0637\u064a \u0627\u0644\u0643\u062d\u0648\u0644',
  descriptionEn: 'Alcohol use screening tool developed by the World Health Organization.',
  descriptionAr: '\u0623\u062f\u0627\u0629 \u0641\u062d\u0635 \u062a\u0639\u0627\u0637\u064a \u0627\u0644\u0643\u062d\u0648\u0644 \u0637\u0648\u0631\u062a\u0647\u0627 \u0645\u0646\u0638\u0645\u0629 \u0627\u0644\u0635\u062d\u0629 \u0627\u0644\u0639\u0627\u0644\u0645\u064a\u0629.',
  maxTotal: 40,
  severityThresholds: AUDIT_THRESHOLDS,
  items: [
    {
      number: 1,
      textEn: 'How often do you have a drink containing alcohol?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062a\u062a\u0646\u0627\u0648\u0644 \u0645\u0634\u0631\u0648\u0628\u0627\u064b \u064a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0627\u0644\u0643\u062d\u0648\u0644\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ_OPTIONS,
    },
    {
      number: 2,
      textEn: 'How many standard drinks do you have on a typical day when you are drinking?',
      textAr: '\u0643\u0645 \u0639\u062f\u062f \u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0627\u0644\u0642\u064a\u0627\u0633\u064a\u0629 \u0627\u0644\u062a\u064a \u062a\u062a\u0646\u0627\u0648\u0644\u0647\u0627 \u0641\u064a \u064a\u0648\u0645 \u0639\u0627\u062f\u064a \u0639\u0646\u062f \u0627\u0644\u0634\u0631\u0628\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_AMOUNT_OPTIONS,
    },
    {
      number: 3,
      textEn: 'How often do you have 6 or more drinks on one occasion?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062a\u062a\u0646\u0627\u0648\u0644 6 \u0645\u0634\u0631\u0648\u0628\u0627\u062a \u0623\u0648 \u0623\u0643\u062b\u0631 \u0641\u064a \u0645\u0646\u0627\u0633\u0628\u0629 \u0648\u0627\u062d\u062f\u0629\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 4,
      textEn: 'How often during the last year have you found that you were not able to stop drinking once you had started?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0648\u062c\u062f\u062a \u0623\u0646\u0643 \u063a\u064a\u0631 \u0642\u0627\u062f\u0631 \u0639\u0644\u0649 \u0627\u0644\u062a\u0648\u0642\u0641 \u0639\u0646 \u0627\u0644\u0634\u0631\u0628 \u0628\u0645\u062c\u0631\u062f \u0627\u0644\u0628\u062f\u0621\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 5,
      textEn: 'How often during the last year have you failed to do what was normally expected of you because of drinking?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0641\u0634\u0644\u062a \u0641\u064a \u0623\u062f\u0627\u0621 \u0645\u0627 \u0643\u0627\u0646 \u0645\u062a\u0648\u0642\u0639\u0627\u064b \u0645\u0646\u0643 \u0628\u0633\u0628\u0628 \u0627\u0644\u0634\u0631\u0628\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 6,
      textEn: 'How often during the last year have you needed a first drink in the morning to get yourself going?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0627\u062d\u062a\u062c\u062a \u0625\u0644\u0649 \u0634\u0631\u0628\u0629 \u0623\u0648\u0644\u0649 \u0641\u064a \u0627\u0644\u0635\u0628\u0627\u062d \u0644\u062a\u0628\u062f\u0623 \u064a\u0648\u0645\u0643\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 7,
      textEn: 'How often during the last year have you had a feeling of guilt or remorse after drinking?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0634\u0639\u0631\u062a \u0628\u0627\u0644\u0630\u0646\u0628 \u0623\u0648 \u0627\u0644\u0646\u062f\u0645 \u0628\u0639\u062f \u0627\u0644\u0634\u0631\u0628\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 8,
      textEn: 'How often during the last year have you been unable to remember what happened the night before because of drinking?',
      textAr: '\u0643\u0645 \u0645\u0631\u0629 \u062e\u0644\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0636\u064a\u0629 \u0644\u0645 \u062a\u0633\u062a\u0637\u0639 \u062a\u0630\u0643\u0631 \u0645\u0627 \u062d\u062f\u062b \u0641\u064a \u0627\u0644\u0644\u064a\u0644\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0628\u0633\u0628\u0628 \u0627\u0644\u0634\u0631\u0628\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_FREQ2_OPTIONS,
    },
    {
      number: 9,
      textEn: 'Have you or someone else been injured as a result of your drinking?',
      textAr: '\u0647\u0644 \u062a\u0639\u0631\u0636\u062a \u0623\u0646\u062a \u0623\u0648 \u0634\u062e\u0635 \u0622\u062e\u0631 \u0644\u0625\u0635\u0627\u0628\u0629 \u0646\u062a\u064a\u062c\u0629 \u0634\u0631\u0628\u0643\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_YESNO_OPTIONS,
    },
    {
      number: 10,
      textEn: 'Has a relative, friend, doctor, or other health worker been concerned about your drinking or suggested you cut down?',
      textAr: '\u0647\u0644 \u0623\u0628\u062f\u0649 \u0642\u0631\u064a\u0628 \u0623\u0648 \u0635\u062f\u064a\u0642 \u0623\u0648 \u0637\u0628\u064a\u0628 \u0642\u0644\u0642\u0647 \u0628\u0634\u0623\u0646 \u0634\u0631\u0628\u0643 \u0623\u0648 \u0627\u0642\u062a\u0631\u062d \u0639\u0644\u064a\u0643 \u0627\u0644\u062a\u0642\u0644\u064a\u0644\u061f',
      minValue: 0, maxValue: 4, options: AUDIT_YESNO_OPTIONS,
    },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  getSeverity: (total: number) => findSeverity(AUDIT_THRESHOLDS, total),
};

/* ================================================================== */
/*  PCL-5 — PTSD Checklist for DSM-5                                   */
/* ================================================================== */

const PCL5_THRESHOLDS: SeverityThreshold[] = [
  { min: 0, max: 32, level: 'BELOW_THRESHOLD', labelEn: 'Below Threshold', labelAr: '\u062a\u062d\u062a \u0627\u0644\u062d\u062f' },
  { min: 33, max: 80, level: 'ABOVE_THRESHOLD', labelEn: 'Above Threshold (PTSD Probable)', labelAr: '\u0641\u0648\u0642 \u0627\u0644\u062d\u062f (\u0627\u062d\u062a\u0645\u0627\u0644 \u0627\u0636\u0637\u0631\u0627\u0628 \u0645\u0627 \u0628\u0639\u062f \u0627\u0644\u0635\u062f\u0645\u0629)' },
];

export const PCL5: ScaleDefinition = {
  key: 'PCL5',
  nameEn: 'PCL-5 (PTSD Checklist for DSM-5)',
  nameAr: '\u0642\u0627\u0626\u0645\u0629 \u0627\u0636\u0637\u0631\u0627\u0628 \u0645\u0627 \u0628\u0639\u062f \u0627\u0644\u0635\u062f\u0645\u0629 \u0644\u0644\u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0634\u062e\u064a\u0635\u064a \u0627\u0644\u062e\u0627\u0645\u0633',
  descriptionEn: 'PTSD screening checklist. In the past month, how much were you bothered by the following problems?',
  descriptionAr: '\u0642\u0627\u0626\u0645\u0629 \u0641\u062d\u0635 \u0627\u0636\u0637\u0631\u0627\u0628 \u0645\u0627 \u0628\u0639\u062f \u0627\u0644\u0635\u062f\u0645\u0629. \u0641\u064a \u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0645\u0627\u0636\u064a\u060c \u0645\u0627 \u0645\u062f\u0649 \u0627\u0646\u0632\u0639\u0627\u062c\u0643 \u0645\u0646 \u0627\u0644\u0645\u0634\u0627\u0643\u0644 \u0627\u0644\u062a\u0627\u0644\u064a\u0629\u061f',
  maxTotal: 80,
  severityThresholds: PCL5_THRESHOLDS,
  items: [
    {
      number: 1,
      textEn: 'Repeated, disturbing, and unwanted memories of the stressful experience',
      textAr: '\u0630\u0643\u0631\u064a\u0627\u062a \u0645\u062a\u0643\u0631\u0631\u0629 \u0648\u0645\u0632\u0639\u062c\u0629 \u0648\u063a\u064a\u0631 \u0645\u0631\u063a\u0648\u0628 \u0641\u064a\u0647\u0627 \u0644\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 2,
      textEn: 'Repeated, disturbing dreams of the stressful experience',
      textAr: '\u0623\u062d\u0644\u0627\u0645 \u0645\u062a\u0643\u0631\u0631\u0629 \u0648\u0645\u0632\u0639\u062c\u0629 \u0639\u0646 \u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 3,
      textEn: 'Suddenly feeling or acting as if the stressful experience were actually happening again (flashbacks)',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0627\u0644\u0645\u0641\u0627\u062c\u0626 \u0623\u0648 \u0627\u0644\u062a\u0635\u0631\u0641 \u0643\u0623\u0646 \u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u062a\u062d\u062f\u062b \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 (\u0627\u0633\u062a\u0631\u062c\u0627\u0639)',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 4,
      textEn: 'Feeling very upset when something reminded you of the stressful experience',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0627\u0646\u0632\u0639\u0627\u062c \u0627\u0644\u0634\u062f\u064a\u062f \u0639\u0646\u062f \u062a\u0630\u0643\u064a\u0631\u0643 \u0628\u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 5,
      textEn: 'Having strong physical reactions when something reminded you of the stressful experience',
      textAr: '\u0631\u062f\u0648\u062f \u0641\u0639\u0644 \u062c\u0633\u062f\u064a\u0629 \u0642\u0648\u064a\u0629 \u0639\u0646\u062f \u062a\u0630\u0643\u064a\u0631\u0643 \u0628\u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 6,
      textEn: 'Avoiding memories, thoughts, or feelings related to the stressful experience',
      textAr: '\u062a\u062c\u0646\u0628 \u0627\u0644\u0630\u0643\u0631\u064a\u0627\u062a \u0623\u0648 \u0627\u0644\u0623\u0641\u0643\u0627\u0631 \u0623\u0648 \u0627\u0644\u0645\u0634\u0627\u0639\u0631 \u0627\u0644\u0645\u062a\u0639\u0644\u0642\u0629 \u0628\u0627\u0644\u062a\u062c\u0631\u0628\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 7,
      textEn: 'Avoiding external reminders of the stressful experience (people, places, conversations, activities)',
      textAr: '\u062a\u062c\u0646\u0628 \u0627\u0644\u0645\u0630\u0643\u0631\u0627\u062a \u0627\u0644\u062e\u0627\u0631\u062c\u064a\u0629 \u0628\u0627\u0644\u062a\u062c\u0631\u0628\u0629 (\u0627\u0644\u0623\u0634\u062e\u0627\u0635\u060c \u0627\u0644\u0623\u0645\u0627\u0643\u0646\u060c \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a)',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 8,
      textEn: 'Trouble remembering important parts of the stressful experience',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u062a\u0630\u0643\u0631 \u0623\u062c\u0632\u0627\u0621 \u0645\u0647\u0645\u0629 \u0645\u0646 \u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 9,
      textEn: 'Having strong negative beliefs about yourself, other people, or the world',
      textAr: '\u0645\u0639\u062a\u0642\u062f\u0627\u062a \u0633\u0644\u0628\u064a\u0629 \u0642\u0648\u064a\u0629 \u0639\u0646 \u0646\u0641\u0633\u0643 \u0623\u0648 \u0627\u0644\u0622\u062e\u0631\u064a\u0646 \u0623\u0648 \u0627\u0644\u0639\u0627\u0644\u0645',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 10,
      textEn: 'Blaming yourself or someone else for the stressful experience or what happened after it',
      textAr: '\u0644\u0648\u0645 \u0646\u0641\u0633\u0643 \u0623\u0648 \u0634\u062e\u0635 \u0622\u062e\u0631 \u0639\u0644\u0649 \u0627\u0644\u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u062c\u0647\u062f\u0629 \u0623\u0648 \u0645\u0627 \u062d\u062f\u062b \u0628\u0639\u062f\u0647\u0627',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 11,
      textEn: 'Having strong negative feelings such as fear, horror, anger, guilt, or shame',
      textAr: '\u0645\u0634\u0627\u0639\u0631 \u0633\u0644\u0628\u064a\u0629 \u0642\u0648\u064a\u0629 \u0645\u062b\u0644 \u0627\u0644\u062e\u0648\u0641 \u0623\u0648 \u0627\u0644\u0631\u0639\u0628 \u0623\u0648 \u0627\u0644\u063a\u0636\u0628 \u0623\u0648 \u0627\u0644\u0630\u0646\u0628 \u0623\u0648 \u0627\u0644\u0639\u0627\u0631',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 12,
      textEn: 'Loss of interest in activities that you used to enjoy',
      textAr: '\u0641\u0642\u062f\u0627\u0646 \u0627\u0644\u0627\u0647\u062a\u0645\u0627\u0645 \u0628\u0627\u0644\u0623\u0646\u0634\u0637\u0629 \u0627\u0644\u062a\u064a \u0643\u0646\u062a \u062a\u0633\u062a\u0645\u062a\u0639 \u0628\u0647\u0627',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 13,
      textEn: 'Feeling distant or cut off from other people',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0628\u0639\u062f \u0623\u0648 \u0627\u0644\u0627\u0646\u0641\u0635\u0627\u0644 \u0639\u0646 \u0627\u0644\u0622\u062e\u0631\u064a\u0646',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 14,
      textEn: 'Trouble experiencing positive feelings (e.g., being unable to feel happiness)',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0645\u0634\u0627\u0639\u0631 \u0627\u0644\u0625\u064a\u062c\u0627\u0628\u064a\u0629 (\u0645\u062b\u0644 \u0639\u062f\u0645 \u0627\u0644\u0642\u062f\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0633\u0639\u0627\u062f\u0629)',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 15,
      textEn: 'Irritable behavior, angry outbursts, or acting aggressively',
      textAr: '\u0633\u0644\u0648\u0643 \u0639\u0635\u0628\u064a\u060c \u0646\u0648\u0628\u0627\u062a \u063a\u0636\u0628\u060c \u0623\u0648 \u062a\u0635\u0631\u0641 \u0639\u062f\u0648\u0627\u0646\u064a',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 16,
      textEn: 'Taking too many risks or doing things that could cause you harm',
      textAr: '\u0627\u0644\u0645\u062e\u0627\u0637\u0631\u0629 \u0627\u0644\u0645\u0641\u0631\u0637\u0629 \u0623\u0648 \u0641\u0639\u0644 \u0623\u0634\u064a\u0627\u0621 \u0642\u062f \u062a\u0633\u0628\u0628 \u0644\u0643 \u0627\u0644\u0636\u0631\u0631',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 17,
      textEn: 'Being "superalert" or watchful or on guard',
      textAr: '\u0627\u0644\u064a\u0642\u0638\u0629 \u0627\u0644\u0645\u0641\u0631\u0637\u0629 \u0623\u0648 \u0627\u0644\u062d\u0630\u0631 \u0627\u0644\u0634\u062f\u064a\u062f',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 18,
      textEn: 'Feeling jumpy or easily startled',
      textAr: '\u0627\u0644\u0634\u0639\u0648\u0631 \u0628\u0627\u0644\u0627\u0631\u062a\u0639\u0627\u0634 \u0623\u0648 \u0633\u0647\u0648\u0644\u0629 \u0627\u0644\u0627\u0646\u0632\u0639\u0627\u062c',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 19,
      textEn: 'Having difficulty concentrating',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u062a\u0631\u0643\u064a\u0632',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
    {
      number: 20,
      textEn: 'Trouble falling or staying asleep',
      textAr: '\u0635\u0639\u0648\u0628\u0629 \u0641\u064a \u0627\u0644\u0646\u0648\u0645 \u0623\u0648 \u0627\u0644\u0627\u0633\u062a\u0645\u0631\u0627\u0631 \u0641\u064a\u0647',
      minValue: 0, maxValue: 4, options: PCL5_OPTIONS,
    },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  getSeverity: (total: number) => findSeverity(PCL5_THRESHOLDS, total),
};

/* ================================================================== */
/*  PANSS — Positive and Negative Syndrome Scale                       */
/* ================================================================== */

const PANSS_THRESHOLDS: SeverityThreshold[] = [
  { min: 30, max: 57, level: 'MILD', labelEn: 'Mild', labelAr: '\u062e\u0641\u064a\u0641' },
  { min: 58, max: 95, level: 'MODERATE', labelEn: 'Moderate', labelAr: '\u0645\u062a\u0648\u0633\u0637' },
  { min: 96, max: 120, level: 'MARKED', labelEn: 'Marked', labelAr: '\u0645\u0644\u062d\u0648\u0638' },
  { min: 121, max: 210, level: 'SEVERE', labelEn: 'Severe', labelAr: '\u0634\u062f\u064a\u062f' },
];

export const PANSS: ScaleDefinition = {
  key: 'PANSS',
  nameEn: 'PANSS (Positive and Negative Syndrome Scale)',
  nameAr: '\u0645\u0642\u064a\u0627\u0633 \u0627\u0644\u0645\u062a\u0644\u0627\u0632\u0645\u0629 \u0627\u0644\u0625\u064a\u062c\u0627\u0628\u064a\u0629 \u0648\u0627\u0644\u0633\u0644\u0628\u064a\u0629',
  descriptionEn: 'Clinician-rated scale for schizophrenia symptom severity. Rate each item from 1 (absent) to 7 (extreme).',
  descriptionAr: '\u0645\u0642\u064a\u0627\u0633 \u064a\u0642\u064a\u0651\u0645\u0647 \u0627\u0644\u0637\u0628\u064a\u0628 \u0644\u0634\u062f\u0629 \u0623\u0639\u0631\u0627\u0636 \u0627\u0644\u0641\u0635\u0627\u0645. \u0642\u064a\u0651\u0645 \u0643\u0644 \u0639\u0646\u0635\u0631 \u0645\u0646 1 (\u063a\u0627\u0626\u0628) \u0625\u0644\u0649 7 (\u0634\u062f\u064a\u062f \u062c\u062f\u0627\u064b).',
  maxTotal: 210,
  severityThresholds: PANSS_THRESHOLDS,
  subscales: [
    { key: 'positive', nameEn: 'Positive Scale', nameAr: '\u0627\u0644\u0645\u0642\u064a\u0627\u0633 \u0627\u0644\u0625\u064a\u062c\u0627\u0628\u064a', itemNumbers: [1, 2, 3, 4, 5, 6, 7] },
    { key: 'negative', nameEn: 'Negative Scale', nameAr: '\u0627\u0644\u0645\u0642\u064a\u0627\u0633 \u0627\u0644\u0633\u0644\u0628\u064a', itemNumbers: [8, 9, 10, 11, 12, 13, 14] },
    { key: 'general', nameEn: 'General Psychopathology', nameAr: '\u0627\u0644\u0623\u0645\u0631\u0627\u0636 \u0627\u0644\u0646\u0641\u0633\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629', itemNumbers: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30] },
  ],
  items: [
    // Positive Scale (P1-P7)
    { number: 1, textEn: 'P1 - Delusions', textAr: 'P1 - \u0627\u0644\u0623\u0648\u0647\u0627\u0645', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 2, textEn: 'P2 - Conceptual disorganization', textAr: 'P2 - \u0627\u0644\u062a\u0641\u0643\u0643 \u0627\u0644\u0645\u0641\u0627\u0647\u064a\u0645\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 3, textEn: 'P3 - Hallucinatory behavior', textAr: 'P3 - \u0627\u0644\u0633\u0644\u0648\u0643 \u0627\u0644\u0647\u0644\u0648\u0633\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 4, textEn: 'P4 - Excitement', textAr: 'P4 - \u0627\u0644\u0625\u062b\u0627\u0631\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 5, textEn: 'P5 - Grandiosity', textAr: 'P5 - \u0627\u0644\u0639\u0638\u0645\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 6, textEn: 'P6 - Suspiciousness/persecution', textAr: 'P6 - \u0627\u0644\u0634\u0643 / \u0627\u0644\u0627\u0636\u0637\u0647\u0627\u062f', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 7, textEn: 'P7 - Hostility', textAr: 'P7 - \u0627\u0644\u0639\u062f\u0627\u0626\u064a\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    // Negative Scale (N1-N7)
    { number: 8, textEn: 'N1 - Blunted affect', textAr: 'N1 - \u0627\u0644\u0648\u062c\u062f\u0627\u0646 \u0627\u0644\u0645\u062a\u0628\u0644\u062f', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 9, textEn: 'N2 - Emotional withdrawal', textAr: 'N2 - \u0627\u0644\u0627\u0646\u0633\u062d\u0627\u0628 \u0627\u0644\u0639\u0627\u0637\u0641\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 10, textEn: 'N3 - Poor rapport', textAr: 'N3 - \u0636\u0639\u0641 \u0627\u0644\u062a\u0648\u0627\u0635\u0644', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 11, textEn: 'N4 - Passive/apathetic social withdrawal', textAr: 'N4 - \u0627\u0644\u0627\u0646\u0633\u062d\u0627\u0628 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a \u0627\u0644\u0633\u0644\u0628\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 12, textEn: 'N5 - Difficulty in abstract thinking', textAr: 'N5 - \u0635\u0639\u0648\u0628\u0629 \u0627\u0644\u062a\u0641\u0643\u064a\u0631 \u0627\u0644\u0645\u062c\u0631\u062f', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 13, textEn: 'N6 - Lack of spontaneity and flow of conversation', textAr: 'N6 - \u0627\u0646\u0639\u062f\u0627\u0645 \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a\u0629 \u0648\u0627\u0646\u0633\u064a\u0627\u0628 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 14, textEn: 'N7 - Stereotyped thinking', textAr: 'N7 - \u0627\u0644\u062a\u0641\u0643\u064a\u0631 \u0627\u0644\u0646\u0645\u0637\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    // General Psychopathology (G1-G16)
    { number: 15, textEn: 'G1 - Somatic concern', textAr: 'G1 - \u0627\u0644\u0642\u0644\u0642 \u0627\u0644\u062c\u0633\u0645\u0627\u0646\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 16, textEn: 'G2 - Anxiety', textAr: 'G2 - \u0627\u0644\u0642\u0644\u0642', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 17, textEn: 'G3 - Guilt feelings', textAr: 'G3 - \u0645\u0634\u0627\u0639\u0631 \u0627\u0644\u0630\u0646\u0628', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 18, textEn: 'G4 - Tension', textAr: 'G4 - \u0627\u0644\u062a\u0648\u062a\u0631', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 19, textEn: 'G5 - Mannerisms and posturing', textAr: 'G5 - \u0627\u0644\u0633\u0644\u0648\u0643\u064a\u0627\u062a \u0648\u0627\u0644\u0623\u0648\u0636\u0627\u0639', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 20, textEn: 'G6 - Depression', textAr: 'G6 - \u0627\u0644\u0627\u0643\u062a\u0626\u0627\u0628', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 21, textEn: 'G7 - Motor retardation', textAr: 'G7 - \u0627\u0644\u062a\u0623\u062e\u0631 \u0627\u0644\u062d\u0631\u0643\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 22, textEn: 'G8 - Uncooperativeness', textAr: 'G8 - \u0639\u062f\u0645 \u0627\u0644\u062a\u0639\u0627\u0648\u0646', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 23, textEn: 'G9 - Unusual thought content', textAr: 'G9 - \u0645\u062d\u062a\u0648\u0649 \u0641\u0643\u0631\u064a \u063a\u064a\u0631 \u0639\u0627\u062f\u064a', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 24, textEn: 'G10 - Disorientation', textAr: 'G10 - \u0627\u0644\u062a\u0634\u0648\u0634', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 25, textEn: 'G11 - Poor attention', textAr: 'G11 - \u0636\u0639\u0641 \u0627\u0644\u0627\u0646\u062a\u0628\u0627\u0647', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 26, textEn: 'G12 - Lack of judgment and insight', textAr: 'G12 - \u0627\u0646\u0639\u062f\u0627\u0645 \u0627\u0644\u062d\u0643\u0645 \u0648\u0627\u0644\u0628\u0635\u064a\u0631\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 27, textEn: 'G13 - Disturbance of volition', textAr: 'G13 - \u0627\u0636\u0637\u0631\u0627\u0628 \u0627\u0644\u0625\u0631\u0627\u062f\u0629', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 28, textEn: 'G14 - Poor impulse control', textAr: 'G14 - \u0636\u0639\u0641 \u0627\u0644\u062a\u062d\u0643\u0645 \u0641\u064a \u0627\u0644\u0627\u0646\u062f\u0641\u0627\u0639', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 29, textEn: 'G15 - Preoccupation', textAr: 'G15 - \u0627\u0644\u0627\u0646\u0634\u063a\u0627\u0644', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
    { number: 30, textEn: 'G16 - Active social avoidance', textAr: 'G16 - \u0627\u0644\u062a\u062c\u0646\u0628 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a \u0627\u0644\u0646\u0634\u0637', minValue: 1, maxValue: 7, options: PANSS_OPTIONS },
  ],
  score: (responses: number[]) => responses.reduce((s, v) => s + v, 0),
  subscaleScores: (responses: number[]) => {
    const positive = responses.slice(0, 7).reduce((s, v) => s + v, 0);
    const negative = responses.slice(7, 14).reduce((s, v) => s + v, 0);
    const general = responses.slice(14, 30).reduce((s, v) => s + v, 0);
    return [
      { subscale: 'positive', score: positive },
      { subscale: 'negative', score: negative },
      { subscale: 'general', score: general },
    ];
  },
  getSeverity: (total: number) => {
    // PANSS minimum is 30 (all items score 1)
    if (total < 30) return PANSS_THRESHOLDS[0];
    return findSeverity(PANSS_THRESHOLDS, total);
  },
};

/* ------------------------------------------------------------------ */
/*  Registry                                                           */
/* ------------------------------------------------------------------ */

export const SCALE_DEFINITIONS: Record<string, ScaleDefinition> = {
  PHQ9,
  GAD7,
  MADRS,
  AUDIT,
  PCL5,
  PANSS,
};

export const SCALE_KEYS = Object.keys(SCALE_DEFINITIONS) as Array<keyof typeof SCALE_DEFINITIONS>;

/**
 * Get a scale definition by key. Returns undefined if not found.
 */
export function getScaleDefinition(key: string): ScaleDefinition | undefined {
  return SCALE_DEFINITIONS[key.toUpperCase()];
}

/**
 * Score a set of responses for a given scale type.
 * Returns the total score, severity, and optional subscale scores.
 */
export function scoreScale(
  scaleType: string,
  responses: number[],
): {
  totalScore: number;
  severityLevel: string;
  severityLabel: string;
  severityLabelAr: string;
  subscaleScores?: { subscale: string; score: number }[];
} | null {
  const definition = getScaleDefinition(scaleType);
  if (!definition) return null;

  const totalScore = definition.score(responses);
  const severity = definition.getSeverity(totalScore);
  const subscales = definition.subscaleScores?.(responses);

  return {
    totalScore,
    severityLevel: severity.level,
    severityLabel: severity.labelEn,
    severityLabelAr: severity.labelAr,
    subscaleScores: subscales,
  };
}
