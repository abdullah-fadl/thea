function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CHIEF_COMPLAINTS = [
  { en: 'Cough and fever for 3 days', ar: 'سعال وحرارة لمدة ٣ أيام' },
  { en: 'Abdominal pain since yesterday', ar: 'ألم بطني منذ الأمس' },
  { en: 'Headache and dizziness', ar: 'صداع ودوخة' },
  { en: 'Chest pain on exertion', ar: 'ألم صدري عند المجهود' },
  { en: 'Shortness of breath', ar: 'ضيق في التنفس' },
  { en: 'Back pain for 1 week', ar: 'ألم ظهر لمدة أسبوع' },
  { en: 'Sore throat and difficulty swallowing', ar: 'التهاب حلق وصعوبة بلع' },
  { en: 'Skin rash spreading', ar: 'طفح جلدي منتشر' },
  { en: 'Joint pain in both knees', ar: 'ألم مفاصل في الركبتين' },
  { en: 'Nausea and vomiting', ar: 'غثيان وقيء' },
  { en: 'Burning sensation during urination', ar: 'حرقة عند التبول' },
  { en: 'Persistent fatigue', ar: 'إرهاق مستمر' },
  { en: 'Eye redness and itching', ar: 'احمرار وحكة بالعين' },
  { en: 'Toothache', ar: 'ألم أسنان' },
  { en: 'Follow-up visit for diabetes', ar: 'زيارة متابعة للسكري' },
];

const ER_COMPLAINTS = [
  { en: 'Severe chest pain', ar: 'ألم شديد بالصدر' },
  { en: 'Motor vehicle accident', ar: 'حادث سيارة' },
  { en: 'Fall from height', ar: 'سقوط من ارتفاع' },
  { en: 'Acute abdominal pain', ar: 'ألم بطني حاد' },
  { en: 'Severe allergic reaction', ar: 'حساسية شديدة' },
  { en: 'Loss of consciousness', ar: 'فقدان وعي' },
  { en: 'Difficulty breathing', ar: 'صعوبة تنفس' },
  { en: 'Active bleeding from wound', ar: 'نزيف نشط من جرح' },
  { en: 'Seizure', ar: 'نوبة تشنجية' },
  { en: 'Severe headache sudden onset', ar: 'صداع شديد مفاجئ' },
];

const PLANS = [
  'Start amoxicillin 500mg TDS for 7 days. Follow up in 1 week.',
  'Order CBC, CMP. Prescribe omeprazole 20mg daily. Follow up in 2 weeks.',
  'Physical therapy referral. Ibuprofen PRN. Return if symptoms worsen.',
  'Chest X-ray ordered. Start salbutamol inhaler PRN. Reassess in 3 days.',
  'Urinalysis and culture ordered. Start empiric ciprofloxacin. Follow up in 5 days.',
  'Blood glucose monitoring log. Adjust metformin dose. HbA1c in 3 months.',
  'ECG and troponin ordered. Cardiology referral if positive.',
  'Topical hydrocortisone cream. Antihistamine PRN. Dermatology referral if no improvement.',
  'CT abdomen ordered. Keep NPO. Surgical consultation.',
  'Supportive care. Paracetamol for fever. Follow up if symptoms persist beyond 5 days.',
];

const DISCHARGE_INSTRUCTIONS = [
  'Take all prescribed medications as directed. Return if fever exceeds 39C.',
  'Rest at home for 3 days. Drink plenty of fluids. Follow up as scheduled.',
  'Keep wound clean and dry. Change dressing daily. Return if signs of infection.',
  'Avoid heavy lifting for 2 weeks. Gradual return to normal activity.',
  'Take pain medication as prescribed. Apply ice for 20 min every 2 hours.',
];

export class NotesGenerator {
  randomChiefComplaint(): string {
    return pick(CHIEF_COMPLAINTS).en;
  }

  randomChiefComplaintBilingual(): { en: string; ar: string } {
    return pick(CHIEF_COMPLAINTS);
  }

  randomErComplaint(): string {
    return pick(ER_COMPLAINTS).en;
  }

  randomErComplaintBilingual(): { en: string; ar: string } {
    return pick(ER_COMPLAINTS);
  }

  randomPlan(): string {
    return pick(PLANS);
  }

  randomDischargeInstructions(): string {
    return pick(DISCHARGE_INSTRUCTIONS);
  }

  randomAssessment(): string {
    return pick([
      'Patient presents with typical symptoms. Physical exam consistent with diagnosis.',
      'Clinical picture consistent with acute presentation. No red flags identified.',
      'Mild presentation. Stable vitals. No signs of complications.',
      'Moderate severity. Requires further workup to rule out complications.',
    ]);
  }

  randomHPI(): string {
    return pick([
      'Patient reports symptoms started 3 days ago with gradual onset. No prior episodes.',
      'Sudden onset of symptoms yesterday. Associated with mild nausea. No fever initially.',
      'Chronic condition with acute worsening. Previously controlled on medications.',
      'First episode. No family history of similar complaints. No recent travel.',
    ]);
  }
}
