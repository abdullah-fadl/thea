// CVision — HR / Payroll Cedar Policies (Phase 7.6, shadow-only)
// سياسات Cedar للموارد البشرية والرواتب في منصة CVision (المرحلة 7.6 — تقييم ظلي فقط)
//
// Mirrors the legacy CVISION_PERMISSIONS.EMPLOYEES_READ + PAYROLL_APPROVE checks.
// Cedar is in shadow-eval mode: decisions are LOGGED, never enforced.
// تعكس فحوصات CVISION_PERMISSIONS.EMPLOYEES_READ و PAYROLL_APPROVE القديمة.
// Cedar في وضع التقييم الظلي: تُسجَّل القرارات ولا تُفرض.

// ─── Policy 1: Tenant-scoped View on a CvisionEmployee ──────────────────────
// A User may View a CvisionEmployee only when their tenant matches the employee's
// tenant. Hospital scoping is not applied — CVision is org-scoped, not hospital-scoped.
// يُسمح للمستخدم بعرض موظف CVision فقط عند تطابق المستأجر.
// لا يُطبَّق نطاق المستشفى — CVision على مستوى المنظمة، وليس المستشفى.
permit (
    principal is Thea::User,
    action == Thea::Action::"View",
    resource is Thea::CvisionEmployee
)
when {
    principal.tenantId == resource.tenantId
};

// ─── Policy 2: Payroll Approve requires HR / payroll role ───────────────────
// A User may Approve a payroll-related CvisionEmployee aggregate only when
// the tenant matches AND they hold an HR / payroll-approver role. This mirrors
// CVISION_PERMISSIONS.PAYROLL_APPROVE, which is gated on cvision.payroll.approve.
// يُسمح للمستخدم باعتماد صرف الرواتب فقط عند تطابق المستأجر وحمله دور
// الموارد البشرية أو معتمد الرواتب. هذا يعكس CVISION_PERMISSIONS.PAYROLL_APPROVE.
permit (
    principal is Thea::User,
    action == Thea::Action::"Approve",
    resource is Thea::CvisionEmployee
)
when {
    principal.tenantId == resource.tenantId &&
    (
        principal.role == "hr-manager" ||
        principal.role == "payroll-approver" ||
        principal.role == "thea-owner"
    )
};
