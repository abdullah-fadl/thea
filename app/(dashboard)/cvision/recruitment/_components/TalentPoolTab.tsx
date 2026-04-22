'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useState } from 'react';
import {
  Search, UserPlus, RefreshCw, Loader2, Mail, Phone,
  Calendar, DollarSign, Tag, Briefcase, Eye, Trash2,
  Filter, X, ChevronDown, ChevronUp,
} from 'lucide-react';

interface TalentEntry {
  id: string;
  candidateId: string;
  candidateName: string;
  email: string;
  phone?: string;
  skills: string[];
  totalExperience: number;
  expectedSalary?: number;
  source: string;
  status: string;
  tags: string[];
  notes: string;
  addedBy: string;
  matchedJobs: { requisitionId: string; jobTitle: string; score: number }[];
  lastContactDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PoolStats {
  total: number;
  active: number;
  bySkill: { skill: string; count: number }[];
  bySource: { source: string; count: number }[];
}

export default function TalentPoolTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const STATUS_OPTIONS = [
    { value: 'ALL', label: tr('جميع الحالات', 'All Statuses') },
    { value: 'ACTIVE', label: tr('نشط', 'Active') },
    { value: 'CONTACTED', label: tr('تم التواصل', 'Contacted') },
    { value: 'NOT_INTERESTED', label: tr('غير مهتم', 'Not Interested') },
    { value: 'HIRED', label: tr('تم التوظيف', 'Hired') },
  ];

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800 border-green-200',
    CONTACTED: 'bg-blue-100 text-blue-800 border-blue-200',
    NOT_INTERESTED: 'bg-gray-100 text-gray-700 border-gray-200',
    HIRED: 'bg-purple-100 text-purple-800 border-purple-200',
    ARCHIVED: 'bg-red-100 text-red-800 border-red-200',
  };

  const SOURCE_LABELS: Record<string, string> = {
    APPLICATION: tr('تقديم طلب', 'Application'),
    MANUAL: tr('يدوي', 'Manual'),
    AI_RECOMMENDED: tr('توصية الذكاء الاصطناعي', 'AI Recommended'),
  };

  const STATUS_DISPLAY: Record<string, string> = {
    ACTIVE: tr('نشط', 'Active'),
    CONTACTED: tr('تم التواصل', 'Contacted'),
    NOT_INTERESTED: tr('غير مهتم', 'Not Interested'),
    HIRED: tr('تم التوظيف', 'Hired'),
    ARCHIVED: tr('مؤرشف', 'Archived'),
  };

  const [entries, setEntries] = useState<TalentEntry[]>([]);
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoPopulating, setAutoPopulating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ candidateName: '', email: '', phone: '', skills: '', experience: '0', salary: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'talent-pool' });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const [poolRes, statsRes] = await Promise.all([
        fetch(`/api/cvision/ai/recommender?${params}`, { credentials: 'include', signal }),
        fetch('/api/cvision/ai/recommender?action=talent-pool-stats', { credentials: 'include', signal }),
      ]);
      const poolJson = await poolRes.json();
      const statsJson = await statsRes.json();
      setEntries(poolJson.data?.items || poolJson.data || []);
      setStats(statsJson.data || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { const ac = new AbortController(); loadData(ac.signal); return () => ac.abort(); }, [loadData]);

  async function handleAutoPopulate() {
    setAutoPopulating(true);
    try {
      const res = await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto-populate' }),
      });
      const json = await res.json();
      const added = json.data?.added || 0;
      if (added > 0) loadData();
    } catch { /* ignore */ }
    finally { setAutoPopulating(false); }
  }

  async function handleAddManual() {
    setSaving(true);
    try {
      await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-to-pool',
          candidateName: addForm.candidateName,
          email: addForm.email,
          phone: addForm.phone || undefined,
          skills: addForm.skills.split(',').map(s => s.trim()).filter(Boolean),
          totalExperience: Number(addForm.experience) || 0,
          expectedSalary: addForm.salary ? Number(addForm.salary) : undefined,
          source: 'MANUAL',
          tags: addForm.skills.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5),
          notes: addForm.notes,
        }),
      });
      setAddDialogOpen(false);
      setAddForm({ candidateName: '', email: '', phone: '', skills: '', experience: '0', salary: '', notes: '' });
      loadData();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function updateStatus(entryId: string, newStatus: string) {
    try {
      await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-pool-entry', id: entryId, status: newStatus }),
      });
      loadData();
    } catch { /* ignore */ }
  }

  async function removeEntry(entryId: string) {
    try {
      await fetch('/api/cvision/ai/recommender', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-from-pool', id: entryId }),
      });
      loadData();
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الإجمالي في المجمع', 'Total in Pool')}</p>
          </div>
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{stats.active}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('نشط', 'Active')}</p>
          </div>
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.bySkill.length}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('مهارات فريدة', 'Unique Skills')}</p>
          </div>
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700 }}>{stats.bySource.length}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>{tr('المصادر', 'Sources')}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1, width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
            <CVisionInput C={C}
              placeholder={tr('بحث بالاسم...', 'Search by name...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <CVisionSelect
                C={C}
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                style={{ width: 144 }}
              />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setAddDialogOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 500, background: C.gold, color: '#fff', borderRadius: 12 }}
          >
            <UserPlus style={{ height: 16, width: 16 }} />
            {tr('إضافة يدوية', 'Add Manually')}
          </button>
          <button
            onClick={handleAutoPopulate}
            disabled={autoPopulating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, borderRadius: 12 }}
          >
            {autoPopulating ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ height: 16, width: 16 }} />}
            {tr('ملء تلقائي', 'Auto-populate')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 128, borderRadius: 16 }}  />)}
        </div>
      )}

      {/* Entries */}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
          <Briefcase style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontWeight: 500 }}>{tr('مجمع المواهب فارغ', 'Talent pool is empty')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{tr('أضف مرشحين يدوياً أو استخدم الملء التلقائي من المتقدمين السابقين.', 'Add candidates manually or auto-populate from past applicants.')}</p>
        </div>
      )}

      {!loading && entries.map(entry => (
        <div key={entry.id} style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div
            style={{ padding: 16, cursor: 'pointer' }}
            onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h4 style={{ fontWeight: 600 }}>{entry.candidateName}</h4>
                  <CVisionBadge C={C} className={STATUS_COLORS[entry.status] || 'bg-gray-100 text-gray-800'}>
                    {STATUS_DISPLAY[entry.status] || entry.status}
                  </CVisionBadge>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 13, color: C.textMuted }}>
                  {entry.email && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail style={{ height: 12, width: 12 }} />{entry.email}</span>
                  )}
                  {entry.totalExperience > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ height: 12, width: 12 }} />{entry.totalExperience} {tr('سنوات', 'years')}</span>
                  )}
                  {entry.expectedSalary != null && entry.expectedSalary > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign style={{ height: 12, width: 12 }} />{tr('ر.س', 'SAR')} {entry.expectedSalary.toLocaleString()}</span>
                  )}
                  <span style={{ fontSize: 12 }}>{SOURCE_LABELS[entry.source] || entry.source}</span>
                </div>
                {/* Tags / skills */}
                {entry.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {entry.skills.slice(0, 6).map(s => (
                      <CVisionBadge C={C} key={s} variant="outline" style={{ fontSize: 12 }}>{s}</CVisionBadge>
                    ))}
                    {entry.skills.length > 6 && (
                      <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>+{entry.skills.length - 6}</CVisionBadge>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {entry.matchedJobs.length > 0 && (
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <p style={{ fontSize: 12, color: C.textMuted }}>{tr('أفضل تطابق', 'Best match')}</p>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{entry.matchedJobs[0].jobTitle}</p>
                    <p style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{entry.matchedJobs[0].score}%</p>
                  </div>
                )}
                {expandedEntry === entry.id ? <ChevronUp style={{ height: 16, width: 16 }} /> : <ChevronDown style={{ height: 16, width: 16 }} />}
              </div>
            </div>
          </div>

          {expandedEntry === entry.id && (
            <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Matched jobs */}
              {entry.matchedJobs.length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>{tr('الوظائف المتطابقة', 'Matched Jobs')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {entry.matchedJobs.map(mj => (
                      <div key={mj.requisitionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}>
                        <span>{mj.jobTitle}</span>
                        <CVisionBadge C={C} variant="secondary">{mj.score}%</CVisionBadge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {entry.notes && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>{tr('ملاحظات', 'Notes')}</p>
                  <p style={{ fontSize: 13 }}>{entry.notes}</p>
                </div>
              )}

              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('تمت الإضافة:', 'Added:')} {new Date(entry.createdAt).toLocaleDateString()}</p>

              {/* Actions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                {entry.status === 'ACTIVE' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(entry.id, 'CONTACTED'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, background: C.blueDim, borderRadius: 12 }}
                  >
                    <Mail style={{ height: 12, width: 12 }} /> {tr('تحديد كتم التواصل', 'Mark Contacted')}
                  </button>
                )}
                {entry.status !== 'HIRED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(entry.id, 'HIRED'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, border: `1px solid ${C.border}`, borderRadius: 12 }}
                  >
                    {tr('تحديد كتم التوظيف', 'Mark Hired')}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, color: C.red, border: `1px solid ${C.border}`, borderRadius: 12 }}
                >
                  <Trash2 style={{ height: 12, width: 12 }} /> {tr('أرشفة', 'Archive')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Top skills in pool */}
      {stats && stats.bySkill.length > 0 && entries.length > 0 && (
        <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{tr('أبرز المهارات في المجمع', 'Top Skills in Pool')}</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.bySkill.slice(0, 15).map(s => (
              <CVisionBadge C={C} key={s.skill} variant="secondary" style={{ fontSize: 12 }}>{s.skill} ({s.count})</CVisionBadge>
            ))}
          </div>
        </div>
      )}

      {/* Add manually dialog */}
      <CVisionDialog C={C} open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title={tr('إضافة مرشح', 'Add Candidate')} isDark={isDark}>                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الاسم *', 'Name *')}</label>
              <CVisionInput C={C}
                value={addForm.candidateName}
                onChange={e => setAddForm(f => ({ ...f, candidateName: e.target.value }))}
                placeholder={tr('الاسم الكامل', 'Full name')}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('البريد الإلكتروني *', 'Email *')}</label>
              <CVisionInput C={C}
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الهاتف', 'Phone')}</label>
              <CVisionInput C={C}
                value={addForm.phone}
                onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+966..."
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('المهارات (مفصولة بفاصلة)', 'Skills (comma-separated)')}</label>
              <CVisionInput C={C}
                value={addForm.skills}
                onChange={e => setAddForm(f => ({ ...f, skills: e.target.value }))}
                placeholder={tr('بايثون، تحليل بيانات، SQL', 'python, data analysis, SQL')}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('سنوات الخبرة', 'Years Experience')}</label>
                <CVisionInput C={C}
                  value={addForm.experience}
                  onChange={e => setAddForm(f => ({ ...f, experience: e.target.value }))}
                  type="number"
                  min="0"
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الراتب المتوقع (ر.س)', 'Expected Salary (SAR)')}</label>
                <CVisionInput C={C}
                  value={addForm.salary}
                  onChange={e => setAddForm(f => ({ ...f, salary: e.target.value }))}
                  type="number"
                  placeholder="12000"
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('ملاحظات', 'Notes')}</label>
              <CVisionInput C={C}
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={tr('أي ملاحظات إضافية...', 'Any additional notes...')}
              />
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <button onClick={() => setAddDialogOpen(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 12 }}>{tr('إلغاء', 'Cancel')}</button>
            <button
              onClick={handleAddManual}
              disabled={!addForm.candidateName || !addForm.email || saving}
              style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, background: C.gold, color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {saving && <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} />}
              {tr('إضافة إلى المجمع', 'Add to Pool')}
            </button>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
