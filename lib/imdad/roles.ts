/**
 * Imdad Built-In Role Templates
 *
 * Defines the default SCM role templates with their associated
 * permission sets. Custom roles are stored in the database.
 */

export interface RoleTemplate {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  permissions: string[];
  builtIn: true;
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: 'scm-admin',
    nameEn: 'SCM Administrator',
    nameAr: '\u0645\u062f\u064a\u0631 \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f',
    descriptionEn: 'Full access to all SCM modules and settings',
    descriptionAr: '\u0648\u0635\u0648\u0644 \u0643\u0627\u0645\u0644 \u0644\u062c\u0645\u064a\u0639 \u0648\u062d\u062f\u0627\u062a \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f',
    permissions: [
      'imdad.admin.manage', 'imdad.admin.settings', 'imdad.admin.view',
      'imdad.admin.permissions.view', 'imdad.admin.permissions.manage',
      'imdad.admin.jobs.execute',
      'imdad.inventory.view', 'imdad.inventory.manage',
      'imdad.procurement.view', 'imdad.procurement.manage',
      'imdad.procurement.grn.receive',
      'imdad.financial.view', 'imdad.financial.manage',
      'imdad.quality.view', 'imdad.quality.manage',
      'imdad.assets.view', 'imdad.assets.manage',
      'imdad.workflow.manage',
      'imdad.integrations.sfda.verify', 'imdad.integrations.sfda.track_trace',
      'imdad.integrations.webhook.manage',
      'imdad.notifications.create',
      'imdad.audit.view',
    ],
    builtIn: true,
  },
  {
    key: 'scm-procurement-officer',
    nameEn: 'Procurement Officer',
    nameAr: '\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a',
    descriptionEn: 'Manages purchase orders, vendors, and receiving',
    descriptionAr: '\u0625\u062f\u0627\u0631\u0629 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u0645\u0648\u0631\u062f\u064a\u0646 \u0648\u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645',
    permissions: [
      'imdad.procurement.view', 'imdad.procurement.manage',
      'imdad.procurement.grn.receive',
      'imdad.inventory.view',
      'imdad.financial.view',
      'imdad.quality.view',
      'imdad.integrations.sfda.verify',
      'imdad.workflow.manage',
    ],
    builtIn: true,
  },
  {
    key: 'scm-inventory-manager',
    nameEn: 'Inventory Manager',
    nameAr: '\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u062e\u0632\u0648\u0646',
    descriptionEn: 'Manages stock levels, adjustments, and warehouse operations',
    descriptionAr: '\u0625\u062f\u0627\u0631\u0629 \u0645\u0633\u062a\u0648\u064a\u0627\u062a \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0648\u0627\u0644\u062a\u0633\u0648\u064a\u0627\u062a \u0648\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0648\u062f\u0639',
    permissions: [
      'imdad.inventory.view', 'imdad.inventory.manage',
      'imdad.procurement.view',
      'imdad.quality.view',
      'imdad.workflow.manage',
    ],
    builtIn: true,
  },
  {
    key: 'scm-finance-officer',
    nameEn: 'Finance Officer',
    nameAr: '\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u0627\u0644\u064a\u0629',
    descriptionEn: 'Manages invoices, payments, budgets, and cost centers',
    descriptionAr: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0641\u0648\u0627\u062a\u064a\u0631 \u0648\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0648\u0627\u0644\u0645\u064a\u0632\u0627\u0646\u064a\u0627\u062a',
    permissions: [
      'imdad.financial.view', 'imdad.financial.manage',
      'imdad.procurement.view',
      'imdad.audit.view',
    ],
    builtIn: true,
  },
  {
    key: 'scm-quality-inspector',
    nameEn: 'Quality Inspector',
    nameAr: '\u0645\u0641\u062a\u0634 \u0627\u0644\u062c\u0648\u062f\u0629',
    descriptionEn: 'Manages quality inspections, certificates, and compliance',
    descriptionAr: '\u0625\u062f\u0627\u0631\u0629 \u0641\u062d\u0648\u0635\u0627\u062a \u0627\u0644\u062c\u0648\u062f\u0629 \u0648\u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644',
    permissions: [
      'imdad.quality.view', 'imdad.quality.manage',
      'imdad.inventory.view',
      'imdad.integrations.sfda.verify',
    ],
    builtIn: true,
  },
  {
    key: 'scm-viewer',
    nameEn: 'SCM Viewer',
    nameAr: '\u0645\u0634\u0627\u0647\u062f \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f',
    descriptionEn: 'Read-only access to SCM data',
    descriptionAr: '\u0648\u0635\u0648\u0644 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637 \u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0625\u0645\u062f\u0627\u062f',
    permissions: [
      'imdad.inventory.view',
      'imdad.procurement.view',
      'imdad.financial.view',
      'imdad.quality.view',
      'imdad.assets.view',
    ],
    builtIn: true,
  },
];

/** Return all built-in role templates. */
export function getAllRoleTemplates(): RoleTemplate[] {
  return ROLE_TEMPLATES;
}
