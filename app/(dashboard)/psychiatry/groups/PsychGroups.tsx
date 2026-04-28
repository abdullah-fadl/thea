'use client';

import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Plus,
  Calendar,
  UserCheck,
  BarChart3,
  ClipboardList,
  Play,
  Pause,
  Eye,
  CheckCircle,
  X,
  Trash2,
  UserPlus,
  FileText,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RosterEntry {
  patientId: string;
  patientName: string;
  mrn?: string;
  enrolledDate: string;
  status: 'ACTIVE' | 'DISCHARGED' | 'DROPPED';
}

interface GroupDefinition {
  id: string;
  groupName: string;
  groupType: string;
  description?: string;
  facilitatorUserId: string;
  facilitatorName?: string;
  coFacilitatorId?: string;
  coFacilitatorName?: string;
  schedule?: string;
  maxParticipants?: number;
  location?: string;
  roster: RosterEntry[];
  startDate?: string;
  endDate?: string;
  notes?: string;
  status: string;
  sessionCount: number;
  createdAt: string;
  createdByName?: string;
}

interface AttendanceEntry {
  patientId: string;
  patientName: string;
  attended: boolean;
  engagementRating: number;
  notes?: string;
}

interface GroupSession {
  id: string;
  groupId: string;
  groupName?: string;
  sessionDate: string;
  sessionNumber: number;
  theme?: string;
  topicsCovered?: string;
  keyDiscussions?: string;
  materialsUsed?: string;
  attendance: AttendanceEntry[];
  attendedCount: number;
  absentCount: number;
  sessionNotes?: string;
  facilitatorReflections?: string;
  nextSessionPlan?: string;
  durationMin?: number;
  facilitatorUserId?: string;
  facilitatorName?: string;
  status: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const GROUP_TYPES = [
  { value: 'CBT_GROUP', ar: 'مجموعة العلاج المعرفي السلوكي', en: 'CBT Group' },
  { value: 'PROCESS', ar: 'مجموعة عملية', en: 'Process' },
  { value: 'PSYCHOEDUCATION', ar: 'التثقيف النفسي', en: 'Psychoeducation' },
  { value: 'AA_NA', ar: 'مجهولون / مدمنون', en: 'AA-NA' },
  { value: 'DBT_SKILLS', ar: 'مهارات DBT', en: 'DBT Skills' },
  { value: 'SUPPORT', ar: 'دعم', en: 'Support' },
  { value: 'OTHER', ar: 'أخرى', en: 'Other' },
];

const GROUP_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
const SESSION_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

/* ================================================================== */
/*  PsychGroups — Main Component                                       */
/* ================================================================== */
export default function PsychGroups() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ---------- Main State ----------
  const [mainTab, setMainTab] = useState<'GROUPS' | 'SESSIONS'>('GROUPS');
  const [groupStatusFilter, setGroupStatusFilter] = useState('ALL');
  const [groupTypeFilter, setGroupTypeFilter] = useState('ALL');
  const [sessionGroupFilter, setSessionGroupFilter] = useState('ALL');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Dialog state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showViewGroup, setShowViewGroup] = useState(false);
  const [viewGroupTab, setViewGroupTab] = useState<'INFO' | 'ROSTER' | 'SESSIONS' | 'OUTCOMES'>('INFO');
  const [selectedGroup, setSelectedGroup] = useState<GroupDefinition | null>(null);

  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCompleteSession, setShowCompleteSession] = useState(false);
  const [showViewSession, setShowViewSession] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GroupSession | null>(null);

  const [showAddPatient, setShowAddPatient] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------- Form State ----------
  const [groupForm, setGroupForm] = useState({
    groupName: '',
    groupType: '',
    description: '',
    facilitatorUserId: '',
    facilitatorName: '',
    coFacilitatorId: '',
    coFacilitatorName: '',
    schedule: '',
    maxParticipants: '',
    location: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const [sessionForm, setSessionForm] = useState({
    groupId: '',
    sessionDate: '',
    sessionNumber: '',
    theme: '',
    topicsCovered: '',
    keyDiscussions: '',
    materialsUsed: '',
    durationMin: '',
  });

  const [completeForm, setCompleteForm] = useState({
    attendance: [] as AttendanceEntry[],
    sessionNotes: '',
    facilitatorReflections: '',
    nextSessionPlan: '',
  });

  const [addPatientForm, setAddPatientForm] = useState({
    patientId: '',
    patientName: '',
    mrn: '',
  });

  // ---------- Data ----------
  const groupParams = new URLSearchParams();
  if (groupStatusFilter !== 'ALL') groupParams.set('status', groupStatusFilter);
  if (groupTypeFilter !== 'ALL') groupParams.set('groupType', groupTypeFilter);
  const groupQuery = groupParams.toString() ? `?${groupParams.toString()}` : '';

  const { data: groupsData, mutate: mutateGroups } = useSWR(
    `/api/psychiatry/group-therapy${groupQuery}`,
    fetcher,
    { refreshInterval: 30000 },
  );
  const groups: GroupDefinition[] = groupsData?.groups ?? [];

  const sessionParams = new URLSearchParams();
  if (sessionGroupFilter !== 'ALL') sessionParams.set('groupId', sessionGroupFilter);
  if (sessionStatusFilter !== 'ALL') sessionParams.set('status', sessionStatusFilter);
  const sessionQuery = sessionParams.toString() ? `?${sessionParams.toString()}` : '';

  const { data: sessionsData, mutate: mutateSessions } = useSWR(
    `/api/psychiatry/group-therapy/sessions${sessionQuery}`,
    fetcher,
    { refreshInterval: 30000 },
  );
  const sessions: GroupSession[] = sessionsData?.sessions ?? [];

  // ---------- Filtered ----------
  const filteredGroups = groups.filter(
    (g) =>
      !search ||
      g.groupName.toLowerCase().includes(search.toLowerCase()) ||
      (g.facilitatorName || '').toLowerCase().includes(search.toLowerCase()),
  );

  const filteredSessions = sessions.filter(
    (s) =>
      !search ||
      (s.groupName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.theme || '').toLowerCase().includes(search.toLowerCase()),
  );

  // ---------- KPIs ----------
  const activeGroups = groups.filter((g) => g.status === 'ACTIVE').length;

  const totalParticipants = useMemo(() => {
    return groups
      .filter((g) => g.status === 'ACTIVE')
      .reduce((sum, g) => {
        const activeRoster = (g.roster || []).filter((r) => r.status === 'ACTIVE');
        return sum + activeRoster.length;
      }, 0);
  }, [groups]);

  const sessionsThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return sessions.filter((s) => {
      const d = new Date(s.sessionDate);
      return d >= weekStart && d < weekEnd;
    }).length;
  }, [sessions]);

  const avgAttendanceRate = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
    if (completedSessions.length === 0) return 0;
    const totalRate = completedSessions.reduce((sum, s) => {
      const total = s.attendedCount + s.absentCount;
      if (total === 0) return sum;
      return sum + (s.attendedCount / total) * 100;
    }, 0);
    return Math.round(totalRate / completedSessions.length);
  }, [sessions]);

  // ---------- Helpers ----------
  const groupTypeLabel = (type: string) => {
    const found = GROUP_TYPES.find((t) => t.value === type);
    return found ? tr(found.ar, found.en) : type;
  };

  const groupTypeBadge = (type: string) => {
    switch (type) {
      case 'CBT_GROUP': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'PROCESS': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'PSYCHOEDUCATION': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'AA_NA': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'DBT_SKILLS': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      case 'SUPPORT': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      default: return 'bg-muted text-foreground';
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'SCHEDULED': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'IN_PROGRESS': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-muted text-foreground';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return tr('نشط', 'Active');
      case 'PAUSED': return tr('متوقف', 'Paused');
      case 'COMPLETED': return tr('مكتمل', 'Completed');
      case 'CANCELLED': return tr('ملغي', 'Cancelled');
      case 'SCHEDULED': return tr('مجدول', 'Scheduled');
      case 'IN_PROGRESS': return tr('جارٍ', 'In Progress');
      default: return status;
    }
  };

  const rosterStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return tr('نشط', 'Active');
      case 'DISCHARGED': return tr('خرج', 'Discharged');
      case 'DROPPED': return tr('انسحب', 'Dropped');
      default: return status;
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // ---------- Actions ----------
  async function handleCreateGroup() {
    if (!groupForm.groupName || !groupForm.groupType || !groupForm.facilitatorUserId) {
      toast({ title: tr('الاسم والنوع والمسؤول مطلوب', 'Name, type, and facilitator are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/psychiatry/group-therapy', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: groupForm.groupName,
          groupType: groupForm.groupType,
          description: groupForm.description || null,
          facilitatorUserId: groupForm.facilitatorUserId,
          facilitatorName: groupForm.facilitatorName || null,
          coFacilitatorId: groupForm.coFacilitatorId || null,
          coFacilitatorName: groupForm.coFacilitatorName || null,
          schedule: groupForm.schedule || null,
          maxParticipants: groupForm.maxParticipants ? Number(groupForm.maxParticipants) : null,
          location: groupForm.location || null,
          startDate: groupForm.startDate || null,
          endDate: groupForm.endDate || null,
          notes: groupForm.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم إنشاء المجموعة', 'Group created') });
      setShowCreateGroup(false);
      resetGroupForm();
      mutateGroups();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateGroup(updates: Record<string, unknown>) {
    if (!selectedGroup) return;
    setSaving(true);
    try {
      const res = await fetch('/api/psychiatry/group-therapy', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedGroup.id, ...updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      toast({ title: tr('تم تحديث المجموعة', 'Group updated') });
      setSelectedGroup({ ...selectedGroup, ...data.group });
      mutateGroups();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPatient() {
    if (!addPatientForm.patientId || !addPatientForm.patientName || !selectedGroup) {
      toast({ title: tr('معرف واسم المريض مطلوب', 'Patient ID and name are required'), variant: 'destructive' });
      return;
    }
    const newEntry: RosterEntry = {
      patientId: addPatientForm.patientId,
      patientName: addPatientForm.patientName,
      mrn: addPatientForm.mrn || undefined,
      enrolledDate: new Date().toISOString(),
      status: 'ACTIVE',
    };
    const updated = [...(selectedGroup.roster || []), newEntry];
    await handleUpdateGroup({ roster: updated });
    setAddPatientForm({ patientId: '', patientName: '', mrn: '' });
    setShowAddPatient(false);
  }

  async function handleRosterAction(patientId: string, newStatus: 'DISCHARGED' | 'DROPPED') {
    if (!selectedGroup) return;
    const updated = (selectedGroup.roster || []).map((r) =>
      r.patientId === patientId ? { ...r, status: newStatus } : r,
    );
    await handleUpdateGroup({ roster: updated });
  }

  async function handleRemoveFromRoster(patientId: string) {
    if (!selectedGroup) return;
    const updated = (selectedGroup.roster || []).filter((r) => r.patientId !== patientId);
    await handleUpdateGroup({ roster: updated });
  }

  async function handleCreateSession() {
    if (!sessionForm.groupId || !sessionForm.sessionDate || !sessionForm.sessionNumber) {
      toast({ title: tr('المجموعة والتاريخ ورقم الجلسة مطلوب', 'Group, date, and session number are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/psychiatry/group-therapy/sessions', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: sessionForm.groupId,
          sessionDate: sessionForm.sessionDate,
          sessionNumber: Number(sessionForm.sessionNumber),
          theme: sessionForm.theme || null,
          topicsCovered: sessionForm.topicsCovered || null,
          keyDiscussions: sessionForm.keyDiscussions || null,
          materialsUsed: sessionForm.materialsUsed || null,
          durationMin: sessionForm.durationMin ? Number(sessionForm.durationMin) : null,
          status: 'SCHEDULED',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم إنشاء الجلسة', 'Session created') });
      setShowCreateSession(false);
      resetSessionForm();
      mutateSessions();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteSession() {
    if (!selectedSession) return;
    setSaving(true);
    try {
      const res = await fetch('/api/psychiatry/group-therapy/sessions', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSession.id,
          attendance: completeForm.attendance,
          sessionNotes: completeForm.sessionNotes || null,
          facilitatorReflections: completeForm.facilitatorReflections || null,
          nextSessionPlan: completeForm.nextSessionPlan || null,
          status: 'COMPLETED',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast({ title: tr('تم اكتمال الجلسة', 'Session completed') });
      setShowCompleteSession(false);
      mutateSessions();
      mutateGroups();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSession(sessionId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/psychiatry/group-therapy/sessions', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إلغاء الجلسة', 'Session cancelled') });
      mutateSessions();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function resetGroupForm() {
    setGroupForm({
      groupName: '', groupType: '', description: '', facilitatorUserId: '', facilitatorName: '',
      coFacilitatorId: '', coFacilitatorName: '', schedule: '', maxParticipants: '', location: '',
      startDate: '', endDate: '', notes: '',
    });
  }

  function resetSessionForm() {
    setSessionForm({
      groupId: '', sessionDate: '', sessionNumber: '', theme: '',
      topicsCovered: '', keyDiscussions: '', materialsUsed: '', durationMin: '',
    });
  }

  function openViewGroup(group: GroupDefinition) {
    setSelectedGroup(group);
    setViewGroupTab('INFO');
    setShowViewGroup(true);
  }

  function openCompleteSession(session: GroupSession) {
    setSelectedSession(session);
    // Build attendance from group roster
    const group = groups.find((g) => g.id === session.groupId);
    const roster = (group?.roster || []).filter((r) => r.status === 'ACTIVE');
    const existingAttendance = session.attendance || [];
    const attendance: AttendanceEntry[] = roster.map((r) => {
      const existing = existingAttendance.find((a) => a.patientId === r.patientId);
      return existing || {
        patientId: r.patientId,
        patientName: r.patientName,
        attended: false,
        engagementRating: 3,
        notes: '',
      };
    });
    setCompleteForm({
      attendance,
      sessionNotes: session.sessionNotes || '',
      facilitatorReflections: session.facilitatorReflections || '',
      nextSessionPlan: session.nextSessionPlan || '',
    });
    setShowCompleteSession(true);
  }

  function openViewSession(session: GroupSession) {
    setSelectedSession(session);
    setShowViewSession(true);
  }

  function openCreateSessionForGroup(groupId: string) {
    // Auto-increment session number
    const groupSessions = sessions.filter((s) => s.groupId === groupId);
    const maxNum = groupSessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0);
    setSessionForm({
      groupId,
      sessionDate: new Date().toISOString().slice(0, 10),
      sessionNumber: String(maxNum + 1),
      theme: '',
      topicsCovered: '',
      keyDiscussions: '',
      materialsUsed: '',
      durationMin: '',
    });
    setShowCreateSession(true);
  }

  // Outcome calculations for selected group
  const groupOutcomes = useMemo(() => {
    if (!selectedGroup) return { attendanceRate: 0, avgEngagement: 0, patientSummary: [] as Array<{ name: string; attended: number; total: number; avgEngagement: number }> };
    const groupSessions = sessions.filter((s) => s.groupId === selectedGroup.id && s.status === 'COMPLETED');
    if (groupSessions.length === 0) return { attendanceRate: 0, avgEngagement: 0, patientSummary: [] };

    let totalAttended = 0;
    let totalExpected = 0;
    let totalEngagement = 0;
    let engagementCount = 0;
    const patientMap: Record<string, { name: string; attended: number; total: number; avgEngagement: number; engCount: number }> = {};

    for (const s of groupSessions) {
      for (const a of (s.attendance || [])) {
        if (!patientMap[a.patientId]) {
          patientMap[a.patientId] = { name: a.patientName, attended: 0, total: 0, avgEngagement: 0, engCount: 0 };
        }
        patientMap[a.patientId].total++;
        totalExpected++;
        if (a.attended) {
          totalAttended++;
          patientMap[a.patientId].attended++;
          totalEngagement += a.engagementRating || 0;
          engagementCount++;
          patientMap[a.patientId].avgEngagement += a.engagementRating || 0;
          patientMap[a.patientId].engCount++;
        }
      }
    }

    const attendanceRate = totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : 0;
    const avgEngagement = engagementCount > 0 ? Math.round((totalEngagement / engagementCount) * 10) / 10 : 0;

    const patientSummary = Object.entries(patientMap).map(([pid, p]) => ({
      patientId: pid,
      patientName: p.name,
      attended: p.attended,
      total: p.total,
      rate: p.total > 0 ? Math.round((p.attended / p.total) * 100) : 0,
      avgEngagement: p.engCount > 0 ? Math.round((p.avgEngagement / p.engCount) * 10) / 10 : 0,
    }));

    return { attendanceRate, avgEngagement, patientSummary };
  }, [selectedGroup, sessions]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tr('العلاج الجماعي', 'Group Therapy')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tr('إدارة المجموعات العلاجية والجلسات', 'Manage therapy groups and sessions')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetGroupForm(); setShowCreateGroup(true); }}>
            <Plus className="h-4 w-4 me-2" />
            {tr('مجموعة جديدة', 'New Group')}
          </Button>
          <Button variant="outline" onClick={() => { resetSessionForm(); setShowCreateSession(true); }}>
            <Calendar className="h-4 w-4 me-2" />
            {tr('جلسة جديدة', 'New Session')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('المجموعات النشطة', 'Active Groups')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGroups}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('إجمالي المشاركين', 'Total Participants')}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalParticipants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('جلسات هذا الأسبوع', 'Sessions This Week')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionsThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{tr('معدل الحضور', 'Avg Attendance Rate')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAttendanceRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'GROUPS' | 'SESSIONS')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="GROUPS">
              <Users className="h-4 w-4 me-2" />
              {tr('المجموعات', 'Groups')}
            </TabsTrigger>
            <TabsTrigger value="SESSIONS">
              <ClipboardList className="h-4 w-4 me-2" />
              {tr('الجلسات', 'Sessions')}
            </TabsTrigger>
          </TabsList>
          <Input
            placeholder={tr('بحث...', 'Search...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </Tabs>

      {/* ============================================================ */}
      {/* GROUPS TAB                                                    */}
      {/* ============================================================ */}
      {mainTab === 'GROUPS' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={groupStatusFilter} onValueChange={setGroupStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  {GROUP_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={groupTypeFilter} onValueChange={setGroupTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={tr('النوع', 'Type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('اسم المجموعة', 'Group Name')}</TableHead>
                    <TableHead>{tr('النوع', 'Type')}</TableHead>
                    <TableHead>{tr('المسؤول', 'Facilitator')}</TableHead>
                    <TableHead>{tr('الجدول', 'Schedule')}</TableHead>
                    <TableHead>{tr('المشاركون', 'Participants')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                    <TableHead>{tr('الجلسات', 'Sessions')}</TableHead>
                    <TableHead>{tr('إجراءات', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {tr('لا توجد مجموعات', 'No groups found')}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredGroups.map((g) => {
                    const activeRoster = (g.roster || []).filter((r) => r.status === 'ACTIVE').length;
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.groupName}</TableCell>
                        <TableCell>
                          <Badge className={groupTypeBadge(g.groupType)}>{groupTypeLabel(g.groupType)}</Badge>
                        </TableCell>
                        <TableCell>{g.facilitatorName || '-'}</TableCell>
                        <TableCell>{g.schedule || '-'}</TableCell>
                        <TableCell>
                          {activeRoster}{g.maxParticipants ? `/${g.maxParticipants}` : ''}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge(g.status)}>{statusLabel(g.status)}</Badge>
                        </TableCell>
                        <TableCell>{g.sessionCount}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openViewGroup(g)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {g.status === 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title={tr('إيقاف', 'Pause')}
                                onClick={async () => {
                                  setSelectedGroup(g);
                                  setSaving(true);
                                  try {
                                    const res = await fetch('/api/psychiatry/group-therapy', {
                                      credentials: 'include',
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: g.id, status: 'PAUSED' }),
                                    });
                                    if (!res.ok) throw new Error('Failed');
                                    toast({ title: tr('تم إيقاف المجموعة', 'Group paused') });
                                    mutateGroups();
                                  } catch {
                                    toast({ title: tr('فشل التحديث', 'Update failed'), variant: 'destructive' });
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}
                            {g.status === 'PAUSED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title={tr('استئناف', 'Resume')}
                                onClick={async () => {
                                  setSelectedGroup(g);
                                  setSaving(true);
                                  try {
                                    const res = await fetch('/api/psychiatry/group-therapy', {
                                      credentials: 'include',
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: g.id, status: 'ACTIVE' }),
                                    });
                                    if (!res.ok) throw new Error('Failed');
                                    toast({ title: tr('تم استئناف المجموعة', 'Group resumed') });
                                    mutateGroups();
                                  } catch {
                                    toast({ title: tr('فشل التحديث', 'Update failed'), variant: 'destructive' });
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SESSIONS TAB                                                  */}
      {/* ============================================================ */}
      {mainTab === 'SESSIONS' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={sessionGroupFilter} onValueChange={setSessionGroupFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={tr('المجموعة', 'Group')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('كل المجموعات', 'All Groups')}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.groupName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sessionStatusFilter} onValueChange={setSessionStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  {SESSION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                    <TableHead>{tr('المجموعة', 'Group')}</TableHead>
                    <TableHead>{tr('رقم الجلسة', 'Session #')}</TableHead>
                    <TableHead>{tr('الموضوع', 'Theme')}</TableHead>
                    <TableHead>{tr('الحضور', 'Attended/Total')}</TableHead>
                    <TableHead>{tr('الحالة', 'Status')}</TableHead>
                    <TableHead>{tr('إجراءات', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {tr('لا توجد جلسات', 'No sessions found')}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.sessionDate)}</TableCell>
                      <TableCell>{s.groupName || '-'}</TableCell>
                      <TableCell className="text-center">{s.sessionNumber}</TableCell>
                      <TableCell>{s.theme || '-'}</TableCell>
                      <TableCell>
                        {s.attendedCount}/{s.attendedCount + s.absentCount}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadge(s.status)}>{statusLabel(s.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openViewSession(s)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                            <Button size="sm" variant="ghost" onClick={() => openCompleteSession(s)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {s.status === 'SCHEDULED' && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelSession(s.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* CREATE GROUP DIALOG                                           */}
      {/* ============================================================ */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('إنشاء مجموعة جديدة', 'Create New Group')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('اسم المجموعة', 'Group Name')} *</Label>
                <Input
                  value={groupForm.groupName}
                  onChange={(e) => setGroupForm({ ...groupForm, groupName: e.target.value })}
                  placeholder={tr('مثال: مجموعة CBT للقلق', 'e.g. Anxiety CBT Group')}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('نوع المجموعة', 'Group Type')} *</Label>
                <Select value={groupForm.groupType} onValueChange={(v) => setGroupForm({ ...groupForm, groupType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr('اختر النوع', 'Select type')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr('الوصف', 'Description')}</Label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                placeholder={tr('وصف المجموعة...', 'Group description...')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('اسم المسؤول', 'Facilitator Name')}</Label>
                <Input
                  value={groupForm.facilitatorName}
                  onChange={(e) => setGroupForm({ ...groupForm, facilitatorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('معرف المسؤول', 'Facilitator ID')} *</Label>
                <Input
                  value={groupForm.facilitatorUserId}
                  onChange={(e) => setGroupForm({ ...groupForm, facilitatorUserId: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('اسم المسؤول المساعد', 'Co-Facilitator Name')}</Label>
                <Input
                  value={groupForm.coFacilitatorName}
                  onChange={(e) => setGroupForm({ ...groupForm, coFacilitatorName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('معرف المسؤول المساعد', 'Co-Facilitator ID')}</Label>
                <Input
                  value={groupForm.coFacilitatorId}
                  onChange={(e) => setGroupForm({ ...groupForm, coFacilitatorId: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{tr('الجدول', 'Schedule')}</Label>
                <Input
                  value={groupForm.schedule}
                  onChange={(e) => setGroupForm({ ...groupForm, schedule: e.target.value })}
                  placeholder={tr('مثال: كل أربعاء ١٠ ص', 'e.g. Every Wed 10 AM')}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('الحد الأقصى', 'Max Participants')}</Label>
                <Input
                  type="number"
                  value={groupForm.maxParticipants}
                  onChange={(e) => setGroupForm({ ...groupForm, maxParticipants: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('الموقع', 'Location')}</Label>
                <Input
                  value={groupForm.location}
                  onChange={(e) => setGroupForm({ ...groupForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('تاريخ البدء', 'Start Date')}</Label>
                <Input
                  type="date"
                  value={groupForm.startDate}
                  onChange={(e) => setGroupForm({ ...groupForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('تاريخ الانتهاء', 'End Date')}</Label>
                <Input
                  type="date"
                  value={groupForm.endDate}
                  onChange={(e) => setGroupForm({ ...groupForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr('ملاحظات', 'Notes')}</Label>
              <Textarea
                value={groupForm.notes}
                onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleCreateGroup} disabled={saving}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* VIEW GROUP DIALOG (Tabbed)                                    */}
      {/* ============================================================ */}
      <Dialog open={showViewGroup} onOpenChange={setShowViewGroup}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selectedGroup?.groupName || tr('تفاصيل المجموعة', 'Group Details')}</DialogTitle>
          </DialogHeader>

          <Tabs value={viewGroupTab} onValueChange={(v) => setViewGroupTab(v as 'INFO' | 'ROSTER' | 'SESSIONS' | 'OUTCOMES')}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="INFO">{tr('المعلومات', 'Info')}</TabsTrigger>
              <TabsTrigger value="ROSTER">{tr('القائمة', 'Roster')}</TabsTrigger>
              <TabsTrigger value="SESSIONS">{tr('الجلسات', 'Sessions')}</TabsTrigger>
              <TabsTrigger value="OUTCOMES">{tr('النتائج', 'Outcomes')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* INFO Tab */}
          {viewGroupTab === 'INFO' && selectedGroup && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('اسم المجموعة', 'Group Name')}</Label>
                  <Input
                    defaultValue={selectedGroup.groupName}
                    onBlur={(e) => {
                      if (e.target.value !== selectedGroup.groupName) {
                        handleUpdateGroup({ groupName: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('النوع', 'Type')}</Label>
                  <Select
                    defaultValue={selectedGroup.groupType}
                    onValueChange={(v) => handleUpdateGroup({ groupType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tr('الوصف', 'Description')}</Label>
                <Textarea
                  defaultValue={selectedGroup.description || ''}
                  onBlur={(e) => handleUpdateGroup({ description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('المسؤول', 'Facilitator')}</Label>
                  <Input defaultValue={selectedGroup.facilitatorName || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{tr('المسؤول المساعد', 'Co-Facilitator')}</Label>
                  <Input defaultValue={selectedGroup.coFacilitatorName || ''} disabled />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{tr('الجدول', 'Schedule')}</Label>
                  <Input
                    defaultValue={selectedGroup.schedule || ''}
                    onBlur={(e) => handleUpdateGroup({ schedule: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('الحد الأقصى', 'Max Participants')}</Label>
                  <Input
                    type="number"
                    defaultValue={selectedGroup.maxParticipants || ''}
                    onBlur={(e) => handleUpdateGroup({ maxParticipants: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tr('الموقع', 'Location')}</Label>
                  <Input
                    defaultValue={selectedGroup.location || ''}
                    onBlur={(e) => handleUpdateGroup({ location: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{tr('تاريخ البدء', 'Start Date')}</Label>
                  <Input type="date" defaultValue={selectedGroup.startDate?.slice(0, 10) || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>{tr('تاريخ الانتهاء', 'End Date')}</Label>
                  <Input type="date" defaultValue={selectedGroup.endDate?.slice(0, 10) || ''} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tr('ملاحظات', 'Notes')}</Label>
                <Textarea
                  defaultValue={selectedGroup.notes || ''}
                  onBlur={(e) => handleUpdateGroup({ notes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Label className="mt-2">{tr('الحالة', 'Status')}:</Label>
                <Select
                  defaultValue={selectedGroup.status}
                  onValueChange={(v) => handleUpdateGroup({ status: v })}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ROSTER Tab */}
          {viewGroupTab === 'ROSTER' && selectedGroup && (
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {tr('المشاركون في المجموعة', 'Group participants')} ({(selectedGroup.roster || []).length})
                </p>
                <Button size="sm" onClick={() => setShowAddPatient(true)}>
                  <UserPlus className="h-4 w-4 me-2" />
                  {tr('إضافة مريض', 'Add Patient')}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('اسم المريض', 'Patient Name')}</TableHead>
                      <TableHead>{tr('رقم الملف', 'MRN')}</TableHead>
                      <TableHead>{tr('تاريخ التسجيل', 'Enrolled Date')}</TableHead>
                      <TableHead>{tr('الحالة', 'Status')}</TableHead>
                      <TableHead>{tr('إجراءات', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedGroup.roster || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          {tr('لا يوجد مشاركون', 'No participants')}
                        </TableCell>
                      </TableRow>
                    )}
                    {(selectedGroup.roster || []).map((r, idx) => (
                      <TableRow key={`${r.patientId}-${idx}`}>
                        <TableCell className="font-medium">{r.patientName}</TableCell>
                        <TableCell>{r.mrn || '-'}</TableCell>
                        <TableCell>{formatDate(r.enrolledDate)}</TableCell>
                        <TableCell>
                          <Badge className={statusBadge(r.status)}>{rosterStatusLabel(r.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {r.status === 'ACTIVE' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRosterAction(r.patientId, 'DISCHARGED')}
                                  title={tr('خروج', 'Discharge')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRosterAction(r.patientId, 'DROPPED')}
                                  title={tr('انسحاب', 'Drop')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveFromRoster(r.patientId)}
                              title={tr('حذف', 'Remove')}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* SESSIONS Tab */}
          {viewGroupTab === 'SESSIONS' && selectedGroup && (
            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {tr('جلسات المجموعة', 'Group sessions')}
                </p>
                <Button size="sm" onClick={() => openCreateSessionForGroup(selectedGroup.id)}>
                  <Plus className="h-4 w-4 me-2" />
                  {tr('جلسة جديدة', 'New Session')}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('التاريخ', 'Date')}</TableHead>
                      <TableHead>{tr('رقم', '#')}</TableHead>
                      <TableHead>{tr('الموضوع', 'Theme')}</TableHead>
                      <TableHead>{tr('الحضور', 'Attendance')}</TableHead>
                      <TableHead>{tr('الحالة', 'Status')}</TableHead>
                      <TableHead>{tr('إجراءات', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.filter((s) => s.groupId === selectedGroup.id).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          {tr('لا توجد جلسات', 'No sessions')}
                        </TableCell>
                      </TableRow>
                    )}
                    {sessions
                      .filter((s) => s.groupId === selectedGroup.id)
                      .map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{formatDate(s.sessionDate)}</TableCell>
                          <TableCell className="text-center">{s.sessionNumber}</TableCell>
                          <TableCell>{s.theme || '-'}</TableCell>
                          <TableCell>{s.attendedCount}/{s.attendedCount + s.absentCount}</TableCell>
                          <TableCell>
                            <Badge className={statusBadge(s.status)}>{statusLabel(s.status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openViewSession(s)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(s.status === 'SCHEDULED' || s.status === 'IN_PROGRESS') && (
                                <Button size="sm" variant="ghost" onClick={() => openCompleteSession(s)}>
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* OUTCOMES Tab */}
          {viewGroupTab === 'OUTCOMES' && selectedGroup && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tr('معدل الحضور', 'Attendance Rate')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{groupOutcomes.attendanceRate}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{tr('متوسط المشاركة', 'Avg Engagement')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{groupOutcomes.avgEngagement}/5</div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{tr('ملخص حضور المرضى', 'Patient Attendance Summary')}</h4>
                {groupOutcomes.patientSummary.length === 0 && (
                  <p className="text-sm text-muted-foreground">{tr('لا توجد بيانات', 'No data available')}</p>
                )}
                <div className="overflow-x-auto">
                  {groupOutcomes.patientSummary.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr('المريض', 'Patient')}</TableHead>
                          <TableHead>{tr('حضر', 'Attended')}</TableHead>
                          <TableHead>{tr('الإجمالي', 'Total')}</TableHead>
                          <TableHead>{tr('النسبة', 'Rate')}</TableHead>
                          <TableHead>{tr('متوسط المشاركة', 'Avg Engagement')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupOutcomes.patientSummary.map((p) => (
                          <TableRow key={p.patientId}>
                            <TableCell className="font-medium">{p.patientName}</TableCell>
                            <TableCell>{p.attended}</TableCell>
                            <TableCell>{p.total}</TableCell>
                            <TableCell>
                              <Badge className={p.rate >= 80 ? 'bg-green-100 text-green-800' : p.rate >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                                {p.rate}%
                              </Badge>
                            </TableCell>
                            <TableCell>{p.avgEngagement}/5</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* ADD PATIENT TO ROSTER DIALOG                                  */}
      {/* ============================================================ */}
      <Dialog open={showAddPatient} onOpenChange={setShowAddPatient}>
        <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('إضافة مريض', 'Add Patient')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{tr('معرف المريض', 'Patient ID')} *</Label>
              <Input
                value={addPatientForm.patientId}
                onChange={(e) => setAddPatientForm({ ...addPatientForm, patientId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('اسم المريض', 'Patient Name')} *</Label>
              <Input
                value={addPatientForm.patientName}
                onChange={(e) => setAddPatientForm({ ...addPatientForm, patientName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('رقم الملف', 'MRN')}</Label>
              <Input
                value={addPatientForm.mrn}
                onChange={(e) => setAddPatientForm({ ...addPatientForm, mrn: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPatient(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleAddPatient} disabled={saving}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إضافة', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* CREATE SESSION DIALOG                                         */}
      {/* ============================================================ */}
      <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{tr('إنشاء جلسة جديدة', 'Create New Session')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{tr('المجموعة', 'Group')} *</Label>
              <Select value={sessionForm.groupId} onValueChange={(v) => {
                const groupSessions = sessions.filter((s) => s.groupId === v);
                const maxNum = groupSessions.reduce((max, s) => Math.max(max, s.sessionNumber || 0), 0);
                setSessionForm({ ...sessionForm, groupId: v, sessionNumber: String(maxNum + 1) });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={tr('اختر المجموعة', 'Select group')} />
                </SelectTrigger>
                <SelectContent>
                  {groups.filter((g) => g.status === 'ACTIVE').map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.groupName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('تاريخ الجلسة', 'Session Date')} *</Label>
                <Input
                  type="date"
                  value={sessionForm.sessionDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('رقم الجلسة', 'Session Number')} *</Label>
                <Input
                  type="number"
                  value={sessionForm.sessionNumber}
                  onChange={(e) => setSessionForm({ ...sessionForm, sessionNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr('الموضوع', 'Theme')}</Label>
              <Input
                value={sessionForm.theme}
                onChange={(e) => setSessionForm({ ...sessionForm, theme: e.target.value })}
                placeholder={tr('مثال: إدارة القلق', 'e.g. Anxiety Management')}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('المواضيع المغطاة', 'Topics Covered')}</Label>
              <Textarea
                value={sessionForm.topicsCovered}
                onChange={(e) => setSessionForm({ ...sessionForm, topicsCovered: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr('المناقشات الرئيسية', 'Key Discussions')}</Label>
              <Textarea
                value={sessionForm.keyDiscussions}
                onChange={(e) => setSessionForm({ ...sessionForm, keyDiscussions: e.target.value })}
                placeholder={tr('ملاحظة: لا تتضمن معلومات خاصة بالمرضى', 'Note: No patient-specific information')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr('المواد المستخدمة', 'Materials Used')}</Label>
                <Input
                  value={sessionForm.materialsUsed}
                  onChange={(e) => setSessionForm({ ...sessionForm, materialsUsed: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr('المدة (دقيقة)', 'Duration (min)')}</Label>
                <Input
                  type="number"
                  value={sessionForm.durationMin}
                  onChange={(e) => setSessionForm({ ...sessionForm, durationMin: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSession(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleCreateSession} disabled={saving}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* COMPLETE SESSION DIALOG                                       */}
      {/* ============================================================ */}
      <Dialog open={showCompleteSession} onOpenChange={setShowCompleteSession}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('اكتمال الجلسة', 'Complete Session')} — {selectedSession?.groupName} #{selectedSession?.sessionNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Attendance tracking */}
            <div className="space-y-3">
              <h4 className="font-semibold">{tr('تتبع الحضور', 'Attendance Tracking')}</h4>
              {completeForm.attendance.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {tr('لا يوجد مشاركون في القائمة', 'No participants in roster')}
                </p>
              )}
              <div className="space-y-4">
                {completeForm.attendance.map((a, idx) => (
                  <div key={a.patientId} className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox
                          checked={a.attended}
                          onCheckedChange={(checked) => {
                            const updated = [...completeForm.attendance];
                            updated[idx] = { ...updated[idx], attended: !!checked };
                            setCompleteForm({ ...completeForm, attendance: updated });
                          }}
                        />
                        <span className="font-medium">{a.patientName}</span>
                      </div>
                      <Badge className={a.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {a.attended ? tr('حاضر', 'Present') : tr('غائب', 'Absent')}
                      </Badge>
                    </div>
                    {a.attended && (
                      <div className="grid grid-cols-2 gap-4 ps-8">
                        <div className="space-y-2">
                          <Label className="text-xs">{tr('تقييم المشاركة', 'Engagement Rating')} (1-5)</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[a.engagementRating]}
                              onValueChange={(v) => {
                                const updated = [...completeForm.attendance];
                                updated[idx] = { ...updated[idx], engagementRating: v[0] };
                                setCompleteForm({ ...completeForm, attendance: updated });
                              }}
                              min={1}
                              max={5}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium w-6 text-center">{a.engagementRating}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">{tr('ملاحظات', 'Notes')}</Label>
                          <Input
                            value={a.notes || ''}
                            onChange={(e) => {
                              const updated = [...completeForm.attendance];
                              updated[idx] = { ...updated[idx], notes: e.target.value };
                              setCompleteForm({ ...completeForm, attendance: updated });
                            }}
                            placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Session Notes */}
            <div className="space-y-2">
              <Label>{tr('ملاحظات الجلسة', 'Session Notes')}</Label>
              <Textarea
                value={completeForm.sessionNotes}
                onChange={(e) => setCompleteForm({ ...completeForm, sessionNotes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Facilitator Reflections */}
            <div className="space-y-2">
              <Label>{tr('تأملات المسؤول', 'Facilitator Reflections')}</Label>
              <Textarea
                value={completeForm.facilitatorReflections}
                onChange={(e) => setCompleteForm({ ...completeForm, facilitatorReflections: e.target.value })}
                rows={3}
              />
            </div>

            {/* Next Session Plan */}
            <div className="space-y-2">
              <Label>{tr('خطة الجلسة القادمة', 'Next Session Plan')}</Label>
              <Textarea
                value={completeForm.nextSessionPlan}
                onChange={(e) => setCompleteForm({ ...completeForm, nextSessionPlan: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteSession(false)}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={handleCompleteSession} disabled={saving}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('اكتمال الجلسة', 'Complete Session')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* VIEW SESSION DIALOG                                           */}
      {/* ============================================================ */}
      <Dialog open={showViewSession} onOpenChange={setShowViewSession}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {tr('تفاصيل الجلسة', 'Session Details')} — {selectedSession?.groupName} #{selectedSession?.sessionNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              {/* Session Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('التاريخ', 'Date')}</Label>
                  <p className="font-medium">{formatDate(selectedSession.sessionDate)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('الحالة', 'Status')}</Label>
                  <Badge className={statusBadge(selectedSession.status)}>{statusLabel(selectedSession.status)}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('المدة', 'Duration')}</Label>
                  <p className="font-medium">{selectedSession.durationMin ? `${selectedSession.durationMin} ${tr('دقيقة', 'min')}` : '-'}</p>
                </div>
              </div>

              {selectedSession.theme && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('الموضوع', 'Theme')}</Label>
                  <p className="font-medium">{selectedSession.theme}</p>
                </div>
              )}

              {selectedSession.topicsCovered && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('المواضيع المغطاة', 'Topics Covered')}</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedSession.topicsCovered}</p>
                </div>
              )}

              {selectedSession.keyDiscussions && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('المناقشات الرئيسية', 'Key Discussions')}</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedSession.keyDiscussions}</p>
                </div>
              )}

              {selectedSession.materialsUsed && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('المواد المستخدمة', 'Materials Used')}</Label>
                  <p className="text-sm">{selectedSession.materialsUsed}</p>
                </div>
              )}

              {/* Attendance Grid */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">
                  {tr('الحضور', 'Attendance')} ({selectedSession.attendedCount}/{selectedSession.attendedCount + selectedSession.absentCount})
                </h4>
                {(selectedSession.attendance || []).length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tr('المريض', 'Patient')}</TableHead>
                          <TableHead>{tr('الحضور', 'Attended')}</TableHead>
                          <TableHead>{tr('تقييم المشاركة', 'Engagement')}</TableHead>
                          <TableHead>{tr('ملاحظات', 'Notes')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedSession.attendance || []).map((a, i) => (
                          <TableRow key={`${a.patientId}-${i}`}>
                            <TableCell className="font-medium">{a.patientName}</TableCell>
                            <TableCell>
                              <Badge className={a.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {a.attended ? tr('حاضر', 'Present') : tr('غائب', 'Absent')}
                              </Badge>
                            </TableCell>
                            <TableCell>{a.attended ? `${a.engagementRating}/5` : '-'}</TableCell>
                            <TableCell className="text-sm">{a.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {selectedSession.sessionNotes && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('ملاحظات الجلسة', 'Session Notes')}</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedSession.sessionNotes}</p>
                </div>
              )}

              {selectedSession.facilitatorReflections && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('تأملات المسؤول', 'Facilitator Reflections')}</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedSession.facilitatorReflections}</p>
                </div>
              )}

              {selectedSession.nextSessionPlan && (
                <div>
                  <Label className="text-xs text-muted-foreground">{tr('خطة الجلسة القادمة', 'Next Session Plan')}</Label>
                  <p className="text-sm whitespace-pre-wrap">{selectedSession.nextSessionPlan}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">{tr('المسؤول', 'Facilitator')}</Label>
                <p className="text-sm">{selectedSession.facilitatorName || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewSession(false)}>{tr('إغلاق', 'Close')}</Button>
            {selectedSession && (selectedSession.status === 'SCHEDULED' || selectedSession.status === 'IN_PROGRESS') && (
              <Button onClick={() => { setShowViewSession(false); openCompleteSession(selectedSession); }}>
                <CheckCircle className="h-4 w-4 me-2" />
                {tr('اكتمال الجلسة', 'Complete Session')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
