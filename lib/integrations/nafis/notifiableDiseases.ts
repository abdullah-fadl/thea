export const NOTIFIABLE_DISEASES: Record<
  string,
  { code: string; name: string; nameAr: string; urgency: 'immediate' | '24hours' | 'weekly' }
> = {
  A00: { code: 'A00', name: 'Cholera', nameAr: 'الكوليرا', urgency: 'immediate' },
  A01: { code: 'A01', name: 'Typhoid fever', nameAr: 'حمى التيفوئيد', urgency: 'immediate' },
  A20: { code: 'A20', name: 'Plague', nameAr: 'الطاعون', urgency: 'immediate' },
  A33: { code: 'A33', name: 'Tetanus neonatorum', nameAr: 'كزاز الوليد', urgency: 'immediate' },
  A35: { code: 'A35', name: 'Tetanus', nameAr: 'الكزاز', urgency: 'immediate' },
  A36: { code: 'A36', name: 'Diphtheria', nameAr: 'الدفتيريا', urgency: 'immediate' },
  A37: { code: 'A37', name: 'Whooping cough', nameAr: 'السعال الديكي', urgency: 'immediate' },
  A39: { code: 'A39', name: 'Meningococcal infection', nameAr: 'عدوى المكورات السحائية', urgency: 'immediate' },
  A80: { code: 'A80', name: 'Acute poliomyelitis', nameAr: 'شلل الأطفال الحاد', urgency: 'immediate' },
  B05: { code: 'B05', name: 'Measles', nameAr: 'الحصبة', urgency: 'immediate' },
  B06: { code: 'B06', name: 'Rubella', nameAr: 'الحصبة الألمانية', urgency: 'immediate' },
  B15: { code: 'B15', name: 'Acute hepatitis A', nameAr: 'التهاب الكبد أ الحاد', urgency: 'immediate' },
  B16: { code: 'B16', name: 'Acute hepatitis B', nameAr: 'التهاب الكبد ب الحاد', urgency: 'immediate' },
  B17: { code: 'B17', name: 'Acute hepatitis C', nameAr: 'التهاب الكبد ج الحاد', urgency: 'immediate' },
  B20: { code: 'B20', name: 'HIV disease', nameAr: 'فيروس نقص المناعة', urgency: 'immediate' },
  U07: { code: 'U07.1', name: 'COVID-19', nameAr: 'كوفيد-19', urgency: 'immediate' },
  J09: { code: 'J09', name: 'Influenza (novel strain)', nameAr: 'الإنفلونزا (سلالة جديدة)', urgency: 'immediate' },
  A95: { code: 'A95', name: 'Yellow fever', nameAr: 'الحمى الصفراء', urgency: 'immediate' },
  A90: { code: 'A90', name: 'Dengue fever', nameAr: 'حمى الضنك', urgency: 'immediate' },
  A82: { code: 'A82', name: 'Rabies', nameAr: 'داء الكلب', urgency: 'immediate' },
  A09: { code: 'A09', name: 'Gastroenteritis', nameAr: 'التهاب المعدة والأمعاء', urgency: '24hours' },
  A15: { code: 'A15', name: 'Tuberculosis', nameAr: 'السل', urgency: '24hours' },
  A50: { code: 'A50', name: 'Congenital syphilis', nameAr: 'الزهري الخلقي', urgency: '24hours' },
  A54: { code: 'A54', name: 'Gonococcal infection', nameAr: 'عدوى المكورات البنية', urgency: '24hours' },
  B50: { code: 'B50', name: 'Malaria', nameAr: 'الملاريا', urgency: '24hours' },
  B26: { code: 'B26', name: 'Mumps', nameAr: 'النكاف', urgency: '24hours' },
  B01: { code: 'B01', name: 'Varicella', nameAr: 'جدري الماء', urgency: '24hours' },
};

export function isNotifiableDisease(icdCode: string): boolean {
  const baseCode = icdCode.split('.')[0];
  return baseCode in NOTIFIABLE_DISEASES;
}

export function getNotifiableDiseaseInfo(icdCode: string) {
  const baseCode = icdCode.split('.')[0];
  return NOTIFIABLE_DISEASES[baseCode];
}
