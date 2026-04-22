'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader,
  CVisionDialog, CVisionInput, CVisionPageHeader, CVisionPageLayout, CVisionSelect,
  CVisionSkeletonCard, CVisionTabs, CVisionTabContent, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { Users, Search, Building2, Cake, Calendar, Clock, UserPlus, ChevronDown, ChevronRight, Gift, Award, MapPin } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface DirectoryEmployee {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  jobTitleName?: string;
  departmentName?: string;
  departmentId?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  employeeNumber?: string;
  employeeNo?: string;
  status?: string;
  location?: string;
  managerId?: string;
  managerName?: string;
  hireDate?: string;
  dateOfBirth?: string;
  nationality?: string;
  gender?: string;
  photoUrl?: string;
}

interface DepartmentRef {
  id: string;
  _id?: string;
  name: string;
  code?: string;
}

interface OrgTreeNode {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  departmentName?: string;
  managerId?: string;
  children?: OrgTreeNode[];
}

interface WhosOutEntry {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

interface WhosOutData {
  onLeave: WhosOutEntry[];
  totalOnLeave: number;
  totalPresent: number;
  totalActive: number;
  absentRate: number;
}

interface BirthdayItem {
  firstName: string;
  lastName: string;
  departmentName?: string;
  jobTitle?: string;
  dateOfBirth?: string;
  day?: number;
}

interface AnniversaryItem {
  firstName: string;
  lastName: string;
  departmentName?: string;
  jobTitle?: string;
  hireDate?: string;
  years?: number;
  day?: number;
}

interface NewJoinerItem {
  firstName: string;
  lastName: string;
  departmentName?: string;
  jobTitle?: string;
  hireDate?: string;
  email?: string;
}

interface TabProps {
  C: any;
  isDark: boolean;
  tr: (ar: string, en: string) => string;
  isRTL: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────

function fmtDate(d: any) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getInitials(first: string, last: string) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// ─── Directory Tab ──────────────────────────────────────────────

function DirectoryTab({ C, isDark, tr, isRTL }: TabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<DirectoryEmployee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch departments
  const { data: deptRaw } = useQuery({
    queryKey: cvisionKeys.departments.list({ action: 'list', limit: 500 }),
    queryFn: () => cvisionFetch('/api/cvision/departments', { params: { action: 'list', limit: 500 } }),
  });
  const departments: DepartmentRef[] = (() => {
    const items = deptRaw?.items ?? deptRaw?.data ?? [];
    return Array.isArray(items) ? items.map((d: any) => ({ id: d.id || d._id, name: d.name, code: d.code })) : [];
  })();

  // Fetch employees
  const dirFilters: Record<string, any> = { action: 'search' };
  if (debouncedQuery) dirFilters.q = debouncedQuery;
  if (deptFilter) dirFilters.departmentId = deptFilter;

  const { data: empRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.directory.list(dirFilters),
    queryFn: () => cvisionFetch('/api/cvision/directory', { params: dirFilters }),
  });
  const employees: DirectoryEmployee[] = empRaw?.data?.items || [];
  const total = empRaw?.data?.total || 0;

  const openDetail = (emp: DirectoryEmployee) => { setSelectedEmployee(emp); setDetailOpen(true); };

  const deptOptions = [
    { value: '', label: tr('جميع الأقسام', 'All Departments') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', height: 16, width: 16, color: C.textMuted }} />
          <CVisionInput C={C}
            placeholder={tr('بحث بالاسم، البريد، رقم الموظف...', 'Search by name, email, employee number...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <CVisionSelect C={C} value={deptFilter} onChange={v => setDeptFilter(v)} options={deptOptions} />
        </div>
      </div>

      <p style={{ fontSize: 13, color: C.textMuted }}>
        {loading ? tr('جاري البحث...', 'Searching...') : `${total} ${tr('موظف', 'employee')}${!isRTL && total !== 1 ? 's' : ''} ${tr('تم العثور عليهم', 'found')}`}
      </p>

      {/* Employee Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={180} key={i} />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <Users style={{ width: 48, height: 48, color: C.textMuted, margin: '0 auto 12px' }} />
            <p style={{ color: C.textMuted }}>{tr('لم يتم العثور على موظفين', 'No employees found')}</p>
            {(searchQuery || deptFilter) && (
              <CVisionButton C={C} isDark={isDark} variant="ghost" style={{ marginTop: 8 }}
                onClick={() => { setSearchQuery(''); setDeptFilter(''); }}
              >
                {tr('مسح الفلاتر', 'Clear filters')}
              </CVisionButton>
            )}
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {employees.map((emp) => {
            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
            const initials = getInitials(emp.firstName, emp.lastName);
            return (
              <CVisionCard key={emp.id || emp._id} C={C} onClick={() => openDetail(emp)} style={{ cursor: 'pointer' }}>
                <CVisionCardBody style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.bgSubtle, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName || '\u2014'}</div>
                      <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {emp.jobTitle || emp.jobTitleName || '\u2014'}
                      </p>
                      {emp.departmentName && (
                        <CVisionBadge C={C} variant="muted" style={{ marginTop: 6, fontSize: 11 }}>
                          {emp.departmentName}
                        </CVisionBadge>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: C.textMuted }}>
                    {emp.email && <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</p>}
                    {(emp.phone || emp.mobile) && <p>{emp.phone || emp.mobile}</p>}
                    {(emp.employeeNumber || emp.employeeNo) && <p style={{ fontFamily: 'monospace', fontSize: 11 }}>#{emp.employeeNumber || emp.employeeNo}</p>}
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Employee Detail Dialog */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)}
        title={tr('تفاصيل الموظف', 'Employee Details')}
        titleAr={tr('تفاصيل الموظف', 'Employee Details')}
        isRTL={isRTL}
      >
        {selectedEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.bgSubtle, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
                {getInitials(selectedEmployee.firstName, selectedEmployee.lastName)}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
                  {`${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim()}
                </div>
                <p style={{ fontSize: 13, color: C.textMuted }}>
                  {selectedEmployee.jobTitle || selectedEmployee.jobTitleName || '\u2014'}
                </p>
                {selectedEmployee.status && (
                  <CVisionBadge C={C} variant="muted" style={{ marginTop: 4 }}>{selectedEmployee.status}</CVisionBadge>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
              {[
                [tr('القسم', 'Department'), selectedEmployee.departmentName],
                [tr('رقم الموظف', 'Employee Number'), selectedEmployee.employeeNumber || selectedEmployee.employeeNo],
                [tr('البريد', 'Email'), selectedEmployee.email],
                [tr('الهاتف', 'Phone'), selectedEmployee.phone || selectedEmployee.mobile],
                [tr('المدير', 'Manager'), selectedEmployee.managerName],
                [tr('الموقع', 'Location'), selectedEmployee.location],
                [tr('تاريخ التعيين', 'Hire Date'), fmtDate(selectedEmployee.hireDate)],
                [tr('الجنسية', 'Nationality'), selectedEmployee.nationality],
                [tr('الجنس', 'Gender'), selectedEmployee.gender],
                [tr('تاريخ الميلاد', 'Date of Birth'), fmtDate(selectedEmployee.dateOfBirth)],
              ].map(([label, val], i) => (
                <div key={i}>
                  <p style={{ color: C.textMuted, fontSize: 12 }}>{label}</p>
                  <p style={{ fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val || '\u2014'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CVisionDialog>
    </div>
  );
}

// ─── Org Chart Tab ──────────────────────────────────────────────

function OrgChartTab({ C, isDark, tr, isRTL }: TabProps) {
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchOrgTree(); }, []);

  const fetchOrgTree = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cvision/directory?action=org-tree', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setTree(data.data?.items || data.data || []);
      } else {
        toast.error(data.error || tr('فشل تحميل الهيكل التنظيمي', 'Failed to load org chart'));
      }
    } catch {
      toast.error(tr('خطأ في تحميل الهيكل التنظيمي', 'Error loading org chart'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CVisionSkeletonCard C={C} height={48} key={i} />
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
          <Users style={{ width: 48, height: 48, color: C.textMuted, margin: '0 auto 12px' }} />
          <p style={{ color: C.textMuted }}>{tr('لا تتوفر بيانات تنظيمية', 'No organizational data available')}</p>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 style={{ width: 20, height: 20, color: C.gold }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الهيكل التنظيمي', 'Organization Chart')}</span>
        </div>
      </CVisionCardHeader>
      <CVisionCardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tree.map((node) => (
            <OrgTreeNodeComponent key={node.id} node={node} depth={0} C={C} tr={tr} />
          ))}
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

function OrgTreeNodeComponent({ node, depth, C, tr }: { node: OrgTreeNode; depth: number; C: any; tr: (ar: string, en: string) => string }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const fullName = `${node.firstName || ''} ${node.lastName || ''}`.trim();
  const initials = getInitials(node.firstName, node.lastName);

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
          borderRadius: 8, marginLeft: depth * 24, cursor: hasChildren ? 'pointer' : 'default',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.bgSubtle; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded
            ? <ChevronDown style={{ width: 16, height: 16, color: C.textMuted, flexShrink: 0 }} />
            : <ChevronRight style={{ width: 16, height: 16, color: C.textMuted, flexShrink: 0 }} />
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.bgSubtle, color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
          {initials}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName || '\u2014'}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
            {node.jobTitle && <span>{node.jobTitle}</span>}
            {node.jobTitle && node.departmentName && <span style={{ opacity: 0.4 }}>|</span>}
            {node.departmentName && <span>{node.departmentName}</span>}
          </div>
        </div>

        {hasChildren && (
          <CVisionBadge C={C} variant="muted" style={{ fontSize: 11, flexShrink: 0 }}>
            {node.children!.length} {tr('تقرير', 'report')}{node.children!.length !== 1 ? 's' : ''}
          </CVisionBadge>
        )}
      </div>

      {hasChildren && expanded && (
        <div style={{ marginLeft: depth * 24 + 16, borderLeft: `2px solid ${C.border}`, paddingLeft: 16 }}>
          {node.children!.map((child) => (
            <OrgTreeNodeComponent key={child.id} node={child} depth={depth + 1} C={C} tr={tr} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Who's Out Tab ──────────────────────────────────────────────

function WhosOutTab({ C, isDark, tr, isRTL }: TabProps) {
  const [data, setData] = useState<WhosOutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWhosOut(); }, []);

  const fetchWhosOut = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cvision/directory?action=whos-out', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setData({
          onLeave: json.onLeave || [],
          totalOnLeave: json.totalOnLeave || 0,
          totalPresent: json.totalPresent || 0,
          totalActive: json.totalActive || 0,
          absentRate: json.absentRate || 0,
        });
      } else {
        toast.error(json.error || tr('فشل تحميل بيانات الغياب', 'Failed to load absence data'));
      }
    } catch {
      toast.error(tr('خطأ في تحميل بيانات الغياب', 'Error loading absence data'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={100} key={i} />)}
        </div>
        <CVisionSkeletonCard C={C} height={200} />
      </div>
    );
  }

  if (!data) {
    return (
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
          <Clock style={{ width: 48, height: 48, color: C.textMuted, margin: '0 auto 12px' }} />
          <p style={{ color: C.textMuted }}>{tr('لا تتوفر بيانات غياب', 'No absence data available')}</p>
        </CVisionCardBody>
      </CVisionCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>{tr('إجمالي الإجازات', 'Total On Leave')}</span>
              <Calendar style={{ width: 16, height: 16, color: C.orange }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{data.totalOnLeave}</div>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('موظفين غائبين حاليا', 'employees currently away')}</p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>{tr('إجمالي الحضور', 'Total Present')}</span>
              <Users style={{ width: 16, height: 16, color: C.green }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{data.totalPresent}</div>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('موظفين متاحين', 'employees available')}</p>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>{tr('نسبة الغياب', 'Absent Rate')}</span>
              <Clock style={{ width: 16, height: 16, color: C.red }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>
              {typeof data.absentRate === 'number' ? data.absentRate.toFixed(1) : '0'}%
            </div>
            <p style={{ fontSize: 12, color: C.textMuted }}>
              {tr(`من ${data.totalActive} موظف`, `of ${data.totalActive} total employees`)}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* On Leave Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar style={{ width: 20, height: 20, color: C.orange }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('موظفون في إجازة', 'Employees On Leave')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {data.onLeave.length === 0 ? (
            <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
              <Users style={{ width: 40, height: 40, color: C.textMuted, margin: '0 auto 8px' }} />
              <p style={{ color: C.textMuted }}>{tr('لا يوجد موظفون في إجازة حاليا', 'No employees are currently on leave')}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('الاسم', 'Name')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('نوع الإجازة', 'Leave Type')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('تاريخ البدء', 'Start Date')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('تاريخ الانتهاء', 'End Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.onLeave.map((entry, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, color: C.text }}>{entry.employeeName}</td>
                      <td style={{ padding: '8px 12px' }}><CVisionBadge C={C} variant="muted">{entry.leaveType}</CVisionBadge></td>
                      <td style={{ padding: '8px 12px', color: C.textSecondary }}>{fmtDate(entry.startDate)}</td>
                      <td style={{ padding: '8px 12px', color: C.textSecondary }}>{fmtDate(entry.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ─── Birthdays Tab ──────────────────────────────────────────────

function BirthdaysTab({ C, isDark, tr, isRTL }: TabProps) {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeSection, setActiveSection] = useState<'birthdays' | 'anniversaries'>('birthdays');
  const [birthdays, setBirthdays] = useState<BirthdayItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryItem[]>([]);
  const [newJoiners, setNewJoiners] = useState<NewJoinerItem[]>([]);
  const [birthdayTotal, setBirthdayTotal] = useState(0);
  const [anniversaryTotal, setAnniversaryTotal] = useState(0);
  const [joinerTotal, setJoinerTotal] = useState(0);
  const [loadingBirthdays, setLoadingBirthdays] = useState(true);
  const [loadingAnniversaries, setLoadingAnniversaries] = useState(true);
  const [loadingJoiners, setLoadingJoiners] = useState(true);

  useEffect(() => { fetchBirthdays(); fetchAnniversaries(); }, [selectedMonth]);
  useEffect(() => { fetchNewJoiners(); }, []);

  const fetchBirthdays = async () => {
    setLoadingBirthdays(true);
    try {
      const res = await fetch(`/api/cvision/directory?action=birthdays&month=${selectedMonth}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) { setBirthdays(data.data?.items || []); setBirthdayTotal(data.data?.total || 0); }
    } catch { toast.error(tr('خطأ في تحميل أعياد الميلاد', 'Error loading birthdays')); } finally { setLoadingBirthdays(false); }
  };

  const fetchAnniversaries = async () => {
    setLoadingAnniversaries(true);
    try {
      const res = await fetch(`/api/cvision/directory?action=anniversaries&month=${selectedMonth}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) { setAnniversaries(data.data?.items || []); setAnniversaryTotal(data.data?.total || 0); }
    } catch { toast.error(tr('خطأ في تحميل الذكريات', 'Error loading anniversaries')); } finally { setLoadingAnniversaries(false); }
  };

  const fetchNewJoiners = async () => {
    setLoadingJoiners(true);
    try {
      const res = await fetch('/api/cvision/directory?action=new-joiners', { credentials: 'include' });
      const data = await res.json();
      if (data.success) { setNewJoiners(data.data?.items || []); setJoinerTotal(data.data?.total || 0); }
    } catch { toast.error(tr('خطأ في تحميل الموظفين الجدد', 'Error loading new joiners')); } finally { setLoadingJoiners(false); }
  };

  const monthOptions = MONTHS_EN.map((m, i) => ({ value: (i + 1).toString(), label: isRTL ? MONTHS_AR[i] : m }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Month selector and toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 180 }}>
          <CVisionSelect C={C} value={selectedMonth.toString()} onChange={v => setSelectedMonth(parseInt(v))} options={monthOptions} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <CVisionButton C={C} isDark={isDark}
            variant={activeSection === 'birthdays' ? 'primary' : 'ghost'} size="sm"
            style={{ borderRadius: 0, gap: 6 }}
            onClick={() => setActiveSection('birthdays')}
          >
            <Cake style={{ width: 14, height: 14 }} /> {tr('أعياد الميلاد', 'Birthdays')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark}
            variant={activeSection === 'anniversaries' ? 'primary' : 'ghost'} size="sm"
            style={{ borderRadius: 0, gap: 6 }}
            onClick={() => setActiveSection('anniversaries')}
          >
            <Award style={{ width: 14, height: 14 }} /> {tr('ذكريات العمل', 'Anniversaries')}
          </CVisionButton>
        </div>
      </div>

      {/* Birthdays Section */}
      {activeSection === 'birthdays' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cake style={{ width: 20, height: 20, color: C.purple }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {tr(`أعياد الميلاد في ${MONTHS_AR[selectedMonth - 1]}`, `Birthdays in ${MONTHS_EN[selectedMonth - 1]}`)}
              </span>
              <CVisionBadge C={C} variant="muted" style={{ marginLeft: 8 }}>{birthdayTotal}</CVisionBadge>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            {loadingBirthdays ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={40} key={i} />)}
              </div>
            ) : birthdays.length === 0 ? (
              <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
                <Cake style={{ width: 40, height: 40, color: C.textMuted, margin: '0 auto 8px' }} />
                <p style={{ color: C.textMuted }}>{tr('لا توجد أعياد ميلاد هذا الشهر', 'No birthdays this month')}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('الاسم', 'Name')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('القسم', 'Department')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('تاريخ الميلاد', 'Date of Birth')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('اليوم', 'Day')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {birthdays.map((item, idx) => {
                      const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim();
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.purpleDim, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                                {getInitials(item.firstName, item.lastName)}
                              </div>
                              <div>
                                <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{fullName}</p>
                                {item.jobTitle && <p style={{ fontSize: 12, color: C.textMuted }}>{item.jobTitle}</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', color: C.textSecondary }}>{item.departmentName || '\u2014'}</td>
                          <td style={{ padding: '8px 12px', color: C.textSecondary }}>{fmtDate(item.dateOfBirth)}</td>
                          <td style={{ padding: '8px 12px' }}><CVisionBadge C={C} variant="muted">{item.day || '\u2014'}</CVisionBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Anniversaries Section */}
      {activeSection === 'anniversaries' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award style={{ width: 20, height: 20, color: C.orange }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {tr(`ذكريات العمل في ${MONTHS_AR[selectedMonth - 1]}`, `Work Anniversaries in ${MONTHS_EN[selectedMonth - 1]}`)}
              </span>
              <CVisionBadge C={C} variant="muted" style={{ marginLeft: 8 }}>{anniversaryTotal}</CVisionBadge>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            {loadingAnniversaries ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={40} key={i} />)}
              </div>
            ) : anniversaries.length === 0 ? (
              <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
                <Award style={{ width: 40, height: 40, color: C.textMuted, margin: '0 auto 8px' }} />
                <p style={{ color: C.textMuted }}>{tr('لا توجد ذكريات عمل هذا الشهر', 'No work anniversaries this month')}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('الاسم', 'Name')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('القسم', 'Department')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('تاريخ التعيين', 'Hire Date')}</th>
                      <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('سنوات الخدمة', 'Years of Service')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anniversaries.map((item, idx) => {
                      const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim();
                      return (
                        <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.orangeDim, color: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                                {getInitials(item.firstName, item.lastName)}
                              </div>
                              <div>
                                <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{fullName}</p>
                                {item.jobTitle && <p style={{ fontSize: 12, color: C.textMuted }}>{item.jobTitle}</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', color: C.textSecondary }}>{item.departmentName || '\u2014'}</td>
                          <td style={{ padding: '8px 12px', color: C.textSecondary }}>{fmtDate(item.hireDate)}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <CVisionBadge C={C} variant="info">
                              {item.years || 0} {tr('سنة', 'year')}{(item.years || 0) !== 1 && !isRTL ? 's' : ''}
                            </CVisionBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* New Joiners */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus style={{ width: 20, height: 20, color: C.blue }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('المنضمون الجدد (آخر 30 يوم)', 'New Joiners (Last 30 Days)')}</span>
            <CVisionBadge C={C} variant="muted" style={{ marginLeft: 8 }}>{joinerTotal}</CVisionBadge>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {loadingJoiners ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={40} key={i} />)}
            </div>
          ) : newJoiners.length === 0 ? (
            <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center' }}>
              <UserPlus style={{ width: 40, height: 40, color: C.textMuted, margin: '0 auto 8px' }} />
              <p style={{ color: C.textMuted }}>{tr('لا يوجد موظفون جدد في آخر 30 يوم', 'No new joiners in the last 30 days')}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('الاسم', 'Name')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('القسم', 'Department')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('المسمى الوظيفي', 'Job Title')}</th>
                    <th style={{ textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', color: C.textMuted, fontWeight: 500 }}>{tr('تاريخ التعيين', 'Hire Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {newJoiners.map((item, idx) => {
                    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim();
                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.blueDim, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 12, flexShrink: 0 }}>
                              {getInitials(item.firstName, item.lastName)}
                            </div>
                            <div>
                              <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{fullName}</p>
                              {item.email && <p style={{ fontSize: 12, color: C.textMuted }}>{item.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', color: C.textSecondary }}>{item.departmentName || '\u2014'}</td>
                        <td style={{ padding: '8px 12px', color: C.textSecondary }}>{item.jobTitle || '\u2014'}</td>
                        <td style={{ padding: '8px 12px', color: C.textSecondary }}>{fmtDate(item.hireDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────

export default function DirectoryPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const tabs = [
    { key: 'directory', label: tr('الدليل', 'Directory'), icon: <Users style={{ height: 14, width: 14 }} /> },
    { key: 'org-chart', label: tr('الهيكل التنظيمي', 'Org Chart'), icon: <Building2 style={{ height: 14, width: 14 }} /> },
    { key: 'whos-out', label: tr('من غائب', "Who's Out"), icon: <Clock style={{ height: 14, width: 14 }} /> },
    { key: 'birthdays', label: tr('أعياد الميلاد', 'Birthdays'), icon: <Gift style={{ height: 14, width: 14 }} /> },
  ];

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('دليل الموظفين', 'Employee Directory')}
        titleEn="Employee Directory"
        icon={Users}
        iconColor={C.gold}
        isRTL={isRTL}
      />

      <CVisionTabs C={C} tabs={tabs}>
        <CVisionTabContent tabKey="directory">
          <DirectoryTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="org-chart">
          <OrgChartTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="whos-out">
          <WhosOutTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="birthdays">
          <BirthdaysTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} />
        </CVisionTabContent>
      </CVisionTabs>
    </CVisionPageLayout>
  );
}
