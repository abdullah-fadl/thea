'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useMe } from '@/lib/hooks/useMe';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export function TasksPanel({ encounterCoreId }: { encounterCoreId: string }) {
  const { me } = useMe();
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { data, mutate } = useSWR(
    encounterCoreId ? `/api/tasks?encounterCoreId=${encodeURIComponent(encounterCoreId)}` : null,
    fetcher,
    { refreshInterval: 0 }
  );
  const tasks = Array.isArray(data?.items) ? data.items : [];

  const userIds = Array.from(
    new Set(
      tasks
        .map((task: any) => [task.assignedToUserId, task.createdByUserId].filter(Boolean))
        .flat()
        .map((id: any) => String(id))
    )
  );
  const usersUrl = userIds.length ? `/api/tasks/users?ids=${encodeURIComponent(userIds.join(','))}` : null;
  const { data: usersData } = useSWR(usersUrl, fetcher, { refreshInterval: 0 });
  const usersById = (Array.isArray(usersData?.items) ? usersData.items : []).reduce(
    (acc: Record<string, any>, item: any) => {
      acc[String(item.id || '')] = item;
      return acc;
    },
    {} as Record<string, any>
  );
  const displayName = (id?: string | null) => (id ? usersById[String(id)]?.display || id : '—');

  const roleLower = String(me?.user?.role || '').toLowerCase();
  const email = String(me?.user?.email || '').trim().toLowerCase();
  const canNurseActions =
    roleLower.includes('nurse') || roleLower.includes('charge') || roleLower.includes('admin');
  const canCancel =
    roleLower.includes('doctor') ||
    roleLower.includes('physician') ||
    roleLower.includes('charge') ||
    roleLower.includes('admin');

  const [notDoneOpen, setNotDoneOpen] = useState(false);
  const [notDoneReason, setNotDoneReason] = useState('');
  const [activeTaskId, setActiveTaskId] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const runAction = async (taskId: string, path: string, body?: any) => {
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/${path}`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed');
      toast({ title: payload.noOp ? tr('لا تغيير', 'No change') : tr('تم التحديث', 'Updated') });
      await mutate();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشل', 'Failed'), variant: 'destructive' as const });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr('المهام', 'Tasks')}</CardTitle>
        <CardDescription>{tr('مهام التمريض التشغيلية', 'Operational nursing tasks')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tr('العنوان', 'Title')}</TableHead>
              <TableHead>{tr('النوع', 'Type')}</TableHead>
              <TableHead>{tr('الحالة', 'Status')}</TableHead>
              <TableHead>{tr('مستلم من', 'Claimed By')}</TableHead>
              <TableHead>{tr('أنشئ بواسطة', 'Created By')}</TableHead>
              <TableHead>{tr('الإجراءات', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length ? (
              tasks.map((task: any) => (
                <TableRow key={task.id}>
                  <TableCell>{task.title}</TableCell>
                  <TableCell className="text-xs">{task.taskType}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{task.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{displayName(task.assignedToUserId)}</TableCell>
                  <TableCell className="text-xs">{displayName(task.createdByUserId)}</TableCell>
                  <TableCell className="space-x-2">
                    {canNurseActions ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => runAction(task.id, 'claim')}>
                          {tr('استلام', 'Claim')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => runAction(task.id, 'unclaim')}>
                          {tr('إلغاء الاستلام', 'Unclaim')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => runAction(task.id, 'start')}>
                          {tr('بدء', 'Start')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => runAction(task.id, 'done')}>
                          {tr('إكمال', 'Done')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveTaskId(task.id);
                            setNotDoneOpen(true);
                          }}
                        >
                          {tr('تحديد كغير منجز', 'Not Done')}
                        </Button>
                      </>
                    ) : null}
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTaskId(task.id);
                          setCancelOpen(true);
                        }}
                      >
                        {tr('إلغاء المهمة', 'Cancel')}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  {tr('لا توجد مهام بعد.', 'No tasks yet.')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={notDoneOpen} onOpenChange={setNotDoneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('تحديد كغير منجز', 'Mark Not Done')}</DialogTitle>
            <DialogDescription>{tr('يرجى تقديم السبب.', 'Provide a reason.')}</DialogDescription>
          </DialogHeader>
          <Textarea value={notDoneReason} onChange={(e) => setNotDoneReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotDoneOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                runAction(activeTaskId, 'not-done', { reason: notDoneReason.trim() });
                setNotDoneReason('');
                setNotDoneOpen(false);
              }}
              disabled={!notDoneReason.trim()}
            >
              {tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('إلغاء المهمة', 'Cancel Task')}</DialogTitle>
            <DialogDescription>{tr('يرجى تقديم السبب.', 'Provide a reason.')}</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                runAction(activeTaskId, 'cancel', { cancelReason: cancelReason.trim() });
                setCancelReason('');
                setCancelOpen(false);
              }}
              disabled={!cancelReason.trim()}
            >
              {tr('حفظ', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
