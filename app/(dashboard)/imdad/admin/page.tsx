'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

const TEST_ACCOUNTS = [
  { nameAr: 'المدير العام', nameEn: 'General Director', email: 'gd@imdad.test', role: 'GENERAL_DIRECTOR' },
  { nameAr: 'مدير العمليات', nameEn: 'COO', email: 'coo@imdad.test', role: 'COO_GROUP' },
  { nameAr: 'مدير المشتريات', nameEn: 'Procurement Director', email: 'proc@imdad.test', role: 'PROCUREMENT_DIRECTOR' },
  { nameAr: 'مدير المستودع', nameEn: 'Warehouse Manager', email: 'wh@imdad.test', role: 'WAREHOUSE_MANAGER' },
  { nameAr: 'مدير الأصول', nameEn: 'Asset Manager', email: 'asset@imdad.test', role: 'ASSET_MANAGER' },
  { nameAr: 'مدير الجودة', nameEn: 'Quality Manager', email: 'quality@imdad.test', role: 'QUALITY_MANAGER' },
  { nameAr: 'المدير المالي', nameEn: 'Finance Director', email: 'fin@imdad.test', role: 'FINANCE_DIRECTOR' },
  { nameAr: 'مسؤول النظام', nameEn: 'System Admin', email: 'admin@imdad.test', role: 'IMDAD_ADMIN' },
];

const ROLE_DEFINITIONS = [
  { key: 'GENERAL_DIRECTOR', labelAr: 'المدير العام', labelEn: 'General Director', scope: 'Full access' },
  { key: 'COO_GROUP', labelAr: 'مدير العمليات', labelEn: 'COO', scope: 'Operations + decisions' },
  { key: 'PROCUREMENT_DIRECTOR', labelAr: 'مدير المشتريات', labelEn: 'Procurement Director', scope: 'Procurement + vendors' },
  { key: 'WAREHOUSE_MANAGER', labelAr: 'مدير المستودع', labelEn: 'Warehouse Manager', scope: 'Warehouse + inventory' },
  { key: 'ASSET_MANAGER', labelAr: 'مدير الأصول', labelEn: 'Asset Manager', scope: 'Assets + maintenance' },
  { key: 'QUALITY_MANAGER', labelAr: 'مدير الجودة', labelEn: 'Quality Manager', scope: 'Quality + compliance' },
  { key: 'FINANCE_DIRECTOR', labelAr: 'المدير المالي', labelEn: 'Finance Director', scope: 'Financial + budgets' },
  { key: 'IMDAD_ADMIN', labelAr: 'مسؤول النظام', labelEn: 'System Admin', scope: 'Platform configuration' },
];

export default function AdminPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('إدارة المنصة', 'Platform Admin')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('الحسابات والأدوار وإعدادات النظام', 'Accounts, roles, and system configuration')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Test Accounts */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('حسابات الاختبار', 'Test Accounts')}</h2>
          <div className="space-y-2">
            {TEST_ACCOUNTS.map((acc) => (
              <div key={acc.email} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-400">
                    {acc.nameEn.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? acc.nameAr : acc.nameEn}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{acc.email}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  {acc.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: Roles + System Config */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Role Definitions */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('تعريفات الأدوار', 'Role Definitions')}</h2>
            <div className="space-y-2">
              {ROLE_DEFINITIONS.map((role) => (
                <div key={role.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? role.labelAr : role.labelEn}</p>
                    <p className="text-[10px] text-gray-500">{role.scope}</p>
                  </div>
                  <span className="text-[10px] font-mono text-gray-600">{role.key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Configuration */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('إعدادات النظام', 'System Configuration')}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('حالة المحرك', 'Brain Engine')}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${brain.isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {brain.isRunning ? tr('يعمل', 'RUNNING') : tr('متوقف', 'STOPPED')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('الدورات المكتملة', 'Cycles Completed')}</span>
                <span className="text-xs font-mono text-cyan-400">{(brain.pulse as any).cyclesCompleted}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('درجة الاستقلالية', 'Autonomy Score')}</span>
                <span className="text-xs font-mono text-cyan-400">{brain.pulse.autonomyScore}%</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('صحة النظام', 'System Health')}</span>
                <span className="text-xs font-mono" style={{ color: brain.pulse.healthScore >= 80 ? '#22c55e' : brain.pulse.healthScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {brain.pulse.healthScore}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('المنشآت المتصلة', 'Connected Facilities')}</span>
                <span className="text-xs font-mono text-cyan-400">{brain.hospitals.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-400">{tr('آخر تحديث', 'Last Refresh')}</span>
                <span className="text-[10px] font-mono text-gray-500">
                  {brain.lastRefresh.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
