import { useState, useEffect } from 'react';
import { Users, Activity, Calendar, DollarSign, TrendingUp, ArrowUpRight, UserPlus, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const STAT_STYLES = [
  { color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100' },
  { color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100' },
  { color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-100' },
  { color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100' },
];

const STATUS_AR: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'مؤكد',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  pending:   { label: 'معلق',   color: 'text-amber-600 bg-amber-50 border-amber-100' },
  completed: { label: 'مكتمل', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  cancelled: { label: 'ملغي',  color: 'text-red-500 bg-red-50 border-red-100' },
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { title: 'إجمالي الأطباء', value: '...', change: '+2%', icon: Activity },
    { title: 'إجمالي المرضى', value: '...', change: '+5%', icon: Users },
    { title: 'إجمالي الحجوزات', value: '...', change: '+8%', icon: Calendar },
    { title: 'إيرادات النظام', value: '...', change: '+12%', icon: DollarSign },
  ]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Use SECURITY DEFINER RPC to bypass RLS for admin
      const { data: allUsers, error: usersErr } = await supabase.rpc('admin_get_all_users');
      if (usersErr) console.error('admin_get_all_users error:', usersErr.message);

      const doctorsCount = allUsers?.filter((u: any) => u.role === 'DOCTOR').length || 0;
      const patientsCount = allUsers?.filter((u: any) => u.role === 'PATIENT').length || 0;

      const { data: allBookings, error: bookingsErr } = await supabase.rpc('admin_get_all_bookings');
      if (bookingsErr) console.error('admin_get_all_bookings error:', bookingsErr.message);

      const bookingsCount = allBookings?.length || 0;
      const totalRevenue = allBookings
        ?.filter((b: any) => b.status === 'completed')
        .reduce((sum: number, b: any) => sum + (Number(b.price) || 0), 0) || 0;

      setStats([
        { title: 'إجمالي الأطباء', value: doctorsCount.toLocaleString(), change: '+2%', icon: Activity },
        { title: 'إجمالي المرضى', value: patientsCount.toLocaleString(), change: '+5%', icon: Users },
        { title: 'إجمالي الحجوزات', value: bookingsCount.toLocaleString(), change: '+8%', icon: Calendar },
        { title: 'إيرادات النظام', value: `${totalRevenue.toLocaleString()} د.ع`, change: '+12%', icon: DollarSign },
      ]);

      const recent = (allBookings || []).slice(0, 6);
      setRecentBookings(recent.map((b: any) => ({
        id: b.id,
        patient: b.patient_name || 'مريض',
        doctor: b.doctor_name || 'طبيب',
        time: b.start_time,
        status: (b.status || 'pending').toLowerCase(),
      })));
    } catch (e) { console.error(e); }
  };

  const SYSTEM_HEALTH = [
    { label: 'حمل الخادم', value: 24, color: 'bg-emerald-500' },
    { label: 'استجابة API', value: 15, color: 'bg-blue-500' },
    { label: 'قاعدة البيانات', value: 62, color: 'bg-violet-500' },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button onClick={() => navigate('/admin/settings')}
            className="text-sm font-bold text-slate-600 border-2 border-slate-100 hover:border-slate-200 px-4 py-2.5 rounded-2xl transition-all">
            الإعدادات
          </button>
          <button onClick={() => navigate('/admin/doctors')}
            className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            <UserPlus className="w-4 h-4" />
            إضافة طبيب
          </button>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">لوحة تحكم الإدارة</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">نظرة عامة شاملة على النظام</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={stat.title} className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex-1 text-right">
              <p className="text-xs font-bold text-slate-400 uppercase">{stat.title}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{stat.value}</p>
              <p className="text-xs font-bold text-emerald-600 mt-0.5 flex items-center gap-0.5 justify-end">
                <ArrowUpRight className="w-3 h-3" />{stat.change}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${STAT_STYLES[i].color} flex items-center justify-center shadow-md ${STAT_STYLES[i].shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <button onClick={() => navigate('/admin/bookings')}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              عرض الكل
            </button>
            <div className="text-right">
              <h2 className="font-black text-slate-900">آخر الحجوزات</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">أحدث المواعيد المضافة</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {recentBookings.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-medium text-sm">لا توجد حجوزات حديثة</div>
            ) : recentBookings.map(b => {
              const st = STATUS_AR[b.status] || STATUS_AR['pending'];
              return (
                <div key={b.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border flex-shrink-0 ${st.color}`}>{st.label}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-black text-slate-800 text-sm">{b.patient}</p>
                      <p className="text-xs text-slate-400 mt-0.5">مع {b.doctor} · {b.time}</p>
                    </div>
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                      {b.patient.charAt(0)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* System Health */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4 text-right">
            <div>
              <h3 className="font-black text-slate-900">حالة النظام</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">مراقبة الأداء اللحظي</p>
            </div>
            {SYSTEM_HEALTH.map(item => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-900">{item.value}%</span>
                  <span className="text-slate-500">{item.label}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="rounded-3xl p-5 text-white space-y-3" style={{ background: 'linear-gradient(135deg, #1e3a8a, #4f46e5)' }}>
            <h3 className="font-black text-right">إجراءات سريعة</h3>
            <button className="w-full py-3 rounded-2xl bg-white font-bold text-indigo-700 text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
              <TrendingUp className="w-4 h-4" />
              تقرير الإيرادات
            </button>
            <button className="w-full py-3 rounded-2xl bg-white/10 border border-white/15 font-bold text-white text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
              <ShieldCheck className="w-4 h-4" />
              مراجعة الأطباء المعلقين
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
