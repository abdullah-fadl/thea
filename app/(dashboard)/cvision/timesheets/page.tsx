// app/(dashboard)/cvision/timesheets/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useLang } from '@/hooks/use-lang';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Timer,
  Plus,
  Search,
  Clock,
  DollarSign,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  FolderKanban,
  Users,
  BarChart3,
  FileCheck,
  Briefcase,
  CalendarDays,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useCVisionTheme } from '@/lib/cvision/theme';
import { CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

// ─── Types ──────────────────────────────────────────────────────

interface TimeEntry {
  _id?: string;
  id?: string;
  employeeId: string;
  employeeName?: string;
  weekStartDate: string;
  date: string;
  projectId: string;
  projectName: string;
  taskDescription: string;
  hours: number;
  billable: boolean;
  rate: number;
  amount?: number;
  notes?: string;
}

interface Timesheet {
  _id?: string;
  id?: string;
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  entries: TimeEntry[];
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface Project {
  _id?: string;
  id?: string;
  name: string;
  clientName: string;
  status: "ACTIVE" | "COMPLETED" | "ON_HOLD";
  budget: { hours: number; amount: number };
  consumedHours?: number;
  consumedAmount?: number;
  team: string[];
  startDate: string;
  endDate: string;
}

interface ProjectHoursDetail {
  projectId: string;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
}

interface UtilizationRecord {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  billableHours: number;
  utilization: number;
}

interface StatsData {
  activeProjects: number;
  pendingApprovals: number;
  totalHoursLogged: number;
}

interface BillingProject {
  _id?: string;
  id?: string;
  name: string;
  clientName: string;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  budget?: { hours: number; amount: number };
}

// ─── Helpers ────────────────────────────────────────────────────

const API = "/api/cvision/timesheets";

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  });
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function timesheetStatusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
    SUBMITTED: "bg-yellow-100 text-yellow-700 border-yellow-300",
    APPROVED: "bg-green-100 text-green-700 border-green-300",
    REJECTED: "bg-red-100 text-red-700 border-red-300",
  };
  return (
    <Badge variant="outline" className={map[status] || ""}>
      {status}
    </Badge>
  );
}

function projectStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700 border-green-300",
    COMPLETED: "bg-blue-100 text-blue-700 border-blue-300",
    ON_HOLD: "bg-yellow-100 text-yellow-700 border-yellow-300",
  };
  return (
    <Badge variant="outline" className={map[status] || ""}>
      {status}
    </Badge>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function TimesheetsPage() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [activeTab, setActiveTab] = useState("my-timesheets");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Timer className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tr('تتبع الوقت والمشاريع', 'Time & Project Tracking')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr('سجّل الساعات، أدر المشاريع، وتتبع استخدام الفريق', 'Log hours, manage projects, and track team utilization')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="my-timesheets" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('كشوف الوقت', 'My Timesheets')}</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('المشاريع', 'Projects')}</span>
          </TabsTrigger>
          <TabsTrigger value="pending-approval" className="gap-1.5">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('بانتظار الاعتماد', 'Pending Approval')}</span>
          </TabsTrigger>
          <TabsTrigger value="utilization" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('الاستخدام', 'Utilization')}</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{tr('الإحصائيات', 'Stats')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-timesheets">
          <MyTimesheetsTab />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectsTab />
        </TabsContent>
        <TabsContent value="pending-approval">
          <PendingApprovalTab />
        </TabsContent>
        <TabsContent value="utilization">
          <UtilizationTab />
        </TabsContent>
        <TabsContent value="stats">
          <StatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: My Timesheets ───────────────────────────────────────

function MyTimesheetsTab() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(true);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // entry form state
  const [entryDate, setEntryDate] = useState("");
  const [entryProjectId, setEntryProjectId] = useState("");
  const [entryProjectName, setEntryProjectName] = useState("");
  const [entryTask, setEntryTask] = useState("");
  const [entryHours, setEntryHours] = useState("");
  const [entryBillable, setEntryBillable] = useState(true);
  const [entryRate, setEntryRate] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const { data: tsRaw, isLoading: tsLoading, refetch: refetchTimesheet } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'my-timesheet', weekStartDate: toISODate(weekStart) }),
    queryFn: () => cvisionFetch(API, { params: { action: 'my-timesheet', weekStartDate: toISODate(weekStart) } }),
  });
  useEffect(() => { setLoading(tsLoading); }, [tsLoading]);
  useEffect(() => {
    const items = tsRaw?.data?.items ?? [];
    setTimesheet(items.length > 0 ? items[0] : null);
  }, [tsRaw]);
  const fetchTimesheet = useCallback(() => refetchTimesheet(), [refetchTimesheet]);

  const { data: projRaw } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'projects', status: 'ACTIVE' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'projects', status: 'ACTIVE' } }),
  });
  useEffect(() => { setProjects(projRaw?.data?.items ?? []); }, [projRaw]);

  // fetchTimesheet and fetchProjects are now handled by useQuery hooks above

  const prevWeek = () => setWeekStart((prev) => addDays(prev, -7));
  const nextWeek = () => setWeekStart((prev) => addDays(prev, 7));

  const entries: TimeEntry[] = timesheet?.entries ?? [];
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const billableHours = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalAmount = entries.reduce(
    (sum, e) => sum + (e.billable ? (e.hours || 0) * (e.rate || 0) : 0),
    0
  );

  const handleAddEntry = async () => {
    if (!entryDate || !entryProjectId || !entryTask || !entryHours) {
      toast.error(tr('يرجى ملء جميع الحقول المطلوبة', "Please fill all required fields"));
      return;
    }

    try {
      const body = {
        action: "create-entry",
        employeeId: timesheet?.employeeId || "current",
        employeeName: timesheet?.employeeName || "Current User",
        weekStartDate: toISODate(weekStart),
        date: entryDate,
        projectId: entryProjectId,
        projectName:
          entryProjectName ||
          projects.find((p) => (p._id || p.id) === entryProjectId)?.name ||
          "",
        taskDescription: entryTask,
        hours: parseFloat(entryHours),
        billable: entryBillable,
        rate: parseFloat(entryRate || "0"),
        notes: entryNotes,
      };
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to create entry");
      }
      toast.success(tr('تمت إضافة إدخال الوقت', "Time entry added"));
      resetEntryForm();
      setAddOpen(false);
      fetchTimesheet();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error adding entry");
    }
  };

  const resetEntryForm = () => {
    setEntryDate("");
    setEntryProjectId("");
    setEntryProjectName("");
    setEntryTask("");
    setEntryHours("");
    setEntryBillable(true);
    setEntryRate("");
    setEntryNotes("");
  };

  const handleSubmitWeek = async () => {
    if (!timesheet) {
      toast.error(tr('لا يوجد كشف وقت لإرساله', "No timesheet to submit"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "submit-week",
          timesheetId: timesheet._id || timesheet.id,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to submit timesheet");
      }
      toast.success(tr('تم إرسال كشف الوقت للاعتماد', "Timesheet submitted for approval"));
      fetchTimesheet();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error submitting timesheet");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Week Navigator */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{tr('أسبوع', 'Week of')}</p>
            <p className="text-lg font-semibold">{formatDate(toISODate(weekStart))}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(toISODate(weekStart))} &mdash;{" "}
              {formatDate(toISODate(addDays(weekStart, 6)))}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Status and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {timesheet && timesheetStatusBadge(timesheet.status)}
          <span className="text-sm text-muted-foreground">
            {entries.length} {tr('إدخال هذا الأسبوع', 'entries this week')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> {tr('إضافة إدخال', 'Add Entry')}
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{tr('إضافة إدخال وقت', 'Add Time Entry')}</DialogTitle>
                <DialogDescription>
                  {tr('سجّل ساعات لتاريخ ومشروع محدد خلال هذا الأسبوع.', 'Log hours for a specific date and project during this week.')}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto space-y-4 py-2 pr-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tr('التاريخ', 'Date')}</Label>
                    <CVisionSelect
                C={C}
                value={entryDate || undefined}
                onChange={setEntryDate}
                placeholder="Select day"
                options={[...weekDates.map((d) => (
                          ({ value: toISODate(d), label: d.toLocaleDateString("en-SA", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            }) })
                        ))]}
              />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr('المشروع', 'Project')}</Label>
                    <CVisionSelect
                C={C}
                value={entryProjectId || undefined}
                onChange={(val) => {
                        setEntryProjectId(val);
                        const proj = projects.find(
                          (p) => (p._id || p.id) === val
                        );
                        if (proj) setEntryProjectName(proj.name);
                      }}
                placeholder={tr('اختر مشروع', 'Select project')}
                options={[...projects.map((p) => (
                          ({ value: (p._id || p.id) as string, label: p.name })
                        ))]}
              />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tr('وصف المهمة', 'Task Description')}</Label>
                  <Input
                    placeholder={tr('على ماذا عملت؟', 'What did you work on?')}
                    value={entryTask}
                    onChange={(e) => setEntryTask(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{tr('الساعات', 'Hours')}</Label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      step="0.25"
                      min="0"
                      max="24"
                      value={entryHours}
                      onChange={(e) => setEntryHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr('المعدل (ر.س/ساعة)', 'Rate (SAR/hr)')}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      value={entryRate}
                      onChange={(e) => setEntryRate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="billable-check"
                        checked={entryBillable}
                        onCheckedChange={(checked) =>
                          setEntryBillable(checked === true)
                        }
                      />
                      <Label htmlFor="billable-check">{tr('قابل للفوترة', 'Billable')}</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tr('ملاحظات (اختياري)', 'Notes (optional)')}</Label>
                  <Input
                    placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
                <Button onClick={handleAddEntry}>{tr('إضافة إدخال', 'Add Entry')}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {timesheet && timesheet.status === "DRAFT" && entries.length > 0 && (
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={handleSubmitWeek}
              disabled={submitting}
            >
              <Send className="h-4 w-4" />
              {submitting ? tr('جاري الإرسال...', "Submitting...") : tr('إرسال الأسبوع', "Submit Week")}
            </Button>
          )}
        </div>
      </div>

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المشروع', 'Project')}</CVisionTh>
                  <CVisionTh C={C}>{tr('المهمة', 'Task')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الساعات', 'Hours')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('قابل للفوترة', 'Billable')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المعدل', 'Rate')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {entries.length === 0 ? (
                  <CVisionTr C={C}>
                    <CVisionTd align="center" colSpan={7}
                      className="py-12 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      {tr('لا توجد إدخالات لهذا الأسبوع. انقر "إضافة إدخال" لبدء تسجيل الساعات.', 'No entries for this week. Click "Add Entry" to start logging hours.')}
                    </CVisionTd>
                  </CVisionTr>
                ) : (
                  <>
                    {entries.map((entry, idx) => {
                      const amt = entry.billable
                        ? (entry.hours || 0) * (entry.rate || 0)
                        : 0;
                      return (
                        <CVisionTr C={C} key={entry._id || entry.id || idx}>
                          <CVisionTd className="font-medium">
                            {formatDate(entry.date)}
                          </CVisionTd>
                          <CVisionTd>{entry.projectName || "-"}</CVisionTd>
                          <CVisionTd className="max-w-[200px] truncate">
                            {entry.taskDescription}
                          </CVisionTd>
                          <CVisionTd align="right" className="font-mono">
                            {entry.hours.toFixed(2)}
                          </CVisionTd>
                          <CVisionTd align="center">
                            {entry.billable ? (
                              <Check className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-gray-400 mx-auto" />
                            )}
                          </CVisionTd>
                          <CVisionTd align="right" className="font-mono">
                            {entry.rate ? formatCurrency(entry.rate) : "-"}
                          </CVisionTd>
                          <CVisionTd align="right" className="font-mono">
                            {amt > 0 ? formatCurrency(amt) : "-"}
                          </CVisionTd>
                        </CVisionTr>
                      );
                    })}
                    {/* Totals row */}
                    <CVisionTr C={C} className="bg-muted/50 font-semibold">
                      <CVisionTd align="right" colSpan={3}>
                        {tr('الإجمالي', 'Totals')}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {totalHours.toFixed(2)}
                      </CVisionTd>
                      <CVisionTd align="center" className="text-xs text-muted-foreground">
                        {billableHours.toFixed(1)}h bill.
                      </CVisionTd>
                      <CVisionTd />
                      <CVisionTd align="right" className="font-mono">
                        {formatCurrency(totalAmount)}
                      </CVisionTd>
                    </CVisionTr>
                  </>
                )}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tr('إجمالي الساعات', 'Total Hours')}</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2.5">
                <Timer className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tr('ساعات قابلة للفوترة', 'Billable Hours')}</p>
                <p className="text-2xl font-bold">{billableHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2.5">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{tr('إجمالي المبلغ', 'Total Amount')}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 2: Projects ────────────────────────────────────────────

function ProjectsTab() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProjectHours, setSelectedProjectHours] =
    useState<ProjectHoursDetail | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");

  // create form
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newBudgetHours, setNewBudgetHours] = useState("");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const projFilters: Record<string, any> = { action: 'projects' };
  if (statusFilter && statusFilter !== 'ALL') projFilters.status = statusFilter;

  const { data: projTabRaw, isLoading: projTabLoading, refetch: refetchProjTab } = useQuery({
    queryKey: cvisionKeys.timesheets.list(projFilters),
    queryFn: () => cvisionFetch(API, { params: projFilters }),
  });
  useEffect(() => { setLoading(projTabLoading); }, [projTabLoading]);
  useEffect(() => { setProjects(projTabRaw?.data?.items ?? []); }, [projTabRaw]);
  const fetchProjects = useCallback(() => refetchProjTab(), [refetchProjTab]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const handleCreateProject = async () => {
    if (!newName || !newClient || !newStart || !newEnd) {
      toast.error(tr('يرجى ملء جميع الحقول المطلوبة', "Please fill all required fields"));
      return;
    }
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "create-project",
          name: newName,
          clientName: newClient,
          budget: {
            hours: parseFloat(newBudgetHours || "0"),
            amount: parseFloat(newBudgetAmount || "0"),
          },
          team: newTeam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          startDate: newStart,
          endDate: newEnd,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to create project");
      }
      toast.success(tr('تم إنشاء المشروع بنجاح', "Project created successfully"));
      resetCreateForm();
      setCreateOpen(false);
      fetchProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating project");
    }
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewClient("");
    setNewBudgetHours("");
    setNewBudgetAmount("");
    setNewTeam("");
    setNewStart("");
    setNewEnd("");
  };

  const handleViewProjectHours = async (project: Project) => {
    const projectId = project._id || project.id;
    if (!projectId) return;
    setSelectedProjectName(project.name);
    setSelectedProjectHours(null);
    setDetailOpen(true);
    try {
      const qs = new URLSearchParams({
        action: "project-hours",
        projectId,
      });
      const res = await fetch(`${API}?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load project hours");
      const json = await res.json();
      setSelectedProjectHours(json);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error loading project hours"
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tr('بحث في المشاريع...', 'Search projects...')}
              className="pl-9 w-[250px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter || undefined}
                onChange={setStatusFilter}
                placeholder="All statuses"
                options={[{ value: 'ALL', label: tr('كل الحالات', 'All Statuses') }, { value: 'ACTIVE', label: tr('نشط', 'Active') }, { value: 'COMPLETED', label: tr('مكتمل', 'Completed') }, { value: 'ON_HOLD', label: tr('معلق', 'On Hold') }]}
              />
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> {tr('مشروع جديد', 'New Project')}
            </Button>
          </DialogTrigger>
          <DialogContent className="flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{tr('إنشاء مشروع', 'Create Project')}</DialogTitle>
              <DialogDescription>
                {tr('أنشئ مشروعاً جديداً مع معلومات الميزانية والفريق.', 'Set up a new project with budget and team information.')}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto space-y-4 py-2 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('اسم المشروع *', 'Project Name *')}</Label>
                  <Input
                    placeholder={tr('اسم المشروع', 'Project name')}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('اسم العميل *', 'Client Name *')}</Label>
                  <Input
                    placeholder={tr('اسم العميل', 'Client name')}
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('ساعات الميزانية', 'Budget Hours')}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={newBudgetHours}
                    onChange={(e) => setNewBudgetHours(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('مبلغ الميزانية (ر.س)', 'Budget Amount (SAR)')}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tr('أعضاء الفريق (معرفات مفصولة بفواصل)', 'Team Members (comma-separated IDs)')}</Label>
                <Input
                  placeholder="user1, user2, user3"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('تاريخ البداية *', 'Start Date *')}</Label>
                  <Input
                    type="date"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('تاريخ النهاية *', 'End Date *')}</Label>
                  <Input
                    type="date"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleCreateProject}>{tr('إنشاء مشروع', 'Create Project')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{tr('لم يتم العثور على مشاريع.', 'No projects found.')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const budgetHours = project.budget?.hours ?? 0;
            const consumed = project.consumedHours ?? 0;
            const usagePercent =
              budgetHours > 0
                ? Math.min(100, Math.round((consumed / budgetHours) * 100))
                : 0;

            return (
              <Card
                key={project._id || project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewProjectHours(project)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold leading-tight">
                        {project.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {project.clientName}
                      </p>
                    </div>
                    {projectStatusBadge(project.status)}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {consumed.toFixed(1)} / {budgetHours} hours
                      </span>
                      <span>{usagePercent}%</span>
                    </div>
                    <Progress value={usagePercent} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {project.team?.length ?? 0} members
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(project.startDate)} &mdash;{" "}
                      {formatDate(project.endDate)}
                    </span>
                  </div>

                  {project.budget?.amount != null && project.budget.amount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Budget: {formatCurrency(project.budget.amount)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project Hours Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Project Hours: {selectedProjectName}</DialogTitle>
            <DialogDescription>
              Detailed hours breakdown for the selected project.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto py-2">
            {!selectedProjectHours ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{tr('إجمالي الساعات', 'Total Hours')}</p>
                    <p className="text-2xl font-bold">
                      {selectedProjectHours.totalHours.toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      Billable Hours
                    </p>
                    <p className="text-2xl font-bold">
                      {selectedProjectHours.billableHours.toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">{tr('إجمالي المبلغ', 'Total Amount')}</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(selectedProjectHours.totalAmount)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-3 border-t">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 3: Pending Approval ────────────────────────────────────

function PendingApprovalTab() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);

  const { data: pendingRaw, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'pending-approval' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'pending-approval' } }),
  });
  useEffect(() => { setLoading(pendingLoading); }, [pendingLoading]);
  useEffect(() => { setTimesheets(pendingRaw?.data?.items ?? []); }, [pendingRaw]);
  const fetchPending = useCallback(() => refetchPending(), [refetchPending]);

  const handleApprove = async (ts: Timesheet) => {
    const tsId = ts._id || ts.id;
    if (!tsId) return;
    setActioning(tsId);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "approve",
          timesheetId: tsId,
          approvedBy: "current-user",
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to approve");
      }
      toast.success(`Timesheet for ${ts.employeeName} approved`);
      fetchPending();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error approving timesheet");
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (ts: Timesheet) => {
    const tsId = ts._id || ts.id;
    if (!tsId) return;
    setActioning(tsId);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "reject",
          timesheetId: tsId,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to reject");
      }
      toast.success(`Timesheet for ${ts.employeeName} rejected`);
      fetchPending();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error rejecting timesheet");
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tr('الاعتمادات المعلقة', 'Pending Approvals')}</h2>
        <Badge variant="secondary" className="text-sm">
          {timesheets.length} pending
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : timesheets.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No timesheets pending approval.</p>
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('بداية الأسبوع', 'Week Starting')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('إجمالي الساعات', 'Total Hours')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('ساعات قابلة للفوترة', 'Billable Hours')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {timesheets.map((ts) => {
                  const tsId = ts._id || ts.id || "";
                  const isProcessing = actioning === tsId;
                  return (
                    <CVisionTr C={C} key={tsId}>
                      <CVisionTd className="font-medium">
                        {ts.employeeName}
                      </CVisionTd>
                      <CVisionTd>{formatDate(ts.weekStartDate)}</CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {ts.totalHours?.toFixed(2) ?? "0.00"}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {ts.billableHours?.toFixed(2) ?? "0.00"}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {formatCurrency(ts.totalAmount ?? 0)}
                      </CVisionTd>
                      <CVisionTd>{timesheetStatusBadge(ts.status)}</CVisionTd>
                      <CVisionTd align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            disabled={isProcessing}
                            onClick={() => handleApprove(ts)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-700 border-red-300 hover:bg-red-50"
                            disabled={isProcessing}
                            onClick={() => handleReject(ts)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 4: Utilization ─────────────────────────────────────────

function UtilizationTab() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<UtilizationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: utilRaw, isLoading: utilLoading } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'utilization-report' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'utilization-report' } }),
  });
  useEffect(() => { setLoading(utilLoading); }, [utilLoading]);
  useEffect(() => { setRecords(utilRaw?.data?.items ?? []); }, [utilRaw]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => r.employeeName.toLowerCase().includes(q));
  }, [records, searchQuery]);

  const avgUtilization =
    records.length > 0
      ? records.reduce((sum, r) => sum + (r.utilization || 0), 0) / records.length
      : 0;

  function utilizationColor(util: number): string {
    if (util >= 75) return "bg-green-500";
    if (util >= 50) return "bg-yellow-500";
    return "bg-red-500";
  }

  function utilizationTextColor(util: number): string {
    if (util >= 75) return "text-green-700";
    if (util >= 50) return "text-yellow-700";
    return "text-red-700";
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold">{records.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Average Utilization
                </p>
                <p className="text-2xl font-bold">
                  {avgUtilization.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2.5">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  High Performers (&gt;75%)
                </p>
                <p className="text-2xl font-bold">
                  {records.filter((r) => r.utilization >= 75).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by employee name..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Utilization Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No utilization data found.</p>
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('إجمالي الساعات', 'Total Hours')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('ساعات قابلة للفوترة', 'Billable Hours')}</CVisionTh>
                  <CVisionTh C={C} className="w-[250px]">{tr('الاستخدام', 'Utilization')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('النسبة', 'Percentage')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {filtered.map((record) => {
                  const util = Math.min(100, Math.max(0, record.utilization || 0));
                  return (
                    <CVisionTr C={C} key={record.employeeId}>
                      <CVisionTd className="font-medium">
                        {record.employeeName}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {record.totalHours.toFixed(1)}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {record.billableHours.toFixed(1)}
                      </CVisionTd>
                      <CVisionTd>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${utilizationColor(util)}`}
                              style={{ width: `${util}%` }}
                            />
                          </div>
                        </div>
                      </CVisionTd>
                      <CVisionTd className={`text-right font-semibold ${utilizationTextColor(util)}`}>
                        {util.toFixed(1)}%
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          Above 75% (High)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          50% - 75% (Medium)
        </span>
        <span className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          Below 50% (Low)
        </span>
      </div>
    </div>
  );
}

// ─── Tab 5: Stats ───────────────────────────────────────────────

function StatsTab() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingProjects, setBillingProjects] = useState<BillingProject[]>([]);

  const { data: statsRaw, isLoading: statsTabLoading } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'stats' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'stats' } }),
  });
  useEffect(() => { setLoading(statsTabLoading); }, [statsTabLoading]);
  useEffect(() => { if (statsRaw) setStats(statsRaw); }, [statsRaw]);

  const { data: billingRaw, isLoading: billingQueryLoading } = useQuery({
    queryKey: cvisionKeys.timesheets.list({ action: 'billing-report' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'billing-report' } }),
  });
  useEffect(() => { setBillingLoading(billingQueryLoading); }, [billingQueryLoading]);
  useEffect(() => { setBillingProjects(billingRaw?.data?.items ?? []); }, [billingRaw]);

  // stats and billing are now loaded via useQuery hooks above

  const totalBillingAmount = billingProjects.reduce(
    (sum, p) => sum + (p.totalAmount || 0),
    0
  );
  const totalBillableHoursAll = billingProjects.reduce(
    (sum, p) => sum + (p.billableHours || 0),
    0
  );
  const totalHoursAll = billingProjects.reduce(
    (sum, p) => sum + (p.totalHours || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2.5">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Active Projects
                    </p>
                    <p className="text-3xl font-bold">
                      {stats?.activeProjects ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-50 p-2.5">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pending Approvals
                    </p>
                    <p className="text-3xl font-bold">
                      {stats?.pendingApprovals ?? 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-50 p-2.5">
                    <Clock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Hours Logged
                    </p>
                    <p className="text-3xl font-bold">
                      {stats?.totalHoursLogged?.toFixed(1) ?? "0.0"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Billing Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2.5">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Billing Amount
                </p>
                <p className="text-2xl font-bold">
                  {billingLoading ? (
                    <Skeleton className="h-7 w-28 inline-block" />
                  ) : (
                    formatCurrency(totalBillingAmount)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-teal-50 p-2.5">
                <Timer className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Billable Hours
                </p>
                <p className="text-2xl font-bold">
                  {billingLoading ? (
                    <Skeleton className="h-7 w-20 inline-block" />
                  ) : (
                    totalBillableHoursAll.toFixed(1)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-50 p-2.5">
                <CalendarDays className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Hours (All)
                </p>
                <p className="text-2xl font-bold">
                  {billingLoading ? (
                    <Skeleton className="h-7 w-20 inline-block" />
                  ) : (
                    totalHoursAll.toFixed(1)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Report Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Billing Summary by Project
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {billingLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : billingProjects.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No billing data available yet.</p>
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('المشروع', 'Project')}</CVisionTh>
                  <CVisionTh C={C}>{tr('العميل', 'Client')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('إجمالي الساعات', 'Total Hours')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('ساعات قابلة للفوترة', 'Billable Hours')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('المبلغ', 'Amount')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الميزانية', 'Budget')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('الفرق', 'Variance')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {billingProjects.map((proj, idx) => {
                  const budgetAmt = proj.budget?.amount ?? 0;
                  const variance = budgetAmt - (proj.totalAmount || 0);
                  const isOverBudget = variance < 0;

                  return (
                    <CVisionTr C={C} key={proj._id || proj.id || idx}>
                      <CVisionTd className="font-medium">{proj.name}</CVisionTd>
                      <CVisionTd>{proj.clientName}</CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {proj.totalHours.toFixed(1)}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {proj.billableHours.toFixed(1)}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {formatCurrency(proj.totalAmount)}
                      </CVisionTd>
                      <CVisionTd align="right" className="font-mono">
                        {budgetAmt > 0 ? formatCurrency(budgetAmt) : "-"}
                      </CVisionTd>
                      <CVisionTd className={`text-right font-mono font-semibold ${
                          isOverBudget ? "text-red-600" : "text-green-600"
                        }`}>
                        {budgetAmt > 0
                          ? `${isOverBudget ? "-" : "+"}${formatCurrency(Math.abs(variance))}`
                          : "-"}
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}

                {/* Totals row */}
                <CVisionTr C={C} className="bg-muted/50 font-semibold">
                  <CVisionTd align="right" colSpan={2}>
                    Totals
                  </CVisionTd>
                  <CVisionTd align="right" className="font-mono">
                    {totalHoursAll.toFixed(1)}
                  </CVisionTd>
                  <CVisionTd align="right" className="font-mono">
                    {totalBillableHoursAll.toFixed(1)}
                  </CVisionTd>
                  <CVisionTd align="right" className="font-mono">
                    {formatCurrency(totalBillingAmount)}
                  </CVisionTd>
                  <CVisionTd />
                  <CVisionTd />
                </CVisionTr>
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CardContent>
      </Card>

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Billable Ratio
              </p>
              <p className="text-2xl font-bold mt-1">
                {totalHoursAll > 0
                  ? `${((totalBillableHoursAll / totalHoursAll) * 100).toFixed(1)}%`
                  : "0.0%"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                of total hours are billable
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Avg Hourly Rate
              </p>
              <p className="text-2xl font-bold mt-1">
                {totalBillableHoursAll > 0
                  ? formatCurrency(totalBillingAmount / totalBillableHoursAll)
                  : formatCurrency(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                per billable hour
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Projects Tracked
              </p>
              <p className="text-2xl font-bold mt-1">
                {billingProjects.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                with recorded hours
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Over Budget
              </p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                {
                  billingProjects.filter(
                    (p) =>
                      (p.budget?.amount ?? 0) > 0 &&
                      p.totalAmount > (p.budget?.amount ?? 0)
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                projects exceeding budget
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
