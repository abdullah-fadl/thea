'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = async (url: string) => {
  const r = await fetch(url, { credentials: 'include' });
  const json = await r.json().catch(() => ({}));
  return { ...json, _status: r.status };
};

export type CrudField =
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | {
      key: string;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }> | ((form: Record<string, any>) => Array<{ value: string; label: string }>);
      clearOnChange?: string[];
    };

export function ClinicalInfraCrudPage(args: {
  title: string;
  endpoint: string;
  fields: CrudField[];
}) {
  const { title, endpoint, fields } = args;
  const pathname = usePathname();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const QUICK_LINKS = [
    { href: '/admin/clinical-infra/facilities', label: tr('المرافق', 'Facilities') },
    { href: '/admin/clinical-infra/units', label: tr('الوحدات السريرية', 'Clinical Units') },
    { href: '/admin/clinical-infra/floors', label: tr('الطوابق', 'Floors') },
    { href: '/admin/clinical-infra/rooms', label: tr('الغرف', 'Rooms') },
    { href: '/admin/clinical-infra/beds', label: tr('الأسرّة', 'Beds') },
    { href: '/admin/clinical-infra/specialties', label: tr('التخصصات', 'Specialties') },
    { href: '/admin/clinical-infra/clinics', label: tr('العيادات', 'Clinics') },
    { href: '/admin/clinical-infra/providers', label: tr('مقدمو الخدمة', 'Providers') },
  ];
  const { data, mutate } = useSWR(endpoint, fetcher);
  const status = Number(data?._status || 0);
  const items = Array.isArray(data?.items) ? data.items : [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }, [items]);

  const startCreate = () => {
    setEditId(null);
    setForm({});
    setOpen(true);
  };

  const startEdit = (item: any) => {
    setEditId(String(item.id));
    const next: Record<string, any> = {};
    for (const f of fields) next[f.key] = item[f.key] ?? '';
    setForm(next);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { ...form, id: editId } : { ...form };
      const res = await fetch(endpoint, {
        credentials: 'include',
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(payload?.error || tr('فشل الطلب', 'Request failed'));
        return;
      }
      setOpen(false);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm(tr('هل تريد أرشفة هذا العنصر؟', 'Archive this item?'))) return;
    const res = await fetch(endpoint, {
      credentials: 'include',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) mutate();
  };

  const deleteItem = (id: string) => {
    setDeleteId(id);
    setDeleteCode('');
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const adminCode = String(deleteCode || '').trim();
    if (!adminCode) {
      setDeleteError(tr('رمز الحذف الإداري مطلوب.', 'Admin delete code is required.'));
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(endpoint, {
        credentials: 'include',
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-delete-code': adminCode },
        body: JSON.stringify({ id: deleteId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(payload?.error || tr('فشل الحذف', 'Failed to delete'));
        return;
      }
      setDeleteOpen(false);
      setDeleteId(null);
      setDeleteCode('');
      mutate();
    } finally {
      setDeleteBusy(false);
    }
  };

  const copyInternalId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // ignore copy failures
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-4">
      {status === 403 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{tr('محظور', 'Forbidden')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tr('هذا القسم مقتصر على مستخدمي المستأجر الإداري/التطوير.', 'This section is restricted to admin/dev tenant users.')}
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Button key={link.href} asChild size="sm" variant={isActive ? 'secondary' : 'outline'}>
              <Link href={link.href} aria-current={isActive ? 'page' : undefined}>
                {link.label}
              </Link>
            </Button>
          );
        })}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button onClick={startCreate}>{tr('إنشاء', 'Create')}</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name || it.displayName || it.label || it.id}</div>
                <div className="text-muted-foreground truncate">
                  {it.shortCode ? `publicId=${it.shortCode} • ` : ''}
                  {it.code ? `code=${it.code} • ` : ''}
                  {it.unitType ? `unitType=${it.unitType} • ` : ''}
                  {it.roomType ? `roomType=${it.roomType} • ` : ''}
                  {it.bedType ? `bedType=${it.bedType} • ` : ''}
                  {it.status ? `status=${it.status} • ` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {it.isArchived ? <Badge variant="outline">{tr('مؤرشف', 'Archived')}</Badge> : null}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyInternalId(String(it.id))}
                  title={tr('نسخ المعرف الداخلي', 'Copy internal ID')}
                  aria-label={tr('نسخ المعرف الداخلي', 'Copy internal ID')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {copiedId === String(it.id) ? <span className="text-xs text-muted-foreground">{tr('تم النسخ', 'Copied')}</span> : null}
                <Button size="sm" variant="outline" onClick={() => startEdit(it)}>
                  {tr('تعديل', 'Edit')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => archive(String(it.id))} disabled={!!it.isArchived}>
                  {tr('أرشفة', 'Archive')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteItem(String(it.id))}>
                  {tr('حذف', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
          {!sorted.length ? <div className="text-sm text-muted-foreground">{tr('لا توجد عناصر.', 'No items.')}</div> : null}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? tr('تعديل', 'Edit') : tr('إنشاء', 'Create')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {fields.map((f) => {
              if (f.type === 'text') {
                return (
                  <div key={f.key} className="space-y-2">
                    <Label>{f.label}</Label>
                    <Input
                      value={String(form[f.key] ?? '')}
                      placeholder={f.placeholder}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  </div>
                );
              }
              const options = typeof f.options === 'function' ? f.options(form) : f.options;
              return (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Select
                    value={String(form[f.key] ?? '')}
                    onValueChange={(v) =>
                      setForm((s) => {
                        const next = { ...s, [f.key]: v };
                        for (const key of f.clearOnChange || []) {
                          next[key] = '';
                        }
                        return next;
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tr('اختر...', 'Select...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('حذف العنصر', 'Delete item')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{tr('هذا الإجراء دائم. أدخل رمز الحذف الإداري للمتابعة.', 'This action is permanent. Enter admin delete code to proceed.')}</p>
            <div className="space-y-2">
              <Label>{tr('رمز الحذف الإداري', 'Admin delete code')}</Label>
              <Input
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                placeholder={tr('أدخل الرمز', 'Enter code')}
                type="password"
                autoFocus
              />
              {deleteError ? <div className="text-xs text-destructive">{deleteError}</div> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? tr('جاري الحذف...', 'Deleting...') : tr('حذف', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

