import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type ItemCategory = 'MAIN' | 'SIDE' | 'DRINK' | 'DESSERT';
export type PaymentMethod = 'FREE' | 'SALARY_DEDUCTION' | 'CASH' | 'POINTS';
export type BookingStatus = 'BOOKED' | 'SERVED' | 'CANCELLED' | 'NO_SHOW';

const MEALS_COLL = 'cvision_meals';
const BOOKINGS_COLL = 'cvision_meal_bookings';

export const MEAL_POLICY = {
  companyProvided: { BREAKFAST: true, LUNCH: true, DINNER: false, SNACK: false },
  maxMealsPerDay: 2,
  bookingDeadline: '09:00 AM',
  noShowPenalty: 3,
  dietaryOptions: ['REGULAR', 'VEGETARIAN', 'HALAL', 'DIABETIC'],
} as const;

/* ── Seed Data ─────────────────────────────────────────────────────── */

function generateWeekMenu() {
  const baseDate = new Date();
  const days: any[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      meals: [
        {
          type: 'BREAKFAST', availableFrom: '07:00', availableUntil: '09:00',
          items: [
            { name: 'Ful Medames', nameAr: 'فول مدمس', category: 'MAIN', calories: 350, allergens: [], vegetarian: true, price: 0 },
            { name: 'Shakshuka', nameAr: 'شكشوكة', category: 'MAIN', calories: 280, allergens: ['EGG'], vegetarian: true, price: 0 },
            { name: 'Arabic Bread', nameAr: 'خبز عربي', category: 'SIDE', calories: 120, allergens: ['GLUTEN'], vegetarian: true, price: 0 },
            { name: 'Arabic Coffee', nameAr: 'قهوة عربية', category: 'DRINK', calories: 5, allergens: [], vegetarian: true, price: 0 },
            { name: 'Fresh Juice', nameAr: 'عصير طازج', category: 'DRINK', calories: 100, allergens: [], vegetarian: true, price: 0 },
          ],
        },
        {
          type: 'LUNCH', availableFrom: '12:00', availableUntil: '14:00',
          items: [
            { name: 'Kabsa', nameAr: 'كبسة', category: 'MAIN', calories: 650, allergens: [], vegetarian: false, price: 0 },
            { name: 'Grilled Chicken', nameAr: 'دجاج مشوي', category: 'MAIN', calories: 450, allergens: [], vegetarian: false, price: 0 },
            { name: 'Vegetable Stew', nameAr: 'يخنة خضار', category: 'MAIN', calories: 300, allergens: [], vegetarian: true, price: 0 },
            { name: 'Fattoush', nameAr: 'فتوش', category: 'SIDE', calories: 150, allergens: ['GLUTEN'], vegetarian: true, price: 0 },
            { name: 'Rice', nameAr: 'أرز', category: 'SIDE', calories: 200, allergens: [], vegetarian: true, price: 0 },
            { name: 'Kunafa', nameAr: 'كنافة', category: 'DESSERT', calories: 400, allergens: ['DAIRY','GLUTEN'], vegetarian: true, price: 0 },
          ],
        },
        {
          type: 'DINNER', availableFrom: '18:00', availableUntil: '20:00',
          items: [
            { name: 'Mandi', nameAr: 'مندي', category: 'MAIN', calories: 600, allergens: [], vegetarian: false, price: 20 },
            { name: 'Salad Bowl', nameAr: 'طبق سلطة', category: 'MAIN', calories: 250, allergens: [], vegetarian: true, price: 15 },
            { name: 'Lentil Soup', nameAr: 'شوربة عدس', category: 'SIDE', calories: 180, allergens: [], vegetarian: true, price: 10 },
            { name: 'Tea', nameAr: 'شاي', category: 'DRINK', calories: 0, allergens: [], vegetarian: true, price: 5 },
          ],
        },
      ],
    });
  }
  return days;
}

const SEED_BOOKINGS = [
  { employeeId: 'EMP-001', employeeName: 'Ahmed Hassan', mealType: 'LUNCH', items: ['Kabsa','Rice','Fattoush'], totalCost: 0, paymentMethod: 'FREE', status: 'SERVED' },
  { employeeId: 'EMP-005', employeeName: 'Fatima Al-Zahrani', mealType: 'BREAKFAST', items: ['Shakshuka','Arabic Bread','Fresh Juice'], totalCost: 0, paymentMethod: 'FREE', status: 'SERVED' },
  { employeeId: 'EMP-010', employeeName: 'Sara Al-Dosari', mealType: 'LUNCH', items: ['Vegetable Stew','Rice'], totalCost: 0, paymentMethod: 'FREE', status: 'BOOKED' },
  { employeeId: 'EMP-020', employeeName: 'Omar Al-Sheikh', mealType: 'DINNER', items: ['Mandi'], totalCost: 20, paymentMethod: 'SALARY_DEDUCTION', status: 'BOOKED' },
];

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(MEALS_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;
  const now = new Date();
  await coll.insertOne({ tenantId, menu: generateWeekMenu(), updatedAt: now });
  const today = new Date().toISOString().split('T')[0];
  await db.collection(BOOKINGS_COLL).insertMany(
    SEED_BOOKINGS.map(b => ({ ...b, tenantId, date: today, createdAt: now })),
  );
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function getMenuToday(db: Db, tenantId: string) {
  const plan = await db.collection(MEALS_COLL).findOne({ tenantId });
  if (!plan) return null;
  const today = new Date().toISOString().split('T')[0];
  return plan.menu?.find((d: any) => d.date === today) || plan.menu?.[0] || null;
}

export async function getMenuWeek(db: Db, tenantId: string) {
  const plan = await db.collection(MEALS_COLL).findOne({ tenantId });
  return plan?.menu || [];
}

export async function getMyBookings(db: Db, tenantId: string, employeeId: string) {
  return db.collection(BOOKINGS_COLL).find({ tenantId, employeeId }).sort({ date: -1 }).limit(30).toArray();
}

export async function getBookingCount(db: Db, tenantId: string, date: string) {
  return db.collection(BOOKINGS_COLL).aggregate([
    { $match: { tenantId, date, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$mealType', count: { $sum: 1 } } },
  ]).toArray();
}

export async function getMealReport(db: Db, tenantId: string, startDate: string, endDate: string) {
  const bookings = await db.collection(BOOKINGS_COLL).find({
    tenantId, date: { $gte: startDate, $lte: endDate },
  }).toArray();
  const totalMeals = bookings.length;
  const served = bookings.filter(b => b.status === 'SERVED').length;
  const noShows = bookings.filter(b => b.status === 'NO_SHOW').length;
  const totalCost = bookings.reduce((s, b) => s + (b.totalCost || 0), 0);
  return { totalMeals, served, noShows, cancelled: bookings.filter(b => b.status === 'CANCELLED').length, totalCost };
}

export async function getCostReport(db: Db, tenantId: string, month: string) {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const bookings = await db.collection(BOOKINGS_COLL).find({
    tenantId, date: { $gte: start, $lte: end }, status: { $in: ['BOOKED', 'SERVED'] },
  }).toArray();
  const byMethod: any = { FREE: 0, SALARY_DEDUCTION: 0, CASH: 0, POINTS: 0 };
  for (const b of bookings) byMethod[b.paymentMethod] = (byMethod[b.paymentMethod] || 0) + (b.totalCost || 0);
  return { month, totalBookings: bookings.length, costBreakdown: byMethod, totalCost: bookings.reduce((s, b) => s + (b.totalCost || 0), 0) };
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function bookMeal(db: Db, tenantId: string, data: any) {
  const isFree = MEAL_POLICY.companyProvided[data.mealType as keyof typeof MEAL_POLICY.companyProvided] || false;
  await db.collection(BOOKINGS_COLL).insertOne({
    ...data, tenantId,
    totalCost: isFree ? 0 : (data.totalCost || 0),
    paymentMethod: isFree ? 'FREE' : (data.paymentMethod || 'SALARY_DEDUCTION'),
    status: 'BOOKED', createdAt: new Date(),
  });
}

export async function cancelBooking(db: Db, tenantId: string, bookingId: string) {
  const { ObjectId } = await import('mongodb');
  await db.collection(BOOKINGS_COLL).updateOne(
    { _id: new ObjectId(bookingId), tenantId },
    { $set: { status: 'CANCELLED' } },
  );
}

export async function markServed(db: Db, tenantId: string, bookingId: string) {
  const { ObjectId } = await import('mongodb');
  await db.collection(BOOKINGS_COLL).updateOne(
    { _id: new ObjectId(bookingId), tenantId },
    { $set: { status: 'SERVED' } },
  );
}

export async function updateMenu(db: Db, tenantId: string, menu: any[]) {
  await db.collection(MEALS_COLL).updateOne(
    { tenantId },
    { $set: { menu, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function setDietaryPreference(db: Db, tenantId: string, employeeId: string, preference: string) {
  await db.collection('cvision_meal_preferences').updateOne(
    { tenantId, employeeId },
    { $set: { preference, updatedAt: new Date() } },
    { upsert: true },
  );
}
