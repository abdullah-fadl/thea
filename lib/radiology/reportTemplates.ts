/**
 * Radiology Report Templates for Thea EHR
 *
 * Pre-built templates for common radiology studies. Each template includes
 * bilingual section headings and default text that radiologists can customise.
 */

export type Modality = 'XR' | 'CT' | 'MRI' | 'US' | 'NM' | 'FLUORO';

export interface ReportTemplateSection {
  title: { ar: string; en: string };
  defaultText: { ar: string; en: string };
}

export interface ReportTemplate {
  id: string;
  modality: Modality;
  bodyPart: string;
  templateName: { ar: string; en: string };
  sections: ReportTemplateSection[];
}

// ---------------------------------------------------------------------------
// 1. Chest X-Ray (PA/Lateral)
// ---------------------------------------------------------------------------

const chestXRay: ReportTemplate = {
  id: 'tmpl_chest_xr',
  modality: 'XR',
  bodyPart: 'chest',
  templateName: {
    ar: 'أشعة سينية للصدر (أمامي خلفي / جانبي)',
    en: 'Chest X-Ray (PA/Lateral)',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'المقارنة', en: 'Comparison' },
      defaultText: {
        ar: 'لا توجد صور سابقة للمقارنة.',
        en: 'No prior imaging available for comparison.',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'القلب: حجم القلب طبيعي.\nالرئتان: الرئتان صافيتان بدون ارتشاح أو انصباب.\nالمنصف: المنصف في وضعه الطبيعي.\nالعظام: لا توجد آفات عظمية واضحة.\nالحجاب الحاجز: الأغشية الحجابية واضحة.',
        en: 'Heart: Normal cardiac silhouette.\nLungs: Clear lungs without infiltrate or effusion.\nMediastinum: Normal mediastinal contour.\nBones: No acute osseous abnormality.\nDiaphragm: Clear costophrenic angles bilaterally.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'أشعة صدرية طبيعية.',
        en: 'Normal chest radiograph.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Abdominal Ultrasound
// ---------------------------------------------------------------------------

const abdominalUS: ReportTemplate = {
  id: 'tmpl_abd_us',
  modality: 'US',
  bodyPart: 'abdomen',
  templateName: {
    ar: 'أشعة صوتية للبطن',
    en: 'Abdominal Ultrasound',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'الكبد: حجم طبيعي ومتجانس البنية. لا توجد آفات بؤرية.\nالمرارة: طبيعية بدون حصوات أو سماكة في الجدار.\nالقنوات الصفراوية: غير متوسعة.\nالبنكرياس: طبيعي قدر الإمكان رؤيته.\nالطحال: حجم طبيعي ومتجانس.\nالكلية اليمنى: حجم طبيعي بدون حصوات أو استسقاء.\nالكلية اليسرى: حجم طبيعي بدون حصوات أو استسقاء.\nالشريان الأبهر: قطر طبيعي.\nلا يوجد سائل حر في البطن.',
        en: 'Liver: Normal size and homogeneous echotexture. No focal lesions.\nGallbladder: Normal without gallstones or wall thickening.\nBiliary ducts: Not dilated.\nPancreas: Normal to the extent visualized.\nSpleen: Normal size and homogeneous echotexture.\nRight kidney: Normal size without hydronephrosis or calculi.\nLeft kidney: Normal size without hydronephrosis or calculi.\nAorta: Normal caliber.\nNo free fluid in the abdomen.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'فحص بالموجات فوق الصوتية طبيعي للبطن.',
        en: 'Normal abdominal ultrasound examination.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. CT Head without Contrast
// ---------------------------------------------------------------------------

const ctHead: ReportTemplate = {
  id: 'tmpl_ct_head',
  modality: 'CT',
  bodyPart: 'head',
  templateName: {
    ar: 'أشعة مقطعية للرأس بدون صبغة',
    en: 'CT Head without Contrast',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'التقنية', en: 'Technique' },
      defaultText: {
        ar: 'أشعة مقطعية للرأس بدون حقن صبغة وريدية.',
        en: 'Non-contrast CT of the head was performed.',
      },
    },
    {
      title: { ar: 'المقارنة', en: 'Comparison' },
      defaultText: {
        ar: 'لا توجد صور سابقة للمقارنة.',
        en: 'No prior imaging available for comparison.',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'الحمة الدماغية: كثافة طبيعية بدون نزيف داخل الجمجمة أو آفات بؤرية.\nالبطينات: حجم وشكل طبيعي بدون استسقاء.\nالهياكل المتوسطة: لا يوجد انحراف.\nالعظام: لا توجد كسور.\nالجيوب الأنفية والخشاء: تهوية طبيعية.',
        en: 'Brain parenchyma: Normal attenuation without intracranial hemorrhage or focal lesion.\nVentricles: Normal size and configuration. No hydrocephalus.\nMidline structures: No shift.\nCalvarium: No fracture.\nParanasal sinuses and mastoid air cells: Clear.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'أشعة مقطعية للرأس طبيعية بدون صبغة.',
        en: 'Normal non-contrast CT head.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. CT Chest with Contrast
// ---------------------------------------------------------------------------

const ctChest: ReportTemplate = {
  id: 'tmpl_ct_chest',
  modality: 'CT',
  bodyPart: 'chest',
  templateName: {
    ar: 'أشعة مقطعية للصدر بالصبغة',
    en: 'CT Chest with Contrast',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'التقنية', en: 'Technique' },
      defaultText: {
        ar: 'أشعة مقطعية للصدر مع حقن صبغة وريدية.',
        en: 'CT of the chest was performed with intravenous contrast.',
      },
    },
    {
      title: { ar: 'المقارنة', en: 'Comparison' },
      defaultText: {
        ar: 'لا توجد صور سابقة للمقارنة.',
        en: 'No prior imaging available for comparison.',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'الرئتان: لا توجد عقد رئوية أو كتل. لا يوجد انخماص أو توحيد.\nالشعب الهوائية: سالكة.\nالمنصف: لا يوجد تضخم في الغدد الليمفاوية.\nالقلب والأوعية الكبرى: حجم طبيعي. لا يوجد انصباب تاموري.\nالجنب: لا يوجد انصباب جنبي.\nالعظام: لا توجد آفات عظمية مشبوهة.\nالجزء العلوي من البطن: المقطع المرئي طبيعي.',
        en: 'Lungs: No pulmonary nodules or masses. No atelectasis or consolidation.\nAirways: Patent.\nMediastinum: No lymphadenopathy.\nHeart and great vessels: Normal size. No pericardial effusion.\nPleura: No pleural effusion.\nBones: No suspicious osseous lesions.\nUpper abdomen: Visualized portions are unremarkable.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'أشعة مقطعية للصدر طبيعية بالصبغة.',
        en: 'Normal contrast-enhanced CT of the chest.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. MRI Brain
// ---------------------------------------------------------------------------

const mriBrain: ReportTemplate = {
  id: 'tmpl_mri_brain',
  modality: 'MRI',
  bodyPart: 'brain',
  templateName: {
    ar: 'رنين مغناطيسي للدماغ',
    en: 'MRI Brain',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'التقنية', en: 'Technique' },
      defaultText: {
        ar: 'رنين مغناطيسي للدماغ مع وبدون حقن صبغة وريدية. تم الحصول على مقاطع T1 و T2 و FLAIR و DWI.',
        en: 'MRI of the brain with and without IV contrast. Sequences include T1, T2, FLAIR, and DWI.',
      },
    },
    {
      title: { ar: 'المقارنة', en: 'Comparison' },
      defaultText: {
        ar: 'لا توجد صور سابقة للمقارنة.',
        en: 'No prior imaging available for comparison.',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'الحمة الدماغية: إشارة طبيعية في جميع التسلسلات. لا يوجد تقييد انتشار يشير إلى احتشاء حاد.\nالبطينات: حجم وشكل طبيعي.\nالمادة البيضاء: لا توجد تغيرات مرضية.\nالتعزيز: لا يوجد تعزيز غير طبيعي بعد حقن الصبغة.\nالهياكل المتوسطة: في وضعها الطبيعي.\nالحفرة الخلفية: طبيعية.',
        en: 'Brain parenchyma: Normal signal intensity on all sequences. No restricted diffusion to suggest acute infarct.\nVentricles: Normal size and configuration.\nWhite matter: No pathologic signal abnormality.\nEnhancement: No abnormal enhancement following contrast administration.\nMidline structures: Normal position.\nPosterior fossa: Unremarkable.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'رنين مغناطيسي للدماغ طبيعي.',
        en: 'Normal MRI of the brain.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. MRI Lumbar Spine
// ---------------------------------------------------------------------------

const mriLumbarSpine: ReportTemplate = {
  id: 'tmpl_mri_lumbar',
  modality: 'MRI',
  bodyPart: 'lumbar_spine',
  templateName: {
    ar: 'رنين مغناطيسي للعمود الفقري القطني',
    en: 'MRI Lumbar Spine',
  },
  sections: [
    {
      title: { ar: 'المعلومات السريرية', en: 'Clinical Information' },
      defaultText: {
        ar: 'المعلومات السريرية المقدمة:',
        en: 'Clinical information provided:',
      },
    },
    {
      title: { ar: 'التقنية', en: 'Technique' },
      defaultText: {
        ar: 'رنين مغناطيسي للعمود الفقري القطني بدون حقن صبغة. تم الحصول على مقاطع T1 و T2 سهمية ومحورية.',
        en: 'MRI of the lumbar spine without IV contrast. Sagittal and axial T1 and T2 sequences obtained.',
      },
    },
    {
      title: { ar: 'المقارنة', en: 'Comparison' },
      defaultText: {
        ar: 'لا توجد صور سابقة للمقارنة.',
        en: 'No prior imaging available for comparison.',
      },
    },
    {
      title: { ar: 'النتائج', en: 'Findings' },
      defaultText: {
        ar: 'الانحناء: طبيعي.\nالأجسام الفقرية: ارتفاع وإشارة طبيعية. لا يوجد كسور انضغاطية.\nالأقراص بين الفقرية:\n  L1-L2: طبيعي.\n  L2-L3: طبيعي.\n  L3-L4: طبيعي.\n  L4-L5: طبيعي.\n  L5-S1: طبيعي.\nالقناة الشوكية: سعة طبيعية.\nالثقوب العصبية: سالكة ثنائياً.\nالنخاع الشوكي ومخروط النخاع: إشارة طبيعية.\nالأنسجة الرخوة المحيطة: طبيعية.',
        en: 'Alignment: Normal lumbar lordosis.\nVertebral bodies: Normal height and signal. No compression fractures.\nIntervertebral discs:\n  L1-L2: Normal.\n  L2-L3: Normal.\n  L3-L4: Normal.\n  L4-L5: Normal.\n  L5-S1: Normal.\nSpinal canal: Normal caliber.\nNeural foramina: Patent bilaterally.\nConus medullaris: Normal signal, terminates at appropriate level.\nParaspinal soft tissues: Unremarkable.',
      },
    },
    {
      title: { ar: 'الانطباع', en: 'Impression' },
      defaultText: {
        ar: 'رنين مغناطيسي طبيعي للعمود الفقري القطني.',
        en: 'Normal MRI of the lumbar spine.',
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// All templates
// ---------------------------------------------------------------------------

export const ALL_REPORT_TEMPLATES: ReportTemplate[] = [
  chestXRay,
  abdominalUS,
  ctHead,
  ctChest,
  mriBrain,
  mriLumbarSpine,
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const byId = new Map<string, ReportTemplate>();
for (const t of ALL_REPORT_TEMPLATES) {
  byId.set(t.id, t);
}

/**
 * Get a report template by ID.
 */
export function getTemplateById(id: string): ReportTemplate | undefined {
  return byId.get(id);
}

/**
 * Get all templates for a given modality.
 */
export function getTemplatesByModality(modality: Modality): ReportTemplate[] {
  return ALL_REPORT_TEMPLATES.filter((t) => t.modality === modality);
}

/**
 * Get all templates for a given body part.
 */
export function getTemplatesByBodyPart(bodyPart: string): ReportTemplate[] {
  const bp = bodyPart.toLowerCase();
  return ALL_REPORT_TEMPLATES.filter((t) => t.bodyPart.toLowerCase() === bp);
}
