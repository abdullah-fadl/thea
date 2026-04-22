'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, Download, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionInput } from '@/components/cvision/ui';
import { sanitizeCsvCell } from '@/lib/cvision/utils/export';

export interface Column { field: string; label: string; visible?: boolean; width?: number; sortable?: boolean; render?: (value: any, row: any) => React.ReactNode; }

interface DataTableProps {
  tableId: string;
  columns: Column[];
  data: any[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSort?: (field: string, dir: 'asc' | 'desc') => void;
  loading?: boolean;
}

export default function DataTable({ tableId, columns: initialColumns, data, total = 0, page = 1, pageSize = 25, onPageChange, onPageSizeChange, onSort, loading }: DataTableProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [columns, setColumns] = useState(initialColumns.map(c => ({ ...c, visible: c.visible !== false })));
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadPrefs(); }, [tableId]);

  const loadPrefs = async () => {
    try {
      const r = await fetch(`/api/cvision/table-preferences?action=get&tableId=${tableId}`, { credentials: 'include' });
      const d = await r.json();
      if (d.ok && d.data) {
        if (d.data.columns) setColumns(prev => prev.map(c => { const saved = d.data.columns.find((sc: any) => sc.field === c.field); return saved ? { ...c, visible: saved.visible !== false, width: saved.width || c.width } : c; }));
        if (d.data.sortBy) { setSortBy(d.data.sortBy); setSortDir(d.data.sortDir || 'asc'); }
      }
    } catch {}
  };

  const savePrefs = useCallback(async (cols: typeof columns) => {
    try { await fetch('/api/cvision/table-preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', tableId, columns: cols.map(c => ({ field: c.field, visible: c.visible, width: c.width })), sortBy, sortDir, pageSize }), credentials: 'include' }); } catch {}
  }, [tableId, sortBy, sortDir, pageSize]);

  const toggleColumn = (field: string) => { const updated = columns.map(c => c.field === field ? { ...c, visible: !c.visible } : c); setColumns(updated); savePrefs(updated); };
  const handleSort = (field: string) => { const newDir = sortBy === field && sortDir === 'asc' ? 'desc' : 'asc'; setSortBy(field); setSortDir(newDir); onSort?.(field, newDir); };
  const visibleColumns = useMemo(() => columns.filter(c => c.visible), [columns]);
  const filteredData = useMemo(() => { if (!search) return data; const q = search.toLowerCase(); return data.filter(row => visibleColumns.some(c => String(row[c.field] ?? '').toLowerCase().includes(q))); }, [data, search, visibleColumns]);
  const totalPages = Math.ceil(total / pageSize) || 1;

  const exportCSV = () => {
    const header = visibleColumns.map(c => c.label).join(',');
    const rows = filteredData.map(row =>
      visibleColumns.map(c => {
        const sanitized = sanitizeCsvCell(row[c.field]);
        const escaped = sanitized.replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${tableId}-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <CVisionInput C={C} placeholder={tr('بحث...', 'Search...')} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260, height: 32, fontSize: 13 }} />
        <div style={{ flex: 1 }} />
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Settings2 size={14} />} onClick={() => setShowSettings(!showSettings)}>{tr('الأعمدة', 'Columns')}</CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Download size={14} />} onClick={exportCSV}>{tr('تصدير', 'Export')}</CVisionButton>
        <select value={pageSize} onChange={e => onPageSizeChange?.(Number(e.target.value))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '0 8px', height: 32, fontSize: 13, background: C.bgCard, color: C.text, cursor: 'pointer' }}>
          {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / {tr('صفحة', 'page')}</option>)}
        </select>
      </div>

      {showSettings && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, background: C.bgSubtle, borderRadius: 10 }}>
          {columns.map(c => (
            <button key={c.field} onClick={() => toggleColumn(c.field)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, fontSize: 11, border: c.visible ? 'none' : `1px solid ${C.border}`, background: c.visible ? C.gold : C.bgCard, color: c.visible ? '#fff' : C.text, cursor: 'pointer' }}>
              {c.visible ? <Eye size={12} /> : <EyeOff size={12} />}{c.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bgSubtle }}>
              {visibleColumns.map(c => (
                <th key={c.field} onClick={() => c.sortable !== false && handleSort(c.field)} style={{ padding: '8px 12px', textAlign: isRTL ? 'right' : 'left', fontWeight: 600, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, cursor: c.sortable !== false ? 'pointer' : 'default', whiteSpace: 'nowrap', width: c.width, userSelect: 'none' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{c.label}{sortBy === c.field && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={visibleColumns.length} style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>{tr('جاري التحميل...', 'Loading...')}</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>{tr('لا توجد بيانات', 'No data')}</td></tr>
            ) : filteredData.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = C.bgSubtle)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {visibleColumns.map(c => <td key={c.field} style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{c.render ? c.render(row[c.field], row) : String(row[c.field] ?? '\u2014')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: C.textMuted }}>{total} {tr('سجل', 'records')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1}><ChevronLeft size={14} /></CVisionButton>
          <span style={{ padding: '0 8px', color: C.textSecondary }}>{page} / {totalPages}</span>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages}><ChevronRight size={14} /></CVisionButton>
        </div>
      </div>
    </div>
  );
}
