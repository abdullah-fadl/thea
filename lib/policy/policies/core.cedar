// Thea EHR — Core Cedar Authorization Policies
// سياسات التفويض الأساسية لنظام Thea للسجلات الصحية الإلكترونية
//
// These policies mirror the legacy if-based checks in withAuthTenant.ts.
// هذه السياسات تعكس الفحوصات القديمة المبنية على if في withAuthTenant.ts.
//
// IMPORTANT: Cedar is in shadow-eval mode (FF_CEDAR_SHADOW_EVAL).
// هام: Cedar في وضع التقييم الظلي فقط (FF_CEDAR_SHADOW_EVAL).
// Cedar decisions are logged but NEVER returned to callers.
// يتم تسجيل قرارات Cedar ولكنها لا ترسل مطلقاً إلى المستدعين.

// ─── Policy 1: Tenant-scoped read ────────────────────────────────────────────
// Any authenticated User may Read any Resource that belongs to their own tenant.
// يُسمح لأي مستخدم مصادق عليه بقراءة أي مورد ينتمي إلى مستأجره.
permit (
    principal is Thea::User,
    action == Thea::Action::"Read",
    resource is Thea::Resource
)
when {
    principal.tenantId == resource.tenantId
};

// ─── Policy 2: Hospital-scoped read ──────────────────────────────────────────
// A User may Read a HospitalResource only when both tenant and hospital match.
// This mirrors the FF_HOSPITAL_SCOPED_GUARD check from Phase 2.3.
// يُسمح للمستخدم بقراءة مورد المستشفى فقط عند تطابق المستأجر والمستشفى معاً.
// هذا يعكس فحص FF_HOSPITAL_SCOPED_GUARD من المرحلة 2.3.
permit (
    principal is Thea::User,
    action == Thea::Action::"Read",
    resource is Thea::HospitalResource
)
when {
    principal.tenantId == resource.tenantId &&
    principal.hospitalId == resource.hospitalId
};

// ─── Policy 3: Owner-role bypass ─────────────────────────────────────────────
// A User with role "thea-owner" is permitted all actions on all resources.
// This mirrors the isOwnerRole bypass in withAuthTenant.ts.
// يُسمح للمستخدم بدور "thea-owner" بجميع الإجراءات على جميع الموارد.
// هذا يعكس تجاوز isOwnerRole في withAuthTenant.ts.
permit (
    principal is Thea::User,
    action,
    resource
)
when {
    principal.role == "thea-owner"
};
