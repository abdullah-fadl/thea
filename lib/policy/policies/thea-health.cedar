// Thea Health — Clinical Encounter Cedar Policies (Phase 7.6, shadow-only)
// سياسات Cedar للقاء السريري في منصة Thea للصحة (المرحلة 7.6 — تقييم ظلي فقط)
//
// Mirrors the legacy permissionKey checks in withAuthTenant for OPD encounters
// and lab results. Cedar is in shadow-eval mode: decisions are LOGGED, never enforced.
// تعكس فحوصات permissionKey القديمة في withAuthTenant للقاءات العيادات الخارجية
// ونتائج المختبر. Cedar في وضع التقييم الظلي: تُسجَّل القرارات ولا تُفرض.

// ─── Policy 1: Tenant + hospital scoped View on a ClinicalEncounter ─────────
// A User may View a ClinicalEncounter only when both tenant and hospital match.
// يُسمح للمستخدم بعرض اللقاء السريري فقط عند تطابق المستأجر والمستشفى.
permit (
    principal is Thea::User,
    action == Thea::Action::"View",
    resource is Thea::ClinicalEncounter
)
when {
    principal.tenantId == resource.tenantId &&
    principal.hospitalId == resource.hospitalId
};

// ─── Policy 2: Tenant-scoped Update on an OPEN ClinicalEncounter ────────────
// A User may Update a ClinicalEncounter only when the tenant matches and the
// encounter is still in OPEN status. Closed encounters are read-only at this layer.
// يُسمح للمستخدم بتحديث اللقاء السريري فقط عند تطابق المستأجر وكون اللقاء مفتوحاً.
// اللقاءات المغلقة تكون للقراءة فقط على هذا المستوى.
permit (
    principal is Thea::User,
    action == Thea::Action::"Update",
    resource is Thea::ClinicalEncounter
)
when {
    principal.tenantId == resource.tenantId &&
    resource.status == "OPEN"
};
