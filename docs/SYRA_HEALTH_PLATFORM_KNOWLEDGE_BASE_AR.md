## قاعدة معرفة منصة Thea Health (مرجع شامل)

**آخر تحديث**: 2026-01-22  
**النطاق**: منصة Thea Health داخل مشروع Thea (Next.js App Router + MongoDB tenant DB)  
**هدف الملف**: توثيق منصة الصحة بالكامل: الصفحات، وظائفها، نقاط الدخول، وحدود السلوك، وملخص الوحدات التشغيلية.

> ملاحظة: هذا الملف يصف الواقع الحالي للواجهة والمسارات. بعض الصفحات تحمل عبارة *Placeholder* أو *Frozen* وتعني أنها واجهة ثابتة لأغراض التوافق ولا تحتوي وظائف تشغيلية.

---

## 1) تعريف سريع: ما هي Thea Health؟
- منصة تشغيل المستشفى (ER / OPD / IPD / Registration / Orders / Billing).
- تعتمد على نموذج **Patient Master** و **Encounter Core** كوحدة موحدة لتتبع الزيارة.
- واجهات تنظيمية وتشغيلية للتمريض والطوارئ والعيادات والتنويم.
- تسجيل التدفقات الحساسة عبر **Audit Logs** على مستوى الخادم.
- لا تغييرات تلقائية على صلاحيات المستخدم: الواجهة تعرض حسب الدور، والخادم هو مصدر الحقيقة للتصريح.

---

## 2) نقاط الدخول (Entry Points) ومسارات المنصة

### 2.1 منصة Health
- **المسار**: `/platforms/thea-health`  
  **الوظيفة**: الدخول لمنصة الصحة + توجيه تلقائي حسب الدور (ER/OPD/IPD/Registration/Billing).

### 2.2 صفحة الترحيب (Welcome)
- **المسار**: `/welcome`  
  **الوظيفة**: بطاقات سريعة للوحدات الأساسية حسب صلاحيات المستخدم.

---

## 3) الأساسيات المشتركة (Core)

### 3.1 التسجيل (Registration)
- **المسار**: `/registration`  
  **الوظيفة**:
  - البحث عن مريض (Patient Master).
  - إنشاء مريض جديد (KNOWN/UNKNOWN).
  - فتح Encounter Core (ER/OPD/IPD/PROCEDURE).
  - ربط هوية ER Unknown بـ Patient Master.
  - دمج يدوي لملفات المرضى (Merge) بإجراءات آمنة.
  - عرض طابور الزيارات النشطة.

### 3.2 البحث الموحّد
- **المسار**: `/search`  
  **الوظيفة**:
  - البحث بالاسم أو المعرّفات (National ID/Iqama/Passport) أو MRN أو tempMRN.
  - عرض قائمة مفصولة بحسب الزيارة.
  - روابط سريعة لفتح ملف المريض أو Encounter (حسب النوع).

### 3.3 ملف المريض (Patient Profile)
- **المسار**: `/patient/[patientMasterId]`  
  **الوظيفة**:
  - عرض ملف المريض بشكل موحّد (ديموغرافيا + زيارات + خط زمني).
  - تجميع معلومات من ER/OPD/IPD بدون تعديل بيانات.

---

## 4) الطوارئ (ER)

### صفحات ER الأساسية
- **`/er/register`**: تسجيل سريع (Known/Unknown + طريقة الوصول + نوع الدفع).  
- **`/er/triage/[encounterId]`**: التراياج (الأعراض/العلامات الحيوية/مستوى الخطورة).  
- **`/er/board`**: لوحة التتبع التشغيلية للمرضى في الطوارئ.  
- **`/er/encounter/[encounterId]`**: مساحة عمل الزيارة (Overview/Notes/Orders/Results/Disposition).  
- **`/er/beds`**: خريطة الأسرّة وحالة التوافر.  
- **`/er/nursing`**: مركز تمريض الطوارئ.  
- **`/er/doctor`**: مركز طبيب الطوارئ (Placeholder جزئي حسب الملفات الحالية).  
- **`/er/command`**: لوحة قيادة الطوارئ.  
- **`/er/charge`**: لوحة شفت Charge Nurse/Operations.  
- **`/er/notifications`**: تنبيهات الطوارئ.  
- **`/er/metrics`**: مؤشرات أداء وسلاسل زمنية للطوارئ.

### ملخص التدفق التشغيلي في ER
1. Registration → 2. Triage → 3. Board → 4. Bed Assignment →  
5. Encounter Workspace → 6. Orders/Results → 7. Decision → 8. Disposition.

---

## 5) العيادات الخارجية (OPD)

### صفحات OPD التشغيلية
- **`/opd/registration`**: تسجيل مريض OPD (Known فقط).  
- **`/opd/waiting-list`**: طابور OPD للزيارات النشطة.  
- **`/opd/visit/[visitId]`**: زيارة OPD (Overview + Visit Notes + Orders Hub + Billing Panels).  
- **`/opd/nurse-station`**: **Placeholder** تمريض OPD (واجهة فقط للمعاينة).  

### صفحات OPD التحليلية/الإدارية
- **`/opd/home`**: لوحة مؤشرات OPD.  
- **`/opd/daily-stats`**: تعداد العيادات اليومي.  
- **`/opd/analytics`**: مقارنة أداء الأقسام.  
- **`/opd/room-schedule`**: الاستغلال التشغيلي.  
- **`/opd/data-import`**: استيراد البيانات.  
- **`/opd/staff-setup`**: موارد بشرية للعيادات.  

---

## 6) التنويم (IPD)

### صفحات IPD
- **`/ipd/intake/[handoffId]`**: نموذج إدخال التنويم (Admission Intake).  
- **`/ipd/episode/[episodeId]`**: صفحة حلقة التنويم (Episode).  
- **`/ipd/episode/[episodeId]/continuity`**: حزمة الاستمرارية (Continuity Pack).  
- **`/ipd/audit/[episodeId]`**: مراجعة تدقيق الحلقة.  
- **`/ipd/live-beds`**: **Frozen Placeholder** (واجهة ثابتة للتوافق).

> ملاحظة: تم إخفاء صفحات IPD القديمة من الشريط الجانبي، ويُعرض فقط ما هو متاح فعليًا.

---

## 7) الأقسام (Department Shells)
- **`/departments/[department]`**  
  **الوظيفة**: قوالب تشغيلية موحّدة للدخول/الخروج من القسم بدون منطق سريري.

الأقسام المدعومة:
OPD, Laboratory, Radiology, OR, Cath Lab, Delivery, ICU/Critical Care, Physiotherapy, Mortuary.

---

## 8) أوامر موحّدة (Orders Hub)
- **`/orders`**  
  **الوظيفة**:
  - إدارة الأوامر التشغيلية (LAB/RAD/PROCEDURE).
  - قوائم انتظار الأقسام.
  - حالات الأوامر و Timeline.

---

## 9) الفوترة (Billing – Read-Only + Manual Capture)

### صفحات الفوترة
- **`/billing/statement`**: كشف الزيارة (Statement) + Ledger (قراءة فقط).  
- **`/billing/invoice-draft`**: مسودة فاتورة ديناميكية (Draft).  
- **`/billing/charge-catalog`**: كتالوج البنود القابلة للفوترة.  
- **`/billing/charge-events`**: أحداث رسوم (Charge Events).  
- **`/billing/payments`**: مدفوعات يدوية (Recorded/Voided).  
- **`/billing/insurance`**: بيانات التأمين (Payers/Plans/Policy Notes).  
- **`/billing/claims`**: أدوات مطالبة (Claim Draft + Eligibility Stub).

### ملاحظات مهمة
- لا توجد مطالبات فعلية أو دفع إلكتروني.
- كل الحسابات تُستخرج ديناميكيًا من Charge Events.
- الوصول محكوم بدور Finance/Admin فقط من الواجهة والخادم.

---

## 10) Patient Experience

### صفحات Patient Experience
- **`/patient-experience/dashboard`**: لوحة متابعة التجربة.  
- **`/patient-experience/analytics`**: تحليلات.  
- **`/patient-experience/reports`**: تقارير.  
- **`/patient-experience/visits`**: جميع الزيارات.  
- **`/patient-experience/cases`**: الحالات.  
- **`/patient-experience/visit`**: Visit Wizard.  
- **`/patient-experience/setup`**: الإعداد.  
- **`/patient-experience/seed-data`**: بيانات تجريبية.  
- **`/patient-experience/delete-all-data`**: حذف بيانات.

---

## 11) الجدولة (Scheduling)
- **`/scheduling/scheduling`**: جدول العيادات/الزيارات.  
- **`/scheduling/availability`**: التوافر.

---

## 12) المعدات (Equipment)

### معدات OPD
- **`/equipment/master`**: سجل المعدات.  
- **`/equipment/clinic-map`**: خريطة المعدات.  
- **`/equipment/checklist`**: قائمة تحقق.  
- **`/equipment/movements`**: حركة المعدات.

### معدات IPD
- **`/ipd-equipment/map`**: خريطة معدات التنويم.  
- **`/ipd-equipment/daily-checklist`**: قائمة تحقق يومية.

---

## 13) التمريض والعمليات

### تمريض العمليات
- **`/nursing/operations`**: شاشة عمليات تمريض.

### موارد بشرية وتمريض (OPD)
- **`/opd/staff-setup`** / **`/opd/nurse-roster`**  
  صفحات لإدارة الموارد البشرية في OPD.

---

## 14) الإدارة والحساب

### إدارة (Admin)
- **`/admin/data-admin`**: إدارة البيانات.
- **`/admin/structure-management`**: إدارة الهيكل التنظيمي.
- **`/admin/delete-sample-data`**: حذف بيانات تجريبية.
- **`/admin/groups-hospitals`**: إدارة المجموعات والمستشفيات.
- **`/admin/users`**: المستخدمون.
- **`/admin/quotas`**: حدود الاستخدام (Demo).

### الحساب
- **`/account`**: إعدادات حساب المستخدم.

---

## 15) Test Mode (محاكاة الأدوار – واجهة فقط)
- يظهر للأدمن فقط داخل الشريط الجانبي.
- يتيح اختيار **Area + Position** لمحاكاة قائمة القوائم والـ Landing بدون تغيير صلاحيات حقيقية.
- زر “Go to Landing” ينتقل لمسار الهبوط المتوقع حسب الدور.
- زر “Exit Test Mode” يعيد القائمة الافتراضية.
- أي أكشن ممنوع من الخادم سيُمنع فعليًا حتى في وضع المحاكاة.

---

## 16) ملاحظات تقنية سريعة
- **Tenant‑scoped**: كل البيانات ضمن Tenant DB.
- **Audit‑first**: كل الإنشاءات والتغييرات المهمة تُسجَّل في Audit Logs.
- **Deterministic**: الترتيب والحالات ثابتة لضمان الاستقرار.

---

## 17) فهرس سريع للواجهات الصحية (حسب المسارات)

### Registration / Patient
- `/registration` — استقبال المرضى
- `/search` — بحث موحّد
- `/patient/[patientMasterId]` — ملف المريض

### ER
- `/er/register`
- `/er/triage/[encounterId]`
- `/er/board`
- `/er/encounter/[encounterId]`
- `/er/beds`
- `/er/nursing`
- `/er/doctor`
- `/er/command`
- `/er/charge`
- `/er/notifications`
- `/er/metrics`

### OPD
- `/opd/registration`
- `/opd/waiting-list`
- `/opd/visit/[visitId]`
- `/opd/nurse-station`
- `/opd/home`
- `/opd/daily-stats`
- `/opd/analytics`
- `/opd/room-schedule`
- `/opd/data-import`
- `/opd/staff-setup`

### IPD
- `/ipd/intake/[handoffId]`
- `/ipd/episode/[episodeId]`
- `/ipd/episode/[episodeId]/continuity`
- `/ipd/audit/[episodeId]`
- `/ipd/live-beds` (Frozen Placeholder)

### Orders / Departments
- `/orders`
- `/departments/[department]`

### Billing
- `/billing/statement`
- `/billing/invoice-draft`
- `/billing/charge-catalog`
- `/billing/charge-events`
- `/billing/payments`
- `/billing/insurance`
- `/billing/claims`

### Patient Experience / Scheduling / Equipment / Admin
- `/patient-experience/*`
- `/scheduling/*`
- `/equipment/*`
- `/ipd-equipment/*`
- `/admin/*`
- `/account`

---

## 18) مراجع داخل المشروع
- `components/Sidebar.tsx` — تعريف شريط التنقل وتجميع القوائم  
- `lib/navigation.ts` — سجل التنقل العام + صلاحيات  
- `ER_V1_FOUNDATION.md` — مخطط رحلة الطوارئ  
- `WELCOME_PAGE_IMPLEMENTATION.md` — منطق صفحة الترحيب  
- `PLATFORM_ISOLATION_IMPLEMENTATION.md` — عزل منصات SAM/Health  

