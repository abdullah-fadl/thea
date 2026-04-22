'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionInput, CVisionSelect, CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  X,
  FileText,
  Inbox,
} from 'lucide-react';
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
} from '@/lib/cvision/constants';

import StatsBar, { computeRequestStats } from './_components/StatsBar';
import RequestCard from './_components/RequestCard';
import NewRequestDialog from './_components/NewRequestDialog';
import RequestDetailDialog from './_components/RequestDetailDialog';

interface RequestItem {
  id: string;
  requestNumber: string;
  type: string;
  priority?: string;
  title: string;
  description: string;
  status: string;
  confidentiality: string;
  requesterEmployeeId: string;
  departmentId: string;
  currentOwnerRole: string;
  slaDueAt?: string;
  slaBreached?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  departmentId: string;
}

interface DepartmentRef {
  id: string;
  name: string;
}

export default function RequestsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  // Data queries
  const { data: reqData, isLoading: reqLoading, refetch: refetchRequests } = useQuery({
    queryKey: cvisionKeys.requests.list({ limit: 200 }),
    queryFn: () => cvisionFetch<any>('/api/cvision/requests', { params: { limit: 200 } }),
  });
  const { data: empData, isLoading: empLoading } = useQuery({
    queryKey: cvisionKeys.employees.list({ limit: 500, statuses: 'ACTIVE,PROBATION' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/employees', { params: { limit: 500, statuses: 'ACTIVE,PROBATION' } }),
  });
  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 200 }),
    queryFn: () => cvisionFetch<any>('/api/cvision/org/departments', { params: { limit: 200 } }),
  });

  const requests: RequestItem[] = reqData?.data?.items || reqData?.data || [];
  const employees: EmployeeRef[] = empData?.data || empData?.items || [];
  const departments: DepartmentRef[] = deptData?.items || deptData?.data?.items || deptData?.data || [];
  const loading = reqLoading || empLoading || deptLoading;

  const refetchAll = () => { refetchRequests(); };

  // Filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { toast } = useToast();

  // Lookup maps
  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      const name = emp.fullName || `${emp.firstName} ${emp.lastName}`;
      map.set(emp.id, name);
    }
    return map;
  }, [employees]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const dept of departments) {
      map.set(dept.id, dept.name);
    }
    return map;
  }, [departments]);

  // Client-side filtered requests
  const filteredRequests = useMemo(() => {
    let result = requests;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.requestNumber.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (employeeMap.get(r.requesterEmployeeId) || '').toLowerCase().includes(q)
      );
    }

    if (typeFilter) {
      result = result.filter((r) => r.type === typeFilter);
    }

    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter((r) => (r.priority || 'medium') === priorityFilter);
    }

    return result;
  }, [requests, search, typeFilter, statusFilter, priorityFilter, employeeMap]);

  // Stats from ALL requests (not filtered)
  const stats = useMemo(() => computeRequestStats(requests), [requests]);

  const hasFilters = !!(search || typeFilter || statusFilter || priorityFilter);

  function clearFilters() {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
    setPriorityFilter('');
  }

  function handleViewDetails(id: string) {
    setSelectedRequestId(id);
    setDetailOpen(true);
  }

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 192 }}  />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 288, marginTop: 8 }}  />
          </div>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 144 }}  />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ borderRadius: 12 }}  />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 256 }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 160 }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 160 }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 160 }}  />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ borderRadius: 12 }}  />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText style={{ height: 24, width: 24 }} />
            {tr('طلبات الموارد البشرية', 'HR Requests')}
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {tr('إدارة طلبات الموظفين والموافقات والتصعيدات', 'Manage employee requests, approvals, and escalations')}
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => setNewDialogOpen(true)}>
          <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
          {tr('طلب جديد', 'New Request')}
        </CVisionButton>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} loading={false} />

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 384 }}>
          <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
          <CVisionInput C={C}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('بحث في الطلبات...', 'Search requests...')}
            style={{ paddingLeft: 36 }}
          />
        </div>

        <CVisionSelect C={C}
          value={typeFilter || 'all'}
          onChange={(val) => setTypeFilter(val === 'all' ? '' : val)}
          placeholder={tr('جميع الأنواع', 'All Types')}
          options={[
            { value: 'all', label: tr('جميع الأنواع', 'All Types') },
            ...Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => ({ value, label: String(label) })),
          ]}
          style={{ width: 160 }}
        />

        <CVisionSelect C={C}
          value={statusFilter || 'all'}
          onChange={(val) => setStatusFilter(val === 'all' ? '' : val)}
          placeholder={tr('جميع الحالات', 'All Statuses')}
          options={[
            { value: 'all', label: tr('جميع الحالات', 'All Statuses') },
            ...Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label: String(label) })),
          ]}
          style={{ width: 160 }}
        />

        <CVisionSelect C={C}
          value={priorityFilter || 'all'}
          onChange={(val) => setPriorityFilter(val === 'all' ? '' : val)}
          placeholder={tr('جميع الأولويات', 'All Priorities')}
          options={[
            { value: 'all', label: tr('جميع الأولويات', 'All Priorities') },
            ...Object.entries(REQUEST_PRIORITY_LABELS).map(([value, label]) => ({ value, label: String(label) })),
          ]}
          style={{ width: 140 }}
        />

        {hasFilters && (
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={clearFilters}>
            <X style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('مسح', 'Clear')}
          </CVisionButton>
        )}
      </div>

      {/* Request Cards */}
      {filteredRequests.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
          <Inbox style={{ height: 64, width: 64, marginBottom: 16 }} />
          {hasFilters ? (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>{tr('لا توجد طلبات مطابقة', 'No matching requests')}</h3>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                {tr('حاول تعديل الفلاتر أو كلمة البحث.', 'Try adjusting your filters or search query.')}
              </p>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 16 }} onClick={clearFilters}>
                {tr('مسح الفلاتر', 'Clear Filters')}
              </CVisionButton>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>{tr('لا توجد طلبات بعد', 'No requests yet')}</h3>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                {tr('أنشئ أول طلب للبدء.', 'Create your first request to get started.')}
              </p>
              <CVisionButton C={C} isDark={isDark} style={{ marginTop: 16 }} onClick={() => setNewDialogOpen(true)}>
                <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
                {tr('طلب جديد', 'New Request')}
              </CVisionButton>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              employeeName={employeeMap.get(req.requesterEmployeeId)}
              departmentName={departmentMap.get(req.departmentId)}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Result count */}
      {filteredRequests.length > 0 && hasFilters && (
        <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
          {tr(`عرض ${filteredRequests.length} من ${requests.length} طلب`, `Showing ${filteredRequests.length} of ${requests.length} requests`)}
        </p>
      )}

      {/* Dialogs */}
      <NewRequestDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={refetchAll}
      />
      <RequestDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        requestId={selectedRequestId}
        onStatusChange={refetchAll}
      />
    </div>
  );
}
