'use client';

// =============================================================================
// Department Input — Track patient department entries/exits
// =============================================================================

import { useState, useCallback, ReactNode } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Search, LogIn, LogOut, RefreshCw, FlaskConical, Eye, Zap, Activity, Heart, ChevronDown, Building2, Microscope, Scissors, Bone, Flower2, ShieldAlert, CircleDot } from 'lucide-react';

// ── Department config ────────────────────────────────────────────────────────
const DEPARTMENTS: { key: string; labelEn: string; labelAr: string; icon: ReactNode }[] = [
  { key: 'OPD',            labelEn: 'OPD',            labelAr: 'العيادات الخارجية',    icon: <Building2 className="h-5 w-5" /> },
  { key: 'LABORATORY',     labelEn: 'Laboratory',     labelAr: 'المختبر',             icon: <FlaskConical className="h-5 w-5" /> },
  { key: 'RADIOLOGY',      labelEn: 'Radiology',      labelAr: 'الأشعة',              icon: <Microscope className="h-5 w-5" /> },
  { key: 'OPERATING_ROOM', labelEn: 'Operating Room', labelAr: 'غرفة العمليات',       icon: <Scissors className="h-5 w-5" /> },
  { key: 'CATH_LAB',       labelEn: 'Cath Lab',       labelAr: 'مختبر القسطرة',       icon: <Heart className="h-5 w-5" /> },
  { key: 'PHYSIOTHERAPY',  labelEn: 'Physiotherapy',  labelAr: 'العلاج الطبيعي',     icon: <Bone className="h-5 w-5" /> },
  { key: 'DELIVERY',       labelEn: 'Delivery',       labelAr: 'غرفة الولادة',        icon: <Flower2 className="h-5 w-5" /> },
  { key: 'CRITICAL_CARE',  labelEn: 'Critical Care',  labelAr: 'العناية المركزة',    icon: <ShieldAlert className="h-5 w-5" /> },
  { key: 'MORTUARY',       labelEn: 'Mortuary',       labelAr: 'المشرحة',            icon: <CircleDot className="h-5 w-5" /> },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface PatientResult {
  id: string;
  fullName: string;
  mrn: string | null;
  dob: string | null;
}

interface EpisodeResult {
  id: string;
  encounterCoreId: string;
  status: string;
  location?: { ward?: string; room?: string; bed?: string } | null;
  createdAt: string;
  patientName?: string;
}

interface DepartmentEntry {
  id: string;
  departmentKey: string;
  status: string;
  enteredAt: string | null;
  exitedAt: string | null;
}

// ── Patient Search ───────────────────────────────────────────────────────────
function PatientSearch({
  onSelect,
  tr,
}: {
  onSelect: (patient: PatientResult) => void;
  tr: (ar: string, en: string) => string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=10`, { credentials: 'include' });
      const data = await res.json();
      setResults(data.patients ?? data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground block">{tr('بحث عن مريض', 'Search Patient')}</label>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          placeholder={tr('الاسم، MRN، الهوية...', 'Name, MRN, ID...')}
          className="w-full ps-10 pe-4 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          {tr('جارٍ البحث...', 'Searching...')}
        </div>
      )}

      {results.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setResults([]); setQuery(''); }}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-start"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{p.fullName}</p>
                <p className="text-xs text-muted-foreground">MRN: {p.mrn ?? '—'}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DepartmentInput() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeResult[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeResult | null>(null);
  const [entries, setEntries] = useState<DepartmentEntry[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // ── Load episodes for patient ──
  const loadEpisodes = async (p: PatientResult) => {
    setPatient(p);
    setSelectedEpisode(null);
    setEntries([]);
    setLoadingEpisodes(true);
    try {
      const res = await fetch(`/api/ipd/episodes?patientId=${p.id}`, { credentials: 'include' });
      const data = await res.json();
      setEpisodes(data.episodes ?? data.items ?? []);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  // ── Load department entries for an episode ──
  const loadEntries = async (ep: EpisodeResult) => {
    setSelectedEpisode(ep);
    setLoadingEntries(true);
    try {
      const res = await fetch(`/api/departments/active?encounterCoreId=${ep.encounterCoreId}`, { credentials: 'include' });
      const data = await res.json();
      setEntries(data.items ?? []);
    } finally {
      setLoadingEntries(false);
    }
  };

  // ── Enter a department ──
  const enter = async (deptKey: string) => {
    if (!selectedEpisode) return;
    setActing(deptKey);
    try {
      await fetch('/api/departments/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ encounterCoreId: selectedEpisode.encounterCoreId, departmentKey: deptKey }),
      });
      await loadEntries(selectedEpisode);
    } finally {
      setActing(null);
    }
  };

  // ── Exit a department ──
  const exit = async (deptKey: string) => {
    if (!selectedEpisode) return;
    setActing(deptKey);
    try {
      await fetch('/api/departments/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ encounterCoreId: selectedEpisode.encounterCoreId, departmentKey: deptKey }),
      });
      await loadEntries(selectedEpisode);
    } finally {
      setActing(null);
    }
  };

  const activeEntries = new Set(entries.filter(e => e.status === 'IN').map(e => e.departmentKey));

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-500" />
          {tr('تتبع التنقل بين الأقسام', 'Department Entry Tracking')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tr('تسجيل دخول وخروج المرضى من الأقسام المختلفة', 'Track patient movement across hospital departments')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Patient + Episode Selection ── */}
        <div className="space-y-4">
          {/* Patient Search */}
          <div className="bg-card rounded-xl border border-border p-4">
            <PatientSearch onSelect={loadEpisodes} tr={tr} />
          </div>

          {/* Selected Patient */}
          {patient && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs text-blue-500 font-medium mb-1">{tr('المريض المختار', 'Selected Patient')}</p>
              <p className="font-semibold text-sm text-foreground">{patient.fullName}</p>
              <p className="text-xs text-muted-foreground">MRN: {patient.mrn ?? '—'}</p>
            </div>
          )}

          {/* Episodes List */}
          {patient && (
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">{tr('مراحل الدخول (IPD)', 'IPD Episodes')}</p>
              {loadingEpisodes ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {tr('جارٍ التحميل...', 'Loading...')}
                </div>
              ) : episodes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{tr('لا توجد مراحل دخول', 'No episodes found')}</p>
              ) : (
                <div className="space-y-1.5">
                  {episodes.slice(0, 5).map(ep => (
                    <button
                      key={ep.id}
                      onClick={() => loadEntries(ep)}
                      className={`w-full text-start text-xs px-3 py-2 rounded-lg border transition ${
                        selectedEpisode?.id === ep.id
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="font-medium">{ep.status}</span>
                      <span className="text-muted-foreground ms-2">{new Date(ep.createdAt).toLocaleDateString()}</span>
                      {ep.location?.ward && <span className="text-muted-foreground ms-2">— {ep.location.ward}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Department Grid ── */}
        <div className="lg:col-span-2">
          {!selectedEpisode ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 bg-card rounded-xl border border-border">
              <Zap className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">{tr('اختر مريضاً ومرحلة دخول', 'Select a patient and episode')}</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-foreground">
                  {tr('حالة الأقسام', 'Department Status')}
                </h3>
                {loadingEntries && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {DEPARTMENTS.map(dept => {
                  const isActive = activeEntries.has(dept.key);
                  const isActing = acting === dept.key;

                  return (
                    <div
                      key={dept.key}
                      className={`rounded-xl border p-3 transition ${
                        isActive
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : 'border-border bg-muted/50/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{dept.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {isAr ? dept.labelAr : dept.labelEn}
                          </p>
                          {isActive && (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              {tr('داخل القسم', 'Currently IN')}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => isActive ? exit(dept.key) : enter(dept.key)}
                        disabled={isActing}
                        className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                          isActive
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isActing ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : isActive ? (
                          <>
                            <LogOut className="h-3 w-3" />
                            {tr('خروج', 'Exit')}
                          </>
                        ) : (
                          <>
                            <LogIn className="h-3 w-3" />
                            {tr('دخول', 'Enter')}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Active entries summary */}
              {entries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{tr('سجل الأقسام', 'Entry Log')}</p>
                  <div className="space-y-1">
                    {entries.slice(0, 8).map(entry => {
                      const deptInfo = DEPARTMENTS.find(d => d.key === entry.departmentKey);
                      return (
                        <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{deptInfo ? (isAr ? deptInfo.labelAr : deptInfo.labelEn) : entry.departmentKey}</span>
                          <div className="flex items-center gap-2">
                            {entry.enteredAt && (
                              <span>{tr('دخل:', 'In:')} {new Date(entry.enteredAt).toLocaleTimeString()}</span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              entry.status === 'IN' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                            }`}>
                              {entry.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
