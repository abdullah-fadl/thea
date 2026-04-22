'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Clock, User, ChevronDown, ChevronUp, Plus, MapPin } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_COLORS: Record<string, string> = {
  OPEN:          'bg-red-100 text-red-800',
  INVESTIGATING: 'bg-yellow-100 text-yellow-800',
  CONTAINED:     'bg-blue-100 text-blue-800',
  CLOSED:        'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  OPEN:          { ar: 'مفتوح',    en: 'Open' },
  INVESTIGATING: { ar: 'تحقيق',    en: 'Investigating' },
  CONTAINED:     { ar: 'محتوى',    en: 'Contained' },
  CLOSED:        { ar: 'مغلق',     en: 'Closed' },
};

const SEVERITY_COLORS: Record<string, string> = {
  warning:  'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  info:     'bg-blue-100 text-blue-800',
};

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
}

export default function OutbreaksTab({ tr, language }: Props) {
  const { data, mutate } = useSWR('/api/infection-control/outbreaks', fetcher, { refreshInterval: 30000 });
  const outbreaks: Record<string, unknown>[] = data?.outbreaks || [];
  const statusCounts = data?.statusCounts || {};

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const updateOutbreak = async (alertId: string, updates: any) => {
    setBusy(true);
    try {
      await fetch('/api/infection-control/outbreaks', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, ...updates }),
      });
      await mutate();
    } finally { setBusy(false); }
  };

  const submitAction = async () => {
    if (!actionDialog || !actionText.trim()) return;
    await updateOutbreak(actionDialog, {
      responseAction: { action: actionText, notes: actionNotes },
    });
    setActionDialog(null);
    setActionText('');
    setActionNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['OPEN', 'INVESTIGATING', 'CONTAINED', 'CLOSED'] as const).map((s) => (
          <div key={s} className={`rounded-xl border p-3 text-center ${STATUS_COLORS[s]}`}>
            <p className="text-2xl font-extrabold">{statusCounts[s] || 0}</p>
            <p className="text-xs font-medium mt-1">{tr(STATUS_LABELS[s].ar, STATUS_LABELS[s].en)}</p>
          </div>
        ))}
      </div>

      {/* Outbreak Cards */}
      {outbreaks.length === 0 ? (
        <div className="p-12 text-center bg-card border rounded-2xl">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{tr('لا توجد فاشيات نشطة', 'No active outbreaks')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {outbreaks.map((ob: any) => {
            const isExpanded = expanded[ob.id];
            const actions = Array.isArray(ob.responseActions) ? ob.responseActions : [];
            return (
              <div key={ob.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{ob.organism || tr('غير محدد', 'Unspecified')}</span>
                      <Badge className={SEVERITY_COLORS[ob.severity] || 'bg-muted text-foreground'}>
                        {ob.severity}
                      </Badge>
                      <Badge className={STATUS_COLORS[ob.status] || 'bg-muted'}>
                        {tr(STATUS_LABELS[ob.status]?.ar || ob.status, STATUS_LABELS[ob.status]?.en || ob.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{language === 'ar' ? ob.messageAr || ob.message : ob.message}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      {ob.department && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {ob.department}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ob.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</span>
                      <span>{ob.caseCount} {tr('حالة', 'cases')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ob.status !== 'CLOSED' && (
                      <Select
                        value={ob.status}
                        onValueChange={(v) => updateOutbreak(ob.id, { status: v })}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['OPEN', 'INVESTIGATING', 'CONTAINED', 'CLOSED'].map((s) => (
                            <SelectItem key={s} value={s}>{tr(STATUS_LABELS[s].ar, STATUS_LABELS[s].en)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => toggleExpand(ob.id)}>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
                    {/* Case Timeline */}
                    {ob.relatedCases && ob.relatedCases.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold mb-2">{tr('الحالات المرتبطة', 'Related Cases')}</h4>
                        <div className="space-y-1.5">
                          {ob.relatedCases.map((c: any, i: number) => (
                            <div key={c.id || i} className="flex items-center gap-3 text-xs">
                              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                              <span className="font-mono text-muted-foreground">{c.patientMasterId}</span>
                              <span>{c.infectionType}</span>
                              <span className="text-muted-foreground">
                                {c.reportDate ? new Date(c.reportDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}
                              </span>
                              {c.isolationPrecautions?.length > 0 && (
                                <span className="text-orange-600 text-[10px]">{c.isolationPrecautions.join(', ')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Response Actions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold">{tr('إجراءات الاستجابة', 'Response Actions')}</h4>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setActionDialog(ob.id)}>
                          <Plus className="h-3 w-3" /> {tr('إضافة', 'Add')}
                        </Button>
                      </div>
                      {actions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{tr('لا إجراءات مسجلة', 'No actions recorded')}</p>
                      ) : (
                        <div className="space-y-2">
                          {actions.map((a: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs bg-background rounded-lg p-2.5 border">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium">{a.action}</p>
                                {a.notes && <p className="text-muted-foreground mt-0.5">{a.notes}</p>}
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {a.date ? new Date(a.date).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US') : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('إضافة إجراء استجابة', 'Add Response Action')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tr('الإجراء', 'Action')}</label>
              <Input value={actionText} onChange={(e) => setActionText(e.target.value)} placeholder={tr('مثال: إغلاق الوحدة', 'e.g. Close unit for deep cleaning')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{tr('ملاحظات', 'Notes')}</label>
              <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionDialog(null)}>{tr('إلغاء', 'Cancel')}</Button>
              <Button onClick={submitAction} disabled={busy || !actionText.trim()}>
                {busy ? tr('جاري...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
