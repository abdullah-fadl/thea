/**
 * OR Preference Card Definitions
 *
 * Bilingual constants used throughout the OR preference-card feature.
 */

// ---------------------------------------------------------------------------
// Specialties
// ---------------------------------------------------------------------------

export const SPECIALTIES = [
  { value: 'ORTHOPEDIC', ar: 'العظام', en: 'Orthopedic' },
  { value: 'CARDIAC', ar: 'القلب', en: 'Cardiac' },
  { value: 'NEURO', ar: 'الأعصاب', en: 'Neurosurgery' },
  { value: 'GENERAL', ar: 'الجراحة العامة', en: 'General Surgery' },
  { value: 'VASCULAR', ar: 'الأوعية الدموية', en: 'Vascular' },
  { value: 'UROLOGY', ar: 'المسالك البولية', en: 'Urology' },
  { value: 'GYN', ar: 'النسائية والتوليد', en: 'Gynecology' },
  { value: 'ENT', ar: 'الأنف والأذن والحنجرة', en: 'ENT' },
  { value: 'PLASTICS', ar: 'الجراحة التجميلية', en: 'Plastics' },
  { value: 'OPHTHO', ar: 'العيون', en: 'Ophthalmology' },
] as const;

export type SpecialtyValue = (typeof SPECIALTIES)[number]['value'];

// ---------------------------------------------------------------------------
// Positioning Options
// ---------------------------------------------------------------------------

export const POSITIONING_OPTIONS = [
  { value: 'SUPINE', ar: 'وضعية الاستلقاء', en: 'Supine' },
  { value: 'PRONE', ar: 'وضعية الانبطاح', en: 'Prone' },
  { value: 'LATERAL', ar: 'وضعية جانبية', en: 'Lateral' },
  { value: 'LITHOTOMY', ar: 'وضعية تفتيت الحصى', en: 'Lithotomy' },
  { value: 'BEACH_CHAIR', ar: 'وضعية الكرسي الشاطئي', en: 'Beach Chair' },
  { value: 'TRENDELENBURG', ar: 'وضعية تريندلنبرغ', en: 'Trendelenburg' },
  { value: 'REVERSE_TRENDELENBURG', ar: 'عكس تريندلنبرغ', en: 'Reverse Trendelenburg' },
] as const;

// ---------------------------------------------------------------------------
// Skin Prep Options
// ---------------------------------------------------------------------------

export const SKIN_PREP_OPTIONS = [
  { value: 'BETADINE', ar: 'بيتادين', en: 'Betadine' },
  { value: 'CHLORHEXIDINE', ar: 'كلورهكسيدين', en: 'Chlorhexidine' },
  { value: 'ALCOHOL', ar: 'كحول', en: 'Alcohol' },
  { value: 'IODINE', ar: 'يود', en: 'Iodine' },
] as const;

// ---------------------------------------------------------------------------
// Suture Types
// ---------------------------------------------------------------------------

export const SUTURE_TYPES = [
  { value: 'VICRYL', ar: 'فيكريل', en: 'Vicryl' },
  { value: 'PROLENE', ar: 'برولين', en: 'Prolene' },
  { value: 'SILK', ar: 'حرير', en: 'Silk' },
  { value: 'CHROMIC', ar: 'كروميك', en: 'Chromic' },
  { value: 'PDS', ar: 'بي دي إس', en: 'PDS' },
  { value: 'MONOCRYL', ar: 'مونوكريل', en: 'Monocryl' },
  { value: 'NYLON', ar: 'نايلون', en: 'Nylon' },
  { value: 'STAPLES', ar: 'دبابيس', en: 'Staples' },
] as const;

// ---------------------------------------------------------------------------
// Common needle types for suture combos
// ---------------------------------------------------------------------------

export const NEEDLE_TYPES = [
  { value: 'CUTTING', ar: 'قاطعة', en: 'Cutting' },
  { value: 'REVERSE_CUTTING', ar: 'قاطعة عكسية', en: 'Reverse Cutting' },
  { value: 'TAPER', ar: 'مدببة', en: 'Taper Point' },
  { value: 'BLUNT', ar: 'حادة', en: 'Blunt' },
  { value: 'SPATULA', ar: 'مسطحة', en: 'Spatula' },
] as const;

// ---------------------------------------------------------------------------
// Common suture sizes
// ---------------------------------------------------------------------------

export const SUTURE_SIZES = [
  '6-0', '5-0', '4-0', '3-0', '2-0', '0', '1', '2',
] as const;

// ---------------------------------------------------------------------------
// Medication routes
// ---------------------------------------------------------------------------

export const MED_ROUTES = [
  { value: 'IV', ar: 'وريدي', en: 'IV' },
  { value: 'IM', ar: 'عضلي', en: 'IM' },
  { value: 'SC', ar: 'تحت الجلد', en: 'SC' },
  { value: 'PO', ar: 'فموي', en: 'PO' },
  { value: 'TOPICAL', ar: 'موضعي', en: 'Topical' },
  { value: 'IRRIGATION', ar: 'ري', en: 'Irrigation' },
] as const;

// ---------------------------------------------------------------------------
// Medication timing
// ---------------------------------------------------------------------------

export const MED_TIMING = [
  { value: 'PRE_OP', ar: 'قبل العملية', en: 'Pre-Op' },
  { value: 'INTRA_OP', ar: 'أثناء العملية', en: 'Intra-Op' },
  { value: 'POST_OP', ar: 'بعد العملية', en: 'Post-Op' },
  { value: 'ON_CALL', ar: 'عند الطلب', en: 'On Call' },
] as const;

// ---------------------------------------------------------------------------
// Common instruments by specialty
// ---------------------------------------------------------------------------

export const COMMON_INSTRUMENTS: Record<string, { name: string; ar: string; en: string }[]> = {
  ORTHOPEDIC: [
    { name: 'Power Drill', ar: 'مثقب كهربائي', en: 'Power Drill' },
    { name: 'Power Saw', ar: 'منشار كهربائي', en: 'Power Saw' },
    { name: 'Bone Rongeur', ar: 'قاضم عظام', en: 'Bone Rongeur' },
    { name: 'Periosteal Elevator', ar: 'رافع سمحاق', en: 'Periosteal Elevator' },
    { name: 'Bone Reduction Clamp', ar: 'مشبك رد عظام', en: 'Bone Reduction Clamp' },
    { name: 'Curette', ar: 'مكشطة', en: 'Curette' },
    { name: 'Osteotome', ar: 'قاطع عظام', en: 'Osteotome' },
    { name: 'Depth Gauge', ar: 'مقياس عمق', en: 'Depth Gauge' },
    { name: 'Tap and Drill Guide', ar: 'دليل حفر', en: 'Tap and Drill Guide' },
    { name: 'Plate Bender', ar: 'ثني صفيحة', en: 'Plate Bender' },
    { name: 'Wire Cutter', ar: 'قاطع أسلاك', en: 'Wire Cutter' },
    { name: 'Laminectomy Retractor', ar: 'مباعد استئصال الصفيحة', en: 'Laminectomy Retractor' },
  ],
  CARDIAC: [
    { name: 'Sternal Saw', ar: 'منشار القص', en: 'Sternal Saw' },
    { name: 'Sternal Retractor', ar: 'مباعد القص', en: 'Sternal Retractor' },
    { name: 'Aortic Cannula', ar: 'قنية الأبهر', en: 'Aortic Cannula' },
    { name: 'Venous Cannula', ar: 'قنية وريدية', en: 'Venous Cannula' },
    { name: 'Cardioplegia Set', ar: 'مجموعة شلل القلب', en: 'Cardioplegia Set' },
    { name: 'Coronary Stabilizer', ar: 'مثبت الشرايين التاجية', en: 'Coronary Stabilizer' },
    { name: 'Vascular Clamps', ar: 'مشابك وعائية', en: 'Vascular Clamps' },
    { name: 'Debakey Forceps', ar: 'ملقط ديباكي', en: 'Debakey Forceps' },
    { name: 'Coronary Dilator', ar: 'موسع الشرايين التاجية', en: 'Coronary Dilator' },
    { name: 'Sternal Wire', ar: 'سلك القص', en: 'Sternal Wire' },
    { name: 'Pacing Wires', ar: 'أسلاك تنظيم القلب', en: 'Pacing Wires' },
    { name: 'Internal Paddles', ar: 'مساطر داخلية', en: 'Internal Paddles' },
  ],
  NEURO: [
    { name: 'Craniotome', ar: 'منشار الجمجمة', en: 'Craniotome' },
    { name: 'High-Speed Drill', ar: 'مثقب عالي السرعة', en: 'High-Speed Drill' },
    { name: 'Bipolar Forceps', ar: 'ملقط ثنائي القطب', en: 'Bipolar Forceps' },
    { name: 'Brain Retractor', ar: 'مباعد دماغ', en: 'Brain Retractor' },
    { name: 'Microsurgical Set', ar: 'مجموعة جراحة مجهرية', en: 'Microsurgical Set' },
    { name: 'Dura Hook', ar: 'خطاف أم الجافية', en: 'Dura Hook' },
    { name: 'Penfield Dissector', ar: 'مشرح بينفيلد', en: 'Penfield Dissector' },
    { name: 'Kerrison Rongeur', ar: 'قاضم كيريسون', en: 'Kerrison Rongeur' },
    { name: 'Gigli Saw', ar: 'منشار جيجلي', en: 'Gigli Saw' },
    { name: 'Neuro Patties', ar: 'ضمادات عصبية', en: 'Neuro Patties' },
    { name: 'Clip Applier', ar: 'أداة تطبيق المشابك', en: 'Clip Applier' },
    { name: 'Navigation Probe', ar: 'مسبار الملاحة', en: 'Navigation Probe' },
  ],
  GENERAL: [
    { name: 'Laparoscopic Tower', ar: 'برج المنظار', en: 'Laparoscopic Tower' },
    { name: 'Harmonic Scalpel', ar: 'مشرط هارمونيك', en: 'Harmonic Scalpel' },
    { name: 'Balfour Retractor', ar: 'مباعد بالفور', en: 'Balfour Retractor' },
    { name: 'Deaver Retractor', ar: 'مباعد ديفر', en: 'Deaver Retractor' },
    { name: 'Bovie Electrocautery', ar: 'كي كهربائي بوفي', en: 'Bovie Electrocautery' },
    { name: 'Kelly Clamp', ar: 'مشبك كيلي', en: 'Kelly Clamp' },
    { name: 'Right Angle Clamp', ar: 'مشبك زاوية قائمة', en: 'Right Angle Clamp' },
    { name: 'Babcock Clamp', ar: 'مشبك بابكوك', en: 'Babcock Clamp' },
    { name: 'GIA Stapler', ar: 'دباسة GIA', en: 'GIA Stapler' },
    { name: 'Suction Irrigator', ar: 'شافطة ري', en: 'Suction Irrigator' },
    { name: 'Trocar Set', ar: 'مجموعة تروكار', en: 'Trocar Set' },
  ],
  VASCULAR: [
    { name: 'Fogarty Catheter', ar: 'قسطرة فوغارتي', en: 'Fogarty Catheter' },
    { name: 'Tunneler', ar: 'أداة النفق', en: 'Tunneler' },
    { name: 'Vascular Loops', ar: 'حلقات وعائية', en: 'Vascular Loops' },
    { name: 'Satinsky Clamp', ar: 'مشبك ساتنسكي', en: 'Satinsky Clamp' },
    { name: 'Bulldog Clamp', ar: 'مشبك بولدوغ', en: 'Bulldog Clamp' },
    { name: 'Heparinized Saline', ar: 'محلول ملحي مهبرن', en: 'Heparinized Saline' },
    { name: 'Graft Material', ar: 'مادة ترقيع', en: 'Graft Material' },
    { name: 'Doppler Probe', ar: 'مسبار دوبلر', en: 'Doppler Probe' },
    { name: 'Completion Angiogram Set', ar: 'مجموعة تصوير الأوعية', en: 'Completion Angiogram Set' },
    { name: 'Endarterectomy Set', ar: 'مجموعة استئصال بطانة الشريان', en: 'Endarterectomy Set' },
    { name: 'Vessel Dilator', ar: 'موسع أوعية', en: 'Vessel Dilator' },
  ],
  UROLOGY: [
    { name: 'Cystoscope', ar: 'منظار المثانة', en: 'Cystoscope' },
    { name: 'Resectoscope', ar: 'منظار القطع', en: 'Resectoscope' },
    { name: 'Ureteroscope', ar: 'منظار الحالب', en: 'Ureteroscope' },
    { name: 'Laser Fiber', ar: 'ألياف الليزر', en: 'Laser Fiber' },
    { name: 'Stone Basket', ar: 'سلة الحصى', en: 'Stone Basket' },
    { name: 'Ureteral Stent', ar: 'دعامة الحالب', en: 'Ureteral Stent' },
    { name: 'Guidewire', ar: 'سلك توجيه', en: 'Guidewire' },
    { name: 'Nephroscope', ar: 'منظار الكلية', en: 'Nephroscope' },
    { name: 'Lithotripter', ar: 'جهاز تفتيت الحصى', en: 'Lithotripter' },
    { name: 'Foley Catheter', ar: 'قسطرة فولي', en: 'Foley Catheter' },
    { name: 'Dilator Set', ar: 'مجموعة توسيع', en: 'Dilator Set' },
  ],
  GYN: [
    { name: 'Uterine Manipulator', ar: 'مناور الرحم', en: 'Uterine Manipulator' },
    { name: 'Heaney Clamp', ar: 'مشبك هيني', en: 'Heaney Clamp' },
    { name: 'Tenaculum', ar: 'ماسك الرحم', en: 'Tenaculum' },
    { name: 'Colpotomy Ring', ar: 'حلقة بضع المهبل', en: 'Colpotomy Ring' },
    { name: 'Morcellator', ar: 'جهاز التفتيت', en: 'Morcellator' },
    { name: 'Dilators (Hegar)', ar: 'موسعات هيغار', en: 'Dilators (Hegar)' },
    { name: 'Hulka Clip', ar: 'مشبك هولكا', en: 'Hulka Clip' },
    { name: 'Hysteroscope', ar: 'منظار الرحم', en: 'Hysteroscope' },
    { name: 'Myoma Screw', ar: 'برغي الورم الليفي', en: 'Myoma Screw' },
    { name: 'Endoloop', ar: 'حلقة داخلية', en: 'Endoloop' },
  ],
  ENT: [
    { name: 'Microdebrider', ar: 'جهاز التنظيف الدقيق', en: 'Microdebrider' },
    { name: 'Nasal Endoscope', ar: 'منظار الأنف', en: 'Nasal Endoscope' },
    { name: 'Tonsil Snare', ar: 'حلقة اللوزتين', en: 'Tonsil Snare' },
    { name: 'Adenoid Curette', ar: 'مكشطة الزوائد الأنفية', en: 'Adenoid Curette' },
    { name: 'Laryngoscope', ar: 'منظار الحنجرة', en: 'Laryngoscope' },
    { name: 'Ear Speculum', ar: 'مرآة الأذن', en: 'Ear Speculum' },
    { name: 'Mastoid Drill', ar: 'مثقب الخشاء', en: 'Mastoid Drill' },
    { name: 'Myringotomy Set', ar: 'مجموعة بضع طبلة الأذن', en: 'Myringotomy Set' },
    { name: 'Sinus Balloon', ar: 'بالون الجيوب الأنفية', en: 'Sinus Balloon' },
    { name: 'Nerve Monitor', ar: 'مراقب الأعصاب', en: 'Nerve Monitor' },
    { name: 'Hemostatic Packing', ar: 'حشوة مرقئة', en: 'Hemostatic Packing' },
  ],
  PLASTICS: [
    { name: 'Dermatome', ar: 'جهاز قطع الجلد', en: 'Dermatome' },
    { name: 'Skin Graft Mesher', ar: 'جهاز شبك الترقيع', en: 'Skin Graft Mesher' },
    { name: 'Microsurgical Set', ar: 'مجموعة جراحة مجهرية', en: 'Microsurgical Set' },
    { name: 'Liposuction Cannula', ar: 'قنية شفط الدهون', en: 'Liposuction Cannula' },
    { name: 'Fat Injection Set', ar: 'مجموعة حقن الدهون', en: 'Fat Injection Set' },
    { name: 'Tissue Expander', ar: 'موسع الأنسجة', en: 'Tissue Expander' },
    { name: 'Breast Retractor', ar: 'مباعد الثدي', en: 'Breast Retractor' },
    { name: 'Skin Hooks', ar: 'خطافات الجلد', en: 'Skin Hooks' },
    { name: 'Bipolar Electrocautery', ar: 'كي ثنائي القطب', en: 'Bipolar Electrocautery' },
    { name: 'Wound Vac', ar: 'جهاز شفط الجرح', en: 'Wound Vac' },
    { name: 'Marking Pen', ar: 'قلم تأشير', en: 'Marking Pen' },
  ],
  OPHTHO: [
    { name: 'Phaco Handpiece', ar: 'قبضة الفاكو', en: 'Phaco Handpiece' },
    { name: 'Keratome', ar: 'مشرط القرنية', en: 'Keratome' },
    { name: 'IOL Injector', ar: 'حاقن العدسة', en: 'IOL Injector' },
    { name: 'Capsulorhexis Forceps', ar: 'ملقط تمزيق المحفظة', en: 'Capsulorhexis Forceps' },
    { name: 'Vitrectomy Cutter', ar: 'قاطع زجاجي', en: 'Vitrectomy Cutter' },
    { name: 'Endoilluminator', ar: 'مضيء داخلي', en: 'Endoilluminator' },
    { name: 'Retinal Laser', ar: 'ليزر الشبكية', en: 'Retinal Laser' },
    { name: 'Lid Speculum', ar: 'مباعد الجفن', en: 'Lid Speculum' },
    { name: 'Viscoelastic Syringe', ar: 'محقنة لزجة', en: 'Viscoelastic Syringe' },
    { name: 'Irrigation/Aspiration', ar: 'ري وشفط', en: 'Irrigation/Aspiration' },
  ],
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

export const CARD_STATUS_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-green-100 text-green-700' },
  ARCHIVED: { ar: 'مؤرشف', en: 'Archived', color: 'bg-gray-100 text-gray-700' },
};
