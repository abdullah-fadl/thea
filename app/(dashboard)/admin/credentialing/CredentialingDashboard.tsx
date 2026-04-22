'use client';

import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Search,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Credential {
  id: string;
  userId: string;
  staffName: string;
  staffNameAr?: string;
  credentialType: string;
  credentialNumber?: string;
  issuingAuthority: string;
  issuingAuthorityAr?: string;
  issueDate: string;
  expiryDate?: string;
  status: string;
  verificationStatus: string;
  verifiedBy?: string;
  verifiedAt?: string;
  documentUrl?: string;
  category?: string;
  specialtyCode?: string;
  notes?: string;
}

interface Privilege {
  id: string;
  userId: string;
  staffName: string;
  privilegeType: string;
  privilegeCode?: string;
  department?: string;
  status: string;
  grantedBy: string;
  grantedByName?: string;
  grantedAt: string;
  expiresAt?: string;
  conditions?: string;
  supervisorId?: string;
  caseLogRequired?: number;
  caseLogCompleted: number;
  notes?: string;
}

interface CredAlert {
  id: string;
  credentialId?: string;
  privilegeId?: string;
  userId: string;
  alertType: string;
  message: string;
  messageAr?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface DashboardStats {
  totalStaff: number;
  totalCredentials: number;
  activeCredentials: number;
  expiredCredentials: number;
  expiringCredentials: number;
  unverifiedCredentials: number;
  complianceRate: number;
  totalPrivileges: number;
  activePrivileges: number;
  suspendedPrivileges: number;
  unresolvedAlerts: number;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

const CRED_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  medical_license: { en: 'Medical License', ar: 'رخصة طبية' },
  specialty_board: { en: 'Specialty Board', ar: 'شهادة البورد' },
  bls: { en: 'BLS', ar: 'الإنعاش الأساسي' },
  acls: { en: 'ACLS', ar: 'الإنعاش المتقدم' },
  pals: { en: 'PALS', ar: 'إنعاش الأطفال' },
  nrp: { en: 'NRP', ar: 'إنعاش حديثي الولادة' },
  dea: { en: 'DEA', ar: 'DEA' },
  cme: { en: 'CME', ar: 'التعليم المستمر' },
  malpractice_insurance: { en: 'Malpractice Insurance', ar: 'تأمين الأخطاء الطبية' },
  health_certificate: { en: 'Health Certificate', ar: 'الشهادة الصحية' },
  dataflow_verification: { en: 'DataFlow', ar: 'التحقق DataFlow' },
  scfhs_classification: { en: 'SCFHS Classification', ar: 'تصنيف الهيئة السعودية' },
  nursing_license: { en: 'Nursing License', ar: 'رخصة التمريض' },
};

const PRIV_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  admitting: { en: 'Admitting', ar: 'القبول' },
  surgical: { en: 'Surgical', ar: 'الجراحة' },
  procedural: { en: 'Procedural', ar: 'الإجراءات' },
  prescribing: { en: 'Prescribing', ar: 'الوصف' },
  sedation: { en: 'Sedation', ar: 'التخدير' },
  laser: { en: 'Laser', ar: 'الليزر' },
  radiology_ordering: { en: 'Radiology Ordering', ar: 'طلب الأشعة' },
  blood_transfusion: { en: 'Blood Transfusion', ar: 'نقل الدم' },
  ventilator_management: { en: 'Ventilator Mgmt', ar: 'إدارة التنفس' },
  central_line: { en: 'Central Line', ar: 'القسطرة المركزية' },
};

const CATEGORY_LABELS: Record<string, { en: string; ar: string }> = {
  physician: { en: 'Physician', ar: 'طبيب' },
  nurse: { en: 'Nurse', ar: 'ممرض/ة' },
  pharmacist: { en: 'Pharmacist', ar: 'صيدلي/ة' },
  technician: { en: 'Technician', ar: 'فني/ة' },
  allied_health: { en: 'Allied Health', ar: 'الصحة المساندة' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status, tr }: { status: string; tr: (ar: string, en: string) => string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: { en: string; ar: string } }> = {
    active: { variant: 'default', label: { en: 'Active', ar: 'نشط' } },
    expired: { variant: 'destructive', label: { en: 'Expired', ar: 'منتهي' } },
    expiring_soon: { variant: 'secondary', label: { en: 'Expiring Soon', ar: 'ينتهي قريباً' } },
    revoked: { variant: 'destructive', label: { en: 'Revoked', ar: 'ملغى' } },
    pending_renewal: { variant: 'outline', label: { en: 'Pending Renewal', ar: 'بانتظار التجديد' } },
    pending_verification: { variant: 'outline', label: { en: 'Pending Verification', ar: 'بانتظار التحقق' } },
    suspended: { variant: 'destructive', label: { en: 'Suspended', ar: 'معلق' } },
    temporary: { variant: 'secondary', label: { en: 'Temporary', ar: 'مؤقت' } },
    probationary: { variant: 'secondary', label: { en: 'Probationary', ar: 'تحت الاختبار' } },
  };
  const c = config[status] || { variant: 'outline' as const, label: { en: status, ar: status } };
  return <Badge variant={c.variant}>{tr(c.label.ar, c.label.en)}</Badge>;
}

function VerificationBadge({ status, tr }: { status: string; tr: (ar: string, en: string) => string }) {
  const config: Record<string, { color: string; label: { en: string; ar: string } }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: { en: 'Pending', ar: 'بانتظار' } },
    verified: { color: 'bg-green-100 text-green-800', label: { en: 'Verified', ar: 'متحقق' } },
    failed: { color: 'bg-red-100 text-red-800', label: { en: 'Failed', ar: 'فشل' } },
    waived: { color: 'bg-muted text-muted-foreground', label: { en: 'Waived', ar: 'معفى' } },
  };
  const c = config[status] || { color: 'bg-muted text-muted-foreground', label: { en: status, ar: status } };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.color}`}>{tr(c.label.ar, c.label.en)}</span>;
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function CredentialingDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { toast } = useToast();
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Modal states
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [showGrantPrivilege, setShowGrantPrivilege] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Data fetching
  const { data: statsData } = useSWR<DashboardStats>('/api/credentialing/dashboard', fetcher, { refreshInterval: 30000 });
  const { data: credData } = useSWR<{ items: Credential[] }>('/api/credentialing/credentials', fetcher);
  const { data: privData } = useSWR<{ items: Privilege[] }>('/api/credentialing/privileges', fetcher);
  const { data: alertsData } = useSWR<{ items: CredAlert[] }>('/api/credentialing/alerts', fetcher);

  const credentials = credData?.items || [];
  const privileges = privData?.items || [];
  const alerts = alertsData?.items || [];

  // Group credentials by userId
  const staffMap = new Map<string, { staffName: string; staffNameAr?: string; category?: string; credentials: Credential[] }>();
  for (const cred of credentials) {
    if (!staffMap.has(cred.userId)) {
      staffMap.set(cred.userId, { staffName: cred.staffName, staffNameAr: cred.staffNameAr, category: cred.category, credentials: [] });
    }
    staffMap.get(cred.userId)!.credentials.push(cred);
  }

  // Filter staff
  const filteredStaff = Array.from(staffMap.entries()).filter(([, staff]) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!staff.staffName.toLowerCase().includes(term) && !(staff.staffNameAr || '').includes(term)) return false;
    }
    if (filterCategory !== 'all' && staff.category !== filterCategory) return false;
    if (filterStatus !== 'all') {
      const hasStatus = staff.credentials.some((c) => c.status === filterStatus);
      if (!hasStatus) return false;
    }
    return true;
  });

  const getStaffComplianceColor = (creds: Credential[]) => {
    if (creds.some((c) => c.status === 'expired')) return 'text-red-600';
    if (creds.some((c) => c.status === 'expiring_soon')) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStaffComplianceIcon = (creds: Credential[]) => {
    if (creds.some((c) => c.status === 'expired')) return <XCircle className="h-5 w-5 text-red-500" />;
    if (creds.some((c) => c.status === 'expiring_soon')) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  // Alert type badge
  const alertTypeBadge = (type: string) => {
    const map: Record<string, { variant: 'destructive' | 'secondary' | 'outline'; label: { en: string; ar: string } }> = {
      expired: { variant: 'destructive', label: { en: 'Expired', ar: 'منتهي' } },
      expiring_30d: { variant: 'destructive', label: { en: '30 Days', ar: '30 يوم' } },
      expiring_60d: { variant: 'secondary', label: { en: '60 Days', ar: '60 يوم' } },
      expiring_90d: { variant: 'outline', label: { en: '90 Days', ar: '90 يوم' } },
      verification_needed: { variant: 'secondary', label: { en: 'Verify', ar: 'تحقق' } },
      review_due: { variant: 'outline', label: { en: 'Review', ar: 'مراجعة' } },
    };
    const c = map[type] || { variant: 'outline' as const, label: { en: type, ar: type } };
    return <Badge variant={c.variant}>{tr(c.label.ar, c.label.en)}</Badge>;
  };

  // Actions
  const handleScanAlerts = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/credentialing/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'generate' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('تم المسح بنجاح', 'Scan complete'), description: tr(`تم إنشاء ${data.alertsGenerated} تنبيه`, `${data.alertsGenerated} alerts generated`) });
        globalMutate('/api/credentialing/alerts');
        globalMutate('/api/credentialing/dashboard');
        globalMutate('/api/credentialing/credentials');
      } else {
        toast({ title: tr('خطأ', 'Error'), description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الاتصال', 'Connection failed'), variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  }, [toast, tr]);

  const handleVerifyCredential = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/credentialing/credentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'verify' }),
      });
      if (res.ok) {
        toast({ title: tr('تم التحقق', 'Verified successfully') });
        globalMutate('/api/credentialing/credentials');
        globalMutate('/api/credentialing/dashboard');
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [toast, tr]);

  const handleRejectCredential = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/credentialing/credentials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'reject' }),
      });
      if (res.ok) {
        toast({ title: tr('تم الرفض', 'Rejected') });
        globalMutate('/api/credentialing/credentials');
        globalMutate('/api/credentialing/dashboard');
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [toast, tr]);

  const handleMarkAlertRead = useCallback(async (alertId: string) => {
    try {
      await fetch('/api/credentialing/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'mark_read', alertId }),
      });
      globalMutate('/api/credentialing/alerts');
      globalMutate('/api/credentialing/dashboard');
    } catch { /* silent */ }
  }, []);

  const handleRevokePrivilege = useCallback(async (id: string) => {
    const reason = prompt(tr('سبب الإلغاء:', 'Reason for revocation:'));
    if (!reason) return;
    try {
      const res = await fetch(`/api/credentialing/privileges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'revoke', reason }),
      });
      if (res.ok) {
        toast({ title: tr('تم الإلغاء', 'Revoked') });
        globalMutate('/api/credentialing/privileges');
        globalMutate('/api/credentialing/dashboard');
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [toast, tr]);

  // Pending verifications
  const pendingVerifications = credentials.filter((c) => c.verificationStatus === 'pending');

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tr('اعتماد وصلاحيات الكوادر', 'Staff Credentialing & Privileging')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tr('إدارة شهادات الكوادر الطبية والصلاحيات السريرية', 'Manage staff medical credentials and clinical privileges')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleScanAlerts} disabled={scanning}>
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''} ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {tr('مسح التنبيهات', 'Scan Alerts')}
          </Button>
          <Button size="sm" onClick={() => setShowAddCredential(true)}>
            <Plus className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {tr('إضافة شهادة', 'Add Credential')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowGrantPrivilege(true)}>
            <ShieldCheck className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
            {tr('منح صلاحية', 'Grant Privilege')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
          <TabsTrigger value="credentials">{tr('الشهادات', 'Credentials')}</TabsTrigger>
          <TabsTrigger value="privileges">{tr('الصلاحيات', 'Privileges')}</TabsTrigger>
          <TabsTrigger value="alerts">
            {tr('التنبيهات', 'Alerts')}
            {(statsData?.unresolvedAlerts ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{statsData?.unresolvedAlerts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verification">
            {tr('التحقق', 'Verification')}
            {pendingVerifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{pendingVerifications.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              icon={<Users className="h-5 w-5 text-blue-600" />}
              label={tr('إجمالي الكوادر', 'Total Staff')}
              value={statsData?.totalStaff ?? 0}
              color="blue"
            />
            <KPICard
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              label={tr('نسبة الامتثال', 'Compliance Rate')}
              value={`${statsData?.complianceRate ?? 0}%`}
              color="green"
            />
            <KPICard
              icon={<AlertTriangle className="h-5 w-5 text-yellow-600" />}
              label={tr('تنتهي قريباً', 'Expiring Soon')}
              value={statsData?.expiringCredentials ?? 0}
              color="yellow"
            />
            <KPICard
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              label={tr('منتهية', 'Expired')}
              value={statsData?.expiredCredentials ?? 0}
              color="red"
            />
            <KPICard
              icon={<Clock className="h-5 w-5 text-orange-600" />}
              label={tr('بانتظار التحقق', 'Unverified')}
              value={statsData?.unverifiedCredentials ?? 0}
              color="orange"
            />
          </div>

          {/* Privilege stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              icon={<ShieldCheck className="h-5 w-5 text-indigo-600" />}
              label={tr('إجمالي الصلاحيات', 'Total Privileges')}
              value={statsData?.totalPrivileges ?? 0}
              color="indigo"
            />
            <KPICard
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              label={tr('صلاحيات نشطة', 'Active Privileges')}
              value={statsData?.activePrivileges ?? 0}
              color="green"
            />
            <KPICard
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              label={tr('صلاحيات معلقة', 'Suspended')}
              value={statsData?.suspendedPrivileges ?? 0}
              color="red"
            />
            <KPICard
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              label={tr('تنبيهات غير مقروءة', 'Unresolved Alerts')}
              value={statsData?.unresolvedAlerts ?? 0}
              color="amber"
            />
          </div>

          {/* Recent Alerts */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold text-lg mb-3">{tr('أحدث التنبيهات', 'Recent Alerts')}</h3>
            {alerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr('لا توجد تنبيهات', 'No alerts')}</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {alerts.slice(0, 10).map((alert) => (
                  <div key={alert.id} className={`flex items-center justify-between p-3 rounded border ${alert.isRead ? 'bg-background' : 'bg-yellow-50 dark:bg-yellow-950/20'}`}>
                    <div className="flex items-center gap-3">
                      {alertTypeBadge(alert.alertType)}
                      <span className="text-sm">{tr(alert.messageAr || alert.message, alert.message)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span>
                      {!alert.isRead && (
                        <Button size="sm" variant="ghost" onClick={() => handleMarkAlertRead(alert.id)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Credentials Tab ── */}
        <TabsContent value="credentials" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative flex-1 w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tr('البحث بالاسم...', 'Search by name...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={tr('الفئة', 'Category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{tr(label.ar, label.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={tr('الحالة', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('الكل', 'All')}</SelectItem>
                <SelectItem value="active">{tr('نشط', 'Active')}</SelectItem>
                <SelectItem value="expired">{tr('منتهي', 'Expired')}</SelectItem>
                <SelectItem value="expiring_soon">{tr('ينتهي قريباً', 'Expiring Soon')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{tr('لا توجد بيانات', 'No data found')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStaff.map(([userId, staff]) => (
                <div key={userId} className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => setExpandedUserId(expandedUserId === userId ? null : userId)}
                  >
                    <div className="flex items-center gap-3">
                      {getStaffComplianceIcon(staff.credentials)}
                      <div>
                        <p className={`font-medium ${getStaffComplianceColor(staff.credentials)}`}>
                          {tr(staff.staffNameAr || staff.staffName, staff.staffName)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {staff.category ? tr(CATEGORY_LABELS[staff.category]?.ar || staff.category, CATEGORY_LABELS[staff.category]?.en || staff.category) : ''} - {staff.credentials.length} {tr('شهادة', 'credentials')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {staff.credentials.some((c) => c.status === 'expired') && <Badge variant="destructive">{tr('منتهي', 'Expired')}</Badge>}
                      {staff.credentials.some((c) => c.status === 'expiring_soon') && <Badge variant="secondary">{tr('ينتهي قريباً', 'Expiring')}</Badge>}
                      {staff.credentials.every((c) => c.status === 'active') && <Badge>{tr('ممتثل', 'Compliant')}</Badge>}
                      {expandedUserId === userId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {expandedUserId === userId && (
                    <div className="border-t p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs">
                            <th className="text-left pb-2">{tr('النوع', 'Type')}</th>
                            <th className="text-left pb-2">{tr('الرقم', 'Number')}</th>
                            <th className="text-left pb-2">{tr('الجهة', 'Authority')}</th>
                            <th className="text-left pb-2">{tr('تاريخ الانتهاء', 'Expiry')}</th>
                            <th className="text-left pb-2">{tr('الحالة', 'Status')}</th>
                            <th className="text-left pb-2">{tr('التحقق', 'Verification')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staff.credentials.map((cred) => (
                            <tr key={cred.id} className="border-t">
                              <td className="py-2">{tr(CRED_TYPE_LABELS[cred.credentialType]?.ar || cred.credentialType, CRED_TYPE_LABELS[cred.credentialType]?.en || cred.credentialType)}</td>
                              <td className="py-2">{cred.credentialNumber || '-'}</td>
                              <td className="py-2">{tr(cred.issuingAuthorityAr || cred.issuingAuthority, cred.issuingAuthority)}</td>
                              <td className="py-2">{cred.expiryDate ? new Date(cred.expiryDate).toLocaleDateString() : tr('غير محدد', 'N/A')}</td>
                              <td className="py-2"><StatusBadge status={cred.status} tr={tr} /></td>
                              <td className="py-2"><VerificationBadge status={cred.verificationStatus} tr={tr} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Privileges Tab ── */}
        <TabsContent value="privileges" className="space-y-4">
          {privileges.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{tr('لا توجد صلاحيات', 'No privileges found')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs border-b">
                    <th className="text-left pb-2 pr-4">{tr('الموظف', 'Staff')}</th>
                    <th className="text-left pb-2 pr-4">{tr('نوع الصلاحية', 'Privilege Type')}</th>
                    <th className="text-left pb-2 pr-4">{tr('القسم', 'Department')}</th>
                    <th className="text-left pb-2 pr-4">{tr('الحالة', 'Status')}</th>
                    <th className="text-left pb-2 pr-4">{tr('سجل الحالات', 'Case Log')}</th>
                    <th className="text-left pb-2 pr-4">{tr('تاريخ المنح', 'Granted')}</th>
                    <th className="text-left pb-2 pr-4">{tr('الانتهاء', 'Expires')}</th>
                    <th className="text-left pb-2">{tr('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {privileges.map((priv) => (
                    <tr key={priv.id} className="border-b">
                      <td className="py-3 pr-4">{priv.staffName}</td>
                      <td className="py-3 pr-4">{tr(PRIV_TYPE_LABELS[priv.privilegeType]?.ar || priv.privilegeType, PRIV_TYPE_LABELS[priv.privilegeType]?.en || priv.privilegeType)}</td>
                      <td className="py-3 pr-4">{priv.department || '-'}</td>
                      <td className="py-3 pr-4"><StatusBadge status={priv.status} tr={tr} /></td>
                      <td className="py-3 pr-4">
                        {priv.caseLogRequired ? (
                          <span className={priv.caseLogCompleted >= priv.caseLogRequired ? 'text-green-600' : 'text-yellow-600'}>
                            {priv.caseLogCompleted}/{priv.caseLogRequired}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 pr-4">{new Date(priv.grantedAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{priv.expiresAt ? new Date(priv.expiresAt).toLocaleDateString() : tr('غير محدد', 'N/A')}</td>
                      <td className="py-3">
                        {priv.status === 'active' && (
                          <Button size="sm" variant="destructive" onClick={() => handleRevokePrivilege(priv.id)}>
                            {tr('إلغاء', 'Revoke')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Alerts Tab ── */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{tr('تنبيهات الشهادات', 'Credential Alerts')}</h3>
            <Button variant="outline" size="sm" onClick={handleScanAlerts} disabled={scanning}>
              <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''} ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
              {tr('تحديث المسح', 'Generate Alerts')}
            </Button>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{tr('لا توجد تنبيهات', 'No alerts')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${alert.isRead ? 'bg-background' : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200'}`}>
                  <div className="flex items-center gap-3">
                    {alertTypeBadge(alert.alertType)}
                    <span className="text-sm">{tr(alert.messageAr || alert.message, alert.message)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span>
                    {!alert.isRead && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkAlertRead(alert.id)}>
                        {tr('قراءة', 'Read')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Verification Tab ── */}
        <TabsContent value="verification" className="space-y-4">
          <h3 className="font-semibold">{tr('طابور التحقق', 'Verification Queue')}</h3>

          {pendingVerifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{tr('لا توجد شهادات بانتظار التحقق', 'No pending verifications')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingVerifications.map((cred) => (
                <div key={cred.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{tr(cred.staffNameAr || cred.staffName, cred.staffName)}</p>
                    <p className="text-sm text-muted-foreground">
                      {tr(CRED_TYPE_LABELS[cred.credentialType]?.ar || cred.credentialType, CRED_TYPE_LABELS[cred.credentialType]?.en || cred.credentialType)}
                      {cred.credentialNumber ? ` - ${cred.credentialNumber}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tr('الجهة المصدرة:', 'Issuing Authority:')} {tr(cred.issuingAuthorityAr || cred.issuingAuthority, cred.issuingAuthority)}
                    </p>
                    {cred.expiryDate && (
                      <p className="text-xs text-muted-foreground">
                        {tr('تاريخ الانتهاء:', 'Expiry:')} {new Date(cred.expiryDate).toLocaleDateString()}
                      </p>
                    )}
                    {cred.documentUrl && (
                      <a href={cred.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">
                        {tr('عرض المستند', 'View Document')}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleVerifyCredential(cred.id)}>
                      <CheckCircle2 className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                      {tr('تحقق', 'Verify')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRejectCredential(cred.id)}>
                      <XCircle className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                      {tr('رفض', 'Reject')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Credential Modal ── */}
      <AddCredentialDialog open={showAddCredential} onClose={() => setShowAddCredential(false)} tr={tr} dir={dir} />

      {/* ── Grant Privilege Modal ── */}
      <GrantPrivilegeDialog open={showGrantPrivilege} onClose={() => setShowGrantPrivilege(false)} tr={tr} dir={dir} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-lg border p-4 bg-${color}-50/50 dark:bg-${color}-950/10`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Credential Dialog
// ---------------------------------------------------------------------------

function AddCredentialDialog({ open, onClose, tr, dir }: { open: boolean; onClose: () => void; tr: (ar: string, en: string) => string; dir: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: '', staffName: '', staffNameAr: '', credentialType: '', credentialNumber: '',
    issuingAuthority: '', issuingAuthorityAr: '', issueDate: '', expiryDate: '',
    category: '', documentUrl: '', notes: '',
  });

  const handleSubmit = async () => {
    if (!form.userId || !form.staffName || !form.credentialType || !form.issuingAuthority || !form.issueDate) {
      toast({ title: tr('خطأ', 'Error'), description: tr('يرجى ملء الحقول المطلوبة', 'Please fill required fields'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/credentialing/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('تمت الإضافة', 'Added successfully') });
        globalMutate('/api/credentialing/credentials');
        globalMutate('/api/credentialing/dashboard');
        onClose();
        setForm({ userId: '', staffName: '', staffNameAr: '', credentialType: '', credentialNumber: '', issuingAuthority: '', issuingAuthorityAr: '', issueDate: '', expiryDate: '', category: '', documentUrl: '', notes: '' });
      } else {
        toast({ title: tr('خطأ', 'Error'), description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>{tr('إضافة شهادة جديدة', 'Add New Credential')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{tr('معرف الموظف *', 'Staff User ID *')}</label>
            <Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="UUID" />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الاسم (إنجليزي) *', 'Staff Name *')}</label>
            <Input value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الاسم (عربي)', 'Staff Name (Arabic)')}</label>
            <Input value={form.staffNameAr} onChange={(e) => setForm({ ...form, staffNameAr: e.target.value })} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('نوع الشهادة *', 'Credential Type *')}</label>
            <Select value={form.credentialType} onValueChange={(v) => setForm({ ...form, credentialType: v })}>
              <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {Object.entries(CRED_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{tr('رقم الشهادة', 'Credential Number')}</label>
            <Input value={form.credentialNumber} onChange={(e) => setForm({ ...form, credentialNumber: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الجهة المصدرة *', 'Issuing Authority *')}</label>
            <Input value={form.issuingAuthority} onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })} placeholder="SCFHS, MOH, AHA..." />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الجهة المصدرة (عربي)', 'Authority (Arabic)')}</label>
            <Input value={form.issuingAuthorityAr} onChange={(e) => setForm({ ...form, issuingAuthorityAr: e.target.value })} dir="rtl" />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('فئة الموظف', 'Staff Category')}</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{tr('تاريخ الإصدار *', 'Issue Date *')}</label>
            <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('تاريخ الانتهاء', 'Expiry Date')}</label>
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">{tr('رابط المستند', 'Document URL')}</label>
            <Input value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">{tr('ملاحظات', 'Notes')}</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Grant Privilege Dialog
// ---------------------------------------------------------------------------

function GrantPrivilegeDialog({ open, onClose, tr, dir }: { open: boolean; onClose: () => void; tr: (ar: string, en: string) => string; dir: string }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: '', staffName: '', privilegeType: '', department: '', expiresAt: '',
    conditions: '', caseLogRequired: '', notes: '',
  });

  const handleSubmit = async () => {
    if (!form.userId || !form.staffName || !form.privilegeType) {
      toast({ title: tr('خطأ', 'Error'), description: tr('يرجى ملء الحقول المطلوبة', 'Please fill required fields'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        userId: form.userId,
        staffName: form.staffName,
        privilegeType: form.privilegeType,
        department: form.department || undefined,
        expiresAt: form.expiresAt || undefined,
        conditions: form.conditions || undefined,
        notes: form.notes || undefined,
      };
      if (form.caseLogRequired) payload.caseLogRequired = parseInt(form.caseLogRequired, 10);

      const res = await fetch('/api/credentialing/privileges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: tr('تم المنح', 'Privilege granted') });
        globalMutate('/api/credentialing/privileges');
        globalMutate('/api/credentialing/dashboard');
        onClose();
        setForm({ userId: '', staffName: '', privilegeType: '', department: '', expiresAt: '', conditions: '', caseLogRequired: '', notes: '' });
      } else {
        toast({ title: tr('خطأ', 'Error'), description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle>{tr('منح صلاحية سريرية', 'Grant Clinical Privilege')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{tr('معرف الموظف *', 'Staff User ID *')}</label>
            <Input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="UUID" />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الاسم *', 'Staff Name *')}</label>
            <Input value={form.staffName} onChange={(e) => setForm({ ...form, staffName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('نوع الصلاحية *', 'Privilege Type *')}</label>
            <Select value={form.privilegeType} onValueChange={(v) => setForm({ ...form, privilegeType: v })}>
              <SelectTrigger><SelectValue placeholder={tr('اختر', 'Select')} /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIV_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">{tr('القسم', 'Department')}</label>
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('تاريخ الانتهاء', 'Expiry Date')}</label>
            <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium">{tr('الحالات المطلوبة', 'Cases Required')}</label>
            <Input type="number" value={form.caseLogRequired} onChange={(e) => setForm({ ...form, caseLogRequired: e.target.value })} placeholder="0" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">{tr('الشروط', 'Conditions')}</label>
            <Input value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">{tr('ملاحظات', 'Notes')}</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? tr('جاري المنح...', 'Granting...') : tr('منح', 'Grant')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
