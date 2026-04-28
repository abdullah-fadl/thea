'use client';

import useSWR from 'swr';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function AdminDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { data } = useSWR('/api/admin/dashboard/stats', fetcher);

  const stats = data?.stats || {};
  const visitsTrend = data?.visitsTrend || [];
  const revenueByDept = data?.revenueByDept || [];
  const topDiagnoses = data?.topDiagnoses || [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">{tr('لوحة تحكم الإدارة', 'Administration Dashboard')}</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-blue-600">{stats.todayVisits || 0}</div>
            <div className="text-muted-foreground">{tr('زيارات اليوم', "Today's Visits")}</div>
            <div className={`text-sm mt-1 ${stats.visitsChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.visitsChange >= 0 ? '↑' : '↓'} {Math.abs(stats.visitsChange || 0)}% {tr('عن الأمس', 'vs yesterday')}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-emerald-600">
              {(stats.todayRevenue || 0).toLocaleString()} <span className="text-lg">{tr('ر.س', 'SAR')}</span>
            </div>
            <div className="text-muted-foreground">{tr('إيرادات اليوم', "Today's Revenue")}</div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-amber-600">{stats.waitingPatients || 0}</div>
            <div className="text-muted-foreground">{tr('في الانتظار', 'Waiting')}</div>
            <div className="text-sm text-muted-foreground">{tr('متوسط الانتظار:', 'Avg wait:')} {stats.avgWaitTime || 0} {tr('دقيقة', 'min')}</div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="text-3xl font-bold text-purple-600">{stats.occupancyRate || 0}%</div>
            <div className="text-muted-foreground">{tr('نسبة الإشغال', 'Occupancy Rate')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-4">{tr('الزيارات - آخر 7 أيام', 'Visits - Last 7 Days')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={visitsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-4">{tr('الإيرادات حسب القسم', 'Revenue by Department')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={revenueByDept}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {revenueByDept.map((entry: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-4">{tr('أكثر التشخيصات شيوعاً', 'Most Common Diagnoses')}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topDiagnoses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-bold text-foreground mb-4">{tr('إحصائيات سريعة', 'Quick Statistics')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded-xl">
                <span>{tr('المرضى الجدد اليوم', 'New Patients Today')}</span>
                <span className="font-bold">{stats.newPatients || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded-xl">
                <span>{tr('الفحوصات المختبرية', 'Lab Tests')}</span>
                <span className="font-bold">{stats.labTests || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded-xl">
                <span>{tr('فحوصات الأشعة', 'Radiology Exams')}</span>
                <span className="font-bold">{stats.radExams || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded-xl">
                <span>{tr('الوصفات الطبية', 'Prescriptions')}</span>
                <span className="font-bold">{stats.prescriptions || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-muted/50 rounded-xl">
                <span>{tr('نسبة الحضور', 'Attendance Rate')}</span>
                <span className="font-bold">{stats.attendanceRate || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
