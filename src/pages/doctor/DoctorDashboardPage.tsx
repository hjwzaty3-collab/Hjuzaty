import { useState, useEffect } from 'react';
import {
  Users, Calendar, Clock, TrendingUp, ArrowLeft, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

export default function DoctorDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState({ todayBookings: 0, newPatients: 0, pendingRequests: 0, totalRevenue: 0 });
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchDashboardData(); }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      // 1. Fetch dashboard stats
      const { data: statsData, error: statsErr } = await supabase.rpc('get_doctor_dashboard_stats', {
        p_doctor_id: user.id
      });
      if (statsErr) throw statsErr;

      const s = statsData || {};
      setStats({
        todayBookings: Number(s.today_bookings_count) || 0,
        newPatients: Number(s.patient_count) || 0,
        pendingRequests: Number(s.pending_count) || 0,
        totalRevenue: Number(s.revenue) || 0
      });

      // 2. Fetch today's bookings list
      const { data: bData, error: bErr } = await supabase.rpc('get_doctor_today_bookings', {
        p_doctor_id: user.id
      });
      if (bErr) throw bErr;

      if (bData && bData.length > 0) {
        setTodayBookings(bData.map((b: any) => ({
          id: b.id,
          patientId: b.patient_id,
          patientName: b.patient_name || 'مريض',
          time: b.start_time,
          type: b.notes || 'استشارة',
          status: b.status,
        })));
      } else {
        setTodayBookings([]);
      }

      // 3. Set upcoming bookings count for the next 3 days
      const getArabicDayName = (dateStr: string) => {
        const d = new Date(dateStr);
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        return days[d.getDay()];
      };

      const todayObj = new Date();
      const nextDays = [];
      const keys = ['upcoming_day1_count', 'upcoming_day2_count', 'upcoming_day3_count'];
      for (let i = 1; i <= 3; i++) {
        const nextDate = new Date(todayObj);
        nextDate.setDate(todayObj.getDate() + i);
        const dateStr = nextDate.toISOString().split('T')[0];
        const countKey = keys[i - 1];
        nextDays.push({
          date: i === 1 ? 'غداً' : getArabicDayName(dateStr),
          count: Number(s[countKey]) || 0
        });
      }
      setUpcoming(nextDays);

    } catch (error) {
      console.error('Dashboard error:', error);
      setTodayBookings([]);
      setStats({ todayBookings: 0, newPatients: 0, pendingRequests: 0, totalRevenue: 0 });
      setUpcoming([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAllToday = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('doctor_id', user.id)
        .eq('booking_date', today)
        .eq('status', 'pending');
      
      if (error) throw error;
      toast.success('تم تأكيد جميع حجوزات اليوم المعلقة بنجاح ✓');
      fetchDashboardData();
    } catch (e: any) {
      toast.error('فشل تأكيد الحجوزات: ' + e.message);
    }
  };

  const handleCloseClinicEarly = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('doctor_id', user.id)
        .eq('booking_date', today)
        .eq('status', 'pending');

      if (error) throw error;
      toast.success('تم إلغاء المواعيد المعلقة المتبقية لليوم ✓');
      fetchDashboardData();
    } catch (e: any) {
      toast.error('فشل إغلاق العيادة: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  const STATS = [
    { label: 'حجوزات اليوم', value: stats.todayBookings, icon: Calendar, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100' },
    { label: 'إجمالي المرضى', value: stats.newPatients, icon: Users, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100' },
    { label: 'طلبات معلقة', value: stats.pendingRequests, icon: AlertCircle, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100' },
    { label: 'الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ع`, icon: TrendingUp, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-100' },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/doctor/schedule')}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-4 rounded-2xl transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
        >
          <Clock className="w-4 h-4" />
          إدارة الجدول
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">لوحة تحكم الطبيب</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">نظرة عامة على أداء عيادتك.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className={`bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
            <div className={`flex-1 text-right`}>
              <p className="text-xs font-bold text-slate-400 uppercase">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{stat.value}</p>
            </div>
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md ${stat.shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Bookings */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <button
              onClick={() => navigate('/doctor/bookings')}
              className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              عرض الكل
            </button>
            <div className="text-right">
              <h2 className="font-black text-slate-900">حجوزات اليوم</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">لديك {todayBookings.length} موعداً اليوم</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {todayBookings.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-medium text-sm">لا توجد حجوزات لليوم</div>
            ) : todayBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                {/* RIGHT side: Avatar + Name (first in DOM = right in RTL) */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                  >
                    {booking.patientName.charAt(0)}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-800 text-sm">{booking.patientName}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {booking.time} · {booking.type}
                    </p>
                  </div>
                </div>
                {/* LEFT side: Status + Action (second in DOM = left in RTL) */}
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${booking.status === 'confirmed' ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                    {booking.status === 'confirmed' ? 'مؤكد' : 'معلق'}
                  </span>
                  <button
                    onClick={() => navigate(`/doctor/medical-records?patient=${booking.patientName}&patientId=${booking.patientId}`)}
                    className="text-xs font-bold text-slate-600 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600 px-3 py-1.5 rounded-xl transition-all"
                  >
                    بدء الزيارة
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="rounded-3xl p-5 text-white space-y-3" style={{ background: 'linear-gradient(135deg, #1e3a8a, #4f46e5)' }}>
            <h3 className="font-black text-right">إجراءات سريعة</h3>
            <button 
              onClick={handleConfirmAllToday}
              className="w-full py-3 rounded-2xl bg-white font-bold text-indigo-700 text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 active:scale-[0.98] transition-all duration-200"
            >
              <CheckCircle2 className="w-4 h-4" />
              تأكيد كل حجوزات اليوم
            </button>
            <button 
              onClick={handleCloseClinicEarly}
              className="w-full py-3 rounded-2xl bg-white/10 border border-white/15 font-bold text-white text-sm flex items-center justify-center gap-2 hover:bg-white/20 active:scale-[0.98] transition-all duration-200"
            >
              <Clock className="w-4 h-4" />
              إغلاق العيادة مبكراً
            </button>
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3">
            <h3 className="font-black text-slate-900 text-right">الحجوزات القادمة</h3>
            <div className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="py-6 text-center text-slate-400 font-medium text-xs">لا توجد حجوزات قادمة</div>
              ) : upcoming.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3">
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-1">
                    {item.count} حجز
                  </span>
                  <span className="text-sm font-bold text-slate-600">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
