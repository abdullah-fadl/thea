'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';
import { DomainIntelligence } from '@/components/imdad/war-room/DomainIntelligence';
import { ExecutiveKPIs } from '@/components/imdad/war-room/ExecutiveKPIs';
import { ProcurementTimeline } from '@/components/imdad/war-room/ProcurementTimeline';
import { WhatIfEngine } from '@/components/imdad/war-room/WhatIfEngine';

type ExecutiveRole = 'CEO' | 'COO_GROUP' | 'CFO_GROUP' | 'CMO_GROUP' | 'GENERAL_DIRECTOR' | 'MEDICAL_DIRECTOR' | 'EXECUTIVE_DIRECTOR' | 'NURSING_DIRECTOR' | 'VP_SUPPLY_CHAIN' | 'CFO' | 'IT_DIRECTOR' | 'DENTAL_DIRECTOR' | 'SCM_MANAGER' | 'HEAD_OF_DEPARTMENT' | 'HEAD_NURSE';

// ---------------------------------------------------------------------------
// IMDAD EXECUTIVE WAR ROOM — Board-Level Intelligence Surface
// ---------------------------------------------------------------------------

const ROLES: Array<{ key: ExecutiveRole; labelEn: string; labelAr: string }> = [
  { key: 'GENERAL_DIRECTOR', labelEn: 'General Director', labelAr: 'المدير العام' },
  { key: 'MEDICAL_DIRECTOR', labelEn: 'Medical Director', labelAr: 'المدير الطبي' },
  { key: 'EXECUTIVE_DIRECTOR', labelEn: 'Executive Director', labelAr: 'المدير التنفيذي' },
  { key: 'NURSING_DIRECTOR', labelEn: 'Nursing Director', labelAr: 'مديرة التمريض' },
  { key: 'CFO', labelEn: 'CFO', labelAr: 'المدير المالي' },
  { key: 'IT_DIRECTOR', labelEn: 'IT Director', labelAr: 'مدير تقنية المعلومات' },
  { key: 'DENTAL_DIRECTOR', labelEn: 'Dental Director', labelAr: 'مدير الأسنان' },
  { key: 'SCM_MANAGER', labelEn: 'Supply Chain Manager', labelAr: 'مدير سلسلة الإمداد' },
  { key: 'HEAD_OF_DEPARTMENT', labelEn: 'Head of Dept.', labelAr: 'رئيس القسم' },
  { key: 'HEAD_NURSE', labelEn: 'Head Nurse', labelAr: 'رئيسة التمريض' },
];

// Role-to-domain visibility mapping
const ROLE_DOMAINS: Record<ExecutiveRole, string[] | 'all'> = {
  CEO: 'all',
  COO_GROUP: 'all',
  CFO_GROUP: 'all',
  CMO_GROUP: 'all',
  VP_SUPPLY_CHAIN: 'all',
  GENERAL_DIRECTOR: 'all', // Boss of Medical, Executive, Nursing Directors — sees everything
  MEDICAL_DIRECTOR: ['medical_consumables', 'medical_devices', 'dental'], // Clinical domains
  EXECUTIVE_DIRECTOR: 'all', // Admin/support: finance, HR, IT, FMS, patient services
  NURSING_DIRECTOR: ['medical_consumables', 'medical_devices'], // Nursing-linked supplies
  CFO: 'all', // Financial oversight across all domains
  IT_DIRECTOR: ['it_infrastructure', 'office_equipment'],
  DENTAL_DIRECTOR: ['dental', 'medical_devices'],
  SCM_MANAGER: 'all', // Supply chain oversight
  HEAD_OF_DEPARTMENT: ['medical_consumables', 'medical_devices'], // Department-level
  HEAD_NURSE: ['medical_consumables'], // Nursing ward supplies
};

const KEYFRAMES = `
@keyframes scanLine { 0% { top: -2px; } 100% { top: 100vh; } }
@keyframes sweep { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes gradientDrift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`;

export default function WarRoomPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const stylesInjected = useRef(false);

  const brain = useImdadBrain();
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'procurement' | 'whatif'>('overview');
  const [role, setRole] = useState<ExecutiveRole>('GENERAL_DIRECTOR');
  const [isLive, setIsLive] = useState(true);
  const [cycleCount] = useState(1);

  // Derive War Room data from brain state
  const domains = [
    { key: 'MEDICAL_CONSUMABLES', name: 'Medical Consumables', nameAr: 'مستهلكات طبية', icon: '🩹', riskScore: brain.pressure.dimensions.find((d: any) => d.key === 'supply')?.pressure ?? 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: brain.pulse.activeSignals, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'MEDICAL_DEVICES', name: 'Medical Devices', nameAr: 'أجهزة طبية', icon: '🔬', riskScore: brain.pressure.dimensions.find((d: any) => d.key === 'assets')?.pressure ?? 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'NON_MEDICAL_CONSUMABLES', name: 'Non-Medical Consumables', nameAr: 'مستهلكات غير طبية', icon: '📦', riskScore: 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'NON_MEDICAL_DEVICES', name: 'Non-Medical Equipment', nameAr: 'معدات غير طبية', icon: '🔧', riskScore: 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'FURNITURE', name: 'Furniture', nameAr: 'أثاث', icon: '🪑', riskScore: 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'OFFICE_EQUIPMENT', name: 'Office Equipment', nameAr: 'معدات مكتبية', icon: '🖨️', riskScore: 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'IT_SYSTEMS', name: 'IT Infrastructure', nameAr: 'بنية تقنية', icon: '💻', riskScore: brain.pressure.dimensions.find((d: any) => d.key === 'procurement')?.pressure ?? 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
    { key: 'DENTAL', name: 'Dental Domain', nameAr: 'قسم الأسنان', icon: '🦷', riskScore: 0, budgetAllocated: 0, budgetConsumed: 0, activeItems: 0, criticalItems: 0, lifecycleAlerts: 0, standardizationScore: 0, topVendor: '', trend: 'stable' as const },
  ];

  const executiveData = {
    totalBudget: 0,
    budgetUtilized: 0,
    budgetUtilizationPct: 0,
    riskIndex: Math.round(brain.pressure.composite),
    vendorCount: 0,
    vendorDependencyScore: 0,
    topDecisions: brain.decisions.slice(-3).map((d: any) => ({
      title: d.title ?? '',
      titleAr: d.titleAr ?? '',
      impact: `${((d.financialImpact?.estimatedCost ?? 0) / 1000).toFixed(0)}K SAR`,
      impactAr: `${((d.financialImpact?.estimatedCost ?? 0) / 1000).toFixed(0)} ألف ر.س`,
      confidence: d.confidenceScore ?? 0,
      type: d.type ?? 'SUPPLY_REORDER',
    })),
    standardizationOpportunities: 0,
    savingsPotential: 0,
    complianceScore: 0,
    networkHealthAvg: brain.pulse.healthScore,
  };

  const procurementOrders = (brain.procurement as any)?.length > 0 ? (brain.procurement as any) : [];

  useEffect(() => {
    if (stylesInjected.current) return;
    stylesInjected.current = true;
    const style = document.createElement('style');
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Filter domains by role
  const visibleDomains = useMemo(() => {
    const allowed = ROLE_DOMAINS[role];
    if (allowed === 'all') return domains;
    return domains.filter((d) => allowed.includes(d.key));
  }, [domains, role]);

  // Filter orders by role (domain-based)
  const visibleOrders = useMemo(() => {
    const allowed = ROLE_DOMAINS[role];
    if (allowed === 'all') return procurementOrders;
    return procurementOrders.filter((o) => (allowed as string[]).includes(o.domain));
  }, [procurementOrders, role]);

  const riskColor = executiveData.riskIndex >= 70 ? '#ef4444' : executiveData.riskIndex >= 40 ? '#f59e0b' : '#10b981';

  return (
    <div
      className="min-h-screen bg-[#040810] text-white overflow-hidden relative"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 30%, rgba(6,182,212,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(59,130,246,0.02) 0%, transparent 50%)',
          backgroundSize: '200% 200%',
          animation: 'gradientDrift 20s ease-in-out infinite',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-0 right-0 h-[1px] opacity-[0.06]" style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)', animation: 'scanLine 10s linear infinite' }} />
      </div>

      {/* ============================================================ */}
      {/* TOP BAR                                                      */}
      {/* ============================================================ */}
      <header className="relative z-10 border-b border-white/[0.06] bg-black/50 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1800px] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-lg font-bold">إ</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white/90 tracking-wide">
                  {tr('غرفة الحرب التنفيذية — إمداد', 'IMDAD — Executive War Room')}
                </h1>
                <p className="text-[10px] tracking-[0.3em] uppercase" style={{ color: `${riskColor}90` }}>
                  {tr('مستوى مجلس الإدارة — التحكم الاستراتيجي', 'Board Level — Strategic Control')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Live toggle */}
              <button
                onClick={() => setIsLive(!isLive)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all',
                  isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600')} />
                {isLive ? tr('مباشر', 'LIVE') : tr('متوقف', 'PAUSED')}
              </button>

              <span className="text-[10px] text-gray-600 font-mono">
                {tr('دورة', 'CYCLE')} #{cycleCount}
              </span>
            </div>
          </div>

          {/* Role Selector + Tab Navigation */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Role selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                {tr('الدور', 'Role')}:
              </span>
              <div className="flex gap-1 flex-wrap">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRole(r.key as ExecutiveRole)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                      role === r.key
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-400',
                    )}
                  >
                    {tr(r.labelAr, r.labelEn)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1">
              {([
                { key: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview' },
                { key: 'domains', labelAr: 'المجالات', labelEn: 'Domains' },
                { key: 'procurement', labelAr: 'المشتريات', labelEn: 'Procurement' },
                { key: 'whatif', labelAr: 'ماذا لو', labelEn: 'What-If' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    activeTab === tab.key
                      ? 'bg-white/10 text-white border border-white/15'
                      : 'text-gray-500 hover:text-gray-400 hover:bg-white/[0.04]',
                  )}
                >
                  {tr(tab.labelAr, tab.labelEn)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN CONTENT                                                 */}
      {/* ============================================================ */}
      <main className="relative z-10 mx-auto max-w-[1800px] px-6 py-6 space-y-6">
        {/* Always show Executive KPIs */}
        <ExecutiveKPIs data={executiveData} />

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <DomainIntelligence
                domains={visibleDomains}
                onSelectDomain={() => setActiveTab('domains')}
              />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <ProcurementTimeline orders={visibleOrders.slice(0, 8)} />
            </div>
          </div>
        )}

        {activeTab === 'domains' && (
          <DomainIntelligence
            domains={visibleDomains}
            onSelectDomain={() => {}}
          />
        )}

        {activeTab === 'procurement' && (
          <ProcurementTimeline orders={visibleOrders} />
        )}

        {activeTab === 'whatif' && (
          <WhatIfEngine />
        )}
      </main>

      {/* Scrollbar */}
      <style jsx global>{`
        .war-scroll::-webkit-scrollbar { width: 4px; }
        .war-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
        .war-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
}
