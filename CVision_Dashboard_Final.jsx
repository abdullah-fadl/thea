import { useState, useCallback } from "react";
import {
  Users, UserCheck, Palmtree, Target, ChevronLeft,
  LayoutDashboard, UserPlus, Wallet, Clock,
  TrendingUp, Settings, Download, Plus, ArrowUpRight,
  ArrowDownRight, Building2, Bell, Search,
  MoreHorizontal, Filter, Briefcase, GraduationCap,
  HeartPulse, CreditCard, Sun, Moon
} from "lucide-react";

const themes = {
  dark: {
    bg: "#08080F", bgSidebar: "#0C0C16", bgCard: "rgba(255,255,255,0.035)",
    bgCardHover: "rgba(255,255,255,0.06)", bgSubtle: "rgba(255,255,255,0.025)",
    border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
    gold: "#C9A962", goldLight: "#E2C97E", goldDim: "rgba(201,169,98,0.12)",
    purple: "#7C5CBF", purpleDim: "rgba(124,92,191,0.12)",
    text: "#E8E4DF", textSecondary: "#A09BA5", textMuted: "#6A6570",
    green: "#4ADE80", greenDim: "rgba(74,222,128,0.10)", greenBadge: "rgba(74,222,128,0.10)",
    red: "#F87171", redDim: "rgba(248,113,113,0.10)", redBadge: "rgba(248,113,113,0.10)",
    blue: "#60A5FA", blueDim: "rgba(96,165,250,0.10)", blueBadge: "rgba(96,165,250,0.10)",
    orange: "#FB923C", orangeDim: "rgba(251,146,60,0.10)", orangeBadge: "rgba(251,146,60,0.10)",
    shadow: "none", shadowHover: "none", notifBorder: "#08080F", headerBg: "transparent",
    barTrack: "rgba(255,255,255,0.04)", barAlpha: "50", avatarBorder: "20",
  },
  light: {
    bg: "#FAFAF8", bgSidebar: "#FFFFFF", bgCard: "#FFFFFF",
    bgCardHover: "#F8F7F4", bgSubtle: "#F4F3F0",
    border: "#ECEAE5", borderHover: "#D9D6CE",
    gold: "#9E7C3C", goldLight: "#B8944E", goldDim: "rgba(158,124,60,0.08)",
    purple: "#6B4FA0", purpleDim: "rgba(107,79,160,0.07)",
    text: "#1A1718", textSecondary: "#5C5558", textMuted: "#9A949C",
    green: "#16A34A", greenDim: "rgba(22,163,74,0.07)", greenBadge: "#DCFCE7",
    red: "#DC2626", redDim: "rgba(220,38,38,0.07)", redBadge: "#FEE2E2",
    blue: "#2563EB", blueDim: "rgba(37,99,235,0.07)", blueBadge: "#DBEAFE",
    orange: "#D97706", orangeDim: "rgba(217,119,6,0.07)", orangeBadge: "#FEF3C7",
    shadow: "0 1px 3px rgba(0,0,0,0.03)", shadowHover: "0 4px 20px rgba(0,0,0,0.06)",
    notifBorder: "#FFFFFF", headerBg: "#F4F3F0",
    barTrack: "#F4F3F0", barAlpha: "80", avatarBorder: "",
  },
};

function HoverCard({ children, C, style = {} }) {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? C.bgCardHover : C.bgCard,
        border: `1px solid ${h ? C.borderHover : C.border}`,
        borderRadius: 14, transition: "all 0.25s ease",
        boxShadow: h ? C.shadowHover : C.shadow, ...style,
      }}>{children}</div>
  );
}

function NavItem({ item, active, C, isDark, onClick }) {
  const [h, setH] = useState(false);
  const Icon = item.icon;
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 11px", borderRadius: 9, marginBottom: 2,
        cursor: "pointer", transition: "all 0.2s",
        background: active ? C.goldDim : (h ? C.bgSubtle : "transparent"),
        borderLeft: active ? `2.5px solid ${C.gold}` : "2.5px solid transparent",
      }}>
      <Icon size={17} color={active ? C.gold : C.textMuted} strokeWidth={active ? 2 : 1.5} />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? C.gold : C.textSecondary, transition: "color 0.3s" }}>{item.label}</div>
        <div style={{ fontSize: 8.5, color: C.textMuted, letterSpacing: 0.3 }}>{item.en}</div>
      </div>
    </div>
  );
}

function StatCard({ label, labelAr, value, change, icon: Icon, color, colorDim, C }) {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: "18px 20px", flex: 1, minWidth: 180,
        background: h ? C.bgCardHover : C.bgCard,
        border: `1px solid ${h ? C.borderHover : C.border}`,
        borderRadius: 14, transition: "all 0.25s ease",
        boxShadow: h ? C.shadowHover : C.shadow,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, opacity: 0.7 }}>{labelAr}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.text, marginTop: 8, letterSpacing: -1 }}>{value}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: colorDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} color={color} strokeWidth={1.8} />
        </div>
      </div>
      {change && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
          {change.startsWith("+") ? <ArrowUpRight size={13} color={C.green} /> : <ArrowDownRight size={13} color={C.red} />}
          <span style={{ fontSize: 12, fontWeight: 500, color: change.startsWith("+") ? C.green : C.red }}>{change}</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>من الشهر الماضي</span>
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ name, nameAr, dept, status, initials, role, C, isDark }) {
  const [h, setH] = useState(false);
  const sc = {
    "نشط": { bg: C.greenBadge, text: C.green },
    "تحت التجربة": { bg: C.orangeBadge, text: C.orange },
    "إجازة": { bg: C.blueBadge, text: C.blue },
    "مستقيل": { bg: C.redBadge, text: C.red },
  }[status] || { bg: C.greenBadge, text: C.green };
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", padding: "12px 20px",
        borderBottom: `1px solid ${C.border}`, cursor: "pointer",
        background: h ? C.bgSubtle : "transparent", transition: "background 0.2s",
      }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, marginLeft: 12,
        background: isDark ? `linear-gradient(135deg, ${C.gold}30, ${C.purple}30)` : `linear-gradient(135deg, ${C.goldDim}, ${C.purpleDim})`,
        border: `1px solid ${isDark ? C.gold + "20" : C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 600, color: C.gold,
      }}>{initials}</div>
      <div style={{ flex: 1, marginRight: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{name}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{nameAr}</div>
      </div>
      <div style={{ width: 110, fontSize: 12, color: C.textSecondary }}>{dept}</div>
      <div style={{ width: 90, fontSize: 12, color: C.textMuted }}>{role}</div>
      <div style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500, background: sc.bg, color: sc.text }}>{status}</div>
      <MoreHorizontal size={16} color={C.textMuted} style={{ marginRight: 12 }} />
    </div>
  );
}

function LeaveRow({ name, type, typeIcon: TypeIcon, days, date, status, C }) {
  const sc = { "معتمد": { bg: C.greenBadge, text: C.green }, "مرفوض": { bg: C.redBadge, text: C.red }, "بانتظار": { bg: C.orangeBadge, text: C.orange } }[status] || { bg: C.orangeBadge, text: C.orange };
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 12 }}>
        <TypeIcon size={15} color={C.purple} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{type} — {days} أيام — {date}</div>
      </div>
      <div style={{ padding: "2px 9px", borderRadius: 5, fontSize: 10, fontWeight: 500, background: sc.bg, color: sc.text }}>{status}</div>
    </div>
  );
}

export default function CVisionDashboard() {
  const [mode, setMode] = useState("dark");
  const [activeNav, setActiveNav] = useState("dashboard");
  const C = themes[mode];
  const isDark = mode === "dark";

  const navItems = [
    { id: "dashboard", icon: LayoutDashboard, label: "لوحة التحكم", en: "Dashboard" },
    { id: "employees", icon: Users, label: "الموظفون", en: "Employees" },
    { id: "recruitment", icon: Target, label: "التوظيف", en: "Recruitment" },
    { id: "payroll", icon: Wallet, label: "الرواتب", en: "Payroll" },
    { id: "leaves", icon: Palmtree, label: "الإجازات", en: "Leaves" },
    { id: "attendance", icon: Clock, label: "الحضور", en: "Attendance" },
    { id: "performance", icon: TrendingUp, label: "الأداء", en: "Performance" },
    { id: "settings", icon: Settings, label: "الإعدادات", en: "Settings" },
  ];

  const employees = [
    { name: "Ahmed Al-Otaibi", nameAr: "أحمد العتيبي", dept: "تقنية المعلومات", role: "مطور أول", status: "نشط", initials: "أح" },
    { name: "Noura Al-Qahtani", nameAr: "نورة القحطاني", dept: "الموارد البشرية", role: "أخصائية", status: "نشط", initials: "نو" },
    { name: "Khalid Al-Ghamdi", nameAr: "خالد الغامدي", dept: "المالية", role: "محاسب", status: "تحت التجربة", initials: "خا" },
    { name: "Sarah Al-Dosari", nameAr: "سارة الدوسري", dept: "التمريض", role: "ممرضة", status: "إجازة", initials: "سا" },
    { name: "Faisal Al-Malki", nameAr: "فيصل المالكي", dept: "العمليات", role: "مشرف", status: "نشط", initials: "في" },
    { name: "Reem Al-Anazi", nameAr: "ريم العنزي", dept: "الاستقبال", role: "موظفة", status: "نشط", initials: "ري" },
  ];

  const leaves = [
    { name: "عمر الزهراني", type: "سنوية", typeIcon: Palmtree, days: "5", date: "15-20 مارس", status: "بانتظار" },
    { name: "ريم العنزي", type: "مرضية", typeIcon: HeartPulse, days: "2", date: "10-11 مارس", status: "معتمد" },
    { name: "ياسر السبيعي", type: "سنوية", typeIcon: Palmtree, days: "10", date: "1-10 أبريل", status: "بانتظار" },
    { name: "هند المطيري", type: "زواج", typeIcon: GraduationCap, days: "5", date: "20-24 مارس", status: "معتمد" },
    { name: "بندر البلوي", type: "سنوية", typeIcon: Palmtree, days: "3", date: "25-27 مارس", status: "مرفوض" },
  ];

  const departments = [
    { name: "التمريض", en: "Nursing", count: 68, max: 80, color: C.gold },
    { name: "الطب", en: "Medical", count: 45, max: 80, color: C.purple },
    { name: "الإدارة", en: "Admin", count: 35, max: 80, color: C.blue },
    { name: "تقنية المعلومات", en: "IT", count: 28, max: 80, color: C.green },
    { name: "المالية", en: "Finance", count: 22, max: 80, color: C.orange },
  ];

  const payrollItems = [
    { label: "الراتب الأساسي", en: "Basic", amount: "1,235,000" },
    { label: "بدل سكن", en: "Housing", amount: "308,750" },
    { label: "بدل نقل", en: "Transport", amount: "123,500" },
    { label: "GOSI", en: "Employer", amount: "147,800" },
    { label: "خصومات", en: "Deductions", amount: "-32,450", negative: true },
  ];

  const pipeline = [
    { stage: "تقديم", en: "Applied", count: 45, color: C.textSecondary, pct: 100 },
    { stage: "فرز", en: "Screened", count: 28, color: C.blue, pct: 62 },
    { stage: "مقابلة", en: "Interview", count: 12, color: C.purple, pct: 27 },
    { stage: "عرض", en: "Offered", count: 5, color: C.gold, pct: 11 },
    { stage: "تعيين", en: "Hired", count: 3, color: C.green, pct: 7 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Outfit', 'Noto Sans Arabic', -apple-system, sans-serif", display: "flex", transition: "background 0.4s, color 0.4s" }}>

      {isDark && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", top: -150, right: -150, width: 500, height: 500, background: `radial-gradient(circle, rgba(201,169,98,0.04) 0%, transparent 65%)` }} />
          <div style={{ position: "absolute", bottom: -200, left: 50, width: 400, height: 400, background: `radial-gradient(circle, rgba(124,92,191,0.03) 0%, transparent 65%)` }} />
        </div>
      )}

      {/* Sidebar */}
      <div style={{
        width: 230, padding: "20px 14px", borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", background: C.bgSidebar,
        boxShadow: isDark ? "none" : "2px 0 12px rgba(0,0,0,0.03)",
        position: "relative", zIndex: 10, transition: "all 0.4s",
      }}>
        <div style={{ padding: "4px 6px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${isDark ? C.gold : C.goldLight}, ${C.purple})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isDark ? "none" : `0 2px 8px ${C.gold}30`,
            }}>
              <Briefcase size={17} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: 1.5, transition: "color 0.4s" }}>CVISION</div>
              <div style={{ fontSize: 8, color: C.textMuted, letterSpacing: 2.5, textTransform: "uppercase" }}>HR Management</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, flex: 1 }}>
          {navItems.map((item) => (
            <NavItem key={item.id} item={item} active={activeNav === item.id} C={C} isDark={isDark} onClick={() => setActiveNav(item.id)} />
          ))}
        </div>

        <div onClick={() => setMode(isDark ? "light" : "dark")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px", borderRadius: 10, marginBottom: 10,
            background: C.bgSubtle, border: `1px solid ${C.border}`, cursor: "pointer", transition: "all 0.3s",
          }}>
          {isDark ? <Sun size={15} color={C.gold} /> : <Moon size={15} color={C.purple} />}
          <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500 }}>{isDark ? "الوضع النهاري" : "الوضع الليلي"}</span>
        </div>

        <div style={{
          padding: "12px 10px", borderRadius: 10, background: isDark ? C.bgCard : C.bgSubtle,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, transition: "all 0.4s",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.gold}50, ${C.purple}50)`,
            border: `1px solid ${isDark ? C.gold + "30" : C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: C.gold,
          }}>سع</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>سعود الرشيدي</div>
            <div style={{ fontSize: 9, color: C.textMuted }}>مدير الموارد البشرية</div>
          </div>
          <ChevronLeft size={14} color={C.textMuted} />
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto", position: "relative", zIndex: 10, transition: "all 0.4s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3, transition: "color 0.4s" }}>مرحباً، <span style={{ color: C.gold }}>سعود</span></div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>ملخص الموارد البشرية — مارس 2026</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: C.bgCard, border: `1px solid ${C.border}`, cursor: "pointer" }}>
              <Search size={16} color={C.textMuted} strokeWidth={1.8} />
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: C.bgCard, border: `1px solid ${C.border}`, cursor: "pointer", position: "relative" }}>
              <Bell size={16} color={C.textMuted} strokeWidth={1.8} />
              <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.red, border: `2px solid ${C.notifBorder}` }} />
            </div>
            <div style={{ padding: "0 14px", height: 38, borderRadius: 10, display: "flex", alignItems: "center", gap: 6, background: C.bgCard, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12, color: C.textSecondary }}>
              <Download size={14} strokeWidth={1.8} /> تصدير
            </div>
            <div style={{ padding: "0 14px", height: 38, borderRadius: 10, display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(135deg, ${isDark ? C.gold : C.goldLight}, ${C.purple})`, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff", boxShadow: isDark ? "none" : `0 2px 10px ${C.gold}30` }}>
              <Plus size={14} strokeWidth={2.5} /> موظف جديد
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Employees" labelAr="إجمالي الموظفين" value="247" change="+12" icon={Users} color={C.gold} colorDim={C.goldDim} C={C} />
          <StatCard label="Active" labelAr="نشط" value="228" change="+8" icon={UserCheck} color={C.green} colorDim={C.greenDim} C={C} />
          <StatCard label="On Leave" labelAr="في إجازة" value="14" change="-3" icon={Palmtree} color={C.blue} colorDim={C.blueDim} C={C} />
          <StatCard label="Open Roles" labelAr="وظائف شاغرة" value="5" change="+2" icon={Target} color={C.orange} colorDim={C.orangeDim} C={C} />
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 2, borderRadius: 14, overflow: "hidden", background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: C.shadow, transition: "all 0.4s" }}>
            <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: C.headerBg }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>الموظفون</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Recent Employees</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, background: C.bgCard, border: `1px solid ${C.border}`, color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <Filter size={11} strokeWidth={1.8} /> فلترة
                </div>
                <div style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, background: C.goldDim, color: C.gold, cursor: "pointer", fontWeight: 500 }}>عرض الكل</div>
              </div>
            </div>
            {employees.map((e, i) => <EmployeeRow key={i} {...e} C={C} isDark={isDark} />)}
          </div>

          <div style={{ flex: 1, borderRadius: 14, overflow: "hidden", background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: C.shadow, transition: "all 0.4s" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.headerBg }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>طلبات الإجازات</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Leave Requests</div>
              </div>
              <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: C.orangeBadge, fontSize: 11, fontWeight: 700, color: C.orange }}>3</div>
            </div>
            {leaves.map((l, i) => <LeaveRow key={i} {...l} C={C} />)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {/* Departments */}
          <div style={{ flex: 1, padding: 18, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: C.shadow, transition: "all 0.4s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>توزيع الأقسام</div><div style={{ fontSize: 10, color: C.textMuted }}>Department Distribution</div></div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={16} color={C.gold} strokeWidth={1.8} /></div>
            </div>
            {departments.map((d, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.textSecondary }}>{d.name} <span style={{ color: C.textMuted, fontSize: 10 }}>{d.en}</span></span>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{d.count}</span>
                </div>
                <div style={{ width: "100%", height: 5, borderRadius: 3, background: C.barTrack }}>
                  <div style={{ width: `${(d.count / d.max) * 100}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${d.color}, ${d.color}${C.barAlpha})` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Payroll */}
          <div style={{ flex: 1, padding: 18, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: C.shadow, transition: "all 0.4s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>ملخص الرواتب</div><div style={{ fontSize: 10, color: C.textMuted }}>Payroll — March 2026</div></div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center" }}><CreditCard size={16} color={C.gold} strokeWidth={1.8} /></div>
            </div>
            <div style={{ textAlign: "center", padding: "16px 4px 14px", marginBottom: 12, borderRadius: 10, background: C.barTrack, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>Total Payroll</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.gold, marginTop: 4 }}>1,847,500</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>ريال سعودي</div>
            </div>
            {payrollItems.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>{item.label} <span style={{ color: C.textMuted, fontSize: 9 }}>{item.en}</span></span>
                <span style={{ fontSize: 12, fontWeight: 600, color: item.negative ? C.red : C.text }}>{item.amount}</span>
              </div>
            ))}
          </div>

          {/* Recruitment */}
          <div style={{ flex: 1, padding: 18, borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: C.shadow, transition: "all 0.4s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>خط التوظيف</div><div style={{ fontSize: 10, color: C.textMuted }}>Recruitment Pipeline</div></div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center" }}><UserPlus size={16} color={C.purple} strokeWidth={1.8} /></div>
            </div>
            {pipeline.map((s, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.textSecondary }}>{s.stage} <span style={{ color: C.textMuted, fontSize: 10 }}>{s.en}</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: C.barTrack }}>
                  <div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${s.color}, ${s.color}${isDark ? "40" : "60"})` }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, background: C.goldDim, border: `1px solid ${C.gold}20`, display: "flex", alignItems: "center", gap: 8 }}>
              <Target size={15} color={C.gold} strokeWidth={1.8} />
              <div>
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>5 وظائف شاغرة</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Need attention</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
