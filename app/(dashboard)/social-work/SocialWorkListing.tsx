'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function SocialWorkListing() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data, mutate, isLoading } = useSWR('/api/social-work', fetcher, {
    refreshInterval: 30000,
  });

  const assessments: any[] = Array.isArray(data?.assessments) ? data.assessments : [];

  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patientMasterId: '',
    episodeId: '',
    referralReason: '',
    livingArrangement: '',
    supportSystem: '',
    barriers: '',
    plan: '',
    dischargeBarriers: '',
    followUpPlan: '',
  });

  const kpis = {
    total: assessments.length,
    active: assessments.filter((a) => a.status === 'ACTIVE' || !a.status).length,
    dischargePlanning: assessments.filter((a) => a.dischargeBarriers).length,
    followUp: assessments.filter((a) => a.followUpPlan).length,
  };

  const handleCreate = async () => {
    if (!form.patientMasterId.trim() || !form.referralReason.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/social-work', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({
          patientMasterId: '',
          episodeId: '',
          referralReason: '',
          livingArrangement: '',
          supportSystem: '',
          barriers: '',
          plan: '',
          dischargeBarriers: '',
          followUpPlan: '',
        });
        await mutate();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {tr('الخدمة الاجتماعية', 'Social Work')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة تقييمات وحالات الخدمة الاجتماعية', 'Manage social work assessments and cases')}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          {tr('تقييم جديد', 'New Assessment')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: tr('إجمالي التقييمات', 'Total Assessments'), value: kpis.total, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('الحالات النشطة', 'Active Cases'), value: kpis.active, color: 'bg-green-50 border-green-200 text-green-800' },
          { label: tr('تخطيط الخروج', 'Discharge Planning'), value: kpis.dischargePlanning, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: tr('تحتاج متابعة', 'Follow-up Needed'), value: kpis.followUp, color: 'bg-purple-50 border-purple-200 text-purple-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.color}`}>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-base">{tr('التقييمات', 'Assessments')}</h2>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : assessments.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {tr('لا توجد تقييمات بعد', 'No assessments yet')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-start font-semibold">{tr('رقم المريض', 'Patient ID')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('سبب الإحالة', 'Reason')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('نظام الدعم', 'Support System')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('وضع السكن', 'Living Arrangement')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('التاريخ', 'Date')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a: any) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{a.patientMasterId}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate">{a.referralReason}</td>
                    <td className="px-4 py-3">
                      {a.supportSystem ? (
                        <span className="text-xs">{a.supportSystem}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.livingArrangement ? (
                        <span className="text-xs">{a.livingArrangement}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.assessmentDate
                        ? new Date(a.assessmentDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/social-work/${a.id}`}>
                        <Button variant="outline" size="sm">
                          {tr('عرض', 'View')}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Assessment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('تقييم اجتماعي جديد', 'New Social Work Assessment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('رقم المريض', 'Patient Master ID')} *</Label>
                <Input
                  value={form.patientMasterId}
                  onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                  placeholder="PM-..."
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('رقم الرقاد', 'Episode ID')}</Label>
                <Input
                  value={form.episodeId}
                  onChange={(e) => setForm((f) => ({ ...f, episodeId: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('سبب الإحالة', 'Referral Reason')} *</Label>
              <Textarea
                value={form.referralReason}
                onChange={(e) => setForm((f) => ({ ...f, referralReason: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{tr('وضع السكن', 'Living Arrangement')}</Label>
                <Input
                  value={form.livingArrangement}
                  onChange={(e) => setForm((f) => ({ ...f, livingArrangement: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{tr('نظام الدعم', 'Support System')}</Label>
                <Input
                  value={form.supportSystem}
                  onChange={(e) => setForm((f) => ({ ...f, supportSystem: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr('العوائق', 'Barriers')}</Label>
              <Textarea
                value={form.barriers}
                onChange={(e) => setForm((f) => ({ ...f, barriers: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('الخطة', 'Plan')}</Label>
              <Textarea
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('عوائق الخروج', 'Discharge Barriers')}</Label>
              <Textarea
                value={form.dischargeBarriers}
                onChange={(e) => setForm((f) => ({ ...f, dischargeBarriers: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr('خطة المتابعة', 'Follow-up Plan')}</Label>
              <Textarea
                value={form.followUpPlan}
                onChange={(e) => setForm((f) => ({ ...f, followUpPlan: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowNew(false)} disabled={busy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={busy || !form.patientMasterId.trim() || !form.referralReason.trim()}
              >
                {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
