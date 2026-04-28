function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface RadiologyExam {
  code: string;
  name: string;
  nameAr: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US' | 'NM' | 'FLUORO';
  bodyPart: string;
}

export const RADIOLOGY_EXAMS: RadiologyExam[] = [
  { code: 'CXR', name: 'Chest X-Ray', nameAr: 'أشعة صدر', modality: 'XR', bodyPart: 'CHEST' },
  { code: 'ABDXR', name: 'Abdominal X-Ray', nameAr: 'أشعة بطن', modality: 'XR', bodyPart: 'ABDOMEN' },
  { code: 'XRHAND', name: 'Hand X-Ray', nameAr: 'أشعة يد', modality: 'XR', bodyPart: 'HAND' },
  { code: 'CTHEAD', name: 'CT Head', nameAr: 'أشعة مقطعية رأس', modality: 'CT', bodyPart: 'HEAD' },
  { code: 'CTCHEST', name: 'CT Chest', nameAr: 'أشعة مقطعية صدر', modality: 'CT', bodyPart: 'CHEST' },
  { code: 'CTABD', name: 'CT Abdomen', nameAr: 'أشعة مقطعية بطن', modality: 'CT', bodyPart: 'ABDOMEN' },
  { code: 'MRIBRAIN', name: 'MRI Brain', nameAr: 'رنين مغناطيسي دماغ', modality: 'MRI', bodyPart: 'HEAD' },
  { code: 'USABD', name: 'Ultrasound Abdomen', nameAr: 'سونار بطن', modality: 'US', bodyPart: 'ABDOMEN' },
  { code: 'ECHO', name: 'Echocardiogram', nameAr: 'إيكو قلب', modality: 'US', bodyPart: 'HEART' },
  { code: 'OPG', name: 'Dental Panoramic', nameAr: 'بانوراما أسنان', modality: 'XR', bodyPart: 'MOUTH' },
];

export class RadiologyExamGenerator {
  random(): RadiologyExam {
    return pick(RADIOLOGY_EXAMS);
  }

  byModality(modality: string): RadiologyExam {
    const filtered = RADIOLOGY_EXAMS.filter((e) => e.modality === modality);
    return filtered.length ? pick(filtered) : pick(RADIOLOGY_EXAMS);
  }

  ct(): RadiologyExam {
    return this.byModality('CT');
  }

  xray(): RadiologyExam {
    return this.byModality('XR');
  }
}
