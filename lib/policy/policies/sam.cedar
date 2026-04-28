// SAM — Compliance Policy Library Cedar Policies (Phase 7.6, shadow-only)
// سياسات Cedar لمكتبة سياسات الامتثال في منصة SAM (المرحلة 7.6 — تقييم ظلي فقط)
//
// Mirrors the legacy sam.library.list + draft-publish role checks. Only users
// with a compliance / sam-owner role may publish a policy from a draft.
// Cedar is in shadow-eval mode: decisions are LOGGED, never enforced.
// تعكس فحوصات sam.library.list ودور نشر المسودة القديمة. فقط المستخدمون
// الذين لديهم دور الامتثال / sam-owner يمكنهم نشر سياسة من مسودة.
// Cedar في وضع التقييم الظلي: تُسجَّل القرارات ولا تُفرض.

// ─── Policy 1: Tenant-scoped View on a SamPolicy ────────────────────────────
// Any authenticated User may View a SamPolicy that belongs to their own tenant.
// يُسمح لأي مستخدم مصادق عليه بعرض سياسة SAM تنتمي إلى مستأجره.
permit (
    principal is Thea::User,
    action == Thea::Action::"View",
    resource is Thea::SamPolicy
)
when {
    principal.tenantId == resource.tenantId
};

// ─── Policy 2: Publishing a draft policy requires compliance role ───────────
// A User may Approve (publish) a SamPolicy only when the tenant matches AND
// they hold a compliance officer or sam-owner role. The resource.scope attr
// allows future enterprise-wide vs department-only refinement.
// يُسمح للمستخدم باعتماد (نشر) سياسة SAM فقط عند تطابق المستأجر وحمله دور
// مسؤول الامتثال أو sam-owner. سمة resource.scope تسمح بتمييز السياسات
// على مستوى المؤسسة أو القسم في المستقبل.
permit (
    principal is Thea::User,
    action == Thea::Action::"Approve",
    resource is Thea::SamPolicy
)
when {
    principal.tenantId == resource.tenantId &&
    (
        principal.role == "compliance-officer" ||
        principal.role == "sam-owner" ||
        principal.role == "thea-owner"
    )
};
