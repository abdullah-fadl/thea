'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Scissors, Stethoscope, Syringe, Shield, RefreshCcw, Heart, UserCircle, Check, type LucideIcon } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

type TeamRole = {
  field: string;
  ar: string;
  en: string;
  icon: LucideIcon;
  color: string;
};

const ROLES: TeamRole[] = [
  { field: 'surgeon',          ar: 'الجراح الرئيسي',        en: 'Surgeon',               icon: Scissors,    color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' },
  { field: 'assistantSurgeon', ar: 'الجراح المساعد',         en: 'Assistant Surgeon',     icon: Stethoscope, color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800' },
  { field: 'anesthesiologist', ar: 'طبيب التخدير',           en: 'Anesthesiologist',      icon: Syringe,     color: 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800' },
  { field: 'scrubNurse',       ar: 'ممرضة الأدوات',          en: 'Scrub Nurse',           icon: Shield,      color: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' },
  { field: 'circulatingNurse', ar: 'الممرضة المتداولة',       en: 'Circulating Nurse',     icon: RefreshCcw,  color: 'bg-teal-50 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800' },
  { field: 'perfusionist',     ar: 'اختصاصي الضخ',           en: 'Perfusionist',          icon: Heart,       color: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800' },
  { field: 'specialistConsult', ar: 'استشاري متخصص',          en: 'Specialist Consult',    icon: UserCircle,  color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' },
];

interface OrTeamPanelProps {
  caseId: string;
}

export default function OrTeamPanel({ caseId }: OrTeamPanelProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();

  const { data, mutate } = useSWR(
    caseId ? `/api/or/cases/${caseId}/team` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const existing = data?.team || null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    surgeon: '',
    assistantSurgeon: '',
    anesthesiologist: '',
    scrubNurse: '',
    circulatingNurse: '',
    perfusionist: '',
    specialistConsult: '',
    notes: '',
  });

  // Sync existing data into form when loaded
  useEffect(() => {
    if (existing) {
      setForm({
        surgeon: existing.surgeon || '',
        assistantSurgeon: existing.assistantSurgeon || '',
        anesthesiologist: existing.anesthesiologist || '',
        scrubNurse: existing.scrubNurse || '',
        circulatingNurse: existing.circulatingNurse || '',
        perfusionist: existing.perfusionist || '',
        specialistConsult: existing.specialistConsult || '',
        notes: existing.notes || '',
      });
    }
  }, [existing]);

  const setField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/or/cases/${caseId}/team`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Failed to save'));
      toast({ title: tr('تم حفظ الفريق', 'Team saved') });
      await mutate();
      setEditing(false);
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message, variant: 'destructive' as const });
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = ROLES.filter((r) => existing?.[r.field]).length;
  const totalRoles = ROLES.length;

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header card */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-foreground">{tr('الفريق الجراحي', 'Surgical Team')}</CardTitle>
              <CardDescription>
                {tr('تعيين أعضاء الفريق الجراحي وأدوارهم', 'Assign surgical team members and their roles')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={assignedCount === totalRoles ? 'default' : 'secondary'}>
                {assignedCount}/{totalRoles} {tr('معيّن', 'Assigned')}
              </Badge>
              {!editing ? (
                <Button size="sm" onClick={() => setEditing(true)}>
                  {tr('تعديل', 'Edit Team')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    {tr('إلغاء', 'Cancel')}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Team role cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const value = editing ? form[role.field] : (existing?.[role.field] || '');
          const assigned = Boolean(existing?.[role.field]);
          return (
            <Card key={role.field} className={`rounded-2xl border ${role.color}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2 mb-2">
                  <role.icon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{tr(role.ar, role.en)}</p>
                    {!editing && (
                      assigned
                        ? <Badge variant="outline" className="mt-1 font-mono text-xs truncate max-w-full block">
                            {existing[role.field]}
                          </Badge>
                        : <p className="text-xs text-muted-foreground mt-1">{tr('غير معيّن', 'Not assigned')}</p>
                    )}
                  </div>
                  {!editing && assigned && (
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                  )}
                </div>
                {editing && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{tr('معرف المستخدم', 'User ID')}</Label>
                    <Input
                      value={value}
                      onChange={(e) => setField(role.field, e.target.value)}
                      placeholder={tr('أدخل معرف المستخدم', 'Enter user ID')}
                      className="h-8 text-xs thea-input-focus"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notes */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">{tr('ملاحظات الفريق', 'Team Notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <Textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder={tr('أي ملاحظات خاصة بالفريق...', 'Any team-specific notes...')}
              className="thea-input-focus"
              rows={3}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {existing?.notes || tr('لا توجد ملاحظات', 'No notes recorded')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Completion status */}
      {assignedCount > 0 && !editing && (
        <Card className="rounded-2xl">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{tr('اكتمال تعيين الفريق', 'Team assignment completion')}</span>
                  <span>{Math.round((assignedCount / totalRoles) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(assignedCount / totalRoles) * 100}%` }}
                  />
                </div>
              </div>
              {assignedCount === totalRoles && (
                <Badge className="bg-green-600 text-white">{tr('مكتمل', 'Complete')}</Badge>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const assigned = Boolean(existing?.[role.field]);
                return (
                  <span
                    key={role.field}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                      assigned
                        ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-700 dark:text-green-400'
                        : 'bg-muted/50 border-border text-muted-foreground'
                    }`}
                  >
                    <role.icon className="w-3 h-3" /> {tr(role.ar, role.en)}
                    {assigned ? <Check className="w-3 h-3 inline ml-1" /> : ''}
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
