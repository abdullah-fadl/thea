/**
 * TNM Staging Definitions — AJCC 8th Edition
 *
 * Provides complete TNM category definitions, stage-grouping rules, and
 * biomarker field specifications for the 8 most-common cancer types.
 *
 * Reference: AJCC Cancer Staging Manual, 8th Edition (2017)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TnmCategory {
  value: string;
  labelEn: string;
  labelAr: string;
  description: string;
}

export interface StageGroupRule {
  t: string[];
  n: string[];
  m: string[];
  stage: string;
}

export interface BiomarkerField {
  key: string;
  label: string;
  labelAr: string;
  type: 'select' | 'number' | 'text';
  options?: string[];
}

export interface TnmDefinition {
  cancerType: string;
  labelEn: string;
  labelAr: string;
  tCategories: TnmCategory[];
  nCategories: TnmCategory[];
  mCategories: TnmCategory[];
  stageGrouping: StageGroupRule[];
  biomarkerFields: BiomarkerField[];
}

// ---------------------------------------------------------------------------
// Staging Types & Methods
// ---------------------------------------------------------------------------

export const STAGING_TYPES = [
  { value: 'CLINICAL', labelEn: 'Clinical (c)', labelAr: 'سريري (c)' },
  { value: 'PATHOLOGICAL', labelEn: 'Pathological (p)', labelAr: 'مرضي نسيجي (p)' },
  { value: 'POST_THERAPY', labelEn: 'Post-therapy (yp)', labelAr: 'بعد العلاج (yp)' },
];

export const STAGING_METHODS = [
  { value: 'IMAGING', labelEn: 'Imaging', labelAr: 'التصوير' },
  { value: 'BIOPSY', labelEn: 'Biopsy', labelAr: 'خزعة' },
  { value: 'SURGICAL', labelEn: 'Surgical', labelAr: 'جراحي' },
  { value: 'COMBINED', labelEn: 'Combined', labelAr: 'مشترك' },
];

export const STAGING_SYSTEMS = [
  { value: 'AJCC_8TH', labelEn: 'AJCC 8th Edition', labelAr: 'AJCC الإصدار الثامن' },
  { value: 'AJCC_7TH', labelEn: 'AJCC 7th Edition', labelAr: 'AJCC الإصدار السابع' },
];

// ---------------------------------------------------------------------------
// 1. BREAST
// ---------------------------------------------------------------------------

const BREAST: TnmDefinition = {
  cancerType: 'BREAST',
  labelEn: 'Breast Cancer',
  labelAr: 'سرطان الثدي',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ (DCIS)' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Tumor ≤ 20 mm' },
    { value: 'T1mi', labelEn: 'T1mi', labelAr: 'T1mi', description: 'Microinvasion ≤ 1 mm' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Tumor > 1 mm but ≤ 5 mm' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Tumor > 5 mm but ≤ 10 mm' },
    { value: 'T1c', labelEn: 'T1c', labelAr: 'T1c', description: 'Tumor > 10 mm but ≤ 20 mm' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor > 20 mm but ≤ 50 mm' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor > 50 mm' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor of any size with direct extension to chest wall and/or skin' },
    { value: 'T4a', labelEn: 'T4a', labelAr: 'T4a', description: 'Extension to chest wall' },
    { value: 'T4b', labelEn: 'T4b', labelAr: 'T4b', description: 'Ulceration or ipsilateral satellite nodules or edema of skin' },
    { value: 'T4c', labelEn: 'T4c', labelAr: 'T4c', description: 'Both T4a and T4b' },
    { value: 'T4d', labelEn: 'T4d', labelAr: 'T4d', description: 'Inflammatory carcinoma' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Metastasis in 1-3 axillary lymph nodes' },
    { value: 'N1mi', labelEn: 'N1mi', labelAr: 'N1mi', description: 'Micrometastasis (> 0.2 mm and/or > 200 cells)' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Metastasis in 4-9 axillary lymph nodes' },
    { value: 'N2a', labelEn: 'N2a', labelAr: 'N2a', description: 'Metastasis in 4-9 axillary lymph nodes (at least one > 2 mm)' },
    { value: 'N2b', labelEn: 'N2b', labelAr: 'N2b', description: 'Clinically detected internal mammary nodes without axillary nodes' },
    { value: 'N3', labelEn: 'N3', labelAr: 'N3', description: 'Metastasis in ≥ 10 axillary lymph nodes or infraclavicular or supraclavicular' },
    { value: 'N3a', labelEn: 'N3a', labelAr: 'N3a', description: '≥ 10 axillary nodes or infraclavicular nodes' },
    { value: 'N3b', labelEn: 'N3b', labelAr: 'N3b', description: 'Clinically detected internal mammary with axillary nodes' },
    { value: 'N3c', labelEn: 'N3c', labelAr: 'N3c', description: 'Ipsilateral supraclavicular lymph nodes' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis detected' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c'], n: ['N0'], m: ['M0'], stage: 'IA' },
    { t: ['T0', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c'], n: ['N1mi'], m: ['M0'], stage: 'IB' },
    { t: ['T0', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c'], n: ['N1'], m: ['M0'], stage: 'IIA' },
    { t: ['T2'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T2'], n: ['N1'], m: ['M0'], stage: 'IIB' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'IIB' },
    { t: ['T0', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2'], n: ['N2', 'N2a', 'N2b'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3'], n: ['N1', 'N2', 'N2a', 'N2b'], m: ['M0'], stage: 'IIIA' },
    { t: ['T4', 'T4a', 'T4b', 'T4c', 'T4d'], n: ['N0', 'N1', 'N2', 'N2a', 'N2b'], m: ['M0'], stage: 'IIIB' },
    { t: ['T0', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T3', 'T4', 'T4a', 'T4b', 'T4c', 'T4d'], n: ['N3', 'N3a', 'N3b', 'N3c'], m: ['M0'], stage: 'IIIC' },
    { t: ['T0', 'Tis', 'T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T3', 'T4', 'T4a', 'T4b', 'T4c', 'T4d'], n: ['N0', 'N1', 'N1mi', 'N2', 'N2a', 'N2b', 'N3', 'N3a', 'N3b', 'N3c'], m: ['M1'], stage: 'IV' },
  ],
  biomarkerFields: [
    { key: 'er', label: 'ER Status', labelAr: 'حالة ER', type: 'select', options: ['Positive', 'Negative'] },
    { key: 'pr', label: 'PR Status', labelAr: 'حالة PR', type: 'select', options: ['Positive', 'Negative'] },
    { key: 'her2', label: 'HER2 Status', labelAr: 'حالة HER2', type: 'select', options: ['Positive', 'Negative', 'Equivocal'] },
    { key: 'ki67', label: 'Ki-67 (%)', labelAr: 'Ki-67 (%)', type: 'number' },
    { key: 'oncotype_dx', label: 'Oncotype DX Score', labelAr: 'نقاط Oncotype DX', type: 'number' },
  ],
};

// ---------------------------------------------------------------------------
// 2. LUNG NSCLC
// ---------------------------------------------------------------------------

const LUNG_NSCLC: TnmDefinition = {
  cancerType: 'LUNG_NSCLC',
  labelEn: 'Non-Small Cell Lung Cancer',
  labelAr: 'سرطان الرئة غير صغير الخلايا',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Tumor ≤ 3 cm, surrounded by lung/visceral pleura' },
    { value: 'T1mi', labelEn: 'T1mi', labelAr: 'T1mi', description: 'Minimally invasive adenocarcinoma' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Tumor ≤ 1 cm' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Tumor > 1 cm but ≤ 2 cm' },
    { value: 'T1c', labelEn: 'T1c', labelAr: 'T1c', description: 'Tumor > 2 cm but ≤ 3 cm' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor > 3 cm but ≤ 5 cm' },
    { value: 'T2a', labelEn: 'T2a', labelAr: 'T2a', description: 'Tumor > 3 cm but ≤ 4 cm' },
    { value: 'T2b', labelEn: 'T2b', labelAr: 'T2b', description: 'Tumor > 4 cm but ≤ 5 cm' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor > 5 cm but ≤ 7 cm or invades chest wall/phrenic nerve/parietal pericardium' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor > 7 cm or invades mediastinum/diaphragm/heart/great vessels/trachea/esophagus/vertebral body/carina' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Ipsilateral peribronchial and/or hilar lymph nodes' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Ipsilateral mediastinal and/or subcarinal lymph nodes' },
    { value: 'N3', labelEn: 'N3', labelAr: 'N3', description: 'Contralateral mediastinal/hilar or scalene/supraclavicular nodes' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
    { value: 'M1a', labelEn: 'M1a', labelAr: 'M1a', description: 'Separate tumor nodule in contralateral lobe or pleural/pericardial nodules or malignant effusion' },
    { value: 'M1b', labelEn: 'M1b', labelAr: 'M1b', description: 'Single extrathoracic metastasis' },
    { value: 'M1c', labelEn: 'M1c', labelAr: 'M1c', description: 'Multiple extrathoracic metastases in one or more organs' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T1mi', 'T1a'], n: ['N0'], m: ['M0'], stage: 'IA1' },
    { t: ['T1b'], n: ['N0'], m: ['M0'], stage: 'IA2' },
    { t: ['T1c'], n: ['N0'], m: ['M0'], stage: 'IA3' },
    { t: ['T2', 'T2a'], n: ['N0'], m: ['M0'], stage: 'IB' },
    { t: ['T2b'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b'], n: ['N1'], m: ['M0'], stage: 'IIB' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'IIB' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b'], n: ['N2'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3'], n: ['N1'], m: ['M0'], stage: 'IIIA' },
    { t: ['T4'], n: ['N0', 'N1'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3', 'T4'], n: ['N2'], m: ['M0'], stage: 'IIIB' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b'], n: ['N3'], m: ['M0'], stage: 'IIIB' },
    { t: ['T3', 'T4'], n: ['N3'], m: ['M0'], stage: 'IIIC' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T3', 'T4', 'Tis'], n: ['N0', 'N1', 'N2', 'N3'], m: ['M1', 'M1a'], stage: 'IVA' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T3', 'T4', 'Tis'], n: ['N0', 'N1', 'N2', 'N3'], m: ['M1b'], stage: 'IVA' },
    { t: ['T1', 'T1mi', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T3', 'T4', 'Tis'], n: ['N0', 'N1', 'N2', 'N3'], m: ['M1c'], stage: 'IVB' },
  ],
  biomarkerFields: [
    { key: 'egfr', label: 'EGFR Mutation', labelAr: 'طفرة EGFR', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
    { key: 'alk', label: 'ALK Rearrangement', labelAr: 'إعادة ترتيب ALK', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
    { key: 'pdl1', label: 'PD-L1 TPS (%)', labelAr: 'PD-L1 TPS (%)', type: 'number' },
    { key: 'ros1', label: 'ROS1 Rearrangement', labelAr: 'إعادة ترتيب ROS1', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
    { key: 'kras', label: 'KRAS Mutation', labelAr: 'طفرة KRAS', type: 'select', options: ['G12C', 'Other', 'Negative', 'Not Tested'] },
    { key: 'braf', label: 'BRAF Mutation', labelAr: 'طفرة BRAF', type: 'select', options: ['V600E', 'Other', 'Negative', 'Not Tested'] },
  ],
};

// ---------------------------------------------------------------------------
// 3. COLORECTAL
// ---------------------------------------------------------------------------

const COLORECTAL: TnmDefinition = {
  cancerType: 'COLORECTAL',
  labelEn: 'Colorectal Cancer',
  labelAr: 'سرطان القولون والمستقيم',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ / intramucosal carcinoma' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Tumor invades submucosa' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor invades muscularis propria' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor invades through muscularis propria into pericolorectal tissues' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor invades visceral peritoneum or adjacent organs' },
    { value: 'T4a', labelEn: 'T4a', labelAr: 'T4a', description: 'Tumor penetrates visceral peritoneum' },
    { value: 'T4b', labelEn: 'T4b', labelAr: 'T4b', description: 'Tumor directly invades or is adherent to adjacent organs/structures' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Metastasis in 1-3 regional lymph nodes' },
    { value: 'N1a', labelEn: 'N1a', labelAr: 'N1a', description: 'Metastasis in 1 regional lymph node' },
    { value: 'N1b', labelEn: 'N1b', labelAr: 'N1b', description: 'Metastasis in 2-3 regional lymph nodes' },
    { value: 'N1c', labelEn: 'N1c', labelAr: 'N1c', description: 'Tumor deposit(s) in subserosa/mesentery without regional nodal metastasis' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Metastasis in ≥ 4 regional lymph nodes' },
    { value: 'N2a', labelEn: 'N2a', labelAr: 'N2a', description: 'Metastasis in 4-6 regional lymph nodes' },
    { value: 'N2b', labelEn: 'N2b', labelAr: 'N2b', description: 'Metastasis in ≥ 7 regional lymph nodes' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
    { value: 'M1a', labelEn: 'M1a', labelAr: 'M1a', description: 'Metastasis confined to one site/organ without peritoneal metastasis' },
    { value: 'M1b', labelEn: 'M1b', labelAr: 'M1b', description: 'Metastasis to two or more sites/organs without peritoneal metastasis' },
    { value: 'M1c', labelEn: 'M1c', labelAr: 'M1c', description: 'Peritoneal metastasis with or without other organ involvement' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T2'], n: ['N0'], m: ['M0'], stage: 'I' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T4', 'T4a'], n: ['N0'], m: ['M0'], stage: 'IIB' },
    { t: ['T4b'], n: ['N0'], m: ['M0'], stage: 'IIC' },
    { t: ['T1', 'T2'], n: ['N1', 'N1a', 'N1b', 'N1c'], m: ['M0'], stage: 'IIIA' },
    { t: ['T1'], n: ['N2', 'N2a'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3', 'T4', 'T4a'], n: ['N1', 'N1a', 'N1b', 'N1c'], m: ['M0'], stage: 'IIIB' },
    { t: ['T2', 'T3'], n: ['N2', 'N2a'], m: ['M0'], stage: 'IIIB' },
    { t: ['T1', 'T2'], n: ['N2b'], m: ['M0'], stage: 'IIIB' },
    { t: ['T4', 'T4a'], n: ['N2', 'N2a', 'N2b'], m: ['M0'], stage: 'IIIC' },
    { t: ['T3'], n: ['N2b'], m: ['M0'], stage: 'IIIC' },
    { t: ['T4b'], n: ['N1', 'N1a', 'N1b', 'N1c', 'N2', 'N2a', 'N2b'], m: ['M0'], stage: 'IIIC' },
    { t: ['Tis', 'T1', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N0', 'N1', 'N1a', 'N1b', 'N1c', 'N2', 'N2a', 'N2b'], m: ['M1', 'M1a'], stage: 'IVA' },
    { t: ['Tis', 'T1', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N0', 'N1', 'N1a', 'N1b', 'N1c', 'N2', 'N2a', 'N2b'], m: ['M1b'], stage: 'IVB' },
    { t: ['Tis', 'T1', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N0', 'N1', 'N1a', 'N1b', 'N1c', 'N2', 'N2a', 'N2b'], m: ['M1c'], stage: 'IVC' },
  ],
  biomarkerFields: [
    { key: 'cea', label: 'CEA (ng/mL)', labelAr: 'CEA (نانوغرام/مل)', type: 'number' },
    { key: 'msi', label: 'MSI Status', labelAr: 'حالة MSI', type: 'select', options: ['MSI-H', 'MSI-L', 'MSS', 'Not Tested'] },
    { key: 'kras', label: 'KRAS Mutation', labelAr: 'طفرة KRAS', type: 'select', options: ['Mutant', 'Wild-type', 'Not Tested'] },
    { key: 'nras', label: 'NRAS Mutation', labelAr: 'طفرة NRAS', type: 'select', options: ['Mutant', 'Wild-type', 'Not Tested'] },
    { key: 'braf', label: 'BRAF V600E', labelAr: 'BRAF V600E', type: 'select', options: ['Mutant', 'Wild-type', 'Not Tested'] },
    { key: 'her2_crc', label: 'HER2 Amplification', labelAr: 'تضخيم HER2', type: 'select', options: ['Amplified', 'Not Amplified', 'Not Tested'] },
  ],
};

// ---------------------------------------------------------------------------
// 4. PROSTATE
// ---------------------------------------------------------------------------

const PROSTATE: TnmDefinition = {
  cancerType: 'PROSTATE',
  labelEn: 'Prostate Cancer',
  labelAr: 'سرطان البروستاتا',
  tCategories: [
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Clinically inapparent, not palpable' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Incidental histologic finding in ≤ 5% of tissue resected' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Incidental histologic finding in > 5% of tissue resected' },
    { value: 'T1c', labelEn: 'T1c', labelAr: 'T1c', description: 'Identified by needle biopsy (e.g., elevated PSA)' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor confined within prostate' },
    { value: 'T2a', labelEn: 'T2a', labelAr: 'T2a', description: 'Involves one-half of one lobe or less' },
    { value: 'T2b', labelEn: 'T2b', labelAr: 'T2b', description: 'Involves more than one-half of one lobe but not both lobes' },
    { value: 'T2c', labelEn: 'T2c', labelAr: 'T2c', description: 'Involves both lobes' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Extraprostatic extension' },
    { value: 'T3a', labelEn: 'T3a', labelAr: 'T3a', description: 'Extraprostatic extension (unilateral or bilateral)' },
    { value: 'T3b', labelEn: 'T3b', labelAr: 'T3b', description: 'Invades seminal vesicle(s)' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Fixed or invades adjacent structures (bladder, levator, pelvic wall)' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No positive regional nodes' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Metastasis in regional node(s)' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
    { value: 'M1a', labelEn: 'M1a', labelAr: 'M1a', description: 'Non-regional lymph node(s)' },
    { value: 'M1b', labelEn: 'M1b', labelAr: 'M1b', description: 'Bone(s)' },
    { value: 'M1c', labelEn: 'M1c', labelAr: 'M1c', description: 'Other site(s) with or without bone disease' },
  ],
  stageGrouping: [
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a'], n: ['N0'], m: ['M0'], stage: 'I' },
    { t: ['T2b', 'T2c'], n: ['N0'], m: ['M0'], stage: 'II' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T2c'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T3', 'T3a', 'T3b'], n: ['N0'], m: ['M0'], stage: 'IIIA' },
    { t: ['T4'], n: ['N0'], m: ['M0'], stage: 'IIIB' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T2c', 'T3', 'T3a', 'T3b', 'T4'], n: ['N1'], m: ['M0'], stage: 'IIIC' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T2c', 'T3', 'T3a', 'T3b', 'T4'], n: ['N0', 'N1'], m: ['M1', 'M1a'], stage: 'IVA' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T2a', 'T2b', 'T2c', 'T3', 'T3a', 'T3b', 'T4'], n: ['N0', 'N1'], m: ['M1b', 'M1c'], stage: 'IVB' },
  ],
  biomarkerFields: [
    { key: 'psa', label: 'PSA (ng/mL)', labelAr: 'PSA (نانوغرام/مل)', type: 'number' },
    { key: 'gleason_primary', label: 'Gleason Primary Pattern', labelAr: 'نمط جليسون الأساسي', type: 'select', options: ['1', '2', '3', '4', '5'] },
    { key: 'gleason_secondary', label: 'Gleason Secondary Pattern', labelAr: 'نمط جليسون الثانوي', type: 'select', options: ['1', '2', '3', '4', '5'] },
    { key: 'gleason_score', label: 'Gleason Score (Total)', labelAr: 'مجموع جليسون', type: 'text' },
    { key: 'isup_grade', label: 'ISUP Grade Group', labelAr: 'مجموعة درجة ISUP', type: 'select', options: ['1', '2', '3', '4', '5'] },
  ],
};

// ---------------------------------------------------------------------------
// 5. GASTRIC (Stomach)
// ---------------------------------------------------------------------------

const GASTRIC: TnmDefinition = {
  cancerType: 'GASTRIC',
  labelEn: 'Gastric (Stomach) Cancer',
  labelAr: 'سرطان المعدة',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ / high-grade dysplasia' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Tumor invades lamina propria, muscularis mucosae, or submucosa' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Tumor invades lamina propria or muscularis mucosae' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Tumor invades submucosa' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor invades muscularis propria' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor penetrates subserosal connective tissue without invasion of visceral peritoneum or adjacent structures' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor invades serosa or adjacent structures' },
    { value: 'T4a', labelEn: 'T4a', labelAr: 'T4a', description: 'Tumor invades serosa (visceral peritoneum)' },
    { value: 'T4b', labelEn: 'T4b', labelAr: 'T4b', description: 'Tumor invades adjacent structures/organs' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Metastasis in 1-2 regional lymph nodes' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Metastasis in 3-6 regional lymph nodes' },
    { value: 'N3', labelEn: 'N3', labelAr: 'N3', description: 'Metastasis in ≥ 7 regional lymph nodes' },
    { value: 'N3a', labelEn: 'N3a', labelAr: 'N3a', description: 'Metastasis in 7-15 regional lymph nodes' },
    { value: 'N3b', labelEn: 'N3b', labelAr: 'N3b', description: 'Metastasis in ≥ 16 regional lymph nodes' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T1a', 'T1b'], n: ['N0'], m: ['M0'], stage: 'IA' },
    { t: ['T1', 'T1a', 'T1b'], n: ['N1'], m: ['M0'], stage: 'IB' },
    { t: ['T2'], n: ['N0'], m: ['M0'], stage: 'IB' },
    { t: ['T1', 'T1a', 'T1b'], n: ['N2'], m: ['M0'], stage: 'IIA' },
    { t: ['T2'], n: ['N1'], m: ['M0'], stage: 'IIA' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T1', 'T1a', 'T1b'], n: ['N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IIB' },
    { t: ['T2'], n: ['N2'], m: ['M0'], stage: 'IIB' },
    { t: ['T3'], n: ['N1'], m: ['M0'], stage: 'IIB' },
    { t: ['T4', 'T4a'], n: ['N0'], m: ['M0'], stage: 'IIB' },
    { t: ['T2'], n: ['N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3'], n: ['N2'], m: ['M0'], stage: 'IIIA' },
    { t: ['T4', 'T4a'], n: ['N1', 'N2'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3'], n: ['N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IIIB' },
    { t: ['T4', 'T4a'], n: ['N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IIIB' },
    { t: ['T4b'], n: ['N0', 'N1', 'N2', 'N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IIIB' },
    { t: ['Tis', 'T1', 'T1a', 'T1b', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N0', 'N1', 'N2', 'N3', 'N3a', 'N3b'], m: ['M1'], stage: 'IV' },
  ],
  biomarkerFields: [
    { key: 'her2_gastric', label: 'HER2 Status', labelAr: 'حالة HER2', type: 'select', options: ['Positive (3+)', 'Equivocal (2+)', 'Negative', 'Not Tested'] },
    { key: 'pdl1_cps', label: 'PD-L1 CPS', labelAr: 'PD-L1 CPS', type: 'number' },
    { key: 'msi_gastric', label: 'MSI Status', labelAr: 'حالة MSI', type: 'select', options: ['MSI-H', 'MSS', 'Not Tested'] },
    { key: 'ebv', label: 'EBV Status', labelAr: 'حالة EBV', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
  ],
};

// ---------------------------------------------------------------------------
// 6. HEAD & NECK SCC (Oropharynx p16-negative / general H&N SCC)
// ---------------------------------------------------------------------------

const HEAD_NECK_SCC: TnmDefinition = {
  cancerType: 'HEAD_NECK_SCC',
  labelEn: 'Head & Neck Squamous Cell Carcinoma',
  labelAr: 'سرطان الخلايا الحرشفية في الرأس والعنق',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Tumor ≤ 2 cm' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor > 2 cm but ≤ 4 cm' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor > 4 cm or extension to lingual surface of epiglottis' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Moderately advanced or very advanced local disease' },
    { value: 'T4a', labelEn: 'T4a', labelAr: 'T4a', description: 'Moderately advanced — invades larynx, deep/extrinsic tongue muscle, medial pterygoid, hard palate, or mandible' },
    { value: 'T4b', labelEn: 'T4b', labelAr: 'T4b', description: 'Very advanced — invades lateral pterygoid, pterygoid plates, lateral nasopharynx, skull base, or encases carotid artery' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Single ipsilateral node ≤ 3 cm without ENE' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Single ipsilateral node > 3-6 cm or multiple ipsilateral/bilateral/contralateral ≤ 6 cm' },
    { value: 'N2a', labelEn: 'N2a', labelAr: 'N2a', description: 'Single ipsilateral node > 3 cm but ≤ 6 cm without ENE' },
    { value: 'N2b', labelEn: 'N2b', labelAr: 'N2b', description: 'Multiple ipsilateral nodes ≤ 6 cm without ENE' },
    { value: 'N2c', labelEn: 'N2c', labelAr: 'N2c', description: 'Bilateral or contralateral nodes ≤ 6 cm without ENE' },
    { value: 'N3', labelEn: 'N3', labelAr: 'N3', description: 'Node > 6 cm or any node with ENE' },
    { value: 'N3a', labelEn: 'N3a', labelAr: 'N3a', description: 'Node > 6 cm without ENE' },
    { value: 'N3b', labelEn: 'N3b', labelAr: 'N3b', description: 'Any node with clinically overt ENE' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1'], n: ['N0'], m: ['M0'], stage: 'I' },
    { t: ['T2'], n: ['N0'], m: ['M0'], stage: 'II' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'III' },
    { t: ['T1', 'T2', 'T3'], n: ['N1'], m: ['M0'], stage: 'III' },
    { t: ['T4', 'T4a'], n: ['N0', 'N1'], m: ['M0'], stage: 'IVA' },
    { t: ['T1', 'T2', 'T3', 'T4', 'T4a'], n: ['N2', 'N2a', 'N2b', 'N2c'], m: ['M0'], stage: 'IVA' },
    { t: ['T4b'], n: ['N0', 'N1', 'N2', 'N2a', 'N2b', 'N2c'], m: ['M0'], stage: 'IVB' },
    { t: ['T1', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N3', 'N3a', 'N3b'], m: ['M0'], stage: 'IVB' },
    { t: ['Tis', 'T1', 'T2', 'T3', 'T4', 'T4a', 'T4b'], n: ['N0', 'N1', 'N2', 'N2a', 'N2b', 'N2c', 'N3', 'N3a', 'N3b'], m: ['M1'], stage: 'IVC' },
  ],
  biomarkerFields: [
    { key: 'p16', label: 'p16 (HPV) Status', labelAr: 'حالة p16 (HPV)', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
    { key: 'hpv_pcr', label: 'HPV PCR', labelAr: 'HPV PCR', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
    { key: 'egfr_hn', label: 'EGFR Expression', labelAr: 'تعبير EGFR', type: 'select', options: ['Overexpressed', 'Normal', 'Not Tested'] },
  ],
};

// ---------------------------------------------------------------------------
// 7. PANCREATIC
// ---------------------------------------------------------------------------

const PANCREATIC: TnmDefinition = {
  cancerType: 'PANCREATIC',
  labelEn: 'Pancreatic Cancer',
  labelAr: 'سرطان البنكرياس',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ (includes PanIN-3)' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Maximum tumor dimension ≤ 2 cm' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Maximum tumor dimension ≤ 0.5 cm' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Maximum tumor dimension > 0.5 cm and < 1 cm' },
    { value: 'T1c', labelEn: 'T1c', labelAr: 'T1c', description: 'Maximum tumor dimension 1-2 cm' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Maximum tumor dimension > 2 cm but ≤ 4 cm' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Maximum tumor dimension > 4 cm' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor involves celiac axis, SMA, and/or common hepatic artery' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Metastasis in 1-3 regional lymph nodes' },
    { value: 'N2', labelEn: 'N2', labelAr: 'N2', description: 'Metastasis in ≥ 4 regional lymph nodes' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T1a', 'T1b', 'T1c'], n: ['N0'], m: ['M0'], stage: 'IA' },
    { t: ['T2'], n: ['N0'], m: ['M0'], stage: 'IB' },
    { t: ['T3'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T3'], n: ['N1'], m: ['M0'], stage: 'IIB' },
    { t: ['T1', 'T1a', 'T1b', 'T1c', 'T2', 'T3'], n: ['N2'], m: ['M0'], stage: 'III' },
    { t: ['T4'], n: ['N0', 'N1', 'N2'], m: ['M0'], stage: 'III' },
    { t: ['Tis', 'T1', 'T1a', 'T1b', 'T1c', 'T2', 'T3', 'T4'], n: ['N0', 'N1', 'N2'], m: ['M1'], stage: 'IV' },
  ],
  biomarkerFields: [
    { key: 'ca199', label: 'CA 19-9 (U/mL)', labelAr: 'CA 19-9 (وحدة/مل)', type: 'number' },
    { key: 'brca_panc', label: 'BRCA1/2 Mutation', labelAr: 'طفرة BRCA1/2', type: 'select', options: ['BRCA1 Mutant', 'BRCA2 Mutant', 'Wild-type', 'Not Tested'] },
    { key: 'kras_panc', label: 'KRAS Mutation', labelAr: 'طفرة KRAS', type: 'select', options: ['Mutant', 'Wild-type', 'Not Tested'] },
    { key: 'msi_panc', label: 'MSI/dMMR Status', labelAr: 'حالة MSI/dMMR', type: 'select', options: ['MSI-H / dMMR', 'MSS / pMMR', 'Not Tested'] },
    { key: 'ntrk', label: 'NTRK Fusion', labelAr: 'اندماج NTRK', type: 'select', options: ['Positive', 'Negative', 'Not Tested'] },
  ],
};

// ---------------------------------------------------------------------------
// 8. CERVICAL
// ---------------------------------------------------------------------------

const CERVICAL: TnmDefinition = {
  cancerType: 'CERVICAL',
  labelEn: 'Cervical Cancer',
  labelAr: 'سرطان عنق الرحم',
  tCategories: [
    { value: 'Tis', labelEn: 'Tis', labelAr: 'Tis', description: 'Carcinoma in situ (pre-invasive)' },
    { value: 'T1', labelEn: 'T1', labelAr: 'T1', description: 'Cervical carcinoma confined to uterus' },
    { value: 'T1a', labelEn: 'T1a', labelAr: 'T1a', description: 'Invasive carcinoma diagnosed only by microscopy, max depth ≤ 5 mm' },
    { value: 'T1a1', labelEn: 'T1a1', labelAr: 'T1a1', description: 'Stromal invasion ≤ 3 mm in depth' },
    { value: 'T1a2', labelEn: 'T1a2', labelAr: 'T1a2', description: 'Stromal invasion > 3 mm and ≤ 5 mm in depth' },
    { value: 'T1b', labelEn: 'T1b', labelAr: 'T1b', description: 'Clinically visible lesion or microscopic lesion > T1a2' },
    { value: 'T1b1', labelEn: 'T1b1', labelAr: 'T1b1', description: 'Clinically visible lesion ≤ 2 cm' },
    { value: 'T1b2', labelEn: 'T1b2', labelAr: 'T1b2', description: 'Clinically visible lesion > 2 cm but ≤ 4 cm' },
    { value: 'T1b3', labelEn: 'T1b3', labelAr: 'T1b3', description: 'Clinically visible lesion > 4 cm' },
    { value: 'T2', labelEn: 'T2', labelAr: 'T2', description: 'Tumor invades beyond uterus but not to pelvic wall or lower third of vagina' },
    { value: 'T2a', labelEn: 'T2a', labelAr: 'T2a', description: 'Without parametrial invasion' },
    { value: 'T2a1', labelEn: 'T2a1', labelAr: 'T2a1', description: 'Clinically visible lesion ≤ 4 cm' },
    { value: 'T2a2', labelEn: 'T2a2', labelAr: 'T2a2', description: 'Clinically visible lesion > 4 cm' },
    { value: 'T2b', labelEn: 'T2b', labelAr: 'T2b', description: 'With parametrial invasion' },
    { value: 'T3', labelEn: 'T3', labelAr: 'T3', description: 'Tumor extends to pelvic wall and/or involves lower third of vagina and/or causes hydronephrosis' },
    { value: 'T3a', labelEn: 'T3a', labelAr: 'T3a', description: 'Involves lower third of vagina without extension to pelvic wall' },
    { value: 'T3b', labelEn: 'T3b', labelAr: 'T3b', description: 'Extends to pelvic wall and/or causes hydronephrosis or non-functioning kidney' },
    { value: 'T4', labelEn: 'T4', labelAr: 'T4', description: 'Tumor invades mucosa of bladder or rectum and/or extends beyond true pelvis' },
  ],
  nCategories: [
    { value: 'N0', labelEn: 'N0', labelAr: 'N0', description: 'No regional lymph node metastasis' },
    { value: 'N1', labelEn: 'N1', labelAr: 'N1', description: 'Regional lymph node metastasis' },
  ],
  mCategories: [
    { value: 'M0', labelEn: 'M0', labelAr: 'M0', description: 'No distant metastasis' },
    { value: 'M1', labelEn: 'M1', labelAr: 'M1', description: 'Distant metastasis (including peritoneal spread, supraclavicular or mediastinal nodes, lung, liver, or bone)' },
  ],
  stageGrouping: [
    { t: ['Tis'], n: ['N0'], m: ['M0'], stage: '0' },
    { t: ['T1', 'T1a', 'T1a1', 'T1a2'], n: ['N0'], m: ['M0'], stage: 'IA' },
    { t: ['T1b', 'T1b1', 'T1b2'], n: ['N0'], m: ['M0'], stage: 'IB' },
    { t: ['T1b3'], n: ['N0'], m: ['M0'], stage: 'IB3' },
    { t: ['T2', 'T2a', 'T2a1', 'T2a2'], n: ['N0'], m: ['M0'], stage: 'IIA' },
    { t: ['T2b'], n: ['N0'], m: ['M0'], stage: 'IIB' },
    { t: ['T1', 'T1a', 'T1a1', 'T1a2', 'T1b', 'T1b1', 'T1b2', 'T1b3', 'T2', 'T2a', 'T2a1', 'T2a2', 'T2b'], n: ['N1'], m: ['M0'], stage: 'IIIC' },
    { t: ['T3', 'T3a'], n: ['N0'], m: ['M0'], stage: 'IIIA' },
    { t: ['T3b'], n: ['N0'], m: ['M0'], stage: 'IIIB' },
    { t: ['T3', 'T3a', 'T3b'], n: ['N1'], m: ['M0'], stage: 'IIIC' },
    { t: ['T4'], n: ['N0', 'N1'], m: ['M0'], stage: 'IVA' },
    { t: ['Tis', 'T1', 'T1a', 'T1a1', 'T1a2', 'T1b', 'T1b1', 'T1b2', 'T1b3', 'T2', 'T2a', 'T2a1', 'T2a2', 'T2b', 'T3', 'T3a', 'T3b', 'T4'], n: ['N0', 'N1'], m: ['M1'], stage: 'IVB' },
  ],
  biomarkerFields: [
    { key: 'hpv_type', label: 'HPV Type', labelAr: 'نوع HPV', type: 'select', options: ['HPV 16', 'HPV 18', 'Other HR-HPV', 'Negative', 'Not Tested'] },
    { key: 'pdl1_cerv', label: 'PD-L1 CPS', labelAr: 'PD-L1 CPS', type: 'number' },
    { key: 'scc_antigen', label: 'SCC Antigen (ng/mL)', labelAr: 'مستضد SCC (نانوغرام/مل)', type: 'number' },
  ],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const TNM_CANCER_TYPES: TnmDefinition[] = [
  BREAST,
  LUNG_NSCLC,
  COLORECTAL,
  PROSTATE,
  GASTRIC,
  HEAD_NECK_SCC,
  PANCREATIC,
  CERVICAL,
];

/**
 * Look up the full TNM definition for a given cancer type key.
 */
export function getTnmDefinition(cancerType: string): TnmDefinition | undefined {
  return TNM_CANCER_TYPES.find((d) => d.cancerType === cancerType);
}

/**
 * Auto-calculate the AJCC stage group from T + N + M categories.
 *
 * The function iterates through the stage-grouping rules for the given cancer
 * type and returns the first matching stage. Rules are ordered from earliest
 * stage to latest so the first match is the most specific one.
 *
 * @returns The stage-group string (e.g. "IIA") or `null` when no rule matches.
 */
export function calculateStageGroup(
  cancerType: string,
  t: string,
  n: string,
  m: string,
  _biomarkers?: Record<string, unknown>,
): string | null {
  const def = getTnmDefinition(cancerType);
  if (!def) return null;

  for (const rule of def.stageGrouping) {
    if (rule.t.includes(t) && rule.n.includes(n) && rule.m.includes(m)) {
      return rule.stage;
    }
  }

  // Fallback: any M1 variant is at least stage IV
  if (m.startsWith('M1')) return 'IV';

  return null;
}
