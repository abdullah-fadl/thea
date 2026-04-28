import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface PermissionRow {
  key: string;
  label: string;
  category: string;
  group?: string;
  hidden?: boolean;
}

interface PermissionsMatrixProps {
  permissionsByCategory: Record<string, PermissionRow[]>;
  selectedPermissions: string[];
  language?: string;
  onTogglePermission: (permissionKey: string, checked: boolean) => void;
  onToggleCategory: (category: string, checked: boolean) => void;
}

const ACTION_LABELS_EN: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  update: 'Update',
  delete: 'Delete',
  manage: 'Manage',
  assign: 'Assign',
  close: 'Close',
  read: 'Read',
  write: 'Write',
  seed: 'Seed',
  analyze: 'Analyze',
  resolve: 'Resolve',
  run: 'Run',
  harmonize: 'Harmonize',
  post: 'Post',
  unpost: 'Unpost',
  cancel: 'Cancel',
  approve: 'Approve',
  reject: 'Reject',
  other: 'Other',
};

const ACTION_LABELS_AR: Record<string, string> = {
  view: 'عرض',
  create: 'إنشاء',
  edit: 'تعديل',
  update: 'تحديث',
  delete: 'حذف',
  manage: 'إدارة',
  assign: 'تعيين',
  close: 'إغلاق',
  read: 'قراءة',
  write: 'كتابة',
  seed: 'تهيئة',
  analyze: 'تحليل',
  resolve: 'معالجة',
  run: 'تشغيل',
  harmonize: 'مواءمة',
  post: 'ترحيل',
  unpost: 'إلغاء الترحيل',
  cancel: 'إلغاء',
  approve: 'اعتماد',
  reject: 'رفض',
  other: 'أخرى',
};

const ACTION_ORDER = [
  'view',
  'create',
  'edit',
  'update',
  'delete',
  'manage',
  'assign',
  'close',
  'read',
  'write',
  'seed',
  'analyze',
  'resolve',
  'run',
  'harmonize',
  'post',
  'unpost',
  'cancel',
  'approve',
  'reject',
];

function toTitleCase(value: string) {
  return value.replace(/(^|[-_ ])\w/g, (m) => m.toUpperCase()).replace(/[-_]/g, ' ');
}

function getActionKey(permissionKey: string) {
  const parts = String(permissionKey || '').split('.');
  return parts.length ? parts[parts.length - 1] : '';
}

function getActionLabel(actionKey: string, language?: string) {
  const map = language === 'ar' ? ACTION_LABELS_AR : ACTION_LABELS_EN;
  return map[actionKey] || toTitleCase(actionKey);
}

function getActionLabelEn(actionKey: string) {
  return ACTION_LABELS_EN[actionKey] || toTitleCase(actionKey);
}

function getPageLabel(permission: PermissionRow, actionKey: string) {
  const label = String(permission.label || '').trim();
  if (!label) return permission.key;
  const actionLabelEn = getActionLabelEn(actionKey).toLowerCase();
  if (label.toLowerCase().startsWith(actionLabelEn)) {
    return label.slice(actionLabelEn.length).trim() || label;
  }
  return label;
}

export function PermissionsMatrix({
  permissionsByCategory,
  selectedPermissions,
  language,
  onTogglePermission,
  onToggleCategory,
}: PermissionsMatrixProps) {
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const categoryData = useMemo(() => {
    return Object.entries(permissionsByCategory).map(([category, permissions]) => {
      const actionSet = new Set<string>();
      const pages: {
        key: string;
        label: string;
        actions: Record<string, string[]>;
      }[] = [];
      const pageIndex = new Map<string, number>();

      // Build group → hidden keys mapping
      const groupHiddenKeys: Record<string, string[]> = {};
      permissions.forEach((p) => {
        if (p.hidden && p.group) {
          if (!groupHiddenKeys[p.group]) groupHiddenKeys[p.group] = [];
          groupHiddenKeys[p.group].push(p.key);
        }
      });

      // Only process visible permissions for the display table
      const visiblePermissions = permissions.filter((p) => !p.hidden);

      visiblePermissions.forEach((permission) => {
        const actionKey = getActionKey(permission.key) || 'other';
        actionSet.add(actionKey);
        const pageLabel = getPageLabel(permission, actionKey);
        const existingIndex = pageIndex.get(pageLabel);
        if (existingIndex !== undefined) {
          const existing = pages[existingIndex];
          existing.actions[actionKey] = [...(existing.actions[actionKey] || []), permission.key];
        } else {
          pageIndex.set(pageLabel, pages.length);
          pages.push({
            key: pageLabel,
            label: pageLabel,
            actions: { [actionKey]: [permission.key] },
          });
        }
      });

      const orderedActions = ACTION_ORDER.filter((action) => actionSet.has(action));
      const extraActions = Array.from(actionSet).filter((action) => !ACTION_ORDER.includes(action));
      const actions = [...orderedActions, ...extraActions.sort()];

      // Total count includes ALL permissions (visible + hidden) for accurate category counter
      const totalPermissions = permissions.length;
      const selectedCount = permissions.filter((p) => selectedPermissions.includes(p.key)).length;

      return {
        category,
        actions,
        pages,
        totalPermissions,
        selectedCount,
        groupHiddenKeys,
      };
    });
  }, [permissionsByCategory, selectedPermissions]);

  // Helper: toggle a key AND all hidden keys in the same group
  function toggleWithGroup(
    key: string,
    checked: boolean,
    allPerms: PermissionRow[],
    groupHiddenKeys: Record<string, string[]>,
  ) {
    onTogglePermission(key, checked);
    const perm = allPerms.find((p) => p.key === key);
    if (perm?.group && groupHiddenKeys[perm.group]) {
      groupHiddenKeys[perm.group].forEach((hiddenKey) => {
        onTogglePermission(hiddenKey, checked);
      });
    }
  }

  const summaryRows = useMemo(() => {
    const rows: { page: string; actions: string[] }[] = [];
    categoryData.forEach((category) => {
      category.pages.forEach((page) => {
        const selectedActions = Object.entries(page.actions)
          .filter(([, keys]) => keys.some((key) => selectedPermissions.includes(key)))
          .map(([actionKey]) => getActionLabel(actionKey, language));
        if (selectedActions.length) {
          rows.push({ page: page.label, actions: selectedActions });
        }
      });
    });
    return rows;
  }, [categoryData, selectedPermissions, language]);

  return (
    <div className="space-y-6">
      {categoryData.map((category) => {
        const allSelected = category.selectedCount === category.totalPermissions;
        const someSelected = category.selectedCount > 0 && !allSelected;
        const allPerms = permissionsByCategory[category.category] || [];
        return (
          <Card key={category.category} className="border-muted/60">
            <CardHeader className="py-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el && 'indeterminate' in el) {
                      (el as unknown as HTMLInputElement).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={(checked) => onToggleCategory(category.category, checked === true)}
                />
                <div className="space-y-0.5">
                  <CardTitle className="text-sm">{category.category}</CardTitle>
                  <CardDescription className="text-xs">
                    {`${category.selectedCount}/${category.totalPermissions} ${tr('محددة', 'selected')}`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">
                        {tr('الصفحة', 'Page')}
                      </TableHead>
                      {category.actions.map((action) => (
                        <TableHead key={action} className="text-center min-w-[110px]">
                          {getActionLabel(action, language)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.pages.map((page) => (
                      <TableRow key={`${category.category}-${page.key}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const pageKeys = Object.values(page.actions).flat();
                              // For checked state, also consider hidden group keys
                              const allRelatedKeys = [...pageKeys];
                              pageKeys.forEach((k) => {
                                const perm = allPerms.find((p) => p.key === k);
                                if (perm?.group && category.groupHiddenKeys[perm.group]) {
                                  allRelatedKeys.push(...category.groupHiddenKeys[perm.group]);
                                }
                              });
                              const uniqueKeys = Array.from(new Set(allRelatedKeys));
                              const isChecked = uniqueKeys.every((key) => selectedPermissions.includes(key));
                              const isPartial =
                                !isChecked && uniqueKeys.some((key) => selectedPermissions.includes(key));
                              return (
                                <Checkbox
                                  checked={isChecked}
                                  ref={(el) => {
                                    if (el && 'indeterminate' in el) {
                                      (el as unknown as HTMLInputElement).indeterminate = isPartial;
                                    }
                                  }}
                                  onCheckedChange={(checked) => {
                                    pageKeys.forEach((key) =>
                                      toggleWithGroup(key, checked === true, allPerms, category.groupHiddenKeys)
                                    );
                                  }}
                                  aria-label={tr('تحديد الصفحة', 'Select page')}
                                />
                              );
                            })()}
                            <span>{page.label}</span>
                          </div>
                        </TableCell>
                        {category.actions.map((action) => {
                          const permissionKeys = page.actions[action] || [];
                          if (permissionKeys.length === 0) {
                            return (
                              <TableCell key={`${page.key}-${action}`} className="text-center text-muted-foreground">
                                —
                              </TableCell>
                            );
                          }
                          const isChecked = permissionKeys.every((key) => selectedPermissions.includes(key));
                          const isPartial =
                            !isChecked && permissionKeys.some((key) => selectedPermissions.includes(key));
                          return (
                            <TableCell key={`${page.key}-${action}`} className="text-center">
                              <Checkbox
                                checked={isChecked}
                                ref={(el) => {
                                  if (el && 'indeterminate' in el) {
                                    (el as unknown as HTMLInputElement).indeterminate = isPartial;
                                  }
                                }}
                                onCheckedChange={(checked) => {
                                  permissionKeys.forEach((key) =>
                                    toggleWithGroup(key, checked === true, allPerms, category.groupHiddenKeys)
                                  );
                                }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-muted/30">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            {tr('ملخص الصلاحيات', 'Permissions Summary')}
          </CardTitle>
          <CardDescription className="text-xs">
            {tr('الصفحات المحددة حالياً', 'Pages currently selected')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {tr('لا توجد صلاحيات محددة', 'No permissions selected')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">{tr('الصفحة', 'Page')}</TableHead>
                    <TableHead>{tr('الصلاحيات', 'Permissions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.map((row) => (
                    <TableRow key={row.page}>
                      <TableCell className="font-medium">{row.page}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.actions.join(' • ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
