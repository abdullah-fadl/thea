'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Utensils, Plus, X, Clock, CheckCircle, XCircle, AlertTriangle,
  Truck, Coffee, UtensilsCrossed, Salad, Pause, Edit2, Ban,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DietaryOrder {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId: string | null;
  episodeId: string | null;
  dietType: string;
  specialInstructions: string | null;
  allergies: string | null;
  texture: string | null;
  fluidRestriction: number | null;
  calorieTarget: number | null;
  proteinTarget: number | null;
  status: string;
  startDate: string;
  endDate: string | null;
  orderedBy: string;
  orderedByName: string | null;
  notes: string | null;
  createdAt: string;
}

interface MealServiceItem {
  id: string;
  tenantId: string;
  dietaryOrderId: string;
  patientId: string;
  mealType: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: string;
  deliveredAt: string | null;
  deliveredBy: string | null;
  intakePercent: number | null;
  refusalReason: string | null;
  menuItems: unknown;
  notes: string | null;
}

interface OrdersKPIs {
  total: number;
  active: number;
  npo: number;
  restricted: number;
}

interface MealStats {
  total: number;
  pending: number;
  prepared: number;
  delivered: number;
  refused: number;
  avgIntake: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DIET_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  REGULAR:      { ar: 'عادي',                en: 'Regular' },
  SOFT:         { ar: 'لين',                 en: 'Soft' },
  LIQUID:       { ar: 'سائل',                en: 'Liquid' },
  CLEAR_LIQUID: { ar: 'سائل صافي',           en: 'Clear Liquid' },
  NPO:          { ar: 'صيام عن الطعام',      en: 'NPO' },
  DIABETIC:     { ar: 'سكري',                en: 'Diabetic' },
  RENAL:        { ar: 'كلوي',                en: 'Renal' },
  CARDIAC:      { ar: 'قلبي',                en: 'Cardiac' },
  LOW_SODIUM:   { ar: 'قليل الملح',          en: 'Low Sodium' },
  HIGH_PROTEIN: { ar: 'عالي البروتين',       en: 'High Protein' },
  GLUTEN_FREE:  { ar: 'خالي من الغلوتين',    en: 'Gluten Free' },
  TUBE_FEEDING: { ar: 'تغذية أنبوبية',       en: 'Tube Feeding' },
  PARENTERAL:   { ar: 'تغذية وريدية',        en: 'Parenteral' },
};

const TEXTURE_LABELS: Record<string, { ar: string; en: string }> = {
  REGULAR:          { ar: 'عادي',        en: 'Regular' },
  MINCED:           { ar: 'مفروم',       en: 'Minced' },
  PUREED:           { ar: 'مهروس',       en: 'Pureed' },
  THICKENED_LIQUID: { ar: 'سائل مكثف',   en: 'Thickened Liquid' },
};

const MEAL_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  BREAKFAST: { ar: 'فطور',              en: 'Breakfast' },
  SNACK_AM:  { ar: 'وجبة خفيفة صباحية', en: 'AM Snack' },
  LUNCH:     { ar: 'غداء',              en: 'Lunch' },
  SNACK_PM:  { ar: 'وجبة خفيفة مسائية', en: 'PM Snack' },
  DINNER:    { ar: 'عشاء',              en: 'Dinner' },
  SNACK_HS:  { ar: 'وجبة قبل النوم',    en: 'Bedtime Snack' },
};

const MEAL_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending:   { ar: 'قيد الانتظار', en: 'Pending' },
  prepared:  { ar: 'تم التحضير',   en: 'Prepared' },
  delivered: { ar: 'تم التوصيل',   en: 'Delivered' },
  consumed:  { ar: 'تم التناول',   en: 'Consumed' },
  refused:   { ar: 'مرفوض',        en: 'Refused' },
  returned:  { ar: 'تم الإرجاع',   en: 'Returned' },
};

const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  active:    { ar: 'نشط',      en: 'Active' },
  completed: { ar: 'مكتمل',    en: 'Completed' },
  cancelled: { ar: 'ملغي',     en: 'Cancelled' },
  on_hold:   { ar: 'معلق',     en: 'On Hold' },
};

const DIET_TYPES = Object.keys(DIET_TYPE_LABELS);
const TEXTURES = Object.keys(TEXTURE_LABELS);
const MEAL_TYPES_ORDER = ['BREAKFAST', 'SNACK_AM', 'LUNCH', 'SNACK_PM', 'DINNER', 'SNACK_HS'];

function getMealStatusColor(status: string): string {
  switch (status) {
    case 'pending':   return 'bg-yellow-100 text-yellow-800';
    case 'prepared':  return 'bg-blue-100 text-blue-800';
    case 'delivered': return 'bg-green-100 text-green-800';
    case 'consumed':  return 'bg-emerald-100 text-emerald-800';
    case 'refused':   return 'bg-red-100 text-red-800';
    case 'returned':  return 'bg-muted text-foreground';
    default:          return 'bg-muted text-muted-foreground';
  }
}

function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'active':    return 'bg-green-100 text-green-800';
    case 'completed': return 'bg-blue-100 text-blue-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'on_hold':   return 'bg-amber-100 text-amber-800';
    default:          return 'bg-muted text-muted-foreground';
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(r => r.json());

// ─── Component ──────────────────────────────────────────────────────────────────

export default function DietaryOrdersDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [activeTab, setActiveTab] = useState<'orders' | 'meals' | 'intake'>('orders');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  // ─── Data Fetching ──────────────────────────────────────────

  const {
    data: ordersData,
    isLoading: ordersLoading,
    mutate: mutateOrders,
  } = useSWR<{ orders: DietaryOrder[]; kpis: OrdersKPIs }>(
    '/api/nutrition/dietary-orders',
    fetcher
  );

  const {
    data: mealsData,
    isLoading: mealsLoading,
    mutate: mutateMeals,
  } = useSWR<{ meals: MealServiceItem[]; stats: MealStats }>(
    `/api/nutrition/meal-service?date=${selectedDate}`,
    fetcher
  );

  const orders = ordersData?.orders ?? [];
  const kpis = ordersData?.kpis ?? { total: 0, active: 0, npo: 0, restricted: 0 };
  const meals = mealsData?.meals ?? [];
  const mealStats = mealsData?.stats ?? { total: 0, pending: 0, prepared: 0, delivered: 0, refused: 0, avgIntake: 0 };

  // ─── Order Actions ──────────────────────────────────────────

  const cancelOrder = useCallback(async (id: string) => {
    await fetch('/api/nutrition/dietary-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status: 'cancelled' }),
    });
    mutateOrders();
  }, [mutateOrders]);

  const holdOrder = useCallback(async (id: string) => {
    await fetch('/api/nutrition/dietary-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status: 'on_hold' }),
    });
    mutateOrders();
  }, [mutateOrders]);

  const activateOrder = useCallback(async (id: string) => {
    await fetch('/api/nutrition/dietary-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status: 'active' }),
    });
    mutateOrders();
  }, [mutateOrders]);

  // ─── Meal Actions ───────────────────────────────────────────

  const updateMealStatus = useCallback(async (id: string, status: string) => {
    await fetch('/api/nutrition/meal-service', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, status }),
    });
    mutateMeals();
  }, [mutateMeals]);

  const recordIntake = useCallback(async (mealServiceId: string, intakePercent: number, refusalReason?: string) => {
    await fetch('/api/nutrition/meal-service/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ mealServiceId, intakePercent, refusalReason: refusalReason ?? null }),
    });
    mutateMeals();
  }, [mutateMeals]);

  // ─── Generate Meals ─────────────────────────────────────────

  const generateMealsForOrder = useCallback(async (order: DietaryOrder) => {
    if (order.dietType === 'NPO') return;
    const mealsToCreate = ['BREAKFAST', 'LUNCH', 'DINNER'];
    await fetch('/api/nutrition/meal-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        dietaryOrderId: order.id,
        patientId: order.patientId,
        scheduledDate: selectedDate,
        meals: mealsToCreate,
      }),
    });
    mutateMeals();
  }, [mutateMeals, selectedDate]);

  // ─── Loading ────────────────────────────────────────────────

  if (ordersLoading && mealsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-8" dir={dir}>
        <Utensils className="w-4 h-4 animate-pulse text-orange-500" />
        {tr('جارٍ تحميل بيانات التغذية...', 'Loading nutrition data...')}
      </div>
    );
  }

  // ─── Tabs ───────────────────────────────────────────────────

  const tabs: { key: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { key: 'orders', label: tr('أوامر الحمية', 'Diet Orders'), icon: <UtensilsCrossed className="w-4 h-4" /> },
    { key: 'meals',  label: tr('وجبات اليوم', "Today's Meals"), icon: <Coffee className="w-4 h-4" /> },
    { key: 'intake', label: tr('متابعة التناول', 'Intake Tracking'), icon: <Salad className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6" dir={dir}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Utensils className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tr('إدارة الحمية والوجبات', 'Dietary & Meal Management')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr('أوامر الحمية وخدمة الوجبات للمرضى المنومين', 'Diet orders and meal service for inpatients')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewOrder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {tr('أمر حمية جديد', 'New Diet Order')}
        </button>
      </div>

      {/* ── KPI Stats Row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={tr('أوامر نشطة', 'Active Orders')}
          value={kpis.active}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          color="green"
        />
        <StatCard
          label={tr('وجبات قيد الانتظار', 'Meals Pending')}
          value={mealStats.pending}
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
          color="yellow"
        />
        <StatCard
          label={tr('وجبات تم توصيلها اليوم', 'Meals Delivered Today')}
          value={mealStats.delivered}
          icon={<Truck className="w-5 h-5 text-blue-600" />}
          color="blue"
        />
        <StatCard
          label={tr('متوسط التناول %', 'Avg Intake %')}
          value={`${mealStats.avgIntake}%`}
          icon={<Salad className="w-5 h-5 text-emerald-600" />}
          color="emerald"
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="border-b border-border">
        <nav className="flex gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab Content ────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <OrdersTab
          orders={orders}
          language={language}
          tr={tr}
          dir={dir}
          onCancel={cancelOrder}
          onHold={holdOrder}
          onActivate={activateOrder}
          onEdit={setEditingOrderId}
          onGenerateMeals={generateMealsForOrder}
        />
      )}

      {activeTab === 'meals' && (
        <MealsTab
          meals={meals}
          language={language}
          tr={tr}
          dir={dir}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onUpdateStatus={updateMealStatus}
        />
      )}

      {activeTab === 'intake' && (
        <IntakeTab
          meals={meals}
          language={language}
          tr={tr}
          dir={dir}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          onRecordIntake={recordIntake}
        />
      )}

      {/* ── New Order Dialog ───────────────────────────────── */}
      {showNewOrder && (
        <NewOrderDialog
          language={language}
          tr={tr}
          dir={dir}
          onClose={() => setShowNewOrder(false)}
          onSuccess={() => { setShowNewOrder(false); mutateOrders(); }}
        />
      )}

      {/* ── Edit Order Dialog ──────────────────────────────── */}
      {editingOrderId && (
        <EditOrderDialog
          orderId={editingOrderId}
          order={orders.find(o => o.id === editingOrderId) ?? null}
          language={language}
          tr={tr}
          dir={dir}
          onClose={() => setEditingOrderId(null)}
          onSuccess={() => { setEditingOrderId(null); mutateOrders(); }}
        />
      )}
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-4 flex items-center gap-3`}>
      <div className={`p-2 bg-${color}-50 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Orders Tab ─────────────────────────────────────────────────────────────────

function OrdersTab({ orders, language, tr, dir, onCancel, onHold, onActivate, onEdit, onGenerateMeals }: {
  orders: DietaryOrder[];
  language: string;
  tr: (ar: string, en: string) => string;
  dir: string;
  onCancel: (id: string) => void;
  onHold: (id: string) => void;
  onActivate: (id: string) => void;
  onEdit: (id: string) => void;
  onGenerateMeals: (order: DietaryOrder) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" dir={dir}>
        <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{tr('لا توجد أوامر حمية', 'No diet orders found')}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" dir={dir}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('المريض', 'Patient')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('نوع الحمية', 'Diet Type')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('القوام', 'Texture')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('قيود', 'Restrictions')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('تاريخ البدء', 'Start Date')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('الحالة', 'Status')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                {tr('إجراءات', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map(order => {
              const dtLabel = DIET_TYPE_LABELS[order.dietType];
              const txLabel = order.texture ? TEXTURE_LABELS[order.texture] : null;
              const stLabel = ORDER_STATUS_LABELS[order.status];

              const restrictions: string[] = [];
              if (order.fluidRestriction) restrictions.push(`${tr('سوائل', 'Fluid')}: ${order.fluidRestriction}${tr(' مل/يوم', ' mL/d')}`);
              if (order.calorieTarget) restrictions.push(`${tr('سعرات', 'Cal')}: ${order.calorieTarget}`);
              if (order.proteinTarget) restrictions.push(`${tr('بروتين', 'Protein')}: ${order.proteinTarget}g`);
              if (order.allergies) restrictions.push(`${tr('حساسية', 'Allergy')}: ${order.allergies}`);

              return (
                <tr key={order.id} className="hover:bg-muted/50 transition">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{order.patientId.slice(0, 8)}...</span>
                    {order.orderedByName && (
                      <span className="block text-xs text-muted-foreground">{tr('بواسطة', 'by')} {order.orderedByName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-xs font-medium">
                      {dtLabel ? (language === 'ar' ? dtLabel.ar : dtLabel.en) : order.dietType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {txLabel ? (language === 'ar' ? txLabel.ar : txLabel.en) : tr('عادي', 'Regular')}
                  </td>
                  <td className="px-4 py-3">
                    {restrictions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {restrictions.map((r, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-xs">
                            {r}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">{tr('لا يوجد', 'None')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(order.startDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                      {stLabel ? (language === 'ar' ? stLabel.ar : stLabel.en) : order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {order.status === 'active' && (
                        <>
                          <button
                            onClick={() => onEdit(order.id)}
                            title={tr('تعديل', 'Edit')}
                            className="p-1 text-muted-foreground hover:text-blue-600 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onGenerateMeals(order)}
                            title={tr('توليد وجبات اليوم', "Generate today's meals")}
                            className="p-1 text-muted-foreground hover:text-green-600 transition"
                          >
                            <Coffee className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onHold(order.id)}
                            title={tr('تعليق', 'Hold')}
                            className="p-1 text-muted-foreground hover:text-amber-600 transition"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onCancel(order.id)}
                            title={tr('إلغاء', 'Cancel')}
                            className="p-1 text-muted-foreground hover:text-red-600 transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {order.status === 'on_hold' && (
                        <button
                          onClick={() => onActivate(order.id)}
                          title={tr('تفعيل', 'Activate')}
                          className="p-1 text-muted-foreground hover:text-green-600 transition"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Meals Tab ──────────────────────────────────────────────────────────────────

function MealsTab({ meals, language, tr, dir, selectedDate, onDateChange, onUpdateStatus }: {
  meals: MealServiceItem[];
  language: string;
  tr: (ar: string, en: string) => string;
  dir: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  // Group meals by meal type in canonical order
  const grouped: Record<string, MealServiceItem[]> = {};
  for (const mt of MEAL_TYPES_ORDER) {
    const items = meals.filter(m => m.mealType === mt);
    if (items.length > 0) grouped[mt] = items;
  }

  return (
    <div className="space-y-4" dir={dir}>
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          {tr('التاريخ', 'Date')}:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        />
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Coffee className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr('لا توجد وجبات مجدولة لهذا اليوم', 'No meals scheduled for this date')}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([mealType, items]) => {
          const mtLabel = MEAL_TYPE_LABELS[mealType];
          return (
            <div key={mealType} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-2">
                <Coffee className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-foreground">
                  {mtLabel ? (language === 'ar' ? mtLabel.ar : mtLabel.en) : mealType}
                </h3>
                <span className="text-xs text-muted-foreground">({items.length} {tr('وجبة', 'meals')})</span>
              </div>
              <div className="divide-y divide-border">
                {items.map(meal => {
                  const stLabel = MEAL_STATUS_LABELS[meal.status];
                  return (
                    <div key={meal.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {meal.patientId.slice(0, 8)}...
                        </span>
                        {meal.scheduledTime && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {meal.scheduledTime}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMealStatusColor(meal.status)}`}>
                          {stLabel ? (language === 'ar' ? stLabel.ar : stLabel.en) : meal.status}
                        </span>
                        {meal.intakePercent != null && (
                          <span className="text-xs text-muted-foreground">
                            {tr('تناول', 'Intake')}: {meal.intakePercent}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {meal.status === 'pending' && (
                          <button
                            onClick={() => onUpdateStatus(meal.id, 'prepared')}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
                          >
                            {tr('تم التحضير', 'Mark Prepared')}
                          </button>
                        )}
                        {meal.status === 'prepared' && (
                          <button
                            onClick={() => onUpdateStatus(meal.id, 'delivered')}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                          >
                            {tr('تم التوصيل', 'Mark Delivered')}
                          </button>
                        )}
                        {(meal.status === 'delivered') && (
                          <>
                            <button
                              onClick={() => onUpdateStatus(meal.id, 'consumed')}
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition"
                            >
                              {tr('تم التناول', 'Consumed')}
                            </button>
                            <button
                              onClick={() => onUpdateStatus(meal.id, 'refused')}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
                            >
                              {tr('مرفوض', 'Refused')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Intake Tab ─────────────────────────────────────────────────────────────────

function IntakeTab({ meals, language, tr, dir, selectedDate, onDateChange, onRecordIntake }: {
  meals: MealServiceItem[];
  language: string;
  tr: (ar: string, en: string) => string;
  dir: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onRecordIntake: (mealServiceId: string, intakePercent: number, refusalReason?: string) => void;
}) {
  const [intakeInputs, setIntakeInputs] = useState<Record<string, number>>({});
  const [refusalInputs, setRefusalInputs] = useState<Record<string, string>>({});

  // Group by patient
  const patientMap = new Map<string, MealServiceItem[]>();
  for (const meal of meals) {
    const arr = patientMap.get(meal.patientId) || [];
    arr.push(meal);
    patientMap.set(meal.patientId, arr);
  }

  // Get per-patient intake averages
  const patientIntakes: { patientId: string; meals: MealServiceItem[]; avgIntake: number }[] = [];
  patientMap.forEach((patientMeals, patientId) => {
    const recorded = patientMeals.filter(m => m.intakePercent != null);
    const avg = recorded.length > 0
      ? Math.round(recorded.reduce((s, m) => s + (m.intakePercent ?? 0), 0) / recorded.length)
      : 0;
    patientIntakes.push({ patientId, meals: patientMeals, avgIntake: avg });
  });

  return (
    <div className="space-y-4" dir={dir}>
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          {tr('التاريخ', 'Date')}:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          className="border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        />
      </div>

      {patientIntakes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Salad className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{tr('لا توجد بيانات تناول لهذا اليوم', 'No intake data for this date')}</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                    {tr('المريض', 'Patient')}
                  </th>
                  {MEAL_TYPES_ORDER.filter(mt => mt === 'BREAKFAST' || mt === 'LUNCH' || mt === 'DINNER').map(mt => (
                    <th key={mt} className="px-4 py-3 text-center font-medium text-muted-foreground">
                      {language === 'ar' ? MEAL_TYPE_LABELS[mt].ar : MEAL_TYPE_LABELS[mt].en}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    {tr('المتوسط اليومي', 'Daily Avg')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patientIntakes.map(({ patientId, meals: patientMeals, avgIntake }) => (
                  <tr key={patientId} className="hover:bg-muted/50 transition">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {patientId.slice(0, 8)}...
                    </td>
                    {['BREAKFAST', 'LUNCH', 'DINNER'].map(mt => {
                      const meal = patientMeals.find(m => m.mealType === mt);
                      if (!meal) {
                        return (
                          <td key={mt} className="px-4 py-3 text-center text-muted-foreground text-xs">
                            {tr('غير مجدول', 'N/A')}
                          </td>
                        );
                      }
                      if (meal.intakePercent != null) {
                        const color = meal.intakePercent >= 75 ? 'text-green-700 bg-green-50'
                          : meal.intakePercent >= 50 ? 'text-amber-700 bg-amber-50'
                          : 'text-red-700 bg-red-50';
                        return (
                          <td key={mt} className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
                              {meal.intakePercent}%
                            </span>
                          </td>
                        );
                      }
                      // Editable intake
                      return (
                        <td key={mt} className="px-4 py-3 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="%"
                              value={intakeInputs[meal.id] ?? ''}
                              onChange={e => setIntakeInputs(prev => ({ ...prev, [meal.id]: Number(e.target.value) }))}
                              className="w-14 border border-border rounded px-1.5 py-1 text-xs text-center focus:ring-1 focus:ring-orange-300 outline-none"
                            />
                            <button
                              onClick={() => {
                                const val = intakeInputs[meal.id];
                                if (val != null && val >= 0 && val <= 100) {
                                  onRecordIntake(meal.id, val, refusalInputs[meal.id]);
                                }
                              }}
                              className="p-1 text-orange-600 hover:text-orange-800 transition"
                              title={tr('تسجيل', 'Record')}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {(intakeInputs[meal.id] === 0) && (
                            <input
                              type="text"
                              placeholder={tr('سبب الرفض', 'Refusal reason')}
                              value={refusalInputs[meal.id] ?? ''}
                              onChange={e => setRefusalInputs(prev => ({ ...prev, [meal.id]: e.target.value }))}
                              className="mt-1 w-full border border-border rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-orange-300 outline-none"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        avgIntake >= 75 ? 'text-green-700 bg-green-50'
                        : avgIntake >= 50 ? 'text-amber-700 bg-amber-50'
                        : avgIntake > 0 ? 'text-red-700 bg-red-50'
                        : 'text-muted-foreground'
                      }`}>
                        {avgIntake > 0 ? `${avgIntake}%` : tr('لا بيانات', 'No data')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Order Dialog ───────────────────────────────────────────────────────────

function NewOrderDialog({ language, tr, dir, onClose, onSuccess }: {
  language: string;
  tr: (ar: string, en: string) => string;
  dir: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: '',
    dietType: 'REGULAR',
    texture: '',
    fluidRestriction: '',
    calorieTarget: '',
    proteinTarget: '',
    specialInstructions: '',
    allergies: '',
    notes: '',
  });

  const handleSubmit = async () => {
    if (!form.patientId.trim()) {
      setError(tr('معرف المريض مطلوب', 'Patient ID is required'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nutrition/dietary-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patientId: form.patientId.trim(),
          dietType: form.dietType,
          texture: form.texture || null,
          fluidRestriction: form.fluidRestriction ? Number(form.fluidRestriction) : null,
          calorieTarget: form.calorieTarget ? Number(form.calorieTarget) : null,
          proteinTarget: form.proteinTarget ? Number(form.proteinTarget) : null,
          specialInstructions: form.specialInstructions || null,
          allergies: form.allergies || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tr('فشل إنشاء الأمر', 'Failed to create order'));
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError(tr('خطأ في الاتصال', 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {tr('أمر حمية جديد', 'New Diet Order')}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Patient ID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('معرف المريض', 'Patient ID')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.patientId}
              onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
              placeholder={tr('أدخل معرف المريض', 'Enter patient ID')}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
            />
          </div>

          {/* Diet Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('نوع الحمية', 'Diet Type')} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.dietType}
              onChange={e => setForm(f => ({ ...f, dietType: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-card"
            >
              {DIET_TYPES.map(dt => (
                <option key={dt} value={dt}>
                  {language === 'ar' ? DIET_TYPE_LABELS[dt].ar : DIET_TYPE_LABELS[dt].en}
                </option>
              ))}
            </select>
          </div>

          {/* Texture */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('القوام', 'Texture')}
            </label>
            <select
              value={form.texture}
              onChange={e => setForm(f => ({ ...f, texture: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-card"
            >
              <option value="">{tr('-- اختر القوام --', '-- Select Texture --')}</option>
              {TEXTURES.map(tx => (
                <option key={tx} value={tx}>
                  {language === 'ar' ? TEXTURE_LABELS[tx].ar : TEXTURE_LABELS[tx].en}
                </option>
              ))}
            </select>
          </div>

          {/* Row: Fluid / Calorie / Protein targets */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('تقييد السوائل (مل/يوم)', 'Fluid Restriction (mL/d)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.fluidRestriction}
                onChange={e => setForm(f => ({ ...f, fluidRestriction: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('هدف السعرات (kcal)', 'Calorie Target (kcal)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.calorieTarget}
                onChange={e => setForm(f => ({ ...f, calorieTarget: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('هدف البروتين (غ)', 'Protein Target (g)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.proteinTarget}
                onChange={e => setForm(f => ({ ...f, proteinTarget: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
          </div>

          {/* Food Allergies */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('حساسية الطعام', 'Food Allergies')}
            </label>
            <input
              type="text"
              value={form.allergies}
              onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
              placeholder={tr('مثال: مكسرات، حليب', 'e.g. Nuts, Dairy')}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('تعليمات خاصة', 'Special Instructions')}
            </label>
            <textarea
              value={form.specialInstructions}
              onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('ملاحظات', 'Notes')}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            {loading ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء الأمر', 'Create Order')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Order Dialog ──────────────────────────────────────────────────────────

function EditOrderDialog({ orderId, order, language, tr, dir, onClose, onSuccess }: {
  orderId: string;
  order: DietaryOrder | null;
  language: string;
  tr: (ar: string, en: string) => string;
  dir: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dietType: order?.dietType || 'REGULAR',
    texture: order?.texture || '',
    fluidRestriction: order?.fluidRestriction?.toString() || '',
    calorieTarget: order?.calorieTarget?.toString() || '',
    proteinTarget: order?.proteinTarget?.toString() || '',
    specialInstructions: order?.specialInstructions || '',
    allergies: order?.allergies || '',
    notes: order?.notes || '',
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nutrition/dietary-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: orderId,
          dietType: form.dietType,
          texture: form.texture || null,
          fluidRestriction: form.fluidRestriction ? Number(form.fluidRestriction) : null,
          calorieTarget: form.calorieTarget ? Number(form.calorieTarget) : null,
          proteinTarget: form.proteinTarget ? Number(form.proteinTarget) : null,
          specialInstructions: form.specialInstructions || null,
          allergies: form.allergies || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || tr('فشل تحديث الأمر', 'Failed to update order'));
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError(tr('خطأ في الاتصال', 'Connection error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" dir={dir}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {tr('تعديل أمر الحمية', 'Edit Diet Order')}
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Diet Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('نوع الحمية', 'Diet Type')}
            </label>
            <select
              value={form.dietType}
              onChange={e => setForm(f => ({ ...f, dietType: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-card"
            >
              {DIET_TYPES.map(dt => (
                <option key={dt} value={dt}>
                  {language === 'ar' ? DIET_TYPE_LABELS[dt].ar : DIET_TYPE_LABELS[dt].en}
                </option>
              ))}
            </select>
          </div>

          {/* Texture */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('القوام', 'Texture')}
            </label>
            <select
              value={form.texture}
              onChange={e => setForm(f => ({ ...f, texture: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none bg-card"
            >
              <option value="">{tr('-- اختر القوام --', '-- Select Texture --')}</option>
              {TEXTURES.map(tx => (
                <option key={tx} value={tx}>
                  {language === 'ar' ? TEXTURE_LABELS[tx].ar : TEXTURE_LABELS[tx].en}
                </option>
              ))}
            </select>
          </div>

          {/* Row: Fluid / Calorie / Protein targets */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('تقييد السوائل (مل/يوم)', 'Fluid Restriction (mL/d)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.fluidRestriction}
                onChange={e => setForm(f => ({ ...f, fluidRestriction: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('هدف السعرات (kcal)', 'Calorie Target (kcal)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.calorieTarget}
                onChange={e => setForm(f => ({ ...f, calorieTarget: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {tr('هدف البروتين (غ)', 'Protein Target (g)')}
              </label>
              <input
                type="number"
                min={0}
                value={form.proteinTarget}
                onChange={e => setForm(f => ({ ...f, proteinTarget: e.target.value }))}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              />
            </div>
          </div>

          {/* Food Allergies */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('حساسية الطعام', 'Food Allergies')}
            </label>
            <input
              type="text"
              value={form.allergies}
              onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('تعليمات خاصة', 'Special Instructions')}
            </label>
            <textarea
              value={form.specialInstructions}
              onChange={e => setForm(f => ({ ...f, specialInstructions: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('ملاحظات', 'Notes')}
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            {loading ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ التعديلات', 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}
