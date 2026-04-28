'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Home, Building2, Users, Wrench, Zap, Plus, Search, PieChart,
  DollarSign, Bed, CheckCircle, Clock, AlertTriangle, Droplets, Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const API = '/api/cvision/housing';

// -- Helpers ----------------------------------------------------------------

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: any) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getTypeLabels(tr: (ar: string, en: string) => string): Record<string, string> {
  return {
    APARTMENT: tr('شقة', 'Apartment'), ROOM: tr('غرفة', 'Room'), VILLA: tr('فيلا', 'Villa'), SHARED_ROOM: tr('غرفة مشتركة', 'Shared Room'), BED_SPACE: tr('سرير', 'Bed Space'),
  };
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  OCCUPIED: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-yellow-100 text-yellow-700',
  RESERVED: 'bg-purple-100 text-purple-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const MAINT_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

const AMENITY_OPTIONS = [
  'Furnished', 'AC', 'Kitchen', 'Laundry', 'Parking', 'WiFi', 'TV', 'Gym',
];

// ===========================================================================
// UNITS TAB
// ===========================================================================

function UnitsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [units, setUnits] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formBuilding, setFormBuilding] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formUnitNumber, setFormUnitNumber] = useState('');
  const [formType, setFormType] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formMaxOccupants, setFormMaxOccupants] = useState('');
  const [formRent, setFormRent] = useState('');
  const [formContribution, setFormContribution] = useState('');
  const [formAmenities, setFormAmenities] = useState<string[]>([]);

  const housingFilters: Record<string, any> = { action: 'list' };
  if (statusFilter !== 'all') housingFilters.status = statusFilter;
  if (typeFilter !== 'all') housingFilters.type = typeFilter;

  const { data: listRaw, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: cvisionKeys.housing.list(housingFilters),
    queryFn: () => cvisionFetch(API, { params: housingFilters }),
  });
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: cvisionKeys.housing.list({ action: 'stats' }),
    queryFn: () => cvisionFetch(API, { params: { action: 'stats' } }),
  });

  useEffect(() => { setLoading(listLoading); }, [listLoading]);
  useEffect(() => { if (listRaw?.data) setUnits(listRaw.data.items || []); }, [listRaw]);
  useEffect(() => { if (statsData) setStats(statsData); }, [statsData]);

  const load = useCallback(() => { refetchList(); refetchStats(); }, [refetchList, refetchStats]);

  const resetForm = () => {
    setFormBuilding(''); setFormAddress(''); setFormUnitNumber('');
    setFormType(''); setFormFloor(''); setFormMaxOccupants('');
    setFormRent(''); setFormContribution(''); setFormAmenities([]);
  };

  const handleCreate = async () => {
    if (!formBuilding || !formUnitNumber || !formType) {
      toast.error('Please fill in Building, Unit Number, and Type');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create-unit',
          buildingName: formBuilding,
          buildingAddress: formAddress || undefined,
          unitNumber: formUnitNumber,
          type: formType,
          floor: parseInt(formFloor) || 0,
          maxOccupants: parseInt(formMaxOccupants) || 1,
          monthlyRent: parseFloat(formRent) || 0,
          employeeContribution: parseFloat(formContribution) || 0,
          amenities: formAmenities,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Unit created successfully');
        setCreateOpen(false);
        resetForm();
        load();
      } else {
        toast.error(data.error || 'Failed to create unit');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally { setSubmitting(false); }
  };

  const toggleAmenity = (amenity: string) => {
    setFormAmenities(prev =>
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  const filtered = units.filter((u: any) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        u.unitId?.toLowerCase().includes(q) ||
        u.buildingName?.toLowerCase().includes(q) ||
        u.unitNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48, width: '100%' }}  />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Total Units</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalUnits ?? 0}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Total Beds</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalBeds ?? 0}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Occupied Beds</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>{stats.occupiedBeds ?? 0}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Occupancy Rate</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{stats.occupancyRate ?? 0}%</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Available Units</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{stats.availableUnits ?? 0}</p>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>Monthly Rent</p>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{fmtSAR(stats.totalMonthlyRent ?? 0)}</p>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              placeholder="Search units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }}
            />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Status"
                options={[
                  { value: 'all', label: tr('كل الحالات', 'All Status') },
                  { value: 'AVAILABLE', label: tr('متاح', 'Available') },
                  { value: 'OCCUPIED', label: tr('مشغول', 'Occupied') },
                  { value: 'MAINTENANCE', label: tr('صيانة', 'Maintenance') },
                  { value: 'RESERVED', label: tr('محجوز', 'Reserved') },
                ]}
                style={{ width: 160 }}
              />
          <CVisionSelect
                C={C}
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Type"
                options={[
                  { value: 'all', label: tr('كل الأنواع', 'All Types') },
                  ...Object.entries(getTypeLabels(tr)).map(([k, v]) => (
                ({ value: k, label: v as string })
              )),
                ]}
                style={{ width: 160 }}
              />
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Add Unit
        </CVisionButton>
      </div>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionTable C={C}>
          <CVisionTableHead C={C}>
              <CVisionTh C={C}>Unit ID</CVisionTh>
              <CVisionTh C={C}>Building</CVisionTh>
              <CVisionTh C={C}>Unit #</CVisionTh>
              <CVisionTh C={C}>Type</CVisionTh>
              <CVisionTh C={C}>Floor</CVisionTh>
              <CVisionTh C={C}>Max Occupants</CVisionTh>
              <CVisionTh C={C}>Current</CVisionTh>
              <CVisionTh C={C}>Status</CVisionTh>
              <CVisionTh C={C} align="right">Monthly Rent (SAR)</CVisionTh>
              <CVisionTh C={C} align="right">Actions</CVisionTh>
          </CVisionTableHead>
          <CVisionTableBody>
            {filtered.length === 0 && (
              <CVisionTr C={C}>
                <CVisionTd align="center" colSpan={10} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
                  No units found
                </CVisionTd>
              </CVisionTr>
            )}
            {filtered.map((u: any) => (
              <CVisionTr C={C} key={u.id || u._id || u.unitId}>
                <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.unitId}</CVisionTd>
                <CVisionTd style={{ fontWeight: 500 }}>{u.buildingName}</CVisionTd>
                <CVisionTd>{u.unitNumber}</CVisionTd>
                <CVisionTd>
                  <CVisionBadge C={C} variant="outline">{getTypeLabels(tr)[u.type] || u.type}</CVisionBadge>
                </CVisionTd>
                <CVisionTd>{u.floor ?? '\u2014'}</CVisionTd>
                <CVisionTd>{u.maxOccupants ?? '\u2014'}</CVisionTd>
                <CVisionTd>{u.currentOccupants ?? 0}</CVisionTd>
                <CVisionTd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] || 'bg-gray-100 text-gray-700'}`}>
                    {u.status}
                  </span>
                </CVisionTd>
                <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtSAR(u.monthlyRent || 0)}</CVisionTd>
                <CVisionTd align="right">
                  <CVisionBadge C={C} variant="outline" className="cursor-default">{u.amenities?.length || 0} amenities</CVisionBadge>
                </CVisionTd>
              </CVisionTr>
            ))}
          </CVisionTableBody>
        </CVisionTable>
      </CVisionCard>

      {/* Create Unit Dialog */}
      <CVisionDialog C={C} open={createOpen} onClose={() => { resetForm(); setCreateOpen(false); }} title="Create" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Register a new housing unit in the system.</p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Building Name *</CVisionLabel>
                <CVisionInput C={C} value={formBuilding} onChange={(e) => setFormBuilding(e.target.value)} placeholder="e.g. Al Noor Tower" />
              </div>
              <div>
                <CVisionLabel C={C}>Building Address</CVisionLabel>
                <CVisionInput C={C} value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="e.g. King Fahd Rd" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Unit Number *</CVisionLabel>
                <CVisionInput C={C} value={formUnitNumber} onChange={(e) => setFormUnitNumber(e.target.value)} placeholder="e.g. 101" />
              </div>
              <div>
                <CVisionLabel C={C}>Type *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formType || undefined}
                onChange={setFormType}
                placeholder="Select type"
                options={Object.entries(getTypeLabels(tr)).map(([k, v]) => (
                      ({ value: k, label: v })
                    ))}
              />
              </div>
              <div>
                <CVisionLabel C={C}>Floor</CVisionLabel>
                <CVisionInput C={C} type="number" value={formFloor} onChange={(e) => setFormFloor(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Max Occupants</CVisionLabel>
                <CVisionInput C={C} type="number" value={formMaxOccupants} onChange={(e) => setFormMaxOccupants(e.target.value)} placeholder="1" />
              </div>
              <div>
                <CVisionLabel C={C}>Monthly Rent (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formRent} onChange={(e) => setFormRent(e.target.value)} placeholder="0" />
              </div>
              <div>
                <CVisionLabel C={C}>Employee Contribution (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formContribution} onChange={(e) => setFormContribution(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <CVisionLabel C={C}>Amenities</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                {AMENITY_OPTIONS.map((amenity) => (
                  <div key={amenity} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Checkbox
                      id={`amenity-${amenity}`}
                      checked={formAmenities.includes(amenity)}
                      onCheckedChange={() => toggleAmenity(amenity)}
                    />
                    <label htmlFor={`amenity-${amenity}`} style={{ fontSize: 13, cursor: 'pointer' }}>
                      {amenity}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCreateOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Unit'}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===========================================================================
// ASSIGNMENTS TAB
// ===========================================================================

function AssignmentsTab() {
  const { C, isDark } = useCVisionTheme();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formUnitId, setFormUnitId] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formMonthlyRate, setFormMonthlyRate] = useState('');
  const [formCheckInDate, setFormCheckInDate] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?action=list`, { credentials: 'include', signal });
      const data = await res.json();
      if (data.data) {
        // Flatten occupants from all units
        const items = data.data.items || [];
        const flat: any[] = [];
        items.forEach((unit: any) => {
          if (unit.occupants && unit.occupants.length > 0) {
            unit.occupants
              .filter((occ: any) => occ.status === 'ACTIVE')
              .forEach((occ: any) => {
                flat.push({
                  unitId: unit.unitId,
                  buildingName: unit.buildingName,
                  unitNumber: unit.unitNumber,
                  employeeId: occ.employeeId,
                  employeeName: occ.employeeName,
                  checkInDate: occ.checkInDate,
                  monthlyRate: occ.monthlyRate,
                  status: occ.status,
                });
              });
          }
        });
        setAssignments(flat);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const resetForm = () => {
    setFormUnitId(''); setFormEmployeeId(''); setFormEmployeeName('');
    setFormMonthlyRate(''); setFormCheckInDate('');
  };

  const handleAssign = async () => {
    if (!formUnitId || !formEmployeeId || !formEmployeeName) {
      toast.error('Please fill in Unit ID, Employee ID, and Employee Name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'assign-employee',
          unitId: formUnitId,
          employeeId: formEmployeeId,
          employeeName: formEmployeeName,
          monthlyRate: parseFloat(formMonthlyRate) || 0,
          checkInDate: formCheckInDate || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Employee assigned successfully');
        setAssignOpen(false);
        resetForm();
        load();
      } else {
        toast.error(data.error || 'Failed to assign employee');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally { setSubmitting(false); }
  };

  const handleCheckOut = async (unitId: string, employeeId: string) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'check-out', unitId, employeeId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Employee checked out successfully');
        load();
      } else {
        toast.error(data.error || 'Failed to check out');
      }
    } catch { toast.error('Error'); }
  };

  const filtered = assignments.filter((a: any) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        a.unitId?.toLowerCase().includes(q) ||
        a.buildingName?.toLowerCase().includes(q) ||
        a.employeeName?.toLowerCase().includes(q) ||
        a.employeeId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48, width: '100%' }}  />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              placeholder="Search assignments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: 240 }}
            />
          </div>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { resetForm(); setAssignOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Assign Employee
        </CVisionButton>
      </div>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionTable C={C}>
          <CVisionTableHead C={C}>
              <CVisionTh C={C}>Unit ID</CVisionTh>
              <CVisionTh C={C}>Building</CVisionTh>
              <CVisionTh C={C}>Employee</CVisionTh>
              <CVisionTh C={C}>Check-In Date</CVisionTh>
              <CVisionTh C={C} align="right">Monthly Rate (SAR)</CVisionTh>
              <CVisionTh C={C}>Status</CVisionTh>
              <CVisionTh C={C} align="right">Actions</CVisionTh>
          </CVisionTableHead>
          <CVisionTableBody>
            {filtered.length === 0 && (
              <CVisionTr C={C}>
                <CVisionTd align="center" colSpan={7} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
                  No active assignments found
                </CVisionTd>
              </CVisionTr>
            )}
            {filtered.map((a: any, idx: number) => (
              <CVisionTr C={C} key={`${a.unitId}-${a.employeeId}-${idx}`}>
                <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{a.unitId}</CVisionTd>
                <CVisionTd style={{ fontWeight: 500 }}>{a.buildingName}</CVisionTd>
                <CVisionTd>
                  <div>
                    <p style={{ fontWeight: 500 }}>{a.employeeName}</p>
                    <p style={{ fontSize: 12, color: C.textMuted }}>{a.employeeId}</p>
                  </div>
                </CVisionTd>
                <CVisionTd>{fmtDate(a.checkInDate)}</CVisionTd>
                <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtSAR(a.monthlyRate || 0)}</CVisionTd>
                <CVisionTd>
                  <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: '50%', fontSize: 12, fontWeight: 500, background: C.greenDim, color: C.green }}>
                    {a.status}
                  </span>
                </CVisionTd>
                <CVisionTd align="right">
                  <CVisionButton C={C} isDark={isDark}
                    variant="outline"
                    size="sm"
                    onClick={() => handleCheckOut(a.unitId, a.employeeId)}
                  >
                    Check Out
                  </CVisionButton>
                </CVisionTd>
              </CVisionTr>
            ))}
          </CVisionTableBody>
        </CVisionTable>
      </CVisionCard>

      {/* Assign Employee Dialog */}
      <CVisionDialog C={C} open={assignOpen} onClose={() => { resetForm(); setAssignOpen(false); }} title="Assign Housing" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Assign an employee to a housing unit.</p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div>
              <CVisionLabel C={C}>Unit ID *</CVisionLabel>
              <CVisionInput C={C} value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} placeholder="e.g. HU-001" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Employee ID *</CVisionLabel>
                <CVisionInput C={C} value={formEmployeeId} onChange={(e) => setFormEmployeeId(e.target.value)} placeholder="e.g. EMP-001" />
              </div>
              <div>
                <CVisionLabel C={C}>Employee Name *</CVisionLabel>
                <CVisionInput C={C} value={formEmployeeName} onChange={(e) => setFormEmployeeName(e.target.value)} placeholder="Full name" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Monthly Rate (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formMonthlyRate} onChange={(e) => setFormMonthlyRate(e.target.value)} placeholder="0" />
              </div>
              <div>
                <CVisionLabel C={C}>Check-In Date</CVisionLabel>
                <CVisionInput C={C} type="date" value={formCheckInDate} onChange={(e) => setFormCheckInDate(e.target.value)} />
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setAssignOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAssign} disabled={submitting}>
              {submitting ? 'Assigning...' : 'Assign'}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===========================================================================
// MAINTENANCE TAB
// ===========================================================================

function MaintenanceTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mStatusFilter, setMStatusFilter] = useState('all');

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formUnitId, setFormUnitId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('');
  const [formReportedBy, setFormReportedBy] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'maintenance' });
      if (mStatusFilter !== 'all') params.set('mStatus', mStatusFilter);
      const res = await fetch(`${API}?${params.toString()}`, { credentials: 'include', signal });
      const data = await res.json();
      if (data.data) setRequests(data.data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [mStatusFilter]);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  const resetForm = () => {
    setFormUnitId(''); setFormDescription(''); setFormPriority(''); setFormReportedBy('');
  };

  const handleSubmitRequest = async () => {
    if (!formUnitId || !formDescription || !formPriority) {
      toast.error('Please fill in Unit ID, Description, and Priority');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit-maintenance',
          unitId: formUnitId,
          description: formDescription,
          priority: formPriority,
          reportedBy: formReportedBy || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Maintenance request submitted');
        setSubmitOpen(false);
        resetForm();
        load();
      } else {
        toast.error(data.error || 'Failed to submit request');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally { setSubmitting(false); }
  };

  const handleResolve = async (unitId: string, requestId: string) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'resolve-maintenance', unitId, requestId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Maintenance request resolved');
        load();
      } else {
        toast.error(data.error || 'Failed to resolve');
      }
    } catch { toast.error('Error'); }
  };

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48, width: '100%' }}  />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CVisionSelect
                C={C}
                value={mStatusFilter}
                onChange={setMStatusFilter}
                placeholder="Status"
                options={[
                  { value: 'all', label: tr('كل الحالات', 'All Status') },
                  { value: 'OPEN', label: tr('مفتوح', 'Open') },
                  { value: 'IN_PROGRESS', label: tr('قيد التنفيذ', 'In Progress') },
                  { value: 'COMPLETED', label: tr('مكتمل', 'Completed') },
                ]}
                style={{ width: 176 }}
              />
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { resetForm(); setSubmitOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Submit Request
        </CVisionButton>
      </div>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionTable C={C}>
          <CVisionTableHead C={C}>
              <CVisionTh C={C}>Unit ID</CVisionTh>
              <CVisionTh C={C}>Building</CVisionTh>
              <CVisionTh C={C}>Description</CVisionTh>
              <CVisionTh C={C}>Priority</CVisionTh>
              <CVisionTh C={C}>Status</CVisionTh>
              <CVisionTh C={C}>Reported By</CVisionTh>
              <CVisionTh C={C}>Reported At</CVisionTh>
              <CVisionTh C={C}>Resolved At</CVisionTh>
              <CVisionTh C={C} align="right">Actions</CVisionTh>
          </CVisionTableHead>
          <CVisionTableBody>
            {requests.length === 0 && (
              <CVisionTr C={C}>
                <CVisionTd align="center" colSpan={9} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
                  No maintenance requests found
                </CVisionTd>
              </CVisionTr>
            )}
            {requests.map((r: any, idx: number) => (
              <CVisionTr C={C} key={r.requestId || r._id || idx}>
                <CVisionTd style={{ fontFamily: 'monospace', fontSize: 13 }}>{r.unitId}</CVisionTd>
                <CVisionTd style={{ fontWeight: 500 }}>{r.buildingName || '\u2014'}</CVisionTd>
                <CVisionTd style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</CVisionTd>
                <CVisionTd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[r.priority] || 'bg-gray-100 text-gray-700'}`}>
                    {r.priority}
                  </span>
                </CVisionTd>
                <CVisionTd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${MAINT_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                    {r.status?.replace('_', ' ')}
                  </span>
                </CVisionTd>
                <CVisionTd>{r.reportedBy || '\u2014'}</CVisionTd>
                <CVisionTd>{fmtDate(r.reportedAt)}</CVisionTd>
                <CVisionTd>{fmtDate(r.resolvedAt)}</CVisionTd>
                <CVisionTd align="right">
                  {r.status !== 'COMPLETED' && (
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      size="sm"
                      onClick={() => handleResolve(r.unitId, r.requestId)}
                    >
                      <CheckCircle style={{ height: 16, width: 16, marginRight: 4 }} /> Resolve
                    </CVisionButton>
                  )}
                </CVisionTd>
              </CVisionTr>
            ))}
          </CVisionTableBody>
        </CVisionTable>
      </CVisionCard>

      {/* Submit Maintenance Dialog */}
      <CVisionDialog C={C} open={submitOpen} onClose={() => { resetForm(); setSubmitOpen(false); }} title="Submit" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Report a maintenance issue for a housing unit.</p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div>
              <CVisionLabel C={C}>Unit ID *</CVisionLabel>
              <CVisionInput C={C} value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} placeholder="e.g. HU-001" />
            </div>
            <div>
              <CVisionLabel C={C}>Description *</CVisionLabel>
              <CVisionTextarea C={C}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the maintenance issue..."
                rows={3}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Priority *</CVisionLabel>
                <CVisionSelect
                C={C}
                value={formPriority || undefined}
                onChange={setFormPriority}
                placeholder="Select priority"
                options={[
                  { value: 'LOW', label: tr('منخفض', 'Low') },
                  { value: 'MEDIUM', label: tr('متوسط', 'Medium') },
                  { value: 'HIGH', label: tr('مرتفع', 'High') },
                  { value: 'URGENT', label: tr('عاجل', 'Urgent') },
                ]}
              />
              </div>
              <div>
                <CVisionLabel C={C}>Reported By</CVisionLabel>
                <CVisionInput C={C} value={formReportedBy} onChange={(e) => setFormReportedBy(e.target.value)} placeholder="Name" />
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===========================================================================
// UTILITIES TAB
// ===========================================================================

function UtilitiesTab() {
  const { C, isDark } = useCVisionTheme();
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [utilityRecords, setUtilityRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Record dialog
  const [recordOpen, setRecordOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formUnitId, setFormUnitId] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formElectricity, setFormElectricity] = useState('');
  const [formWater, setFormWater] = useState('');
  const [formInternet, setFormInternet] = useState('');

  const loadUnits = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?action=list`, { credentials: 'include', signal });
      const data = await res.json();
      if (data.data) setUnits(data.data.items || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); loadUnits(ac.signal); return () => ac.abort(); }, [loadUnits]);

  useEffect(() => {
    if (!selectedUnit) {
      setUtilityRecords([]);
      return;
    }
    const ac = new AbortController();
    setRecordsLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API}?action=list`, { credentials: 'include', signal: ac.signal });
        const data = await res.json();
        if (data.data) {
          const unit = (data.data.items || []).find((u: any) => u.unitId === selectedUnit);
          setUtilityRecords(unit?.utilities || []);
        }
      } catch { /* ignore */ } finally { setRecordsLoading(false); }
    })();
    return () => ac.abort();
  }, [selectedUnit]);

  const resetForm = () => {
    setFormUnitId(''); setFormMonth(''); setFormElectricity('');
    setFormWater(''); setFormInternet('');
  };

  const handleRecordUtility = async () => {
    if (!formUnitId || !formMonth) {
      toast.error('Please fill in Unit ID and Month');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'record-utility',
          unitId: formUnitId,
          month: formMonth,
          electricity: parseFloat(formElectricity) || 0,
          water: parseFloat(formWater) || 0,
          internet: parseFloat(formInternet) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Utility record saved');
        setRecordOpen(false);
        resetForm();
        // Refresh if same unit is selected
        if (formUnitId === selectedUnit) {
          setSelectedUnit('');
          setTimeout(() => setSelectedUnit(formUnitId), 100);
        }
      } else {
        toast.error(data.error || 'Failed to save utility record');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48, width: '100%' }}  />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CVisionSelect
                C={C}
                value={selectedUnit || undefined}
                onChange={setSelectedUnit}
                placeholder="Select a unit to view utilities"
                options={units.map((u: any) => (
                ({ value: u.unitId, label: `${u.unitId} - ${u.buildingName} #${u.unitNumber}` })
              ))}
                style={{ width: 240 }}
              />
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { resetForm(); setRecordOpen(true); }}>
          <Plus style={{ height: 16, width: 16, marginRight: 4 }} /> Record Utility
        </CVisionButton>
      </div>

      {/* Utility Records */}
      {!selectedUnit && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>
            <Zap style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.3 }} />
            <p>Select a unit above to view utility records</p>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {selectedUnit && recordsLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48, width: '100%' }}  />)}</div>
      )}

      {selectedUnit && !recordsLoading && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Utility Records for {selectedUnit}</div>
          </CVisionCardHeader>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C}>Month</CVisionTh>
                <CVisionTh C={C} align="right">Electricity (SAR)</CVisionTh>
                <CVisionTh C={C} align="right">Water (SAR)</CVisionTh>
                <CVisionTh C={C} align="right">Internet (SAR)</CVisionTh>
                <CVisionTh C={C} align="right">Total (SAR)</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {utilityRecords.length === 0 && (
                <CVisionTr C={C}>
                  <CVisionTd align="center" colSpan={5} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>
                    No utility records found for this unit
                  </CVisionTd>
                </CVisionTr>
              )}
              {utilityRecords.map((rec: any, idx: number) => {
                const total = (rec.electricity || 0) + (rec.water || 0) + (rec.internet || 0);
                return (
                  <CVisionTr C={C} key={rec.month || idx}>
                    <CVisionTd style={{ fontWeight: 500 }}>{rec.month}</CVisionTd>
                    <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtSAR(rec.electricity || 0)}</CVisionTd>
                    <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtSAR(rec.water || 0)}</CVisionTd>
                    <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13 }}>{fmtSAR(rec.internet || 0)}</CVisionTd>
                    <CVisionTd align="right" style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{fmtSAR(total)}</CVisionTd>
                  </CVisionTr>
                );
              })}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCard>
      )}

      {/* Record Utility Dialog */}
      <CVisionDialog C={C} open={recordOpen} onClose={() => { resetForm(); setRecordOpen(false); }} title="Record" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Record monthly utility costs for a housing unit.</p>          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Unit ID *</CVisionLabel>
                <CVisionInput C={C} value={formUnitId} onChange={(e) => setFormUnitId(e.target.value)} placeholder="e.g. HU-001" />
              </div>
              <div>
                <CVisionLabel C={C}>Month *</CVisionLabel>
                <CVisionInput C={C} value={formMonth} onChange={(e) => setFormMonth(e.target.value)} placeholder="e.g. 2026-02" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <CVisionLabel C={C}>Electricity (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formElectricity} onChange={(e) => setFormElectricity(e.target.value)} placeholder="0" />
              </div>
              <div>
                <CVisionLabel C={C}>Water (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formWater} onChange={(e) => setFormWater(e.target.value)} placeholder="0" />
              </div>
              <div>
                <CVisionLabel C={C}>Internet (SAR)</CVisionLabel>
                <CVisionInput C={C} type="number" value={formInternet} onChange={(e) => setFormInternet(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRecordOpen(false)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleRecordUtility} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Record'}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ===========================================================================
// OCCUPANCY REPORT TAB
// ===========================================================================

function OccupancyReportTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API}?action=occupancy-report`, { credentials: 'include', signal: ac.signal });
        const data = await res.json();
        if (data) setReport(data);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
    return () => ac.abort();
  }, []);

  if (loading) return <div style={{ display: 'grid', gap: 16 }}>{[...Array(8)].map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96 }}  />)}</div>;
  if (!report) return <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>No data available</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Total Units</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{report.totalUnits ?? 0}</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Total Beds</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{report.totalBeds ?? 0}</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Occupied Beds</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.blue }}>{report.occupiedBeds ?? 0}</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Occupancy Rate</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{report.occupancyRate ?? 0}%</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Available Units</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{report.availableUnits ?? 0}</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Maintenance Units</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{report.maintenanceUnits ?? 0}</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: C.textMuted }}>Monthly Rent</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{fmtSAR(report.totalMonthlyRent ?? 0)}</p>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Breakdown by Type */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Home style={{ height: 16, width: 16 }} /> Breakdown by Type
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C}>Type</CVisionTh>
                <CVisionTh C={C} align="right">Total</CVisionTh>
                <CVisionTh C={C} align="right">Occupied</CVisionTh>
                <CVisionTh C={C} align="right">Occupancy Rate</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {(!report.byType || report.byType.length === 0) && (
                <CVisionTr C={C}>
                  <CVisionTd align="center" colSpan={4} style={{ color: C.textMuted, paddingTop: 24, paddingBottom: 24 }}>
                    No type breakdown data
                  </CVisionTd>
                </CVisionTr>
              )}
              {(report.byType || []).map((row: any) => (
                <CVisionTr C={C} key={row.type}>
                  <CVisionTd>
                    <CVisionBadge C={C} variant="outline">{getTypeLabels(tr)[row.type] || row.type}</CVisionBadge>
                  </CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace' }}>{row.total ?? 0}</CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace' }}>{row.occupied ?? 0}</CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                    {row.occupancyRate ?? 0}%
                  </CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Breakdown by Building */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 style={{ height: 16, width: 16 }} /> Breakdown by Building
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
                <CVisionTh C={C}>Building</CVisionTh>
                <CVisionTh C={C} align="right">Total</CVisionTh>
                <CVisionTh C={C} align="right">Occupied</CVisionTh>
                <CVisionTh C={C} align="right">Occupancy Rate</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {(!report.byBuilding || report.byBuilding.length === 0) && (
                <CVisionTr C={C}>
                  <CVisionTd align="center" colSpan={4} style={{ color: C.textMuted, paddingTop: 24, paddingBottom: 24 }}>
                    No building breakdown data
                  </CVisionTd>
                </CVisionTr>
              )}
              {(report.byBuilding || []).map((row: any) => (
                <CVisionTr C={C} key={row.building}>
                  <CVisionTd style={{ fontWeight: 500 }}>{row.building}</CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace' }}>{row.total ?? 0}</CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace' }}>{row.occupied ?? 0}</CVisionTd>
                  <CVisionTd align="right" style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                    {row.occupancyRate ?? 0}%
                  </CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Housing Policy */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart style={{ height: 16, width: 16 }} /> Housing Policy
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Eligibility */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Eligibility by Marital Status</h4>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>Category</CVisionTh>
                  <CVisionTh C={C}>Eligible Unit Types</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Single Male</CVisionTd>
                  <CVisionTd>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CVisionBadge C={C} variant="outline">Shared Room</CVisionBadge>
                      <CVisionBadge C={C} variant="outline">Bed Space</CVisionBadge>
                      <CVisionBadge C={C} variant="outline">Room</CVisionBadge>
                    </div>
                  </CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Single Female</CVisionTd>
                  <CVisionTd>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CVisionBadge C={C} variant="outline">Room</CVisionBadge>
                      <CVisionBadge C={C} variant="outline">Apartment</CVisionBadge>
                    </div>
                  </CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Married</CVisionTd>
                  <CVisionTd>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CVisionBadge C={C} variant="outline">Apartment</CVisionBadge>
                      <CVisionBadge C={C} variant="outline">Villa</CVisionBadge>
                    </div>
                  </CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Family</CVisionTd>
                  <CVisionTd>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <CVisionBadge C={C} variant="outline">Apartment</CVisionBadge>
                      <CVisionBadge C={C} variant="outline">Villa</CVisionBadge>
                    </div>
                  </CVisionTd>
                </CVisionTr>
              </CVisionTableBody>
            </CVisionTable>
          </div>

          {/* Grade Allocation */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Grade Allocation</h4>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>Grade</CVisionTh>
                  <CVisionTh C={C}>Default Allocation</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Senior</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant="outline">Apartment</CVisionBadge></CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Manager</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant="outline">Apartment</CVisionBadge></CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Director</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant="outline">Villa</CVisionBadge></CVisionTd>
                </CVisionTr>
                <CVisionTr C={C}>
                  <CVisionTd style={{ fontWeight: 500 }}>Junior</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant="outline">Shared Room</CVisionBadge></CVisionTd>
                </CVisionTr>
              </CVisionTableBody>
            </CVisionTable>
          </div>

          {/* Max Stay */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: C.bgSubtle, borderRadius: 8 }}>
            <Clock style={{ height: 20, width: 20, color: C.textMuted }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>Maximum Stay Duration</p>
              <p style={{ fontSize: 13, color: C.textMuted }}>12 months</p>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ===========================================================================
// MAIN PAGE
// ===========================================================================

export default function HousingPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('units');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Home style={{ height: 24, width: 24 }} /> Housing & Accommodation
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Manage housing units, employee assignments, maintenance, utilities, and occupancy reports.
        </p>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'units', label: 'Units', icon: <Building2 style={{ height: 16, width: 16 }} /> },
          { id: 'assignments', label: 'Assignments', icon: <Users style={{ height: 16, width: 16 }} /> },
          { id: 'maintenance', label: 'Maintenance', icon: <Wrench style={{ height: 16, width: 16 }} /> },
          { id: 'utilities', label: 'Utilities', icon: <Zap style={{ height: 16, width: 16 }} /> },
          { id: 'occupancy', label: 'Occupancy Report', icon: <PieChart style={{ height: 16, width: 16 }} /> },
        ]}
      >
        <CVisionTabContent tabId="units"><UnitsTab /></CVisionTabContent>
        <CVisionTabContent tabId="assignments"><AssignmentsTab /></CVisionTabContent>
        <CVisionTabContent tabId="maintenance"><MaintenanceTab /></CVisionTabContent>
        <CVisionTabContent tabId="utilities"><UtilitiesTab /></CVisionTabContent>
        <CVisionTabContent tabId="occupancy"><OccupancyReportTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
