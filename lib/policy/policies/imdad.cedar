// Imdad — Procurement / Purchase Order Cedar Policies (Phase 7.6, shadow-only)
// سياسات Cedar للمشتريات وأوامر الشراء في منصة Imdad (المرحلة 7.6 — تقييم ظلي فقط)
//
// Mirrors the legacy imdad.procurement.view + imdad.procurement.po.approve checks.
// Adds an amount-tier guard: only senior approvers can approve POs above 100,000 SAR.
// Cedar is in shadow-eval mode: decisions are LOGGED, never enforced.
// تعكس فحوصات imdad.procurement.view و imdad.procurement.po.approve القديمة.
// تضيف حدّ مبلغ: فقط المعتمدون الكبار يمكنهم اعتماد أوامر الشراء فوق 100,000 ريال.
// Cedar في وضع التقييم الظلي: تُسجَّل القرارات ولا تُفرض.

// ─── Policy 1: Tenant-scoped View on an ImdadPurchaseOrder ──────────────────
// A User may View a purchase order only when their tenant matches the PO's tenant.
// يُسمح للمستخدم بعرض أمر شراء فقط عند تطابق المستأجر.
permit (
    principal is Thea::User,
    action == Thea::Action::"View",
    resource is Thea::ImdadPurchaseOrder
)
when {
    principal.tenantId == resource.tenantId
};

// ─── Policy 2: Approve a PO requires procurement-approver role ──────────────
// A User may Approve a purchase order only when tenant matches AND they hold
// a procurement approver role. The "amount" attribute is part of the resource
// shape so future tier-based policies can refine this without schema changes.
// Cedar's free-form Long type is stored on the ImdadPurchaseOrder entity.
// يُسمح للمستخدم باعتماد أمر الشراء فقط عند تطابق المستأجر وحمله دور
// معتمد المشتريات. سمة "amount" جزء من شكل المورد لتمكين قواعد مستقبلية
// مبنية على الفئات السعرية دون تغيير المخطط.
permit (
    principal is Thea::User,
    action == Thea::Action::"Approve",
    resource is Thea::ImdadPurchaseOrder
)
when {
    principal.tenantId == resource.tenantId &&
    (
        principal.role == "procurement-manager" ||
        principal.role == "thea-owner"
    )
};

// ─── Policy 3: Forbid line-staff approval of high-value POs ─────────────────
// Even if a user otherwise had Approve, a "procurement-clerk" can never approve
// a PO whose amount is at or above the 100,000 SAR senior-approver threshold.
// This is a forbid policy, so it overrides any matching permit.
// حتى لو حمل المستخدم صلاحية الاعتماد، فإنه لا يحق لـ "procurement-clerk"
// اعتماد أوامر الشراء التي تساوي أو تتجاوز عتبة 100,000 ريال للمعتمدين الكبار.
// هذه سياسة forbid وتغلب على أي سياسة permit مطابقة.
forbid (
    principal is Thea::User,
    action == Thea::Action::"Approve",
    resource is Thea::ImdadPurchaseOrder
)
when {
    principal.role == "procurement-clerk" &&
    resource.amount >= 100000
};
