/**
 * Imdad Permissions Registry
 *
 * Canonical list of all SCM permission keys with bilingual labels.
 * Also provides helpers to group permissions by module.
 */

export interface PermissionDef {
  key: string;
  module: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

// ---------------------------------------------------------------------------
// Flat permission map  (key -> definition)
// ---------------------------------------------------------------------------

export const IMDAD_PERMISSIONS: Record<string, PermissionDef> = {
  // Admin
  'imdad.admin.manage': { key: 'imdad.admin.manage', module: 'admin', nameEn: 'Admin Manage', nameAr: '\u0625\u062f\u0627\u0631\u0629', descriptionEn: 'Full admin access', descriptionAr: '\u0648\u0635\u0648\u0644 \u0625\u062f\u0627\u0631\u064a \u0643\u0627\u0645\u0644' },
  'imdad.admin.settings': { key: 'imdad.admin.settings', module: 'admin', nameEn: 'Settings', nameAr: '\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a', descriptionEn: 'Manage system settings', descriptionAr: '\u0625\u062f\u0627\u0631\u0629 \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0646\u0638\u0627\u0645' },
  'imdad.admin.view': { key: 'imdad.admin.view', module: 'admin', nameEn: 'Admin View', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0625\u062f\u0627\u0631\u0629', descriptionEn: 'View admin dashboard', descriptionAr: '\u0639\u0631\u0636 \u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629' },
  'imdad.admin.permissions.view': { key: 'imdad.admin.permissions.view', module: 'admin', nameEn: 'View Permissions', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a', descriptionEn: 'View role permissions matrix', descriptionAr: '\u0639\u0631\u0636 \u0645\u0635\u0641\u0648\u0641\u0629 \u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u0623\u062f\u0648\u0627\u0631' },
  'imdad.admin.permissions.manage': { key: 'imdad.admin.permissions.manage', module: 'admin', nameEn: 'Manage Permissions', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a', descriptionEn: 'Create and modify roles/permissions', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0623\u062f\u0648\u0627\u0631 \u0648\u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0627\u062a' },
  'imdad.admin.jobs.execute': { key: 'imdad.admin.jobs.execute', module: 'admin', nameEn: 'Execute Jobs', nameAr: '\u062a\u0646\u0641\u064a\u0630 \u0627\u0644\u0645\u0647\u0627\u0645', descriptionEn: 'Manually trigger background jobs', descriptionAr: '\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062e\u0644\u0641\u064a\u0629 \u064a\u062f\u0648\u064a\u0627\u064b' },

  // Inventory
  'imdad.inventory.view': { key: 'imdad.inventory.view', module: 'inventory', nameEn: 'View Inventory', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0645\u062e\u0632\u0648\u0646', descriptionEn: 'View inventory items and stock levels', descriptionAr: '\u0639\u0631\u0636 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0645\u0633\u062a\u0648\u064a\u0627\u062a \u0627\u0644\u0645\u062e\u0632\u0648\u0646' },
  'imdad.inventory.manage': { key: 'imdad.inventory.manage', module: 'inventory', nameEn: 'Manage Inventory', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646', descriptionEn: 'Create, update, and adjust inventory', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u062a\u0639\u062f\u064a\u0644 \u0648\u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646' },

  // Procurement
  'imdad.procurement.view': { key: 'imdad.procurement.view', module: 'procurement', nameEn: 'View Procurement', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a', descriptionEn: 'View POs, vendors, and contracts', descriptionAr: '\u0639\u0631\u0636 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646' },
  'imdad.procurement.manage': { key: 'imdad.procurement.manage', module: 'procurement', nameEn: 'Manage Procurement', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a', descriptionEn: 'Create and manage purchase orders', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u062f\u0627\u0631\u0629 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621' },
  'imdad.procurement.grn.receive': { key: 'imdad.procurement.grn.receive', module: 'procurement', nameEn: 'Receive Goods', nameAr: '\u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0628\u0636\u0627\u0626\u0639', descriptionEn: 'Receive and verify goods receiving notes', descriptionAr: '\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0645\u0630\u0643\u0631\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645' },

  // Financial
  'imdad.financial.view': { key: 'imdad.financial.view', module: 'financial', nameEn: 'View Financial', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0645\u0627\u0644\u064a\u0629', descriptionEn: 'View invoices, payments, and budgets', descriptionAr: '\u0639\u0631\u0636 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0627\u062a' },
  'imdad.financial.manage': { key: 'imdad.financial.manage', module: 'financial', nameEn: 'Manage Financial', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629', descriptionEn: 'Create and manage financial records', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0627\u0644\u064a\u0629' },

  // Quality
  'imdad.quality.view': { key: 'imdad.quality.view', module: 'quality', nameEn: 'View Quality', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u062c\u0648\u062f\u0629', descriptionEn: 'View quality inspections and reports', descriptionAr: '\u0639\u0631\u0636 \u0641\u062d\u0648\u0635\u0627\u062a \u0627\u0644\u062c\u0648\u062f\u0629 \u0648\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631' },
  'imdad.quality.manage': { key: 'imdad.quality.manage', module: 'quality', nameEn: 'Manage Quality', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062c\u0648\u062f\u0629', descriptionEn: 'Create and manage quality records', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u062f\u0627\u0631\u0629 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062c\u0648\u062f\u0629' },

  // Assets
  'imdad.assets.view': { key: 'imdad.assets.view', module: 'assets', nameEn: 'View Assets', nameAr: '\u0639\u0631\u0636 \u0627\u0644\u0623\u0635\u0648\u0644', descriptionEn: 'View asset registry', descriptionAr: '\u0639\u0631\u0636 \u0633\u062c\u0644 \u0627\u0644\u0623\u0635\u0648\u0644' },
  'imdad.assets.manage': { key: 'imdad.assets.manage', module: 'assets', nameEn: 'Manage Assets', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0623\u0635\u0648\u0644', descriptionEn: 'Create and manage assets', descriptionAr: '\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0623\u0635\u0648\u0644' },

  // Workflow
  'imdad.workflow.manage': { key: 'imdad.workflow.manage', module: 'workflow', nameEn: 'Manage Workflow', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0633\u064a\u0631 \u0627\u0644\u0639\u0645\u0644', descriptionEn: 'Submit and approve workflow requests', descriptionAr: '\u062a\u0642\u062f\u064a\u0645 \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u0637\u0644\u0628\u0627\u062a \u0633\u064a\u0631 \u0627\u0644\u0639\u0645\u0644' },

  // Integrations
  'imdad.integrations.sfda.verify': { key: 'imdad.integrations.sfda.verify', module: 'integrations', nameEn: 'SFDA Verify', nameAr: '\u062a\u062d\u0642\u0642 \u0647\u064a\u0626\u0629 \u0627\u0644\u063a\u0630\u0627\u0621 \u0648\u0627\u0644\u062f\u0648\u0627\u0621', descriptionEn: 'Verify products via SFDA', descriptionAr: '\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0639\u0628\u0631 \u0647\u064a\u0626\u0629 \u0627\u0644\u063a\u0630\u0627\u0621 \u0648\u0627\u0644\u062f\u0648\u0627\u0621' },
  'imdad.integrations.sfda.track_trace': { key: 'imdad.integrations.sfda.track_trace', module: 'integrations', nameEn: 'SFDA Track & Trace', nameAr: '\u062a\u062a\u0628\u0639 \u0647\u064a\u0626\u0629 \u0627\u0644\u063a\u0630\u0627\u0621 \u0648\u0627\u0644\u062f\u0648\u0627\u0621', descriptionEn: 'Submit drug serialization data', descriptionAr: '\u0625\u0631\u0633\u0627\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u062a\u0633\u0644\u0633\u0644 \u0627\u0644\u0623\u062f\u0648\u064a\u0629' },
  'imdad.integrations.webhook.manage': { key: 'imdad.integrations.webhook.manage', module: 'integrations', nameEn: 'Manage Webhooks', nameAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0648\u064a\u0628 \u0647\u0648\u0643', descriptionEn: 'Configure and test webhooks', descriptionAr: '\u062a\u0643\u0648\u064a\u0646 \u0648\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0648\u064a\u0628 \u0647\u0648\u0643' },

  // Notifications
  'imdad.notifications.create': { key: 'imdad.notifications.create', module: 'notifications', nameEn: 'Create Notifications', nameAr: '\u0625\u0646\u0634\u0627\u0621 \u0625\u0634\u0639\u0627\u0631\u0627\u062a', descriptionEn: 'Send notifications', descriptionAr: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a' },

  // Audit
  'imdad.audit.view': { key: 'imdad.audit.view', module: 'audit', nameEn: 'View Audit Logs', nameAr: '\u0639\u0631\u0636 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u062a\u062f\u0642\u064a\u0642', descriptionEn: 'View audit trail', descriptionAr: '\u0639\u0631\u0636 \u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u062f\u0642\u064a\u0642' },
};

// ---------------------------------------------------------------------------
// Module labels (for the permissions matrix UI)
// ---------------------------------------------------------------------------

export const IMDAD_MODULE_LABELS: Record<string, { en: string; ar: string }> = {
  admin: { en: 'Administration', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629' },
  inventory: { en: 'Inventory', ar: '\u0627\u0644\u0645\u062e\u0632\u0648\u0646' },
  procurement: { en: 'Procurement', ar: '\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a' },
  financial: { en: 'Financial', ar: '\u0627\u0644\u0645\u0627\u0644\u064a\u0629' },
  quality: { en: 'Quality', ar: '\u0627\u0644\u062c\u0648\u062f\u0629' },
  assets: { en: 'Assets', ar: '\u0627\u0644\u0623\u0635\u0648\u0644' },
  workflow: { en: 'Workflow', ar: '\u0633\u064a\u0631 \u0627\u0644\u0639\u0645\u0644' },
  integrations: { en: 'Integrations', ar: '\u0627\u0644\u062a\u0643\u0627\u0645\u0644\u0627\u062a' },
  notifications: { en: 'Notifications', ar: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a' },
  audit: { en: 'Audit', ar: '\u0627\u0644\u062a\u062f\u0642\u064a\u0642' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group all permissions by their module field. */
export function getImdadPermissionsByModule(): Record<string, PermissionDef[]> {
  const groups: Record<string, PermissionDef[]> = {};
  for (const perm of Object.values(IMDAD_PERMISSIONS)) {
    if (!groups[perm.module]) groups[perm.module] = [];
    groups[perm.module].push(perm);
  }
  return groups;
}
