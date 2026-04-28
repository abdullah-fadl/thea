/**
 * Patient Experience Complaint Taxonomy Seed Data
 * 
 * Structure:
 * - domains: Complaint domains (e.g., Nursing, Pharmacy, Administration)
 * - classes: Complaint types/classes (e.g., Medication Delay, Staff Attitude)
 * - subclasses: Sub-classifications (e.g., Delay in Medication, Call Bell Response)
 */

export const pxComplaintTaxonomySeed = {
  "domains": [
    { "key": "NURSING", "label_en": "Nursing", "label_ar": "التمريض", "active": true, "sortOrder": 10 },
    { "key": "PHYSICIAN", "label_en": "Physician/Medical", "label_ar": "الأطباء/الجانب الطبي", "active": true, "sortOrder": 20 },
    { "key": "PHARMACY", "label_en": "Pharmacy/Medication", "label_ar": "الصيدلية/الأدوية", "active": true, "sortOrder": 30 },
    { "key": "LAB", "label_en": "Laboratory", "label_ar": "المختبر", "active": true, "sortOrder": 40 },
    { "key": "RADIOLOGY", "label_en": "Radiology/Imaging", "label_ar": "الأشعة/التصوير", "active": true, "sortOrder": 50 },
    { "key": "REGISTRATION", "label_en": "Registration/Admission", "label_ar": "التسجيل/الدخول", "active": true, "sortOrder": 60 },
    { "key": "APPOINTMENTS", "label_en": "Appointments/Waiting Time", "label_ar": "المواعيد/الانتظار", "active": true, "sortOrder": 70 },
    { "key": "BILLING", "label_en": "Billing/Payments", "label_ar": "الفوترة/الدفع", "active": true, "sortOrder": 80 },
    { "key": "INSURANCE", "label_en": "Insurance/Approvals", "label_ar": "التأمين/الموافقات", "active": true, "sortOrder": 90 },
    { "key": "FACILITY", "label_en": "Facility/Maintenance", "label_ar": "المرافق/الصيانة", "active": true, "sortOrder": 100 },
    { "key": "HOUSEKEEPING", "label_en": "Housekeeping/Cleanliness", "label_ar": "النظافة/التدبير المنزلي", "active": true, "sortOrder": 110 },
    { "key": "FOOD", "label_en": "Food & Nutrition Services", "label_ar": "التغذية/الوجبات", "active": true, "sortOrder": 120 },
    { "key": "SECURITY", "label_en": "Security/Safety", "label_ar": "الأمن/السلامة", "active": true, "sortOrder": 130 },
    { "key": "TRANSPORT", "label_en": "Patient Transport", "label_ar": "نقل المرضى", "active": true, "sortOrder": 140 },
    { "key": "PATIENT_RIGHTS", "label_en": "Patient Rights/Privacy", "label_ar": "حقوق المريض/الخصوصية", "active": true, "sortOrder": 150 },
    { "key": "COMMUNICATION", "label_en": "Communication/Customer Service", "label_ar": "التواصل/خدمة العملاء", "active": true, "sortOrder": 160 },
    { "key": "IT_SYSTEMS", "label_en": "IT/Systems", "label_ar": "تقنية المعلومات/الأنظمة", "active": true, "sortOrder": 170 },
    { "key": "CLINICAL_SAFETY", "label_en": "Clinical Safety", "label_ar": "السلامة السريرية", "active": true, "sortOrder": 180 },
    { "key": "DISCHARGE", "label_en": "Discharge Process", "label_ar": "إجراءات الخروج", "active": true, "sortOrder": 190 }
  ],
  "classes": [
    { "key": "NURSING_DELAY", "domainKey": "NURSING", "label_en": "Delay", "label_ar": "تأخير", "active": true, "sortOrder": 10 },
    { "key": "NURSING_COMMUNICATION", "domainKey": "NURSING", "label_en": "Communication", "label_ar": "تواصل", "active": true, "sortOrder": 20 },
    { "key": "NURSING_ATTITUDE", "domainKey": "NURSING", "label_en": "Attitude/Behavior", "label_ar": "تعامل/سلوك", "active": true, "sortOrder": 30 },
    { "key": "NURSING_CARE_QUALITY", "domainKey": "NURSING", "label_en": "Care Quality", "label_ar": "جودة الرعاية", "active": true, "sortOrder": 40 },
    { "key": "NURSING_MEDICATION_HANDLING", "domainKey": "NURSING", "label_en": "Medication Handling", "label_ar": "التعامل مع الأدوية", "active": true, "sortOrder": 50 },
    { "key": "NURSING_PRIVACY", "domainKey": "NURSING", "label_en": "Privacy/Respect", "label_ar": "خصوصية/احترام", "active": true, "sortOrder": 60 },

    { "key": "PHYS_DIAGNOSIS_PLAN", "domainKey": "PHYSICIAN", "label_en": "Diagnosis/Treatment Plan", "label_ar": "التشخيص/الخطة العلاجية", "active": true, "sortOrder": 10 },
    { "key": "PHYS_COMMUNICATION", "domainKey": "PHYSICIAN", "label_en": "Communication", "label_ar": "تواصل", "active": true, "sortOrder": 20 },
    { "key": "PHYS_ATTITUDE", "domainKey": "PHYSICIAN", "label_en": "Attitude/Professionalism", "label_ar": "تعامل/احترافية", "active": true, "sortOrder": 30 },
    { "key": "PHYS_DELAY", "domainKey": "PHYSICIAN", "label_en": "Delay/Availability", "label_ar": "تأخير/توفر", "active": true, "sortOrder": 40 },
    { "key": "PHYS_PROCEDURES", "domainKey": "PHYSICIAN", "label_en": "Procedures/Orders", "label_ar": "إجراءات/طلبات طبية", "active": true, "sortOrder": 50 },

    { "key": "PHARMACY_DELAY", "domainKey": "PHARMACY", "label_en": "Medication Delay", "label_ar": "تأخير الدواء", "active": true, "sortOrder": 10 },
    { "key": "PHARMACY_AVAILABILITY", "domainKey": "PHARMACY", "label_en": "Medication Availability", "label_ar": "توفر الدواء", "active": true, "sortOrder": 20 },
    { "key": "PHARMACY_COUNSELING", "domainKey": "PHARMACY", "label_en": "Counseling/Instructions", "label_ar": "إرشادات/تثقيف دوائي", "active": true, "sortOrder": 30 },
    { "key": "PHARMACY_DISPENSING_ERROR", "domainKey": "PHARMACY", "label_en": "Dispensing Error", "label_ar": "خطأ صرف", "active": true, "sortOrder": 40 },

    { "key": "LAB_TAT", "domainKey": "LAB", "label_en": "Turnaround Time (Delay)", "label_ar": "زمن إنجاز (تأخير)", "active": true, "sortOrder": 10 },
    { "key": "LAB_SAMPLE", "domainKey": "LAB", "label_en": "Sample Collection/Handling", "label_ar": "سحب/تعامل مع العينة", "active": true, "sortOrder": 20 },
    { "key": "LAB_RESULT", "domainKey": "LAB", "label_en": "Result Issue", "label_ar": "مشكلة نتيجة", "active": true, "sortOrder": 30 },
    { "key": "LAB_COMMUNICATION", "domainKey": "LAB", "label_en": "Communication", "label_ar": "تواصل", "active": true, "sortOrder": 40 },

    { "key": "RAD_TAT", "domainKey": "RADIOLOGY", "label_en": "Appointment/Delay", "label_ar": "موعد/تأخير", "active": true, "sortOrder": 10 },
    { "key": "RAD_REPORT", "domainKey": "RADIOLOGY", "label_en": "Report Issue", "label_ar": "مشكلة تقرير", "active": true, "sortOrder": 20 },
    { "key": "RAD_SAFETY", "domainKey": "RADIOLOGY", "label_en": "Safety/Preparation", "label_ar": "سلامة/تحضير", "active": true, "sortOrder": 30 },
    { "key": "RAD_COMMUNICATION", "domainKey": "RADIOLOGY", "label_en": "Communication", "label_ar": "تواصل", "active": true, "sortOrder": 40 },

    { "key": "REG_CHECKIN", "domainKey": "REGISTRATION", "label_en": "Check-in/Registration", "label_ar": "تسجيل/دخول", "active": true, "sortOrder": 10 },
    { "key": "REG_INFO_ERROR", "domainKey": "REGISTRATION", "label_en": "Information/Data Error", "label_ar": "خطأ بيانات/معلومات", "active": true, "sortOrder": 20 },
    { "key": "REG_ATTITUDE", "domainKey": "REGISTRATION", "label_en": "Staff Attitude", "label_ar": "تعامل الموظفين", "active": true, "sortOrder": 30 },

    { "key": "APT_WAITING", "domainKey": "APPOINTMENTS", "label_en": "Waiting Time", "label_ar": "وقت انتظار", "active": true, "sortOrder": 10 },
    { "key": "APT_SCHEDULING", "domainKey": "APPOINTMENTS", "label_en": "Scheduling/Rescheduling", "label_ar": "حجز/إعادة جدولة", "active": true, "sortOrder": 20 },
    { "key": "APT_NO_SHOW", "domainKey": "APPOINTMENTS", "label_en": "No-show/Cancellation Handling", "label_ar": "إلغاء/عدم حضور", "active": true, "sortOrder": 30 },

    { "key": "BILL_INVOICE", "domainKey": "BILLING", "label_en": "Invoice/Charges", "label_ar": "فاتورة/رسوم", "active": true, "sortOrder": 10 },
    { "key": "BILL_PAYMENT", "domainKey": "BILLING", "label_en": "Payment/Refund", "label_ar": "دفع/استرجاع", "active": true, "sortOrder": 20 },
    { "key": "BILL_TRANSPARENCY", "domainKey": "BILLING", "label_en": "Transparency/Explanation", "label_ar": "توضيح/شفافية", "active": true, "sortOrder": 30 },

    { "key": "INS_APPROVAL_DELAY", "domainKey": "INSURANCE", "label_en": "Approval Delay", "label_ar": "تأخير موافقة", "active": true, "sortOrder": 10 },
    { "key": "INS_DENIAL", "domainKey": "INSURANCE", "label_en": "Denial/Eligibility", "label_ar": "رفض/أهلية", "active": true, "sortOrder": 20 },
    { "key": "INS_COVERAGE", "domainKey": "INSURANCE", "label_en": "Coverage Clarification", "label_ar": "توضيح تغطية", "active": true, "sortOrder": 30 },

    { "key": "FACILITY_ROOM", "domainKey": "FACILITY", "label_en": "Room/Infrastructure", "label_ar": "غرفة/بنية تحتية", "active": true, "sortOrder": 10 },
    { "key": "FACILITY_EQUIPMENT", "domainKey": "FACILITY", "label_en": "Equipment/Devices", "label_ar": "أجهزة/معدات", "active": true, "sortOrder": 20 },
    { "key": "FACILITY_UTILITIES", "domainKey": "FACILITY", "label_en": "Utilities (AC/Water/Electricity)", "label_ar": "خدمات (تكييف/ماء/كهرباء)", "active": true, "sortOrder": 30 },

    { "key": "HK_CLEANLINESS", "domainKey": "HOUSEKEEPING", "label_en": "Cleanliness", "label_ar": "نظافة", "active": true, "sortOrder": 10 },
    { "key": "HK_LINEN", "domainKey": "HOUSEKEEPING", "label_en": "Linen/Waste", "label_ar": "مفارش/نفايات", "active": true, "sortOrder": 20 },
    { "key": "HK_ODOR", "domainKey": "HOUSEKEEPING", "label_en": "Odor/Pests", "label_ar": "روائح/حشرات", "active": true, "sortOrder": 30 },

    { "key": "FOOD_DIET", "domainKey": "FOOD", "label_en": "Diet Order/Restrictions", "label_ar": "حمية/قيود غذائية", "active": true, "sortOrder": 10 },
    { "key": "FOOD_QUALITY", "domainKey": "FOOD", "label_en": "Food Quality/Temperature", "label_ar": "جودة/حرارة الطعام", "active": true, "sortOrder": 20 },
    { "key": "FOOD_DELIVERY", "domainKey": "FOOD", "label_en": "Meal Delivery/Timing", "label_ar": "توصيل/توقيت الوجبة", "active": true, "sortOrder": 30 },

    { "key": "SEC_VISITOR", "domainKey": "SECURITY", "label_en": "Visitor Management", "label_ar": "إدارة الزوار", "active": true, "sortOrder": 10 },
    { "key": "SEC_SAFETY", "domainKey": "SECURITY", "label_en": "Safety Incident/Concern", "label_ar": "حادثة/مخاوف سلامة", "active": true, "sortOrder": 20 },
    { "key": "SEC_ATTITUDE", "domainKey": "SECURITY", "label_en": "Staff Attitude", "label_ar": "تعامل الأمن", "active": true, "sortOrder": 30 },

    { "key": "TRN_DELAY", "domainKey": "TRANSPORT", "label_en": "Transport Delay", "label_ar": "تأخير نقل", "active": true, "sortOrder": 10 },
    { "key": "TRN_SAFETY", "domainKey": "TRANSPORT", "label_en": "Safety/Handling", "label_ar": "سلامة/تعامل", "active": true, "sortOrder": 20 },
    { "key": "TRN_COORDINATION", "domainKey": "TRANSPORT", "label_en": "Coordination/Communication", "label_ar": "تنسيق/تواصل", "active": true, "sortOrder": 30 },

    { "key": "PRIV_CONFIDENTIALITY", "domainKey": "PATIENT_RIGHTS", "label_en": "Confidentiality/Privacy", "label_ar": "سرية/خصوصية", "active": true, "sortOrder": 10 },
    { "key": "PRIV_CONSENT", "domainKey": "PATIENT_RIGHTS", "label_en": "Consent/Information", "label_ar": "موافقة/معلومات", "active": true, "sortOrder": 20 },
    { "key": "PRIV_RESPECT", "domainKey": "PATIENT_RIGHTS", "label_en": "Dignity/Respect", "label_ar": "كرامة/احترام", "active": true, "sortOrder": 30 },

    { "key": "CS_COMMUNICATION", "domainKey": "COMMUNICATION", "label_en": "Communication Clarity", "label_ar": "وضوح التواصل", "active": true, "sortOrder": 10 },
    { "key": "CS_LANGUAGE", "domainKey": "COMMUNICATION", "label_en": "Language/Interpreter", "label_ar": "لغة/مترجم", "active": true, "sortOrder": 20 },
    { "key": "CS_COMPLAINT_HANDLING", "domainKey": "COMMUNICATION", "label_en": "Complaint Handling", "label_ar": "التعامل مع الشكاوى", "active": true, "sortOrder": 30 },

    { "key": "IT_LOGIN", "domainKey": "IT_SYSTEMS", "label_en": "Access/Login", "label_ar": "دخول/صلاحيات", "active": true, "sortOrder": 10 },
    { "key": "IT_SYSTEM_DOWN", "domainKey": "IT_SYSTEMS", "label_en": "System Down/Performance", "label_ar": "تعطل/أداء النظام", "active": true, "sortOrder": 20 },
    { "key": "IT_DEVICE", "domainKey": "IT_SYSTEMS", "label_en": "Device/Printer/Network", "label_ar": "جهاز/طابعة/شبكة", "active": true, "sortOrder": 30 },

    { "key": "SAFETY_FALL", "domainKey": "CLINICAL_SAFETY", "label_en": "Fall/Safety Event", "label_ar": "سقوط/حدث سلامة", "active": true, "sortOrder": 10 },
    { "key": "SAFETY_INFECTION", "domainKey": "CLINICAL_SAFETY", "label_en": "Infection Control", "label_ar": "مكافحة عدوى", "active": true, "sortOrder": 20 },
    { "key": "SAFETY_MED_ERROR", "domainKey": "CLINICAL_SAFETY", "label_en": "Medication Safety", "label_ar": "سلامة دوائية", "active": true, "sortOrder": 30 },
    { "key": "SAFETY_ID", "domainKey": "CLINICAL_SAFETY", "label_en": "Patient Identification", "label_ar": "تعريف المريض", "active": true, "sortOrder": 40 },

    { "key": "DISCH_DELAY", "domainKey": "DISCHARGE", "label_en": "Discharge Delay", "label_ar": "تأخير الخروج", "active": true, "sortOrder": 10 },
    { "key": "DISCH_EDU", "domainKey": "DISCHARGE", "label_en": "Discharge Education", "label_ar": "تثقيف/تعليمات خروج", "active": true, "sortOrder": 20 },
    { "key": "DISCH_MED", "domainKey": "DISCHARGE", "label_en": "Discharge Medications", "label_ar": "أدوية الخروج", "active": true, "sortOrder": 30 }
  ],
  "subclasses": [
    { "key": "NURSING_DELAY_MED_ADMIN", "domainKey": "NURSING", "classKey": "NURSING_DELAY", "label_en": "Medication administration delay", "label_ar": "تأخير إعطاء الدواء", "active": true, "sortOrder": 10 },
    { "key": "NURSING_DELAY_CALL_BELL", "domainKey": "NURSING", "classKey": "NURSING_DELAY", "label_en": "Delay responding to call bell", "label_ar": "تأخير الاستجابة لنداء المريض", "active": true, "sortOrder": 20 },
    { "key": "NURSING_DELAY_IV_PROC", "domainKey": "NURSING", "classKey": "NURSING_DELAY", "label_en": "IV/Procedure delay", "label_ar": "تأخير إجراء/محلول وريدي", "active": true, "sortOrder": 30 },
    { "key": "NURSING_DELAY_CARE_TASK", "domainKey": "NURSING", "classKey": "NURSING_DELAY", "label_en": "Delay in routine care tasks", "label_ar": "تأخير في رعاية تمريضية", "active": true, "sortOrder": 40 },

    { "key": "NURSING_COMM_EXPLANATION", "domainKey": "NURSING", "classKey": "NURSING_COMMUNICATION", "label_en": "Inadequate explanation to patient/family", "label_ar": "شرح غير كافٍ للمريض/العائلة", "active": true, "sortOrder": 10 },
    { "key": "NURSING_COMM_LANGUAGE", "domainKey": "NURSING", "classKey": "NURSING_COMMUNICATION", "label_en": "Language barrier / needs interpreter", "label_ar": "حاجز لغة/يحتاج مترجم", "active": true, "sortOrder": 20 },
    { "key": "NURSING_COMM_HANDOVER", "domainKey": "NURSING", "classKey": "NURSING_COMMUNICATION", "label_en": "Handover/continuity issue", "label_ar": "مشكلة تسليم/استمرارية", "active": true, "sortOrder": 30 },

    { "key": "NURSING_ATT_RUDE", "domainKey": "NURSING", "classKey": "NURSING_ATTITUDE", "label_en": "Rude behavior", "label_ar": "سلوك غير لائق", "active": true, "sortOrder": 10 },
    { "key": "NURSING_ATT_EMPATHY", "domainKey": "NURSING", "classKey": "NURSING_ATTITUDE", "label_en": "Lack of empathy", "label_ar": "قلة تعاطف", "active": true, "sortOrder": 20 },
    { "key": "NURSING_ATT_UNPROF", "domainKey": "NURSING", "classKey": "NURSING_ATTITUDE", "label_en": "Unprofessional conduct", "label_ar": "تصرف غير احترافي", "active": true, "sortOrder": 30 },

    { "key": "NURSING_QUAL_PAIN", "domainKey": "NURSING", "classKey": "NURSING_CARE_QUALITY", "label_en": "Pain management concern", "label_ar": "مشكلة في التحكم بالألم", "active": true, "sortOrder": 10 },
    { "key": "NURSING_QUAL_SKIN", "domainKey": "NURSING", "classKey": "NURSING_CARE_QUALITY", "label_en": "Skin care/pressure injury concern", "label_ar": "مشكلة عناية بالجلد/قرحة ضغط", "active": true, "sortOrder": 20 },
    { "key": "NURSING_QUAL_HYGIENE", "domainKey": "NURSING", "classKey": "NURSING_CARE_QUALITY", "label_en": "Hygiene care concern", "label_ar": "مشكلة عناية بالنظافة الشخصية", "active": true, "sortOrder": 30 },
    { "key": "NURSING_QUAL_SAFETY_PRECAUTIONS", "domainKey": "NURSING", "classKey": "NURSING_CARE_QUALITY", "label_en": "Safety precautions not followed", "label_ar": "عدم الالتزام بإجراءات السلامة", "active": true, "sortOrder": 40 },

    { "key": "NURSING_MED_WRONG_TIME", "domainKey": "NURSING", "classKey": "NURSING_MEDICATION_HANDLING", "label_en": "Medication given at wrong time", "label_ar": "دواء بوقت غير صحيح", "active": true, "sortOrder": 10 },
    { "key": "NURSING_MED_MISSED_DOSE", "domainKey": "NURSING", "classKey": "NURSING_MEDICATION_HANDLING", "label_en": "Missed dose", "label_ar": "جرعة فائتة", "active": true, "sortOrder": 20 },
    { "key": "NURSING_MED_WRONG_ROUTE", "domainKey": "NURSING", "classKey": "NURSING_MEDICATION_HANDLING", "label_en": "Wrong route concern", "label_ar": "مسار إعطاء غير صحيح", "active": true, "sortOrder": 30 },
    { "key": "NURSING_MED_REFUSAL_EDU", "domainKey": "NURSING", "classKey": "NURSING_MEDICATION_HANDLING", "label_en": "Refusal/education needed", "label_ar": "رفض/يحتاج تثقيف", "active": true, "sortOrder": 40 },

    { "key": "NURSING_PRIV_CURTAIN", "domainKey": "NURSING", "classKey": "NURSING_PRIVACY", "label_en": "Privacy not maintained (curtain/door)", "label_ar": "عدم الحفاظ على الخصوصية (ستارة/باب)", "active": true, "sortOrder": 10 },
    { "key": "NURSING_PRIV_INFO", "domainKey": "NURSING", "classKey": "NURSING_PRIVACY", "label_en": "Information discussed publicly", "label_ar": "معلومات قيلت أمام الآخرين", "active": true, "sortOrder": 20 },

    { "key": "PHYS_PLAN_UNCLEAR", "domainKey": "PHYSICIAN", "classKey": "PHYS_DIAGNOSIS_PLAN", "label_en": "Unclear treatment plan", "label_ar": "خطة علاجية غير واضحة", "active": true, "sortOrder": 10 },
    { "key": "PHYS_PLAN_SECOND_OP", "domainKey": "PHYSICIAN", "classKey": "PHYS_DIAGNOSIS_PLAN", "label_en": "Second opinion request concern", "label_ar": "طلب رأي آخر/عدم رضا", "active": true, "sortOrder": 20 },

    { "key": "PHYS_COMM_EXPLAIN", "domainKey": "PHYSICIAN", "classKey": "PHYS_COMMUNICATION", "label_en": "Insufficient explanation", "label_ar": "شرح غير كافٍ", "active": true, "sortOrder": 10 },
    { "key": "PHYS_COMM_FAMILY", "domainKey": "PHYSICIAN", "classKey": "PHYS_COMMUNICATION", "label_en": "Family communication issue", "label_ar": "مشكلة تواصل مع العائلة", "active": true, "sortOrder": 20 },

    { "key": "PHYS_ATT_RUDE", "domainKey": "PHYSICIAN", "classKey": "PHYS_ATTITUDE", "label_en": "Rude/impolite behavior", "label_ar": "تعامل غير لائق", "active": true, "sortOrder": 10 },
    { "key": "PHYS_ATT_PROFESSIONAL", "domainKey": "PHYSICIAN", "classKey": "PHYS_ATTITUDE", "label_en": "Professionalism concern", "label_ar": "ملاحظة على الاحترافية", "active": true, "sortOrder": 20 },

    { "key": "PHYS_DELAY_ROUNDS", "domainKey": "PHYSICIAN", "classKey": "PHYS_DELAY", "label_en": "Delay in rounds/visit", "label_ar": "تأخير زيارة الطبيب", "active": true, "sortOrder": 10 },
    { "key": "PHYS_DELAY_PROCEDURE", "domainKey": "PHYSICIAN", "classKey": "PHYS_DELAY", "label_en": "Procedure/consult delay", "label_ar": "تأخير إجراء/استشارة", "active": true, "sortOrder": 20 },

    { "key": "PHARM_DELAY_DISPENSE", "domainKey": "PHARMACY", "classKey": "PHARMACY_DELAY", "label_en": "Delay dispensing medication", "label_ar": "تأخير صرف الدواء", "active": true, "sortOrder": 10 },
    { "key": "PHARM_AVAIL_OUTOFSTOCK", "domainKey": "PHARMACY", "classKey": "PHARMACY_AVAILABILITY", "label_en": "Out of stock", "label_ar": "غير متوفر", "active": true, "sortOrder": 10 },
    { "key": "PHARM_COUNSEL_SIDEFX", "domainKey": "PHARMACY", "classKey": "PHARMACY_COUNSELING", "label_en": "Side effects not explained", "label_ar": "لم يتم شرح الأعراض الجانبية", "active": true, "sortOrder": 10 },
    { "key": "PHARM_ERR_WRONG_ITEM", "domainKey": "PHARMACY", "classKey": "PHARMACY_DISPENSING_ERROR", "label_en": "Wrong medication/item", "label_ar": "صرف دواء/صنف خاطئ", "active": true, "sortOrder": 10 },

    { "key": "LAB_TAT_DELAY", "domainKey": "LAB", "classKey": "LAB_TAT", "label_en": "Result delay", "label_ar": "تأخير نتيجة", "active": true, "sortOrder": 10 },
    { "key": "LAB_SAMPLE_HEMOLYSIS", "domainKey": "LAB", "classKey": "LAB_SAMPLE", "label_en": "Sample hemolysis/re-collection", "label_ar": "تلف العينة/إعادة سحب", "active": true, "sortOrder": 10 },
    { "key": "LAB_RESULT_MISMATCH", "domainKey": "LAB", "classKey": "LAB_RESULT", "label_en": "Result discrepancy concern", "label_ar": "تعارض/ملاحظة على النتيجة", "active": true, "sortOrder": 10 },

    { "key": "RAD_TAT_DELAY", "domainKey": "RADIOLOGY", "classKey": "RAD_TAT", "label_en": "Imaging appointment delay", "label_ar": "تأخير موعد الأشعة", "active": true, "sortOrder": 10 },
    { "key": "RAD_REPORT_DELAY", "domainKey": "RADIOLOGY", "classKey": "RAD_REPORT", "label_en": "Report delay", "label_ar": "تأخير التقرير", "active": true, "sortOrder": 10 },

    { "key": "REG_CHECKIN_WAIT", "domainKey": "REGISTRATION", "classKey": "REG_CHECKIN", "label_en": "Long check-in time", "label_ar": "طول وقت التسجيل", "active": true, "sortOrder": 10 },
    { "key": "REG_INFO_WRONG", "domainKey": "REGISTRATION", "classKey": "REG_INFO_ERROR", "label_en": "Incorrect patient data", "label_ar": "بيانات مريض خاطئة", "active": true, "sortOrder": 10 },

    { "key": "APT_WAIT_LONG", "domainKey": "APPOINTMENTS", "classKey": "APT_WAITING", "label_en": "Long waiting time", "label_ar": "وقت انتظار طويل", "active": true, "sortOrder": 10 },
    { "key": "APT_SCHED_CHANGE", "domainKey": "APPOINTMENTS", "classKey": "APT_SCHEDULING", "label_en": "Appointment changed without notice", "label_ar": "تغيير موعد بدون إشعار", "active": true, "sortOrder": 10 },

    { "key": "BILL_INVOICE_EXTRA", "domainKey": "BILLING", "classKey": "BILL_INVOICE", "label_en": "Unexpected charge", "label_ar": "رسوم غير متوقعة", "active": true, "sortOrder": 10 },
    { "key": "BILL_PAYMENT_REFUND", "domainKey": "BILLING", "classKey": "BILL_PAYMENT", "label_en": "Refund delay", "label_ar": "تأخير استرجاع", "active": true, "sortOrder": 10 },

    { "key": "INS_APPROVAL_TREATMENT", "domainKey": "INSURANCE", "classKey": "INS_APPROVAL_DELAY", "label_en": "Treatment approval delay", "label_ar": "تأخير موافقة علاج", "active": true, "sortOrder": 10 },
    { "key": "INS_DENIAL_REASON", "domainKey": "INSURANCE", "classKey": "INS_DENIAL", "label_en": "Denial without clear reason", "label_ar": "رفض بدون سبب واضح", "active": true, "sortOrder": 10 },

    { "key": "FACILITY_AC", "domainKey": "FACILITY", "classKey": "FACILITY_UTILITIES", "label_en": "AC not working", "label_ar": "التكييف لا يعمل", "active": true, "sortOrder": 10 },
    { "key": "FACILITY_ELEVATOR", "domainKey": "FACILITY", "classKey": "FACILITY_ROOM", "label_en": "Elevator/Access issue", "label_ar": "مشكلة مصعد/وصول", "active": true, "sortOrder": 20 },

    { "key": "HK_DIRTY_ROOM", "domainKey": "HOUSEKEEPING", "classKey": "HK_CLEANLINESS", "label_en": "Room not clean", "label_ar": "الغرفة غير نظيفة", "active": true, "sortOrder": 10 },
    { "key": "HK_WASTE_DELAY", "domainKey": "HOUSEKEEPING", "classKey": "HK_LINEN", "label_en": "Waste/linen not removed", "label_ar": "تأخير إزالة نفايات/مفارش", "active": true, "sortOrder": 10 },

    { "key": "FOOD_DIET_WRONG", "domainKey": "FOOD", "classKey": "FOOD_DIET", "label_en": "Wrong diet order", "label_ar": "حمية غير صحيحة", "active": true, "sortOrder": 10 },
    { "key": "FOOD_QUALITY_COLD", "domainKey": "FOOD", "classKey": "FOOD_QUALITY", "label_en": "Food served cold", "label_ar": "الطعام بارد", "active": true, "sortOrder": 10 },
    { "key": "FOOD_DELIVERY_LATE", "domainKey": "FOOD", "classKey": "FOOD_DELIVERY", "label_en": "Meal delivered late", "label_ar": "تأخير توصيل الوجبة", "active": true, "sortOrder": 10 },

    { "key": "SEC_VISITOR_ISSUE", "domainKey": "SECURITY", "classKey": "SEC_VISITOR", "label_en": "Visitor policy issue", "label_ar": "مشكلة في تنظيم الزيارة", "active": true, "sortOrder": 10 },
    { "key": "SEC_SAFETY_THREAT", "domainKey": "SECURITY", "classKey": "SEC_SAFETY", "label_en": "Safety threat/incident", "label_ar": "تهديد/حادثة أمنية", "active": true, "sortOrder": 10 },

    { "key": "TRN_DELAY_PICKUP", "domainKey": "TRANSPORT", "classKey": "TRN_DELAY", "label_en": "Delayed pickup", "label_ar": "تأخير استلام", "active": true, "sortOrder": 10 },
    { "key": "TRN_SAFETY_HANDLING", "domainKey": "TRANSPORT", "classKey": "TRN_SAFETY", "label_en": "Unsafe handling/transfer", "label_ar": "تعامل غير آمن أثناء النقل", "active": true, "sortOrder": 10 },

    { "key": "PRIV_CONF_ROOM", "domainKey": "PATIENT_RIGHTS", "classKey": "PRIV_CONFIDENTIALITY", "label_en": "Privacy breach in room", "label_ar": "انتهاك خصوصية في الغرفة", "active": true, "sortOrder": 10 },
    { "key": "PRIV_CONSENT_NOT_CLEAR", "domainKey": "PATIENT_RIGHTS", "classKey": "PRIV_CONSENT", "label_en": "Consent not explained clearly", "label_ar": "الموافقة لم تُشرح بوضوح", "active": true, "sortOrder": 10 },

    { "key": "CS_COMM_CLARITY", "domainKey": "COMMUNICATION", "classKey": "CS_COMMUNICATION", "label_en": "Unclear information", "label_ar": "معلومات غير واضحة", "active": true, "sortOrder": 10 },
    { "key": "CS_LANG_INTERPRETER", "domainKey": "COMMUNICATION", "classKey": "CS_LANGUAGE", "label_en": "Interpreter not available", "label_ar": "عدم توفر مترجم", "active": true, "sortOrder": 10 },

    { "key": "IT_LOGIN_FAIL", "domainKey": "IT_SYSTEMS", "classKey": "IT_LOGIN", "label_en": "Unable to login/access", "label_ar": "تعذر الدخول/الصلاحية", "active": true, "sortOrder": 10 },
    { "key": "IT_SYSTEM_SLOW", "domainKey": "IT_SYSTEMS", "classKey": "IT_SYSTEM_DOWN", "label_en": "System slow/downtime", "label_ar": "بطء/تعطل النظام", "active": true, "sortOrder": 10 },

    { "key": "SAFETY_FALL_EVENT", "domainKey": "CLINICAL_SAFETY", "classKey": "SAFETY_FALL", "label_en": "Patient fall event", "label_ar": "سقوط مريض", "active": true, "sortOrder": 10 },
    { "key": "SAFETY_INFECTION_PRECAUTIONS", "domainKey": "CLINICAL_SAFETY", "classKey": "SAFETY_INFECTION", "label_en": "Infection control precautions concern", "label_ar": "ملاحظة على احتياطات مكافحة العدوى", "active": true, "sortOrder": 10 },
    { "key": "SAFETY_ID_WRONG_BAND", "domainKey": "CLINICAL_SAFETY", "classKey": "SAFETY_ID", "label_en": "Identification band/verification issue", "label_ar": "مشكلة سوار/تحقق الهوية", "active": true, "sortOrder": 10 },

    { "key": "DISCH_DELAY_PAPERWORK", "domainKey": "DISCHARGE", "classKey": "DISCH_DELAY", "label_en": "Paperwork/process delay", "label_ar": "تأخير أوراق/إجراءات", "active": true, "sortOrder": 10 },
    { "key": "DISCH_EDU_NOT_CLEAR", "domainKey": "DISCHARGE", "classKey": "DISCH_EDU", "label_en": "Instructions not clear", "label_ar": "تعليمات غير واضحة", "active": true, "sortOrder": 10 },
    { "key": "DISCH_MED_DELAY", "domainKey": "DISCHARGE", "classKey": "DISCH_MED", "label_en": "Discharge medication delay", "label_ar": "تأخير أدوية الخروج", "active": true, "sortOrder": 10 }
  ]
};
